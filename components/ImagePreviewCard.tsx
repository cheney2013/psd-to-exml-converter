import React from 'react';
import { ExtractedLayer, ExtractedImageElement, ExtractedTextElement, ExtractedRectElement, ExtractedXGroupButtonElement, ExtractedGroupElement, ExtractedRewardBarElement, ExtractedSimpleButtonElement, ExtractedBaseItemBoxElement, ExtractedPanelBottomBarElement } from '../types';
import { DownloadIcon, ImageIcon as GenericImageIcon, TextIcon, InfoIcon, SquareIcon, GroupButtonIcon, FolderIcon, StarIcon, LightBulbIcon, SimpleButtonIcon, BaseItemBoxIcon, PanelBottomBarIcon } from './icons';

interface ElementPreviewCardProps {
  element: ExtractedLayer;
  onDownloadImage?: (image: ExtractedImageElement) => void;
  // NOTE: frontend no longer runs automatic OCR — state removed
}

const ElementPreviewCard: React.FC<ElementPreviewCardProps> = ({ element, onDownloadImage }) => {

  const isImageElement = (el: ExtractedLayer): el is ExtractedImageElement => el.type === 'image';
  const isTextElement = (el: ExtractedLayer): el is ExtractedTextElement => el.type === 'text';
  const isRectElement = (el: ExtractedLayer): el is ExtractedRectElement => el.type === 'rect';
  const isXGroupButtonElement = (el: ExtractedLayer): el is ExtractedXGroupButtonElement => el.type === 'xGroupButton';
  const isGroupElement = (el: ExtractedLayer): el is ExtractedGroupElement => el.type === 'group';
  const isRewardBarElement = (el: ExtractedLayer): el is ExtractedRewardBarElement => el.type === 'rewardBar';
  const isSimpleButtonElement = (el: ExtractedLayer): el is ExtractedSimpleButtonElement => el.type === 'simpleButton';
  const isBaseItemBoxElement = (el: ExtractedLayer): el is ExtractedBaseItemBoxElement => el.type === 'baseItemBox';
  const isPanelBottomBarElement = (el: ExtractedLayer): el is ExtractedPanelBottomBarElement => el.type === 'panelBottomBar';


  const formatRgbaFromHexAlpha = (hexColor: string, alpha: number): string => {
    // Expects hexColor in #RRGGBB format
    if (!hexColor || !hexColor.startsWith('#') || hexColor.length !== 7) {
      console.warn(`Invalid hex color for RGBA conversion in Preview Card: ${hexColor}`);
      return `rgba(0,0,0,${alpha.toFixed(2)})`; // Fallback
    }
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
  };

  return (
    <div className="bg-slate-700 rounded-lg shadow-lg overflow-hidden transform transition-all hover:shadow-xl hover:scale-105">
      {/* Image Preview Area */}
      {isImageElement(element) && element.dataUrl && (
        <div className="relative w-full h-40 bg-slate-600 flex items-center justify-center overflow-hidden">
          <img
            src={element.dataUrl}
            alt={element.originalName}
            className="max-w-full max-h-full object-contain"
          />
          {/* OCR overlays disabled — OCR handled by backend on demand */}
        </div>
      )}
      {isTextElement(element) && (
        <div
          className="w-full h-40 bg-slate-600 flex items-center justify-center overflow-hidden p-2"
          style={{
            fontFamily: element.fontFamily || 'sans-serif',
            fontSize: `${Math.min(element.fontSize, 32)}px`,
            color: element.textColor, // element.textColor is now #RRGGBB
            WebkitTextStroke: element.strokeSize && element.strokeColor ? `${element.strokeSize}px ${element.strokeColor}` : 'none', // element.strokeColor is now #RRGGBB
            textAlign: element.textAlign || 'left',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: element.text.length > 50 ? 3 : 5,
            WebkitBoxOrient: 'vertical',
            wordBreak: 'break-word',
          }}
          title={element.text}
        >
          {element.text}
        </div>
      )}
      {(isRectElement(element) || (isSimpleButtonElement(element) && !element.sourceName)) && (
        <div
            className="w-full h-40 bg-slate-600 flex items-center justify-center overflow-hidden p-2"
            title={isRectElement(element) ? `Solid Rectangle: ${element.fillColor} Alpha: ${element.fillAlpha.toFixed(2)}` : `Simple Button (Rect): ${element.originalName}`}
        >
            <div
                className="w-full h-full border border-slate-500"
                style={{
                    backgroundColor: isRectElement(element)
                        ? formatRgbaFromHexAlpha(element.fillColor, element.fillAlpha) // element.fillColor is now #RRGGBB
                        : `rgba(50,50,50, ${element.opacity !== undefined ? element.opacity.toFixed(2) : '1.0'})`,
                    borderRadius: isRectElement(element) && element.cornerRadius ? `${element.cornerRadius}px` : '0px'
                }}
            ></div>
        </div>
      )}
      {isXGroupButtonElement(element) && (
        <div className="w-full h-40 bg-slate-600 flex flex-col items-center justify-center overflow-hidden p-2 text-slate-300">
          <GroupButtonIcon className="w-12 h-12 text-cyan-400 mb-2" />
          <p className="font-semibold text-sm">Group Button</p>
          <p className="text-xs">({element.children.length} children)</p>
        </div>
      )}
      {isGroupElement(element) && (
        <div className="w-full h-40 bg-slate-600 flex flex-col items-center justify-center overflow-hidden p-2 text-slate-300">
          <FolderIcon className="w-12 h-12 text-yellow-400 mb-2" />
          <p className="font-semibold text-sm">Group</p>
          <p className="text-xs">({element.children.length} children)</p>
        </div>
      )}
      {isRewardBarElement(element) && (
        <div className="w-full h-40 bg-slate-600 flex flex-col items-center justify-center overflow-hidden p-2 text-slate-300">
          <StarIcon className="w-12 h-12 text-amber-400 mb-2" />
          <p className="font-semibold text-sm">RewardBar</p>
          <p className="text-xs">(Custom Component)</p>
        </div>
      )}
      {isBaseItemBoxElement(element) && (
        <div className="w-full h-40 bg-slate-600 flex flex-col items-center justify-center overflow-hidden p-2 text-slate-300">
          <BaseItemBoxIcon className="w-12 h-12 text-lime-400 mb-2" />
          <p className="font-semibold text-sm">BaseItemBox</p>
          <p className="text-xs">(Custom Component)</p>
        </div>
      )}
      {isPanelBottomBarElement(element) && (
        <div className="w-full h-40 bg-slate-600 flex flex-col items-center justify-center overflow-hidden p-2 text-slate-300">
          <PanelBottomBarIcon className="w-12 h-12 text-slate-400 mb-2" />
          <p className="font-semibold text-sm">PanelBottomBar</p>
          <p className="text-xs">(Custom Component)</p>
        </div>
      )}


      <div className="p-4">
        <div className="flex items-center mb-1">
          {isImageElement(element) && <GenericImageIcon className="w-4 h-4 mr-2 text-sky-400"/>}
          {isTextElement(element) && <TextIcon className="w-4 h-4 mr-2 text-emerald-400"/>}
          {isRectElement(element) && <SquareIcon className="w-4 h-4 mr-2 text-purple-400"/>}
          {isXGroupButtonElement(element) && <GroupButtonIcon className="w-4 h-4 mr-2 text-cyan-400"/>}
          {isGroupElement(element) && <FolderIcon className="w-4 h-4 mr-2 text-yellow-400"/>}
          {isRewardBarElement(element) && <StarIcon className="w-4 h-4 mr-2 text-amber-400"/>}
          {isSimpleButtonElement(element) && <SimpleButtonIcon className="w-4 h-4 mr-2 text-orange-400"/>}
          {isBaseItemBoxElement(element) && <BaseItemBoxIcon className="w-4 h-4 mr-2 text-lime-400"/>}
          {isPanelBottomBarElement(element) && <PanelBottomBarIcon className="w-4 h-4 mr-2 text-slate-400"/>}

          <h3 className="font-semibold text-sm text-slate-200 truncate" title={element.originalName}>
            {element.originalName}
          </h3>
        </div>

        <p className="text-xs text-slate-400">
          {Math.round(element.width)}x{Math.round(element.height)}px @ ({Math.round(element.x)},{Math.round(element.y)})
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          ID: <span className="font-mono">
            {element.name}
            {isSimpleButtonElement(element) && element.sourceName && ` (Button source: ${element.sourceName})`}
          </span>
        </p>


        {isTextElement(element) && (
          <div className="mt-1">
            <p className="text-xs text-slate-400">Font: {element.fontSize}px {element.fontFamily}</p>
            <p className="text-xs text-slate-400">Color: {element.textColor}
            {element.strokeSize && <span>, Stroke: {element.strokeSize}px {element.strokeColor}</span>}
            </p>
            {element.textAlign && <p className="text-xs text-slate-400">Align: {element.textAlign}</p>}
            {element.isRichText && <p className="text-xs text-amber-400 mt-0.5">Rich text detected</p>}
          </div>
        )}

        {isRectElement(element) && (
            <div className="mt-1">
                <p className="text-xs text-slate-400">Fill: {element.fillColor} (Alpha: {element.fillAlpha.toFixed(2)})</p>
                {element.cornerRadius && <p className="text-xs text-slate-400">Corner Radius: {element.cornerRadius}px</p>}
            </div>
        )}

        {isImageElement(element) && element.rasterizationReason && element.rasterizationReason.toLowerCase().startsWith("text layer rasterized") && (
          <div className="mt-2 p-2 bg-yellow-700 bg-opacity-30 border border-yellow-600 rounded">
            <div className="flex items-start">
              <InfoIcon className="w-4 h-4 mr-1.5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-300">
                <span className="font-semibold">Note:</span> {element.rasterizationReason}
              </p>
            </div>
          </div>
        )}

        {isImageElement(element) && element.hadEffectsOriginally && (
          <div className="mt-2 p-2 bg-sky-700 bg-opacity-30 border border-sky-600 rounded">
            <div className="flex items-start">
              <LightBulbIcon className="w-4 h-4 mr-1.5 text-sky-300 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-sky-200">
                <span className="font-semibold">Suggestion:</span> 为了更好的还原PS中的效果，请手动在PS中栅格化
              </p>
            </div>
          </div>
        )}


        <div className="mt-3 flex space-x-2">
          {isImageElement(element) && onDownloadImage && (
            <button
              onClick={() => onDownloadImage(element as ExtractedImageElement)} // Cast element to ExtractedImageElement for the callback
              className="flex-1 inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <DownloadIcon className="w-4 h-4 mr-1.5" />
              PNG
            </button>
          )}
           {isTextElement(element) && (
             <div className="flex-1 text-center text-xs text-slate-500 italic py-1.5">
               Text Layer (e:Label)
             </div>
           )}
           {isRectElement(element) && (
             <div className="flex-1 text-center text-xs text-slate-500 italic py-1.5">
               Solid Rectangle (e:Rect)
             </div>
           )}
           {isXGroupButtonElement(element) && (
             <div className="flex-1 text-center text-xs text-slate-500 italic py-1.5">
               Group Button (ns1:XGroupButton)
             </div>
           )}
           {isGroupElement(element) && (
             <div className="flex-1 text-center text-xs text-slate-500 italic py-1.5">
               Group (e:Group)
             </div>
           )}
           {isRewardBarElement(element) && (
             <div className="flex-1 text-center text-xs text-slate-500 italic py-1.5">
               Custom (ns1:RewardBar)
             </div>
           )}
           {isSimpleButtonElement(element) && (
             <div className="flex-1 text-center text-xs text-slate-500 italic py-1.5">
                {element.sourceName ? `Simple Button (Image-based)` : `Simple Button (Rect-based)`}
             </div>
           )}
           {isBaseItemBoxElement(element) && (
             <div className="flex-1 text-center text-xs text-slate-500 italic py-1.5">
               Custom (ns1:BaseItemBox)
             </div>
           )}
           {isPanelBottomBarElement(element) && (
             <div className="flex-1 text-center text-xs text-slate-500 italic py-1.5">
               Custom (ns1:PanelBottomBar)
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default ElementPreviewCard;