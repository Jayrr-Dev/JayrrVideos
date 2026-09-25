import { atom } from "../app-jotai";

import {
  FULL_DISPLAY_CROP,
  MIN_DISPLAY_CROP,
  clampDisplayCrop,
  type JayrrDisplayCrop,
} from "./jayrrCamera";

export const desktopCropElementIdAtom = atom<string | null>(null);

export type DisplayCropHandle =
  | "move"
  | "n"
  | "s"
  | "e"
  | "w"
  | "nw"
  | "ne"
  | "sw"
  | "se";

export const DISPLAY_CROP_HANDLES: readonly DisplayCropHandle[] = [
  "n",
  "s",
  "e",
  "w",
  "nw",
  "ne",
  "sw",
  "se",
];

export const fitRect = (
  sourceW: number,
  sourceH: number,
  boxW: number,
  boxH: number,
  fit: "contain" | "cover" | "fill" | "none" | "scale-down",
) => {
  const safeW = Math.max(sourceW, 1);
  const safeH = Math.max(sourceH, 1);
  if (fit === "fill") {
    return { x: 0, y: 0, width: boxW, height: boxH };
  }
  if (
    fit === "none" ||
    (fit === "scale-down" && safeW <= boxW && safeH <= boxH)
  ) {
    return {
      x: (boxW - safeW) / 2,
      y: (boxH - safeH) / 2,
      width: safeW,
      height: safeH,
    };
  }
  const scale =
    fit === "contain" || fit === "scale-down"
      ? Math.min(boxW / safeW, boxH / safeH)
      : Math.max(boxW / safeW, boxH / safeH);
  const width = safeW * scale;
  const height = safeH * scale;
  return {
    x: (boxW - width) / 2,
    y: (boxH - height) / 2,
    width,
    height,
  };
};

export const containRect = (
  sourceW: number,
  sourceH: number,
  boxW: number,
  boxH: number,
) => {
  const scale = Math.min(
    boxW / Math.max(sourceW, 1),
    boxH / Math.max(sourceH, 1),
  );
  const width = sourceW * scale;
  const height = sourceH * scale;
  return {
    x: (boxW - width) / 2,
    y: (boxH - height) / 2,
    width,
    height,
  };
};

export const applyDisplayCropHandle = (
  crop: JayrrDisplayCrop,
  handle: DisplayCropHandle,
  nextX: number,
  nextY: number,
  start: JayrrDisplayCrop,
  originX: number,
  originY: number,
): JayrrDisplayCrop => {
  if (handle === "move") {
    return clampDisplayCrop({
      ...start,
      x: start.x + (nextX - originX),
      y: start.y + (nextY - originY),
    });
  }

  const left = start.x;
  const top = start.y;
  const right = start.x + start.width;
  const bottom = start.y + start.height;
  let nextLeft = left;
  let nextTop = top;
  let nextRight = right;
  let nextBottom = bottom;

  if (handle.includes("w")) {
    nextLeft = Math.min(nextX, right - MIN_DISPLAY_CROP);
  }
  if (handle.includes("e")) {
    nextRight = Math.max(nextX, left + MIN_DISPLAY_CROP);
  }
  if (handle.includes("n")) {
    nextTop = Math.min(nextY, bottom - MIN_DISPLAY_CROP);
  }
  if (handle.includes("s")) {
    nextBottom = Math.max(nextY, top + MIN_DISPLAY_CROP);
  }

  return clampDisplayCrop({
    x: nextLeft,
    y: nextTop,
    width: nextRight - nextLeft,
    height: nextBottom - nextTop,
  });
};

export { FULL_DISPLAY_CROP };
