declare module 'gifshot' {
  export interface GifshotOptions {
    video?: string[] | Blob[] | string;
    numFrames?: number;
    gifWidth?: number;
    gifHeight?: number;
    interval?: number;
    sampleInterval?: number;
    numWorkers?: number;
    offset?: number;
    progressCallback?: (captureProgress: number) => void;
    completeCallback?: (obj: { error: boolean; errorCode: string; errorMsg: string; image: string }) => void;
  }

  export function createGIF(
    options: GifshotOptions,
    callback: (obj: { error: boolean; errorCode: string; errorMsg: string; image: string }) => void
  ): void;

  export function isVideoSupported(): boolean;
}
