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
export const JAYRR_PRESENT_SIDEBAR = "jayrrPresent";
export const JAYRR_PRESENT_REVEAL_MS = 320;
export const JAYRR_PRESENT_SLIDE_Y = 18;

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
};

export type PresentFrame = {
  id: string;
  label: string;
  order: number | null;
  objects: PresentObject[];
};

export type PresentDeck = {
  frames: PresentFrame[];
  steps: PresentStep[];
};

const readPresentOrder = (element: ExcalidrawElement): number | null => {
  const data = element.customData;
  if (!data) {
    return null;
  }
  const present = data[JAYRR_PRESENT_KEY];
  if (!present || typeof present !== "object") {
    return null;
  }
  const order = Reflect.get(present, "order");
  if (typeof order !== "number" || !Number.isFinite(order)) {
    return null;
  }
  return order;
};

export const writePresentOrder = (
  element: ExcalidrawElement,
  order: number,
): ExcalidrawElement["customData"] => {
  return {
    ...element.customData,
    [JAYRR_PRESENT_KEY]: { order },
  };
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
  return element.type;
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

    objects.sort(comparePresentable);

    frames.push({
      id: frame.element.id,
      label: getPresentLabel(frame.element),
      order: frame.order,
      objects: objects.map((object) => ({
        id: object.element.id,
        label: getPresentLabel(object.element),
        order: object.order,
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

export const movePresentIds = (
  ids: readonly string[],
  fromIndex: number,
  direction: -1 | 1,
): string[] => {
  const toIndex = fromIndex + direction;
  if (fromIndex < 0 || toIndex < 0 || toIndex >= ids.length) {
    return [...ids];
  }
  const next = [...ids];
  const current = next[fromIndex];
  const swap = next[toIndex];
  if (current === undefined || swap === undefined) {
    return [...ids];
  }
  next[fromIndex] = swap;
  next[toIndex] = current;
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
