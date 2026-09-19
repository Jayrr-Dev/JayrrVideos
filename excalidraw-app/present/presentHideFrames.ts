import { STORAGE_KEYS } from "../app_constants";

const HIDE_FRAMES_KEY = STORAGE_KEYS.LOCAL_STORAGE_PRESENT_HIDE_FRAMES;

export const getPresentHideFrames = (): boolean => {
  const stored = localStorage.getItem(HIDE_FRAMES_KEY);
  if (stored === null) {
    return true;
  }
  return stored === "1";
};

export const setPresentHideFrames = (hide: boolean) => {
  localStorage.setItem(HIDE_FRAMES_KEY, hide ? "1" : "0");
};
