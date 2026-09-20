import { newTextElement } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  FontFamilyValues,
  TextAlign,
} from "@excalidraw/element/types";

import { JAYRR_CALLED_OBJECT_KEY, JAYRR_CAPTION_FOR_KEY } from "../model";

export type TranscriptionConfig = {
  sourceId: string;
  textElementId: string;
};

export const DEFAULT_TRANSCRIPTION: TranscriptionConfig = {
  sourceId: "mic",
  textElementId: "",
};

export const TRANSCRIPTION_PLACEHOLDER = "Transcription";

export const readTranscriptionConfig = (
  element: Pick<ExcalidrawElement, "customData">,
): TranscriptionConfig => {
  const bag = element.customData?.[JAYRR_CALLED_OBJECT_KEY];
  if (!bag || typeof bag !== "object") {
    return DEFAULT_TRANSCRIPTION;
  }
  const sourceId = (bag as { sourceId?: unknown }).sourceId;
  const textElementId = (bag as { textElementId?: unknown }).textElementId;
  return {
    sourceId: typeof sourceId === "string" && sourceId ? sourceId : "mic",
    textElementId: typeof textElementId === "string" ? textElementId : "",
  };
};

export const writeTranscriptionConfig = (
  element: Pick<ExcalidrawElement, "customData">,
  config: TranscriptionConfig,
): ExcalidrawElement["customData"] => {
  const previous = element.customData?.[JAYRR_CALLED_OBJECT_KEY];
  const bag: Record<string, unknown> =
    previous && typeof previous === "object"
      ? { ...(previous as Record<string, unknown>) }
      : {};
  bag.kind = "transcription";
  bag.sourceId = config.sourceId;
  bag.textElementId = config.textElementId;
  return {
    ...(element.customData ?? {}),
    [JAYRR_CALLED_OBJECT_KEY]: bag,
  };
};

export const newCaptionTextElement = (opts: {
  widgetId: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: FontFamilyValues;
  textAlign: TextAlign;
  strokeColor: string;
  opacity: number;
}): ExcalidrawTextElement =>
  newTextElement({
    text: TRANSCRIPTION_PLACEHOLDER,
    originalText: TRANSCRIPTION_PLACEHOLDER,
    x: opts.x,
    y: opts.y,
    fontSize: opts.fontSize,
    fontFamily: opts.fontFamily,
    textAlign: opts.textAlign,
    strokeColor: opts.strokeColor,
    backgroundColor: "transparent",
    fillStyle: "solid",
    roughness: 0,
    opacity: opts.opacity,
    customData: {
      [JAYRR_CAPTION_FOR_KEY]: opts.widgetId,
    },
  });
