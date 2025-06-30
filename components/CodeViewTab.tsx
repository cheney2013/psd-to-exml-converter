
import React from 'react';
import { ParentClassType } from '../services/typeScriptGenerator';
import { DownloadIcon, FolderIcon, ClipboardDocumentIcon, CogIcon, CodeIcon as NoCodeIcon } from './icons';

interface ActionButtonProps {
    title: string;
    icon: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    isCopied?: boolean;
    className?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ title, icon, onClick, disabled, isCopied, className }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={isCopied ? `${title} Copied!` : title}
      aria-label={isCopied ? `${title} Copied!` : title}
      className={`p-1.5 sm:p-2 rounded-md shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center 
                  ${isCopied ? 'bg-green-500 hover:bg-green-600' : 'bg-sky-600 hover:bg-sky-700'} 
                  text-white text-xs ${className || ''}`}
    >
      {icon}
      <span className="ml-1 hidden sm:inline">{isCopied ? "Copied!" : title.split(" ")[0]}</span> {/* Show first word or "Copied!" */}
    </button>
  );

interface CodeViewTabProps {
  generatedExml: string;
  generatedTypeScript: string;
  isLoading: boolean;
  selectedParentClass: ParentClassType;
  setSelectedParentClass: (type: ParentClassType) => void;
  handleDownloadExml: () => void;
  handleDownloadTypeScript: () => void;
  handleCopyExml: () => void;
  handleCopyExmlAsGroup: () => void;
  handleCopyTypeScript: () => void;
  exmlCopied: boolean;
  exmlGroupCopied: boolean;
  tsCopied: boolean;
}

export const CodeViewTab: React.FC<CodeViewTabProps> = ({
  generatedExml,
  generatedTypeScript,
  isLoading,
  selectedParentClass,
  setSelectedParentClass,
  handleDownloadExml,
  handleDownloadTypeScript,
  handleCopyExml,
  handleCopyExmlAsGroup,
  handleCopyTypeScript,
  exmlCopied,
  exmlGroupCopied,
  tsCopied,
}) => {
  return (
    <div className="h-full flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
      {generatedExml ? (
        <div className="bg-slate-900 rounded-lg shadow-inner flex flex-col flex-grow min-h-0 md:flex-1 md:min-w-0">
          <div className="p-2 border-b border-slate-700 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-slate-300">Generated EXML</h3>
            <div className="flex space-x-2">
                <ActionButton
                    onClick={handleDownloadExml}
                    disabled={isLoading || !generatedExml}
                    title="Download EXML"
                    icon={<DownloadIcon className="w-4 h-4" />}
                    className="bg-teal-600 hover:bg-teal-700"
                />
                <ActionButton
                    onClick={handleCopyExml}
                    disabled={isLoading || !generatedExml}
                    title="Copy EXML"
                    isCopied={exmlCopied}
                    icon={<ClipboardDocumentIcon className="w-4 h-4"/>}
                    className={exmlCopied ? 'bg-green-500 hover:bg-green-600' : 'bg-purple-600 hover:bg-purple-700'}
                />
                <ActionButton
                    onClick={handleCopyExmlAsGroup}
                    disabled={isLoading || !generatedExml}
                    title="Copy as Group"
                    isCopied={exmlGroupCopied}
                    icon={<FolderIcon className="w-4 h-4"/>}
                    className={exmlGroupCopied ? 'bg-green-500 hover:bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'}
                />
            </div>
          </div>
          <pre className="p-4 md:p-6 text-sm text-sky-300 overflow-auto flex-grow custom-scrollbar" aria-label="Generated EXML code">
            <code>{generatedExml}</code>
          </pre>
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400 h-full flex flex-col justify-center items-center md:flex-1">
          <NoCodeIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-xl font-semibold">No EXML generated.</p>
          <p>Upload a PSD file. If it contains only text layers, they will be converted to EXML Labels.</p>
        </div>
      )}

      {generatedTypeScript && (
        <div className="bg-slate-900 rounded-lg shadow-inner flex flex-col min-h-0 md:flex-1 md:min-w-0">
          <div className="p-2 border-b border-slate-700 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <CogIcon className="w-5 h-5 text-slate-400" />
              <label htmlFor="tsParentClass" className="text-sm font-semibold text-slate-300 whitespace-nowrap">TS Class (Parent:</label>
              <select
                id="tsParentClass"
                value={selectedParentClass}
                onChange={(e) => setSelectedParentClass(e.target.value as ParentClassType)}
                className="bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded p-0.5 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Select or confirm TypeScript parent class. This may be auto-detected based on skin name."
              >
                <option value="BasePage">BasePage</option>
                <option value="XNormalPanel">XNormalPanel</option>
                <option value="XFullScreenPanel">XFullScreenPanel</option>
              </select>
              <span className="text-sm font-semibold text-slate-300">)</span>
            </div>
            <div className="flex space-x-2">
                <ActionButton
                    onClick={handleDownloadTypeScript}
                    disabled={isLoading || !generatedTypeScript}
                    title="Download TS"
                    icon={<DownloadIcon className="w-4 h-4" />}
                    className="bg-teal-600 hover:bg-teal-700"
                />
                <ActionButton
                    onClick={handleCopyTypeScript}
                    disabled={isLoading || !generatedTypeScript}
                    title="Copy TS"
                    isCopied={tsCopied}
                    icon={<ClipboardDocumentIcon className="w-4 h-4" />}
                    className={tsCopied ? 'bg-green-500 hover:bg-green-600' : 'bg-lime-600 hover:bg-lime-700'} // Changed color for distinction
                 />
            </div>
          </div>
          <pre className="p-2 md:p-3 text-xs text-lime-300 overflow-auto flex-grow custom-scrollbar" aria-label="Generated TypeScript code">
            <code>{generatedTypeScript}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
