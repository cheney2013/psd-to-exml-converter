
import * as React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { ParsedPsdData, ExtractedLayer, ExtractedImageElement, RichTextNotification, ExtractedTextElement, PsdStructuralData, PsdLayer, PsdParsingError, ExtractedXGroupButtonElement, ExtractedGroupElement, ExtractedSimpleButtonElement, ExtractedBaseItemBoxElement, PsdOverallTextStyle, StyleRunStyle, AgPsdObject } from './types';
import { agPsdColorToHex, extractPsdStructure, generateElementsFromStructure } from './services/psdProcessor';
import { generateExml, generateExmlForElement } from './services/exmlGenerator';
import { generateTypeScript, ParentClassType } from './services/typeScriptGenerator';
import { AppHeader } from './components/AppHeader';
import { TabNavigation } from './components/TabNavigation';
import { ImageGalleryTab } from './components/ImageGalleryTab';
import { CodeViewTab } from './components/CodeViewTab';
import { PreviewTab } from './components/PreviewTab';
import { RichTextInfoTab } from './components/RichTextInfoTab';
import { DiagnosticsTab } from './components/DiagnosticsTab';
import { LoadingSpinner } from './components/icons';
import { ocrContainsText } from './services/textDetector';


// This type is used by ImageGalleryTab and TabNavigation
export type ImageTabDisplayItem = ExtractedImageElement & {
  originalIdForLink?: string;
  isFromSimpleButton?: boolean;
  isFromBaseItemBox?: boolean;
};

// Helper function to check if an element has children (groups, xGroupButtons)
const hasChildren = (el: ExtractedLayer): el is (ExtractedXGroupButtonElement | ExtractedGroupElement) => {
  return (el.type === 'xGroupButton' || el.type === 'group') && Array.isArray((el as ExtractedXGroupButtonElement | ExtractedGroupElement).children);
};

interface SelectedElementDetails {
  targetElement: ExtractedLayer;
  topLevelAncestor: ExtractedLayer;
  effectiveIndentLevel: number;
}


export const App: React.FC = () => {
  const [psdFile, setPsdFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedPsdData | null>(null);
  const [generatedExml, setGeneratedExml] = useState<string>('');
  const [generatedTypeScript, setGeneratedTypeScript] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const [parsingIssues, setParsingIssues] = useState<PsdParsingError[]>([]);
  const [activeTab, setActiveTab] = useState<'images' | 'code' | 'preview' | 'richTextInfo' | 'diagnostics'>('images');

  const [imagePrefix, setImagePrefix] = useState<string>('');
  const [skinClassNameInput, setSkinClassNameInput] = useState<string>('');
  const [debouncedImagePrefix, setDebouncedImagePrefix] = useState<string>('');
  const [debouncedSkinClassNameInput, setDebouncedSkinClassNameInput] = useState<string>('');
  const [selectedParentClass, setSelectedParentClass] = useState<ParentClassType>('BasePage');

  const [psdStructureCache, setPsdStructureCache] = useState<PsdStructuralData | null>(null);

  const [exmlCopied, setExmlCopied] = useState(false);
  const [exmlGroupCopied, setExmlGroupCopied] = useState(false);
  const [tsCopied, setTsCopied] = useState(false);
  const [copiedTextFlowId, setCopiedTextFlowId] = useState<string | null>(null);

  const scrollableExmlPanelRef = useRef<HTMLDivElement>(null);
  const exmlLineRefs = useRef<Record<string, HTMLPreElement | null>>({});

  const [selectedElementIdForExmlHighlight, setSelectedElementIdForExmlHighlight] = useState<string | null>(null);
  const [selectedElementIdForPreviewHighlight, setSelectedElementIdForPreviewHighlight] = useState<string | null>(null);

  // OCR background job tracking (keyed by dataUrl to remain stable across renames)
  const [ocrStatusByDataUrl, setOcrStatusByDataUrl] = useState<Record<string, 'pending'|'done'|'error'>>({});
  const ocrStartedRef = useRef<Set<string>>(new Set());

  const getEffectiveSkinClassName = useCallback((inputName: string): string => {
    let name = inputName.trim();
    if (name && !name.toLowerCase().endsWith('skin')) {
        name += 'Skin';
    }
    name = name.replace(/[^a-zA-Z0-9_]/g, '');
    if (name && !/^[a-zA-Z_]/.test(name)) {
        name = '_' + name;
    }
    return name || 'MyPsdSkin';
  }, []);

  const processAndSetData = useCallback(async (
    structure: PsdStructuralData,
    currentImagePrefix: string
  ) => {
    setIsLoading(true);
    try {
      const data = await generateElementsFromStructure(structure, currentImagePrefix);
      setParsedData(data);
      setParsingIssues(structure.parsingErrors || []);
      setSelectedElementIdForExmlHighlight(null);
      setSelectedElementIdForPreviewHighlight(null);
    } catch (err) {
      console.error("Error generating elements from structure:", err);
      setCriticalError(err instanceof Error ? err.message : "An unknown error occurred during element generation.");
      setParsedData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleFileAccepted = useCallback(async (file: File) => {
      setIsLoading(true);
      setCriticalError(null);
      setParsingIssues([]);
      setPsdFile(file);
      setParsedData(null);
      setGeneratedExml('');
      setGeneratedTypeScript('');
      setCopiedTextFlowId(null);
      setPsdStructureCache(null);
      setSelectedElementIdForExmlHighlight(null);
      setSelectedElementIdForPreviewHighlight(null);
  // Reset OCR state for a new PSD
  setOcrStatusByDataUrl({});
  ocrStartedRef.current = new Set();
      exmlLineRefs.current = {};

      try {
        const structure = await extractPsdStructure(file);
        setPsdStructureCache(structure);
        setParsingIssues(structure.parsingErrors || []);

        const initialData = await generateElementsFromStructure(structure, imagePrefix);
        setParsedData(initialData);

        if (structure.parsingErrors && structure.parsingErrors.length > 0) {
            setActiveTab('diagnostics');
        } else {
            let hasImagesOrImageButtons = false;
            if (initialData.imageAssets.size > 0) {
                hasImagesOrImageButtons = true;
            } else {
                 const checkNestedImages = (elements: ExtractedLayer[]): boolean => {
                    for (const el of elements) {
                        if (el.type === 'image') return true;
                        if (el.type === 'baseItemBox' && (el as ExtractedBaseItemBoxElement).imageResourceName) return true;
                        if (el.type === 'simpleButton' && (el as ExtractedSimpleButtonElement).sourceName) return true;
                        if (hasChildren(el)) {
                            if (checkNestedImages(el.children)) return true;
                        }
                    }
                    return false;
                };
                hasImagesOrImageButtons = checkNestedImages(initialData.elements);
            }

            if (hasImagesOrImageButtons) {
                setActiveTab('images');
            } else if (initialData.richTextNotifications.length > 0) {
                setActiveTab('richTextInfo');
            } else if (initialData.elements.length > 0) {
                setActiveTab('preview');
            } else {
                setActiveTab('code');
            }
        }
      } catch (err) {
        console.error("Critical error processing PSD:", err);
        setCriticalError(err instanceof Error ? err.message : "An unknown critical error occurred during PSD processing.");
        setParsedData(null);
        setPsdStructureCache(null);
        setParsingIssues([]);
      } finally {
        setIsLoading(false);
      }
  }, [imagePrefix]);

  useEffect(() => {
    const prefixHandler = setTimeout(() => setDebouncedImagePrefix(imagePrefix), 500);
    const skinNameHandler = setTimeout(() => setDebouncedSkinClassNameInput(skinClassNameInput), 500);
    return () => { clearTimeout(prefixHandler); clearTimeout(skinNameHandler); };
  }, [imagePrefix, skinClassNameInput]);

  useEffect(() => {
    if (psdStructureCache && parsedData && debouncedImagePrefix !== parsedData.generatingPrefix) {
      processAndSetData(psdStructureCache, debouncedImagePrefix);
      // Reset OCR state when regenerating with a new prefix
      setOcrStatusByDataUrl({});
      ocrStartedRef.current = new Set();
    }
  }, [debouncedImagePrefix, psdStructureCache, parsedData, processAndSetData]);

  useEffect(() => {
    if (parsedData) {
      const effectiveSkinName = getEffectiveSkinClassName(debouncedSkinClassNameInput);
      const exmlString = generateExml(parsedData, effectiveSkinName);
      setGeneratedExml(exmlString);
      const tsString = generateTypeScript(parsedData, effectiveSkinName, selectedParentClass);
      setGeneratedTypeScript(tsString);
    } else {
      setGeneratedExml('');
      setGeneratedTypeScript('');
    }
  }, [parsedData, debouncedSkinClassNameInput, getEffectiveSkinClassName, selectedParentClass]);

  // Auto-detect parent class based on skinClassNameInput
  useEffect(() => {
    if (!debouncedSkinClassNameInput) {
      setSelectedParentClass('BasePage'); // Default if empty
      return;
    }
    let name = debouncedSkinClassNameInput.trim();
    if (name.toLowerCase().endsWith('skin')) {
      name = name.substring(0, name.length - 4);
    }

    if (name.toLowerCase().endsWith('fullscreen')) {
      setSelectedParentClass('XFullScreenPanel');
    } else if (name.toLowerCase().endsWith('panel')) {
      setSelectedParentClass('XNormalPanel');
    } else if (name.toLowerCase().endsWith('page')) {
      setSelectedParentClass('BasePage');
    } else {
      setSelectedParentClass('BasePage'); // Default
    }
  }, [debouncedSkinClassNameInput]);


  const findParentOfElementRecursive = useCallback((
    elementsToSearch: ExtractedLayer[],
    childId: string
  ): ExtractedLayer | undefined => {
    for (const potentialParent of elementsToSearch) {
      if (hasChildren(potentialParent)) {
        if (potentialParent.children.some(c => c.id === childId)) return potentialParent;
        const foundInNested = findParentOfElementRecursive(potentialParent.children, childId);
        if (foundInNested) return foundInNested;
      }
    }
    return undefined;
  }, []);

  const findSelectedElementDetails = useCallback((
    targetId: string | null, 
    allElements: ExtractedLayer[]
  ): SelectedElementDetails | null => {
    if (!targetId) return null; 
    let targetElement: ExtractedLayer | undefined;
    let topLevelAncestor: ExtractedLayer | undefined;
    let effectiveIndentLevel = 0;

    const findRecursively = (elements: ExtractedLayer[], currentTopLevel: ExtractedLayer | undefined, currentIndent: number): boolean => {
        for (const el of elements) {
            if (el.id === targetId) {
                targetElement = el;
                topLevelAncestor = currentTopLevel || el;
                effectiveIndentLevel = currentIndent;
                return true;
            }
            if (hasChildren(el)) {
                if (findRecursively(el.children, currentTopLevel || el, currentIndent + 1)) return true;
            }
        }
        return false;
    };
    for (const topEl of allElements) { if (findRecursively([topEl], topEl, 1)) break; }
    if (targetElement && topLevelAncestor) return { targetElement, topLevelAncestor, effectiveIndentLevel };
    return null;
  }, []);

  useEffect(() => {
    const currentSelection = window.getSelection();
    if (activeTab === 'preview' && parsedData && selectedElementIdForExmlHighlight && scrollableExmlPanelRef.current && currentSelection) {
        const details = findSelectedElementDetails(selectedElementIdForExmlHighlight, parsedData.elements);
        if (details) {
            const { targetElement, topLevelAncestor, effectiveIndentLevel } = details;
            const ancestorPreElement = exmlLineRefs.current[topLevelAncestor.id];
            if (ancestorPreElement?.firstChild?.nodeType === Node.ELEMENT_NODE && (ancestorPreElement.firstChild as HTMLElement).tagName === 'CODE' && ancestorPreElement.firstChild.firstChild?.nodeType === Node.TEXT_NODE) {
                const textNode = ancestorPreElement.firstChild.firstChild as Text;
                const targetExmlString = generateExmlForElement(targetElement, effectiveIndentLevel);
                const fullAncestorExmlInNode = textNode.textContent || "";
                const startIndex = fullAncestorExmlInNode.indexOf(targetExmlString);
                if (startIndex !== -1) {
                    currentSelection.removeAllRanges();
                    const range = document.createRange();
                    range.setStart(textNode, startIndex);
                    range.setEnd(textNode, startIndex + targetExmlString.length);
                    currentSelection.addRange(range);
                    // Scroll logic for selected EXML element (simplified)
                    ancestorPreElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else { currentSelection.removeAllRanges(); }
            } else { currentSelection.removeAllRanges(); }
        } else { currentSelection.removeAllRanges(); }
    } else if (currentSelection && activeTab === 'preview' && !selectedElementIdForExmlHighlight) {
        currentSelection.removeAllRanges();
    }
  }, [selectedElementIdForExmlHighlight, activeTab, parsedData, findSelectedElementDetails]);

  const handleElementClickInPreview = useCallback((clickedElementId: string) => {
    if (!parsedData) return;
    if (clickedElementId === '') {
      setSelectedElementIdForPreviewHighlight(null);
      setSelectedElementIdForExmlHighlight(null);
      return;
    }
    let elementToHighlightInPreview = clickedElementId;
    if (clickedElementId === selectedElementIdForPreviewHighlight) {
      const parentOfCurrent = findParentOfElementRecursive(parsedData.elements, clickedElementId);
      if (parentOfCurrent) elementToHighlightInPreview = parentOfCurrent.id;
    }
    setSelectedElementIdForPreviewHighlight(elementToHighlightInPreview);
    setSelectedElementIdForExmlHighlight(elementToHighlightInPreview);
  }, [parsedData, selectedElementIdForPreviewHighlight, findParentOfElementRecursive]);

  const handleCopyExml = useCallback(() => {
    if (generatedExml) {
      navigator.clipboard.writeText(generatedExml)
        .then(() => {
          setExmlCopied(true);
          setTimeout(() => setExmlCopied(false), 2000);
        })
        .catch(err => console.error('Failed to copy EXML: ', err));
    }
  }, [generatedExml]);

  const handleCopyExmlAsGroup = useCallback(() => {
    if (parsedData && parsedData.elements.length > 0) {
      const groupContent = parsedData.elements.map(el => generateExmlForElement(el, 1)).filter(Boolean).join('\n');
      const groupExml = `<e:Group xmlns:e="http://ns.egret.com/eui" xmlns:w="http://ns.egret.com/wing" xmlns:ns1="*">\n${groupContent}\n</e:Group>`;
      navigator.clipboard.writeText(groupExml)
        .then(() => {
          setExmlGroupCopied(true);
          setTimeout(() => setExmlGroupCopied(false), 2000);
        })
        .catch(err => console.error('Failed to copy EXML as group: ', err));
    }
  }, [parsedData]);

  const handleCopyTypeScript = useCallback(() => {
    if (generatedTypeScript) {
      navigator.clipboard.writeText(generatedTypeScript)
        .then(() => {
          setTsCopied(true);
          setTimeout(() => setTsCopied(false), 2000);
        })
        .catch(err => console.error('Failed to copy TypeScript: ', err));
    }
  }, [generatedTypeScript]);

  const handleDownloadImage = useCallback((imageName: string, dataUrl: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    // Remove _png suffix from base name, then add .png extension
    const baseName = imageName.replace(/_png$/, '');
    // If this resource corresponds to an image that was created by rasterizing a text layer,
    // prepend the "text_img_" prefix to the downloaded filename.
    let downloadName = `${baseName}.png`;
    if (parsedData) {
      const isTextRasterized = parsedData.elements.some(el => el.type === 'image' && (el as ExtractedImageElement).name === imageName && !!(el as ExtractedImageElement).rasterizationReason);
      if (isTextRasterized) {
        downloadName = `text_img_${baseName}.png`;
      }
    }
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [parsedData]);
  
  const calculatePixelFontSize = (
    baseFontSizeInput: number | undefined,
    psdImageResources: AgPsdObject['imageResources'],
    textTransform: number[] | undefined
  ): number => {
    const baseFontSize = typeof baseFontSizeInput === 'number' ? baseFontSizeInput : 12;

    let dpi = 72;
    if (psdImageResources?.resolutionInfo?.verticalResolution) {
        dpi = psdImageResources.resolutionInfo.verticalResolution;
        if (String(psdImageResources.resolutionInfo.verticalResolutionUnit) === '2') {
            dpi = dpi * 2.54;
        }
    }
    if (dpi <= 0) dpi = 72;

    const fontSizeInPixels = baseFontSize * dpi / 72;

    if (textTransform && textTransform.length >= 4) {
        const [xx, xy, yx, yy] = textTransform;
        const Sx = Math.hypot(xx, xy);
        const Sy = Math.hypot(yx, yy);
        const avgScale = (Sx + Sy) / 2;
        const effectiveScale = (avgScale > 1e-6) ? avgScale : 1;
        return Math.max(1, Math.round(fontSizeInPixels * effectiveScale));
    }
    return Math.max(1, Math.round(fontSizeInPixels));
  };

  const handleCopyHtmlTextFlow = (note: RichTextNotification, index: number) => {
    if (!psdStructureCache || !psdStructureCache.psd || !psdStructureCache.allLayers) {
      setCriticalError("PSD structure not available for rich text processing.");
      return;
    }

    const findLayerInTree = (layers: PsdLayer[], name: string): PsdLayer | undefined => {
        for (const layer of layers) {
            if (layer.name === name) return layer;
            if (layer.children) {
                const found = findLayerInTree(layer.children, name);
                if (found) return found;
            }
        }
        return undefined;
    };
    const originalLayer = findLayerInTree(psdStructureCache.allLayers, note.layerName);


    if (!originalLayer || !originalLayer.text) {
      setCriticalError(`Original layer data for "${note.layerName}" not found.`);
      return;
    }

    const overallTextStyle: PsdOverallTextStyle | undefined = originalLayer.text.style;

    const findExtractedTextElement = (elements: ExtractedLayer[], originalName: string): ExtractedTextElement | undefined => {
        for (const el of elements) {
            if (el.type === 'text' && el.originalName === originalName) {
                return el as ExtractedTextElement;
            }
            if (hasChildren(el)) {
                const foundInChild = findExtractedTextElement(el.children, originalName);
                if (foundInChild) return foundInChild;
            }
        }
        return undefined;
    };
    const textElement = parsedData ? findExtractedTextElement(parsedData.elements, note.layerName) : undefined;

    // textElement.textColor and textElement.strokeColor are now #RRGGBB
    // Egret textFlow expects 0xRRGGBB for color attributes
    const primaryEffectStrokeSize = textElement?.strokeSize;

    let htmlSegments: string[] = [];
    let currentTextOffset = 0;

    const styleRuns = originalLayer.text.styleRuns;

    if (styleRuns && styleRuns.length > 0) {
      for (const run of styleRuns) {
        const textSegment = note.text.substring(currentTextOffset, currentTextOffset + run.length);
        currentTextOffset += run.length;

        if (!textSegment) continue;

        const runSpecificStyle: StyleRunStyle = run.style || {};

        let finalFontSize: number;
        if (typeof runSpecificStyle.fontSize === 'number') {
            finalFontSize = calculatePixelFontSize(runSpecificStyle.fontSize, psdStructureCache.psd.imageResources, originalLayer.text.transform);
        } else if (typeof overallTextStyle?.fontSize === 'number') {
            finalFontSize = calculatePixelFontSize(overallTextStyle.fontSize, psdStructureCache.psd.imageResources, originalLayer.text.transform);
        } else {
            finalFontSize = textElement?.fontSize || 12;
        }

        let finalFillColorHex: string; // This will be #RRGGBB
        if (runSpecificStyle.fillColor) {
            finalFillColorHex = agPsdColorToHex(runSpecificStyle.fillColor);
        } else if (overallTextStyle?.fillColor) {
            finalFillColorHex = agPsdColorToHex(overallTextStyle.fillColor);
        } else {
            finalFillColorHex = textElement?.textColor || '#000000';
        }
        const finalFillColorEgret = finalFillColorHex.replace('#', '0x');

        let attributesArray: string[] = [];

        if (!textElement || finalFontSize !== textElement.fontSize) {
            attributesArray.push(`size='${finalFontSize}'`);
        }

        if (!textElement || finalFillColorEgret.toUpperCase() !== (textElement.textColor?.replace('#','0x').toUpperCase())) {
            attributesArray.push(`color='${finalFillColorEgret}'`);
        }

        if (typeof primaryEffectStrokeSize === 'number' && primaryEffectStrokeSize > 0) {
            attributesArray.push(`stroke='${primaryEffectStrokeSize}'`);
            let finalStrokeColorHex: string; // This will be #RRGGBB
            if (runSpecificStyle.strokeColor) {
                finalStrokeColorHex = agPsdColorToHex(runSpecificStyle.strokeColor);
            } else if (overallTextStyle?.strokeColor) {
                finalStrokeColorHex = agPsdColorToHex(overallTextStyle.strokeColor);
            } else {
                finalStrokeColorHex = textElement?.strokeColor || '#000000';
            }
            const finalStrokeColorEgret = finalStrokeColorHex.replace('#','0x');
            attributesArray.push(`strokeColor='${finalStrokeColorEgret}'`);
        }

        const attributes = attributesArray.join(' ');
        const htmlTextContent = textSegment.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\n/g, "<br/>");
        htmlSegments.push(`<font ${attributes}>${htmlTextContent}</font>`);
      }
    } else {
      if (!textElement) {
        setCriticalError(`Could not find primary style information for layer "${note.layerName}" to generate HTML textFlow.`);
        return;
      }
      const finalFontSize = calculatePixelFontSize(overallTextStyle?.fontSize, psdStructureCache.psd.imageResources, originalLayer.text.transform) || textElement.fontSize;
      const finalFillColorHex = overallTextStyle?.fillColor ? agPsdColorToHex(overallTextStyle.fillColor) : textElement.textColor; // #RRGGBB
      const finalFillColorEgret = finalFillColorHex.replace('#', '0x');

      let attributesArray: string[] = [];

      if (finalFontSize !== textElement.fontSize) {
        attributesArray.push(`size='${finalFontSize}'`);
      }
      if (finalFillColorEgret.toUpperCase() !== (textElement.textColor?.replace('#','0x').toUpperCase())) {
        attributesArray.push(`color='${finalFillColorEgret}'`); // Use color for textFlow, not textColor
      }

      if (typeof primaryEffectStrokeSize === 'number' && primaryEffectStrokeSize > 0) {
        attributesArray.push(`stroke='${primaryEffectStrokeSize}'`);
        const finalStrokeColorHex = overallTextStyle?.strokeColor ? agPsdColorToHex(overallTextStyle.strokeColor) : (textElement.strokeColor || '#000000'); // #RRGGBB
        const finalStrokeColorEgret = finalStrokeColorHex.replace('#', '0x');
        attributesArray.push(`strokeColor='${finalStrokeColorEgret}'`);
      }

      const attributes = attributesArray.join(' ');
      const htmlTextContent = note.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\n/g, "<br/>");
      htmlSegments.push(`<font ${attributes}>${htmlTextContent}</font>`);
    }

    const fullHtmlTextFlow = htmlSegments.join('').replace(/"/g, "'");

    navigator.clipboard.writeText(fullHtmlTextFlow).then(() => {
      setCopiedTextFlowId(`textflow_${index}`);
      setTimeout(() => setCopiedTextFlowId(null), 2000);
    }).catch(err => {
      console.error('Failed to copy HTML textFlow:', err);
      setCriticalError('Failed to copy HTML textFlow to clipboard. Ensure HTTPS or localhost.');
    });
  };

  const handleReprocessPsd = useCallback(() => { if (!isLoading && psdFile) handleFileAccepted(psdFile); }, [isLoading, psdFile, handleFileAccepted]);


  const handleDownloadExml = () => {
    if (!generatedExml || !parsedData) {
      setCriticalError("Cannot download EXML: EXML data is not available.");
      return;
    }
    const effectiveSkinName = getEffectiveSkinClassName(skinClassNameInput);
    const fileName = `${effectiveSkinName}.exml`;
    const blob = new Blob([generatedExml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadTypeScript = () => {
    if (!generatedTypeScript || !parsedData) {
      setCriticalError("Cannot download TypeScript: TypeScript data is not available.");
      return;
    }
    const effectiveSkinName = getEffectiveSkinClassName(skinClassNameInput);
    const fileName = `${effectiveSkinName.replace(/Skin$/, '')}.ts`;
    const blob = new Blob([generatedTypeScript], { type: 'text/typescript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const imageElementsToDisplay: ImageTabDisplayItem[] = React.useMemo(() => {
    if (!parsedData) return [];
    const displayItems: ImageTabDisplayItem[] = [];
    const addedResourceNames = new Set<string>();

    const collectImageAssets = (elements: ExtractedLayer[], parentIdForLink?: string) => {
        elements.forEach(el => {
            if (el.type === 'image') {
                const imgEl = el as ExtractedImageElement;
                if (!addedResourceNames.has(imgEl.name)) {
                    displayItems.push({ 
                        ...imgEl, 
                        originalIdForLink: parentIdForLink || el.id 
                    });
                    addedResourceNames.add(imgEl.name);
                }
            } else if (el.type === 'simpleButton') {
                const sbEl = el as ExtractedSimpleButtonElement;
                if (sbEl.sourceName && parsedData.imageAssets.has(sbEl.sourceName)) {
                    if (!addedResourceNames.has(sbEl.sourceName)) {
                        displayItems.push({
                            id: `${el.id}_asset`,
                            type: 'image',
                            originalName: `${el.originalName} (Asset)`,
                            name: sbEl.sourceName,
                            dataUrl: parsedData.imageAssets.get(sbEl.sourceName)!,
                            x: el.x, 
                            y: el.y, 
                            width: el.width, 
                            height: el.height,
                            opacity: el.opacity,
                            originalIdForLink: parentIdForLink || el.id,
                            isFromSimpleButton: true,
                        });
                        addedResourceNames.add(sbEl.sourceName);
                    }
                }
            } else if (el.type === 'baseItemBox') {
                const bibEl = el as ExtractedBaseItemBoxElement;
                if (bibEl.imageResourceName && bibEl.dataUrl && parsedData.imageAssets.has(bibEl.imageResourceName)) {
                     if (!addedResourceNames.has(bibEl.imageResourceName)) {
                        displayItems.push({
                            id: `${el.id}_asset`,
                            type: 'image',
                            originalName: `${el.originalName} (Asset)`,
                            name: bibEl.imageResourceName,
                            dataUrl: bibEl.dataUrl,
                            x: el.x, 
                            y: el.y, 
                            width: el.width, 
                            height: el.height,
                            opacity: el.opacity,
                            originalIdForLink: parentIdForLink || el.id,
                            isFromBaseItemBox: true,
                        });
                        addedResourceNames.add(bibEl.imageResourceName);
                    }
                }
            }

            if (hasChildren(el)) {
                if (el.children && el.children.length > 0) {
                    collectImageAssets(el.children, parentIdForLink || el.id); 
                }
            }
        });
    };

    collectImageAssets(parsedData.elements);
    return displayItems;
  }, [parsedData]);


  const handleDownloadAllImages = async () => {
    if (!parsedData || parsedData.imageAssets.size === 0) {
      alert("No images to download.");
      return;
    }
    setIsLoading(true);
    try {
      const JSZip = (await import('jszip')).default; 
      const zip = new JSZip();
      
      parsedData.imageAssets.forEach((dataUrl, resourceName) => {
        // Remove _png suffix from base name, then add .png extension
        const baseName = resourceName.replace(/_png$/, '');
        // If this resource corresponds to a rasterized text layer, add prefix
        let fileNameInZip = `${baseName}.png`;
        if (parsedData) {
          const isTextRasterized = parsedData.elements.some(el => el.type === 'image' && (el as ExtractedImageElement).name === resourceName && !!(el as ExtractedImageElement).rasterizationReason);
          if (isTextRasterized) {
            fileNameInZip = `text_img_${baseName}.png`;
          }
        }
        const base64Data = dataUrl.split(',')[1];
        zip.file(fileNameInZip, base64Data, { base64: true });
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const effectiveSkinName = getEffectiveSkinClassName(skinClassNameInput) || 'psd_assets';
      const zipFileName = `${effectiveSkinName}_images.zip`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

    } catch (error) {
      console.error("Error creating zip file for images:", error);
      setCriticalError("Failed to download images as ZIP. Check console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  // Kick off background OCR per unique image asset; update only IDs (resource names) when recognized.
  useEffect(() => {
    if (!parsedData) return;
    const entries = Array.from(parsedData.imageAssets.entries()); // [resourceName, dataUrl]
    if (entries.length === 0) return;

    // A helper to ensure unique new names
    const ensureUniqueName = (base: string, existing: Set<string>) => {
      let attempt = `${base}_png`;
      let idx = 0;
      while (existing.has(attempt)) {
        idx += 1;
        attempt = `${base}_${idx}_png`;
      }
      return attempt;
    };

    // Build a set of current names for uniqueness checks
    const currentNames = new Set<string>();
    parsedData.imageAssets.forEach((_v, k) => currentNames.add(k));

    entries.forEach(([resourceName, dataUrl]) => {
      if (ocrStartedRef.current.has(dataUrl)) return; // already started
      ocrStartedRef.current.add(dataUrl);
      setOcrStatusByDataUrl(prev => ({ ...prev, [dataUrl]: 'pending' }));

      // Fire and forget per image
      (async () => {
        try {
          const res = await ocrContainsText(dataUrl, 1);
          const recognized = (res && typeof res.text === 'string') ? res.text : '';
          if (recognized.replace(/\s+/g, '').length >= 1) {
            // Compute new name by prefixing text_img_
            const baseNoPng = resourceName.replace(/_png$/, '');
            const baseWithPrefix = baseNoPng.startsWith('text_img_') ? baseNoPng : `text_img_${baseNoPng}`;
            const newName = ensureUniqueName(baseWithPrefix, currentNames);
            currentNames.add(newName);

            // Apply rename to parsedData immutably
            setParsedData(prev => {
              if (!prev) return prev;
              // Update elements
              const patchElements = (els: ExtractedLayer[]): ExtractedLayer[] =>
                els.map(el => {
                  if (el.type === 'image') {
                    const img = el as ExtractedImageElement;
                    if (img.name === resourceName) {
                      return { ...img, name: newName };
                    }
                    return img;
                  } else if ((el as any).children && Array.isArray((el as any).children)) {
                    const group = el as ExtractedGroupElement | ExtractedXGroupButtonElement;
                    return { ...group, children: patchElements(group.children) } as ExtractedLayer;
                  }
                  return el;
                });

              const newElements = patchElements(prev.elements);
              // Update imageAssets map key
              const newAssets = new Map(prev.imageAssets);
              const data = newAssets.get(resourceName);
              if (data) {
                newAssets.delete(resourceName);
                newAssets.set(newName, data);
              }

              return { ...prev, elements: newElements, imageAssets: newAssets };
            });
          }
          setOcrStatusByDataUrl(prev => ({ ...prev, [dataUrl]: 'done' }));
        } catch (e) {
          setOcrStatusByDataUrl(prev => ({ ...prev, [dataUrl]: 'error' }));
        }
      })();
    });
  }, [parsedData]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-gray-200 p-4 md:p-8 flex flex-col">
      <div className="max-w-7xl mx-auto w-full">
        <AppHeader
          imagePrefix={imagePrefix}
          setImagePrefix={setImagePrefix}
          skinClassNameInput={skinClassNameInput}
          setSkinClassNameInput={setSkinClassNameInput}
          handleFileAccepted={handleFileAccepted}
          isLoading={isLoading}
          psdStructureCache={psdStructureCache}
        />
      </div>

      <main className="max-w-7xl mx-auto w-full flex-grow min-h-0 flex flex-col">
        <div className="bg-slate-800 shadow-2xl rounded-xl p-4 sm:p-6 md:p-8 flex flex-col flex-grow min-h-0">
          {(isLoading && !psdStructureCache) && ( 
            <div className="mt-8 flex flex-col items-center justify-center text-slate-300" role="status" aria-live="polite">
              <LoadingSpinner className="w-12 h-12 mb-4 text-blue-500" />
              <p className="text-lg">Processing PSD, please wait...</p>
              <p className="text-sm text-slate-400">This might take a moment for large files.</p>
            </div>
          )}
          {(isLoading && psdStructureCache) && ( 
            <div className="mt-2 text-center text-sm text-slate-400" role="status" aria-live="polite">
                Updating content based on new prefix or refresh request...
            </div>
          )}

          {criticalError && ( 
            <div className="mt-8 p-4 bg-red-700 bg-opacity-30 border border-red-500 text-red-300 rounded-lg text-center" role="alert">
              <p className="font-semibold">Critical Error:</p>
              <p>{criticalError}</p>
            </div>
          )}

          {(parsedData || parsingIssues.length > 0) && !criticalError && (
            <div className="mt-8 flex flex-col flex-grow min-h-0">
              <TabNavigation
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                parsedData={parsedData}
                parsingIssues={parsingIssues}
                imageElementsToDisplay={imageElementsToDisplay}
                handleDownloadAllImages={handleDownloadAllImages}
                isLoading={isLoading}
                handleReprocessPsd={handleReprocessPsd}
                psdFile={psdFile}
                ocrProgress={(() => {
                  if (!parsedData) return undefined;
                  const total = parsedData.imageAssets.size;
                  if (total === 0) return { pending: 0, total: 0 };
                  let done = 0;
                  parsedData.imageAssets.forEach((dataUrl) => {
                    const st = ocrStatusByDataUrl[dataUrl];
                    if (st === 'done' || st === 'error') done += 1;
                  });
                  const pending = Math.max(0, total - done);
                  return { pending, total };
                })()}
              />
              <div className="flex-grow min-h-0 relative" role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
                {activeTab === 'images' && parsedData && (
                  <ImageGalleryTab
                    imageElementsToDisplay={imageElementsToDisplay}
                    isLoading={isLoading}
                    handleDownloadImage={(imageName, dataUrl) => handleDownloadImage(imageName, dataUrl)}
                    ocrStatusByDataUrl={ocrStatusByDataUrl}
                  />
                )}
                {activeTab === 'code' && (
                  <CodeViewTab
                    generatedExml={generatedExml}
                    generatedTypeScript={generatedTypeScript}
                    isLoading={isLoading}
                    selectedParentClass={selectedParentClass}
                    setSelectedParentClass={setSelectedParentClass}
                    handleDownloadExml={handleDownloadExml}
                    handleDownloadTypeScript={handleDownloadTypeScript}
                    handleCopyExml={handleCopyExml}
                    handleCopyExmlAsGroup={handleCopyExmlAsGroup}
                    handleCopyTypeScript={handleCopyTypeScript}
                    exmlCopied={exmlCopied}
                    exmlGroupCopied={exmlGroupCopied}
                    tsCopied={tsCopied}
                  />
                )}
                {activeTab === 'preview' && (
                  <PreviewTab
                    parsedData={parsedData}
                    psdStructureCache={psdStructureCache}
                    handleElementClickInPreview={handleElementClickInPreview}
                    selectedElementIdForPreviewHighlight={selectedElementIdForPreviewHighlight}
                    selectedElementIdForExmlHighlight={selectedElementIdForExmlHighlight}
                    scrollableExmlPanelRef={scrollableExmlPanelRef}
                    exmlLineRefs={exmlLineRefs}
                    getEffectiveSkinClassName={getEffectiveSkinClassName}
                    skinClassNameInput={skinClassNameInput}
                    findSelectedElementDetails={findSelectedElementDetails}
                  />
                )}
                {activeTab === 'richTextInfo' && parsedData && (
                  <RichTextInfoTab
                    parsedData={parsedData}
                    psdStructureCache={psdStructureCache}
                    isLoading={isLoading}
                    handleCopyHtmlTextFlow={handleCopyHtmlTextFlow}
                    copiedTextFlowId={copiedTextFlowId}
                  />
                )}
                {activeTab === 'diagnostics' && (
                  <DiagnosticsTab parsingIssues={parsingIssues} />
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="max-w-7xl mx-auto w-full mt-12 text-center text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} PSD to EXML Converter. A work by Chen Yi.</p>
      </footer>
    </div>
  );
};
