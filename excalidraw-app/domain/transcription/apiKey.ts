import { STORAGE_KEYS } from "../../app_constants";

const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) {
    listener();
  }
};

export const getTranscribeApiKey = (): string => {
  try {
    return (
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_TRANSCRIBE_API_KEY) ?? ""
    );
  } catch {
    return "";
  }
};

export const setTranscribeApiKey = (apiKey: string) => {
  try {
    const next = apiKey.trim();
    if (next) {
      localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_TRANSCRIBE_API_KEY, next);
    } else {
      localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_TRANSCRIBE_API_KEY);
    }
  } catch {
    // ignore quota / private mode
  }
  notify();
};

export const getTranscribeEnabled = (): boolean => {
  try {
    return (
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_TRANSCRIBE_ENABLED) ===
      "1"
    );
  } catch {
    return false;
  }
};

export const setTranscribeEnabled = (enabled: boolean) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_TRANSCRIBE_ENABLED,
      enabled ? "1" : "0",
    );
  } catch {
    // ignore quota / private mode
  }
  notify();
};

export const subscribeTranscribeSettings = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
