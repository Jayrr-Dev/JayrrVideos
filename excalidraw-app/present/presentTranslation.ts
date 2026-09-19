import {
  idsForPresentObject,
  type PresentEasing,
  type PresentObject,
} from "./buildPresentDeck";

import type { ExcalidrawElement } from "@excalidraw/element/types";

export const PRESENT_EASINGS: readonly PresentEasing[] = [
  "linear",
  "easeIn",
  "easeOut",
  "easeInOut",
];

export const PRESENT_EASING_LABEL: Record<PresentEasing, string> = {
  linear: "Linear",
  easeIn: "Ease in",
  easeOut: "Ease out",
  easeInOut: "Ease in out",
};

export const easePresent = (easing: PresentEasing, t: number): number => {
  if (easing === "linear") {
    return t;
  }
  if (easing === "easeIn") {
    return t * t;
  }
  if (easing === "easeInOut") {
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  }
  return 1 - (1 - t) * (1 - t);
};

export const presentObjectCenter = (
  object: PresentObject,
  elements: readonly ExcalidrawElement[],
): { x: number; y: number } | null => {
  const ids = new Set(idsForPresentObject(object, elements));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const element of elements) {
    if (!ids.has(element.id)) {
      continue;
    }
    minX = Math.min(minX, element.x);
    minY = Math.min(minY, element.y);
    maxX = Math.max(maxX, element.x + element.width);
    maxY = Math.max(maxY, element.y + element.height);
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) {
    return null;
  }
  return { x: minX + (maxX - minX) / 2, y: minY + (maxY - minY) / 2 };
};

export type PresentTranslationPlace = {
  memberIds: readonly string[];
};

let place: PresentTranslationPlace | null = null;
const listeners = new Set<() => void>();

const emitPlace = () => {
  for (const listener of listeners) {
    listener();
  }
};

export const subscribePresentTranslationPlace = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getPresentTranslationPlace = () => place;

export const startPresentTranslationPlace = (memberIds: readonly string[]) => {
  place = { memberIds: [...memberIds] };
  emitPlace();
};

export const stopPresentTranslationPlace = () => {
  if (!place) {
    return;
  }
  place = null;
  emitPlace();
};
