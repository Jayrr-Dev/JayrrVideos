import { arrayToMap } from "@excalidraw/common";
import {
  getBoundTextElement,
  isBoundToContainer,
  isFrameLikeElement,
  isTextElement,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { readJayrrFrame } from "../frame/jayrrFrame";

export const JAYRR_PRESENT_KEY = "jayrrPresent";
export const JAYRR_PRESENT_TAB = "jayrrPresent";
export const JAYRR_PRESENT_REVEAL_MS = 320;
export const JAYRR_PRESENT_SLIDE_Y = 18;
/** Viewport px above the slide so the frame name stays on screen. */
export const JAYRR_PRESENT_NAME_PAD = 36;
export const JAYRR_PRESENT_EDGE_PAD = 16;
/** Viewport inset when a reveal step is tagged Focus, so the shape sits centered. */
export const JAYRR_PRESENT_FOCUS_PAD = 72;
/** Longer ease so Focus Zoom can settle instead of snapping. */
export const JAYRR_PRESENT_ZOOM_MS = 850;
export const JAYRR_PRESENT_ZOOM_PERCENT_MIN = 10;
export const JAYRR_PRESENT_ZOOM_PERCENT_MAX = 400;
export const JAYRR_PRESENT_ZOOM_PERCENT_DEFAULT = 100;
export const JAYRR_PRESENT_TRANSLATION_TIME_DEFAULT = 500;
export const JAYRR_PRESENT_TRANSLATION_TIME_MIN = 50;
export const JAYRR_PRESENT_TRANSLATION_TIME_MAX = 8000;
export const JAYRR_PRESENT_TYPE_TIME_DEFAULT = 1000;
export const JAYRR_PRESENT_TYPE_TIME_MIN = 50;
export const JAYRR_PRESENT_TYPE_TIME_MAX = 8000;

export type PresentEffect = "focus" | "zoom" | "scale";

/** Pin the object to the viewport so it stays put while the camera moves. */
export type PresentCamera = "fixed";

export type PresentMotion =
  | "none"
  | "fade"
  | "fadeUp"
  | "fadeDown"
  | "fadeLeft"
  | "fadeRight";

export type PresentExit =
  | "fade"
  | "fadeUp"
  | "fadeDown"
  | "fadeLeft"
  | "fadeRight";

export type PresentEasing = "linear" | "easeIn" | "easeOut" | "easeInOut";

export type PresentPathKind = "line" | "spline" | "draw";

export type PresentPathPoint = {
  x: number;
  y: number;
};

export type PresentMoveKind = "move" | "showMove";

export type PresentTranslation = {
  kind: PresentMoveKind;
  time: number;
  easing: PresentEasing;
  pathKind: PresentPathKind;
  x: number;
  y: number;
  path?: PresentPathPoint[];
};

export const isPresentMove = (
  translation: PresentTranslation | null | undefined,
): translation is PresentTranslation =>
  translation?.kind === "move" || translation?.kind === "showMove";

export type PresentTextEffectKind = "typewriter" | "words";

export type PresentTextEffect = {
  kind: PresentTextEffectKind;
  time: number;
};

export type PresentRevealStep = {
  type: "reveal";
  frameId: string;
  elementId: string;
};

export type PresentFrameStep = {
  type: "showFrame";
  frameId: string;
};

/** Second click of Show n Move: the shape is already visible, then it travels. */
export type PresentMoveStep = {
  type: "move";
  frameId: string;
  elementId: string;
};

/** Extra click after the last object so motion-out can run in this frame. */
export type PresentFlushExitsStep = {
  type: "flushExits";
  frameId: string;
};

export type PresentStep =
  | PresentFrameStep
  | PresentRevealStep
  | PresentMoveStep
  | PresentFlushExitsStep;

export type PresentSound = {
  id: string;
  name: string;
  path?: string;
};

export type PresentObject = {
  id: string;
  label: string;
  order: number | null;
  effect: PresentEffect | null;
  camera: PresentCamera | null;
  motion: PresentMotion | null;
  exit: PresentExit | null;
  translation: PresentTranslation | null;
  zoomPercent: number | null;
  textEffect: PresentTextEffect | null;
  sound: PresentSound | null;
  skip: boolean;
  hide: boolean;
  groupId: string | null;
  memberIds: string[];
};

export type PresentFrame = {
  id: string;
  label: string;
  order: number | null;
  effect: PresentEffect | null;
  zoomPercent: number | null;
  sound: PresentSound | null;
  objects: PresentObject[];
};

export type PresentDeck = {
  frames: PresentFrame[];
  steps: PresentStep[];
};

type PresentBag = {
  order?: number;
  label?: string;
  effect?: PresentEffect;
  camera?: PresentCamera;
  motion?: PresentMotion;
  exit?: PresentExit;
  translation?: PresentTranslation;
  zoomPercent?: number;
  textEffect?: PresentTextEffect;
  sound?: PresentSound;
  skip?: boolean;
  hide?: boolean;
};

const readPresentEffect = (value: unknown): PresentEffect | null => {
  if (value === "focus" || value === "zoom" || value === "scale") {
    return value;
  }
  return null;
};

const readPresentCamera = (value: unknown): PresentCamera | null => {
  if (value === "fixed") {
    return value;
  }
  return null;
};

const readPresentMotionValue = (value: unknown): PresentMotion | null => {
  if (
    value === "none" ||
    value === "fade" ||
    value === "fadeUp" ||
    value === "fadeDown" ||
    value === "fadeLeft" ||
    value === "fadeRight"
  ) {
    return value;
  }
  return null;
};

const readPresentExit = (value: unknown): PresentExit | null => {
  if (
    value === "fade" ||
    value === "fadeUp" ||
    value === "fadeDown" ||
    value === "fadeLeft" ||
    value === "fadeRight"
  ) {
    return value;
  }
  return null;
};

const readPresentEasing = (value: unknown): PresentEasing | null => {
  if (
    value === "linear" ||
    value === "easeIn" ||
    value === "easeOut" ||
    value === "easeInOut"
  ) {
    return value;
  }
  return null;
};

const readPresentTime = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return JAYRR_PRESENT_TRANSLATION_TIME_DEFAULT;
  }
  return Math.min(
    JAYRR_PRESENT_TRANSLATION_TIME_MAX,
    Math.max(JAYRR_PRESENT_TRANSLATION_TIME_MIN, Math.round(value)),
  );
};

const readPresentDelta = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return value;
};

const readPresentPathKind = (value: unknown): PresentPathKind => {
  if (value === "spline" || value === "draw" || value === "line") {
    return value;
  }
  return "line";
};

const readPresentPath = (value: unknown): PresentPathPoint[] | undefined => {
  if (!Array.isArray(value) || value.length < 2) {
    return undefined;
  }
  const path: PresentPathPoint[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    path.push({
      x: readPresentDelta(Reflect.get(item, "x")),
      y: readPresentDelta(Reflect.get(item, "y")),
    });
  }
  if (path.length < 2) {
    return undefined;
  }
  return path;
};

const readPresentTranslation = (value: unknown): PresentTranslation | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const kind = Reflect.get(value, "kind");
  if (kind !== "move" && kind !== "showMove") {
    return null;
  }
  const pathKind = readPresentPathKind(Reflect.get(value, "pathKind"));
  const path =
    pathKind === "line"
      ? undefined
      : readPresentPath(Reflect.get(value, "path"));
  return {
    kind,
    time: readPresentTime(Reflect.get(value, "time")),
    easing: readPresentEasing(Reflect.get(value, "easing")) ?? "easeOut",
    pathKind,
    x: readPresentDelta(Reflect.get(value, "x")),
    y: readPresentDelta(Reflect.get(value, "y")),
    ...(path ? { path } : {}),
  };
};

export const defaultPresentTranslation = (
  kind: PresentMoveKind = "move",
): PresentTranslation => ({
  kind,
  time: JAYRR_PRESENT_TRANSLATION_TIME_DEFAULT,
  easing: "easeOut",
  pathKind: "line",
  x: 0,
  y: 0,
});

const readPresentTypeTime = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return JAYRR_PRESENT_TYPE_TIME_DEFAULT;
  }
  return Math.min(
    JAYRR_PRESENT_TYPE_TIME_MAX,
    Math.max(JAYRR_PRESENT_TYPE_TIME_MIN, Math.round(value)),
  );
};

const readPresentTextEffect = (value: unknown): PresentTextEffect | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const rawKind = Reflect.get(value, "kind");
  // Older decks stored "reveal" (line wipe); treat it as word fade-in.
  const kind: PresentTextEffectKind | null =
    rawKind === "typewriter"
      ? "typewriter"
      : rawKind === "words" || rawKind === "reveal"
      ? "words"
      : null;
  if (!kind) {
    return null;
  }
  return {
    kind,
    time: readPresentTypeTime(Reflect.get(value, "time")),
  };
};

export const defaultPresentTextEffect = (
  kind: PresentTextEffectKind,
): PresentTextEffect => ({
  kind,
  time: JAYRR_PRESENT_TYPE_TIME_DEFAULT,
});

const readPresentZoomPercent = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const next = Math.round(value);
  if (next < JAYRR_PRESENT_ZOOM_PERCENT_MIN) {
    return JAYRR_PRESENT_ZOOM_PERCENT_MIN;
  }
  if (next > JAYRR_PRESENT_ZOOM_PERCENT_MAX) {
    return JAYRR_PRESENT_ZOOM_PERCENT_MAX;
  }
  return next;
};

const readPresentSound = (value: unknown): PresentSound | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const id = Reflect.get(value, "id");
  const name = Reflect.get(value, "name");
  if (typeof id !== "string" || !id.trim()) {
    return null;
  }
  if (typeof name !== "string" || !name.trim()) {
    return null;
  }
  const path = Reflect.get(value, "path");
  return {
    id: id.trim(),
    name: name.trim(),
    path: typeof path === "string" && path.trim() ? path.trim() : undefined,
  };
};

const readPresentBag = (element: ExcalidrawElement): PresentBag => {
  const data = element.customData;
  if (!data) {
    return {};
  }
  const present = data[JAYRR_PRESENT_KEY];
  if (!present || typeof present !== "object") {
    return {};
  }
  const bag: PresentBag = {};
  const order = Reflect.get(present, "order");
  if (typeof order === "number" && Number.isFinite(order)) {
    bag.order = order;
  }
  const label = Reflect.get(present, "label");
  if (typeof label === "string" && label.trim()) {
    bag.label = label.trim();
  }
  const effect = readPresentEffect(Reflect.get(present, "effect"));
  if (effect) {
    bag.effect = effect;
  }
  const camera = readPresentCamera(Reflect.get(present, "camera"));
  if (camera) {
    bag.camera = camera;
  }
  const motion = readPresentMotionValue(Reflect.get(present, "motion"));
  if (motion) {
    bag.motion = motion;
  }
  const exit = readPresentExit(Reflect.get(present, "exit"));
  if (exit) {
    bag.exit = exit;
  }
  const translation = readPresentTranslation(
    Reflect.get(present, "translation"),
  );
  if (translation) {
    bag.translation = translation;
  }
  const zoomPercent = readPresentZoomPercent(
    Reflect.get(present, "zoomPercent"),
  );
  if (zoomPercent !== null) {
    bag.zoomPercent = zoomPercent;
  }
  const textEffect = readPresentTextEffect(Reflect.get(present, "textEffect"));
  if (textEffect) {
    bag.textEffect = textEffect;
  }
  if (Reflect.get(present, "skip") === true) {
    bag.skip = true;
  }
  if (Reflect.get(present, "hide") === true) {
    bag.hide = true;
  }
  const sound = readPresentSound(Reflect.get(present, "sound"));
  if (sound) {
    bag.sound = sound;
  }
  return bag;
};

const presentEffectOf = (
  elements: readonly ExcalidrawElement[],
): PresentEffect | null => {
  for (const element of elements) {
    const effect = readPresentBag(element).effect;
    if (effect) {
      return effect;
    }
  }
  return null;
};

const presentCameraOf = (
  elements: readonly ExcalidrawElement[],
): PresentCamera | null => {
  for (const element of elements) {
    const camera = readPresentBag(element).camera;
    if (camera) {
      return camera;
    }
  }
  return null;
};

const presentMotionOf = (
  elements: readonly ExcalidrawElement[],
): PresentMotion | null => {
  for (const element of elements) {
    const motion = readPresentBag(element).motion;
    if (motion) {
      return motion;
    }
  }
  return null;
};

const presentExitOf = (
  elements: readonly ExcalidrawElement[],
): PresentExit | null => {
  for (const element of elements) {
    const exit = readPresentBag(element).exit;
    if (exit) {
      return exit;
    }
  }
  return null;
};

const presentTranslationOf = (
  elements: readonly ExcalidrawElement[],
): PresentTranslation | null => {
  for (const element of elements) {
    const translation = readPresentBag(element).translation;
    if (translation) {
      return translation;
    }
  }
  return null;
};

const presentZoomPercentOf = (
  elements: readonly ExcalidrawElement[],
): number | null => {
  for (const element of elements) {
    const zoomPercent = readPresentBag(element).zoomPercent;
    if (zoomPercent !== undefined) {
      return zoomPercent;
    }
  }
  return null;
};

const presentTextEffectOf = (
  elements: readonly ExcalidrawElement[],
): PresentTextEffect | null => {
  for (const element of elements) {
    const textEffect = readPresentBag(element).textEffect;
    if (textEffect) {
      return textEffect;
    }
  }
  return null;
};

const presentSkipOf = (elements: readonly ExcalidrawElement[]): boolean => {
  return elements.some((element) => readPresentBag(element).skip === true);
};

const presentHideOf = (elements: readonly ExcalidrawElement[]): boolean => {
  return elements.some((element) => readPresentBag(element).hide === true);
};

const presentSoundOf = (
  elements: readonly ExcalidrawElement[],
): PresentSound | null => {
  for (const element of elements) {
    const sound = readPresentBag(element).sound;
    if (sound) {
      return sound;
    }
  }
  return null;
};

export const countedPresentObjects = (
  objects: readonly PresentObject[],
): PresentObject[] => {
  return objects.filter((object) => !object.skip && !object.hide);
};

const readPresentOrder = (element: ExcalidrawElement): number | null => {
  return readPresentBag(element).order ?? null;
};

const writePresentBag = (
  element: ExcalidrawElement,
  patch: {
    order?: number | null;
    label?: string | null;
    effect?: PresentEffect | null;
    camera?: PresentCamera | null;
    motion?: PresentMotion | null;
    exit?: PresentExit | null;
    translation?: PresentTranslation | null;
    zoomPercent?: number | null;
    textEffect?: PresentTextEffect | null;
    sound?: PresentSound | null;
    skip?: boolean;
    hide?: boolean;
  },
): ExcalidrawElement["customData"] => {
  const current = readPresentBag(element);
  const next: PresentBag = { ...current };
  if (patch.order === null) {
    delete next.order;
  } else if (patch.order !== undefined) {
    next.order = patch.order;
  }
  if (patch.label === null || patch.label === "") {
    delete next.label;
  } else if (patch.label !== undefined) {
    next.label = patch.label.trim();
  }
  if (patch.effect === null) {
    delete next.effect;
  } else if (patch.effect !== undefined) {
    next.effect = patch.effect;
    delete next.skip;
    delete next.hide;
  }
  if (patch.camera === null) {
    delete next.camera;
  } else if (patch.camera !== undefined) {
    next.camera = patch.camera;
  }
  if (patch.motion === null) {
    delete next.motion;
  } else if (patch.motion !== undefined) {
    next.motion = patch.motion;
  }
  if (patch.exit === null) {
    delete next.exit;
  } else if (patch.exit !== undefined) {
    next.exit = patch.exit;
  }
  if (patch.translation === null) {
    delete next.translation;
  } else if (patch.translation !== undefined) {
    const translation = readPresentTranslation(patch.translation);
    if (translation) {
      next.translation = translation;
    } else {
      delete next.translation;
    }
  }
  if (patch.zoomPercent === null) {
    delete next.zoomPercent;
  } else if (patch.zoomPercent !== undefined) {
    const zoomPercent = readPresentZoomPercent(patch.zoomPercent);
    if (zoomPercent === null) {
      delete next.zoomPercent;
    } else {
      next.zoomPercent = zoomPercent;
    }
  }
  if (patch.textEffect === null) {
    delete next.textEffect;
  } else if (patch.textEffect !== undefined) {
    const textEffect = readPresentTextEffect(patch.textEffect);
    if (textEffect) {
      next.textEffect = textEffect;
    } else {
      delete next.textEffect;
    }
  }
  if (patch.skip === false) {
    delete next.skip;
  } else if (patch.skip === true) {
    next.skip = true;
    delete next.hide;
    delete next.effect;
  }
  if (patch.hide === false) {
    delete next.hide;
  } else if (patch.hide === true) {
    next.hide = true;
    delete next.skip;
    delete next.effect;
  }
  if (patch.sound === null) {
    delete next.sound;
  } else if (patch.sound !== undefined) {
    const sound = readPresentSound(patch.sound);
    if (sound) {
      next.sound = sound;
    } else {
      delete next.sound;
    }
  }
  const customData: Record<string, unknown> = {
    ...(element.customData ?? {}),
  };
  if (
    next.order === undefined &&
    next.label === undefined &&
    next.effect === undefined &&
    next.camera === undefined &&
    next.motion === undefined &&
    next.exit === undefined &&
    next.translation === undefined &&
    next.zoomPercent === undefined &&
    next.textEffect === undefined &&
    next.sound === undefined &&
    next.skip === undefined &&
    next.hide === undefined
  ) {
    delete customData[JAYRR_PRESENT_KEY];
    // newElementWith skips `undefined`, so clearing the last present field
    // must still pass an object or the old bag (including sound) stays.
    return Object.keys(customData).length
      ? (customData as ExcalidrawElement["customData"])
      : {};
  }
  customData[JAYRR_PRESENT_KEY] = next;
  return customData as ExcalidrawElement["customData"];
};

export const writePresentOrder = (
  element: ExcalidrawElement,
  order: number,
): ExcalidrawElement["customData"] => {
  return writePresentBag(element, { order });
};

export const writePresentLabel = (
  element: ExcalidrawElement,
  label: string | null,
): ExcalidrawElement["customData"] => {
  return writePresentBag(element, { label });
};

export const writePresentEffect = (
  element: ExcalidrawElement,
  effect: PresentEffect | null,
): ExcalidrawElement["customData"] => {
  return writePresentBag(element, { effect });
};

export const writePresentCamera = (
  element: ExcalidrawElement,
  camera: PresentCamera | null,
): ExcalidrawElement["customData"] => {
  return writePresentBag(element, { camera });
};

export const writePresentMotion = (
  element: ExcalidrawElement,
  motion: PresentMotion | null,
): ExcalidrawElement["customData"] => {
  return writePresentBag(element, { motion });
};

export const writePresentExit = (
  element: ExcalidrawElement,
  exit: PresentExit | null,
): ExcalidrawElement["customData"] => {
  return writePresentBag(element, { exit });
};

export const writePresentTranslation = (
  element: ExcalidrawElement,
  translation: PresentTranslation | null,
): ExcalidrawElement["customData"] => {
  return writePresentBag(element, { translation });
};

export const writePresentZoomPercent = (
  element: ExcalidrawElement,
  zoomPercent: number | null,
): ExcalidrawElement["customData"] => {
  return writePresentBag(element, { zoomPercent });
};

export const writePresentTextEffect = (
  element: ExcalidrawElement,
  textEffect: PresentTextEffect | null,
): ExcalidrawElement["customData"] => {
  return writePresentBag(element, { textEffect });
};

export const writePresentSkip = (
  element: ExcalidrawElement,
  skip: boolean,
): ExcalidrawElement["customData"] => {
  return writePresentBag(element, { skip, hide: skip ? false : undefined });
};

export const writePresentHide = (
  element: ExcalidrawElement,
  hide: boolean,
): ExcalidrawElement["customData"] => {
  return writePresentBag(element, { hide, skip: hide ? false : undefined });
};

export type PresentPresence = "skip" | "hide" | null;

export const writePresentSound = (
  element: ExcalidrawElement,
  sound: PresentSound | null,
): ExcalidrawElement["customData"] => {
  return writePresentBag(element, { sound });
};

export const writePresentPresence = (
  element: ExcalidrawElement,
  presence: PresentPresence,
): ExcalidrawElement["customData"] => {
  if (presence === "skip") {
    return writePresentBag(element, { skip: true, hide: false });
  }
  if (presence === "hide") {
    return writePresentBag(element, { hide: true, skip: false });
  }
  return writePresentBag(element, { skip: false, hide: false });
};

const comparePresentable = (
  a: { order: number | null; index: number },
  b: { order: number | null; index: number },
) => {
  if (a.order !== null && b.order !== null && a.order !== b.order) {
    return a.order - b.order;
  }
  if (a.order !== null && b.order === null) {
    return -1;
  }
  if (a.order === null && b.order !== null) {
    return 1;
  }
  return a.index - b.index;
};

export const isPresentableObject = (element: ExcalidrawElement): boolean => {
  if (element.isDeleted) {
    return false;
  }
  if (isFrameLikeElement(element)) {
    return false;
  }
  if (isBoundToContainer(element)) {
    return false;
  }
  return true;
};

export const getPresentLabel = (element: ExcalidrawElement): string => {
  const customLabel = readPresentBag(element).label;
  if (customLabel) {
    return customLabel;
  }
  if (isFrameLikeElement(element)) {
    const name = element.name?.trim();
    if (name) {
      return name;
    }
    return "Frame";
  }
  if (isTextElement(element)) {
    const line = element.text.split("\n")[0]?.trim();
    if (line) {
      return line.length > 40 ? `${line.slice(0, 37)}…` : line;
    }
  }
  return sentenceCaseType(element.type);
};

const sentenceCaseType = (type: string): string => {
  const spaced = type
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/note$/i, " note")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .trim();
  if (!spaced) {
    return type;
  }
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const outerGroupId = (element: ExcalidrawElement): string | null => {
  if (element.groupIds.length === 0) {
    return null;
  }
  return element.groupIds[element.groupIds.length - 1] ?? null;
};

const groupPresentLabel = (members: readonly ExcalidrawElement[]): string => {
  for (const member of members) {
    const customLabel = readPresentBag(member).label;
    if (customLabel) {
      return customLabel;
    }
  }
  for (const member of members) {
    if (!isTextElement(member)) {
      continue;
    }
    const label = getPresentLabel(member);
    if (label !== sentenceCaseType(member.type)) {
      return label;
    }
  }
  return "Group";
};

const minPresentOrder = (orders: readonly (number | null)[]): number | null => {
  let min: number | null = null;
  for (const order of orders) {
    if (order === null) {
      continue;
    }
    if (min === null || order < min) {
      min = order;
    }
  }
  return min;
};

export const boundIdsForElement = (
  element: ExcalidrawElement,
  elements: readonly ExcalidrawElement[],
): string[] => {
  const ids = [element.id];
  const bound = getBoundTextElement(element, arrayToMap(elements));
  // A bad binding can point at another shape. Only labels travel with the shape.
  if (bound && isTextElement(bound)) {
    ids.push(bound.id);
  }
  return ids;
};

export const idsForPresentObject = (
  object: PresentObject,
  elements: readonly ExcalidrawElement[],
): string[] => {
  const ids: string[] = [];
  const seen = new Set<string>();
  const add = (id: string) => {
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    ids.push(id);
  };
  const members = new Set(object.memberIds);
  for (const memberId of object.memberIds) {
    const element = elements.find((item) => item.id === memberId);
    if (!element) {
      continue;
    }
    for (const id of boundIdsForElement(element, elements)) {
      add(id);
    }
  }
  // Sticky-note labels may only point at the container via containerId.
  // Do not follow `seen`: a label id must not pull in the next shape.
  for (const element of elements) {
    if (!isBoundToContainer(element)) {
      continue;
    }
    if (members.has(element.containerId)) {
      add(element.id);
    }
  }
  return ids;
};

export const buildPresentDeck = (
  elements: readonly NonDeletedExcalidrawElement[],
): PresentDeck => {
  const frames: PresentFrame[] = [];
  const frameEls: {
    element: ExcalidrawFrameLikeElement;
    order: number | null;
    index: number;
  }[] = [];

  elements.forEach((element, index) => {
    if (isFrameLikeElement(element)) {
      if (readJayrrFrame(element).hideFromPresent) {
        return;
      }
      frameEls.push({
        element,
        order: readPresentOrder(element),
        index,
      });
    }
  });

  frameEls.sort(comparePresentable);

  for (const frame of frameEls) {
    const objects: {
      element: ExcalidrawElement;
      order: number | null;
      index: number;
    }[] = [];

    elements.forEach((element, index) => {
      if (element.frameId !== frame.element.id) {
        return;
      }
      if (!isPresentableObject(element)) {
        return;
      }
      objects.push({
        element,
        order: readPresentOrder(element),
        index,
      });
    });

    const usedIds = new Set<string>();
    const clustered: {
      id: string;
      label: string;
      order: number | null;
      effect: PresentEffect | null;
      camera: PresentCamera | null;
      motion: PresentMotion | null;
      exit: PresentExit | null;
      translation: PresentTranslation | null;
      zoomPercent: number | null;
      textEffect: PresentTextEffect | null;
      sound: PresentSound | null;
      skip: boolean;
      hide: boolean;
      index: number;
      groupId: string | null;
      memberIds: string[];
    }[] = [];

    for (const object of objects) {
      if (usedIds.has(object.element.id)) {
        continue;
      }
      const groupId = outerGroupId(object.element);
      if (!groupId) {
        usedIds.add(object.element.id);
        clustered.push({
          id: object.element.id,
          label: getPresentLabel(object.element),
          order: object.order,
          effect: presentEffectOf([object.element]),
          camera: presentCameraOf([object.element]),
          motion: presentMotionOf([object.element]),
          exit: presentExitOf([object.element]),
          translation: presentTranslationOf([object.element]),
          zoomPercent: presentZoomPercentOf([object.element]),
          textEffect: isTextElement(object.element)
            ? presentTextEffectOf([object.element])
            : null,
          sound: presentSoundOf([object.element]),
          skip: presentSkipOf([object.element]),
          hide: presentHideOf([object.element]),
          index: object.index,
          groupId: null,
          memberIds: [object.element.id],
        });
        continue;
      }
      const members = objects.filter(
        (item) => outerGroupId(item.element) === groupId,
      );
      for (const member of members) {
        usedIds.add(member.element.id);
      }
      const representative = members[0];
      if (!representative) {
        continue;
      }
      if (members.length < 2) {
        clustered.push({
          id: representative.element.id,
          label: getPresentLabel(representative.element),
          order: representative.order,
          effect: presentEffectOf([representative.element]),
          camera: presentCameraOf([representative.element]),
          motion: presentMotionOf([representative.element]),
          exit: presentExitOf([representative.element]),
          translation: presentTranslationOf([representative.element]),
          zoomPercent: presentZoomPercentOf([representative.element]),
          textEffect: isTextElement(representative.element)
            ? presentTextEffectOf([representative.element])
            : null,
          sound: presentSoundOf([representative.element]),
          skip: presentSkipOf([representative.element]),
          hide: presentHideOf([representative.element]),
          index: representative.index,
          groupId: null,
          memberIds: [representative.element.id],
        });
        continue;
      }
      clustered.push({
        id: representative.element.id,
        label: groupPresentLabel(members.map((item) => item.element)),
        order: minPresentOrder(members.map((item) => item.order)),
        effect: presentEffectOf(members.map((item) => item.element)),
        camera: presentCameraOf(members.map((item) => item.element)),
        motion: presentMotionOf(members.map((item) => item.element)),
        exit: presentExitOf(members.map((item) => item.element)),
        translation: presentTranslationOf(members.map((item) => item.element)),
        zoomPercent: presentZoomPercentOf(members.map((item) => item.element)),
        textEffect: members.every((item) => isTextElement(item.element))
          ? presentTextEffectOf(members.map((item) => item.element))
          : null,
        sound: presentSoundOf(members.map((item) => item.element)),
        skip: presentSkipOf(members.map((item) => item.element)),
        hide: presentHideOf(members.map((item) => item.element)),
        index: representative.index,
        groupId,
        memberIds: members.map((item) => item.element.id),
      });
    }

    clustered.sort(comparePresentable);

    frames.push({
      id: frame.element.id,
      label: getPresentLabel(frame.element),
      order: frame.order,
      effect: presentEffectOf([frame.element]),
      zoomPercent: presentZoomPercentOf([frame.element]),
      sound: presentSoundOf([frame.element]),
      objects: clustered.map((object) => ({
        id: object.id,
        label: object.label,
        order: object.order,
        effect: object.effect,
        camera: object.camera,
        motion: object.motion,
        exit: object.exit,
        translation: object.translation,
        zoomPercent: object.zoomPercent,
        textEffect: object.textEffect,
        sound: object.sound,
        skip: object.skip,
        hide: object.hide,
        groupId: object.groupId,
        memberIds: object.memberIds,
      })),
    });
  }

  const steps: PresentStep[] = [];
  for (const frame of frames) {
    steps.push({ type: "showFrame", frameId: frame.id });
    let lastCounted: PresentObject | null = null;
    for (const object of frame.objects) {
      if (object.skip || object.hide) {
        continue;
      }
      lastCounted = object;
      steps.push({
        type: "reveal",
        frameId: frame.id,
        elementId: object.id,
      });
      if (object.translation?.kind === "showMove") {
        steps.push({
          type: "move",
          frameId: frame.id,
          elementId: object.id,
        });
      }
    }
    if (lastCounted?.exit) {
      steps.push({ type: "flushExits", frameId: frame.id });
    }
  }

  return { frames, steps };
};

/**
 * Every deck step is a stop: the blank `showFrame` (all objects hidden),
 * each reveal, a Show n Move travel, and a last-object motion-out.
 * Next and Back use the same list so the empty slide is a frame you can
 * land on in both directions.
 */
export const isPresentLandableStep = (
  _deck: PresentDeck,
  step: PresentStep,
): boolean => {
  return (
    step.type === "showFrame" ||
    step.type === "reveal" ||
    step.type === "move" ||
    step.type === "flushExits"
  );
};

/**
 * Next landable step in `direction`, or null at either end. Symmetric: the
 * same rule decides where Right and Left stop, so Back always retraces Next.
 */
export const nextPresentStepIndex = (
  deck: PresentDeck,
  fromIndex: number,
  direction: 1 | -1,
): number | null => {
  for (
    let next = fromIndex + direction;
    next >= 0 && next < deck.steps.length;
    next += direction
  ) {
    const step = deck.steps[next];
    if (step && isPresentLandableStep(deck, step)) {
      return next;
    }
  }
  return null;
};

export const reorderPresentIds = (
  ids: readonly string[],
  fromIndex: number,
  toIndex: number,
): string[] => {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= ids.length ||
    toIndex >= ids.length
  ) {
    return [...ids];
  }
  const next = [...ids];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) {
    return [...ids];
  }
  next.splice(toIndex, 0, moved);
  return next;
};

export const stepCaption = (deck: PresentDeck, stepIndex: number): string => {
  const step = deck.steps[stepIndex];
  if (!step) {
    return "Present";
  }
  const frame = deck.frames.find((item) => item.id === step.frameId);
  const frameLabel = frame?.label ?? "Frame";
  const frameNumber =
    deck.frames.findIndex((item) => item.id === step.frameId) + 1;
  if (step.type === "showFrame") {
    return `${frameLabel} (${frameNumber}/${deck.frames.length})`;
  }
  if (step.type === "flushExits") {
    return `${frameLabel} · out`;
  }
  const counted = countedPresentObjects(frame?.objects ?? []);
  const objectNumber = counted.findIndex((item) => item.id === step.elementId);
  const objectTotal = counted.length;
  return `${frameLabel} · ${objectNumber + 1}/${objectTotal}`;
};
