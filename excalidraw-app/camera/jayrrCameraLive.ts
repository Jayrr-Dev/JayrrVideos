import { getCornerRadius } from "@excalidraw/element/utils";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type {
  InteractiveCanvasAppState,
  StaticCanvasAppState,
} from "@excalidraw/excalidraw/types";

import { appJotaiStore } from "../app-jotai";
import { readCaption } from "../domain/transcription";

import {
  canLinkJayrrCamera,
  isFullDisplayCrop,
  isJayrrDisplay,
  readDisplayCrop,
  readDisplayFit,
  readJayrrCamera,
  type JayrrObjectFit,
} from "./jayrrCamera";
import { getJayrrCameraCutout } from "./jayrrCameraCutout";
import { desktopCropElementIdAtom } from "./jayrrDisplayCrop";

const videos = new Map<string, HTMLVideoElement>();

export const setJayrrCameraVideo = (
  elementId: string,
  video: HTMLVideoElement | null,
) => {
  if (video) {
    videos.set(elementId, video);
    return;
  }
  videos.delete(elementId);
};

export const getJayrrCameraVideo = (elementId: string) =>
  videos.get(elementId) ?? null;

const clipFill = (
  context: CanvasRenderingContext2D,
  element: NonDeletedExcalidrawElement,
  pad: number,
  width: number,
  height: number,
) => {
  context.beginPath();
  if (element.type === "ellipse") {
    context.ellipse(
      width / 2,
      height / 2,
      Math.max(0, width / 2),
      Math.max(0, height / 2),
      0,
      0,
      Math.PI * 2,
    );
  } else if (element.type === "diamond") {
    context.moveTo(width / 2, 0);
    context.lineTo(width, height / 2);
    context.lineTo(width / 2, height);
    context.lineTo(0, height / 2);
    context.closePath();
  } else {
    const radius = Math.max(
      0,
      getCornerRadius(Math.min(element.width, element.height), element) - pad,
    );
    if (context.roundRect) {
      context.roundRect(0, 0, width, height, radius);
    } else {
      context.rect(0, 0, width, height);
    }
  }
  context.clip();
};

const drawFitted = (
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  width: number,
  height: number,
  fit: JayrrObjectFit,
  cropX = 0,
  cropY = 0,
  cropW = sourceW,
  cropH = sourceH,
) => {
  const sx = Math.max(0, cropX);
  const sy = Math.max(0, cropY);
  const sw = Math.max(1, Math.min(cropW, sourceW - sx));
  const sh = Math.max(1, Math.min(cropH, sourceH - sy));
  let drawW = width;
  let drawH = height;
  if (fit === "none" || (fit === "scale-down" && sw <= width && sh <= height)) {
    drawW = sw;
    drawH = sh;
  } else if (fit !== "fill") {
    const scale =
      fit === "contain" || fit === "scale-down"
        ? Math.min(width / sw, height / sh)
        : Math.max(width / sw, height / sh);
    drawW = sw * scale;
    drawH = sh * scale;
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    source,
    sx,
    sy,
    sw,
    sh,
    (width - drawW) / 2,
    (height - drawH) / 2,
    drawW,
    drawH,
  );
};

const wrapCaption = (
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines.slice(-3);
};

const paintCaption = (
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
  height: number,
) => {
  if (!text) {
    return;
  }
  const pad = 8;
  const fontSize = Math.max(12, Math.min(20, width / 16));
  context.font = `600 ${fontSize}px Assistant, sans-serif`;
  const lines = wrapCaption(context, text, width - pad * 2);
  if (lines.length === 0) {
    return;
  }
  const lineHeight = fontSize * 1.25;
  const barH = Math.min(height * 0.4, pad * 2 + lines.length * lineHeight);
  context.fillStyle = "rgba(0, 0, 0, 0.58)";
  context.fillRect(0, height - barH, width, barH);
  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.textBaseline = "top";
  const startY = height - barH + pad;
  lines.forEach((line, index) => {
    context.fillText(
      line,
      width / 2,
      startY + index * lineHeight,
      width - pad * 2,
    );
  });
};

export const paintJayrrCameraLive = (
  element: NonDeletedExcalidrawElement,
  context: CanvasRenderingContext2D,
  appState: StaticCanvasAppState | InteractiveCanvasAppState,
  renderState: {
    opacity: number;
    offset: Readonly<{ x: number; y: number }>;
  },
) => {
  if (!canLinkJayrrCamera(element)) {
    return;
  }
  const camera = readJayrrCamera(element);
  if (!camera) {
    return;
  }
  const video = videos.get(element.id);
  if (!video || video.readyState < 2 || video.videoWidth < 2) {
    return;
  }

  const pad = element.strokeWidth;
  const width = Math.max(0, element.width - pad * 2);
  const height = Math.max(0, element.height - pad * 2);
  if (!width || !height) {
    return;
  }
  const x = element.x + renderState.offset.x + appState.scrollX;
  const y = element.y + renderState.offset.y + appState.scrollY;

  context.save();
  try {
    context.translate(x + element.width / 2, y + element.height / 2);
    context.rotate(element.angle);
    context.translate(-element.width / 2 + pad, -element.height / 2 + pad);
    clipFill(context, element, pad, width, height);
    if (video.dataset.jayrrMirror === "1") {
      context.translate(width, 0);
      context.scale(-1, 1);
    }
    const cutout = getJayrrCameraCutout(element.id);
    let source: CanvasImageSource = video;
    let sourceW = video.videoWidth || width;
    let sourceH = video.videoHeight || height;
    if (cutout) {
      if (cutout.width > 1 && cutout.height > 1) {
        source = cutout;
        sourceW = cutout.width;
        sourceH = cutout.height;
      }
    }
    const editingCrop =
      appJotaiStore.get(desktopCropElementIdAtom) === element.id;
    const crop =
      !editingCrop && isJayrrDisplay(camera)
        ? readDisplayCrop(camera)
        : undefined;
    const useCrop = crop && !isFullDisplayCrop(crop);
    drawFitted(
      context,
      source,
      sourceW,
      sourceH,
      width,
      height,
      isJayrrDisplay(camera) ? readDisplayFit(camera) : "cover",
      useCrop ? crop.x * sourceW : 0,
      useCrop ? crop.y * sourceH : 0,
      useCrop ? crop.width * sourceW : sourceW,
      useCrop ? crop.height * sourceH : sourceH,
    );
    paintCaption(context, readCaption(element.id), width, height);
  } catch {
    // A bad video frame must not wipe the rest of the scene.
  }
  context.restore();
};
