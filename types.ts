// import { Psd } from 'ag-psd'; // ag-psd types are complex, direct use where needed
// Changed import: Removed RGBColor, added BlendMode
import {
  Color as AgPsdColorOriginal,
  BlendMode as AgPsdBlendModeOriginal,
  Psd as AgPsdObjectOriginal,
  LayerMaskData as AgPsdLayerMaskDataOriginal, // Changed alias, was AgPsdLayerMaskData
  VectorContent,
  KeyDescriptorItem
  // Justification as AgPsdJustification - Removed from here
} from 'ag-psd';

import { Justification as AgPsdJustification } from 'ag-psd'; // Renamed to avoid conflict if CssTextAlign was named Justification


// Re-exporting ag-psd's Color type for clarity in our system
export type AgPsdColor = AgPsdColorOriginal;
// Removed AgPsdRGBColor alias as it caused import issues and AgPsdColor is sufficient.
// export type AgPsdRGBColor = AgPsdRGBColorOriginal; // Removed

// Added AgPsdBlendMode type alias
export type AgPsdBlendMode = AgPsdBlendModeOriginal;

// Exporting AgPsdObject type alias
export type AgPsdObject = AgPsdObjectOriginal;

// Exporting AgPsdLayerMaskData type alias
export type AgPsdLayerMaskData = AgPsdLayerMaskDataOriginal;

// Define a CSS-compatible TextAlign type
export type CssTextAlign = 'left' | 'right' | 'center' | 'justify' | 'start' | 'end';


export type LayerType = 'image' | 'text' | 'rect' | 'xGroupButton' | 'group' | 'rewardBar' | 'simpleButton' | 'baseItemBox';

export interface ExtractedElementBase {
  id: string;
  type: LayerType;
  originalName: string; // Original layer name from PSD
  name: string; // Sanitized name, for resource ID or e:Label name, or XSimpleButton id
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number; // Master opacity of the layer (0-1 scale)
}

export interface ExtractedImageElement extends ExtractedElementBase {
  type: 'image';
  dataUrl: string;
  rasterizationReason?: string; // Reason if a text layer was converted to an image
  hadEffectsOriginally?: boolean; // True if the original PSD layer had significant visual effects
}

export interface ExtractedTextElement extends ExtractedElementBase {
  type: 'text';
  text: string;
  fontSize: number; // Final calculated pixel size
  textColor: string; // Hex format (e.g., "#FF0000")
  strokeSize?: number;
  strokeColor?: string; // Hex format (e.g., "#FF0000")
  primaryStrokeSource: 'layerEffect' | 'textEngine' | 'none'; // NEW: Source of the primary stroke
  fontFamily?: string; // Best effort, but typically not used in final EXML for Label
  isRichText: boolean; // Flag if rich text features were detected
  textAlign?: CssTextAlign; // Changed from ag-psd's Justification to CssTextAlign
  lineSpacing?: number; // For Egret e:Label lineSpacing
  rotation?: number; // Added for e:Label rotation in degrees
  anchorOffsetX?: number; // NEW: For centered rotation
  anchorOffsetY?: number; // NEW: For centered rotation
}

export interface ExtractedRectElement extends ExtractedElementBase {
  type: 'rect';
  fillColor: string; // Hex format (e.g., "#FF0000")
  fillAlpha: number; // 0 (transparent) to 1 (opaque), includes layer master opacity
  cornerRadius?: number; // For rounded corners
}

export interface ExtractedXGroupButtonElement extends ExtractedElementBase {
  type: 'xGroupButton';
  children: ExtractedLayer[];
}

export interface ExtractedGroupElement extends ExtractedElementBase {
  type: 'group';
  children: ExtractedLayer[];
}

export interface ExtractedRewardBarElement extends ExtractedElementBase {
  type: 'rewardBar';
  // Width and height are inherited and represent actual PSD dimensions
  // Name will be used as the 'id' attribute in EXML
}

export interface ExtractedBaseItemBoxElement extends ExtractedElementBase {
  type: 'baseItemBox';
  dataUrl?: string; // Added for previewing the item's actual image
  imageResourceName?: string; // NEW: The resource name for its dataUrl if added to imageAssets
  // Width and height are inherited and represent actual PSD dimensions
  // Name will be used as the 'id' attribute in EXML
}

export interface ExtractedSimpleButtonElement extends ExtractedElementBase {
  type: 'simpleButton';
  sourceName?: string; // Name of the image resource if based on an image (e.g. "prefix_btnSubmit_png")
  // anchorOffsetX and anchorOffsetY will be calculated in exmlGenerator
  // The 'name' property (from ExtractedElementBase) will be the 'id' for the XSimpleButton (e.g. "submitIcon")
}


export type ExtractedLayer =
  ExtractedImageElement |
  ExtractedTextElement |
  ExtractedRectElement |
  ExtractedXGroupButtonElement |
  ExtractedGroupElement |
  ExtractedRewardBarElement |
  ExtractedSimpleButtonElement |
  ExtractedBaseItemBoxElement;

export interface RichTextNotification {
  layerName: string;
  text: string;
  message: string;
}

export interface ParsedPsdData {
  width: number;
  height: number;
  elements: ExtractedLayer[];
  richTextNotifications: RichTextNotification[];
  generatingPrefix: string; // The prefix used when this data was generated
  imageAssets: Map<string, string>; // resourceName (e.g. "prefix_btnSubmit_png") -> dataUrl
}

// Interface for PSD parsing errors/warnings
export interface PsdParsingError {
  layerName?: string; // Path to the layer if identifiable
  message: string;
  errorObject?: any; // The original error object for details
}

// Interface for caching the core structural data from a PSD
export interface PsdStructuralData {
  psd: AgPsdObject; // The raw Psd object from ag-psd
  allLayers: PsdLayer[]; // Processed layer list, may include "gbtn" groups with children
  parsingErrors: PsdParsingError[]; // Added to store errors encountered by ag-psd
}


// Represents ag-psd's UnitsValue structure, e.g., for stroke size
export interface AgPsdUnitsValue {
  value: number;
  units: string; // e.g., '#px', '#mm', etc.
}

// Detailed style for a run within styleRuns
export interface StyleRunStyle {
  font?: { name?: string; script?: number; type?: number; synthetic?: number; };
  fontSize?: number; // Point size
  fillColor?: AgPsdColor;
  strokeColor?: AgPsdColor; // Text engine stroke color, distinct from layer effect stroke
  // Other potential per-run style properties
  fauxBold?: boolean;
  fauxItalic?: boolean;
  leading?: number; // Line height (baseline to baseline) in points
  tracking?: number;
  textEngineData?: any; // Added for potential deeper text engine style access like stroke width
  // ... any other style properties that ag-psd might provide per run
}

// Overall text style from layer.text.style
export interface PsdOverallTextStyle {
    font?: { name?: string; script?: number; type?: number; synthetic?: number; };
    fontSize?: number; // Point size
    fillColor?: AgPsdColor;
    strokeColor?: AgPsdColor; // Text engine stroke color
    fauxBold?: boolean;
    fauxItalic?: boolean;
    autoLeading?: boolean;
    leading?: number; // Line height (baseline to baseline) in points
    horizontalScale?: number;
    verticalScale?: number;
    tracking?: number;
    autoKerning?: boolean;
    kerning?: number;
    baselineShift?: number;
    fontCaps?: number;
    fontBaseline?: number;
    underline?: boolean;
    strikethrough?: boolean;
    ligatures?: boolean;
    dLigatures?: boolean;
    baselineDirection?: number;
    tsume?: number;
    styleRunAlignment?: number; // 0: left, 1: right, 2: center, 3: justify, 4: justify all
    language?: number;
    noBreak?: boolean;
    yUnderline?: number;
    hindiNumbers?: boolean;
    kashida?: number;
    textEngineData?: any; // Added to fix TypeScript error
    // ... any other properties from ag-psd's TextStyle
}

export interface AgPsdVectorStrokeLineStyle { // Corresponds to ag-psd's VectorStrokeLineStyle
    width?: { value: number, units: string }; // e.g., { value: 2, units: '#px'}
    // other line style properties like cap, join, dash if needed
}
export interface AgPsdVectorStroke {
  type?: 'solidColor' | 'gradient' | 'pattern';
  enabled?: boolean;       // Overall enabled state for the stroke section in PSD
  strokeEnabled?: boolean; // Specific toggle for the stroke visibility itself
  color?: AgPsdColor;    // For type 'solidColor'
  opacity?: number;        // Opacity of the vector stroke itself (0-1 range)
  line?: AgPsdVectorStrokeLineStyle; // Contains width, dash, etc.
  // Other properties for gradient/pattern could be added if needed
}
// --- End Vector Graphics Data Structures ---


// Simplified PsdLayer structure from ag-psd for type hinting.
export interface PsdLayer {
  name?: string;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  opacity?: number; // Master opacity from PSD (0-255) -> will be converted to 0-1
  hidden?: boolean;
  clipping?: boolean; // True if this layer is the BASE of a clipping group
  clipped?: boolean;  // True if this layer IS CLIPPED by the layer below it
  kind?: string; // Layer kind from ag-psd (e.g., 'shape', 'pixel', 'text')
  nameSource?: string;
  canvas?: HTMLCanvasElement;
  children?: PsdLayer[]; // Used for "gbtn" group hierarchy
  text?: {
    text: string;
    transform?: number[]; // ag-psd: [xx, xy, yx, yy, tx, ty]
    style?: PsdOverallTextStyle;
    paragraphStyle?: {
      justification: AgPsdJustification; // Use defined AgPsdJustificationEnum directly
    };
    styleRuns?: StyleRun[];
    textActualBox?: number[]; // [left, top, right, bottom] in text space coordinates
  };
  effects?: {
    disabled?: boolean; // Master switch: true if all effects are disabled
    stroke?: any; // Layer effect stroke
    solidFill?: any; // Layer effect "Color Overlay"
    dropShadow?: any;
    innerShadow?: any;
    outerGlow?: any;
    innerGlow?: any;
    bevelAndEmboss?: any;
    satin?: any;
    gradientOverlay?: any;
    patternOverlay?: any;
  };
  mask?: AgPsdLayerMaskData;
  vectorFill?: VectorContent;     // Added for shape layers
  vectorOrigination?: {
      keyDescriptorList: KeyDescriptorItem[];
  };
  vectorStroke?: AgPsdVectorStroke; // Added for shape layers
  // Meta information added during processing
  meta?: {
    isXGroupButton?: boolean;
    isSimpleGroup?: boolean;
    isRewardBar?: boolean;
    isBaseItemBox?: boolean;
  };
}

// Define StyleRun based on observed structure, may need refinement
export interface StyleRun {
  length: number;
  style?: StyleRunStyle;
}
