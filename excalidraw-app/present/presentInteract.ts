import { STORAGE_KEYS } from "../app_constants";

const INTERACT_KEY = STORAGE_KEYS.LOCAL_STORAGE_PRESENT_INTERACT;

// When on, Present leaves the canvas editable: drag shapes like normal,
// quick tap still advances.
export const getPresentInteract = (): boolean => {
  const stored = localStorage.getItem(INTERACT_KEY);
  if (stored === null) {
    return true;
  }
  return stored === "1";
};

export const setPresentInteract = (enabled: boolean) => {
  localStorage.setItem(INTERACT_KEY, enabled ? "1" : "0");
};
