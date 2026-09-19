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

export type PresentEffect = "focus" | "zoom";

export type PresentRevealStep = {
  type: "reveal";
  frameId: string;
  elementId: string;
};

export type PresentFrameStep = {
  type: "showFrame";
  frameId: string;
};

export type PresentStep = PresentFrameStep | PresentRevealStep;

export type PresentObject = {
  id: string;
  label: string;
  order: number | null;
  effect: PresentEffect | null;
  groupId: string | null;
  memberIds: string[];
};

export type PresentFrame = {
  id: string;
  label: string;
  order: number | null;
  effect: PresentEffect | null;
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
};

const readPresentEffect = (value: unknown): PresentEffect | null => {
  if (value === "focus" || value === "zoom") {
    return value;
  }
  return null;
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

const readPresentOrder = (element: ExcalidrawElement): number | null => {
  return readPresentBag(element).order ?? null;
};

const writePresentBag = (
  element: ExcalidrawElement,
  patch: {
    order?: number | null;
    label?: string | null;
    effect?: PresentEffect | null;
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
  }
  const customData: Record<string, unknown> = {
    ...(element.customData ?? {}),
  };
  if (
    next.order === undefined &&
    next.label === undefined &&
    next.effect === undefined
  ) {
    delete customData[JAYRR_PRESENT_KEY];
    return Object.keys(customData).length
      ? (customData as ExcalidrawElement["customData"])
      : undefined;
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
  if (bound) {
    ids.push(bound.id);
  }
  return ids;
};

export const idsForPresentObject = (
  object: PresentObject,
  elements: readonly ExcalidrawElement[],
): string[] => {
  const ids: string[] = [];
  const byId = arrayToMap(elements);
  for (const memberId of object.memberIds) {
    const element = byId.get(memberId);
    if (!element) {
      continue;
    }
    ids.push(...boundIdsForElement(element, elements));
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
      objects: clustered.map((object) => ({
        id: object.id,
        label: object.label,
        order: object.order,
        effect: object.effect,
        groupId: object.groupId,
        memberIds: object.memberIds,
      })),
    });
  }

  const steps: PresentStep[] = [];
  for (const frame of frames) {
    steps.push({ type: "showFrame", frameId: frame.id });
    for (const object of frame.objects) {
      steps.push({
        type: "reveal",
        frameId: frame.id,
        elementId: object.id,
      });
    }
  }

  return { frames, steps };
};

/**
 * A step Next/Back can stop on. Every reveal lands; a bare `showFrame` only
 * lands when it is a slide of its own (empty frame or frame-level effect),
 * otherwise it is skipped because the slide would look blank.
 */
export const isPresentLandableStep = (
  deck: PresentDeck,
  step: PresentStep,
): boolean => {
  if (step.type === "reveal") {
    return true;
  }
  const frame = deck.frames.find((item) => item.id === step.frameId);
  return Boolean(frame?.effect) || frame?.objects.length === 0;
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
  const objectNumber =
    frame?.objects.findIndex((item) => item.id === step.elementId) ?? -1;
  const objectTotal = frame?.objects.length ?? 0;
  return `${frameLabel} · ${objectNumber + 1}/${objectTotal}`;
};
