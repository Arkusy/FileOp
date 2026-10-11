import React, { useState, useEffect, useMemo } from 'react';
import {
  Code,
  Upload,
  Sparkles,
  Download,
  AlertCircle,
  Copy,
  Check,
  ZoomIn,
  FileCheck,
} from 'lucide-react';
import { parseSvgString, SAMPLE_SVGS, formatKb } from '../utils/svgParser';
import { convertSvgCodeOrFile } from '../utils/fileConversion';
import { SupportedTargetFormat, ConvertedOutput } from '../types/converter';

interface SvgStudioProps {
  onAddFiles: (files: File[]) => void;
  targetFormat: SupportedTargetFormat;
  onTargetFormatChange: (format: SupportedTargetFormat) => void;
}

export const SvgStudio: React.FC<SvgStudioProps> = ({
  onAddFiles,
  targetFormat,
  onTargetFormatChange,
}) => {
  const [activeTab, setActiveTab] = useState<'code' | 'upload'>('code');
  const [svgCode, setSvgCode] = useState<string>(SAMPLE_SVGS[0].code);
  const [selectedScale, setSelectedScale] = useState<1 | 2 | 4>(2);
  const [copied, setCopied] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedOutput, setConvertedOutput] = useState<ConvertedOutput | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parse SVG and calculate metadata
  const parsed = useMemo(() => {
    return parseSvgString(svgCode);
  }, [svgCode]);

  // Reset output on code or scale change
  useEffect(() => {
    setConvertedOutput(null);
    setErrorMessage(null);
  }, [svgCode, selectedScale, targetFormat]);

  const handleCopy = () => {
    navigator.clipboard.writeText(svgCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConvert = async () => {
    if (!parsed.isValid) {
      setErrorMessage(parsed.error || 'Please provide valid SVG code');
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);

    try {
      const outputs = await convertSvgCodeOrFile(
        svgCode,
        targetFormat === 'svg' ? 'png' : targetFormat,
        selectedScale,
        'svg-export'
      );
      if (outputs.length > 0) {
        setConvertedOutput(outputs[0]);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setIsConverting(false);
    }
  };

  const currentEstimatedSize = useMemo(() => {
    if (!parsed.metadata) return null;
    const key = `${selectedScale}x` as '1x' | '2x' | '4x';
    const entry = parsed.metadata.estimatedSizes[key];
    return entry;
  }, [parsed, selectedScale]);

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-950/60 rounded-3xl p-4 sm:p-6 shadow-xl mb-6">
      {/* Header with Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center font-bold">
            <Code className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              SVG Studio
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Rasterize vector code or upload .svg files at any resolution
            </p>
          </div>
        </div>

        {/* Tab Toggle: Paste Code vs Upload File */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'code'
                ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Paste SVG Code</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload SVG File</span>
          </button>
        </div>
      </div>

      {activeTab === 'upload' ? (
        /* UPLOAD SVG FILE OPTION */
        <div className="pt-6 pb-2 text-center">
          <label className="border-2 border-dashed border-rose-300 dark:border-rose-900/60 rounded-2xl p-8 flex flex-col items-center justify-center bg-rose-50/30 dark:bg-rose-950/10 hover:bg-rose-50/60 dark:hover:bg-rose-950/20 transition-colors cursor-pointer group">
            <input
              type="file"
              accept=".svg"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onAddFiles(Array.from(e.target.files));
                }
              }}
            />
            <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Upload className="w-7 h-7" />
            </div>
            <p className="text-base font-bold text-slate-800 dark:text-slate-200">
              Select or Drop SVG files here
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Supports single or batch .svg files to convert to PNG, JPG, WEBP, or PDF
            </p>
          </label>
        </div>
      ) : (
        /* PASTE SVG CODE OPTION */
        <div className="mt-4 space-y-4">
          {/* Sample Templates & Copy Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">
                Presets:
              </span>
              {SAMPLE_SVGS.map((sample) => (
                <button
                  key={sample.name}
                  type="button"
                  onClick={() => setSvgCode(sample.code)}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200/80 dark:border-slate-700/80 transition-colors cursor-pointer"
                >
                  {sample.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy code</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Grid: Editor + Live Preview */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* SVG Code Textbox */}
            <div className="md:col-span-7 flex flex-col">
              <textarea
                value={svgCode}
                onChange={(e) => setSvgCode(e.target.value)}
                placeholder="Paste your <svg ...>...</svg> code here"
                spellCheck="false"
                rows={9}
                className="w-full h-full min-h-[190px] p-3 text-xs font-mono rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-y"
              />
              {!parsed.isValid && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-rose-500 dark:text-rose-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{parsed.error}</span>
                </div>
              )}
            </div>

            {/* Live Visual Preview */}
            <div className="md:col-span-5 flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-checkered-light dark:bg-checkered-dark bg-slate-50/50 dark:bg-slate-950/50 min-h-[190px] relative overflow-hidden">
              <div className="absolute top-2 left-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border border-slate-200/60 dark:border-slate-700/60">
                Live Preview
              </div>

              {parsed.isValid ? (
                <div
                  className="max-h-[160px] max-w-full flex items-center justify-center p-2 transition-transform"
                  dangerouslySetInnerHTML={{ __html: svgCode }}
                />
              ) : (
                <div className="text-center text-xs text-slate-400 p-4">
                  SVG preview will appear here
                </div>
              )}

              {parsed.metadata && (
                <div className="absolute bottom-2 right-2 text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-xs">
                  {parsed.metadata.width} × {parsed.metadata.height} px
                </div>
              )}
            </div>
          </div>

          {/* Scale Presets (1x, 2x, 4x) & Estimated File Sizes */}
          <div className="pt-2">
            <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ZoomIn className="w-3.5 h-3.5 text-rose-500" />
                <span>Resolution Scale & Auto Pixel Sizing</span>
              </label>
              <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500">
                Auto-calculated from vector dimensions
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
              {[
                { factor: 1 as const, label: '1x Scale', tag: 'Standard' },
                { factor: 2 as const, label: '2x Scale', tag: 'Retina HD' },
                { factor: 4 as const, label: '4x Scale', tag: 'Ultra 4K' },
              ].map((item) => {
                const isSelected = selectedScale === item.factor;
                const sizeInfo =
                  parsed.metadata?.estimatedSizes[`${item.factor}x` as '1x' | '2x' | '4x'];

                return (
                  <button
                    key={item.factor}
                    type="button"
                    onClick={() => setSelectedScale(item.factor)}
                    className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-2xl border text-center transition-all cursor-pointer min-w-0 ${
                      isSelected
                        ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/30 ring-2 ring-rose-500/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-xs sm:text-sm font-black uppercase truncate ${
                          isSelected ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>

                    <div className="text-[10px] sm:text-xs font-mono font-medium text-slate-600 dark:text-slate-300 mt-0.5 truncate max-w-full">
                      {sizeInfo ? `${sizeInfo.width}×${sizeInfo.height}` : `${item.factor}x`}
                    </div>

                    <div className="mt-1 max-w-full">
                      <span
                        className={`text-[9px] sm:text-[11px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full inline-block truncate ${
                          isSelected
                            ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        ~{sizeInfo ? formatKb(sizeInfo.kb) : '15 KB'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Row: Output Format & Convert Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Export As:
              </span>
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {(['png', 'jpg', 'webp', 'pdf'] as SupportedTargetFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => onTargetFormatChange(fmt)}
                    className={`px-2.5 sm:px-3 py-1 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${
                      targetFormat === fmt
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleConvert}
              disabled={!parsed.isValid || isConverting}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              {isConverting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Converting…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Convert SVG Code ({selectedScale}x)</span>
                </>
              )}
            </button>
          </div>

          {/* Result Card when converted */}
          {convertedOutput && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                    {convertedOutput.name}
                  </div>
                  <div className="text-xs text-emerald-700 dark:text-emerald-300">
                    Ready to download · {formatKb(Math.round(convertedOutput.size / 1024))} (
                    {currentEstimatedSize?.width} × {currentEstimatedSize?.height} px)
                  </div>
                </div>
              </div>

              <a
                href={convertedOutput.url}
                download={convertedOutput.name}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download {convertedOutput.name}</span>
              </a>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-900">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
