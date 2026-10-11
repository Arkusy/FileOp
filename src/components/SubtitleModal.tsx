import React, { useState } from 'react';
import {
  Subtitles,
  X,
  Download,
  Copy,
  Check,
  FileText,
  Clock,
  Globe,
  Tag,
  Sparkles,
  ChevronRight,
  ArrowRightLeft,
} from 'lucide-react';
import {
  MkvSubtitleTrack,
  buildSrtString,
  buildVttString,
  buildAssString,
  formatSrtTimestamp,
  getTrackNativeFormat,
  getSubtitleFileName,
} from '../utils/mkvSubtitleExtractor';

interface SubtitleModalProps {
  isOpen: boolean;
  fileName: string;
  tracks: MkvSubtitleTrack[];
  onClose: () => void;
  onDownloadAll?: () => void;
}

export const SubtitleModal: React.FC<SubtitleModalProps> = ({
  isOpen,
  fileName,
  tracks,
  onClose,
}) => {
  const [selectedTrackIdx, setSelectedTrackIdx] = useState<number>(0);
  const [selectedFormat, setSelectedFormat] = useState<'auto' | 'srt' | 'vtt' | 'ass'>('auto');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentTrack = tracks[selectedTrackIdx] || tracks[0];
  const nativeFormat = currentTrack ? getTrackNativeFormat(currentTrack) : 'srt';
  const effectiveFormat: 'srt' | 'vtt' | 'ass' =
    selectedFormat === 'auto' ? nativeFormat : selectedFormat;

  const getTrackText = (track: MkvSubtitleTrack, format: 'srt' | 'vtt' | 'ass') => {
    if (!track) return '';
    if (format === 'srt') return buildSrtString(track.cues);
    if (format === 'vtt') return buildVttString(track.cues, track.name);
    return buildAssString(track.cues, track.codecPrivate, track.name);
  };

  const currentContent = currentTrack ? getTrackText(currentTrack, effectiveFormat) : '';

  const handleCopy = () => {
    if (!currentContent) return;
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTrack = (track: MkvSubtitleTrack, format: 'srt' | 'vtt' | 'ass', trackIdx?: number) => {
    const text = getTrackText(track, format);
    const blob = new Blob([text], {
      type: format === 'vtt' ? 'text/vtt' : 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const idx = typeof trackIdx === 'number' ? trackIdx : tracks.indexOf(track);
    const downloadName = getSubtitleFileName(fileName, track, idx >= 0 ? idx : 0, tracks, format);
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    tracks.forEach((track, idx) => {
      const fmt = selectedFormat === 'auto' ? getTrackNativeFormat(track) : selectedFormat;
      handleDownloadTrack(track, fmt, idx);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
              <Subtitles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                MKV Subtitle Extractor
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                {fileName} · {tracks.length} subtitle {tracks.length === 1 ? 'stream' : 'streams'} found
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {tracks.length > 1 && (
              <button
                type="button"
                onClick={handleDownloadAll}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-rose-500" />
                Download All ({tracks.length})
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        {tracks.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center">
              <Subtitles className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No Subtitle Streams Found
            </h4>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm">
              This MKV container does not contain any embedded text subtitle tracks (SRT, ASS, SSA, or WebVTT).
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
            {/* Tracks List Sidebar */}
            <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 p-3 overflow-y-auto space-y-2 bg-slate-50/30 dark:bg-slate-900/40 shrink-0 max-h-48 md:max-h-none">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-1">
                Available Tracks
              </div>
              {tracks.map((trk, idx) => {
                const isSelected = selectedTrackIdx === idx;
                const trkNative = getTrackNativeFormat(trk);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedTrackIdx(idx)}
                    className={`w-full p-2.5 rounded-2xl text-left transition-all cursor-pointer flex items-center justify-between border ${
                      isSelected
                        ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-900/60 shadow-xs ring-1 ring-rose-400/20'
                        : 'bg-white dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 font-bold uppercase text-slate-600 dark:text-slate-300">
                          {trk.language || 'UND'}
                        </span>
                        <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded-md uppercase ${
                          trkNative === 'ass'
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60'
                            : trkNative === 'vtt'
                            ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                        }`}>
                          {trkNative}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {trk.name || `Track #${trk.trackNumber}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                        <span className="truncate">{trk.codecId.replace('S_TEXT/', '')}</span>
                        <span>•</span>
                        <span>{trk.cues.length} dialogue cues</span>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 transition-transform ${
                        isSelected ? 'text-rose-500 translate-x-0.5' : 'text-slate-400'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Subtitle Viewer & Actions */}
            <div className="flex-1 min-w-0 flex flex-col p-4 sm:p-5 overflow-hidden">
              {/* Track summary & Format switcher */}
              <div className="flex flex-col gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Format switcher with Auto default */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setSelectedFormat('auto')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          selectedFormat === 'auto'
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                        title={`Auto-detect embedded format (.${nativeFormat.toUpperCase()})`}
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Auto (.{nativeFormat.toUpperCase()})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedFormat('srt')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          selectedFormat === 'srt'
                            ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        SRT
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedFormat('vtt')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          selectedFormat === 'vtt'
                            ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        VTT
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedFormat('ass')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          selectedFormat === 'ass'
                            ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        ASS
                      </button>
                    </div>

                    <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                      {currentTrack?.cues.length || 0} dialogue events
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => currentTrack && handleDownloadTrack(currentTrack, effectiveFormat)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-xs font-black text-white shadow-sm shadow-rose-500/20 transition-all cursor-pointer active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .{effectiveFormat.toUpperCase()}</span>
                      {selectedFormat === 'auto' && (
                        <span className="text-[10px] font-normal opacity-90 px-1 py-0.2 rounded bg-black/20">
                          Native
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Subtitle format indicator badge */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  {selectedFormat === 'auto' ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Auto mode: Preserves original <strong>.{nativeFormat.toUpperCase()}</strong> format from MKV stream.
                      </span>
                    </div>
                  ) : selectedFormat !== nativeFormat ? (
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                      <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Converting on the fly from original <strong>.{nativeFormat.toUpperCase()}</strong> ➔ <strong>.{effectiveFormat.toUpperCase()}</strong>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
                      <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                      <span>Matching original stream format (.{effectiveFormat.toUpperCase()}).</span>
                    </div>
                  )}

                  {currentTrack && (
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                      <span>File:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded truncate max-w-[240px]">
                        {getSubtitleFileName(fileName, currentTrack, selectedTrackIdx, tracks, effectiveFormat)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Subtitle text preview / code area */}
              <div className="flex-1 min-h-0 mt-3 relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden flex flex-col font-mono text-xs text-slate-200">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400">
                  <span>
                    Preview: {currentTrack?.name || `Track ${currentTrack?.trackNumber}`} · .{effectiveFormat.toUpperCase()}{' '}
                    {selectedFormat === 'auto' ? '(Auto/Original)' : '(Converted)'}
                  </span>
                  <span>{Math.round(currentContent.length / 1024 * 10) / 10} KB</span>
                </div>
                <div className="flex-1 p-3 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text font-mono">
                  {currentContent || '// No subtitles in this track.'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-rose-500" />
            <span>Extracted client-side in browser without server upload</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
