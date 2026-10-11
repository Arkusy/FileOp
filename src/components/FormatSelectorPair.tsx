import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeftRight,
  ChevronDown,
  FileCode,
  FileImage,
  FileText,
  File,
  Check,
  Sparkles,
  Video,
  Music,
  Subtitles,
} from 'lucide-react';
import { SupportedSourceFormat, SupportedTargetFormat } from '../types/converter';
import { TARGET_FORMATS_BY_SOURCE } from '../utils/fileConversion';

interface FormatSelectorPairProps {
  sourceFormat: SupportedSourceFormat;
  targetFormat: SupportedTargetFormat;
  onSelectSource: (format: SupportedSourceFormat) => void;
  onSelectTarget: (format: SupportedTargetFormat) => void;
  onSwapFormats: () => void;
  disabled?: boolean;
}

const SOURCE_FORMAT_GROUPS = [
  {
    category: 'Universal',
    formats: [
      { id: 'any', label: 'ANY', desc: 'Auto-detect all files', icon: Sparkles },
    ],
  },
  {
    category: 'Vector Graphics',
    formats: [
      { id: 'svg', label: 'SVG', desc: 'Scalable Vector Graphics & Code', icon: FileCode },
    ],
  },
  {
    category: 'Video & Media',
    formats: [
      { id: 'mp4', label: 'MP4', desc: 'Universal video & audio', icon: Video },
      { id: 'webm', label: 'WEBM', desc: 'WebM open video format', icon: Video },
      { id: 'mov', label: 'MOV', desc: 'Apple QuickTime video', icon: Video },
      { id: 'mkv', label: 'MKV', desc: 'Matroska container video', icon: Video },
      { id: 'avi', label: 'AVI', desc: 'Audio Video Interleave', icon: Video },
    ],
  },
  {
    category: 'Images',
    formats: [
      { id: 'png', label: 'PNG', desc: 'Lossless with transparency', icon: FileImage },
      { id: 'jpg', label: 'JPG', desc: 'Standard compressed photos', icon: FileImage },
      { id: 'webp', label: 'WEBP', desc: 'Modern web image format', icon: FileImage },
      { id: 'gif', label: 'GIF', desc: 'Graphics interchange format', icon: FileImage },
      { id: 'bmp', label: 'BMP', desc: 'Bitmap graphic file', icon: FileImage },
    ],
  },
  {
    category: 'Documents',
    formats: [
      { id: 'pdf', label: 'PDF', desc: 'Portable document format', icon: FileText },
      { id: 'docx', label: 'DOCX', desc: 'Microsoft Word document', icon: FileText },
      { id: 'txt', label: 'TXT', desc: 'Plain text document', icon: File },
    ],
  },
];

const FORMAT_ICONS: Record<string, React.ElementType> = {
  svg: FileCode,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  webp: FileImage,
  gif: FileImage,
  bmp: FileImage,
  mp4: Video,
  webm: Video,
  mov: Video,
  mkv: Video,
  avi: Video,
  mp3: Music,
  wav: Music,
  subtitles: Subtitles,
  srt: Subtitles,
  vtt: Subtitles,
  ass: Subtitles,
  pdf: FileText,
  docx: FileText,
  txt: File,
  any: Sparkles,
};

export const FormatSelectorPair: React.FC<FormatSelectorPairProps> = ({
  sourceFormat,
  targetFormat,
  onSelectSource,
  onSelectTarget,
  onSwapFormats,
  disabled = false,
}) => {
  const [isSourceOpen, setIsSourceOpen] = useState(false);
  const [isTargetOpen, setIsTargetOpen] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  const sourceDropdownRef = useRef<HTMLDivElement>(null);
  const targetDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sourceDropdownRef.current &&
        !sourceDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSourceOpen(false);
      }
      if (
        targetDropdownRef.current &&
        !targetDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTargetOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwapClick = () => {
    setIsSwapping(true);
    onSwapFormats();
    setTimeout(() => setIsSwapping(false), 300);
  };

  const validTargetFormats = TARGET_FORMATS_BY_SOURCE[sourceFormat] || [
    'png',
    'jpg',
    'webp',
    'pdf',
  ];

  const SourceIcon = FORMAT_ICONS[sourceFormat] || File;
  const TargetIcon = FORMAT_ICONS[targetFormat] || File;

  return (
    <div className="w-full flex flex-col items-center my-4 sm:my-6">
      <div className="flex items-center justify-center gap-2 sm:gap-4 w-full max-w-xl">
        {/* LEFT TILE: Source Format */}
        <div ref={sourceDropdownRef} className="relative flex-1 min-w-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setIsSourceOpen(!isSourceOpen);
              setIsTargetOpen(false);
            }}
            className={`w-full group p-3 sm:p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
              isSourceOpen
                ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 ring-2 ring-rose-500/20 shadow-lg'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
              <span>Convert From</span>
              <span className="text-[10px] font-normal text-rose-500 dark:text-rose-400 hidden xs:inline">Select</span>
            </div>

            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 group-hover:scale-105 transition-transform shrink-0">
                  <SourceIcon className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500" />
                </div>
                <div className="min-w-0">
                  <div className="text-base sm:text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase truncate">
                    {sourceFormat}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {sourceFormat === 'any'
                      ? 'Auto-detect'
                      : sourceFormat === 'svg'
                      ? 'Vector & Code'
                      : 'Input format'}
                  </div>
                </div>
              </div>

              <div className="p-1 rounded-lg text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0">
                <ChevronDown
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${
                    isSourceOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>
          </button>

          {/* Source Dropdown Menu */}
          {isSourceOpen && (
            <div className="absolute left-0 top-full mt-2 z-50 w-[260px] sm:w-[300px] max-w-[calc(100vw-32px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2.5 max-h-[360px] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Select input format
              </div>

              <div className="space-y-3 mt-1">
                {SOURCE_FORMAT_GROUPS.map((group) => (
                  <div key={group.category}>
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-2 py-0.5 uppercase tracking-wider">
                      {group.category}
                    </div>
                    <div className="grid grid-cols-1 gap-1 mt-1">
                      {group.formats.map((fmt) => {
                        const Icon = fmt.icon;
                        const isSelected = sourceFormat === fmt.id;
                        return (
                          <button
                            key={fmt.id}
                            type="button"
                            onClick={() => {
                              onSelectSource(fmt.id as SupportedSourceFormat);
                              setIsSourceOpen(false);
                            }}
                            className={`flex items-center justify-between p-2 rounded-xl text-left transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                              <span className="font-bold uppercase text-sm">
                                {fmt.label}
                              </span>
                              <span className="text-xs text-slate-400 dark:text-slate-500 truncate hidden sm:inline">
                                • {fmt.desc}
                              </span>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-rose-500 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SWAP BUTTON */}
        <div className="flex flex-col items-center justify-center shrink-0">
          <button
            type="button"
            onClick={handleSwapClick}
            disabled={disabled}
            title="Swap source and target formats"
            aria-label="Swap formats"
            className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer active:scale-95 ${
              isSwapping ? 'rotate-180 scale-110' : ''
            }`}
          >
            <ArrowLeftRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </button>
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
            TO
          </span>
        </div>

        {/* RIGHT TILE: Target Format */}
        <div ref={targetDropdownRef} className="relative flex-1 min-w-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setIsTargetOpen(!isTargetOpen);
              setIsSourceOpen(false);
            }}
            className={`w-full group p-3 sm:p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
              isTargetOpen
                ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 ring-2 ring-rose-500/20 shadow-lg'
                : 'border-rose-300/80 dark:border-rose-900/60 bg-white dark:bg-slate-900/90 hover:border-rose-400 shadow-sm hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
              <span>Convert To</span>
              <span className="text-[10px] font-normal text-rose-500 dark:text-rose-400 hidden xs:inline">Select</span>
            </div>

            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform shrink-0">
                  <TargetIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-base sm:text-xl font-black tracking-tight text-rose-600 dark:text-rose-400 uppercase truncate">
                    {targetFormat}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Output format
                  </div>
                </div>
              </div>

              <div className="p-1 rounded-lg text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0">
                <ChevronDown
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${
                    isTargetOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>
          </button>

          {/* Target Dropdown Menu */}
          {isTargetOpen && (
            <div className="absolute right-0 top-full mt-2 z-50 w-[220px] sm:w-[260px] max-w-[calc(100vw-32px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2.5 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Output format
              </div>
              <div className="grid grid-cols-1 gap-1 mt-1">
                {validTargetFormats.map((fmt) => {
                  const Icon = FORMAT_ICONS[fmt] || File;
                  const isSelected = targetFormat === fmt;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => {
                        onSelectTarget(fmt);
                        setIsTargetOpen(false);
                      }}
                      className={`flex items-center justify-between p-2 rounded-xl text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <span className="font-bold uppercase text-sm">
                          {fmt === 'subtitles' ? 'AUTO SUB' : fmt}
                        </span>
                        {fmt === 'subtitles' && (
                          <span className="text-[10px] text-rose-500 font-semibold lowercase">
                            (embedded)
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-rose-500" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
