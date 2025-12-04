import React from 'react';
import { ParsedPsdData, PsdStructuralData, ExtractedLayer, ExtractedTextElement, PsdLayer, AgPsdObject, RichTextNotification } from '../types';
import { agPsdColorToHex } from '../services/psdProcessor';
import { InfoIcon, ClipboardDocumentIcon, TextIcon as NoRichTextIcon } from './icons'; // Changed from RichTextIcon

const hasChildren = (el: ExtractedLayer): el is (ExtractedLayer & { children: ExtractedLayer[] }) => {
  return ('children' in el) && Array.isArray((el as any).children);
};

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

interface RichTextInfoTabProps {
  parsedData: ParsedPsdData;
  psdStructureCache: PsdStructuralData | null;
  isLoading: boolean;
  handleCopyHtmlTextFlow: (note: RichTextNotification, index: number) => void;
  copiedTextFlowId: string | null;
}

export const RichTextInfoTab: React.FC<RichTextInfoTabProps> = ({
  parsedData,
  psdStructureCache,
  isLoading,
  handleCopyHtmlTextFlow,
  copiedTextFlowId,
}) => {
  if (!parsedData || parsedData.richTextNotifications.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 h-full flex flex-col justify-center items-center">
        <NoRichTextIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-xl font-semibold">No rich text notifications.</p>
        <p>Text layers with multiple styles will be flagged here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full pb-4 custom-scrollbar">
      <div className="p-4 bg-slate-700 rounded-lg shadow">
        <ul className="space-y-4">
          {parsedData.richTextNotifications.map((note, index) => {
            const findLayerInTreeRT = (layers: PsdLayer[], name: string): PsdLayer | undefined => {
                for (const layer of layers) { if (layer.name === name) return layer; if (layer.children) { const found = findLayerInTreeRT(layer.children, name); if (found) return found; } } return undefined;
            };
            const originalLayer = psdStructureCache ? findLayerInTreeRT(psdStructureCache.allLayers, note.layerName) : undefined;
            const findExtractedTextElementRT = (elements: ExtractedLayer[], originalName: string): ExtractedTextElement | undefined => {
                for (const el of elements) { if (el.type === 'text' && el.originalName === originalName) return el as ExtractedTextElement; if (hasChildren(el)) { const foundInChild = findExtractedTextElementRT(el.children, originalName); if (foundInChild) return foundInChild; } } return undefined;
            };
            const textElement = parsedData ? findExtractedTextElementRT(parsedData.elements, note.layerName) : undefined;
            let styledTextPreview: React.ReactNode = note.text;
            const targetPreviewPrimaryFontSize = 14; const minPreviewFontSize = 4;

            if (textElement?.isRichText && originalLayer?.text && originalLayer.text.styleRuns && psdStructureCache?.psd) {
              const styleRuns = originalLayer.text.styleRuns; const overallStyleFromPsd = originalLayer.text.style; let currentOffset = 0;
              const psdPrimaryFontSizeForElement = textElement?.fontSize || (psdStructureCache?.psd ? calculatePixelFontSize(overallStyleFromPsd?.fontSize, psdStructureCache.psd.imageResources, originalLayer.text?.transform) : 12) || 12;
              const previewScaleRatio = psdPrimaryFontSizeForElement > 0 ? targetPreviewPrimaryFontSize / psdPrimaryFontSizeForElement : 1;
              if (styleRuns && styleRuns.length > 0) {
                styledTextPreview = styleRuns.map((run, runIndex) => {
                  const segment = note.text.substring(currentOffset, currentOffset + run.length); currentOffset += run.length;
                  const runStyleFromPsd = run.style || {};
                  let runFontSizeInPoints = runStyleFromPsd.fontSize ?? overallStyleFromPsd?.fontSize ?? 12;
                  let runFontSizePx = calculatePixelFontSize(runFontSizeInPoints, psdStructureCache!.psd.imageResources, originalLayer.text?.transform) || psdPrimaryFontSizeForElement;
                  let scaledPreviewFontSize = Math.max(minPreviewFontSize, runFontSizePx * previewScaleRatio);
                  let color = textElement?.textColor || '#FFFFFF';
                  if (runStyleFromPsd.fillColor) color = agPsdColorToHex(runStyleFromPsd.fillColor); else if (overallStyleFromPsd?.fillColor) color = agPsdColorToHex(overallStyleFromPsd.fillColor);
                  const fontFamily = runStyleFromPsd.font?.name || overallStyleFromPsd?.font?.name || textElement?.fontFamily || 'Arial';
                  let finalLineHeightStyle: string | number = 'normal';
                  if (note.text.includes('\n')) {
                    let runLeadingPt: number | undefined = runStyleFromPsd.leading ?? overallStyleFromPsd?.leading; let runAutoLeading: boolean = overallStyleFromPsd?.autoLeading ?? true;
                    if (runStyleFromPsd.leading !== undefined) runAutoLeading = false;
                    if (runAutoLeading === false && typeof runLeadingPt === 'number' && runLeadingPt > 0) { const leadingPx = calculatePixelFontSize(runLeadingPt, psdStructureCache!.psd.imageResources, originalLayer.text?.transform); finalLineHeightStyle = `${Math.max(1, leadingPx * previewScaleRatio)}px`; }
                    else finalLineHeightStyle = `${scaledPreviewFontSize * 1.4}px`;
                  }
                  const lines = segment.split('\n');
                  return lines.map((line, lineIdx, lineArr) => <React.Fragment key={`${runIndex}-line-${lineIdx}`}><span style={{ fontSize: `${scaledPreviewFontSize}px`, color, fontFamily, lineHeight: finalLineHeightStyle }}>{line}</span>{lineIdx < lineArr.length - 1 && <br />}</React.Fragment>);
                });
              }
            } else if (textElement || originalLayer?.text) {
                let psdFontSizePx = textElement?.fontSize || (psdStructureCache?.psd ? calculatePixelFontSize(originalLayer?.text?.style?.fontSize, psdStructureCache.psd.imageResources, originalLayer?.text?.transform) : 12) || 12;
                const psdPrimaryFontSizeForElement = psdFontSizePx; const previewScaleRatio = psdPrimaryFontSizeForElement > 0 ? targetPreviewPrimaryFontSize / psdPrimaryFontSizeForElement : 1;
                let scaledPreviewFontSize = Math.max(minPreviewFontSize, psdFontSizePx * previewScaleRatio);
                let color = textElement?.textColor || (originalLayer?.text?.style?.fillColor ? agPsdColorToHex(originalLayer.text.style.fillColor) : '#FFFFFF');
                const fontFamily = originalLayer?.text?.style?.font?.name || textElement?.fontFamily || 'Arial';
                let finalLineHeightStyle: string | number = 'normal';
                if (note.text.includes('\n')) { if (textElement?.lineSpacing !== undefined) finalLineHeightStyle = `${(psdFontSizePx + textElement.lineSpacing) * previewScaleRatio}px`; else finalLineHeightStyle = `${scaledPreviewFontSize * 1.4}px`; }
                const lines = note.text.split('\n');
                styledTextPreview = lines.map((line, lineIdx, lineArr) => <React.Fragment key={`plain-${index}-line-${lineIdx}`}><span style={{ fontSize: `${scaledPreviewFontSize}px`, color, fontFamily, lineHeight: finalLineHeightStyle }}>{line}</span>{lineIdx < lineArr.length - 1 && <br />}</React.Fragment>);
            }

            return (
              <li key={index} className="bg-slate-700 p-3 rounded-lg shadow">
                <div className="flex items-start mb-1.5"><InfoIcon className="w-4 h-4 mr-2 text-amber-400 flex-shrink-0 mt-0.5" /><div><p className="text-sm text-slate-200">Layer: <span className="font-semibold">{note.layerName}</span></p><p className="text-xs text-amber-300">{note.message}</p></div></div>
                <div className="p-3 bg-slate-800 rounded mb-2 border border-slate-600 shadow-sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '120px', overflowY: 'auto' }} aria-label={`Rich text preview for ${note.layerName}`}>{styledTextPreview}</div>
                <button onClick={() => handleCopyHtmlTextFlow(note, index)} disabled={isLoading} title={copiedTextFlowId === `textflow_${index}` ? "Copied!" : "Copy HTML textFlow for EXML Label"}
                  className={`w-full p-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center ${copiedTextFlowId === `textflow_${index}` ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-sky-600 hover:bg-sky-700 text-white'} disabled:opacity-50`}>
                  <ClipboardDocumentIcon className="w-4 h-4 mr-1.5"/>Copy HTML textFlow
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};