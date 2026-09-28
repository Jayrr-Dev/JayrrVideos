export const JEELIZFACEFILTER: {
  init: (opts: {
    canvas: HTMLCanvasElement;
    NNC?: unknown;
    followZRot?: boolean;
    animateDelay?: number;
    isKeepRunningOnWinFocusLost?: boolean;
    videoSettings?: { videoElement: HTMLVideoElement };
    callbackReady: (errCode: false | string) => void;
    callbackTrack: (detectState: {
      detected: number;
      x: number;
      y: number;
      s: number;
      rz: number;
    }) => void;
  }) => boolean;
  toggle_pause: (
    isPause: boolean,
    isShutOffVideo?: boolean,
  ) => Promise<unknown>;
  update_videoElement: (
    video: HTMLVideoElement,
    callback?: () => void,
  ) => void;
};
