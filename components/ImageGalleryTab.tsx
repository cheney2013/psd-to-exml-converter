
import React from 'react';
import ElementPreviewCard from './ImagePreviewCard';
import { ImageTabDisplayItem } from '../App';
import { ImageIcon as NoImagesIcon } from './icons'; // Renamed for clarity

interface ImageGalleryTabProps {
  imageElementsToDisplay: ImageTabDisplayItem[];
  isLoading: boolean;
  handleDownloadImage: (imageName: string, dataUrl: string) => void;
  // (removed) frontend no longer tracks OCR status — backend-only OCR
}

export const ImageGalleryTab: React.FC<ImageGalleryTabProps> = ({
  imageElementsToDisplay,
  isLoading,
  handleDownloadImage,
}) => {
  return (
    <div className="overflow-y-auto h-full pb-4">
      {imageElementsToDisplay.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {imageElementsToDisplay.map((item) => (
              <ElementPreviewCard
              key={item.id + (item.isFromSimpleButton ? '_sbi_asset' : (item.isFromBaseItemBox ? '_bib_asset' : '_img_asset'))}
              element={item}
              onDownloadImage={!isLoading && item.type === 'image' ? () => handleDownloadImage(item.name, item.dataUrl) : undefined}
              
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400 h-full flex flex-col justify-center items-center">
          <NoImagesIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-xl font-semibold">No images found.</p>
          <p>Upload a PSD file with image layers, image-based simple buttons, or layers that get rasterized.</p>
        </div>
      )}
    </div>
  );
};
