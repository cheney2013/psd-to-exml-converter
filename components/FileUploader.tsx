
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { PsdFileIcon, UploadIcon } from './icons';

interface FileUploaderProps {
  onFileAccepted: (file: File) => void;
  isLoading: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileAccepted, isLoading }) => {
  const [fileName, setFileName] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.name.toLowerCase().endsWith('.psd')) {
        setFileName(file.name);
        onFileAccepted(file);
      } else {
        alert("Please upload a valid .psd file.");
        if (fileName) setFileName(null); 
      }
    }
  }, [onFileAccepted, fileName]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/vnd.adobe.photoshop': ['.psd'] },
    multiple: false,
    disabled: isLoading,
    noClick: false, 
    noKeyboard: false, 
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg text-center cursor-pointer transition-all duration-300 ease-in-out
        ${fileName && !isLoading ? 'p-3' : 'p-8'}
        ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input {...getInputProps()} />
      <div className={`flex items-center justify-center text-gray-600 ${fileName && !isLoading ? 'flex-row space-x-3' : 'flex-col'}`}>
        {fileName && !isLoading ? (
          <>
            <PsdFileIcon className="w-10 h-10 text-blue-500 flex-shrink-0" />
            <div className="text-left">
              <p className="font-semibold text-md text-slate-200 truncate" title={fileName}>{fileName}</p>
              <p className="text-xs text-slate-400 mt-0.5">Click to replace or drop new PSD.</p>
            </div>
          </>
        ) : (
          <>
            <UploadIcon className="w-12 h-12 text-gray-400 mb-3" />
            {isDragActive ? (
              <p className="text-lg font-semibold text-slate-300">Drop the PSD file here...</p>
            ) : (
              <>
                <p className="text-lg font-semibold text-slate-300">Drag & drop a .PSD file here, or click to select</p>
                <p className="text-sm text-gray-500 mt-1">Adobe Photoshop Document</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FileUploader;
