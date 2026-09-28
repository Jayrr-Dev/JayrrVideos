import { getCornerRadius } from "@excalidraw/element/utils";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type {
  InteractiveCanvasAppState,
  StaticCanvasAppState,
} from "@excalidraw/excalidraw/types";

import { appJotaiStore } from "../app-jotai";
import { readCaption } from "../domain/transcription";

import {
  JAYRR_CAMERA_ZOOM_DEFAULT,
  cameraLookFilter,
  canLinkJayrrCamera,
  isFullDisplayCrop,
  readCameraLook,
  readDisplayCrop,
  readDisplayFit,
  readJayrrCamera,
  type JayrrObjectFit,
} from "./jayrrCamera";
import { getJayrrCameraCutout } from "./jayrrCameraCutout";
import {
  getJayrrCameraBeams,
  getJayrrCameraFun,
  setJayrrCameraAim,
} from "./jayrrCameraFun";
import { desktopCropElementIdAtom } from "./jayrrDisplayCrop";

const videos = new Map<string, HTMLVideoElement>();

// Last known pointer position, so lasers can aim at the cursor.
let pointer: { x: number; y: number } | null = null;
if (typeof window !== "undefined") {
  window.addEventListener(
    "pointermove",
    (event) => {
      pointer = { x: event.clientX, y: event.clientY };
    },
    { passive: true },
  );
}

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

/** Where source pixel (0, 0) landed in the box, and the source-to-box scale. */
type Placement = { scale: number; x: number; y: number };

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
): Placement => {
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
  return {
    scale: drawW / sw,
    x: (width - drawW) / 2 - sx * (drawW / sw),
    y: (height - drawH) / 2 - sy * (drawH / sh),
  };
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

  const mirrored = video.dataset.jayrrMirror === "1";
  const enterBox = () => {
    context.translate(x + element.width / 2, y + element.height / 2);
    context.rotate(element.angle);
    context.translate(-element.width / 2 + pad, -element.height / 2 + pad);
  };
  const enterPicture = (zoom: number) => {
    if (mirrored) {
      context.translate(width, 0);
      context.scale(-1, 1);
    }
    if (zoom < JAYRR_CAMERA_ZOOM_DEFAULT) {
      const scale = zoom / JAYRR_CAMERA_ZOOM_DEFAULT;
      context.translate(width / 2, height / 2);
      context.scale(scale, scale);
      context.translate(-width / 2, -height / 2);
    }
  };
  let placement: Placement | null = null;
  let zoom = JAYRR_CAMERA_ZOOM_DEFAULT;

  context.save();
  try {
    enterBox();
    clipFill(context, element, pad, width, height);
    const look = readCameraLook(camera);
    zoom = look.zoom;
    context.filter = cameraLookFilter(look);
    enterPicture(zoom);
    const fun = getJayrrCameraFun(element.id);
    const cutout = getJayrrCameraCutout(element.id);
    let source: CanvasImageSource = video;
    let sourceW = video.videoWidth || width;
    let sourceH = video.videoHeight || height;
    if (fun && fun.width > 1 && fun.height > 1) {
      source = fun;
      sourceW = fun.width;
      sourceH = fun.height;
    } else if (cutout && cutout.width > 1 && cutout.height > 1) {
      source = cutout;
      sourceW = cutout.width;
      sourceH = cutout.height;
    }
    const editingCrop =
      appJotaiStore.get(desktopCropElementIdAtom) === element.id;
    const crop = editingCrop ? undefined : readDisplayCrop(camera);
    const useCrop = crop && !isFullDisplayCrop(crop);
    let sx = useCrop ? crop.x * sourceW : 0;
    let sy = useCrop ? crop.y * sourceH : 0;
    let sw = useCrop ? crop.width * sourceW : sourceW;
    let sh = useCrop ? crop.height * sourceH : sourceH;
    if (look.zoom > JAYRR_CAMERA_ZOOM_DEFAULT) {
      const scale = JAYRR_CAMERA_ZOOM_DEFAULT / look.zoom;
      sx += (sw * (1 - scale)) / 2;
      sy += (sh * (1 - scale)) / 2;
      sw *= scale;
      sh *= scale;
    }
    placement = drawFitted(
      context,
      source,
      sourceW,
      sourceH,
      width,
      height,
      readDisplayFit(camera),
      sx,
      sy,
      sw,
      sh,
    );
    paintCaption(context, readCaption(element.id), width, height);
  } catch {
    // A bad video frame must not wipe the rest of the scene.
  }
  context.restore();

  // Lasers skip the box clip so they can shoot out past its edge.
  const beams = getJayrrCameraBeams(element.id);
  if (!beams || !placement) {
    return;
  }
  if (pointer) {
    // Pointer -> box space -> undo the picture's mirror/zoom -> picture pixels.
    const zoomValue = appState.zoom.value;
    const dx =
      (pointer.x - appState.offsetLeft) / zoomValue - (x + element.width / 2);
    const dy =
      (pointer.y - appState.offsetTop) / zoomValue - (y + element.height / 2);
    const cos = Math.cos(element.angle);
    const sin = Math.sin(element.angle);
    let px = dx * cos + dy * sin + element.width / 2 - pad;
    const py0 = -dx * sin + dy * cos + element.height / 2 - pad;
    let py = py0;
    if (mirrored) {
      px = width - px;
    }
    if (zoom < JAYRR_CAMERA_ZOOM_DEFAULT) {
      const shrink = zoom / JAYRR_CAMERA_ZOOM_DEFAULT;
      px = (px - width / 2) / shrink + width / 2;
      py = (py - height / 2) / shrink + height / 2;
    }
    setJayrrCameraAim(element.id, {
      x: (px - placement.x) / placement.scale,
      y: (py - placement.y) / placement.scale,
    });
  }
  context.save();
  try {
    enterBox();
    enterPicture(zoom);
    const k = placement.scale;
    context.imageSmoothingEnabled = true;
    context.drawImage(
      beams.canvas,
      placement.x - beams.margin * k,
      placement.y - beams.margin * k,
      (beams.canvas.width / beams.scale) * k,
      (beams.canvas.height / beams.scale) * k,
    );
  } catch {
    // A bad beam frame must not wipe the rest of the scene.
  }
  context.restore();
};
