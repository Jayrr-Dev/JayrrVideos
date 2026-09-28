import { getCornerRadius } from "@excalidraw/element/utils";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type {
  InteractiveCanvasAppState,
  StaticCanvasAppState,
} from "@excalidraw/excalidraw/types";

import { canUseJayrrBgMedia, readJayrrBgMedia } from "./jayrrBgMedia";

const sources = new Map<string, CanvasImageSource>();

export const setJayrrBgMediaSource = (
  elementId: string,
  source: CanvasImageSource | null,
) => {
  if (source) {
    sources.set(elementId, source);
    return;
  }
  sources.delete(elementId);
};

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

const sourceSize = (source: CanvasImageSource) => {
  if ("videoWidth" in source) {
    return {
      width: Number(source.videoWidth) || 0,
      height: Number(source.videoHeight) || 0,
    };
  }
  if ("naturalWidth" in source) {
    return {
      width: Number(source.naturalWidth) || Number(source.width) || 0,
      height: Number(source.naturalHeight) || Number(source.height) || 0,
    };
  }
  if ("width" in source) {
    return {
      width: Number(source.width) || 0,
      height: Number(source.height) || 0,
    };
  }
  return { width: 0, height: 0 };
};

export const paintJayrrBgMedia = (
  element: NonDeletedExcalidrawElement,
  context: CanvasRenderingContext2D,
  appState: StaticCanvasAppState | InteractiveCanvasAppState,
  renderState: {
    opacity: number;
    offset: Readonly<{ x: number; y: number }>;
  },
) => {
  if (!canUseJayrrBgMedia(element) || !readJayrrBgMedia(element)) {
    return;
  }
  const source = sources.get(element.id);
  if (!source) {
    return;
  }
  const size = sourceSize(source);
  if (size.width < 2 || size.height < 2) {
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
  const scale = Math.max(width / size.width, height / size.height);
  const drawW = size.width * scale;
  const drawH = size.height * scale;

  context.save();
  try {
    context.translate(x + element.width / 2, y + element.height / 2);
    context.rotate(element.angle);
    context.translate(-element.width / 2 + pad, -element.height / 2 + pad);
    clipFill(context, element, pad, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      source,
      (width - drawW) / 2,
      (height - drawH) / 2,
      drawW,
      drawH,
    );
  } catch {
    // A bad frame must not wipe the rest of the scene.
  }
  context.restore();
};
