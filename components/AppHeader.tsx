
import React from 'react';
import FileUploader from './FileUploader';
import { PsdStructuralData } from '../types';

interface AppHeaderProps {
  imagePrefix: string;
  setImagePrefix: (prefix: string) => void;
  skinClassNameInput: string;
  setSkinClassNameInput: (name: string) => void;
  handleFileAccepted: (file: File) => void;
  isLoading: boolean;
  psdStructureCache: PsdStructuralData | null;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  imagePrefix,
  setImagePrefix,
  skinClassNameInput,
  setSkinClassNameInput,
  handleFileAccepted,
  isLoading,
  psdStructureCache,
}) => {
  return (
    <>
      <header className="mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-400 to-cyan-400">
          PSD to Egret EXML Converter
        </h1>
        <p className="mt-3 text-lg text-slate-400 max-w-2xl mx-auto">
          Upload PSD to extract images & text layers, generate EXML, and preview the layout.
        </p>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor="imagePrefix" className="block text-sm font-medium text-slate-300 mb-0.5">
            Image Resource Prefix (optional):
          </label>
          <input
            type="text"
            id="imagePrefix"
            value={imagePrefix}
            onChange={(e) => setImagePrefix(e.target.value)}
            placeholder="e.g., mygame_assets"
            className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-slate-100 placeholder-slate-500"
          />
        </div>
        <div>
          <label htmlFor="skinClassName" className="block text-sm font-medium text-slate-300 mb-0.5">
            EXML Skin Class Name (e.g., MyPsd):
          </label>
          <input
            type="text"
            id="skinClassName"
            value={skinClassNameInput}
            onChange={(e) => setSkinClassNameInput(e.target.value)}
            placeholder="MyPsd"
            className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-slate-100 placeholder-slate-500"
          />
        </div>
      </div>
      <FileUploader
        onFileAccepted={handleFileAccepted}
        isLoading={isLoading && !psdStructureCache}
      />
    </>
  );
};
