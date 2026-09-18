import { STORAGE_KEYS } from "../app_constants";

export const getOwnerKey = (): string => {
  try {
    const existing = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_OWNER_KEY);
    if (existing) {
      return existing;
    }
    const created = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_OWNER_KEY, created);
    return created;
  } catch {
    return "local";
  }
};
