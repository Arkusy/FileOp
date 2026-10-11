import React, { useRef, useState } from 'react';
import { UploadCloud, FolderOpen, Files } from 'lucide-react';
import { SupportedSourceFormat } from '../types/converter';

interface DropZoneProps {
  onAddFiles: (files: File[]) => void;
  sourceFormat: SupportedSourceFormat;
  disabled?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onAddFiles,
  sourceFormat,
  disabled = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const getAcceptExtensions = (): string => {
    if (sourceFormat === 'any') return '';
    if (sourceFormat === 'jpg' || sourceFormat === 'jpeg') return '.jpg,.jpeg';
    return `.${sourceFormat}`;
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`relative w-full rounded-3xl border-2 border-dashed p-8 sm:p-10 text-center transition-all duration-200 cursor-pointer ${
        isDragOver
          ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/20 scale-[1.01] shadow-xl'
          : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:border-rose-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-900 shadow-sm'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={getAcceptExtensions()}
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex flex-col items-center justify-center pointer-events-none">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-200 mb-4 ${
            isDragOver
              ? 'bg-rose-500 text-white scale-110 shadow-lg shadow-rose-500/25'
              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-500 dark:text-rose-400 group-hover:scale-105'
          }`}
        >
          <UploadCloud className="w-8 h-8 stroke-[2.2]" />
        </div>

        <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Drop your {sourceFormat === 'any' ? 'files' : sourceFormat.toUpperCase()} here, or browse
        </h3>

        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-1">
          Supports batch conversion of images, vectors, PDFs, and documents directly in browser
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-500/25 flex items-center gap-2 transition-all cursor-pointer pointer-events-auto active:scale-95"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Select Files</span>
          </button>

          <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 rounded-xl bg-slate-100 dark:bg-slate-800">
            <Files className="w-3.5 h-3.5" />
            <span>Batch Upload Supported</span>
          </div>
        </div>
      </div>
    </div>
  );
};
