import { STORAGE_KEYS } from "../app_constants";

import { type PresentExit, type PresentMotion } from "./buildPresentDeck";

const MOTION_KEY = STORAGE_KEYS.LOCAL_STORAGE_PRESENT_MOTION;

export const PRESENT_MOTIONS: readonly PresentExit[] = [
  "fade",
  "fadeUp",
  "fadeDown",
  "fadeLeft",
  "fadeRight",
];

export const PRESENT_MOTION_LABEL: Record<PresentMotion, string> = {
  none: "None",
  fade: "Fade",
  fadeUp: "Fade up",
  fadeDown: "Fade down",
  fadeLeft: "Fade left",
  fadeRight: "Fade right",
};

const isPresentMotion = (value: string | null): value is PresentMotion =>
  value === "none" ||
  value === "fade" ||
  value === "fadeUp" ||
  value === "fadeDown" ||
  value === "fadeLeft" ||
  value === "fadeRight";

export const getPresentDefaultMotion = (): PresentMotion => {
  const stored = localStorage.getItem(MOTION_KEY);
  if (isPresentMotion(stored)) {
    return stored;
  }
  return "fadeUp";
};

export const setPresentDefaultMotion = (motion: PresentMotion) => {
  localStorage.setItem(MOTION_KEY, motion);
};
