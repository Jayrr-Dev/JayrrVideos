import type { ExcalidrawElement } from "@excalidraw/element/types";

import { JAYRR_CALLED_OBJECT_KEY } from "../model";

export type TranscribeConfig = {
  jevIq: boolean;
  jevMbti: boolean;
  sourceId: string;
};

export const DEFAULT_TRANSCRIBE: TranscribeConfig = {
  jevIq: false,
  jevMbti: false,
  sourceId: "mic",
};

export const readTranscribeConfig = (
  element: Pick<ExcalidrawElement, "customData">,
): TranscribeConfig => {
  const bag = element.customData?.[JAYRR_CALLED_OBJECT_KEY];
  if (!bag || typeof bag !== "object") {
    return DEFAULT_TRANSCRIBE;
  }
  const sourceId = (bag as { sourceId?: unknown }).sourceId;
  return {
    jevIq: (bag as { jevIq?: unknown }).jevIq === true,
    jevMbti: (bag as { jevMbti?: unknown }).jevMbti === true,
    sourceId: typeof sourceId === "string" && sourceId ? sourceId : "mic",
  };
};

export const writeTranscribeConfig = (
  element: Pick<ExcalidrawElement, "customData">,
  config: TranscribeConfig,
): ExcalidrawElement["customData"] => {
  const previous = element.customData?.[JAYRR_CALLED_OBJECT_KEY];
  const bag: Record<string, unknown> =
    previous && typeof previous === "object"
      ? { ...(previous as Record<string, unknown>) }
      : {};
  bag.kind = "transcribe";
  bag.jevIq = config.jevIq;
  bag.jevMbti = config.jevMbti;
  bag.sourceId = config.sourceId;
  return {
    ...(element.customData ?? {}),
    [JAYRR_CALLED_OBJECT_KEY]: bag,
  };
};
