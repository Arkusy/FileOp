export type SupportedSourceFormat =
  | 'any'
  | 'png'
  | 'jpg'
  | 'jpeg'
  | 'webp'
  | 'svg'
  | 'gif'
  | 'bmp'
  | 'mp4'
  | 'webm'
  | 'mov'
  | 'mkv'
  | 'avi'
  | 'pdf'
  | 'docx'
  | 'txt';

export type SupportedTargetFormat =
  | 'png'
  | 'jpg'
  | 'webp'
  | 'svg'
  | 'pdf'
  | 'docx'
  | 'txt'
  | 'mp4'
  | 'webm'
  | 'gif'
  | 'mp3'
  | 'wav'
  | 'srt'
  | 'vtt'
  | 'ass'
  | 'subtitles';

export interface CropArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ConvertedOutput {
  blob: Blob;
  name: string;
  url: string;
  size: number;
}

export interface VideoConversionOptions {
  resolution: 'original' | '1080p' | '720p' | '480p' | '360p';
  quality: 'high' | 'medium' | 'low';
  mute: boolean;
  trimStart?: number;
  trimEnd?: number;
  gifFps?: number;
}

export interface FileItem {
  id: string;
  file?: File;
  name: string;
  size: number;
  sourceExt: string;
  targetExt: SupportedTargetFormat;
  status: 'idle' | 'converting' | 'completed' | 'error';
  progress?: number;
  errorMsg?: string;
  crop?: CropArea | null;
  videoOptions?: VideoConversionOptions;
  outputs?: ConvertedOutput[];
  previewUrl?: string;
}

export interface SvgMetadata {
  width: number;
  height: number;
  viewBox?: string;
  estimatedSizes: {
    '1x': { width: number; height: number; kb: number };
    '2x': { width: number; height: number; kb: number };
    '4x': { width: number; height: number; kb: number };
  };
}
