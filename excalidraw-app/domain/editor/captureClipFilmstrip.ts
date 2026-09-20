const THUMB_MAX_WIDTH = 160;
const THUMB_QUALITY = 0.72;
const DEFAULT_SLICE_PX = 40;
const MAX_SLICES = 28;

const cache = new Map<string, readonly string[]>();
const inflight = new Map<string, Promise<readonly string[]>>();

let queue: Promise<void> = Promise.resolve();

export const filmstripSliceCount = (
  heightPx: number,
  slicePx = DEFAULT_SLICE_PX,
): number => {
  if (heightPx <= 0) {
    return 1;
  }
  return Math.max(1, Math.min(MAX_SLICES, Math.ceil(heightPx / slicePx)));
};

const cacheKey = (
  url: string,
  sourceOffsetMs: number,
  durationMs: number,
  sliceCount: number,
) =>
  `${url}::${Math.round(sourceOffsetMs)}::${Math.round(
    durationMs,
  )}::${sliceCount}`;

const seekVideo = (video: HTMLVideoElement, timeSec: number) =>
  new Promise<void>((resolve, reject) => {
    if (Math.abs(video.currentTime - timeSec) < 0.01) {
      resolve();
      return;
    }
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("seek failed"));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    try {
      video.currentTime = timeSec;
    } catch (error) {
      cleanup();
      reject(error);
    }
  });

const waitLoaded = (video: HTMLVideoElement) =>
  new Promise<void>((resolve, reject) => {
    if (video.readyState >= 2) {
      resolve();
      return;
    }
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("video load failed"));
    };
    const cleanup = () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onError);
  });

const captureAt = (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
): string | null => {
  if (video.videoWidth < 2 || video.videoHeight < 2) {
    return null;
  }
  const scale = Math.min(1, THUMB_MAX_WIDTH / video.videoWidth);
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.drawImage(video, 0, 0, width, height);
  try {
    return canvas.toDataURL("image/jpeg", THUMB_QUALITY);
  } catch {
    return null;
  }
};

const runCapture = async (
  doc: Document,
  url: string,
  timesSec: readonly number[],
): Promise<string[]> => {
  const video = doc.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.src = url;

  const canvas = doc.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    video.removeAttribute("src");
    video.load();
    return [];
  }

  try {
    await waitLoaded(video);
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const frames: string[] = [];
    for (const raw of timesSec) {
      const timeSec =
        duration > 0
          ? Math.min(Math.max(0, raw), Math.max(0, duration - 0.04))
          : Math.max(0, raw);
      await seekVideo(video, timeSec);
      const frame = captureAt(video, canvas, context);
      if (frame) {
        frames.push(frame);
      }
    }
    return frames;
  } catch {
    return [];
  } finally {
    video.removeAttribute("src");
    video.load();
  }
};

export type ClipFilmstripRequest = {
  url: string;
  sourceOffsetMs: number;
  durationMs: number;
  sliceCount: number;
  ownerDocument?: Document;
};

/** Sample evenly spaced frames across a clip’s source range (cached). */
export const getClipFilmstrip = (
  request: ClipFilmstripRequest,
): Promise<readonly string[]> => {
  const sliceCount = Math.max(1, Math.min(MAX_SLICES, request.sliceCount));
  const key = cacheKey(
    request.url,
    request.sourceOffsetMs,
    request.durationMs,
    sliceCount,
  );
  const cached = cache.get(key);
  if (cached) {
    return Promise.resolve(cached);
  }
  const pending = inflight.get(key);
  if (pending) {
    return pending;
  }

  const sourceOffsetSec = Math.max(0, request.sourceOffsetMs) / 1000;
  const durationSec = Math.max(1, request.durationMs) / 1000;
  const timesSec: number[] = [];
  for (let i = 0; i < sliceCount; i++) {
    const t = sourceOffsetSec + ((i + 0.5) / sliceCount) * durationSec;
    timesSec.push(t);
  }

  const doc = request.ownerDocument ?? document;
  const job = new Promise<readonly string[]>((resolve) => {
    queue = queue
      .then(async () => {
        const frames = await runCapture(doc, request.url, timesSec);
        if (frames.length > 0) {
          cache.set(key, frames);
        }
        resolve(frames);
      })
      .catch(() => {
        resolve([]);
      });
  });

  inflight.set(key, job);
  void job.finally(() => {
    inflight.delete(key);
  });
  return job;
};
