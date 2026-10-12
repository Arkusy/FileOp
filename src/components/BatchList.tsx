import React from 'react';
import {
  FileItem,
  SupportedTargetFormat,
  CropArea,
  VideoConversionOptions,
} from '../types/converter';
import { formatBytes, TARGET_FORMATS_BY_SOURCE } from '../utils/fileConversion';
import {
  Crop,
  Trash2,
  Download,
  AlertCircle,
  FileCheck,
  Archive,
  RefreshCw,
  SlidersHorizontal,
  Subtitles,
} from 'lucide-react';

interface BatchListProps {
  items: FileItem[];
  onUpdateTargetFormat: (id: string, format: SupportedTargetFormat) => void;
  onRemoveItem: (id: string) => void;
  onOpenCrop: (item: FileItem) => void;
  onOpenVideoSettings?: (item: FileItem) => void;
  onOpenSubtitles?: (item: FileItem) => void;
  onConvertAll: () => void;
  onDownloadAllZip: () => void;
  onClearAll: () => void;
  isConverting: boolean;
}

const RASTER_FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];
const VIDEO_FORMATS = ['mp4', 'webm', 'mov', 'mkv', 'avi', '3gp'];

export const BatchList: React.FC<BatchListProps> = ({
  items,
  onUpdateTargetFormat,
  onRemoveItem,
  onOpenCrop,
  onOpenVideoSettings,
  onOpenSubtitles,
  onConvertAll,
  onDownloadAllZip,
  onClearAll,
  isConverting,
}) => {
  if (items.length === 0) return null;

  const totalCompletedOutputs = items.reduce(
    (acc, it) => acc + (it.outputs ? it.outputs.length : 0),
    0
  );

  return (
    <div className="w-full space-y-4 my-6">
      {/* List Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Files in Queue ({items.length})
          </h3>
          <span className="text-xs text-slate-400">
            Total {formatBytes(items.reduce((s, it) => s + it.size, 0))}
          </span>
        </div>

        <button
          type="button"
          onClick={onClearAll}
          disabled={isConverting}
          className="text-xs font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
        >
          Clear list
        </button>
      </div>

      {/* Items List */}
      <div className="space-y-2.5">
        {items.map((item) => {
          const validTargets = TARGET_FORMATS_BY_SOURCE[item.sourceExt] || [
            'png',
            'jpg',
            'webp',
            'pdf',
          ];
          const isImage = RASTER_FORMATS.includes(item.sourceExt);
          const isVideo = VIDEO_FORMATS.includes(item.sourceExt);

          return (
            <div
              key={item.id}
              className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                item.status === 'error'
                  ? 'border-rose-300 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20'
                  : item.status === 'completed'
                  ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* File info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-rose-500 text-white font-extrabold text-xs uppercase flex items-center justify-center shrink-0 shadow-xs">
                    {item.sourceExt}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[180px] xs:max-w-[240px] sm:max-w-xs md:max-w-md">
                        {item.name}
                      </p>
                      {item.crop && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 shrink-0">
                          Cropped
                        </span>
                      )}
                      {isVideo && item.videoOptions && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 shrink-0">
                          {item.videoOptions.resolution} · {item.videoOptions.quality}
                          {item.videoOptions.mute ? ' · Muted' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{formatBytes(item.size)}</span>
                      {item.errorMsg && (
                        <span className="text-rose-500 font-medium truncate">
                          • {item.errorMsg}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Format selector & actions */}
                <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                  {/* Target format select */}
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                      TO:
                    </span>
                    <select
                      value={item.targetExt}
                      disabled={isConverting}
                      onChange={(e) =>
                        onUpdateTargetFormat(
                          item.id,
                          e.target.value as SupportedTargetFormat
                        )
                      }
                      className="bg-transparent text-xs font-bold uppercase text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
                    >
                      {validTargets.map((t) => (
                        <option key={t} value={t} className="dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                          {t === 'auto'
                            ? `AUTO (${item.sourceExt.toUpperCase()} - SAME)`
                            : t === 'subtitles'
                            ? 'SUBTITLES (AUTO)'
                            : t === item.sourceExt
                            ? `${t.toUpperCase()} (SAME)`
                            : t.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subtitles extract button (if MKV or video with subtitles) */}
                  {item.sourceExt === 'mkv' && item.file && onOpenSubtitles && (
                    <button
                      type="button"
                      onClick={() => onOpenSubtitles(item)}
                      title="Extract embedded MKV subtitle tracks"
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                    >
                      <Subtitles className="w-4 h-4 text-rose-500" />
                      <span className="hidden sm:inline">Subtitles</span>
                    </button>
                  )}

                  {/* Video options button (if video) */}
                  {isVideo && item.file && onOpenVideoSettings && (
                    <button
                      type="button"
                      onClick={() => onOpenVideoSettings(item)}
                      title="Video resolution, compression & trimming settings"
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                    >
                      <SlidersHorizontal className="w-4 h-4 text-rose-500" />
                      <span className="hidden sm:inline">Settings</span>
                    </button>
                  )}

                  {/* Crop button (if image) */}
                  {isImage && item.file && (
                    <button
                      type="button"
                      onClick={() => onOpenCrop(item)}
                      title="Crop image before conversion"
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      <Crop className="w-4 h-4" />
                    </button>
                  )}

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    disabled={isConverting}
                    title="Remove file"
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress bar when converting */}
              {item.status === 'converting' && (
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Processing {isVideo ? 'video frames' : 'file'}…</span>
                    <span>{item.progress ? `${item.progress}%` : ''}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full transition-all duration-150"
                      style={{ width: `${item.progress || 35}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Output download buttons */}
              {item.outputs && item.outputs.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <FileCheck className="w-3.5 h-3.5" />
                    Converted:
                  </span>
                  {item.outputs.map((out, idx) => (
                    <a
                      key={idx}
                      href={out.url}
                      download={out.name}
                      className="px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl flex items-center gap-1.5 transition-colors border border-rose-200 dark:border-rose-900/50 shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[200px]">
                        {out.name} ({formatBytes(out.size)})
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Global Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={onConvertAll}
          disabled={isConverting}
          className="flex-1 py-3.5 px-6 rounded-2xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
        >
          {isConverting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Converting Files…</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              <span>Convert All ({items.length})</span>
            </>
          )}
        </button>

        {totalCompletedOutputs > 1 && (
          <button
            type="button"
            onClick={onDownloadAllZip}
            className="w-full sm:w-auto py-3.5 px-5 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all hover:bg-slate-800 dark:hover:bg-white cursor-pointer active:scale-98"
          >
            <Archive className="w-4 h-4" />
            <span>Download All ({totalCompletedOutputs} in ZIP)</span>
          </button>
        )}
      </div>
    </div>
  );
};

