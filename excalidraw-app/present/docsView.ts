import { atom } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";

export type DocsView = "record" | "project";

const readStoredDocsView = (): DocsView => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_DOCS_VIEW);
    if (stored === "project" || stored === "record") {
      return stored;
    }
  } catch {
    // ignore
  }
  return "record";
};

export const docsViewAtom = atom<DocsView>(readStoredDocsView());

export const persistDocsView = (view: DocsView) => {
  try {
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_DOCS_VIEW, view);
  } catch {
    // ignore quota / private mode
  }
};
