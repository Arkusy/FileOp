import React, { useState } from 'react';
import { SlidersHorizontal, ChevronDown, Check } from 'lucide-react';

interface ConversionSettingsProps {
  maxKb: number | undefined;
  onMaxKbChange: (val: number | undefined) => void;
  maxDimension: number | undefined;
  onMaxDimensionChange: (val: number | undefined) => void;
  mergeToPdf: boolean;
  onMergeToPdfChange: (val: boolean) => void;
  hasImages: boolean;
}

export const ConversionSettings: React.FC<ConversionSettingsProps> = ({
  maxKb,
  onMaxKbChange,
  maxDimension,
  onMaxDimensionChange,
  mergeToPdf,
  onMergeToPdfChange,
  hasImages,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden mb-5 transition-all shadow-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 sm:px-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal className="w-4 h-4 text-rose-500" />
          <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
            Advanced Conversion Settings
          </span>
          {(maxKb || maxDimension || mergeToPdf) && (
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <span>{isOpen ? 'Hide' : 'Configure'}</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="p-4 sm:p-5 pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in duration-150">
          {/* Max Size Target */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Target Max Size (KB)
            </label>
            <input
              type="number"
              min={5}
              placeholder="e.g. 200"
              value={maxKb || ''}
              onChange={(e) =>
                onMaxKbChange(e.target.value ? Number(e.target.value) : undefined)
              }
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Iterative compression for JPG, PNG & WEBP
            </span>
          </div>

          {/* Max Dimension */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Max Width/Height (px)
            </label>
            <input
              type="number"
              min={16}
              placeholder="e.g. 1920"
              value={maxDimension || ''}
              onChange={(e) =>
                onMaxDimensionChange(e.target.value ? Number(e.target.value) : undefined)
              }
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Downscales oversized images proportionally
            </span>
          </div>

          {/* Merge to PDF Checkbox */}
          <div className="flex flex-col justify-center">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Multi-page PDF
            </label>
            <button
              type="button"
              disabled={!hasImages}
              onClick={() => onMergeToPdfChange(!mergeToPdf)}
              className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                mergeToPdf
                  ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-semibold'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
              } ${!hasImages ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div
                className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                  mergeToPdf
                    ? 'bg-rose-500 border-rose-500 text-white'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {mergeToPdf && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <span className="truncate">Merge images into 1 PDF</span>
            </button>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Combines multiple images into pages
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
