import { MIN_WIDTH_OR_HEIGHT } from "@excalidraw/common";
import { isFrameLikeElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

export const JAYRR_FRAME_KEY = "jayrrFrame";

export const JAYRR_FRAME_ASPECTS = [
  "free",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "1:1",
  "4:5",
  "21:9",
] as const;

export type JayrrFrameAspect = typeof JAYRR_FRAME_ASPECTS[number];

export const JAYRR_FRAME_GRIDS = [
  "none",
  "thirds",
  "center",
  "grid",
  "mobile",
  "square",
  "widescreen",
] as const;

export type JayrrFrameGrid = typeof JAYRR_FRAME_GRIDS[number];

export type JayrrFrameSettings = {
  aspect: JayrrFrameAspect;
  grid: JayrrFrameGrid;
  hideFromPresent: boolean;
};

const DEFAULT_SETTINGS: JayrrFrameSettings = {
  aspect: "free",
  grid: "none",
  hideFromPresent: false,
};

export const canConfigureJayrrFrame = (element: ExcalidrawElement) =>
  isFrameLikeElement(element);

const isAspect = (value: unknown): value is JayrrFrameAspect =>
  typeof value === "string" &&
  (JAYRR_FRAME_ASPECTS as readonly string[]).includes(value);

const isGrid = (value: unknown): value is JayrrFrameGrid =>
  typeof value === "string" &&
  (JAYRR_FRAME_GRIDS as readonly string[]).includes(value);

export const jayrrFrameAspectValue = (aspect: JayrrFrameAspect) => {
  if (aspect === "free") {
    return null;
  }
  const [width, height] = aspect.split(":").map(Number);
  if (!width || !height) {
    return null;
  }
  return width / height;
};

export const readJayrrFrame = (
  element: ExcalidrawElement,
): JayrrFrameSettings => {
  const data = element.customData?.[JAYRR_FRAME_KEY];
  if (!data || typeof data !== "object") {
    return DEFAULT_SETTINGS;
  }
  const bag = data as {
    aspect?: unknown;
    grid?: unknown;
    hideFromPresent?: unknown;
  };
  return {
    aspect: isAspect(bag.aspect) ? bag.aspect : DEFAULT_SETTINGS.aspect,
    grid: isGrid(bag.grid) ? bag.grid : DEFAULT_SETTINGS.grid,
    hideFromPresent: bag.hideFromPresent === true,
  };
};

export const writeJayrrFrame = (
  element: ExcalidrawElement,
  settings: JayrrFrameSettings,
): ExcalidrawElement["customData"] => {
  const customData: Record<string, unknown> = {
    ...(element.customData ?? {}),
  };
  const isDefault =
    settings.aspect === DEFAULT_SETTINGS.aspect &&
    settings.grid === DEFAULT_SETTINGS.grid &&
    settings.hideFromPresent === DEFAULT_SETTINGS.hideFromPresent;
  if (isDefault) {
    delete customData[JAYRR_FRAME_KEY];
  } else {
    customData[JAYRR_FRAME_KEY] = settings;
  }
  return Object.keys(customData).length
    ? (customData as ExcalidrawElement["customData"])
    : undefined;
};

export const applyJayrrFrameAspect = (
  element: ExcalidrawElement,
  aspect: JayrrFrameAspect,
) => {
  const ratio = jayrrFrameAspectValue(aspect);
  if (!ratio) {
    return {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    };
  }
  const height = Math.max(MIN_WIDTH_OR_HEIGHT, element.width / ratio);
  return {
    x: element.x,
    y: element.y + (element.height - height) / 2,
    width: element.width,
    height,
  };
};
