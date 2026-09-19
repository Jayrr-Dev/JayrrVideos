import { STORAGE_KEYS } from "../app_constants";

const CUSTOM_CURSOR_KEY = STORAGE_KEYS.LOCAL_STORAGE_PRESENT_CUSTOM_CURSOR;

export const getPresentCustomCursor = (): boolean => {
  const stored = localStorage.getItem(CUSTOM_CURSOR_KEY);
  if (stored === null) {
    return false;
  }
  return stored === "1";
};

export const setPresentCustomCursor = (enabled: boolean) => {
  localStorage.setItem(CUSTOM_CURSOR_KEY, enabled ? "1" : "0");
};
