import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ParsedPsdData, ExtractedLayer, ExtractedImageElement, ExtractedTextElement, ExtractedRectElement, PsdStructuralData, PsdLayer, AgPsdObject, PsdOverallTextStyle, StyleRunStyle, ExtractedXGroupButtonElement, ExtractedGroupElement, ExtractedRewardBarElement, ExtractedSimpleButtonElement, ExtractedBaseItemBoxElement, ExtractedPanelBottomBarElement } from '../types';
import { agPsdColorToHex } from '../services/psdProcessor';
import { generateExmlForElement } from '../services/exmlGenerator';
import { EyeIcon, CodeIcon as NoCodeIcon, SimpleButtonIcon, StarIcon, BaseItemBoxIcon, PanelBottomBarIcon } from './icons';

const calculatePixelFontSizePreview = (
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

// --- Flattened EXML line data structure ---
interface ExmlLineData {
  elementId: string;       // The element this line maps to
  text: string;            // The EXML text for this line
  indentLevel: number;     // Visual indent level
  isOpenTag: boolean;      // Is this an opening tag of a container?
  isCloseTag: boolean;     // Is this a closing tag of a container?
}

/**
 * Flatten the element tree into individual EXML lines.
 * Each line maps to a specific element ID for click targeting.
 */
function flattenElementsToExmlLines(
  elements: ExtractedLayer[],
  indentLevel: number,
  parentWidth: number
): ExmlLineData[] {
  const lines: ExmlLineData[] = [];

  for (const el of elements) {
    const exmlStr = generateExmlForElement(el, indentLevel, parentWidth);
    if (!exmlStr) continue;

    // For container elements (xGroupButton, group), split into open/children/close
    if ((el.type === 'xGroupButton' || el.type === 'group') && 'children' in el) {
      const containerEl = el as ExtractedXGroupButtonElement | ExtractedGroupElement;
      const exmlLines = exmlStr.split('\n');

      if (exmlLines.length >= 2) {
        // Opening tag
        lines.push({
          elementId: el.id,
          text: exmlLines[0],
          indentLevel,
          isOpenTag: true,
          isCloseTag: false,
        });

        // Recursively flatten children
        const childLines = flattenElementsToExmlLines(
          containerEl.children,
          indentLevel + 1,
          Math.round(el.width)
        );
        lines.push(...childLines);

        // Closing tag
        lines.push({
          elementId: el.id,
          text: exmlLines[exmlLines.length - 1],
          indentLevel,
          isOpenTag: false,
          isCloseTag: true,
        });
      } else {
        // Single-line container (empty children)
        lines.push({
          elementId: el.id,
          text: exmlStr,
          indentLevel,
          isOpenTag: false,
          isCloseTag: false,
        });
      }
    } else {
      // Leaf element — single line
      lines.push({
        elementId: el.id,
        text: exmlStr,
        indentLevel,
        isOpenTag: false,
        isCloseTag: false,
      });
    }
  }

  return lines;
}

// --- Preview Component ---
interface ExmlPreviewComponentProps {
  parsedData: ParsedPsdData;
  psdStructureCache: PsdStructuralData | null;
  onElementClick: (elementId: string, isMultiSelect?: boolean) => void;
  selectedElementIds: Set<string>;
  previewElementRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
}

const ExmlPreviewComponent: React.FC<ExmlPreviewComponentProps> = ({ parsedData, psdStructureCache, onElementClick, selectedElementIds, previewElementRefs }) => {
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!parsedData || !containerRef.current) return;
    const calculateScale = () => {
      if (!parsedData || !containerRef.current) return;
      const availableWidth = containerRef.current.clientWidth;
      const availableHeight = containerRef.current.clientHeight;
      const contentWidth = parsedData.width;
      const contentHeight = parsedData.height;
      if (contentWidth <= 0 || contentHeight <= 0) { setScale(1); return; }
      const scaleX = availableWidth / contentWidth;
      const scaleY = availableHeight / contentHeight;
      const newScale = Math.min(scaleX, scaleY) * 0.98;
      setScale(newScale > 0.01 ? newScale : 0.01);
    };
    calculateScale();
    const currentRef = containerRef.current;
    const ResizeObs = (window as any).ResizeObserver;
    if (!ResizeObs) return;
    const resizeObserver = new ResizeObs(calculateScale);
    if (currentRef) resizeObserver.observe(currentRef);
    return () => { if (currentRef) resizeObserver.unobserve(currentRef); resizeObserver.disconnect(); };
  }, [parsedData]);

  const scaledContentWidth = parsedData.width * scale;
  const scaledContentHeight = parsedData.height * scale;

  const formatRgbaFromHexAlpha = (hexColor: string, alpha: number): string => {
    if (!hexColor || !hexColor.startsWith('#') || hexColor.length !== 7) return `rgba(0,0,0,${alpha.toFixed(2)})`;
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
  };

  const renderElement = (element: ExtractedLayer): React.ReactNode => {
    const baseStyleForPositioning: React.CSSProperties = { position: 'absolute', boxSizing: 'border-box', cursor: 'pointer' };
    if (typeof element.opacity === 'number' && element.opacity < 0.99) baseStyleForPositioning.opacity = element.opacity;
    if (selectedElementIds.has(element.id) && element.type !== 'text') {
      baseStyleForPositioning.outline = `${Math.max(2, 3 * scale)}px solid #FF00FF`;
      baseStyleForPositioning.outlineOffset = `${-1 * Math.max(1, scale)}px`;
    }

    const refCallback = (domEl: HTMLElement | null) => {
      previewElementRefs.current[element.id] = domEl;
    };

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onElementClick(element.id, e.ctrlKey || e.metaKey || e.shiftKey);
    };

    if (element.type === 'image') {
      const imgEl = element as ExtractedImageElement;
      const style: React.CSSProperties = { ...baseStyleForPositioning, left: imgEl.x * scale, top: imgEl.y * scale, width: imgEl.width * scale, height: imgEl.height * scale };
      return <img key={element.id} ref={refCallback as any} src={imgEl.dataUrl} alt={element.originalName} style={style} className="object-contain" onClick={handleClick} aria-label={`Preview of image ${element.originalName}`} />;
    } else if (element.type === 'text') {
        const textEl = element as ExtractedTextElement;
        const findOriginalLayerRecursive = (layers: PsdLayer[], originalName: string): PsdLayer | undefined => {
            for (const l of layers) { if (l.name === originalName) return l; if (l.children) { const found = findOriginalLayerRecursive(l.children, originalName); if (found) return found; } } return undefined;
        };
        const originalLayer = psdStructureCache ? findOriginalLayerRecursive(psdStructureCache.allLayers, element.originalName) : undefined;
        const isActuallyRichText = textEl.isRichText;
        let textContentRender: React.ReactNode;
        const outerPositioningStyle: React.CSSProperties = { ...baseStyleForPositioning, height: 'auto' };
        const textVerticalOffsetForPreview = -textEl.fontSize / 3; // textEl.fontSize is unscaled PSD point size

        if (typeof textEl.rotation === 'number' && Math.abs(textEl.rotation) > 0.01 && typeof textEl.anchorOffsetX === 'number' && typeof textEl.anchorOffsetY === 'number') {
            outerPositioningStyle.left = (textEl.x - textEl.anchorOffsetX) * scale;
            outerPositioningStyle.top = ((textEl.y - textEl.anchorOffsetY) + textVerticalOffsetForPreview) * scale;
            outerPositioningStyle.transform = `rotate(${textEl.rotation.toFixed(2)}deg)`;
            outerPositioningStyle.transformOrigin = `${textEl.anchorOffsetX * scale}px ${textEl.anchorOffsetY * scale}px`;
        } else {
            outerPositioningStyle.left = textEl.x * scale; 
            outerPositioningStyle.top = (textEl.y + textVerticalOffsetForPreview) * scale;
        }
        outerPositioningStyle.textAlign = textEl.textAlign || 'left';

        const primaryScaledFontSizeForDiv = Math.max(1, textEl.fontSize * scale);

        const innerTextStyle: React.CSSProperties = {
            display: 'inline-block',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
            textAlign: textEl.textAlign || 'left',
            color: textEl.textColor,
            fontSize: `${primaryScaledFontSizeForDiv}px`,
            verticalAlign: 'top',
        };

        if (textEl.text.includes('\n')) {
            if (typeof textEl.lineSpacing === 'number' && typeof textEl.fontSize === 'number') {
                innerTextStyle.lineHeight = `${(textEl.fontSize + textEl.lineSpacing) * scale}px`;
            } else {
                innerTextStyle.lineHeight = 1.2; 
            }
        } else {
            innerTextStyle.lineHeight = 'normal'; 
        }

        if (typeof textEl.strokeSize === 'number' && textEl.strokeSize > 0 && textEl.strokeColor) {
            innerTextStyle.paintOrder = 'stroke fill';
            innerTextStyle.WebkitTextStroke = `${textEl.strokeSize * scale * 2}px ${textEl.strokeColor}`;
        }
        if (selectedElementIds.has(element.id)) { 
            innerTextStyle.outline = `${Math.max(2, 3 * scale)}px solid #FF00FF`; 
            innerTextStyle.outlineOffset = `${-1 * Math.max(1, scale)}px`; 
        }

        if (isActuallyRichText && originalLayer?.text && originalLayer.text.styleRuns && psdStructureCache?.psd) {
          let currentOffset = 0;
          textContentRender = originalLayer.text.styleRuns.map((run, runIndex) => {
            const segment = originalLayer.text!.text.substring(currentOffset, currentOffset + run.length) || ""; currentOffset += run.length;
            const runStyleFromPsd: StyleRunStyle = run.style || {}; const overallStyleFromPsd: PsdOverallTextStyle | undefined = originalLayer.text!.style;
            let runFontSizePx = calculatePixelFontSizePreview(runStyleFromPsd.fontSize ?? overallStyleFromPsd?.fontSize, psdStructureCache.psd.imageResources, originalLayer.text!.transform) || textEl.fontSize;
            let runColor = textEl.textColor; if (runStyleFromPsd.fillColor) runColor = agPsdColorToHex(runStyleFromPsd.fillColor); else if (overallStyleFromPsd?.fillColor) runColor = agPsdColorToHex(overallStyleFromPsd.fillColor);
            const rawFont = runStyleFromPsd.font?.name || overallStyleFromPsd?.font?.name || textEl.fontFamily;
            const runFontFamily = rawFont ? `'${rawFont}', "Microsoft YaHei", "PingFang SC", "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif` : `"Microsoft YaHei", "PingFang SC", "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif`;
            const finalScaledRunFontSize = Math.max(1, runFontSizePx * scale); let runLineHeightStyle: string | number = 'normal';
            if (textEl.text.includes('\n')) {
                let runLeadingPt: number | undefined = runStyleFromPsd.leading ?? overallStyleFromPsd?.leading; let runAutoLeading: boolean = overallStyleFromPsd?.autoLeading ?? true; if (runStyleFromPsd.leading !== undefined) runAutoLeading = false;
                if (runAutoLeading === false && typeof runLeadingPt === 'number' && runLeadingPt > 0) { const leadingPx = calculatePixelFontSizePreview(runLeadingPt, psdStructureCache.psd.imageResources, originalLayer.text!.transform); runLineHeightStyle = `${Math.max(1, leadingPx * scale)}px`; }
                else runLineHeightStyle = `${finalScaledRunFontSize * 1.4}px`; 
            }
            let baselineShiftPx = 0;
            const runBaselineShift = runStyleFromPsd.baselineShift ?? overallStyleFromPsd?.baselineShift;
            if (typeof runBaselineShift === 'number' && runBaselineShift !== 0) {
                baselineShiftPx = calculatePixelFontSizePreview(runBaselineShift, psdStructureCache.psd.imageResources, originalLayer.text!.transform);
            }
            // Debug: log full style run data for segments containing middle dot or similar punctuation
            if (segment.includes('・') || segment.includes('·') || segment.includes('‧')) {
                console.log(`[BaselineShift Debug] Layer: "${element.originalName}" Segment: ${JSON.stringify(segment)}`, {
                    baselineShift: runBaselineShift,
                    baselineShiftPx,
                    allRunStyleKeys: Object.keys(runStyleFromPsd),
                    runStyleFull: JSON.parse(JSON.stringify(runStyleFromPsd)),
                    overallBaselineShift: overallStyleFromPsd?.baselineShift,
                });
            }
            const runSpanStyle: React.CSSProperties = {
                fontSize: `${finalScaledRunFontSize}px`,
                color: runColor,
                fontFamily: runFontFamily,
                lineHeight: runLineHeightStyle
            };
            if (baselineShiftPx !== 0) {
                runSpanStyle.position = 'relative';
                runSpanStyle.top = `${-baselineShiftPx * scale}px`;
            }
            return <span key={runIndex} style={runSpanStyle}>{segment}</span>;
          });
        } else {
            const plainTextScaledFontSize = primaryScaledFontSizeForDiv; 
            const fallbackFontFamily = textEl.fontFamily ? `'${textEl.fontFamily}', "Microsoft YaHei", "PingFang SC", "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif` : `"Microsoft YaHei", "PingFang SC", "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif`;
            textContentRender = <span style={{ fontSize: `${plainTextScaledFontSize}px`, fontFamily: fallbackFontFamily }}>{textEl.text}</span>;
        }
        return <div key={element.id} ref={refCallback} style={outerPositioningStyle} onClick={handleClick} aria-label={`Preview of text layer ${element.originalName}`}><div style={innerTextStyle} title={textEl.text}>{textContentRender}</div></div>;
    } else if (element.type === 'rect') {
        const rectEl = element as ExtractedRectElement; const rectStyle: React.CSSProperties = { ...baseStyleForPositioning, left: rectEl.x * scale, top: rectEl.y * scale, width: rectEl.width * scale, height: rectEl.height * scale, backgroundColor: formatRgbaFromHexAlpha(rectEl.fillColor, rectEl.fillAlpha), borderRadius: rectEl.cornerRadius ? `${rectEl.cornerRadius * scale}px` : '0px' };
        return <div key={element.id} ref={refCallback} style={rectStyle} title={`Rect: ${rectEl.originalName}`} onClick={handleClick} aria-label={`Preview of rectangle ${element.originalName}`}></div>;
    } else if (element.type === 'xGroupButton') {
        const groupButtonEl = element as ExtractedXGroupButtonElement; const groupWrapperStyle: React.CSSProperties = { ...baseStyleForPositioning, left: groupButtonEl.x * scale, top: groupButtonEl.y * scale, width: groupButtonEl.width * scale, height: groupButtonEl.height * scale };
        return <div key={element.id} ref={refCallback} style={groupWrapperStyle} title={`XGroupButton: ${groupButtonEl.originalName}`} onClick={handleClick} aria-label={`Preview of group button ${element.originalName}`}>{groupButtonEl.children.map(child => renderElement(child))}</div>;
    } else if (element.type === 'simpleButton') {
        const simpleBtnEl = element as ExtractedSimpleButtonElement; const simpleBtnStyle: React.CSSProperties = { ...baseStyleForPositioning, left: simpleBtnEl.x * scale, top: simpleBtnEl.y * scale, width: simpleBtnEl.width * scale, height: simpleBtnEl.height * scale, display: 'flex', alignItems: 'center', justifyContent: 'center' };
        if (simpleBtnEl.sourceName && parsedData?.imageAssets) { const dataUrl = parsedData.imageAssets.get(simpleBtnEl.sourceName); if (dataUrl) return <img key={element.id} ref={refCallback as any} src={dataUrl} alt={simpleBtnEl.originalName} style={simpleBtnStyle} className="object-contain" title={`SimpleButton (Image): ${simpleBtnEl.originalName}`} onClick={handleClick} aria-label={`Preview of simple button ${element.originalName} (image-based)`} />; }
        simpleBtnStyle.backgroundColor = `rgba(100, 100, 100, ${0.5 * (simpleBtnEl.opacity ?? 1)})`; simpleBtnStyle.border = `1px solid rgba(200, 200, 200, ${0.7 * (simpleBtnEl.opacity ?? 1)})`;
        return <div key={element.id} ref={refCallback} style={simpleBtnStyle} title={`SimpleButton (Rect): ${simpleBtnEl.originalName}`} onClick={handleClick} aria-label={`Preview of simple button ${element.originalName} (rect-based)`}><SimpleButtonIcon className="w-1/2 h-1/2 opacity-50" style={{maxWidth: '24px', maxHeight: '24px'}} /></div>;
    } else if (element.type === 'group') {
        const groupEl = element as ExtractedGroupElement; const groupWrapperStyle: React.CSSProperties = { ...baseStyleForPositioning, left: groupEl.x * scale, top: groupEl.y * scale, width: groupEl.width * scale, height: groupEl.height * scale };
        return <div key={element.id} ref={refCallback} style={groupWrapperStyle} title={`Group: ${groupEl.originalName}`} onClick={handleClick} aria-label={`Preview of group ${element.originalName}`}>{groupEl.children.map(child => renderElement(child))}</div>;
    } else if (element.type === 'rewardBar') {
        const rewardBarEl = element as ExtractedRewardBarElement; const rewardBarStyle: React.CSSProperties = { ...baseStyleForPositioning, left: rewardBarEl.x * scale, top: rewardBarEl.y * scale, width: rewardBarEl.width * scale, height: rewardBarEl.height * scale, border: `1px dashed #FFD700`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD700', fontSize: `${Math.max(8, 10 * scale)}px` };
        return <div key={element.id} ref={refCallback} style={rewardBarStyle} title={`RewardBar: ${rewardBarEl.originalName}`} onClick={handleClick} aria-label={`Preview of RewardBar component ${element.originalName}`}><StarIcon className="w-4 h-4 mr-1" style={{width: `${Math.max(8,16*scale)}px`, height: `${Math.max(8,16*scale)}px`}} /> RB</div>;
    } else if (element.type === 'baseItemBox') {
        const itemBoxEl = element as ExtractedBaseItemBoxElement; const itemBoxStyle: React.CSSProperties = { ...baseStyleForPositioning, left: itemBoxEl.x * scale, top: itemBoxEl.y * scale, width: itemBoxEl.width * scale, height: itemBoxEl.height * scale };
        if (itemBoxEl.dataUrl) return <img key={element.id} ref={refCallback as any} src={itemBoxEl.dataUrl} alt={itemBoxEl.originalName} style={itemBoxStyle} className="object-contain" onClick={handleClick} aria-label={`Preview of BaseItemBox ${element.originalName}`} />;
        else { itemBoxStyle.border = `1px dashed #A3E635`; itemBoxStyle.display = 'flex'; itemBoxStyle.alignItems = 'center'; itemBoxStyle.justifyContent = 'center'; itemBoxStyle.color = '#A3E635'; itemBoxStyle.fontSize = `${Math.max(8, 10 * scale)}px`;
            return <div key={element.id} ref={refCallback} style={itemBoxStyle} title={`BaseItemBox: ${itemBoxEl.originalName}`} onClick={handleClick} aria-label={`Preview of BaseItemBox component ${element.originalName}`}><BaseItemBoxIcon className="w-4 h-4 mr-1" style={{width: `${Math.max(8,16*scale)}px`, height: `${Math.max(8,16*scale)}px`}} /> Item</div>; }
    } else if (element.type === 'panelBottomBar') {
        const pbbEl = element as ExtractedPanelBottomBarElement; const pbbStyle: React.CSSProperties = { ...baseStyleForPositioning, left: pbbEl.x * scale, top: pbbEl.y * scale, width: pbbEl.width * scale, height: pbbEl.height * scale };
        if (pbbEl.dataUrl) {
            return <img key={element.id} ref={refCallback as any} src={pbbEl.dataUrl} alt={pbbEl.originalName} style={pbbStyle} className="object-contain" onClick={handleClick} aria-label={`Preview of PanelBottomBar component ${pbbEl.originalName}`} />;
        } else {
            pbbStyle.border = `1px dashed #94A3B8`; pbbStyle.display = 'flex'; pbbStyle.alignItems = 'center'; pbbStyle.justifyContent = 'center'; pbbStyle.color = '#94A3B8'; pbbStyle.fontSize = `${Math.max(8, 10 * scale)}px`;
            return <div key={element.id} ref={refCallback} style={pbbStyle} title={`PanelBottomBar: ${pbbEl.originalName}`} onClick={handleClick} aria-label={`Preview of PanelBottomBar component ${pbbEl.originalName}`}><PanelBottomBarIcon className="w-4 h-4 mr-1" style={{width: `${Math.max(8,16*scale)}px`, height: `${Math.max(8,16*scale)}px`}} /> PBB</div>;
        }
    }
    return null;
  };

  return (
    <div ref={containerRef} className="bg-slate-900 p-1 sm:p-2 rounded-lg shadow-inner w-full h-full flex justify-center overflow-hidden" role="region" aria-label="EXML Preview Canvas">
      <div className="relative border border-slate-600" style={{ width: scaledContentWidth, height: scaledContentHeight, backgroundImage: 'repeating-conic-gradient(#D8D8D8 0% 25%, #FFFFFF 25% 50%)', backgroundPosition: '0 0', backgroundSize: '16px 16px' }} onClick={() => onElementClick('')} role="group" aria-label="Preview content area">
        {parsedData.elements.map(element => renderElement(element))}
      </div>
    </div>
  );
};

interface PreviewTabProps {
  parsedData: ParsedPsdData | null;
  psdStructureCache: PsdStructuralData | null;
  handleElementClickInPreview: (elementId: string, isMultiSelect?: boolean) => void;
  handleCodeLineClick: (elementId: string, isMultiSelect?: boolean) => void;
  selectedElementIds: Set<string>;
  setSelectedElementIds: (ids: Set<string>) => void;
  scrollableExmlPanelRef: React.RefObject<HTMLDivElement>;
  exmlLineRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
  previewElementRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
  getEffectiveSkinClassName: (inputName: string) => string;
  skinClassNameInput: string;
}

export const PreviewTab: React.FC<PreviewTabProps> = ({
  parsedData,
  psdStructureCache,
  handleElementClickInPreview,
  handleCodeLineClick,
  selectedElementIds,
  setSelectedElementIds,
  scrollableExmlPanelRef,
  exmlLineRefs,
  previewElementRefs,
  getEffectiveSkinClassName,
  skinClassNameInput,
}) => {
  // Flatten elements into individual EXML lines for per-line rendering
  const exmlLines = useMemo<ExmlLineData[]>(() => {
    if (!parsedData || parsedData.elements.length === 0) return [];
    return flattenElementsToExmlLines(parsedData.elements, 1, Math.round(parsedData.width));
  }, [parsedData]);

  // Handle native text selection in the EXML panel to support drag-to-select multi-selection
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      
      const panel = scrollableExmlPanelRef.current;
      if (!panel || !panel.contains(selection.anchorNode)) return;

      const newSelectedIds = new Set<string>();
      const lineElements = panel.querySelectorAll('[data-element-id]');
      
      lineElements.forEach((el) => {
        if (selection.containsNode(el, true)) {
          const id = el.getAttribute('data-element-id');
          if (id) newSelectedIds.add(id);
        }
      });
      
      if (newSelectedIds.size > 0) {
        setSelectedElementIds(newSelectedIds);
      }
    };
    
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [setSelectedElementIds, scrollableExmlPanelRef]);

  // Scroll to the highlighted element's code line when selection changes
  useEffect(() => {
    if (selectedElementIds.size === 0 || !scrollableExmlPanelRef.current) return;
    // Find the first line that matches the first selected element
    const firstSelectedId = Array.from(selectedElementIds)[0];
    const targetRef = exmlLineRefs.current[firstSelectedId];
    if (targetRef) {
      // Use requestAnimationFrame to ensure DOM is updated before scrolling
      requestAnimationFrame(() => {
        targetRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [selectedElementIds, scrollableExmlPanelRef, exmlLineRefs]);

  return (
    <div className="flex flex-col md:flex-row h-full md:space-x-4">
      <div className="flex-grow min-h-0 p-1 md:w-3/5">
        {parsedData && parsedData.width > 0 ? (
            <ExmlPreviewComponent
              parsedData={parsedData}
              psdStructureCache={psdStructureCache}
              onElementClick={handleElementClickInPreview}
              selectedElementIds={selectedElementIds}
              previewElementRefs={previewElementRefs}
            />
        ) : (
          <div className="text-center py-12 text-slate-400 h-full flex flex-col justify-center items-center bg-slate-900 rounded-lg">
            <EyeIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-xl font-semibold">Nothing to preview.</p>
            <p>Upload a PSD to see the visual preview.</p>
          </div>
        )}
      </div>
      <div className="h-[13rem] md:h-full min-h-0 p-1 mt-2 md:mt-0 md:w-2/5">
        {parsedData && parsedData.elements.length > 0 ? (
          <div className="bg-slate-900 rounded-lg shadow-inner h-full flex flex-col overflow-hidden">
            <p className="text-xs text-slate-400 p-2 border-b border-slate-700">
              EXML Output (Click elements in preview or code lines for bidirectional highlight)
            </p>
            <div ref={scrollableExmlPanelRef} className="overflow-y-auto custom-scrollbar flex-grow p-2" aria-live="polite">
              {/* XML header */}
              <div className="text-xs text-sky-300 font-mono px-1 py-px whitespace-pre">
                {'<?xml version="1.0" encoding="utf-8"?>'}
              </div>
              {/* Skin opening tag */}
              <div className="text-xs text-sky-300 font-mono px-1 py-px whitespace-pre">
                {`<e:Skin class="skins.${getEffectiveSkinClassName(skinClassNameInput)}" width="${Math.round(parsedData.width)}" height="${Math.round(parsedData.height)}" xmlns:e="http://ns.egret.com/eui" xmlns:w="http://ns.egret.com/wing" xmlns:ns1="*">`}
              </div>
              {/* Per-element EXML lines */}
              {exmlLines.map((line, index) => {
                const isSelected = selectedElementIds.has(line.elementId);
                return (
                  <div
                    key={`${line.elementId}-${index}`}
                    data-element-id={line.elementId}
                    ref={(domEl) => {
                      // Register the first line for this element as the scroll target
                      if (domEl && (!exmlLineRefs.current[line.elementId] || !line.isCloseTag)) {
                        exmlLineRefs.current[line.elementId] = domEl;
                      }
                    }}
                    className={`text-xs font-mono py-px whitespace-pre cursor-pointer transition-colors duration-100
                      ${isSelected
                        ? 'bg-fuchsia-700 text-white font-bold border-l-4 border-fuchsia-300 pl-1 pr-2'
                        : 'text-sky-300 hover:bg-slate-700/60 px-1 border-l-4 border-transparent'
                      }
                    `}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCodeLineClick(line.elementId, e.ctrlKey || e.metaKey || e.shiftKey);
                    }}
                    title={`Click to highlight element in preview`}
                  >
                    {line.text}
                  </div>
                );
              })}
              {/* Skin closing tag */}
              <div className="text-xs text-sky-300 font-mono px-1 py-px whitespace-pre">
                {'</e:Skin>'}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 h-full flex flex-col justify-center items-center bg-slate-900 rounded-lg">
            <NoCodeIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-semibold">No EXML elements to display here.</p>
          </div>
        )}
      </div>
    </div>
  );
};