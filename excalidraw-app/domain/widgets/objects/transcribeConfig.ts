import type { ExcalidrawElement } from "@excalidraw/element/types";

import { JAYRR_CALLED_OBJECT_KEY } from "../model";

export type TranscribeConfig = {
  jevIq: boolean;
  jevSmart: boolean;
  jevMbti: boolean;
  jevMbtiAdvance: boolean;
  jevEnneagram: boolean;
  jevHype: boolean;
  jevEnergy: boolean;
  jevOnline: boolean;
  jevSocion: boolean;
  jevBigFive: boolean;
  jevEmotion: boolean;
  sourceId: string;
};

export const DEFAULT_TRANSCRIBE: TranscribeConfig = {
  jevIq: false,
  jevSmart: false,
  jevMbti: false,
  jevMbtiAdvance: false,
  jevEnneagram: false,
  jevHype: false,
  jevEnergy: false,
  jevOnline: false,
  jevSocion: false,
  jevBigFive: false,
  jevEmotion: false,
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
    jevSmart: (bag as { jevSmart?: unknown }).jevSmart === true,
    jevMbti: (bag as { jevMbti?: unknown }).jevMbti === true,
    jevMbtiAdvance:
      (bag as { jevMbtiAdvance?: unknown }).jevMbtiAdvance === true,
    jevEnneagram: (bag as { jevEnneagram?: unknown }).jevEnneagram === true,
    jevHype: (bag as { jevHype?: unknown }).jevHype === true,
    jevEnergy: (bag as { jevEnergy?: unknown }).jevEnergy === true,
    jevOnline: (bag as { jevOnline?: unknown }).jevOnline === true,
    jevSocion: (bag as { jevSocion?: unknown }).jevSocion === true,
    jevBigFive: (bag as { jevBigFive?: unknown }).jevBigFive === true,
    jevEmotion: (bag as { jevEmotion?: unknown }).jevEmotion === true,
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
  bag.jevSmart = config.jevSmart;
  bag.jevMbti = config.jevMbti;
  bag.jevMbtiAdvance = config.jevMbtiAdvance;
  bag.jevEnneagram = config.jevEnneagram;
  bag.jevHype = config.jevHype;
  bag.jevEnergy = config.jevEnergy;
  bag.jevOnline = config.jevOnline;
  bag.jevSocion = config.jevSocion;
  bag.jevBigFive = config.jevBigFive;
  bag.jevEmotion = config.jevEmotion;
  bag.sourceId = config.sourceId;
  return {
    ...(element.customData ?? {}),
    [JAYRR_CALLED_OBJECT_KEY]: bag,
  };
};
