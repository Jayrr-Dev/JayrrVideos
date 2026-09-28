import { atom } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";

import {
  drawCameraAccessory,
  isCameraAccessory,
  type CameraAccessory,
} from "./jayrrCameraAccessories";

import { createEyeLasers } from "./jayrrCameraEyeLasers";

import { getJayrrCameraCutout } from "./jayrrCameraCutout";

const funs = new Map<string, HTMLCanvasElement>();

export const setJayrrCameraFun = (
  elementId: string,
  canvas: HTMLCanvasElement | null,
) => {
  if (canvas) {
    funs.set(elementId, canvas);
    return;
  }
  funs.delete(elementId);
};

export const getJayrrCameraFun = (elementId: string) =>
  funs.get(elementId) ?? null;

/**
 * Lasers are painted on their own oversized canvas so they can shoot past the
 * edge of the camera box. `margin` is the extra source-pixel border on every
 * side; the canvas holds `scale` canvas pixels per source pixel.
 */
export type JayrrCameraBeams = {
  canvas: HTMLCanvasElement;
  margin: number;
  scale: number;
};

const beams = new Map<string, JayrrCameraBeams>();

export const getJayrrCameraBeams = (elementId: string) =>
  beams.get(elementId) ?? null;

const BEAM_MARGIN = 0.75;
const BEAM_MAX_SIDE = 1280;

const paintBeams = (
  elementId: string,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void,
) => {
  const margin = Math.round(Math.max(width, height) * BEAM_MARGIN);
  const totalW = width + margin * 2;
  const totalH = height + margin * 2;
  const scale = Math.min(1, BEAM_MAX_SIDE / Math.max(totalW, totalH));
  const pixelsW = Math.ceil(totalW * scale);
  const pixelsH = Math.ceil(totalH * scale);
  if (canvas.width !== pixelsW || canvas.height !== pixelsH) {
    canvas.width = pixelsW;
    canvas.height = pixelsH;
  }
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, pixelsW, pixelsH);
  context.setTransform(scale, 0, 0, scale, margin * scale, margin * scale);
  draw(context);
  context.setTransform(1, 0, 0, 1, 0, 0);
  const published = beams.get(elementId);
  if (!published || published.margin !== margin || published.scale !== scale) {
    beams.set(elementId, { canvas, margin, scale });
  }
};

const readStoredFunOn = () => {
  try {
    return (
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_CAMERA_FUN_ON) === "1"
    );
  } catch {
    return false;
  }
};

export const setSavedFunOn = (on: boolean) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_CAMERA_FUN_ON,
      on ? "1" : "0",
    );
  } catch {
    // Private mode or a full quota.
  }
};

export const cameraFunOnAtom = atom(readStoredFunOn());
export const readStoredAccessory = (view: Window | null): CameraAccessory => {
  try {
    const value = view?.localStorage.getItem("jayrr-camera-accessory");
    return isCameraAccessory(value) ? value : "glasses";
  } catch {
    return "glasses";
  }
};
export const cameraAccessoryAtom = atom<CameraAccessory>("glasses");
export const setSavedAccessory = (
  accessory: CameraAccessory,
  view: Window | null,
) => {
  try {
    view?.localStorage.setItem("jayrr-camera-accessory", accessory);
  } catch {
    // Private mode or a full quota.
  }
};
export const cameraLaserOnAtom = atom(false);
export const cameraEyeLasersOnAtom = atom(false);

const JEELIZ_NN =
  "https://cdn.jsdelivr.net/gh/jeeliz/jeelizFaceFilter@master/neuralNets/NN_LIGHT_1.json";

const TRACK_MAX = 640;

type DetectState = {
  expressions?: ArrayLike<number>;
  detected: number;
  x: number;
  y: number;
  s: number;
  rz: number;
};

type FacePose = {
  firing: boolean;
  x: number;
  y: number;
  s: number;
  rz: number;
  ok: boolean;
};

type StopFun = () => void;

export type CameraFunOffset = { x: number; y: number; scale?: number };

export const DEFAULT_FUN_OFFSET: CameraFunOffset = { x: 0, y: 0, scale: 1 };

export const FUN_SCALE_MIN = 0.5;
export const FUN_SCALE_MAX = 2;

export const funScale = (offset: CameraFunOffset) => {
  const scale = offset.scale ?? 1;
  if (!Number.isFinite(scale)) {
    return 1;
  }
  return Math.min(FUN_SCALE_MAX, Math.max(FUN_SCALE_MIN, scale));
};

export type CameraFunTarget = CameraAccessory | "laser" | "eyeLasers";

export type CameraFunOffsets = Partial<
  Record<CameraFunTarget, CameraFunOffset>
>;

const OFFSETS_KEY = "jayrr-camera-accessory-offsets";

const parseOffset = (value: any): CameraFunOffset | null => {
  if (!Number.isFinite(value?.x) || !Number.isFinite(value?.y)) {
    return null;
  }
  return {
    x: value.x,
    y: value.y,
    scale: funScale({ x: 0, y: 0, scale: value.scale }),
  };
};

export const funOffsetFor = (
  offsets: CameraFunOffsets,
  target: CameraFunTarget,
): CameraFunOffset => offsets[target] ?? DEFAULT_FUN_OFFSET;

const readStoredOffsets = (): CameraFunOffsets => {
  try {
    const value = JSON.parse(localStorage.getItem(OFFSETS_KEY) || "null");
    if (!value || typeof value !== "object") {
      return {};
    }
    const offsets: CameraFunOffsets = {};
    for (const [key, entry] of Object.entries(value)) {
      const offset = parseOffset(entry);
      if (offset) {
        offsets[key as CameraFunTarget] = offset;
      }
    }
    return offsets;
  } catch {
    return {};
  }
};

export const cameraFunOffsetsAtom = atom<CameraFunOffsets>(readStoredOffsets());

export const setSavedFunOffsets = (offsets: CameraFunOffsets) => {
  try {
    localStorage.setItem(OFFSETS_KEY, JSON.stringify(offsets));
  } catch {
    /* private mode */
  }
};

type JeelizApi = {
  init: (opts: {
    canvas: HTMLCanvasElement;
    NNC?: unknown;
    followZRot?: boolean;
    animateDelay?: number;
    isKeepRunningOnWinFocusLost?: boolean;
    videoSettings?: { videoElement: HTMLVideoElement };
    callbackReady: (errCode: false | string) => void;
    callbackTrack: (detectState: DetectState) => void;
  }) => boolean;
  toggle_pause: (
    isPause: boolean,
    isShutOffVideo?: boolean,
  ) => Promise<unknown>;
  update_videoElement: (video: HTMLVideoElement, callback?: () => void) => void;
};

let tracker: JeelizApi | null = null;
let trackerVideo: HTMLVideoElement | null = null;
let trackerCanvas: HTMLCanvasElement | null = null;
let trackerUsers = 0;
let face: FacePose = { x: 0, y: 0, s: 0.35, rz: 0, ok: false, firing: false };

const waitVideo = (video: HTMLVideoElement) =>
  new Promise<void>((resolve) => {
    const ready = () => video.readyState >= 2 && video.videoWidth > 1;
    if (ready()) {
      resolve();
      return;
    }
    const onReady = () => {
      if (!ready()) {
        return;
      }
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("timeupdate", onReady);
      resolve();
    };
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("timeupdate", onReady);
  });

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

const sizeTracker = (video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (width < 2 || height < 2) {
    return;
  }
  const scale = Math.min(1, TRACK_MAX / Math.max(width, height));
  const nextW = Math.max(2, Math.round(width * scale));
  const nextH = Math.max(2, Math.round(height * scale));
  if (canvas.width === nextW && canvas.height === nextH) {
    return;
  }
  canvas.width = nextW;
  canvas.height = nextH;
};

const mixFace = (detect: DetectState): FacePose => {
  const ok = detect.detected > 0.65;
  if (!ok) {
    return {
      ...face,
      ok: detect.detected > 0.4 ? face.ok : false,
      firing: false,
    };
  }
  const blend = face.ok ? 0.35 : 1;
  return {
    firing: (detect.expressions?.[0] ?? 0) > (face.firing ? 0.25 : 0.45),
    x: face.x + (detect.x - face.x) * blend,
    y: face.y + (detect.y - face.y) * blend,
    s: face.s + (detect.s - face.s) * blend,
    rz: face.rz + (detect.rz - face.rz) * blend,
    ok: true,
  };
};

const drawRoundGlasses = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  pose: FacePose,
  offset: CameraFunOffset,
) => {
  if (!pose.ok) {
    return;
  }
  const size = Math.max(24, pose.s * width);
  const cx = (0.5 + 0.5 * pose.x) * width + offset.x;
  const cy = (0.5 - 0.5 * pose.y) * height - size * 0.26 + offset.y;
  const lensR = size * 0.2;
  const gap = size * 0.15;
  const stroke = Math.max(1.2, size * 0.012);
  context.save();
  context.translate(cx, cy);
  context.rotate(-pose.rz);
  context.scale(funScale(offset), funScale(offset));
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = "#141a1c";
  context.lineWidth = stroke;

  // Hinged arms sit behind the rims and bend back toward the ears.
  for (const side of [-1, 1]) {
    const edge = side * (lensR * 2 + gap / 2);
    context.beginPath();
    context.moveTo(edge - side * stroke, -lensR * 0.08);
    context.lineTo(edge + side * lensR * 0.26, -lensR * 0.1);
    context.lineTo(edge + side * lensR * 0.64, -lensR * 0.5);
    context.quadraticCurveTo(
      edge + side * lensR * 0.76,
      -lensR * 0.62,
      edge + side * lensR * 0.8,
      -lensR * 0.34,
    );
    context.lineWidth = stroke * 1.65;
    context.stroke();
    context.lineWidth = stroke * 0.35;
    context.strokeStyle = "#59615f";
    context.stroke();
    context.strokeStyle = "#141a1c";
  }
  context.lineWidth = stroke;
  const drawLens = (offset: number) => {
    const tint = context.createLinearGradient(0, -lensR, 0, lensR);
    tint.addColorStop(0, "rgba(46, 54, 56, 0.88)");
    tint.addColorStop(1, "rgba(17, 23, 27, 0.95)");
    context.beginPath();
    context.arc(offset, 0, lensR, 0, Math.PI * 2);
    context.fillStyle = tint;
    context.fill();
    context.stroke();
    context.save();
    context.beginPath();
    context.arc(offset, 0, lensR - stroke, Math.PI * 1.12, Math.PI * 1.85);
    context.strokeStyle = "rgba(151, 164, 161, 0.3)";
    context.lineWidth = stroke * 0.4;
    context.stroke();
    context.restore();
  };
  drawLens(-lensR - gap / 2);
  drawLens(lensR + gap / 2);
  context.beginPath();
  context.moveTo(-gap / 2, -lensR * 0.12);
  context.quadraticCurveTo(0, -lensR * 0.38, gap / 2, -lensR * 0.12);
  context.stroke();
  context.restore();
};

const drawMouthLaser = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  pose: FacePose,
  offset: CameraFunOffset,
) => {
  if (!pose.ok || !pose.firing) {
    return;
  }
  const size = Math.max(24, pose.s * width);
  const time =
    (context.canvas.ownerDocument.defaultView?.performance.now() ?? 0) / 1000;
  const pulse = 1 + 0.055 * Math.sin(time * 24);
  const length = Math.hypot(width, height) * 2;
  const radius = size * 0.19 * pulse;
  context.save();
  context.translate(
    (0.5 + 0.5 * pose.x) * width + offset.x,
    (0.5 - 0.5 * pose.y) * height + offset.y,
  );
  context.rotate(-pose.rz);
  context.translate(0, size * 0.42);
  context.scale(funScale(offset), funScale(offset));
  context.rotate(0.16);
  context.globalCompositeOperation = "source-over";

  // Layer soft, widening cyan shells around a hot yellow-white core.
  const beam = (spread: number, color: string, blur: number) => {
    const start = radius * spread;
    const end = start + length * 0.12 * spread;
    context.fillStyle = color;
    context.shadowColor = "#62fff2";
    context.shadowBlur = size * blur;
    context.beginPath();
    context.moveTo(0, -start);
    context.lineTo(length, -end);
    context.lineTo(length, end);
    context.lineTo(0, start);
    context.bezierCurveTo(-start * 0.8, start, -start * 0.8, -start, 0, -start);
    context.fill();
  };
  beam(1.85, "rgba(20, 224, 232, 0.12)", 0.45);
  beam(1.5, "rgba(57, 255, 237, 0.2)", 0.35);
  beam(1.15, "rgba(137, 255, 239, 0.45)", 0.25);
  beam(0.85, "rgba(225, 255, 200, 0.8)", 0.2);
  beam(0.55, "#fff9b5", 0.16);
  beam(0.25, "rgba(255, 255, 225, 0.85)", 0.12);

  // Traveling jagged arcs give the blast its electric, meme-like outline.
  context.lineJoin = "round";
  context.lineCap = "round";
  context.shadowColor = "#a2fffa";
  context.shadowBlur = size * 0.08;
  for (let arc = 0; arc < 6; arc++) {
    const side = arc % 2 === 0 ? 1 : -1;
    const phase = time * 8 + arc * 2.3;
    context.strokeStyle = `rgba(167, 255, 247, ${
      0.3 + 0.15 * Math.sin(phase)
    })`;
    context.lineWidth = Math.max(1, size * 0.012);
    context.beginPath();
    for (let point = 0; point <= 32; point++) {
      const x = (point / 32) * length;
      const edge = radius + x * 0.12;
      const jitter =
        Math.sin(point * 2.7 + phase) * Math.cos(point * 1.3 - phase);
      const y = side * edge * (1.15 + jitter * 0.4 + arc * 0.045);
      if (point === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.stroke();
  }

  const glow = context.createRadialGradient(0, 0, 0, 0, 0, radius * 2);
  glow.addColorStop(0, "rgba(255, 255, 218, 0.95)");
  glow.addColorStop(0.35, "rgba(248, 255, 187, 0.8)");
  glow.addColorStop(0.65, "rgba(122, 255, 239, 0.35)");
  glow.addColorStop(1, "rgba(67, 255, 239, 0)");
  context.shadowBlur = 0;
  context.fillStyle = glow;
  context.beginPath();
  context.arc(0, 0, radius * 2, 0, Math.PI * 2);
  context.fill();
  context.restore();
};

const paintFun = (
  elementId: string,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  getOffset: (target: CameraFunTarget) => CameraFunOffset,
  glassesOn: boolean,
  accessory: CameraAccessory,
) => {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (width < 2 || height < 2) {
    return false;
  }
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  if (!context) {
    return false;
  }
  const cutout = getJayrrCameraCutout(elementId);
  const source =
    cutout && cutout.width > 1 && cutout.height > 1 ? cutout : video;
  context.clearRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  if (glassesOn) {
    const offset = getOffset(accessory);
    if (accessory === "glasses") {
      drawRoundGlasses(context, width, height, face, offset);
    } else {
      drawCameraAccessory(context, accessory, face, offset);
    }
  }
  return true;
};

const loadTracker = async (
  video: HTMLVideoElement,
): Promise<JeelizApi | null> => {
  if (tracker) {
    if (trackerVideo !== video) {
      trackerVideo = video;
      tracker.update_videoElement(video);
    }
    void tracker.toggle_pause(false, false).catch(() => undefined);
    return tracker;
  }
  const { JEELIZFACEFILTER } = (await import(
    "../vendor/jeeliz-face-filter/jeelizFaceFilter.module.js"
  )) as { JEELIZFACEFILTER: JeelizApi };
  const response = await fetch(JEELIZ_NN);
  if (!response.ok) {
    return null;
  }
  const NNC = await response.json();
  const canvas = video.ownerDocument.createElement("canvas");
  canvas.className = "jayrr-camera-window__jeeliz";
  canvas.setAttribute("aria-hidden", "true");
  sizeTracker(video, canvas);
  const parent = video.parentElement;
  if (parent) {
    parent.appendChild(canvas);
  } else {
    video.ownerDocument.body.appendChild(canvas);
  }
  const ready = await new Promise<boolean>((resolve) => {
    const ok = JEELIZFACEFILTER.init({
      canvas,
      NNC,
      followZRot: true,
      animateDelay: 2,
      isKeepRunningOnWinFocusLost: true,
      videoSettings: { videoElement: video },
      callbackReady: (errCode) => {
        resolve(!errCode);
      },
      callbackTrack: (detectState) => {
        face = mixFace(detectState);
      },
    });
    if (!ok) {
      resolve(false);
    }
  });
  if (!ready) {
    canvas.remove();
    return null;
  }
  tracker = JEELIZFACEFILTER;
  trackerVideo = video;
  trackerCanvas = canvas;
  return tracker;
};

const releaseTracker = () => {
  if (trackerUsers > 0) {
    return;
  }
  face = { ...face, ok: false, firing: false };
  if (tracker) {
    void tracker.toggle_pause(true, false).catch(() => undefined);
  }
};

export const startJayrrCameraFun = (
  elementId: string,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  getOffset: (target: CameraFunTarget) => CameraFunOffset,
  glassesOn: boolean,
  laserOn: boolean,
  eyeLasersOn: boolean,
  getAccessory: () => CameraAccessory = () => "glasses",
): StopFun => {
  let cancelled = false;
  let stopLoop: StopFun = () => undefined;
  const eyeLasers = eyeLasersOn ? createEyeLasers(video) : null;
  const beamCanvas =
    laserOn || eyeLasersOn ? video.ownerDocument.createElement("canvas") : null;
  const needsTracker = glassesOn || laserOn;
  if (needsTracker) {
    trackerUsers += 1;
  }
  void waitVideo(video)
    .then(() => {
      if (cancelled) {
        return null;
      }
      if (needsTracker) {
        void loadTracker(video)
          .then((api) => {
            if (cancelled) {
              releaseTracker();
            } else if (api) {
              sizeTracker(video, trackerCanvas ?? canvas);
            }
          })
          .catch(() => undefined);
      }
      let published = false;
      stopLoop = loopVideo(
        video,
        () => cancelled,
        () => {
          if (
            !paintFun(
              elementId,
              video,
              canvas,
              getOffset,
              glassesOn,
              getAccessory(),
            )
          ) {
            return;
          }
          if (beamCanvas) {
            paintBeams(
              elementId,
              beamCanvas,
              canvas.width,
              canvas.height,
              (context) => {
                if (laserOn) {
                  drawMouthLaser(
                    context,
                    canvas.width,
                    canvas.height,
                    face,
                    getOffset("laser"),
                  );
                }
                eyeLasers?.draw(
                  context,
                  getOffset("eyeLasers"),
                  canvas.width,
                  canvas.height,
                );
              },
            );
          }
          if (published) {
            return;
          }
          published = true;
          setJayrrCameraFun(elementId, canvas);
        },
      );
    })
    .catch(() => undefined);

  return () => {
    cancelled = true;
    stopLoop();
    setJayrrCameraFun(elementId, null);
    beams.delete(elementId);
    eyeLasers?.stop();
    if (needsTracker) {
      trackerUsers = Math.max(0, trackerUsers - 1);
      releaseTracker();
    }
  };
};
