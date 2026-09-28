import { createCutoutKey } from "./jayrrCutoutCompositor";

import type { CameraCutout } from "../domain/flags/cameraCutoutFlag";

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
// Hair/skin/clothes classes give Segmo cleaner edges than the binary selfie
// model. Segmo turns it into a person mask as 1 - background.
const SEGMO_MODEL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite";

type StopCutout = () => void;

const waitVideo = (video: HTMLVideoElement) =>
  new Promise<void>((resolve) => {
    if (video.readyState >= 2) {
      if (video.videoWidth > 1) {
        resolve();
        return;
      }
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
  mask: {
    width: number;
    height: number;
    getAsFloat32Array: () => Float32Array;
  },
) => {
  const weights = mask.getAsFloat32Array();
  const frame = context.getImageData(0, 0, width, height);
  const pixels = frame.data;
  const maskW = mask.width;
  const maskH = mask.height;
  for (let y = 0; y < height; y += 1) {
    const my = Math.min(maskH - 1, Math.floor((y * maskH) / height));
    const row = my * maskW;
    for (let x = 0; x < width; x += 1) {
      const mx = Math.min(maskW - 1, Math.floor((x * maskW) / width));
      const weight = weights[row + mx] ?? 0;
      const unit = weight > 1 ? weight / 255 : weight;
      pixels[(y * width + x) * 4 + 3] = Math.max(
        0,
        Math.min(255, Math.round(unit * 255)),
      );
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
  elementId: string,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  cancelled: () => boolean,
): Promise<StopCutout> => {
  const visionMod = await import("@mediapipe/tasks-vision");
  if (cancelled()) {
    return () => undefined;
  }
  const fileset = await visionMod.FilesetResolver.forVisionTasks(
    MEDIAPIPE_WASM,
  );
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
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    });
  } catch {
    segmenter = await visionMod.ImageSegmenter.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE_MODEL,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      outputCategoryMask: false,
      outputConfidenceMasks: true,
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
  let published = false;
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
        // Class 0 is the person. The other class is the room, which was
        // being kept and turning the person into a white hole.
        const mask = result.confidenceMasks?.[0];
        if (!mask) {
          return;
        }
        context.clearRect(0, 0, width, height);
        context.drawImage(video, 0, 0, width, height);
        applyPersonMask(context, width, height, mask);
        result.close();
        if (!published) {
          published = true;
          setJayrrCameraCutout(elementId, canvas);
        }
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
  elementId: string,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  cancelled: () => boolean,
): Promise<StopCutout | null> => {
  // Import the maintained fork directly; file: packages in node_modules are
  // copies and can otherwise silently run older shaders after a source edit.
  const { SegmentationProcessor } = await import("../vendor/segmo/src");
  if (cancelled()) {
    return null;
  }
  const caps = SegmentationProcessor.checkCapabilities();
  if (!caps.supported) {
    return null;
  }
  const width = video.videoWidth || 640;
  const height = video.videoHeight || 360;
  const processor = new SegmentationProcessor({
    backgroundMode: "transparent",
    quality: "ultra",
    adaptive: false,
    // Main thread loads the model. The worker path can sit ready with no
    // mask, so the live fill stays the raw camera.
    modelFps: 60,
    useWorker: false,
    outputFps: 30,
    // A self-derived ROI crop can lock in a wrong mask after fast head
    // motion (a band missing across the forehead that never recovers). The
    // full frame gives the same edge quality at this model size.
    roiCrop: false,
    modelConfig: { modelAssetPath: SEGMO_MODEL },
  });
  await processor.init(width, height);
  if (cancelled()) {
    processor.destroy();
    return null;
  }
  processor.updatePostProcessing({
    lightWrap: false,
    // Low-resolution closing joins the spaces between fingers. It also only
    // runs on fresh masks, making edges alternate on interpolated frames.
    morphology: false,
    // Retain antialiasing without spreading coverage across narrow fingers.
    featherRadius: 0.75,
    erosionRadius: 0,
    rangeSigma: 0.08,
    // Damps per-frame model noise (lighting flicker, exposure jumps) while
    // it's still cheap, at 256x144. A real edge change is not slowed by
    // this: both this stage and the cutout key jump to full adoption the
    // instant a pixel's mask value moves by more than ~0.12-0.4, so this
    // only holds back jitter, not motion. Disabling it entirely (rate 1)
    // removed that noise floor and showed up as flicker.
    appearRate: 0.7,
    disappearRate: 0.5,
  });
  const key = createCutoutKey(video.ownerDocument);
  if (!key) {
    processor.destroy();
    return null;
  }

  let published = false;
  const stopLoop = loopVideo(video, cancelled, () => {
    if (video.videoWidth < 2 || video.videoHeight < 2) {
      return;
    }
    const timestamp = video.ownerDocument.defaultView!.performance.now();
    const output = processor.processFrame(video, timestamp);
    if (!output) {
      return;
    }
    key.apply(output, output.width, output.height, timestamp);
    if (published) {
      return;
    }
    published = true;
    setJayrrCameraCutout(elementId, key.canvas);
  });
  return () => {
    stopLoop();
    key.destroy();
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
  void waitVideo(video)
    .then(() => {
      if (cancelled) {
        return;
      }
      if (engine === "mediapipe") {
        return startMediaPipe(elementId, video, canvas, () => cancelled);
      }
      return startSegmo(elementId, video, canvas, () => cancelled).then(
        (stop) => {
          if (cancelled) {
            stop?.();
            return;
          }
          if (stop) {
            return stop;
          }
          return startMediaPipe(elementId, video, canvas, () => cancelled);
        },
      );
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
    .catch(() => {
      if (cancelled || engine === "mediapipe") {
        return;
      }
      return startMediaPipe(elementId, video, canvas, () => cancelled).then(
        (stop) => {
          if (cancelled) {
            stop();
            return;
          }
          stopEngine = stop;
        },
      );
    });

  return () => {
    cancelled = true;
    stopEngine();
    setJayrrCameraCutout(elementId, null);
  };
};
