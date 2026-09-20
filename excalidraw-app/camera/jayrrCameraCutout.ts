import type { CameraCutout } from "../domain/flags";

const cutouts = new Map<string, HTMLCanvasElement>();

export const setJayrrCameraCutout = (
  elementId: string,
  canvas: HTMLCanvasElement | null,
) => {
  if (canvas) {
    cutouts.set(elementId, canvas);
    return;
  }
  cutouts.delete(elementId);
};

export const getJayrrCameraCutout = (elementId: string) =>
  cutouts.get(elementId) ?? null;

const MEDIAPIPE_WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm";
const MEDIAPIPE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
type StopCutout = () => void;

const waitVideo = (video: HTMLVideoElement) =>
  new Promise<void>((resolve) => {
    if (video.readyState >= 2 && video.videoWidth > 1) {
      resolve();
      return;
    }
    const onReady = () => {
      video.removeEventListener("loadeddata", onReady);
      resolve();
    };
    video.addEventListener("loadeddata", onReady);
  });

const applyPersonMask = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  mask: { width: number; height: number; getAsUint8Array: () => Uint8Array },
) => {
  const bytes = mask.getAsUint8Array();
  const frame = context.getImageData(0, 0, width, height);
  const pixels = frame.data;
  const maskW = mask.width;
  const maskH = mask.height;
  for (let y = 0; y < height; y += 1) {
    const my = Math.min(maskH - 1, Math.floor((y * maskH) / height));
    for (let x = 0; x < width; x += 1) {
      const mx = Math.min(maskW - 1, Math.floor((x * maskW) / width));
      const person = bytes[my * maskW + mx] ?? 0;
      const alpha = person > 0 ? 255 : 0;
      pixels[(y * width + x) * 4 + 3] = alpha;
    }
  }
  context.putImageData(frame, 0, 0);
};

const punchChroma = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) => {
  const frame = context.getImageData(0, 0, width, height);
  const pixels = frame.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    const greenLead = g - Math.max(r, b);
    if (greenLead > 70 && g > 140) {
      pixels[i + 3] = 0;
    } else if (greenLead > 40 && g > 110) {
      pixels[i + 3] = Math.min(pixels[i + 3] ?? 0, 90);
    }
  }
  context.putImageData(frame, 0, 0);
};

const loopVideo = (
  video: HTMLVideoElement,
  cancelled: () => boolean,
  tick: () => void,
) => {
  let handle = 0;
  const step = () => {
    if (cancelled()) {
      return;
    }
    tick();
    if ("requestVideoFrameCallback" in video) {
      handle = video.requestVideoFrameCallback(step);
      return;
    }
    handle = requestAnimationFrame(step);
  };
  step();
  return () => {
    if ("cancelVideoFrameCallback" in video && handle) {
      video.cancelVideoFrameCallback(handle);
      return;
    }
    cancelAnimationFrame(handle);
  };
};

const startMediaPipe = async (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  cancelled: () => boolean,
): Promise<StopCutout> => {
  const visionMod = await import("@mediapipe/tasks-vision");
  if (cancelled()) {
    return () => undefined;
  }
  const fileset = await visionMod.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
  let segmenter: Awaited<
    ReturnType<typeof visionMod.ImageSegmenter.createFromOptions>
  >;
  try {
    segmenter = await visionMod.ImageSegmenter.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE_MODEL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    });
  } catch {
    segmenter = await visionMod.ImageSegmenter.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE_MODEL,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    });
  }
  if (cancelled()) {
    segmenter.close();
    return () => undefined;
  }

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    segmenter.close();
    return () => undefined;
  }

  let lastTs = -1;
  const stopLoop = loopVideo(video, cancelled, () => {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width < 2 || height < 2) {
      return;
    }
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const timestamp = Math.max(lastTs + 1, performance.now());
    lastTs = timestamp;
    try {
      segmenter.segmentForVideo(video, timestamp, (result) => {
        if (cancelled()) {
          return;
        }
        const mask = result.categoryMask;
        if (!mask) {
          return;
        }
        context.clearRect(0, 0, width, height);
        context.drawImage(video, 0, 0, width, height);
        applyPersonMask(context, width, height, mask);
        mask.close();
      });
    } catch {
      // Keep the last good frame if a tick fails.
    }
  });

  return () => {
    stopLoop();
    segmenter.close();
  };
};

const startSegmo = async (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  cancelled: () => boolean,
): Promise<StopCutout> => {
  const stream = video.srcObject;
  if (!(stream instanceof MediaStream)) {
    return () => undefined;
  }
  const track = stream.getVideoTracks()[0];
  if (!track) {
    return () => undefined;
  }
  const { SegmentationProcessor } = await import("segmo");
  if (cancelled()) {
    return () => undefined;
  }
  const caps = SegmentationProcessor.checkCapabilities();
  if (!caps.supported) {
    return () => undefined;
  }
  const processor = new SegmentationProcessor({
    backgroundMode: "color",
    backgroundColor: "#00FF00",
    quality: "high",
    adaptive: false,
    useWorker: true,
    outputFps: 30,
  });
  const processedTrack = await processor.createProcessedTrack(track);
  if (cancelled()) {
    processedTrack.stop();
    processor.destroy();
    return () => undefined;
  }
  const processedVideo = document.createElement("video");
  processedVideo.muted = true;
  processedVideo.playsInline = true;
  processedVideo.autoplay = true;
  processedVideo.srcObject = new MediaStream([processedTrack]);
  await processedVideo.play().catch(() => undefined);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    processedTrack.stop();
    processor.destroy();
    return () => undefined;
  }
  const stopLoop = loopVideo(processedVideo, cancelled, () => {
    const width = processedVideo.videoWidth || video.videoWidth;
    const height = processedVideo.videoHeight || video.videoHeight;
    if (width < 2 || height < 2) {
      return;
    }
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.drawImage(processedVideo, 0, 0, width, height);
    punchChroma(context, width, height);
  });
  return () => {
    stopLoop();
    processedVideo.srcObject = null;
    processedTrack.stop();
    processor.destroy();
  };
};

export const startJayrrCameraCutout = (
  elementId: string,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  engine: CameraCutout,
): StopCutout => {
  if (engine === "off") {
    setJayrrCameraCutout(elementId, null);
    return () => undefined;
  }
  let cancelled = false;
  let stopEngine: StopCutout = () => undefined;
  setJayrrCameraCutout(elementId, canvas);
  void waitVideo(video)
    .then(() => {
      if (cancelled) {
        return;
      }
      if (engine === "mediapipe") {
        return startMediaPipe(video, canvas, () => cancelled);
      }
      return startSegmo(video, canvas, () => cancelled);
    })
    .then((stop) => {
      if (!stop) {
        return;
      }
      if (cancelled) {
        stop();
        return;
      }
      stopEngine = stop;
    })
    .catch(() => undefined);

  return () => {
    cancelled = true;
    stopEngine();
    setJayrrCameraCutout(elementId, null);
  };
};

