import React from 'react';
import { ParsedPsdData, PsdParsingError } from '../types';
import { ImageTabDisplayItem } from '../App';
import { DownloadIcon, ImageIcon, CodeIcon, EyeIcon, TextIcon, DiagnosticsIcon, RefreshIcon } from './icons';

interface TabButtonProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  count?: number;
  title?: string;
}

const TabButton: React.FC<TabButtonProps> = ({ label, icon, isActive, onClick, count, title }) => (
  <button
    onClick={onClick}
    title={title || label}
    aria-label={label}
    aria-pressed={isActive}
    className={`flex items-center justify-center px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md transition-colors
      ${isActive
        ? 'bg-blue-600 text-white shadow-md'
        : 'text-slate-300 hover:bg-slate-600 hover:text-slate-100'
      }`}
  >
    {icon}
    <span className="ml-1 sm:ml-2">{label}</span>
    {typeof count !== 'undefined' && (
      <span className={`ml-2 px-1.5 py-0.5 sm:px-2 rounded-full text-xs font-semibold ${isActive ? 'bg-blue-400 text-white' : 'bg-slate-500 text-slate-200'}`}>
        {count}
      </span>
    )}
  </button>
);

interface ActionButtonProps {
    title: string;
    icon: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    className?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ title, icon, onClick, disabled, className }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`p-2.5 rounded-lg shadow-md transition-colors disabled:opacity-50 flex items-center justify-center text-white ${className || ''}`}
    >
      {icon}
    </button>
);

interface TabNavigationProps {
  activeTab: 'images' | 'code' | 'preview' | 'richTextInfo' | 'diagnostics';
  setActiveTab: (tab: 'images' | 'code' | 'preview' | 'richTextInfo' | 'diagnostics') => void;
  parsedData: ParsedPsdData | null;
  parsingIssues: PsdParsingError[];
  imageElementsToDisplay: ImageTabDisplayItem[];
  handleDownloadAllImages: () => void;
  isLoading: boolean;
  handleReprocessPsd: () => void;
  psdFile: File | null;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  setActiveTab,
  parsedData,
  parsingIssues,
  imageElementsToDisplay,
  handleDownloadAllImages,
  isLoading,
  handleReprocessPsd,
  psdFile
}) => {
  return (
    <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
      <div className="flex flex-wrap space-x-1 sm:space-x-2 bg-slate-700 p-1 rounded-lg shadow mb-4 sm:mb-0" role="tablist" aria-label="Application sections">
        <TabButton
          label="Images"
          icon={<ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
          isActive={activeTab === 'images'}
          onClick={() => setActiveTab('images')}
          count={imageElementsToDisplay.length}
        />
        <TabButton
          label="Code"
          icon={<CodeIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
          isActive={activeTab === 'code'}
          onClick={() => setActiveTab('code')}
        />
        <TabButton
          label="Preview"
          icon={<EyeIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
          isActive={activeTab === 'preview'}
          onClick={() => setActiveTab('preview')}
        />
        {parsedData && parsedData.richTextNotifications.length > 0 && (
          <TabButton
            label="Rich Text"
            title="Rich Text Info"
            icon={<TextIcon className="w-4 h-4 sm:w-5 sm:h-5" />} // Changed from RichTextIcon
            isActive={activeTab === 'richTextInfo'}
            onClick={() => setActiveTab('richTextInfo')}
            count={parsedData.richTextNotifications.length}
          />
        )}
        {parsingIssues.length > 0 && (
          <TabButton
            label="Diagnostics"
            title="PSD Parsing Issues"
            icon={<DiagnosticsIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
            isActive={activeTab === 'diagnostics'}
            onClick={() => setActiveTab('diagnostics')}
            count={parsingIssues.length}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {activeTab === 'images' && imageElementsToDisplay.length > 0 && (
          <ActionButton
            onClick={handleDownloadAllImages}
            disabled={isLoading}
            title="Download all images"
            icon={<DownloadIcon className="w-5 h-5" />}
            className="bg-teal-600 hover:bg-teal-700"
          />
        )}
        {activeTab === 'preview' && (
          <ActionButton
            onClick={handleReprocessPsd}
            disabled={isLoading || !psdFile}
            title="Refresh Preview"
            icon={<RefreshIcon className="w-5 h-5" />}
            className="bg-emerald-600 hover:bg-emerald-700"
          />
        )}
      </div>
    </div>
  );
};