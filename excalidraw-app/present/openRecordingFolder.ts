import { appJotaiStore, atom } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";

import type { Id } from "../../convex/_generated/dataModel";

export const openRecordingFolderIdAtom =
  atom<Id<"presentRecordingFolders"> | null>(readStoredRecordingFolderId());

function readStoredRecordingFolderId(): Id<"presentRecordingFolders"> | null {
  try {
    const stored = localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_OPEN_RECORDING_FOLDER_ID,
    );
    return stored ? (stored as Id<"presentRecordingFolders">) : null;
  } catch {
    return null;
  }
}

export const persistOpenRecordingFolderId = (
  folderId: Id<"presentRecordingFolders"> | null,
) => {
  try {
    if (folderId) {
      localStorage.setItem(
        STORAGE_KEYS.LOCAL_STORAGE_OPEN_RECORDING_FOLDER_ID,
        folderId,
      );
      return;
    }
    localStorage.removeItem(
      STORAGE_KEYS.LOCAL_STORAGE_OPEN_RECORDING_FOLDER_ID,
    );
  } catch {
    // ignore quota / private mode
  }
};

export const getOpenRecordingFolderId = () => {
  return appJotaiStore.get(openRecordingFolderIdAtom);
};
