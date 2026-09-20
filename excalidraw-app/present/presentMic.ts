import { STORAGE_KEYS } from "../app_constants";

const MIC_KEY = STORAGE_KEYS.LOCAL_STORAGE_PRESENT_MIC;

export const PRESENT_MIC_DEFAULT = "";
export const PRESENT_MIC_NONE = "none";

export const getPresentMic = (): string => {
  return localStorage.getItem(MIC_KEY) ?? PRESENT_MIC_DEFAULT;
};

export const setPresentMic = (deviceId: string) => {
  localStorage.setItem(MIC_KEY, deviceId);
};

/** `null` skips capture, `undefined` uses the browser default. */
export const presentMicDeviceId = (): string | null | undefined => {
  const stored = getPresentMic();
  if (stored === PRESENT_MIC_NONE) {
    return null;
  }
  if (!stored) {
    return undefined;
  }
  return stored;
};
