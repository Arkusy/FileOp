import React, { useState, useEffect, useRef } from 'react';
import { VideoConversionOptions, VideoCodecChoice, SupportedTargetFormat } from '../types/converter';
import { Video, X, Check, VolumeX, Volume2, Scissors, Gauge, Play, Pause, Cpu } from 'lucide-react';
import {
  getVideoMetadata,
  resolveOutputContainer,
  getCodecAvailability,
  isCodecAllowedInContainer,
} from '../utils/videoProcessor';

interface VideoSettingsModalProps {
  isOpen: boolean;
  file: File;
  targetFormat?: SupportedTargetFormat;
  currentOptions?: VideoConversionOptions;
  onApply: (options: VideoConversionOptions) => void;
  onClose: () => void;
}

export const VideoSettingsModal: React.FC<VideoSettingsModalProps> = ({
  isOpen,
  file,
  targetFormat,
  currentOptions,
  onApply,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [duration, setDuration] = useState<number>(10);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const [resolution, setResolution] = useState<VideoConversionOptions['resolution']>(
    currentOptions?.resolution || '720p'
  );
  const [quality, setQuality] = useState<VideoConversionOptions['quality']>(
    currentOptions?.quality || 'medium'
  );
  const [codec, setCodec] = useState<VideoCodecChoice>(currentOptions?.codec || 'auto');
  const [codecSupport, setCodecSupport] = useState<Record<VideoCodecChoice, boolean>>({
    auto: true,
    h264: true,
    h265: false,
    av1: false,
    vp9: true,
  });
  const [mute, setMute] = useState<boolean>(currentOptions?.mute || false);
  const [trimStart, setTrimStart] = useState<number>(currentOptions?.trimStart || 0);
  const [trimEnd, setTrimEnd] = useState<number>(currentOptions?.trimEnd || 10);

  const containerKind = resolveOutputContainer(file?.name || '', targetFormat || 'auto');

  useEffect(() => {
    if (!isOpen || !file) return;
    const url = URL.createObjectURL(file);
    setVideoUrl(url);

    getVideoMetadata(file)
      .then((meta) => {
        setDuration(meta.duration);
        if (!currentOptions?.trimEnd || currentOptions.trimEnd > meta.duration) {
          setTrimEnd(meta.duration);
        }
        if (containerKind === 'mp4' || containerKind === 'webm' || containerKind === 'mkv') {
          getCodecAvailability(containerKind, meta.width, meta.height)
            .then(setCodecSupport)
            .catch(() => {});
        }
      })
      .catch(() => {});

    return () => URL.revokeObjectURL(url);
  }, [isOpen, file, currentOptions, containerKind]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    if (videoRef.current.currentTime >= trimEnd) {
      videoRef.current.currentTime = trimStart;
    }
  };

  const handleTrimStartChange = (val: number) => {
    const clamped = Math.min(val, trimEnd - 1);
    setTrimStart(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
  };

  const handleTrimEndChange = (val: number) => {
    const clamped = Math.max(val, trimStart + 1);
    setTrimEnd(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center font-bold">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                Video Compression & Resizing
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                Processed 100% locally on your device
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Scrub Preview */}
        <div className="my-3 rounded-2xl bg-black overflow-hidden relative max-h-[200px] flex items-center justify-center">
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            muted={mute}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            className="max-h-[200px] max-w-full"
          />
          <button
            type="button"
            onClick={togglePlay}
            className="absolute p-3 rounded-full bg-black/60 text-white hover:scale-110 transition-transform shadow-lg cursor-pointer"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
          </button>
        </div>

        {/* Controls Grid */}
        <div className="space-y-4">
          {/* Resolution Options */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              Output Resolution
            </label>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {(
                [
                  { id: 'original', label: 'Original' },
                  { id: '1080p', label: '1080p' },
                  { id: '720p', label: '720p' },
                  { id: '480p', label: '480p' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setResolution(item.id)}
                  className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    resolution === item.id
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Compression & Bitrate Level */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
              <Gauge className="w-3.5 h-3.5 text-rose-500" />
              <span>Compression Level</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'high' as const, label: 'High Quality', desc: '~4 Mbps' },
                { id: 'medium' as const, label: 'Balanced (Sharing)', desc: '~1.5 Mbps' },
                { id: 'low' as const, label: 'Max Compression', desc: '~700 kbps' },
              ].map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setQuality(q.id)}
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    quality === q.id
                      ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold">{q.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{q.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Video Codec Selection */}
          {(containerKind === 'mp4' || containerKind === 'webm' || containerKind === 'mkv') && (
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                <Cpu className="w-3.5 h-3.5 text-rose-500" />
                <span>Video Codec</span>
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { id: 'auto' as const, label: 'Auto' },
                  { id: 'h264' as const, label: 'H.264' },
                  { id: 'h265' as const, label: 'H.265' },
                  { id: 'vp9' as const, label: 'VP9' },
                  { id: 'av1' as const, label: 'AV1' },
                ].map((item) => {
                  const allowed = isCodecAllowedInContainer(item.id, containerKind);
                  const supported = codecSupport[item.id];
                  const disabled = !allowed || !supported;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => setCodec(item.id)}
                      title={
                        !allowed
                          ? `Not supported in ${containerKind.toUpperCase()}`
                          : !supported
                          ? 'Not supported by your browser'
                          : undefined
                      }
                      className={`p-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                        disabled
                          ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800/40 text-slate-400'
                          : codec === item.id
                          ? 'bg-rose-500 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Video Trimming Sliders */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              <span className="flex items-center gap-1">
                <Scissors className="w-3.5 h-3.5 text-rose-500" /> Trim Video Duration
              </span>
              <span className="font-mono text-slate-500">
                {trimStart.toFixed(1)}s – {trimEnd.toFixed(1)}s (Total {(trimEnd - trimStart).toFixed(1)}s)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Start: {trimStart.toFixed(1)}s</label>
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, duration)}
                  step={0.5}
                  value={trimStart}
                  onChange={(e) => handleTrimStartChange(parseFloat(e.target.value))}
                  className="w-full accent-rose-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">End: {trimEnd.toFixed(1)}s</label>
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, duration)}
                  step={0.5}
                  value={trimEnd}
                  onChange={(e) => handleTrimEndChange(parseFloat(e.target.value))}
                  className="w-full accent-rose-500"
                />
              </div>
            </div>
          </div>

          {/* Mute Audio Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              {mute ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-emerald-500" />}
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Mute Audio Track</div>
                <div className="text-[10px] text-slate-400">Reduces file size by an extra 15% - 25%</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMute(!mute)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                mute ? 'bg-rose-500' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  mute ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onApply({
                resolution,
                quality,
                codec,
                mute,
                trimStart,
                trimEnd,
              });
              onClose();
            }}
            className="px-5 py-2 text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white rounded-xl shadow-md shadow-rose-500/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Apply Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
