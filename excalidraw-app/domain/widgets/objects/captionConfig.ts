import { newTextElement } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  FontFamilyValues,
  TextAlign,
} from "@excalidraw/element/types";

import { JAYRR_CALLED_OBJECT_KEY, JAYRR_CAPTION_FOR_KEY } from "../model";

export type CaptionConfig = {
  sourceId: string;
  textElementId: string;
};

export const DEFAULT_CAPTION: CaptionConfig = {
  sourceId: "mic",
  textElementId: "",
};

export const CAPTION_PLACEHOLDER = " ";

export const readCaptionConfig = (
  element: Pick<ExcalidrawElement, "customData">,
): CaptionConfig => {
  const bag = element.customData?.[JAYRR_CALLED_OBJECT_KEY];
  if (!bag || typeof bag !== "object") {
    return DEFAULT_CAPTION;
  }
  const sourceId = (bag as { sourceId?: unknown }).sourceId;
  const textElementId = (bag as { textElementId?: unknown }).textElementId;
  return {
    sourceId: typeof sourceId === "string" && sourceId ? sourceId : "mic",
    textElementId: typeof textElementId === "string" ? textElementId : "",
  };
};

export const writeCaptionConfig = (
  element: Pick<ExcalidrawElement, "customData">,
  config: CaptionConfig,
): ExcalidrawElement["customData"] => {
  const previous = element.customData?.[JAYRR_CALLED_OBJECT_KEY];
  const bag: Record<string, unknown> =
    previous && typeof previous === "object"
      ? { ...(previous as Record<string, unknown>) }
      : {};
  bag.kind = "caption";
  bag.sourceId = config.sourceId;
  bag.textElementId = config.textElementId;
  return {
    ...(element.customData ?? {}),
    [JAYRR_CALLED_OBJECT_KEY]: bag,
  };
};

export const newCaptionOverlayElement = (opts: {
  widgetId: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: FontFamilyValues;
  strokeColor: string;
  opacity: number;
  textAlign?: TextAlign;
}): ExcalidrawTextElement =>
  newTextElement({
    text: CAPTION_PLACEHOLDER,
    originalText: CAPTION_PLACEHOLDER,
    x: opts.x,
    y: opts.y,
    fontSize: opts.fontSize,
    fontFamily: opts.fontFamily,
    textAlign: opts.textAlign ?? "center",
    strokeColor: opts.strokeColor,
    backgroundColor: "transparent",
    fillStyle: "solid",
    roughness: 0,
    opacity: opts.opacity,
    customData: {
      [JAYRR_CAPTION_FOR_KEY]: opts.widgetId,
    },
  });
