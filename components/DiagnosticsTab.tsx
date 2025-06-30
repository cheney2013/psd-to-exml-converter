
import React from 'react';
import { PsdParsingError } from '../types';
import { DiagnosticsIcon as NoDiagnosticsIcon } from './icons';

interface DiagnosticsTabProps {
  parsingIssues: PsdParsingError[];
}

export const DiagnosticsTab: React.FC<DiagnosticsTabProps> = ({ parsingIssues }) => {
  if (parsingIssues.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 h-full flex flex-col justify-center items-center">
        <NoDiagnosticsIcon className="w-16 h-16 mx-auto mb-4 opacity-50 text-green-400" />
        <p className="text-xl font-semibold">No parsing issues found.</p>
        <p className="text-green-300">PSD was parsed successfully by ag-psd.</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full pb-4 custom-scrollbar">
      <div className="p-4 bg-slate-700 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-red-400 mb-3">PSD Parsing Diagnostics</h3>
        <ul className="space-y-3">
          {parsingIssues.map((issue, index) => (
            <li key={index} className="p-3 bg-slate-800 border border-red-600 rounded-md">
              <p className="text-sm text-red-300 font-medium">
                <span className="font-bold">Message:</span> {issue.message}
              </p>
              {issue.layerName && (
                <p className="text-xs text-slate-400 mt-1">
                  <span className="font-semibold">Layer Path:</span> {issue.layerName}
                </p>
              )}
              {issue.errorObject && (
                <details className="mt-1 text-xs">
                  <summary className="cursor-pointer text-slate-500 hover:text-slate-400">Error Details</summary>
                  <pre className="mt-1 p-2 bg-slate-900 rounded text-slate-400 overflow-x-auto text-[10px] custom-scrollbar">
                    {JSON.stringify(issue.errorObject, null, 2)}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
