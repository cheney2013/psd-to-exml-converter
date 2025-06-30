import React, { useState, useEffect, useRef } from 'react';
import { ParsedPsdData, ExtractedLayer, ExtractedImageElement, ExtractedTextElement, ExtractedRectElement, PsdStructuralData, PsdLayer, AgPsdObject, PsdOverallTextStyle, StyleRunStyle, ExtractedXGroupButtonElement, ExtractedGroupElement, ExtractedRewardBarElement, ExtractedSimpleButtonElement, ExtractedBaseItemBoxElement } from '../types';
import { agPsdColorToHex } from '../services/psdProcessor';
import { generateExmlForElement } from '../services/exmlGenerator';
import { EyeIcon, CodeIcon as NoCodeIcon, SimpleButtonIcon, StarIcon, BaseItemBoxIcon } from './icons';

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

interface ExmlPreviewComponentProps {
  parsedData: ParsedPsdData;
  psdStructureCache: PsdStructuralData | null;
  onElementClick: (elementId: string) => void;
  selectedElementIdForPreview: string | null;
}

const ExmlPreviewComponent: React.FC<ExmlPreviewComponentProps> = ({ parsedData, psdStructureCache, onElementClick, selectedElementIdForPreview }) => {
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
    const resizeObserver = new ResizeObserver(calculateScale);
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
    if (element.id === selectedElementIdForPreview && element.type !== 'text') {
      baseStyleForPositioning.outline = `${Math.max(1, 2 * scale)}px solid #00FFFF`;
      baseStyleForPositioning.outlineOffset = `${-1 * Math.max(1, scale)}px`;
    }

    if (element.type === 'image') {
      const imgEl = element as ExtractedImageElement;
      const style: React.CSSProperties = { ...baseStyleForPositioning, left: imgEl.x * scale, top: imgEl.y * scale, width: imgEl.width * scale, height: imgEl.height * scale };
      return <img key={element.id} src={imgEl.dataUrl} alt={element.originalName} style={style} className="object-contain" onClick={(e) => { e.stopPropagation(); onElementClick(element.id); }} aria-label={`Preview of image ${element.originalName}`} />;
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
            outerPositioningStyle.width = textEl.width * scale; 
            outerPositioningStyle.transform = `rotate(${textEl.rotation.toFixed(2)}deg)`;
            outerPositioningStyle.transformOrigin = `${textEl.anchorOffsetX * scale}px ${textEl.anchorOffsetY * scale}px`;
        } else {
            outerPositioningStyle.left = textEl.x * scale; 
            outerPositioningStyle.top = (textEl.y + textVerticalOffsetForPreview) * scale;
            outerPositioningStyle.width = textEl.width * scale;
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
            verticalAlign: 'top', // Added to stick to the top of the parent
        };

        if (textEl.text.includes('\n')) {
            if (typeof textEl.lineSpacing === 'number' && typeof textEl.fontSize === 'number') { // textEl.fontSize is unscaled
                innerTextStyle.lineHeight = `${(textEl.fontSize + textEl.lineSpacing) * scale}px`;
            } else {
                innerTextStyle.lineHeight = 1.2; 
            }
        } else {
            innerTextStyle.lineHeight = 'normal'; 
        }

        if (typeof textEl.strokeSize === 'number' && textEl.strokeSize > 0 && textEl.strokeColor) {
            const cssStrokeColor = textEl.strokeColor; const shadowOffset = Math.max(0.5, Math.min(2, textEl.strokeSize * scale * 0.35));
            innerTextStyle.textShadow = `-${shadowOffset}px -${shadowOffset}px 0 ${cssStrokeColor}, ${shadowOffset}px -${shadowOffset}px 0 ${cssStrokeColor}, -${shadowOffset}px  ${shadowOffset}px 0 ${cssStrokeColor}, ${shadowOffset}px  ${shadowOffset}px 0 ${cssStrokeColor}`;
        }
        if (element.id === selectedElementIdForPreview) { innerTextStyle.outline = `${Math.max(1, 2 * scale)}px solid #00FFFF`; innerTextStyle.outlineOffset = `${-1 * Math.max(1, scale)}px`; }

        if (isActuallyRichText && originalLayer?.text && originalLayer.text.styleRuns && psdStructureCache?.psd) {
          let currentOffset = 0;
          textContentRender = originalLayer.text.styleRuns.map((run, runIndex) => {
            const segment = originalLayer.text!.text.substring(currentOffset, currentOffset + run.length) || ""; currentOffset += run.length;
            const runStyleFromPsd: StyleRunStyle = run.style || {}; const overallStyleFromPsd: PsdOverallTextStyle | undefined = originalLayer.text!.style;
            let runFontSizePx = calculatePixelFontSizePreview(runStyleFromPsd.fontSize ?? overallStyleFromPsd?.fontSize, psdStructureCache.psd.imageResources, originalLayer.text!.transform) || textEl.fontSize;
            let runColor = textEl.textColor; if (runStyleFromPsd.fillColor) runColor = agPsdColorToHex(runStyleFromPsd.fillColor); else if (overallStyleFromPsd?.fillColor) runColor = agPsdColorToHex(overallStyleFromPsd.fillColor);
            const runFontFamily = runStyleFromPsd.font?.name || overallStyleFromPsd?.font?.name || textEl.fontFamily || 'sans-serif';
            const finalScaledRunFontSize = Math.max(1, runFontSizePx * scale); let runLineHeightStyle: string | number = 'normal';
            if (textEl.text.includes('\n')) {
                let runLeadingPt: number | undefined = runStyleFromPsd.leading ?? overallStyleFromPsd?.leading; let runAutoLeading: boolean = overallStyleFromPsd?.autoLeading ?? true; if (runStyleFromPsd.leading !== undefined) runAutoLeading = false;
                if (runAutoLeading === false && typeof runLeadingPt === 'number' && runLeadingPt > 0) { const leadingPx = calculatePixelFontSizePreview(runLeadingPt, psdStructureCache.psd.imageResources, originalLayer.text!.transform); runLineHeightStyle = `${Math.max(1, leadingPx * scale)}px`; }
                else runLineHeightStyle = `${finalScaledRunFontSize * 1.4}px`; 
            }
            return <span key={runIndex} style={{ fontSize: `${finalScaledRunFontSize}px`, color: runColor, fontFamily: runFontFamily, lineHeight: runLineHeightStyle }}>{segment}</span>;
          });
        } else {
            const plainTextScaledFontSize = primaryScaledFontSizeForDiv; 
            textContentRender = <span style={{ fontSize: `${plainTextScaledFontSize}px`, fontFamily: textEl.fontFamily || 'sans-serif' }}>{textEl.text}</span>;
        }
        return <div key={element.id} style={outerPositioningStyle} onClick={(e) => { e.stopPropagation(); onElementClick(element.id); }} aria-label={`Preview of text layer ${element.originalName}`}><div style={innerTextStyle} title={textEl.text}>{textContentRender}</div></div>;
    } else if (element.type === 'rect') {
        const rectEl = element as ExtractedRectElement; const rectStyle: React.CSSProperties = { ...baseStyleForPositioning, left: rectEl.x * scale, top: rectEl.y * scale, width: rectEl.width * scale, height: rectEl.height * scale, backgroundColor: formatRgbaFromHexAlpha(rectEl.fillColor, rectEl.fillAlpha), borderRadius: rectEl.cornerRadius ? `${rectEl.cornerRadius * scale}px` : '0px' };
        return <div key={element.id} style={rectStyle} title={`Rect: ${rectEl.originalName}`} onClick={(e) => { e.stopPropagation(); onElementClick(element.id); }} aria-label={`Preview of rectangle ${element.originalName}`}></div>;
    } else if (element.type === 'xGroupButton') {
        const groupButtonEl = element as ExtractedXGroupButtonElement; const groupWrapperStyle: React.CSSProperties = { ...baseStyleForPositioning, left: groupButtonEl.x * scale, top: groupButtonEl.y * scale, width: groupButtonEl.width * scale, height: groupButtonEl.height * scale };
        return <div key={element.id} style={groupWrapperStyle} title={`XGroupButton: ${groupButtonEl.originalName}`} onClick={(e) => { e.stopPropagation(); onElementClick(element.id); }} aria-label={`Preview of group button ${element.originalName}`}>{groupButtonEl.children.map(child => renderElement(child))}</div>;
    } else if (element.type === 'simpleButton') {
        const simpleBtnEl = element as ExtractedSimpleButtonElement; const simpleBtnStyle: React.CSSProperties = { ...baseStyleForPositioning, left: simpleBtnEl.x * scale, top: simpleBtnEl.y * scale, width: simpleBtnEl.width * scale, height: simpleBtnEl.height * scale, display: 'flex', alignItems: 'center', justifyContent: 'center' };
        if (simpleBtnEl.sourceName && parsedData?.imageAssets) { const dataUrl = parsedData.imageAssets.get(simpleBtnEl.sourceName); if (dataUrl) return <img key={element.id} src={dataUrl} alt={simpleBtnEl.originalName} style={simpleBtnStyle} className="object-contain" title={`SimpleButton (Image): ${simpleBtnEl.originalName}`} onClick={(e) => { e.stopPropagation(); onElementClick(element.id); }} aria-label={`Preview of simple button ${element.originalName} (image-based)`} />; }
        simpleBtnStyle.backgroundColor = `rgba(100, 100, 100, ${0.5 * (simpleBtnEl.opacity ?? 1)})`; simpleBtnStyle.border = `1px solid rgba(200, 200, 200, ${0.7 * (simpleBtnEl.opacity ?? 1)})`;
        return <div key={element.id} style={simpleBtnStyle} title={`SimpleButton (Rect): ${simpleBtnEl.originalName}`} onClick={(e) => { e.stopPropagation(); onElementClick(element.id); }} aria-label={`Preview of simple button ${element.originalName} (rect-based)`}><SimpleButtonIcon className="w-1/2 h-1/2 opacity-50" style={{maxWidth: '24px', maxHeight: '24px'}} /></div>;
    } else if (element.type === 'group') {
        const groupEl = element as ExtractedGroupElement; const groupWrapperStyle: React.CSSProperties = { ...baseStyleForPositioning, left: groupEl.x * scale, top: groupEl.y * scale, width: groupEl.width * scale, height: groupEl.height * scale };
        return <div key={element.id} style={groupWrapperStyle} title={`Group: ${groupEl.originalName}`} onClick={(e) => { e.stopPropagation(); onElementClick(element.id); }} aria-label={`Preview of group ${element.originalName}`}>{groupEl.children.map(child => renderElement(child))}</div>;
    } else if (element.type === 'rewardBar') {
        const rewardBarEl = element as ExtractedRewardBarElement; const rewardBarStyle: React.CSSProperties = { ...baseStyleForPositioning, left: rewardBarEl.x * scale, top: rewardBarEl.y * scale, width: rewardBarEl.width * scale, height: rewardBarEl.height * scale, border: `1px dashed #FFD700`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD700', fontSize: `${Math.max(8, 10 * scale)}px` };
        return <div key={element.id} style={rewardBarStyle} title={`RewardBar: ${rewardBarEl.originalName}`} onClick={(e) => { e.stopPropagation(); onElementClick(element.id); }} aria-label={`Preview of RewardBar component ${element.originalName}`}><StarIcon className="w-4 h-4 mr-1" style={{width: `${Math.max(8,16*scale)}px`, height: `${Math.max(8,16*scale)}px`}} /> RB</div>;
    } else if (element.type === 'baseItemBox') {
        const itemBoxEl = element as ExtractedBaseItemBoxElement; const itemBoxStyle: React.CSSProperties = { ...baseStyleForPositioning, left: itemBoxEl.x * scale, top: itemBoxEl.y * scale, width: itemBoxEl.width * scale, height: itemBoxEl.height * scale };
        if (itemBoxEl.dataUrl) return <img key={element.id} src={itemBoxEl.dataUrl} alt={itemBoxEl.originalName} style={itemBoxStyle} className="object-contain" onClick={(e) => { e.stopPropagation(); onElementClick(element.id); }} aria-label={`Preview of BaseItemBox ${element.originalName}`} />;
        else { itemBoxStyle.border = `1px dashed #A3E635`; itemBoxStyle.display = 'flex'; itemBoxStyle.alignItems = 'center'; itemBoxStyle.justifyContent = 'center'; itemBoxStyle.color = '#A3E635'; itemBoxStyle.fontSize = `${Math.max(8, 10 * scale)}px`;
            return <div key={element.id} style={itemBoxStyle} title={`BaseItemBox: ${itemBoxEl.originalName}`} onClick={(e) => { e.stopPropagation(); onElementClick(element.id); }} aria-label={`Preview of BaseItemBox component ${element.originalName}`}><BaseItemBoxIcon className="w-4 h-4 mr-1" style={{width: `${Math.max(8,16*scale)}px`, height: `${Math.max(8,16*scale)}px`}} /> Item</div>; }
    }
    return null;
  };

  return (
    <div ref={containerRef} className="bg-slate-900 p-1 sm:p-2 rounded-lg shadow-inner w-full h-full flex items-center justify-center overflow-hidden" role="region" aria-label="EXML Preview Canvas">
      <div className="relative border border-slate-600" style={{ width: scaledContentWidth, height: scaledContentHeight, backgroundImage: 'repeating-conic-gradient(#D8D8D8 0% 25%, #FFFFFF 25% 50%)', backgroundPosition: '0 0', backgroundSize: '16px 16px' }} onClick={() => onElementClick('')} role="group" aria-label="Preview content area">
        {parsedData.elements.map(element => renderElement(element))}
      </div>
    </div>
  );
};

interface PreviewTabProps {
  parsedData: ParsedPsdData | null;
  psdStructureCache: PsdStructuralData | null;
  handleElementClickInPreview: (elementId: string) => void;
  selectedElementIdForPreviewHighlight: string | null;
  selectedElementIdForExmlHighlight: string | null;
  scrollableExmlPanelRef: React.RefObject<HTMLDivElement>;
  exmlLineRefs: React.MutableRefObject<Record<string, HTMLPreElement | null>>;
  getEffectiveSkinClassName: (inputName: string) => string;
  skinClassNameInput: string;
  findSelectedElementDetails: (targetId: string | null, allElements: ExtractedLayer[]) => { targetElement: ExtractedLayer; topLevelAncestor: ExtractedLayer; effectiveIndentLevel: number; } | null;
}

export const PreviewTab: React.FC<PreviewTabProps> = ({
  parsedData,
  psdStructureCache,
  handleElementClickInPreview,
  selectedElementIdForPreviewHighlight,
  selectedElementIdForExmlHighlight,
  scrollableExmlPanelRef,
  exmlLineRefs,
  getEffectiveSkinClassName,
  skinClassNameInput,
  findSelectedElementDetails
}) => {
  return (
    <div className="flex flex-col md:flex-row h-full md:space-x-4">
      <div className="flex-grow min-h-0 p-1 md:w-3/5">
        {parsedData && parsedData.width > 0 ? (
          <ExmlPreviewComponent
            parsedData={parsedData}
            psdStructureCache={psdStructureCache}
            onElementClick={handleElementClickInPreview}
            selectedElementIdForPreview={selectedElementIdForPreviewHighlight}
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
            <p className="text-xs text-slate-400 p-2 border-b border-slate-700">EXML Output (Click elements in preview to select text)</p>
            <div ref={scrollableExmlPanelRef} className="overflow-y-auto custom-scrollbar flex-grow p-2" aria-live="polite">
              <pre className="text-xs text-sky-300"><code>{'<?xml version="1.0" encoding="utf-8"?>'}</code></pre>
              <pre className="text-xs text-sky-300"><code>{`<e:Skin class="skins.${getEffectiveSkinClassName(skinClassNameInput)}" width="${Math.round(parsedData.width)}" height="${Math.round(parsedData.height)}" xmlns:e="http://ns.egret.com/eui" xmlns:w="http://ns.egret.com/wing" xmlns:ns1="*">`}</code></pre>
              {parsedData.elements.map(el => {
                const elExml = generateExmlForElement(el, 1);
                const details = findSelectedElementDetails(selectedElementIdForExmlHighlight, parsedData.elements);
                const isSelectedOrAncestorOfSelected = el.id === selectedElementIdForExmlHighlight || (details?.topLevelAncestor.id === el.id && details?.targetElement.id !== el.id);
                return (
                  <pre
                    key={el.id}
                    ref={domEl => { exmlLineRefs.current[el.id] = domEl; }}
                    className={`text-xs text-sky-300 transition-all duration-150 ease-in-out p-0.5 rounded`}
                    aria-selected={isSelectedOrAncestorOfSelected}
                  >
                    <code>{elExml}</code>
                  </pre>
                );
              })}
              <pre className="text-xs text-sky-300"><code>{`</e:Skin>`}</code></pre>
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