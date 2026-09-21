import type { ExcalidrawElement } from "@excalidraw/element/types";

import { JAYRR_CALLED_OBJECT_KEY } from "../model";

export const JEV_SHOW_KEYS = [
  "iq",
  "smart",
  "hype",
  "energy",
  "online",
  "socion",
  "bigFive",
  "mbti",
  "mbtiAdvance",
  "enneagram",
  "hogwarts",
  "genderStyle",
  "emotion",
  "truth",
] as const;

export type JevShowKey = typeof JEV_SHOW_KEYS[number];

export const JEV_SHOW_WHERE = ["line", "speaker", "both"] as const;

export type JevShowWhere = typeof JEV_SHOW_WHERE[number];

export const DEFAULT_JEV_SHOW: JevShowWhere = "both";

export const JEV_TOP_KEYS = JEV_SHOW_KEYS;

export type JevTopKey = JevShowKey;

export const JEV_TOP_MAX = 5;

export const JEV_TOP_OPTIONS = [1, 2, 3, 4, 5] as const;

export const DEFAULT_JEV_TOP: Record<JevTopKey, number> = {
  iq: 1,
  smart: 1,
  hype: 1,
  energy: 1,
  online: 1,
  socion: 1,
  bigFive: 1,
  mbti: 1,
  mbtiAdvance: 2,
  enneagram: 1,
  hogwarts: 1,
  genderStyle: 1,
  emotion: 3,
  truth: 1,
};

export type TranscribeConfig = {
  contextEnabled?: boolean;
  configOpen?: boolean;
  jevIq: boolean;
  jevSmart: boolean;
  jevMbti: boolean;
  jevMbtiAdvance: boolean;
  jevEnneagram: boolean;
  jevHogwarts: boolean;
  jevGenderStyle: boolean;
  jevHype: boolean;
  jevEnergy: boolean;
  jevOnline: boolean;
  jevSocion: boolean;
  jevBigFive: boolean;
  jevEmotion: boolean;
  jevTruth: boolean;
  jevShow?: Partial<Record<JevShowKey, JevShowWhere>>;
  jevShowScore?: Partial<Record<JevShowKey, boolean>>;
  jevTop?: Partial<Record<JevTopKey, number>>;
  sourceId: string;
};

export const DEFAULT_TRANSCRIBE: TranscribeConfig = {
  contextEnabled: true,
  configOpen: false,
  jevIq: false,
  jevSmart: false,
  jevMbti: false,
  jevMbtiAdvance: false,
  jevEnneagram: false,
  jevHogwarts: false,
  jevGenderStyle: false,
  jevHype: false,
  jevEnergy: false,
  jevOnline: false,
  jevSocion: false,
  jevBigFive: false,
  jevEmotion: false,
  jevTruth: false,
  jevShow: {},
  jevShowScore: {},
  jevTop: {},
  sourceId: "mic",
};

const readShowWhere = (value: unknown): JevShowWhere | null => {
  if (value === "line" || value === "speaker" || value === "both") {
    return value;
  }
  return null;
};

const readJevShow = (
  value: unknown,
): Partial<Record<JevShowKey, JevShowWhere>> => {
  if (!value || typeof value !== "object") {
    return {};
  }
  const bag = value as Record<string, unknown>;
  const next: Partial<Record<JevShowKey, JevShowWhere>> = {};
  for (const key of JEV_SHOW_KEYS) {
    const where = readShowWhere(bag[key]);
    if (where) {
      next[key] = where;
    }
  }
  return next;
};

const clampTop = (value: number) =>
  Math.min(JEV_TOP_MAX, Math.max(1, Math.round(value)));

const readJevShowScore = (
  value: unknown,
): Partial<Record<JevShowKey, boolean>> => {
  if (!value || typeof value !== "object") {
    return {};
  }
  const bag = value as Record<string, unknown>;
  const next: Partial<Record<JevShowKey, boolean>> = {};
  for (const key of JEV_SHOW_KEYS) {
    if (bag[key] === true) {
      next[key] = true;
    }
  }
  return next;
};

const readJevTop = (value: unknown): Partial<Record<JevTopKey, number>> => {
  if (!value || typeof value !== "object") {
    return {};
  }
  const bag = value as Record<string, unknown>;
  const next: Partial<Record<JevTopKey, number>> = {};
  for (const key of JEV_TOP_KEYS) {
    const count = bag[key];
    if (typeof count === "number" && Number.isFinite(count)) {
      next[key] = clampTop(count);
    }
  }
  return next;
};

export const jevTopCount = (config: TranscribeConfig, key: JevTopKey) =>
  clampTop(config.jevTop?.[key] ?? DEFAULT_JEV_TOP[key]);

export const jevShowWhere = (
  config: TranscribeConfig,
  key: JevShowKey,
): JevShowWhere => config.jevShow?.[key] ?? DEFAULT_JEV_SHOW;

export const jevShowScoreOn = (config: TranscribeConfig, key: JevShowKey) =>
  config.jevShowScore?.[key] === true;

export const jevScoreVisible = (
  config: TranscribeConfig,
  enabled: boolean,
  key: JevShowKey,
  place: "line" | "speaker",
) => {
  if (!enabled) {
    return false;
  }
  const where = jevShowWhere(config, key);
  return where === "both" || where === place;
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
    ...DEFAULT_TRANSCRIBE,
    contextEnabled:
      (bag as { contextEnabled?: unknown }).contextEnabled !== false,
    configOpen: (bag as { configOpen?: unknown }).configOpen === true,
    jevIq: (bag as { jevIq?: unknown }).jevIq === true,
    jevSmart: (bag as { jevSmart?: unknown }).jevSmart === true,
    jevMbti: (bag as { jevMbti?: unknown }).jevMbti === true,
    jevMbtiAdvance:
      (bag as { jevMbtiAdvance?: unknown }).jevMbtiAdvance === true,
    jevEnneagram: (bag as { jevEnneagram?: unknown }).jevEnneagram === true,
    jevHogwarts: (bag as { jevHogwarts?: unknown }).jevHogwarts === true,
    jevGenderStyle:
      (bag as { jevGenderStyle?: unknown }).jevGenderStyle === true,
    jevHype: (bag as { jevHype?: unknown }).jevHype === true,
    jevEnergy: (bag as { jevEnergy?: unknown }).jevEnergy === true,
    jevOnline: (bag as { jevOnline?: unknown }).jevOnline === true,
    jevSocion: (bag as { jevSocion?: unknown }).jevSocion === true,
    jevBigFive: (bag as { jevBigFive?: unknown }).jevBigFive === true,
    jevEmotion: (bag as { jevEmotion?: unknown }).jevEmotion === true,
    jevTruth: (bag as { jevTruth?: unknown }).jevTruth === true,
    jevShow: readJevShow((bag as { jevShow?: unknown }).jevShow),
    jevShowScore: readJevShowScore(
      (bag as { jevShowScore?: unknown }).jevShowScore,
    ),
    jevTop: readJevTop((bag as { jevTop?: unknown }).jevTop),
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
  bag.contextEnabled = config.contextEnabled === true;
  bag.configOpen = config.configOpen === true;
  bag.jevIq = config.jevIq;
  bag.jevSmart = config.jevSmart;
  bag.jevMbti = config.jevMbti;
  bag.jevMbtiAdvance = config.jevMbtiAdvance;
  bag.jevEnneagram = config.jevEnneagram;
  bag.jevHogwarts = config.jevHogwarts;
  bag.jevGenderStyle = config.jevGenderStyle;
  bag.jevHype = config.jevHype;
  bag.jevEnergy = config.jevEnergy;
  bag.jevOnline = config.jevOnline;
  bag.jevSocion = config.jevSocion;
  bag.jevBigFive = config.jevBigFive;
  bag.jevEmotion = config.jevEmotion;
  bag.jevTruth = config.jevTruth;
  bag.jevShow = config.jevShow ?? {};
  bag.jevShowScore = config.jevShowScore ?? {};
  bag.jevTop = config.jevTop ?? {};
  bag.sourceId = config.sourceId;
  return {
    ...(element.customData ?? {}),
    [JAYRR_CALLED_OBJECT_KEY]: bag,
  };
};
