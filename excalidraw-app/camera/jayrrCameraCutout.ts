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
const MODNET_SHORT_EDGE = 512;
const MODNET_LONG_EDGE = 1024;

type ModnetFrame = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

type ModnetMatte = {
  data: Uint8Array;
  width: number;
  height: number;
};

type MatteTensor = {
  dims: ArrayLike<number>;
  data: ArrayLike<number>;
  mul: (value: number) => MatteTensor;
  to: (type: "uint8") => MatteTensor;
};

type ModnetRunner = (frame: ModnetFrame) => Promise<ModnetMatte | null>;

let modnetLoad: Promise<ModnetRunner | null> | null = null;
let modnetQueue: Promise<unknown> = Promise.resolve();

const mattePlane = (tensor: MatteTensor) => {
  const dims: number[] = [];
  for (let i = 0; i < tensor.dims.length; i += 1) {
    dims.push(Number(tensor.dims[i]));
  }
  while (dims.length > 2) {
    if (dims[0] !== 1) {
      break;
    }
    dims.shift();
  }
  if (dims.length !== 2) {
    return null;
  }
  const height = dims[0] ?? 0;
  const width = dims[1] ?? 0;
  const count = width * height;
  if (width < 2 || height < 2 || tensor.data.length < count) {
    return null;
  }
  const data = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) {
    data[i] = tensor.data[i] ?? 0;
  }
  return { data, width, height };
};

const morphPass = (
  src: Uint8Array,
  width: number,
  height: number,
  radius: number,
  takeMin: boolean,
) => {
  const temp = new Uint8Array(src.length);
  const out = new Uint8Array(src.length);
  const pick = (left: number, right: number) => {
    if (takeMin) {
      return left < right ? left : right;
    }
    return left > right ? left : right;
  };
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      let value = src[row + x] ?? 0;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      for (let i = x0; i <= x1; i += 1) {
        value = pick(value, src[row + i] ?? 0);
      }
      temp[row + x] = value;
    }
  }
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      let value = temp[y * width + x] ?? 0;
      for (let i = y0; i <= y1; i += 1) {
        value = pick(value, temp[i * width + x] ?? 0);
      }
      out[y * width + x] = value;
    }
  }
  return out;
};

const fillMatteHoles = (src: Uint8Array, width: number, height: number) => {
  const seen = new Uint8Array(src.length);
  const stack: number[] = [];
  const push = (index: number) => {
    if (index < 0 || index >= src.length || seen[index]) {
      return;
    }
    if ((src[index] ?? 0) > 127) {
      return;
    }
    seen[index] = 1;
    stack.push(index);
  };
  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (stack.length > 0) {
    const index = stack.pop() ?? 0;
    const x = index % width;
    if (x > 0) {
      push(index - 1);
    }
    if (x + 1 < width) {
      push(index + 1);
    }
    if (index >= width) {
      push(index - width);
    }
    if (index + width < src.length) {
      push(index + width);
    }
  }
  const out = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i += 1) {
    if ((src[i] ?? 0) > 127 || seen[i] === 0) {
      out[i] = 255;
    }
  }
  return out;
};

const downsampleMax = (
  src: Uint8Array,
  width: number,
  height: number,
  targetW: number,
  targetH: number,
) => {
  const out = new Uint8Array(targetW * targetH);
  for (let y = 0; y < targetH; y += 1) {
    const y0 = Math.min(height - 1, Math.floor((y * height) / targetH));
    const y1 = Math.max(
      y0 + 1,
      Math.min(height, Math.floor(((y + 1) * height) / targetH)),
    );
    for (let x = 0; x < targetW; x += 1) {
      const x0 = Math.min(width - 1, Math.floor((x * width) / targetW));
      const x1 = Math.max(
        x0 + 1,
        Math.min(width, Math.floor(((x + 1) * width) / targetW)),
      );
      let value = 0;
      for (let py = y0; py < y1; py += 1) {
        for (let px = x0; px < x1; px += 1) {
          value = Math.max(value, src[py * width + px] ?? 0);
        }
      }
      out[y * targetW + x] = value;
    }
  }
  return out;
};

const upsampleBilinear = (
  src: Uint8Array,
  width: number,
  height: number,
  targetW: number,
  targetH: number,
) => {
  const out = new Uint8Array(targetW * targetH);
  for (let y = 0; y < targetH; y += 1) {
    const fy = (y + 0.5) * (height / targetH) - 0.5;
    const y0 = Math.max(0, Math.min(height - 1, Math.floor(fy)));
    const y1 = Math.min(height - 1, y0 + 1);
    const ty = Math.max(0, Math.min(1, fy - y0));
    for (let x = 0; x < targetW; x += 1) {
      const fx = (x + 0.5) * (width / targetW) - 0.5;
      const x0 = Math.max(0, Math.min(width - 1, Math.floor(fx)));
      const x1 = Math.min(width - 1, x0 + 1);
      const tx = Math.max(0, Math.min(1, fx - x0));
      const top =
        (src[y0 * width + x0] ?? 0) * (1 - tx) +
        (src[y0 * width + x1] ?? 0) * tx;
      const bottom =
        (src[y1 * width + x0] ?? 0) * (1 - tx) +
        (src[y1 * width + x1] ?? 0) * tx;
      out[y * targetW + x] = Math.round(top * (1 - ty) + bottom * ty);
    }
  }
  return out;
};

// MODNet leaves holes in flat skin and clothing. Close those holes, then
// keep the original matte wherever it was already more opaque.
const repairMatte = (src: Uint8Array, width: number, height: number) => {
  const limit = 320;
  const scale = Math.min(1, limit / Math.max(width, height));
  const smallW = Math.max(2, Math.round(width * scale));
  const smallH = Math.max(2, Math.round(height * scale));
  const small = downsampleMax(src, width, height, smallW, smallH);
  const binary = new Uint8Array(small.length);
  for (let i = 0; i < small.length; i += 1) {
    binary[i] = (small[i] ?? 0) >= 96 ? 255 : 0;
  }
  const radius = Math.max(3, Math.round(Math.min(smallW, smallH) * 0.06));
  const closed = morphPass(
    morphPass(binary, smallW, smallH, radius, false),
    smallW,
    smallH,
    radius,
    true,
  );
  const filled = fillMatteHoles(closed, smallW, smallH);
  let covered = 0;
  for (let i = 0; i < filled.length; i += 1) {
    if ((filled[i] ?? 0) > 127) {
      covered += 1;
    }
  }
  if (covered > filled.length * 0.98) {
    return src;
  }
  const solid = upsampleBilinear(filled, smallW, smallH, width, height);
  const out = new Uint8Array(src.length);
  for (let i = 0; i < out.length; i += 1) {
    const base = src[i] ?? 0;
    const hole = solid[i] ?? 0;
    out[i] = base > hole ? base : hole;
  }
  return out;
};

const loadModnet = () => {
  if (modnetLoad) {
    return modnetLoad;
  }
  modnetLoad = (async () => {
    if (!("gpu" in navigator) || !navigator.gpu) {
      return null;
    }
    const { env, AutoModel, AutoProcessor, RawImage } = await import(
      "@huggingface/transformers"
    );
    env.allowLocalModels = false;
    const wasm = env.backends.onnx.wasm;
    if (wasm) {
      wasm.proxy = false;
    }
    const model = (await AutoModel.from_pretrained(MODNET_MODEL, {
      device: "webgpu",
      dtype: "fp32",
    })) as unknown as (inputs: {
      input: unknown;
    }) => Promise<{ output: MatteTensor }>;
    const processor = (await AutoProcessor.from_pretrained(MODNET_MODEL)) as (
      image: InstanceType<typeof RawImage>,
    ) => Promise<{ pixel_values: unknown }>;
    return async (frame: ModnetFrame) => {
      const image = new RawImage(frame.data, frame.width, frame.height, 3);
      const { pixel_values } = await processor(image);
      const { output } = await model({ input: pixel_values });
      const plane = mattePlane(output.mul(255).to("uint8"));
      if (!plane) {
        return null;
      }
      return {
        data: repairMatte(plane.data, plane.width, plane.height),
        width: plane.width,
        height: plane.height,
      };
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

const sampleByteMask = (
  mask: Uint8Array | Uint8ClampedArray,
  maskW: number,
  maskH: number,
  channels: number,
  fx: number,
  fy: number,
) => {
  const stride = Math.max(1, channels);
  const channel = stride > 1 ? stride - 1 : 0;
  const x0 = Math.max(0, Math.min(maskW - 1, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(maskH - 1, Math.floor(fy)));
  const x1 = Math.min(maskW - 1, x0 + 1);
  const y1 = Math.min(maskH - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, fx - x0));
  const ty = Math.max(0, Math.min(1, fy - y0));
  const at = (px: number, py: number) =>
    mask[(py * maskW + px) * stride + channel] ?? 0;
  const top = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
  const bottom = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
  return top * (1 - ty) + bottom * ty;
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
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = (x + 0.5) * (maskW / width) - 0.5;
      const sy = (y + 0.5) * (maskH / height) - 0.5;
      const alpha = sampleByteMask(mask, maskW, maskH, channels, sx, sy);
      pixels[(y * width + x) * 4 + 3] = Math.max(
        0,
        Math.min(255, Math.round(alpha)),
      );
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
    const short = Math.min(width, height);
    const long = Math.max(width, height);
    let scale = MODNET_SHORT_EDGE / short;
    if (long * scale > MODNET_LONG_EDGE) {
      scale = MODNET_LONG_EDGE / long;
    }
    if (scale > 1) {
      scale = 1;
    }
    const sampleW = Math.max(2, Math.round(width * scale));
    const sampleH = Math.max(2, Math.round(height * scale));
    if (scratch.width !== sampleW || scratch.height !== sampleH) {
      scratch.width = sampleW;
      scratch.height = sampleH;
    }
    scratchContext.drawImage(video, 0, 0, sampleW, sampleH);
    const pixels = scratchContext.getImageData(0, 0, sampleW, sampleH).data;
    const rgb = new Uint8ClampedArray(sampleW * sampleH * 3);
    for (let i = 0, j = 0; i < pixels.length; i += 4, j += 3) {
      rgb[j] = pixels[i] ?? 0;
      rgb[j + 1] = pixels[i + 1] ?? 0;
      rgb[j + 2] = pixels[i + 2] ?? 0;
    }
    void runModnet(() =>
      runtime({ data: rgb, width: sampleW, height: sampleH }),
    )
      .then((matte) => {
        if (!matte || cancelled()) {
          return;
        }
        mask = matte.data;
        maskW = matte.width;
        maskH = matte.height;
        maskChannels = 1;
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
  // Import the maintained fork directly; file: packages in node_modules are
  // copies and can otherwise silently run older shaders after a source edit.
  const { SegmentationProcessor } = await import("../vendor/segmo/src");
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
    backgroundMode: "transparent",
    quality: "ultra",
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
  processor.updatePostProcessing({
    lightWrap: false,
    // Low-resolution closing joins the spaces between fingers. It also only
    // runs on fresh masks, making edges alternate on interpolated frames.
    morphology: false,
    // Retain antialiasing without spreading coverage across narrow fingers.
    featherRadius: 0.75,
    erosionRadius: 0,
    rangeSigma: 0.08,
    appearRate: 0.6,
    disappearRate: 0.45,
  });
  const key = createCutoutKey(video.ownerDocument);
  if (!key) {
    processor.destroy();
    return () => undefined;
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
