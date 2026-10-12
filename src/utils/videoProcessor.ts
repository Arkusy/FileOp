import {
  ConvertedOutput,
  SupportedTargetFormat,
  VideoCodecChoice,
  VideoConversionOptions,
} from '../types/converter';
import gifshot from 'gifshot';
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  MkvOutputFormat,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
  canEncodeVideo,
} from 'mediabunny';
import { muxSubtitlesIntoMkv } from './mkvMuxer';
import { extractSubtitlesFromMkv, MkvSubtitleTrack } from './mkvSubtitleExtractor';

/* -------------------------------------------------------------------------- */
/*  Types & shared helpers                                                    */
/* -------------------------------------------------------------------------- */

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  aspectRatio: number;
}

export type OutputContainer = 'mp4' | 'webm' | 'mkv';
type ConcreteCodec = Exclude<VideoCodecChoice, 'auto'>;
type MbVideoCodec = 'avc' | 'hevc' | 'vp9' | 'av1' | 'vp8';

const CHOICE_TO_MB: Record<ConcreteCodec, MbVideoCodec> = {
  h264: 'avc',
  h265: 'hevc',
  vp9: 'vp9',
  av1: 'av1',
};

const MB_TO_LABEL: Record<MbVideoCodec, string> = {
  avc: 'H.264',
  hevc: 'H.265 (HEVC)',
  vp9: 'VP9',
  av1: 'AV1',
  vp8: 'VP8',
};

/** Which codecs each container may hold. */
const CONTAINER_CODECS: Record<OutputContainer, MbVideoCodec[]> = {
  mp4: ['avc', 'hevc', 'vp9', 'av1'],
  webm: ['vp9', 'av1', 'vp8'],
  mkv: ['avc', 'hevc', 'vp9', 'av1', 'vp8'],
};

/** Order tried when the codec is "auto". */
const AUTO_ORDER: Record<OutputContainer, MbVideoCodec[]> = {
  mp4: ['avc', 'vp9', 'av1'],
  webm: ['vp9', 'vp8', 'av1'],
  mkv: ['avc', 'vp9', 'av1'],
};

/**
 * Newer codecs reach the same visual quality at a lower bitrate, so the
 * target bitrate is scaled down. This is where the file-size saving comes from.
 */
const BITRATE_FACTOR: Record<MbVideoCodec, number> = {
  avc: 1,
  vp8: 1.3,
  vp9: 0.7,
  hevc: 0.6,
  av1: 0.5,
};

const BASE_VIDEO_BITRATE = { high: 4_000_000, medium: 1_500_000, low: 700_000 } as const;
const AUDIO_BITRATE = { high: 128_000, medium: 96_000, low: 64_000 } as const;

export function webCodecsAvailable(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';
}

/** Target video bitrate (bits/s) for a quality level and codec. */
export function getTargetBitrate(
  quality: VideoConversionOptions['quality'],
  codec: VideoCodecChoice | MbVideoCodec = 'h264'
): number {
  const mb: MbVideoCodec =
    codec === 'auto'
      ? 'avc'
      : codec in CHOICE_TO_MB
        ? CHOICE_TO_MB[codec as ConcreteCodec]
        : (codec as MbVideoCodec);
  return Math.round(BASE_VIDEO_BITRATE[quality] * BITRATE_FACTOR[mb]);
}

/** Works out the real output type for a file + chosen target format. */
export function resolveOutputContainer(
  fileName: string,
  target: SupportedTargetFormat
): OutputContainer | 'gif' | 'audio' {
  const srcExt = fileName.split('.').pop()?.toLowerCase() || 'mp4';
  const effective: SupportedTargetFormat =
    target === 'auto'
      ? srcExt === 'mkv'
        ? 'mkv'
        : srcExt === 'webm'
          ? 'webm'
          : srcExt === 'gif'
            ? 'gif'
            : 'mp4'
      : target;
  if (effective === 'gif') return 'gif';
  if (effective === 'wav' || effective === 'mp3') return 'audio';
  if (effective === 'mkv') return 'mkv';
  if (effective === 'webm') return 'webm';
  return 'mp4';
}

export function isCodecAllowedInContainer(
  choice: VideoCodecChoice,
  container: OutputContainer
): boolean {
  if (choice === 'auto') return true;
  return CONTAINER_CODECS[container].includes(CHOICE_TO_MB[choice]);
}

/**
 * Which codec choices this browser/device can actually encode for the given
 * container and output size. Used by the settings modal to disable options.
 */
export async function getCodecAvailability(
  container: OutputContainer,
  width: number,
  height: number
): Promise<Record<VideoCodecChoice, boolean>> {
  const result: Record<VideoCodecChoice, boolean> = {
    auto: true,
    h264: false,
    h265: false,
    av1: false,
    vp9: false,
  };
  if (!webCodecsAvailable()) return result;

  const w = Math.max(2, Math.round(width / 2) * 2);
  const h = Math.max(2, Math.round(height / 2) * 2);
  await Promise.all(
    (Object.keys(CHOICE_TO_MB) as ConcreteCodec[]).map(async (choice) => {
      const mb = CHOICE_TO_MB[choice];
      if (!CONTAINER_CODECS[container].includes(mb)) return;
      try {
        result[choice] = await canEncodeVideo(mb, {
          width: w,
          height: h,
          bitrate: getTargetBitrate('medium', mb),
        });
      } catch {
        result[choice] = false;
      }
    })
  );
  return result;
}

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                  */
/* -------------------------------------------------------------------------- */

async function getMetadataViaMediabunny(file: File): Promise<VideoMetadata> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error('No video track found in this file.');
  const duration = await input.computeDuration();
  const w = track.displayWidth || 1280;
  const h = track.displayHeight || 720;
  return { duration: duration || 0, width: w, height: h, aspectRatio: w / h };
}

export function getVideoMetadata(file: File): Promise<VideoMetadata> {
  const viaElement = new Promise<VideoMetadata>((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      resolve({
        duration: video.duration || 0,
        width: w,
        height: h,
        aspectRatio: w / h,
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video metadata. The format may be unsupported by your browser.'));
    };
  });

  // Browsers can't play every container/codec (e.g. some MKV files) even when
  // WebCodecs can still read them, so retry with Mediabunny before giving up.
  return viaElement.catch(async (err) => {
    try {
      return await getMetadataViaMediabunny(file);
    } catch {
      throw err;
    }
  });
}

/**
 * "720p" means the SHORT side is 720 px (so portrait videos scale correctly).
 * Never upscales. Output dimensions are always even (required by most codecs).
 */
export function calculateTargetDimensions(
  origW: number,
  origH: number,
  resolution: VideoConversionOptions['resolution']
): { width: number; height: number; scaled: boolean } {
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

  const targets: Record<string, number> = { '1080p': 1080, '720p': 720, '480p': 480, '360p': 360 };
  const target = targets[resolution];
  const shortSide = Math.min(origW, origH);

  if (resolution === 'original' || !target || shortSide <= target) {
    const oddDims = origW % 2 !== 0 || origH % 2 !== 0;
    return { width: even(origW), height: even(origH), scaled: oddDims };
  }

  const scale = target / shortSide;
  return { width: even(origW * scale), height: even(origH * scale), scaled: true };
}

// Convert video to animated GIF
export async function convertVideoToGif(
  file: File,
  options: VideoConversionOptions,
  onProgress?: (percent: number) => void
): Promise<ConvertedOutput> {
  const meta = await getVideoMetadata(file);
  const { width, height } = calculateTargetDimensions(meta.width, meta.height, options.resolution);

  // Keep GIF dimensions reasonable for performance (max 480px width)
  const gifW = Math.min(480, width);
  const gifH = Math.round((gifW * height) / width);

  const startTime = options.trimStart || 0;
  const duration = (options.trimEnd || Math.min(meta.duration, 15)) - startTime;
  const fps = options.gifFps || 10;
  const numFrames = Math.min(60, Math.max(10, Math.round(duration * fps)));

  return new Promise((resolve, reject) => {
    const videoUrl = URL.createObjectURL(file);

    gifshot.createGIF(
      {
        video: videoUrl,
        gifWidth: gifW,
        gifHeight: gifH,
        numFrames,
        offset: startTime,
        interval: 1 / fps,
        progressCallback: (progress: number) => {
          if (onProgress) onProgress(Math.round(progress * 100));
        },
      },
      (obj) => {
        URL.revokeObjectURL(videoUrl);
        if (obj.error) {
          reject(new Error(obj.errorMsg || 'Failed to create GIF'));
          return;
        }

        // Convert base64 dataURI to Blob
        fetch(obj.image)
          .then((res) => res.blob())
          .then((blob) => {
            const baseName = file.name.replace(/\.[^.]+$/, '');
            const outName = `${baseName}.gif`;
            resolve({
              blob,
              name: outName,
              url: URL.createObjectURL(blob),
              size: blob.size,
            });
          })
          .catch(reject);
      }
    );
  });
}

// Extract audio from video into WAV file
export async function extractAudioFromVideo(
  file: File,
  onProgress?: (percent: number) => void
): Promise<ConvertedOutput> {
  if (onProgress) onProgress(10);
  const arrayBuffer = await file.arrayBuffer();
  if (onProgress) onProgress(30);

  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  if (onProgress) onProgress(60);

  // Encode PCM to WAV
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length * numChannels * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);

  // Write WAV Header
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + audioBuffer.length * numChannels * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, audioBuffer.length * numChannels * 2, true);

  // Write audio samples
  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  if (onProgress) onProgress(100);
  const wavBlob = new Blob([view], { type: 'audio/wav' });
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const outName = `${baseName}.wav`;

  return {
    blob: wavBlob,
    name: outName,
    url: URL.createObjectURL(wavBlob),
    size: wavBlob.size,
  };
}

/* -------------------------------------------------------------------------- */
/*  Fast path: WebCodecs via Mediabunny (faster than real time, no playback)  */
/* -------------------------------------------------------------------------- */

/** Thrown when the fast path can't handle a file, so the caller may fall back. */
class FastPathUnavailableError extends Error {}

function shiftSubtitleTracks(
  tracks: MkvSubtitleTrack[],
  startMs: number,
  endMs: number
): MkvSubtitleTrack[] {
  if (startMs <= 0 && !isFinite(endMs)) return tracks;
  return tracks.map((t) => ({
    ...t,
    cues: t.cues
      .filter((c) => c.endMs > startMs && c.startMs < endMs)
      .map((c) => ({
        ...c,
        startMs: Math.max(0, c.startMs - startMs),
        endMs: Math.min(c.endMs, endMs) - startMs,
      })),
  }));
}

async function pickVideoCodec(
  container: OutputContainer,
  choice: VideoCodecChoice,
  width: number,
  height: number,
  quality: VideoConversionOptions['quality']
): Promise<MbVideoCodec> {
  if (choice !== 'auto') {
    const mb = CHOICE_TO_MB[choice];
    if (!CONTAINER_CODECS[container].includes(mb)) {
      throw new Error(
        `${MB_TO_LABEL[mb]} can't be stored in ${container.toUpperCase()}. Choose MP4 or MKV as the output format, or pick another codec.`
      );
    }
    const ok = await canEncodeVideo(mb, { width, height, bitrate: getTargetBitrate(quality, mb) }).catch(
      () => false
    );
    if (!ok) {
      throw new Error(
        `${MB_TO_LABEL[mb]} encoding isn't supported by this browser or device at ${width}x${height}. Choose another codec.`
      );
    }
    return mb;
  }

  for (const mb of AUTO_ORDER[container]) {
    const ok = await canEncodeVideo(mb, { width, height, bitrate: getTargetBitrate(quality, mb) }).catch(
      () => false
    );
    if (ok) return mb;
  }
  throw new FastPathUnavailableError('No supported video encoder found.');
}

async function convertWithWebCodecs(
  file: File,
  container: OutputContainer,
  srcExt: string,
  options: VideoConversionOptions,
  onProgress?: (percent: number) => void,
  existingTracks?: MkvSubtitleTrack[],
  signal?: AbortSignal
): Promise<ConvertedOutput> {
  if (signal?.aborted) throw new DOMException('Conversion cancelled', 'AbortError');

  // 1. Open the input and read basic info (no <video> element involved)
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  let srcW: number;
  let srcH: number;
  let sourceDuration: number;
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('no video track');
    srcW = track.displayWidth;
    srcH = track.displayHeight;
    sourceDuration = await input.computeDuration();
  } catch (err) {
    throw new FastPathUnavailableError(
      `Could not read input with WebCodecs: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const dims = calculateTargetDimensions(srcW, srcH, options.resolution);
  const choice: VideoCodecChoice = options.codec ?? 'auto';

  // 2. Codec + bitrate
  const codec = await pickVideoCodec(container, choice, dims.width, dims.height, options.quality);
  const videoBitrate = getTargetBitrate(options.quality, codec);

  // 3. Trim
  const trimStart = Math.max(0, options.trimStart || 0);
  const trimEnd = options.trimEnd && options.trimEnd > 0 ? options.trimEnd : sourceDuration;
  const needsTrim = trimStart > 0.05 || trimEnd < sourceDuration - 0.1;

  // 4. Output container
  const target = new BufferTarget();
  const format =
    container === 'mp4'
      ? new Mp4OutputFormat({ fastStart: 'in-memory' })
      : container === 'webm'
        ? new WebMOutputFormat()
        : new MkvOutputFormat();
  const output = new Output({ format, target });

  // 5. Build the conversion
  let conversion: Conversion;
  try {
    conversion = await Conversion.init({
      input,
      output,
      video: {
        codec,
        bitrate: videoBitrate,
        forceTranscode: true, // we WANT to re-encode so the bitrate target is applied
        ...(dims.scaled ? { width: dims.width, height: dims.height, fit: 'fill' as const } : {}),
      },
      audio: options.mute ? { discard: true } : { bitrate: AUDIO_BITRATE[options.quality] },
      ...(needsTrim ? { trim: { start: trimStart, end: trimEnd } } : {}),
    });
  } catch (err) {
    throw new FastPathUnavailableError(
      `Conversion setup failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!conversion.isValid) {
    throw new FastPathUnavailableError('This video cannot be decoded or encoded with WebCodecs.');
  }

  // Warn (don't fail) if the audio could not be carried over
  if (!options.mute) {
    const droppedAudio = conversion.discardedTracks.filter(
      (d) => (d.track as unknown as { type?: string }).type === 'audio'
    );
    if (droppedAudio.length > 0) {
      console.warn(
        'Audio track(s) could not be converted and were dropped:',
        droppedAudio.map((d) => d.reason)
      );
    }
  }

  conversion.onProgress = (p: number) => {
    onProgress?.(Math.min(99, Math.max(1, Math.round(p * 100))));
  };
  const onAbort = () => {
    conversion.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    await conversion.execute();
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }

  const buffer = target.buffer;
  if (!buffer) throw new Error('Encoding finished but produced no output.');

  const mime = container === 'mp4' ? 'video/mp4' : container === 'webm' ? 'video/webm' : 'video/x-matroska';
  let finalBlob = new Blob([buffer], { type: mime });

  // 6. MKV: embed subtitles (unless Mediabunny already carried them across)
  if (container === 'mkv') {
    const carriedNatively = conversion.utilizedTracks.some(
      (t) => (t as unknown as { type?: string }).type === 'subtitle'
    );
    if (!carriedNatively) {
      let tracksToMux = existingTracks;
      if (!tracksToMux && srcExt === 'mkv') {
        try {
          tracksToMux = (await extractSubtitlesFromMkv(file)).tracks;
        } catch {
          tracksToMux = [];
        }
      }
      if (tracksToMux && tracksToMux.length > 0) {
        const aligned = shiftSubtitleTracks(
          tracksToMux,
          needsTrim ? trimStart * 1000 : 0,
          needsTrim ? trimEnd * 1000 : Infinity
        );
        finalBlob = await muxSubtitlesIntoMkv(finalBlob, aligned);
      }
    }
  }

  onProgress?.(100);

  const baseName = file.name.replace(/\.[^.]+$/, '');
  const resTag = options.resolution !== 'original' ? `-${options.resolution}` : '';
  const codecTag = choice !== 'auto' ? `-${choice}` : '';
  const outName = `${baseName}${resTag}${codecTag}.${container}`;

  return {
    blob: finalBlob,
    name: outName,
    url: URL.createObjectURL(finalBlob),
    size: finalBlob.size,
  };
}

/* -------------------------------------------------------------------------- */
/*  Public entry point                                                        */
/* -------------------------------------------------------------------------- */

// Convert video with resolution scaling, codec choice and bitrate compression
export async function convertAndCompressVideo(
  file: File,
  targetFormat: SupportedTargetFormat,
  options: VideoConversionOptions,
  onProgress?: (percent: number) => void,
  existingTracks?: MkvSubtitleTrack[],
  signal?: AbortSignal
): Promise<ConvertedOutput> {
  const srcExt = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const kind = resolveOutputContainer(file.name, targetFormat);

  if (kind === 'gif') {
    return convertVideoToGif(file, options, onProgress);
  }
  if (kind === 'audio') {
    return extractAudioFromVideo(file, onProgress);
  }

  if (webCodecsAvailable()) {
    try {
      return await convertWithWebCodecs(file, kind, srcExt, options, onProgress, existingTracks, signal);
    } catch (err) {
      if (!(err instanceof FastPathUnavailableError)) throw err;
      console.warn('Fast WebCodecs path unavailable, falling back to real-time playback:', err.message);
    }
  }

  // Fallback: old real-time playback + MediaRecorder method (slow, but works almost anywhere).
  // Note: this path can only produce H.264/VP9-style output and ignores the codec choice.
  return convertViaPlayback(file, kind, srcExt, options, onProgress, existingTracks);
}

/* -------------------------------------------------------------------------- */
/*  Legacy fallback: real-time playback + MediaRecorder                       */
/* -------------------------------------------------------------------------- */

async function convertViaPlayback(
  file: File,
  effectiveFormat: OutputContainer,
  srcExt: string,
  options: VideoConversionOptions,
  onProgress?: (percent: number) => void,
  existingTracks?: MkvSubtitleTrack[]
): Promise<ConvertedOutput> {
  const meta = await getVideoMetadata(file);
  const { width, height } = calculateTargetDimensions(meta.width, meta.height, options.resolution);

  // Bitrate settings
  let videoBitsPerSecond = 2000000; // 2 Mbps
  if (options.quality === 'high') videoBitsPerSecond = 4000000;
  if (options.quality === 'medium') videoBitsPerSecond = 1500000;
  if (options.quality === 'low') videoBitsPerSecond = 700000;

  // Determine best mime type supported by browser
  let mimeType = 'video/webm;codecs=vp9';
  let outExt = 'webm';

  if (effectiveFormat === 'mkv') {
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      mimeType = 'video/webm;codecs=vp9';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      mimeType = 'video/webm;codecs=vp8';
    } else {
      mimeType = 'video/webm';
    }
    outExt = 'mkv';
  } else if (effectiveFormat === 'mp4' && MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
    mimeType = 'video/mp4;codecs=avc1';
    outExt = 'mp4';
  } else if (effectiveFormat === 'mp4' && MediaRecorder.isTypeSupported('video/mp4')) {
    mimeType = 'video/mp4';
    outExt = 'mp4';
  } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
    mimeType = 'video/webm;codecs=vp9';
    outExt = 'webm';
  } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
    mimeType = 'video/webm;codecs=vp8';
    outExt = 'webm';
  } else if (MediaRecorder.isTypeSupported('video/webm')) {
    mimeType = 'video/webm';
    outExt = 'webm';
  }

  return new Promise((resolve, reject) => {
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = videoUrl;
    video.playsInline = true;
    video.disableRemotePlayback = true;

    // Suppress Chrome's media session notification
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'none';
      } catch {
        // ignore
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(videoUrl);
      reject(new Error('Canvas 2D context unavailable'));
      return;
    }

    const startTime = options.trimStart || 0;
    const endTime = options.trimEnd || meta.duration;
    const totalDuration = endTime - startTime;

    let audioCtx: AudioContext | null = null;
    let audioStreamDest: MediaStreamAudioDestinationNode | null = null;
    let audioSourceNode: MediaElementAudioSourceNode | null = null;

    const cleanup = () => {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {
        // ignore
      }
      try {
        if (audioStreamDest) {
          audioStreamDest.stream.getTracks().forEach((t) => t.stop());
        }
      } catch {
        // ignore
      }
      try {
        if (audioCtx && audioCtx.state !== 'closed') {
          audioCtx.close().catch(() => {});
        }
      } catch {
        // ignore
      }
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'none';
        } catch {
          // ignore
        }
      }
      URL.revokeObjectURL(videoUrl);
    };

    let started = false;
    const startRecordingSession = () => {
      if (started) return;
      started = true;

      // Setup recording stream from canvas
      const stream = canvas.captureStream(30);

      // Audio handling: capture audio into MediaRecorder WITHOUT playing it to speakers
      if (!options.mute) {
        try {
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass) {
            audioCtx = new AudioContextClass();
            if (audioCtx.state === 'suspended') {
              audioCtx.resume().catch(() => {});
            }
            // Route video element audio into Web Audio node
            audioSourceNode = audioCtx.createMediaElementSource(video);
            audioStreamDest = audioCtx.createMediaStreamDestination();
            // Connect ONLY to MediaStreamDestination, NEVER to audioCtx.destination (hardware speakers).
            // By Web Audio standard, routing into AudioNode disconnects default speaker output,
            // so the user hears zero background audio while the video is compressing!
            audioSourceNode.connect(audioStreamDest);

            const audioTracks = audioStreamDest.stream.getAudioTracks();
            if (audioTracks.length > 0) {
              stream.addTrack(audioTracks[0]);
            }
          }
        } catch (err) {
          console.warn('Web Audio node capture fallback:', err);
        }

        // Fallback to captureStream if Web Audio node was unavailable
        if (!audioStreamDest && (video as unknown as { captureStream?: () => MediaStream }).captureStream) {
          try {
            const videoStream = (video as unknown as { captureStream: () => MediaStream }).captureStream();
            const audioTracks = videoStream.getAudioTracks();
            if (audioTracks.length > 0) {
              stream.addTrack(audioTracks[0]);
            }
          } catch {
            // Continue
          }
        }
      } else {
        video.muted = true;
      }

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        cleanup();
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch {
          // ignore
        }

        let finalBlob = new Blob(chunks, { type: mimeType });

        if (effectiveFormat === 'mkv') {
          let tracksToMux = existingTracks;
          if (!tracksToMux && srcExt === 'mkv') {
            try {
              const res = await extractSubtitlesFromMkv(file);
              tracksToMux = res.tracks;
            } catch {
              tracksToMux = [];
            }
          }
          finalBlob = await muxSubtitlesIntoMkv(finalBlob, tracksToMux || []);
        }

        const baseName = file.name.replace(/\.[^.]+$/, '');
        const resTag = options.resolution !== 'original' ? `-${options.resolution}` : '';
        const outName = `${baseName}${resTag}.${outExt}`;
        resolve({
          blob: finalBlob,
          name: outName,
          url: URL.createObjectURL(finalBlob),
          size: finalBlob.size,
        });
      };

      recorder.start(100);

      // Play video to stream frames (audio is silenced via Web Audio routing)
      video.play().catch(async () => {
        // If unmuted playback is blocked by browser autoplay policy, mute and retry
        video.muted = true;
        try {
          await video.play();
        } catch (err) {
          cleanup();
          reject(err);
        }
      });

      let isFinished = false;
      const stopAndFinalize = () => {
        if (isFinished) return;
        isFinished = true;
        if (recorder.state === 'recording') {
          recorder.stop();
        }
        video.pause();
      };

      const renderFrame = () => {
        if (isFinished || video.paused || video.ended || video.currentTime >= endTime) {
          stopAndFinalize();
          return;
        }

        ctx.drawImage(video, 0, 0, width, height);

        if (onProgress) {
          const elapsed = video.currentTime - startTime;
          const pct = Math.min(99, Math.max(1, Math.round((elapsed / totalDuration) * 100)));
          onProgress(pct);
        }

        if ('requestVideoFrameCallback' in video) {
          (video as unknown as { requestVideoFrameCallback: (cb: () => void) => number }).requestVideoFrameCallback(renderFrame);
        } else {
          requestAnimationFrame(renderFrame);
        }
      };

      video.onended = () => {
        stopAndFinalize();
      };

      if ('requestVideoFrameCallback' in video) {
        (video as unknown as { requestVideoFrameCallback: (cb: () => void) => number }).requestVideoFrameCallback(renderFrame);
      } else {
        requestAnimationFrame(renderFrame);
      }
    };

    video.onloadeddata = () => {
      if (startTime > 0) {
        video.currentTime = startTime;
      } else {
        startRecordingSession();
      }
    };

    video.onseeked = () => {
      startRecordingSession();
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Playback failed during video processing.'));
    };
  });
}
