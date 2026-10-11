import { ConvertedOutput, SupportedTargetFormat, VideoConversionOptions } from '../types/converter';
import gifshot from 'gifshot';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  aspectRatio: number;
}

export function getVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
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
}

function calculateTargetDimensions(
  origW: number,
  origH: number,
  resolution: VideoConversionOptions['resolution']
): { width: number; height: number } {
  if (resolution === 'original') {
    return { width: origW, height: origH };
  }

  let maxW = 1280;
  if (resolution === '1080p') maxW = 1920;
  if (resolution === '720p') maxW = 1280;
  if (resolution === '480p') maxW = 854;
  if (resolution === '360p') maxW = 640;

  if (origW <= maxW) {
    return { width: origW, height: origH };
  }

  const ratio = origH / origW;
  const newW = maxW;
  // Ensure dimensions are even numbers for video codecs
  const newH = Math.round((newW * ratio) / 2) * 2;

  return { width: newW, height: newH };
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

// Convert video with resolution scaling and bitrate compression
export async function convertAndCompressVideo(
  file: File,
  targetFormat: SupportedTargetFormat,
  options: VideoConversionOptions,
  onProgress?: (percent: number) => void
): Promise<ConvertedOutput> {
  if (targetFormat === 'gif') {
    return convertVideoToGif(file, options, onProgress);
  }

  if (targetFormat === 'wav' || targetFormat === 'mp3') {
    return extractAudioFromVideo(file, onProgress);
  }

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

  if (targetFormat === 'mp4' && MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
    mimeType = 'video/mp4;codecs=avc1';
    outExt = 'mp4';
  } else if (MediaRecorder.isTypeSupported('video/mp4')) {
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
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = options.mute;
    video.playsInline = true;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas 2D context unavailable'));
      return;
    }

    const startTime = options.trimStart || 0;
    const endTime = options.trimEnd || meta.duration;
    const totalDuration = endTime - startTime;

    video.onloadeddata = () => {
      video.currentTime = startTime;
    };

    video.onseeked = () => {
      // Setup recording stream
      const stream = canvas.captureStream(30);

      // Add audio track if not muted
      if (!options.mute && (video as unknown as { captureStream?: () => MediaStream }).captureStream) {
        try {
          const videoStream = (video as unknown as { captureStream: () => MediaStream }).captureStream();
          const audioTracks = videoStream.getAudioTracks();
          if (audioTracks.length > 0) {
            stream.addTrack(audioTracks[0]);
          }
        } catch {
          // Continue if audio track capture isn't permitted
        }
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

      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: mimeType });
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
      video.play().catch(reject);

      const renderFrame = () => {
        if (video.paused || video.ended || video.currentTime >= endTime) {
          if (recorder.state === 'recording') {
            recorder.stop();
          }
          video.pause();
          return;
        }

        ctx.drawImage(video, 0, 0, width, height);

        if (onProgress) {
          const elapsed = video.currentTime - startTime;
          const pct = Math.min(99, Math.max(1, Math.round((elapsed / totalDuration) * 100)));
          onProgress(pct);
        }

        requestAnimationFrame(renderFrame);
      };

      requestAnimationFrame(renderFrame);
    };

    video.onerror = () => {
      reject(new Error('Playback failed during video processing.'));
    };
  });
}
