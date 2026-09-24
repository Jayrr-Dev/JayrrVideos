import { atom } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";

export type LibrariesView = "record" | "project" | "scene" | "parts";

export type DocsView = LibrariesView;

const LIBRARY_VIEWS: readonly LibrariesView[] = [
  "record",
  "project",
  "scene",
  "parts",
];

const isLibrariesView = (value: string | null): value is LibrariesView =>
  LIBRARY_VIEWS.some((view) => view === value);

const readStoredLibrariesView = (): LibrariesView => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_DOCS_VIEW);
    if (isLibrariesView(stored)) {
      return stored;
    }
  } catch {
    // ignore
  }
  return "record";
};

export const librariesViewAtom = atom<LibrariesView>(readStoredLibrariesView());

export const docsViewAtom = librariesViewAtom;

export const recordingsUploadingAtom = atom(false);

export const persistLibrariesView = (view: LibrariesView) => {
  try {
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_DOCS_VIEW, view);
  } catch {
    // ignore quota / private mode
  }
};

export const persistDocsView = persistLibrariesView;
