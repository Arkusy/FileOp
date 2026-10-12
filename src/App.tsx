import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Header } from './components/Header';
import { FormatSelectorPair } from './components/FormatSelectorPair';
import { SvgStudio } from './components/SvgStudio';
import { DropZone } from './components/DropZone';
import { BatchList } from './components/BatchList';
import { CropModal } from './components/CropModal';
import { VideoSettingsModal } from './components/VideoSettingsModal';
import { SubtitleModal } from './components/SubtitleModal';
import { ConversionSettings } from './components/ConversionSettings';
import {
  SupportedSourceFormat,
  SupportedTargetFormat,
  FileItem,
  CropArea,
  ConvertedOutput,
  VideoConversionOptions,
} from './types/converter';
import {
  TARGET_FORMATS_BY_SOURCE,
  convertImageFile,
  convertPdfFile,
  convertDocxFile,
  convertSvgCodeOrFile,
  mergeImagesToPdf,
  createZipBundle,
} from './utils/fileConversion';
import { convertAndCompressVideo } from './utils/videoProcessor';
import {
  extractSubtitlesFromMkv,
  buildSrtString,
  buildVttString,
  buildAssString,
  getTrackNativeFormat,
  getSubtitleFileName,
  MkvSubtitleTrack,
} from './utils/mkvSubtitleExtractor';
import { ShieldCheck, Zap } from 'lucide-react';

const RASTER_FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];
const VIDEO_FORMATS = ['mp4', 'webm', 'mov', 'mkv', 'avi', '3gp'];

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const [sourceFormat, setSourceFormat] = useState<SupportedSourceFormat>('any');
  const [targetFormat, setTargetFormat] = useState<SupportedTargetFormat>('png');
  const [items, setItems] = useState<FileItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);

  // Conversion options
  const [maxKb, setMaxKb] = useState<number | undefined>(undefined);
  const [maxDimension, setMaxDimension] = useState<number | undefined>(undefined);
  const [mergeToPdf, setMergeToPdf] = useState(false);

  // Modals state
  const [cropTargetItem, setCropTargetItem] = useState<FileItem | null>(null);
  const [videoSettingsTargetItem, setVideoSettingsTargetItem] = useState<FileItem | null>(null);
  const [subtitleTargetItem, setSubtitleTargetItem] = useState<{
    file: File;
    name: string;
    tracks: MkvSubtitleTrack[];
  } | null>(null);
  const [isWindowDragActive, setIsWindowDragActive] = useState(false);

  // Synchronize theme with HTML root class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Window drag & drop listener
  useEffect(() => {
    let dragCounter = 0;

    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
        setIsWindowDragActive(true);
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        setIsWindowDragActive(false);
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsWindowDragActive(false);
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleAddFiles(Array.from(e.dataTransfer.files));
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCropTargetItem(null);
        setVideoSettingsTargetItem(null);
        setSubtitleTargetItem(null);
      }
    };

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sourceFormat, targetFormat]);

  // Adjust target format when source format changes if current target is invalid
  const handleSelectSource = (format: SupportedSourceFormat) => {
    setSourceFormat(format);
    const validTargets = TARGET_FORMATS_BY_SOURCE[format] || ['png', 'jpg', 'webp', 'pdf'];
    if (!validTargets.includes(targetFormat)) {
      setTargetFormat(validTargets[0]);
    }
  };

  const handleSelectTarget = (format: SupportedTargetFormat) => {
    setTargetFormat(format);
    // Also update all items in batch queue
    setItems((prev) =>
      prev.map((item) => {
        const valid = TARGET_FORMATS_BY_SOURCE[item.sourceExt] || [];
        if (valid.includes(format)) {
          return { ...item, targetExt: format };
        }
        return item;
      })
    );
  };

  // Swap formats handler
  const handleSwapFormats = () => {
    if (sourceFormat === 'any') {
      const newSource = targetFormat as SupportedSourceFormat;
      const validNewTargets = TARGET_FORMATS_BY_SOURCE[newSource] || ['png', 'jpg'];
      setSourceFormat(newSource);
      setTargetFormat(validNewTargets[0]);
      return;
    }

    const currentSource = sourceFormat;
    const currentTarget = targetFormat;

    const newSource = currentTarget as SupportedSourceFormat;
    const validNewTargets = TARGET_FORMATS_BY_SOURCE[newSource] || [];

    if (validNewTargets.includes(currentSource as SupportedTargetFormat)) {
      setSourceFormat(newSource);
      setTargetFormat(currentSource as SupportedTargetFormat);
    } else if (validNewTargets.length > 0) {
      setSourceFormat(newSource);
      setTargetFormat(validNewTargets[0]);
    }
  };

  // Add files to queue and auto-select format if needed
  const handleAddFiles = (files: File[]) => {
    if (files.length === 0) return;

    // Auto-detect extension from first file
    const firstExt = files[0].name.split('.').pop()?.toLowerCase() || '';
    const normalizedFirstExt = firstExt === 'jpeg' ? 'jpg' : firstExt;

    // Auto switch source format whenever a file format is recognized (e.g. mkv -> png, png -> mkv)
    let activeTarget = targetFormat;
    if (TARGET_FORMATS_BY_SOURCE[normalizedFirstExt]) {
      setSourceFormat(normalizedFirstExt as SupportedSourceFormat);
      const validTargets = TARGET_FORMATS_BY_SOURCE[normalizedFirstExt] || ['auto', 'png', 'jpg'];
      if (!validTargets.includes(targetFormat)) {
        activeTarget = 'auto';
        setTargetFormat(activeTarget);
      }
    }

    const newItems: FileItem[] = files.map((file) => {
      let ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      if (ext === 'jpeg') ext = 'jpg';

      const validTargets = TARGET_FORMATS_BY_SOURCE[ext] || ['auto', 'png', 'jpg', 'webp'];
      const resolvedTarget = validTargets.includes(activeTarget)
        ? activeTarget
        : (validTargets[0] || 'auto');

      return {
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        sourceExt: ext,
        targetExt: resolvedTarget,
        status: 'idle',
      };
    });

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleUpdateTargetFormat = (id: string, format: SupportedTargetFormat) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, targetExt: format } : it))
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleApplyCrop = (crop: CropArea | null) => {
    if (!cropTargetItem) return;
    setItems((prev) =>
      prev.map((it) => (it.id === cropTargetItem.id ? { ...it, crop } : it))
    );
  };

  const handleApplyVideoSettings = (options: VideoConversionOptions) => {
    if (!videoSettingsTargetItem) return;
    setItems((prev) =>
      prev.map((it) =>
        it.id === videoSettingsTargetItem.id
          ? { ...it, videoOptions: options }
          : it
      )
    );
  };

  const handleOpenSubtitles = async (item: FileItem) => {
    if (!item.file) return;
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, status: 'converting' } : it))
    );
    try {
      const result = await extractSubtitlesFromMkv(item.file, (progress) => {
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, progress } : it))
        );
      });
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'idle', progress: undefined } : it))
      );
      setSubtitleTargetItem({
        file: item.file,
        name: item.name,
        tracks: result.tracks,
      });
    } catch (err: unknown) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                status: 'error',
                errorMsg: err instanceof Error ? err.message : 'Failed to parse subtitles',
              }
            : it
        )
      );
    }
  };

  // Convert all items in queue
  const handleConvertAll = async () => {
    if (items.length === 0 || isConverting) return;
    setIsConverting(true);

    // Check if image merge to PDF is enabled
    const imagePdfItems = mergeToPdf
      ? items.filter(
          (it) =>
            RASTER_FORMATS.includes(it.sourceExt) &&
            it.targetExt === 'pdf' &&
            it.file
        )
      : [];

    const shouldMerge = imagePdfItems.length > 1;

    for (const item of items) {
      if (shouldMerge && imagePdfItems.includes(item)) {
        if (item === imagePdfItems[0]) {
          // Process merged PDF
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id ? { ...it, status: 'converting', errorMsg: undefined } : it
            )
          );
          try {
            const files = imagePdfItems.map((it) => it.file!);
            const mergedOutput = await mergeImagesToPdf(files, {
              maxDimension,
              maxKb,
            });
            setItems((prev) =>
              prev.map((it) =>
                it.id === item.id
                  ? {
                      ...it,
                      status: 'completed',
                      outputs: [mergedOutput],
                    }
                  : it
              )
            );
          } catch (err: unknown) {
            setItems((prev) =>
              prev.map((it) =>
                it.id === item.id
                  ? {
                      ...it,
                      status: 'error',
                      errorMsg: err instanceof Error ? err.message : 'Merge failed',
                    }
                  : it
              )
            );
          }
        } else {
          // Other merged items
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? {
                    ...it,
                    status: 'completed',
                    errorMsg: `Combined into ${imagePdfItems[0].name}.pdf`,
                  }
                : it
            )
          );
        }
        continue;
      }

      // Individual item conversion
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, status: 'converting', errorMsg: undefined } : it
        )
      );

      try {
        let outputs: ConvertedOutput[] = [];
        const file = item.file;
        if (!file) throw new Error('File data missing');

        if (RASTER_FORMATS.includes(item.sourceExt)) {
          outputs = await convertImageFile(
            file,
            item.targetExt,
            { maxKb, maxDimension },
            item.crop
          );
        } else if (['subtitles', 'srt', 'vtt', 'ass'].includes(item.targetExt)) {
          // Extract subtitles directly from MKV container
          const result = await extractSubtitlesFromMkv(file, (progress) => {
            setItems((prev) =>
              prev.map((it) => (it.id === item.id ? { ...it, progress } : it))
            );
          });
          if (result.tracks.length === 0) {
            throw new Error('No embedded subtitle tracks found in this MKV file');
          }
          outputs = result.tracks.map((trk, idx) => {
            // If target format is 'subtitles' (Auto), detect native format: .ass if ASS, .vtt if VTT, .srt if SRT
            const fmt: 'srt' | 'vtt' | 'ass' =
              item.targetExt === 'subtitles'
                ? getTrackNativeFormat(trk)
                : (item.targetExt as 'srt' | 'vtt' | 'ass');

            let content = '';
            if (fmt === 'srt') content = buildSrtString(trk.cues);
            else if (fmt === 'vtt') content = buildVttString(trk.cues, trk.name);
            else content = buildAssString(trk.cues, trk.codecPrivate, trk.name);

            const blob = new Blob([content], {
              type: fmt === 'vtt' ? 'text/vtt' : 'text/plain;charset=utf-8',
            });
            const outName = getSubtitleFileName(item.name, trk, idx, result.tracks, fmt);
            return {
              blob,
              name: outName,
              url: URL.createObjectURL(blob),
              size: blob.size,
            };
          });
        } else if (VIDEO_FORMATS.includes(item.sourceExt)) {
          // If source is MKV and target is auto/mkv, extract subtitles first to preserve them
          let mkvSubTracks: MkvSubtitleTrack[] = [];
          if (item.sourceExt === 'mkv') {
            try {
              const subRes = await extractSubtitlesFromMkv(file);
              mkvSubTracks = subRes.tracks;
            } catch {
              mkvSubTracks = [];
            }
          }

          const videoOut = await convertAndCompressVideo(
            file,
            item.targetExt,
            item.videoOptions || { resolution: 'original', quality: 'medium', mute: false },
            (progress) => {
              setItems((prev) =>
                prev.map((it) => (it.id === item.id ? { ...it, progress } : it))
              );
            },
            mkvSubTracks
          );

          outputs = [videoOut];
        } else if (item.sourceExt === 'svg') {
          const svgText = await file.text();
          outputs = await convertSvgCodeOrFile(
            svgText,
            item.targetExt,
            1,
            item.name.replace(/\.[^.]+$/, '')
          );
        } else if (item.sourceExt === 'pdf') {
          outputs = await convertPdfFile(file, item.targetExt);
        } else if (item.sourceExt === 'docx') {
          outputs = await convertDocxFile(file, item.targetExt);
        } else {
          throw new Error(`Unsupported source format: ${item.sourceExt}`);
        }

        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: 'completed',
                  outputs,
                }
              : it
          )
        );
      } catch (err: unknown) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: 'error',
                  errorMsg: err instanceof Error ? err.message : 'Conversion failed',
                }
              : it
          )
        );
      }
    }

    setIsConverting(false);

    // Fire celebration confetti
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch {
      // ignore
    }
  };

  // Download all files in a single ZIP bundle
  const handleDownloadAllZip = async () => {
    const allOutputs: ConvertedOutput[] = [];
    items.forEach((item) => {
      if (item.outputs) {
        allOutputs.push(...item.outputs);
      }
    });

    if (allOutputs.length === 0) return;

    try {
      const zip = await createZipBundle(allOutputs, 'converted-files.zip');
      const a = document.createElement('a');
      a.href = zip.url;
      a.download = zip.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to bundle ZIP:', err);
    }
  };

  const hasImagesInQueue = items.some((it) =>
    RASTER_FORMATS.includes(it.sourceExt)
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0d13] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Background Radial Glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(244,63,94,0.12),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(244,63,94,0.18),rgba(0,0,0,0))]" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8 flex flex-col min-h-screen">
        {/* Navigation & Header */}
        <Header
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col items-center pt-8 sm:pt-12">
          {/* Hero Headings */}
          <div className="text-center max-w-xl mx-auto mb-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/50 text-xs font-bold mb-3 shadow-xs">
              <Zap className="w-3.5 h-3.5 fill-rose-500" />
              <span>100% Client-Side Browser Engine</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
              Convert Files <span className="text-rose-500">Locally</span>
            </h1>

            <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Zero cloud uploads. Fast offline conversion for images, SVGs, videos, and documents with instant download.
            </p>
          </div>

          {/* Clickable Format Selector Pair (FROM <-> TO) */}
          <FormatSelectorPair
            sourceFormat={sourceFormat}
            targetFormat={targetFormat}
            onSelectSource={handleSelectSource}
            onSelectTarget={handleSelectTarget}
            onSwapFormats={handleSwapFormats}
            disabled={isConverting}
          />

          {/* CONDITIONAL SVG STUDIO:
              Show SVG Code Editor + 2x/4x scaling with estimated size only when SVG is selected as source! */}
          {sourceFormat === 'svg' ? (
            <SvgStudio
              onAddFiles={handleAddFiles}
              targetFormat={targetFormat}
              onTargetFormatChange={handleSelectTarget}
            />
          ) : (
            /* General File Drop Zone */
            <div className="w-full mb-6">
              <DropZone
                onAddFiles={handleAddFiles}
                sourceFormat={sourceFormat}
                disabled={isConverting}
              />
            </div>
          )}

          {/* Advanced Conversion Settings (KB size limits, scale down, merge PDF) */}
          <ConversionSettings
            maxKb={maxKb}
            onMaxKbChange={setMaxKb}
            maxDimension={maxDimension}
            onMaxDimensionChange={setMaxDimension}
            mergeToPdf={mergeToPdf}
            onMergeToPdfChange={setMergeToPdf}
            hasImages={hasImagesInQueue}
          />

          {/* Batch Files Queue & Conversion Results */}
          <BatchList
            items={items}
            onUpdateTargetFormat={handleUpdateTargetFormat}
            onRemoveItem={handleRemoveItem}
            onOpenCrop={(item) => setCropTargetItem(item)}
            onOpenVideoSettings={(item) => setVideoSettingsTargetItem(item)}
            onOpenSubtitles={handleOpenSubtitles}
            onConvertAll={handleConvertAll}
            onDownloadAllZip={handleDownloadAllZip}
            onClearAll={() => setItems([])}
            isConverting={isConverting}
          />
        </main>

        {/* Footer */}
        <footer className="mt-12 py-6 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">FileConvert</span>
            <span>•</span>
            <span>Client-side WebAssembly, Canvas & Media Engine</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>Works 100% offline</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Image Cropper Modal */}
      {cropTargetItem && cropTargetItem.file && (
        <CropModal
          isOpen={!!cropTargetItem}
          file={cropTargetItem.file}
          currentCrop={cropTargetItem.crop}
          onApplyCrop={handleApplyCrop}
          onClose={() => setCropTargetItem(null)}
        />
      )}

      {/* Video Compression & Settings Modal */}
      {videoSettingsTargetItem && videoSettingsTargetItem.file && (
        <VideoSettingsModal
          isOpen={!!videoSettingsTargetItem}
          file={videoSettingsTargetItem.file}
          currentOptions={videoSettingsTargetItem.videoOptions}
          onApply={handleApplyVideoSettings}
          onClose={() => setVideoSettingsTargetItem(null)}
        />
      )}

      {/* MKV Subtitles Extractor Modal */}
      {subtitleTargetItem && (
        <SubtitleModal
          isOpen={!!subtitleTargetItem}
          fileName={subtitleTargetItem.name}
          tracks={subtitleTargetItem.tracks}
          onClose={() => setSubtitleTargetItem(null)}
        />
      )}

      {/* Global Window Drag Overlay */}
      {isWindowDragActive && (
        <div className="fixed inset-0 z-50 bg-rose-500/10 dark:bg-rose-500/20 backdrop-blur-xs border-4 border-dashed border-rose-500 pointer-events-none flex flex-col items-center justify-center animate-in fade-in duration-150">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-rose-200 dark:border-rose-900 flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-2xl bg-rose-500 text-white flex items-center justify-center animate-bounce">
              <Zap className="w-8 h-8" />
            </div>
            <p className="text-lg font-black text-slate-900 dark:text-white">
              Drop files anywhere to convert!
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Files will be added directly to your local processing queue
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
