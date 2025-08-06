import { readPsd, Psd as AgPsdObject, Layer as AgPsdLayerInternalimport, Justification as AgPsdJustification } from 'ag-psd';
// import * as AgPsd from 'ag-psd'; // Removed namespace import for ag-psd
import pinyin from 'pinyin';
import { AgPsdColor } from '../types';
import {
  ExtractedLayer,
  ParsedPsdData,
  ExtractedImageElement,
  ExtractedTextElement,
  ExtractedRectElement,
  RichTextNotification,
  PsdLayer, // Our internal PsdLayer
  PsdStructuralData,
  ExtractedXGroupButtonElement,
  ExtractedGroupElement,
  ExtractedRewardBarElement,
  ExtractedSimpleButtonElement,
  AgPsdLayerMaskData,
  PsdParsingError,
  CssTextAlign,
  StyleRunStyle,
  PsdOverallTextStyle,
  ExtractedBaseItemBoxElement
} from '../types';

// Use the renamed AgPsdLayerInternalimport for type hints from the library directly
type AgPsdLayerAgPsd = AgPsdLayerInternalimport; // Renamed to avoid confusion with our PsdLayer

// Local interface for PSD warnings if PsdWarning is not directly exportable or causes issues.
interface LocalPsdWarning {
  message: string;
  path?: (string | number)[];
  [key: string]: any; // Allow other properties
}


// --- Japanese to Romaji (Simplified Placeholder) ---
// IMPORTANT: The function below (convertToRomaji) and its associated map (simpleRomajiMap)
// provide a VERY SIMPLIFIED placeholder for Japanese Kana (Hiragana/Katakana) to Romaji conversion.
// It DOES NOT handle Kanji characters.
// For robust, production-quality Japanese to Romaji conversion (including Kanji),
// a dedicated library such as 'kuroshiro' along with an analyzer like 'kuroshiro-analyzer-kuromoji'
// is ESSENTIAL. Integrating such libraries, especially 'kuromoji' which requires dictionary files,
// needs careful setup to ensure dictionary files are correctly served and accessible by the browser.
// This placeholder is NOT suitable for comprehensive CJK text processing in a production environment.
const simpleRomajiMap: Record<string, string> = {
  // Hiragana
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
  'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'わ': 'wa', 'を': 'wo', 'ん': 'n',
  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
  // Katakana
  'ア': 'A', 'イ': 'I', 'ウ': 'U', 'エ': 'E', 'オ': 'O',
  'カ': 'KA', 'キ': 'KI', 'ク': 'KU', 'ケ': 'KE', 'コ': 'KO',
  'サ': 'SA', 'シ': 'SHI', 'ス': 'SU', 'セ': 'SE', 'ソ': 'SO',
  'タ': 'TA', 'チ': 'CHI', 'ツ': 'TSU', 'テ': 'TE', 'ト': 'TO',
  'ナ': 'NA', 'ニ': 'NI', 'ヌ': 'NU', 'ネ': 'NE', 'ノ': 'NO',
  'ハ': 'HA', 'ヒ': 'HI', 'フ': 'FU', 'ヘ': 'HE', 'ホ': 'HO',
  'マ': 'MA', 'ミ': 'MI', 'ム': 'MU', 'メ': 'ME', 'モ': 'MO',
  'ヤ': 'YA', 'ユ': 'YU', 'ヨ': 'YO',
  'ラ': 'RA', 'リ': 'RI', 'ル': 'RU', 'レ': 'RE', 'ロ': 'RO',
  'ワ': 'WA', 'ヲ': 'WO', 'ン': 'N',
  'ガ': 'GA', 'ギ': 'GI', 'グ': 'GU', 'ゲ': 'GE', 'ゴ': 'GO',
  'ザ': 'ZA', 'ジ': 'JI', 'ヅ': 'ZU', 'ゼ': 'ZE', 'ゾ': 'ZO', // Corrected: 'ぜ' to 'ゼ'
  'ダ': 'DA', 'ヂ': 'DI', 'デ': 'DE', 'ド': 'DO',
  'バ': 'BA', 'ビ': 'BI', 'ブ': 'BU', 'ベ': 'BE', 'ボ': 'BO',
  'パ': 'PA', 'ピ': 'PI', 'プ': 'PU', 'ペ': 'PE', 'ポ': 'PO',
  // Common symbols and full-width numbers
  'ー': '-', '、': ',', '。': '.',
  '１': '1', '２': '2', '３': '3', '４': '4', '５': '5', '６': '6', '７': '7', '８': '8', '９': '9', '０': '0',
};

function convertToRomaji(text: string): string {
  let result = '';
  for (const char of text) {
    result += simpleRomajiMap[char] || char; // Fallback to original char if not in map
  }
  return result;
}

function convertToPinyin(text: string): string {
  try {
    const pinyinArray = pinyin(text, {
      style: pinyin.STYLE_NORMAL,
      heteronym: false,
    });
    return pinyinArray.map(arr => arr[0]).join('');
  } catch (error) {
    console.warn(`Pinyin conversion failed for "${text}". Falling back to original character.`, error);
    return text;
  }
}

// Enhanced global sanitizer: CJK -> Pinyin/Romaji, Camel/Pascal -> snake_case, general sanitization
function convertToSnakeCaseAndSanitize(name?: string): string {
  if (!name || name.trim() === "") return 'unnamed_layer';

  let processedName = "";
  // 1. CJK to Pinyin/Romaji
  for (const char of name) {
    if (/[\u4e00-\u9fa5]/.test(char)) { // Chinese characters
      processedName += convertToPinyin(char);
    } else if (simpleRomajiMap[char]) { // Japanese Kana (from our limited map)
      processedName += simpleRomajiMap[char];
    } else {
      processedName += char;
    }
  }

  // 2. Convert to snake_case from CamelCase/PascalCase
  let snakeCased = processedName
    .replace(/([A-Z]+)([A-Z][a-z0-9])/g, '$1_$2') // Handles "XMLData" -> "XML_Data"
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')    // Handles "canReceive" or "CanReceive" -> "can_Receive"
    .toLowerCase(); // Convert everything to lowercase

  // 3. General sanitization: replace non-alphanumeric (except underscore) with underscore
  snakeCased = snakeCased.replace(/[^a-z0-9_]/g, '_');

  // 4. Collapse multiple underscores and trim leading/trailing underscores
  snakeCased = snakeCased.replace(/__+/g, '_');
  snakeCased = snakeCased.replace(/^_+|_+$/g, '');

  if (snakeCased === "" || snakeCased === "_") return 'sanitized_layer';

  return snakeCased;
}


// Generates resource names like "img_can_receive" from "imgCanReceive"
function generateResourceNameForImgLayer(originalName: string): string {
  const nameLower = originalName.toLowerCase();
  let basePart = originalName;
  const imgPrefixPart = "img"; // The "img" part of the name

  if (nameLower.startsWith("img")) {
    basePart = originalName.substring(3); // Part after "img"
  }
  // This function is intended for "img" prefixed names.

  // Remove leading non-alphanumeric characters (like underscores) from basePart
  // e.g., if originalName was "img_Button", basePart becomes "Button"
  basePart = basePart.replace(/^[^a-zA-Z0-9]+/, '');

  if (!basePart) { // If originalName was "img" or "img_" or "img___"
    return imgPrefixPart; // Results in "img" as base, leading to "prefix_img_png"
  }

  // Convert the rest of the name (e.g., "CanReceive") to snake_case
  const snakeCaseSuffix = convertToSnakeCaseAndSanitize(basePart);

  return `${imgPrefixPart}_${snakeCaseSuffix}`; // e.g., img_can_receive
}


function generateNameForGroup(originalLayerName: string): string {
  const prefixRegex = /^(grp_?)/i; // Matches 'grp' or 'grp_'
  let suffix = originalLayerName;

  const match = originalLayerName.match(prefixRegex);
  if (match) {
    suffix = originalLayerName.substring(match[0].length);
  }

  let processedSuffix = "";
  for (const char of suffix) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      processedSuffix += convertToPinyin(char);
    } else if (simpleRomajiMap[char]) {
      processedSuffix += simpleRomajiMap[char];
    } else {
      processedSuffix += char;
    }
  }
  suffix = processedSuffix;

  suffix = suffix.replace(/[^a-zA-Z0-9_]/g, '_');
  suffix = suffix.replace(/__+/g, '_');
  suffix = suffix.replace(/^_+|_+$/g, '');

  if (suffix === "") {
    suffix = "defaultGroup";
  }

  const parts = suffix.split('_').filter(p => p.length > 0);
  let idPart;
  if (parts.length === 0) {
    idPart = "DefaultGroup";
  } else {
    idPart = parts.map((part) => {
      if (!part) return "";
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join('');
  }

  if (!idPart) {
    idPart = "DefaultGroup";
  }

  const finalName = 'grp' + idPart;
  return finalName;
}


const buildLayerTreeRecursive = (layers: AgPsdLayerAgPsd[] | undefined): PsdLayer[] => {
  if (!layers) return [];
  const result: PsdLayer[] = [];

  for (const layer of layers) {
    if (layer.hidden === true) {
      continue;
    }

    const processedLayer: PsdLayer = { ...(layer as any), meta: {} };
    const layerNameLower = layer.name?.toLowerCase();

    // Check for special types first, but "img" prefix priority is handled in processLayerListToExtractedElements
    if (layerNameLower?.startsWith('rewardbar')) {
      processedLayer.meta!.isRewardBar = true;
    } else if (layerNameLower?.startsWith('item')) {
        processedLayer.meta!.isBaseItemBox = true;
    }
    // Only mark as group types if not an "img" prefixed layer that will be flattened
    else if (layer.children && layer.children.length > 0 && !layerNameLower?.startsWith('img')) {
        if (layerNameLower?.startsWith('btn')) {
          processedLayer.meta!.isXGroupButton = true;
        } else {
          processedLayer.meta!.isSimpleGroup = true;
        }
    }
    // Recurse children for all layers, including "img" groups (which might be flattened later)
    if (layer.children && layer.children.length > 0) {
        processedLayer.children = buildLayerTreeRecursive(layer.children);
    }
    result.push(processedLayer);
  }
  return result;
};

export function agPsdColorToHex(colorInput: AgPsdColor | undefined): string {
    if (!colorInput || typeof colorInput !== 'object' ) {
        return "#000000"; // Default to black in #RRGGBB format
    }

    let rNum: number, gNum: number, bNum: number;
    const c = colorInput as any;

    if (typeof c.r === 'number' && typeof c.g === 'number' && typeof c.b === 'number') {
        if (c.format === 'frgb') {
            rNum = Math.round(c.r * 255);
            gNum = Math.round(c.g * 255);
            bNum = Math.round(c.b * 255);
        } else {
            rNum = Math.round(c.r);
            gNum = Math.round(c.g);
            bNum = Math.round(c.b);
        }
    }
    else if (typeof c.C === 'number' && typeof c.M === 'number' && typeof c.Y === 'number' && typeof c.K === 'number') {
        const kInv = 1 - (c.K / 100);
        rNum = Math.round(255 * (1 - (c.C / 100)) * kInv);
        gNum = Math.round(255 * (1 - (c.M / 100)) * kInv);
        bNum = Math.round(255 * (1 - (c.Y / 100)) * kInv);
    }
    else if (typeof c.Gray === 'number') {
        const grayVal = Math.round((c.Gray / 10000) * 255);
        rNum = gNum = bNum = grayVal;
    } else if (typeof c.gray === 'number') {
        rNum = gNum = bNum = Math.round(c.gray);
    }
    else if (Array.isArray(c.Values) && c.Values.length === 4) {
        rNum = Math.round(c.Values[1] * 255);
        gNum = Math.round(c.Values[2] * 255);
        bNum = Math.round(c.Values[3] * 255);
    }
    else if (Array.isArray(colorInput) && colorInput.length >=3) {
        rNum = Math.round(colorInput[0]);
        gNum = Math.round(colorInput[1]);
        bNum = Math.round(colorInput[2]);
    } else {
        return "#000000"; // Default to black in #RRGGBB format
    }

    rNum = Math.max(0, Math.min(255, rNum));
    gNum = Math.max(0, Math.min(255, gNum));
    bNum = Math.max(0, Math.min(255, bNum));

    const toHex = (val: number) => val.toString(16).padStart(2, '0');
    return `#${(toHex(rNum) + toHex(gNum) + toHex(bNum)).toUpperCase()}`; // Changed from 0x to #
}


interface LayerOutputTypeResult {
  type: 'text' | 'image';
  reason?: string;
}

export function getEffect(effect: any | any[] | undefined): any | undefined { // Exported
    if (Array.isArray(effect)) {
        return effect.find(e => e && e.enabled) || effect[0];
    }
    return effect;
}

function checkForSignificantEffects(layer: PsdLayer): boolean {
  if (layer.effects?.disabled === true) {
    return false;
  }
  if (layer.effects) {
    const effects = layer.effects;
    if (getEffect(effects.dropShadow)?.enabled) return true;
    if (getEffect(effects.innerShadow)?.enabled) return true;
    if (getEffect(effects.outerGlow)?.enabled) return true;
    if (getEffect(effects.innerGlow)?.enabled) return true;
    if (getEffect(effects.bevelAndEmboss)?.enabled) return true;
    if (getEffect(effects.satin)?.enabled) return true;
    if (getEffect(effects.gradientOverlay)?.enabled) return true;
    if (getEffect(effects.patternOverlay)?.enabled) return true;

    const layerStrokeEffect = getEffect(effects.stroke);
    if (layerStrokeEffect?.enabled && layerStrokeEffect.size?.value > 0) {
        if (layerStrokeEffect.fillType && layerStrokeEffect.fillType !== 'solidColor') {
            return true;
        }
    }

    const solidFillEffect = getEffect(effects.solidFill);
    if (solidFillEffect?.enabled) {
      if (typeof solidFillEffect.opacity === 'number' && solidFillEffect.opacity < 1.0) {
        return true;
      }
      if (solidFillEffect.blendMode && solidFillEffect.blendMode !== 'normal') {
        return true;
      }
    }
  }
  return false;
}


function determineLayerOutputType(layer: PsdLayer): LayerOutputTypeResult {
  if (!layer.text || !layer.text.text) {
    const reason = layer.text ? "Text layer rasterized: Text layer has no actual text content." : undefined;
    return { type: 'image', reason: reason };
  }

  const textLayerPrefix = "Text layer rasterized: ";

  if (layer.effects?.disabled === true) {
    return { type: 'text' };
  }

  if (layer.effects) {
    const effects = layer.effects;
    if (getEffect(effects.dropShadow)?.enabled) return { type: 'image', reason: `${textLayerPrefix}Contains Drop Shadow effect.` };
    if (getEffect(effects.innerShadow)?.enabled) return { type: 'image', reason: `${textLayerPrefix}Contains Inner Shadow effect.` };
    if (getEffect(effects.outerGlow)?.enabled) return { type: 'image', reason: `${textLayerPrefix}Contains Outer Glow effect.` };
    if (getEffect(effects.innerGlow)?.enabled) return { type: 'image', reason: `${textLayerPrefix}Contains Inner Glow effect.` };
    if (getEffect(effects.bevelAndEmboss)?.enabled) return { type: 'image', reason: `${textLayerPrefix}Contains Bevel/Emboss effect.` };
    if (getEffect(effects.satin)?.enabled) return { type: 'image', reason: `${textLayerPrefix}Contains Satin effect.` };
    if (getEffect(effects.gradientOverlay)?.enabled) return { type: 'image', reason: `${textLayerPrefix}Contains Gradient Overlay effect.` };
    if (getEffect(effects.patternOverlay)?.enabled) return { type: 'image', reason: `${textLayerPrefix}Contains Pattern Overlay effect.` };

    const solidFillEffect = getEffect(effects.solidFill);
    if (solidFillEffect?.enabled) {
      if (typeof solidFillEffect.opacity === 'number' && solidFillEffect.opacity < 0.99) {
        return { type: 'image', reason: `${textLayerPrefix}Color Overlay opacity is ${(solidFillEffect.opacity * 100).toFixed(0)}%.` };
      }
      if (solidFillEffect.blendMode && solidFillEffect.blendMode !== 'normal') {
        return { type: 'image', reason: `${textLayerPrefix}Color Overlay uses '${solidFillEffect.blendMode}' blend mode.` };
      }
    }
  }
  return { type: 'text' };
}

interface SolidRectCheckResult {
  isSolidRect: boolean;
  fillColor?: string;
  fillAlpha?: number;
}

function checkCanvasForSolidColor(canvas: HTMLCanvasElement): SolidRectCheckResult {
  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    return { isSolidRect: false };
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { isSolidRect: false };

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let firstVisibleIndex = -1;
  for (let i = 0; i < data.length; i += 4) {
      if (data[i+3] > 0) {
          firstVisibleIndex = i;
          break;
      }
  }

  if (firstVisibleIndex === -1) {
      return { isSolidRect: true, fillColor: "#000000", fillAlpha: 0 }; // Default to transparent black
  }

  const r1 = data[firstVisibleIndex];
  const g1 = data[firstVisibleIndex+1];
  const b1 = data[firstVisibleIndex+2];
  const a1 = data[firstVisibleIndex+3];

  for (let i = 0; i < data.length; i += 4) {
    if (data[i] !== r1 || data[i+1] !== g1 || data[i+2] !== b1 || data[i+3] !== a1) {
      return { isSolidRect: false };
    }
  }

  const toHex = (val: number) => val.toString(16).padStart(2, '0');
  return {
    isSolidRect: true,
    fillColor: `#${(toHex(r1) + toHex(g1) + toHex(b1)).toUpperCase()}`, // Return #RRGGBB
    fillAlpha: a1 / 255,
  };
}

export const extractPsdStructure = async (file: File): Promise<PsdStructuralData> => {
  const arrayBuffer = await file.arrayBuffer();
  const parsingErrors: PsdParsingError[] = [];

  const psd = readPsd(arrayBuffer, {
    skipLayerImageData: false,
    throwForMissingFeatures: false,
  });

  const psdWithPotentialWarnings = psd as AgPsdObject & { warnings?: LocalPsdWarning[] };

  if (psdWithPotentialWarnings.warnings && psdWithPotentialWarnings.warnings.length > 0) {
    psdWithPotentialWarnings.warnings.forEach(warning => {
      const pathString = warning.path ? (warning.path as (string|number)[]).join(' > ') : undefined;
      parsingErrors.push({
        message: warning.message || "Unknown ag-psd warning",
        layerName: pathString,
        errorObject: warning,
      });
      console.warn(`[ag-psd Parser Warning]${pathString ? ` Path: ${pathString}` : ''}: ${warning.message}`);
    });
  }

  if (!psd.width || !psd.height) {
    throw new Error("Invalid PSD data: Missing width or height information. The file might be corrupted or not a valid PSD.");
  }

  const allLayers = buildLayerTreeRecursive(psd.children);
  return { psd, allLayers, parsingErrors };
};

function calculatePixelValue(
    pointValue: number | undefined,
    psdImageResources: AgPsdObject['imageResources'],
    textTransform: number[] | undefined
): number {
    if (typeof pointValue !== 'number' || pointValue <= 0) return 0;

    let dpi = 72;
    if (psdImageResources?.resolutionInfo?.verticalResolution) {
        dpi = psdImageResources.resolutionInfo.verticalResolution;
        if (String(psdImageResources.resolutionInfo.verticalResolutionUnit) === '2') {
            dpi = dpi * 2.54;
        }
    }
    if (dpi <= 0) dpi = 72;

    const valueInPixels = pointValue * dpi / 72;

    if (textTransform && textTransform.length >= 4) {
        const [xx, xy, yx, yy] = textTransform;
        const Sx = Math.hypot(xx, xy);
        const Sy = Math.hypot(yx, yy);
        const avgScale = (Sx + Sy) / 2;
        const effectiveScale = (avgScale > 1e-6) ? avgScale : 1;
        return Math.round(valueInPixels * effectiveScale);
    }
    return Math.round(valueInPixels);
}

function applyLayerMaskToCanvas(
    baseCanvas: HTMLCanvasElement,
    layerMaskInfo: AgPsdLayerMaskData,
    layerLeftPx: number,
    layerTopPx: number
): HTMLCanvasElement {
    if (!layerMaskInfo || !layerMaskInfo.canvas || layerMaskInfo.disabled) {
        return baseCanvas;
    }

    const maskCanvas = layerMaskInfo.canvas;

    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = baseCanvas.width;
    resultCanvas.height = baseCanvas.height;
    const ctx = resultCanvas.getContext('2d');

    if (!ctx) {
        console.warn("Failed to get 2D context for mask application. Returning original canvas.");
        return baseCanvas;
    }

    ctx.drawImage(baseCanvas, 0, 0);

    const alphaMaskCanvas = document.createElement('canvas');
    alphaMaskCanvas.width = maskCanvas.width;
    alphaMaskCanvas.height = maskCanvas.height;
    const alphaCtx = alphaMaskCanvas.getContext('2d', { willReadFrequently: true });

    if (!alphaCtx) {
        console.warn("Failed to get 2D context for alpha mask preparation. Returning original canvas.");
        return baseCanvas;
    }

    alphaCtx.drawImage(maskCanvas, 0, 0);

    try {
        const imageData = alphaCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        const data = imageData.data;
        const invertMask = !!(layerMaskInfo as any).invertLayerMaskWhenBlending;

        for (let i = 0; i < data.length; i += 4) {
            let alphaValue = data[i];
            if (invertMask) {
                alphaValue = 255 - alphaValue;
            }
            data[i] = 0;
            data[i+1] = 0;
            data[i+2] = 0;
            data[i+3] = alphaValue;
        }
        alphaCtx.putImageData(imageData, 0, 0);
    } catch (e) {
        console.error("Error processing mask ImageData (possibly tainted canvas):", e);
        return baseCanvas;
    }

    ctx.globalCompositeOperation = 'destination-in';
    const maskDrawX = (layerMaskInfo.left ?? 0) - layerLeftPx;
    const maskDrawY = (layerMaskInfo.top ?? 0) - layerTopPx;
    ctx.drawImage(alphaMaskCanvas, maskDrawX, maskDrawY);

    ctx.globalCompositeOperation = 'source-over';

    return resultCanvas;
}

interface TrimResult {
    trimmedCanvas: HTMLCanvasElement;
    offsetX: number;
    offsetY: number;
}

function trimTransparentPixels(canvas: HTMLCanvasElement): TrimResult {
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
        return { trimmedCanvas: canvas, offsetX: 0, offsetY: 0 };
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        return { trimmedCanvas: canvas, offsetX: 0, offsetY: 0 };
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
    let hasVisiblePixels = false;

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const alpha = data[(y * canvas.width + x) * 4 + 3];
            if (alpha > 0) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
                hasVisiblePixels = true;
            }
        }
    }

    if (!hasVisiblePixels) {
        const emptyCanvas = document.createElement('canvas');
        emptyCanvas.width = 0;
        emptyCanvas.height = 0;
        return { trimmedCanvas: emptyCanvas, offsetX: 0, offsetY: 0 };
    }

    const trimmedWidth = maxX - minX + 1;
    const trimmedHeight = maxY - minY + 1;

    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = trimmedWidth;
    trimmedCanvas.height = trimmedHeight;
    const trimmedCtx = trimmedCanvas.getContext('2d');

    if (!trimmedCtx) {
        return { trimmedCanvas: canvas, offsetX: 0, offsetY: 0 };
    }

    trimmedCtx.drawImage(canvas, minX, minY, trimmedWidth, trimmedHeight, 0, 0, trimmedWidth, trimmedHeight);

    return { trimmedCanvas, offsetX: minX, offsetY: minY };
}

function applyOpacityToCanvas(canvas: HTMLCanvasElement, opacity: number): HTMLCanvasElement {
    if (opacity >= 0.99 || !canvas || canvas.width === 0 || canvas.height === 0) {
        return canvas;
    }

    const newCanvas = document.createElement('canvas');
    newCanvas.width = canvas.width;
    newCanvas.height = canvas.height;
    const ctx = newCanvas.getContext('2d');

    if (!ctx) {
        console.warn("Failed to get 2D context for opacity application. Returning original canvas.");
        return canvas;
    }

    ctx.globalAlpha = opacity;
    ctx.drawImage(canvas, 0, 0);
    ctx.globalAlpha = 1.0;
    return newCanvas;
}

function agPsdJustificationToCssTextAlign(justification: AgPsdJustification | undefined): CssTextAlign | undefined {
  if (justification === undefined) return undefined;
  switch (justification) {
    case 'justify-left':
      return 'left';
    case 'justify-right':
      return 'right';
    case 'justify-center':
      return 'center';
    case 'justify-all':
      return 'left';
    default:
      return justification;
  }
}

let globalElementIdCounter = 0;

function processLayerListToExtractedElements(
    layersToProcess: PsdLayer[],
    psd: AgPsdObject,
    imageResourcePrefix: string,
    uniqueImageDataUrls: Map<string, string>,
    richTextNotifications: RichTextNotification[],
): ExtractedLayer[] {
    const extractedElements: ExtractedLayer[] = [];

    for (const layer of layersToProcess) {
        const layerOriginalName = layer.name || `Layer_${globalElementIdCounter}`;
        const currentElementId = `element_${globalElementIdCounter++}`;
        // This is the default name for non-image elements or fallback.
        // For image resources, a more specific base name will be derived.
        const defaultElementName = convertToSnakeCaseAndSanitize(layerOriginalName);


        const layerLeftPx = layer.left ?? 0;
        const layerTopPx = layer.top ?? 0;
        const layerMasterOpacity = (typeof layer.opacity === 'number') ? layer.opacity : 1.0;

        // --- PRIORITY: "img" prefixed layers ---
        if (layer.name && layer.name.toLowerCase().startsWith('img')) {
            let canvasForProcessing = layer.canvas;
            if (layer.canvas && layer.mask) {
                canvasForProcessing = applyLayerMaskToCanvas(layer.canvas, layer.mask, layerLeftPx, layerTopPx);
            }

            if (!canvasForProcessing || canvasForProcessing.width <= 0 || canvasForProcessing.height <= 0) {
                console.warn(`"img" prefixed layer "${layerOriginalName}" skipped: no base canvas or zero dimensions after potential masking.`);
                continue;
            }

            const { trimmedCanvas, offsetX: trimOffsetX, offsetY: trimOffsetY } = trimTransparentPixels(canvasForProcessing);

            if (trimmedCanvas.width <= 0 || trimmedCanvas.height <= 0) {
                console.warn(`"img" prefixed layer "${layerOriginalName}" skipped: zero dimensions after trimming.`);
                continue;
            }

            const contentActualX = layerLeftPx + trimOffsetX;
            const contentActualY = layerTopPx + trimOffsetY;
            const contentActualWidth = trimmedCanvas.width;
            const contentActualHeight = trimmedCanvas.height;

            const finalClippedX = Math.max(contentActualX, 0);
            const finalClippedY = Math.max(contentActualY, 0);
            const finalClippedRight = Math.min(contentActualX + contentActualWidth, psd.width!);
            const finalClippedBottom = Math.min(contentActualY + contentActualHeight, psd.height!);

            const finalVisibleWidth = finalClippedRight - finalClippedX;
            const finalVisibleHeight = finalClippedBottom - finalClippedY;

            if (finalVisibleWidth <= 0 || finalVisibleHeight <= 0) {
                console.warn(`"img" prefixed layer "${layerOriginalName}" has no visible part within PSD boundaries after trimming. Skipping.`);
                continue;
            }

            let dataUrl: string;
            const dataUrlCanvas = document.createElement('canvas');
            dataUrlCanvas.width = finalVisibleWidth;
            dataUrlCanvas.height = finalVisibleHeight;
            const duCtx = dataUrlCanvas.getContext('2d');

            if (duCtx) {
                const sxOnTrimmed = Math.max(0, finalClippedX - contentActualX);
                const syOnTrimmed = Math.max(0, finalClippedY - contentActualY);
                duCtx.drawImage(trimmedCanvas, sxOnTrimmed, syOnTrimmed, finalVisibleWidth, finalVisibleHeight, 0, 0, finalVisibleWidth, finalVisibleHeight);

                let finalCanvasForDataUrl = dataUrlCanvas;
                if (layerMasterOpacity < 0.99) {
                    finalCanvasForDataUrl = applyOpacityToCanvas(dataUrlCanvas, layerMasterOpacity);
                }
                dataUrl = finalCanvasForDataUrl.toDataURL('image/png');

                let imageResourceName: string;
                // Use new naming convention for "img" prefixed layers
                let baseNameForDeduplication = generateResourceNameForImgLayer(layerOriginalName);

                const trimmedPrefix = imageResourcePrefix.trim();
                if (trimmedPrefix !== "") baseNameForDeduplication = `${trimmedPrefix}_${baseNameForDeduplication}`;

                if (uniqueImageDataUrls.has(dataUrl)) {
                    imageResourceName = uniqueImageDataUrls.get(dataUrl)!;
                } else {
                    let attemptName = `${baseNameForDeduplication}_png`;
                    let counter = 0;
                    const existingNames = new Set(Array.from(uniqueImageDataUrls.values()));
                    while (existingNames.has(attemptName)) {
                        counter++;
                        attemptName = `${baseNameForDeduplication}_${counter}_png`;
                    }
                    imageResourceName = attemptName;
                    uniqueImageDataUrls.set(dataUrl, imageResourceName);
                }

                const hadEffects = checkForSignificantEffects(layer);
                const imageElement: ExtractedImageElement = {
                    id: currentElementId,
                    type: 'image',
                    originalName: layerOriginalName, // Keep original name for EXML ID
                    name: imageResourceName,         // New resource name format
                    dataUrl,
                    x: finalClippedX,
                    y: finalClippedY,
                    width: finalVisibleWidth,
                    height: finalVisibleHeight,
                    opacity: layerMasterOpacity,
                    hadEffectsOriginally: hadEffects,
                };
                extractedElements.push(imageElement);
                continue;
            } else {
                console.warn(`Could not get 2D context for dataURL canvas for "img" prefixed layer "${layerOriginalName}". Skipping.`);
                continue;
            }
        }
        // --- End of "img" prefixed layer processing ---

        const isXGroupButton = layer.meta?.isXGroupButton;
        const isSimpleGroup = layer.meta?.isSimpleGroup;
        const isRewardBar = layer.meta?.isRewardBar;
        const isBaseItemBox = layer.meta?.isBaseItemBox;

        if (isRewardBar || isBaseItemBox) {
            const componentType = isRewardBar ? 'rewardBar' : 'baseItemBox';
            const componentNameForLog = isRewardBar ? 'RewardBar' : 'BaseItemBox';
            const exmlIdForComponent = layerOriginalName; // EXML id remains original name

            let canvasForProcessing = layer.canvas;
            if (layer.canvas && layer.mask) {
                canvasForProcessing = applyLayerMaskToCanvas(layer.canvas, layer.mask, layerLeftPx, layerTopPx);
            }

            if (!canvasForProcessing || canvasForProcessing.width <= 0 || canvasForProcessing.height <= 0) {
                console.warn(`${componentNameForLog} layer "${layerOriginalName}" skipped: no base canvas or zero dimensions after potential masking.`);
                continue;
            }

            const { trimmedCanvas, offsetX: trimOffsetX, offsetY: trimOffsetY } = trimTransparentPixels(canvasForProcessing);

            if (trimmedCanvas.width <= 0 || trimmedCanvas.height <= 0) {
                console.warn(`${componentNameForLog} layer "${layerOriginalName}" skipped: zero dimensions after trimming.`);
                continue;
            }

            const contentActualX = layerLeftPx + trimOffsetX;
            const contentActualY = layerTopPx + trimOffsetY;
            const contentActualWidth = trimmedCanvas.width;
            const contentActualHeight = trimmedCanvas.height;

            const finalPositionX = Math.max(contentActualX, 0);
            const finalPositionY = Math.max(contentActualY, 0);
            const finalPositionRight = Math.min(contentActualX + contentActualWidth, psd.width!);
            const finalPositionBottom = Math.min(contentActualY + contentActualHeight, psd.height!);

            const clippedVisibleWidth = finalPositionRight - finalPositionX;
            const clippedVisibleHeight = finalPositionBottom - finalPositionY;

            if (clippedVisibleWidth <= 0 || clippedVisibleHeight <= 0) {
                console.warn(`${componentNameForLog} layer "${layerOriginalName}" has no visible part within PSD boundaries after trimming. Skipping.`);
                continue;
            }

            let dataUrlForPreview: string | undefined;
            let imageResourceNameForPreview: string | undefined;

            if (isBaseItemBox && trimmedCanvas.width > 0 && trimmedCanvas.height > 0) {
                let canvasForDataUrl = trimmedCanvas;
                if (layerMasterOpacity < 0.99) {
                    canvasForDataUrl = applyOpacityToCanvas(trimmedCanvas, layerMasterOpacity);
                }
                dataUrlForPreview = canvasForDataUrl.toDataURL('image/png');

                // Generate standardized resource name for BaseItemBox image
                let baseNameForDeduplication = convertToSnakeCaseAndSanitize(layerOriginalName);
                const trimmedPrefix = imageResourcePrefix.trim();
                if (trimmedPrefix !== "") baseNameForDeduplication = `${trimmedPrefix}_${baseNameForDeduplication}`;

                if (uniqueImageDataUrls.has(dataUrlForPreview)) {
                    imageResourceNameForPreview = uniqueImageDataUrls.get(dataUrlForPreview)!;
                } else {
                    let attemptName = `${baseNameForDeduplication}_png`;
                    let counter = 0;
                    const existingNames = new Set(Array.from(uniqueImageDataUrls.values()));
                    while (existingNames.has(attemptName)) {
                        counter++;
                        attemptName = `${baseNameForDeduplication}_${counter}_png`;
                    }
                    imageResourceNameForPreview = attemptName;
                    uniqueImageDataUrls.set(dataUrlForPreview, imageResourceNameForPreview);
                }
            }

            const customComponentElement: ExtractedRewardBarElement | ExtractedBaseItemBoxElement = {
                id: currentElementId,
                type: componentType,
                originalName: layerOriginalName,
                name: exmlIdForComponent, // EXML ID
                x: finalPositionX,
                y: finalPositionY,
                width: contentActualWidth, // Use actual content width for scaling logic later
                height: contentActualHeight, // Use actual content height
                opacity: layerMasterOpacity,
                ...(isBaseItemBox && { dataUrl: dataUrlForPreview, imageResourceName: imageResourceNameForPreview }),
            };
            extractedElements.push(customComponentElement);
            continue;
        }


        if (isXGroupButton || isSimpleGroup) {
            const groupExmlId = isXGroupButton
                ? layerOriginalName // XGroupButton ID is original name
                : generateNameForGroup(layerOriginalName); // Simple Group ID is generated

            const absoluteChildrenElements = processLayerListToExtractedElements(
                layer.children || [],
                psd,
                imageResourcePrefix,
                uniqueImageDataUrls,
                richTextNotifications
            );

            if (!absoluteChildrenElements || absoluteChildrenElements.length === 0) {
                console.warn(`${isXGroupButton ? 'XGroupButton' : 'Simple Group'} "${layerOriginalName}" has no processable children. Skipping group generation.`);
                continue;
            }

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            absoluteChildrenElements.forEach(child => {
                minX = Math.min(minX, child.x);
                minY = Math.min(minY, child.y);
                maxX = Math.max(maxX, child.x + (child.width || 0));
                maxY = Math.max(maxY, child.y + (child.height || 0));
            });

            const groupX = (minX === Infinity) ? layerLeftPx : minX;
            const groupY = (minY === Infinity) ? layerTopPx : minY;
            const groupWidth = (maxX === -Infinity || minX === Infinity) ? 0 : maxX - minX;
            const groupHeight = (maxY === -Infinity || minY === Infinity) ? 0 : maxY - minY;

            if (groupWidth <= 0 || groupHeight <= 0) {
                 console.warn(`${isXGroupButton ? 'XGroupButton' : 'Simple Group'} "${layerOriginalName}" calculated bounding box has zero or negative dimensions. Skipping group generation.`);
                 continue;
            }

            const relativeChildrenElements = absoluteChildrenElements.map(child => ({
                ...child,
                x: child.x - groupX,
                y: child.y - groupY,
            }));

            const groupElement = {
                id: currentElementId,
                type: isXGroupButton ? 'xGroupButton' : 'group',
                originalName: layerOriginalName,
                name: groupExmlId, // EXML ID
                x: groupX,
                y: groupY,
                width: groupWidth,
                height: groupHeight,
                children: relativeChildrenElements,
                opacity: layerMasterOpacity,
            };
            extractedElements.push(groupElement as ExtractedXGroupButtonElement | ExtractedGroupElement);
            continue;
        }

        if (layer.nameSource === 'shap' && layer.vectorOrigination) {
            let authoritativeFillColor = "#000000";
            let authoritativeBaseAlpha: number = 1.0;
            let isDisqualifiedByVectorProperties = false;

            if (layer.vectorFill) {
                if (layer.vectorFill.type === 'color' && layer.vectorFill.color) {
                    authoritativeFillColor = agPsdColorToHex(layer.vectorFill.color);
                } else if (layer.vectorFill.type && layer.vectorFill.type !== 'color') {
                    isDisqualifiedByVectorProperties = true;
                }
            }

            if (!authoritativeFillColor && !isDisqualifiedByVectorProperties && layer.effects?.solidFill) {
                const solidFillEffect = getEffect(layer.effects.solidFill);
                if (solidFillEffect?.enabled && solidFillEffect.color &&
                    (!solidFillEffect.blendMode || solidFillEffect.blendMode === 'normal')) {
                    authoritativeFillColor = agPsdColorToHex(solidFillEffect.color);
                    if (typeof solidFillEffect.opacity === 'number') {
                         authoritativeBaseAlpha = Math.max(0, Math.min(1, solidFillEffect.opacity));
                    }
                } else if (solidFillEffect?.enabled && solidFillEffect.blendMode && solidFillEffect.blendMode !== 'normal') {
                    isDisqualifiedByVectorProperties = true;
                }
            }

            if (!isDisqualifiedByVectorProperties) {
                let shapeHasOtherDisqualifyingVisuals = false;
                if (layer.effects?.disabled !== true && layer.effects) {
                    const fx = layer.effects;
                    if (getEffect(fx.dropShadow)?.enabled || getEffect(fx.innerShadow)?.enabled ||
                        getEffect(fx.outerGlow)?.enabled || getEffect(fx.innerGlow)?.enabled ||
                        getEffect(fx.bevelAndEmboss)?.enabled || getEffect(fx.satin)?.enabled ||
                        getEffect(fx.gradientOverlay)?.enabled || getEffect(fx.patternOverlay)?.enabled) {
                        shapeHasOtherDisqualifyingVisuals = true;
                    }
                }

                if (!shapeHasOtherDisqualifyingVisuals && layer.vectorStroke &&
                    layer.vectorStroke.enabled !== false && layer.vectorStroke.strokeEnabled !== false) {
                    if (layer.vectorStroke.type && layer.vectorStroke.type !== 'solidColor') {
                        shapeHasOtherDisqualifyingVisuals = true;
                    }
                }

                const layerEffectStroke = getEffect(layer.effects?.stroke);
                if (!shapeHasOtherDisqualifyingVisuals && layerEffectStroke?.enabled && layerEffectStroke.size?.value > 0) {
                    if (layerEffectStroke.fillType && layerEffectStroke.fillType !== 'solidColor') {
                        shapeHasOtherDisqualifyingVisuals = true;
                    }
                }

                if (!shapeHasOtherDisqualifyingVisuals) {
                    const finalFillColor = authoritativeFillColor;
                    let finalCombinedAlpha: number;
                    finalCombinedAlpha = Math.max(0, Math.min(1, authoritativeBaseAlpha * layerMasterOpacity));

                    const vectorOriginDescriptor = layer.vectorOrigination.keyDescriptorList[0] as any;
                    const vectorBounding = vectorOriginDescriptor.keyOriginShapeBoundingBox;
                    
                    let cornerRadius: number | undefined = undefined;
                    const radii = vectorOriginDescriptor.keyOriginRRectRadii;
                    // Use the top-left radius for all corners as a simplification for now.
                    if (radii && radii.topLeft && radii.topLeft.value > 0) {
                        cornerRadius = radii.topLeft.value;
                    }

                    const rectElement: ExtractedRectElement = {
                        id: currentElementId, type: 'rect', originalName: layerOriginalName, name: defaultElementName, // Use defaultElementName for Rect 'name'
                        x: vectorBounding.left.value, y: vectorBounding.top.value, width: vectorBounding.right.value - vectorBounding.left.value, height: vectorBounding.bottom.value - vectorBounding.top.value,
                        fillColor: finalFillColor,
                        fillAlpha: finalCombinedAlpha,
                        opacity: layerMasterOpacity,
                        cornerRadius: cornerRadius,
                    };
                    extractedElements.push(rectElement);
                    continue;
                }
            }
        }

        let canvasAfterOwnMask = layer.canvas;
        if (layer.canvas && layer.mask) {
            canvasAfterOwnMask = applyLayerMaskToCanvas(layer.canvas, layer.mask, layerLeftPx, layerTopPx);
        }

        if (!canvasAfterOwnMask || canvasAfterOwnMask.width <= 0 || canvasAfterOwnMask.height <= 0) {
            console.warn(`Layer "${layerOriginalName}" (visual candidate) skipped: no canvas or zero dimensions after own mask.`);
            continue;
        }

        const { trimmedCanvas, offsetX: trimOffsetX, offsetY: trimOffsetY } = trimTransparentPixels(canvasAfterOwnMask);

        if (trimmedCanvas.width <= 0 || trimmedCanvas.height <= 0) {
            console.warn(`Layer "${layerOriginalName}" (visual candidate) skipped: zero dimensions after trimming.`);
            continue;
        }

        const contentActualX = layerLeftPx + trimOffsetX;
        const contentActualY = layerTopPx + trimOffsetY;
        const contentActualWidth = trimmedCanvas.width;
        const contentActualHeight = trimmedCanvas.height;

        const finalClippedX = Math.max(contentActualX, 0);
        const finalClippedY = Math.max(contentActualY, 0);
        const finalClippedRight = Math.min(contentActualX + contentActualWidth, psd.width!);
        const finalClippedBottom = Math.min(contentActualY + contentActualHeight, psd.height!);

        const finalVisibleWidth = finalClippedRight - finalClippedX;
        const finalVisibleHeight = finalClippedBottom - finalClippedY;

        if (finalVisibleWidth <= 0 || finalVisibleHeight <= 0) {
            console.warn(`Layer "${layerOriginalName}" (visual candidate) has no visible part within PSD boundaries after trimming. Skipping.`);
            continue;
        }

        const originalLayerNameLower = layerOriginalName.toLowerCase();
        if (originalLayerNameLower.startsWith('btn') &&
            (!layer.children || layer.children.length === 0) &&
            (!layer.text || !layer.text.text || layer.kind !== 'text')) {

            const simpleButtonExmlId = layerOriginalName; // EXML ID remains original name
            let sourceNameForSimpleButton: string | undefined = undefined;

            // Generate image for SimpleButton regardless of kind (shape or pixel)
            // if it's not a text layer or a group button.
            let dataUrl: string;
            const dataUrlCanvas = document.createElement('canvas');
            dataUrlCanvas.width = finalVisibleWidth;
            dataUrlCanvas.height = finalVisibleHeight;
            const duCtx = dataUrlCanvas.getContext('2d');

            if (duCtx) {
                const sxOnTrimmed = Math.max(0, finalClippedX - contentActualX);
                const syOnTrimmed = Math.max(0, finalClippedY - contentActualY);
                duCtx.drawImage(trimmedCanvas, sxOnTrimmed, syOnTrimmed, finalVisibleWidth, finalVisibleHeight, 0, 0, finalVisibleWidth, finalVisibleHeight);

                let finalCanvasForDataUrl = dataUrlCanvas;
                if (layerMasterOpacity < 0.99) {
                    finalCanvasForDataUrl = applyOpacityToCanvas(dataUrlCanvas, layerMasterOpacity);
                }
                dataUrl = finalCanvasForDataUrl.toDataURL('image/png');

                // Standardized resource name for SimpleButton image
                let baseNameForDeduplication = convertToSnakeCaseAndSanitize(layerOriginalName);
                const trimmedPrefix = imageResourcePrefix.trim();
                if (trimmedPrefix !== "") baseNameForDeduplication = `${trimmedPrefix}_${baseNameForDeduplication}`;

                if (uniqueImageDataUrls.has(dataUrl)) {
                    sourceNameForSimpleButton = uniqueImageDataUrls.get(dataUrl)!;
                } else {
                    let attemptName = `${baseNameForDeduplication}_png`;
                    let counter = 0;
                    const existingNames = new Set(Array.from(uniqueImageDataUrls.values()));
                    while (existingNames.has(attemptName)) {
                        counter++;
                        attemptName = `${baseNameForDeduplication}_${counter}_png`;
                    }
                    sourceNameForSimpleButton = attemptName;
                    uniqueImageDataUrls.set(dataUrl, sourceNameForSimpleButton);
                }
            } else {
                console.warn(`Could not get 2D context for dataURL canvas for SimpleButton "${layerOriginalName}". Skipping.`);
                continue;
            }


            const simpleButtonElement: ExtractedSimpleButtonElement = {
                id: currentElementId,
                type: 'simpleButton',
                originalName: layerOriginalName,
                name: simpleButtonExmlId, // EXML ID
                x: finalClippedX,
                y: finalClippedY,
                width: finalVisibleWidth,
                height: finalVisibleHeight,
                opacity: layerMasterOpacity,
                sourceName: sourceNameForSimpleButton, // Standardized resource name
            };
            extractedElements.push(simpleButtonElement);
            continue;
        }

        let outputTypeResult: LayerOutputTypeResult = determineLayerOutputType(layer);

        if (outputTypeResult.type === 'text' && layer.text && layer.text.text) {
            const textData = layer.text;
            const layerActualWidth = (layer.right ?? layerLeftPx) - layerLeftPx;
            const layerActualHeight = (layer.bottom ?? layerTopPx) - layerTopPx;

            let finalX: number, finalY: number;
            let finalWidth: number; 
            let finalHeight: number = layerActualHeight; // EXML height is original layer height
            let calculatedRotationDegrees: number | undefined = undefined;
            let anchorOffsetX: number | undefined = undefined;
            let anchorOffsetY: number | undefined = undefined;


            let basePointFontSizeForPrimary: number | undefined = textData.style?.fontSize;
            if (typeof basePointFontSizeForPrimary !== 'number' && textData.styleRuns?.length > 0) {
                for (const run of textData.styleRuns) {
                    if (run.style && typeof run.style.fontSize === 'number') {
                        basePointFontSizeForPrimary = run.style.fontSize; break;
                    }
                }
                if (typeof basePointFontSizeForPrimary !== 'number') basePointFontSizeForPrimary = 12;
            }
            let primaryFontSize = calculatePixelValue(basePointFontSizeForPrimary, psd.imageResources, textData.transform);
            if (primaryFontSize < 1) primaryFontSize = 1;
            const primaryFontFamily = textData.style?.font?.name || 'Arial';

            if (textData.text.includes('\n')) {

                let measuredWidth = 0;
                if (textData.text) {
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    if (context) {
                        context.font = `${primaryFontSize}px '${primaryFontFamily}', 'Arial'`;
                        const lines = textData.text.split('\n');
                        for (const line of lines) {
                            const lineWidth = Math.ceil(context.measureText(line).width);
                            if (lineWidth > measuredWidth) {
                                measuredWidth = lineWidth;
                            }
                        }
                    } else {
                        console.warn(`Could not get 2D context to measure text width for layer "${layerOriginalName}". Falling back to PSD width.`);
                        measuredWidth = layerActualWidth;
                    }
                }
                finalWidth = measuredWidth;
            } else {
                finalWidth = 0;
            }
            finalHeight = 0;


            if (textData.transform) {
                const [xx, xy, yx, _yy, _tx, _ty] = textData.transform;
                const angleRad = Math.atan2(yx, xx);
                let angleDeg = angleRad * (180 / Math.PI);
                if (Math.abs(angleDeg) > 0.01) {
                    calculatedRotationDegrees = -angleDeg;
                    
                    anchorOffsetX = finalWidth / 2;
                    anchorOffsetY = finalHeight / 2;

                    finalX = layerLeftPx + anchorOffsetX;
                    finalY = layerTopPx + anchorOffsetY; // Y is anchor Y (center of original height)

                } else { // Not rotated
                    finalX = layerLeftPx;
                    finalY = layerTopPx; // Y is original top
                }
            } else { // Not rotated
                finalX = layerLeftPx;
                finalY = layerTopPx; // Y is original top
            }

            finalWidth = Math.max(0, finalWidth);
            finalHeight = Math.max(0, finalHeight); 

            if (finalWidth < 0.1 || finalHeight < 0.1) {
                 if (!textData.text.includes('\n') && finalWidth === 0) {
                    // This is OK for single-line text, width is auto.
                 } else {
                    console.warn(`Text layer "${layerOriginalName}" has zero or near-zero dimensions after adjustments. Skipping. W:${finalWidth}, H:${finalHeight}`);
                    continue;
                 }
            }


            let primaryLineSpacing: number | undefined;
            if (textData.style?.autoLeading === false && typeof textData.style.leading === 'number') {
                const leadingInPixels = calculatePixelValue(textData.style.leading, psd.imageResources, textData.transform);
                if (leadingInPixels > 0) primaryLineSpacing = leadingInPixels - primaryFontSize;
                if (primaryLineSpacing !== undefined && primaryFontSize + primaryLineSpacing < 0) {
                    primaryLineSpacing = -primaryFontSize + 1;
                }
            }

            let primaryTextColor = agPsdColorToHex(textData.style?.fillColor);
            if (layer.effects?.disabled !== true) {
                const solidFillEffect = getEffect(layer.effects?.solidFill);
                if (solidFillEffect?.enabled && solidFillEffect.color &&
                    (!solidFillEffect.blendMode || solidFillEffect.blendMode === 'normal') &&
                    (typeof solidFillEffect.opacity !== 'number' || solidFillEffect.opacity >= 0.99 )) {
                    primaryTextColor = agPsdColorToHex(solidFillEffect.color);
                }
            }

            let primaryStrokeSize: number | undefined, primaryStrokeColor: string | undefined;
            let primaryStrokeSource: ExtractedTextElement['primaryStrokeSource'] = 'none';

            if (layer.effects?.disabled !== true) {
                const layerStrokeEffectData = layer.effects?.stroke;
                if (layerStrokeEffectData) {
                    const activeLayerEffectStroke = (Array.isArray(layerStrokeEffectData) ? layerStrokeEffectData : [layerStrokeEffectData])
                        .find(s => s?.enabled && s.size?.value && s.size.value > 0 && s.color && s.fillType === 'solidColor');
                    if (activeLayerEffectStroke) {
                        primaryStrokeSize = activeLayerEffectStroke.size.value;
                        primaryStrokeColor = agPsdColorToHex(activeLayerEffectStroke.color);
                        primaryStrokeSource = 'layerEffect';
                    }
                }
            }

            if (primaryStrokeSource === 'none' && textData.style) {
                const textEngineStrokeColorData = textData.style.strokeColor;
                const runArray = textData.style.textEngineData?.EngineDict?.StyleRun?.RunArray;
                const textEngineStrokeWidthPt = runArray?.[0]?.StyleSheet?.StyleSheetData?.StrokeWidth;

                if (typeof textEngineStrokeWidthPt === 'number' && textEngineStrokeWidthPt > 0 && textEngineStrokeColorData) {
                    const calculatedPixelStrokeWidth = calculatePixelValue(textEngineStrokeWidthPt, psd.imageResources, textData.transform);
                    if (calculatedPixelStrokeWidth > 0) {
                        primaryStrokeSize = calculatedPixelStrokeWidth;
                        primaryStrokeColor = agPsdColorToHex(textEngineStrokeColorData);
                        primaryStrokeSource = 'textEngine';
                    }
                }
            }

            let primaryTextAlign: CssTextAlign | undefined;
            if (textData.paragraphStyle?.justification !== undefined) {
                 primaryTextAlign = agPsdJustificationToCssTextAlign(textData.paragraphStyle.justification);
            }

            const extractedIsRichText = !!(textData.styleRuns && textData.styleRuns.length > 0);

            const currentTextElement: ExtractedTextElement = {
                id: currentElementId, type: 'text', originalName: layerOriginalName, name: defaultElementName, // Use defaultElementName for text 'name'
                x: finalX, y: finalY, width: finalWidth, height: finalHeight, // height is original layer height
                text: textData.text, fontSize: primaryFontSize, textColor: primaryTextColor,
                strokeSize: primaryStrokeSize, strokeColor: primaryStrokeColor,
                primaryStrokeSource: primaryStrokeSource,
                fontFamily: primaryFontFamily,
                isRichText: extractedIsRichText,
                textAlign: primaryTextAlign, lineSpacing: primaryLineSpacing,
                opacity: layerMasterOpacity, rotation: calculatedRotationDegrees,
                anchorOffsetX: anchorOffsetX, anchorOffsetY: anchorOffsetY,
            };
            extractedElements.push(currentTextElement);

            let shouldNotifyAsRichText = false;
            if (textData.styleRuns && textData.styleRuns.length > 0) {
                const overallStyleFromAgPsd: PsdOverallTextStyle | undefined = textData.style;
                for (const run of textData.styleRuns) {
                    const runStyle: StyleRunStyle = run.style || {};
                    const runPixelFontSize = calculatePixelValue(runStyle.fontSize ?? overallStyleFromAgPsd?.fontSize, psd.imageResources, textData.transform) || primaryFontSize;
                    const runFillColor = agPsdColorToHex(runStyle.fillColor ?? overallStyleFromAgPsd?.fillColor) || primaryTextColor;

                    if (runPixelFontSize !== primaryFontSize ||
                        runFillColor.toUpperCase() !== primaryTextColor.toUpperCase()) {
                        shouldNotifyAsRichText = true; break;
                    }

                    if (primaryStrokeSource !== 'layerEffect') {
                        const runTeStrokeColorData = runStyle.strokeColor ?? overallStyleFromAgPsd?.strokeColor;
                        const runRunArray = runStyle.textEngineData?.EngineDict?.StyleRun?.RunArray;
                        const runTeStrokeWidthPt = runRunArray?.[0]?.StyleSheet?.StyleSheetData?.StrokeWidth;

                        let runHasTeStroke = false;
                        let runTeStrokeSizePx: number | undefined;
                        let runTeStrokeColorHex: string | undefined;

                        if (typeof runTeStrokeWidthPt === 'number' && runTeStrokeWidthPt > 0 && runTeStrokeColorData) {
                            runTeStrokeSizePx = calculatePixelValue(runTeStrokeWidthPt, psd.imageResources, textData.transform);
                            if (runTeStrokeSizePx > 0) {
                                runTeStrokeColorHex = agPsdColorToHex(runTeStrokeColorData);
                                runHasTeStroke = true;
                            }
                        }

                        if (primaryStrokeSource === 'textEngine') {
                            if (runHasTeStroke) {
                                if (runTeStrokeSizePx !== primaryStrokeSize ||
                                    (runTeStrokeColorHex && primaryStrokeColor && runTeStrokeColorHex.toUpperCase() !== primaryStrokeColor.toUpperCase())) {
                                    shouldNotifyAsRichText = true; break;
                                }
                            } else {
                                shouldNotifyAsRichText = true; break;
                            }
                        } else {
                            if (runHasTeStroke) {
                                shouldNotifyAsRichText = true; break;
                            }
                        }
                    }
                }
            }

            if (shouldNotifyAsRichText) {
                richTextNotifications.push({
                    layerName: layerOriginalName, text: textData.text,
                    message: `Layer "${layerOriginalName}" has style variations. "Copy HTML textFlow" for EXML.`,
                });
            }

        } else {
            if (layer.kind !== 'shape') {
                let createAsRect_forPixelLayer = false;
                let pixelRectFillColor: string | undefined;
                let pixelRectFillAlpha: number | undefined;

                if (!checkForSignificantEffects(layer)) {
                    const solidCheck = checkCanvasForSolidColor(trimmedCanvas);
                    if (solidCheck.isSolidRect && typeof solidCheck.fillColor === 'string' && typeof solidCheck.fillAlpha === 'number') {
                        createAsRect_forPixelLayer = true;
                        pixelRectFillColor = solidCheck.fillColor;
                        pixelRectFillAlpha = solidCheck.fillAlpha;
                    }
                }

                if (createAsRect_forPixelLayer && pixelRectFillColor && typeof pixelRectFillAlpha !== 'undefined') {
                    const rectElement: ExtractedRectElement = {
                        id: currentElementId, type: 'rect', originalName: layerOriginalName, name: defaultElementName, // Use defaultElementName for Rect 'name'
                        x: finalClippedX, y: finalClippedY, width: finalVisibleWidth, height: finalVisibleHeight,
                        fillColor: pixelRectFillColor,
                        fillAlpha: pixelRectFillAlpha,
                        opacity: layerMasterOpacity,
                    };
                    extractedElements.push(rectElement);
                    continue;
                }
            }

            let dataUrl: string;
            const dataUrlCanvas = document.createElement('canvas');
            dataUrlCanvas.width = finalVisibleWidth;
            dataUrlCanvas.height = finalVisibleHeight;
            const duCtx = dataUrlCanvas.getContext('2d');

            if (duCtx) {
                const sxOnTrimmed = Math.max(0, finalClippedX - contentActualX);
                const syOnTrimmed = Math.max(0, finalClippedY - contentActualY);
                duCtx.drawImage(trimmedCanvas, sxOnTrimmed, syOnTrimmed, finalVisibleWidth, finalVisibleHeight, 0, 0, finalVisibleWidth, finalVisibleHeight);
                let finalCanvasForDataUrl = dataUrlCanvas;
                if (layerMasterOpacity < 0.99) {
                    finalCanvasForDataUrl = applyOpacityToCanvas(dataUrlCanvas, layerMasterOpacity);
                }
                dataUrl = finalCanvasForDataUrl.toDataURL('image/png');

                let imageResourceName: string;
                // Standardized resource name for general rasterized images
                let baseNameForDeduplication = convertToSnakeCaseAndSanitize(layerOriginalName);
                const trimmedPrefix = imageResourcePrefix.trim();
                if (trimmedPrefix !== "") baseNameForDeduplication = `${trimmedPrefix}_${baseNameForDeduplication}`;

                if (uniqueImageDataUrls.has(dataUrl)) {
                    imageResourceName = uniqueImageDataUrls.get(dataUrl)!;
                } else {
                    let attemptName = `${baseNameForDeduplication}_png`;
                    let counter = 0;
                    const existingNames = new Set(Array.from(uniqueImageDataUrls.values()));
                    while (existingNames.has(attemptName)) {
                        counter++;
                        attemptName = `${baseNameForDeduplication}_${counter}_png`;
                    }
                    imageResourceName = attemptName;
                    uniqueImageDataUrls.set(dataUrl, imageResourceName);
                }

                const hadEffects = checkForSignificantEffects(layer);
                const imageElement: ExtractedImageElement = {
                    id: currentElementId, type: 'image', originalName: layerOriginalName, name: imageResourceName, dataUrl,
                    x: finalClippedX, y: finalClippedY, width: finalVisibleWidth, height: finalVisibleHeight,
                    opacity: layerMasterOpacity,
                    hadEffectsOriginally: hadEffects,
                };
                if (layer.text && outputTypeResult.type === 'image' && outputTypeResult.reason) {
                    imageElement.rasterizationReason = outputTypeResult.reason;
                }
                extractedElements.push(imageElement);

            } else {
                console.warn(`Could not get 2D context for dataURL canvas for "${layerOriginalName}". Skipping.`);
            }
        }
    }
    return extractedElements;
}


export const generateElementsFromStructure = async (
  structuralData: PsdStructuralData,
  imageResourcePrefix: string = ''
): Promise<ParsedPsdData> => {
  const { psd, allLayers } = structuralData;
  if (!psd.width || !psd.height) {
    throw new Error("Invalid structural PSD data: Missing width or height information.");
  }

  globalElementIdCounter = 0;
  const uniqueImageDataUrls = new Map<string, string>();
  const richTextNotifications: RichTextNotification[] = [];

  const extractedElements = processLayerListToExtractedElements(
      allLayers,
      psd,
      imageResourcePrefix,
      uniqueImageDataUrls,
      richTextNotifications
  );

  const imageAssets = new Map<string, string>();
  uniqueImageDataUrls.forEach((resourceName, dataUrl) => {
    imageAssets.set(resourceName, dataUrl);
  });

  return {
    width: psd.width,
    height: psd.height,
    elements: extractedElements,
    richTextNotifications,
    generatingPrefix: imageResourcePrefix,
    imageAssets: imageAssets,
  };
};