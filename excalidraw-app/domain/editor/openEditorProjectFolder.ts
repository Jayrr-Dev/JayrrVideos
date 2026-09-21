import { appJotaiStore, atom } from "../../app-jotai";
import { STORAGE_KEYS } from "../../app_constants";

import type { Id } from "../../../convex/_generated/dataModel";

export const openEditorProjectFolderIdAtom =
  atom<Id<"editorProjectFolders"> | null>(readStoredFolderId());

function readStoredFolderId(): Id<"editorProjectFolders"> | null {
  try {
    const stored = localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_OPEN_EDITOR_PROJECT_FOLDER_ID,
    );
    return stored ? (stored as Id<"editorProjectFolders">) : null;
  } catch {
    return null;
  }
}

export const persistOpenEditorProjectFolderId = (
  folderId: Id<"editorProjectFolders"> | null,
) => {
  try {
    if (folderId) {
      localStorage.setItem(
        STORAGE_KEYS.LOCAL_STORAGE_OPEN_EDITOR_PROJECT_FOLDER_ID,
        folderId,
      );
      return;
    }
    localStorage.removeItem(
      STORAGE_KEYS.LOCAL_STORAGE_OPEN_EDITOR_PROJECT_FOLDER_ID,
    );
  } catch {
    // ignore quota / private mode
  }
};

export const getOpenEditorProjectFolderId = () => {
  return appJotaiStore.get(openEditorProjectFolderIdAtom);
};
