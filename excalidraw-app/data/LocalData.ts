/**
 * This file deals with saving data state (appState, elements, images, ...)
 * locally to the browser.
 *
 * Notes:
 *
 * - DataState refers to full state of the app: appState, elements, images,
 *   though some state is saved separately (collab username, library) for one
 *   reason or another. We also save different data to different storage
 *   (localStorage, indexedDB).
 */

import {
  CANVAS_SEARCH_TAB,
  DEFAULT_SIDEBAR,
  MIME_TYPES,
  debounce,
} from "@excalidraw/common";
import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";
import {
  createStore,
  del,
  entries,
  get,
  getMany,
  set,
  setMany,
} from "idb-keyval";

import { getNonDeletedElements } from "@excalidraw/element";

import type { MaybePromise } from "@excalidraw/common/utility-types";
import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";
import type { LibraryPersistedData } from "@excalidraw/excalidraw/data/library";
import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";

import { appJotaiStore, atom } from "../app-jotai";
import { SAVE_TO_LOCAL_STORAGE_TIMEOUT, STORAGE_KEYS } from "../app_constants";

import { isGoogleDriveEnabled } from "./connectGoogleDrive";
import { FileManager } from "./FileManager";
import { FileStatusStore } from "./fileStatusStore";
import { Locker } from "./Locker";
import {
  DRIVE_FILE_PLACEHOLDER_DATA_URL,
  downloadBinaryFileFromDrive,
  isDriveFileStub,
  shouldStoreFileOnDrive,
  toDriveFileStub,
  uploadBinaryFileToDrive,
  type LocalStoredFile,
} from "./storeGoogleDriveFiles";
import { updateBrowserStateVersion } from "./tabSync";

const filesStore = createStore("files-db", "files-store");

export const localStorageQuotaExceededAtom = atom(false);

class LocalFileManager extends FileManager {
  clearObsoleteFiles = async (opts: { currentFileIds: FileId[] }) => {
    await entries(filesStore).then((entries) => {
      for (const [id, imageData] of entries as [FileId, BinaryFileData][]) {
        // if image is unused (not on canvas) & is older than 1 day, delete it
        // from storage. We check `lastRetrieved` we care about the last time
        // the image was used (loaded on canvas), not when it was initially
        // created.
        if (
          (!imageData.lastRetrieved ||
            Date.now() - imageData.lastRetrieved > 24 * 3600 * 1000) &&
          !opts.currentFileIds.includes(id as FileId)
        ) {
          del(id, filesStore);
        }
      }
    });
  };
}

const saveDataStateToLocalStorage = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const localStorageQuotaExceeded = appJotaiStore.get(
    localStorageQuotaExceededAtom,
  );
  try {
    const _appState = clearAppStateForLocalStorage(appState);

    if (
      _appState.openSidebar?.name === DEFAULT_SIDEBAR.name &&
      _appState.openSidebar.tab === CANVAS_SEARCH_TAB
    ) {
      _appState.openSidebar = null;
    }

    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify(getNonDeletedElements(elements)),
    );
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify(_appState),
    );
    updateBrowserStateVersion(STORAGE_KEYS.VERSION_DATA_STATE);
    if (localStorageQuotaExceeded) {
      appJotaiStore.set(localStorageQuotaExceededAtom, false);
    }
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
    if (isQuotaExceededError(error) && !localStorageQuotaExceeded) {
      appJotaiStore.set(localStorageQuotaExceededAtom, true);
    }
  }
};

const isQuotaExceededError = (error: any) => {
  return error instanceof DOMException && error.name === "QuotaExceededError";
};

type SavingLockTypes = "collaboration";

export class LocalData {
  private static _save = debounce(
    async (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
      onFilesSaved: () => void,
    ) => {
      saveDataStateToLocalStorage(elements, appState);

      await this.fileStorage.saveFiles({
        elements,
        files,
      });
      onFilesSaved();
    },
    SAVE_TO_LOCAL_STORAGE_TIMEOUT,
  );

  /** Saves DataState, including files. Bails if saving is paused */
  static save = (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
    onFilesSaved: () => void,
  ) => {
    // we need to make the `isSavePaused` check synchronously (undebounced)
    if (!this.isSavePaused()) {
      this._save(elements, appState, files, onFilesSaved);
    }
  };

  static flushSave = () => {
    this._save.flush();
  };

  private static locker = new Locker<SavingLockTypes>();

  static pauseSave = (lockType: SavingLockTypes) => {
    this.locker.lock(lockType);
  };

  static resumeSave = (lockType: SavingLockTypes) => {
    this.locker.unlock(lockType);
  };

  static isSavePaused = () => {
    return document.hidden || this.locker.isLocked();
  };

  // ---------------------------------------------------------------------------

  static fileStorage = new LocalFileManager({
    onFileStatusChange: FileStatusStore.updateStatuses.bind(FileStatusStore),
    getFiles(ids) {
      return getMany(ids, filesStore).then(
        async (filesData: (LocalStoredFile | undefined)[]) => {
          const loadedFiles: BinaryFileData[] = [];
          const erroredFiles = new Map<FileId, true>();
          const filesToSave: [FileId, LocalStoredFile][] = [];
          const driveEnabled = isGoogleDriveEnabled();

          for (const [index, data] of filesData.entries()) {
            const id = ids[index];
            if (!data) {
              if (driveEnabled) {
                try {
                  const { file: fromDrive, driveFileId } =
                    await downloadBinaryFileFromDrive({
                      id,
                      mimeType: MIME_TYPES.binary,
                      created: Date.now(),
                      dataURL: DRIVE_FILE_PLACEHOLDER_DATA_URL,
                    });
                  loadedFiles.push(fromDrive);
                  filesToSave.push([
                    id,
                    toDriveFileStub(fromDrive, driveFileId),
                  ]);
                } catch (error) {
                  console.warn(error);
                  erroredFiles.set(id, true);
                }
              } else {
                erroredFiles.set(id, true);
              }
              continue;
            }

            if (isDriveFileStub(data)) {
              if (!driveEnabled) {
                erroredFiles.set(id, true);
                continue;
              }
              try {
                const { file: fromDrive, driveFileId } =
                  await downloadBinaryFileFromDrive(data);
                loadedFiles.push(fromDrive);
                filesToSave.push([
                  id,
                  {
                    ...toDriveFileStub(
                      fromDrive,
                      data.driveFileId ?? driveFileId,
                    ),
                    lastRetrieved: Date.now(),
                  },
                ]);
              } catch (error) {
                console.warn(error);
                erroredFiles.set(id, true);
              }
              continue;
            }

            const _data: LocalStoredFile = {
              ...data,
              lastRetrieved: Date.now(),
            };
            filesToSave.push([id, _data]);
            loadedFiles.push(_data);
          }

          try {
            await setMany(filesToSave, filesStore);
          } catch (error) {
            console.warn(error);
          }

          return { loadedFiles, erroredFiles };
        },
      );
    },
    async saveFiles({ addedFiles }) {
      const savedFiles = new Map<FileId, BinaryFileData>();
      const erroredFiles = new Map<FileId, BinaryFileData>();
      const driveEnabled = isGoogleDriveEnabled();

      // before we use `storage` event synchronization, let's update the flag
      // optimistically. Hopefully nothing fails, and an IDB read executed
      // before an IDB write finishes will read the latest value.
      updateBrowserStateVersion(STORAGE_KEYS.VERSION_FILES);

      await Promise.all(
        [...addedFiles].map(async ([id, fileData]) => {
          try {
            let storeOnDrive = false;
            if (driveEnabled) {
              storeOnDrive = shouldStoreFileOnDrive(fileData);
            }

            if (storeOnDrive) {
              const driveFileId = await uploadBinaryFileToDrive(fileData);
              await set(id, toDriveFileStub(fileData, driveFileId), filesStore);
              savedFiles.set(id, fileData);
              return;
            }

            await set(id, fileData, filesStore);
            savedFiles.set(id, fileData);
          } catch (error: any) {
            if (driveEnabled) {
              try {
                const driveFileId = await uploadBinaryFileToDrive(fileData);
                await set(
                  id,
                  toDriveFileStub(fileData, driveFileId),
                  filesStore,
                );
                savedFiles.set(id, fileData);
                return;
              } catch (driveError) {
                console.error(driveError);
              }
            }
            console.error(error);
            erroredFiles.set(id, fileData);
          }
        }),
      );

      return { savedFiles, erroredFiles };
    },
  });

  static listLocalImageFiles = async (): Promise<BinaryFileData[]> => {
    const rows = await entries(filesStore);
    const out: BinaryFileData[] = [];
    for (const [, data] of rows) {
      if (!data || typeof data !== "object") {
        continue;
      }
      const mime = Reflect.get(data, "mimeType");
      const dataURL = Reflect.get(data, "dataURL");
      const id = Reflect.get(data, "id");
      if (typeof mime !== "string" || !mime.startsWith("image/")) {
        continue;
      }
      if (typeof dataURL !== "string" || !dataURL || dataURL === "data:,") {
        continue;
      }
      if (typeof id !== "string" || !id) {
        continue;
      }
      out.push(data as BinaryFileData);
    }
    return out.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
  };
}
export class LibraryIndexedDBAdapter {
  /** IndexedDB database and store name */
  private static idb_name = STORAGE_KEYS.IDB_LIBRARY;
  /** library data store key */
  private static key = "libraryData";

  private static store = createStore(
    `${LibraryIndexedDBAdapter.idb_name}-db`,
    `${LibraryIndexedDBAdapter.idb_name}-store`,
  );

  static async load() {
    const IDBData = await get<LibraryPersistedData>(
      LibraryIndexedDBAdapter.key,
      LibraryIndexedDBAdapter.store,
    );

    return IDBData || null;
  }

  static save(data: LibraryPersistedData): MaybePromise<void> {
    return set(
      LibraryIndexedDBAdapter.key,
      data,
      LibraryIndexedDBAdapter.store,
    );
  }
}

/** LS Adapter used only for migrating LS library data
 * to indexedDB */
export class LibraryLocalStorageMigrationAdapter {
  static load() {
    const LSData = localStorage.getItem(
      STORAGE_KEYS.__LEGACY_LOCAL_STORAGE_LIBRARY,
    );
    if (LSData != null) {
      const libraryItems: ImportedDataState["libraryItems"] =
        JSON.parse(LSData);
      if (libraryItems) {
        return { libraryItems };
      }
    }
    return null;
  }
  static clear() {
    localStorage.removeItem(STORAGE_KEYS.__LEGACY_LOCAL_STORAGE_LIBRARY);
  }
}
