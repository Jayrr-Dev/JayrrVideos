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

const MODNET_MODEL = "Xenova/modnet";
const MODNET_EDGE = 512;

type ModnetImage = {
  width: number;
  height: number;
  channels: number;
  data: Uint8Array | Uint8ClampedArray;
};

type ModnetRemover = (image: HTMLCanvasElement) => Promise<ModnetImage | null>;

let modnetLoad: Promise<ModnetRemover | null> | null = null;
let modnetQueue: Promise<unknown> = Promise.resolve();

const asModnetImage = (value: unknown): ModnetImage | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  if (
    !("data" in value) ||
    !("width" in value) ||
    !("height" in value) ||
    !("channels" in value)
  ) {
    return null;
  }
  const image = value as ModnetImage;
  if (
    typeof image.width !== "number" ||
    typeof image.height !== "number" ||
    typeof image.channels !== "number"
  ) {
    return null;
  }
  return image;
};

const loadModnet = () => {
  if (modnetLoad) {
    return modnetLoad;
  }
  modnetLoad = (async () => {
    if (!("gpu" in navigator) || !navigator.gpu) {
      return null;
    }
    const { env, pipeline } = await import("@huggingface/transformers");
    env.allowLocalModels = false;
    const wasm = env.backends.onnx.wasm;
    if (wasm) {
      wasm.proxy = false;
    }
    const remover = await pipeline("background-removal", MODNET_MODEL, {
      device: "webgpu",
    });
    return async (image: HTMLCanvasElement) => {
      const result = await remover(image);
      if (Array.isArray(result)) {
        return asModnetImage(result[0]);
      }
      return asModnetImage(result);
    };
  })().catch(() => {
    modnetLoad = null;
    return null;
  });
  return modnetLoad;
};

const runModnet = <T>(job: () => Promise<T>) => {
  const run = modnetQueue.then(job, job);
  modnetQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
};

const applyByteMask = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  mask: Uint8Array | Uint8ClampedArray,
  maskW: number,
  maskH: number,
  channels: number,
) => {
  const frame = context.getImageData(0, 0, width, height);
  const pixels = frame.data;
  const stride = Math.max(1, channels);
  for (let y = 0; y < height; y += 1) {
    const my = Math.min(maskH - 1, Math.floor((y * maskH) / height));
    const row = my * maskW;
    for (let x = 0; x < width; x += 1) {
      const mx = Math.min(maskW - 1, Math.floor((x * maskW) / width));
      const alpha = mask[(row + mx) * stride + (stride > 1 ? stride - 1 : 0)];
      pixels[(y * width + x) * 4 + 3] = alpha ?? 0;
    }
  }
  context.putImageData(frame, 0, 0);
};

const startModnet = async (
  elementId: string,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  cancelled: () => boolean,
): Promise<StopCutout> => {
  const runtime = await loadModnet();
  if (!runtime || cancelled()) {
    return () => undefined;
  }
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const scratch = document.createElement("canvas");
  const scratchContext = scratch.getContext("2d", { willReadFrequently: true });
  if (!context || !scratchContext) {
    return () => undefined;
  }

  let busy = false;
  let published = false;
  let mask: Uint8Array | Uint8ClampedArray | null = null;
  let maskW = 0;
  let maskH = 0;
  let maskChannels = 1;

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
    context.clearRect(0, 0, width, height);
    context.drawImage(video, 0, 0, width, height);
    if (mask) {
      applyByteMask(context, width, height, mask, maskW, maskH, maskChannels);
      if (!published) {
        published = true;
        setJayrrCameraCutout(elementId, canvas);
      }
    }
    if (busy) {
      return;
    }
    busy = true;
    const edge = Math.max(width, height);
    const scale = Math.min(1, MODNET_EDGE / edge);
    const sampleW = Math.max(2, Math.round(width * scale));
    const sampleH = Math.max(2, Math.round(height * scale));
    if (scratch.width !== sampleW || scratch.height !== sampleH) {
      scratch.width = sampleW;
      scratch.height = sampleH;
    }
    scratchContext.drawImage(video, 0, 0, sampleW, sampleH);
    void runModnet(() => runtime(scratch))
      .then((matte) => {
        if (!matte || cancelled()) {
          return;
        }
        mask = matte.data;
        maskW = matte.width;
        maskH = matte.height;
        maskChannels = matte.channels;
      })
      .catch(() => undefined)
      .finally(() => {
        busy = false;
      });
  });

  return stopLoop;
};

const startSegmo = async (
  elementId: string,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  cancelled: () => boolean,
): Promise<StopCutout> => {
  const { SegmentationProcessor } = await import("segmo");
  if (cancelled()) {
    return () => undefined;
  }
  const caps = SegmentationProcessor.checkCapabilities();
  if (!caps.supported) {
    return () => undefined;
  }
  const width = video.videoWidth || 640;
  const height = video.videoHeight || 360;
  const processor = new SegmentationProcessor({
    backgroundMode: "blur",
    quality: "high",
    adaptive: false,
    modelFps: 30,
    useWorker: true,
    outputFps: 30,
  });
  await processor.init(width, height);
  if (cancelled()) {
    processor.destroy();
    return () => undefined;
  }
  const context = canvas.getContext("2d");
  if (!context) {
    processor.destroy();
    return () => undefined;
  }

  let published = false;
  const stopLoop = loopVideo(video, cancelled, () => {
    if (video.videoWidth < 2 || video.videoHeight < 2) {
      return;
    }
    const output = processor.processFrame(video, performance.now());
    if (!output) {
      return;
    }
    if (canvas.width !== output.width || canvas.height !== output.height) {
      canvas.width = output.width;
      canvas.height = output.height;
    }
    context.drawImage(output, 0, 0, output.width, output.height);
    if (published) {
      return;
    }
    published = true;
    setJayrrCameraCutout(elementId, canvas);
  });
  return () => {
    stopLoop();
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
      if (engine === "modnet") {
        return startModnet(elementId, video, canvas, () => cancelled);
      }
      return startSegmo(elementId, video, canvas, () => cancelled);
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
