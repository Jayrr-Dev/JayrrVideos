import { IMAGE_MIME_TYPES, MIME_TYPES } from "@excalidraw/common";
import { getCommonBounds } from "@excalidraw/element";
import {
  CaptureUpdateAction,
  exportToCanvas,
  isInvisiblySmallElement,
  restoreAppState,
  restoreElements,
  serializeAsJSON,
  zoomToFitBounds,
} from "@excalidraw/excalidraw";
import { dataURLToFile, getDataURL } from "@excalidraw/excalidraw/data/blob";

import type {
  FileId,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";
import type {
  BinaryFileData,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import { appJotaiStore, atom } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";
import { api, convexClient } from "../convexClient";
import { collectSceneFileIds } from "../domain/widgets/collectSceneFileIds";

import type { Id } from "../../convex/_generated/dataModel";

export const activeSceneIdAtom = atom<Id<"scenes"> | null>(
  readStoredActiveSceneId(),
);

// Scene that was active when this tab started sharing; null when not hosting.
export const collabSceneIdAtom = atom<Id<"scenes"> | null>(null);

export const openSceneFolderIdAtom = atom<Id<"sceneFolders"> | null>(
  readStoredOpenSceneFolderId(),
);

function readStoredActiveSceneId(): Id<"scenes"> | null {
  try {
    const stored = localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_ACTIVE_SCENE_ID,
    );
    return stored ? (stored as Id<"scenes">) : null;
  } catch {
    return null;
  }
}

function readStoredOpenSceneFolderId(): Id<"sceneFolders"> | null {
  try {
    const stored = localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_OPEN_SCENE_FOLDER_ID,
    );
    return stored ? (stored as Id<"sceneFolders">) : null;
  } catch {
    return null;
  }
}

export const setActiveSceneId = (sceneId: Id<"scenes"> | null) => {
  appJotaiStore.set(activeSceneIdAtom, sceneId);
  try {
    if (sceneId) {
      localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_ACTIVE_SCENE_ID, sceneId);
      return;
    }
    localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_ACTIVE_SCENE_ID);
  } catch {
    // ignore quota / private mode
  }
};

export const persistOpenSceneFolderId = (
  folderId: Id<"sceneFolders"> | null,
) => {
  try {
    if (folderId) {
      localStorage.setItem(
        STORAGE_KEYS.LOCAL_STORAGE_OPEN_SCENE_FOLDER_ID,
        folderId,
      );
      return;
    }
    localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_OPEN_SCENE_FOLDER_ID);
  } catch {
    // ignore quota / private mode
  }
};

const PREVIEW_MAX_EDGE = 280;
const PREVIEW_PADDING = 12;
const PREVIEW_JPEG_QUALITY = 0.7;
const MAX_SCENE_FILE_BYTES = 8 * 1024 * 1024;
const FILE_UPLOAD_BATCH = 24;

const uploadedVersions = new Map<string, Map<string, number>>();
const previewSignatures = new Map<string, string>();
const IMAGE_MIME = new Set<string>(Object.values(IMAGE_MIME_TYPES));

const asFileMime = (mime: string): BinaryFileData["mimeType"] => {
  if (IMAGE_MIME.has(mime)) {
    return mime as BinaryFileData["mimeType"];
  }
  return MIME_TYPES.binary;
};

const readStorageId = (payload: unknown) => {
  if (
    payload &&
    typeof payload === "object" &&
    "storageId" in payload &&
    typeof payload.storageId === "string"
  ) {
    return payload.storageId as Id<"_storage">;
  }
  return null;
};

export const convexErrorMessage = (error: unknown, fallback: string) => {
  const raw = error instanceof Error ? error.message : fallback;
  const inner = raw.match(/Uncaught Error:\s*(.+)/);
  if (inner?.[1]) {
    return inner[1].split("\n")[0];
  }
  if (/CONVEX [A-Z]\(/i.test(raw)) {
    return fallback;
  }
  return raw;
};

export const serializeCurrentCanvas = (canvas: ExcalidrawImperativeAPI) => {
  const compact = JSON.parse(
    serializeAsJSON(
      canvas.getSceneElementsIncludingDeleted(),
      canvas.getAppState(),
      canvas.getFiles(),
      "local",
    ),
  ) as ImportedDataState;
  compact.files = {};
  return JSON.stringify(compact);
};

export const buildScenePreviewDataUrl = async (
  sceneJson: string,
  files?: BinaryFiles | null,
) => {
  try {
    const data = JSON.parse(sceneJson) as ImportedDataState;
    const elements = (data.elements ?? []).filter(
      (element): element is NonDeletedExcalidrawElement =>
        !element.isDeleted && !isInvisiblySmallElement(element),
    );
    if (elements.length === 0) {
      return undefined;
    }
    const canvas = await exportToCanvas({
      elements,
      files: files ?? data.files ?? null,
      maxWidthOrHeight: PREVIEW_MAX_EDGE,
      exportPadding: PREVIEW_PADDING,
      appState: {
        exportBackground: true,
        viewBackgroundColor: data.appState?.viewBackgroundColor ?? "#ffffff",
      },
    });
    return canvas.toDataURL("image/jpeg", PREVIEW_JPEG_QUALITY);
  } catch {
    return undefined;
  }
};

const rememberUploaded = (
  sceneId: Id<"scenes">,
  fileId: string,
  version: number,
) => {
  let known = uploadedVersions.get(sceneId);
  if (!known) {
    known = new Map();
    uploadedVersions.set(sceneId, known);
  }
  known.set(fileId, version);
};

const seedUploaded = async (sceneId: Id<"scenes">) => {
  if (!convexClient) {
    throw new Error("Convex is not connected.");
  }
  const attached = await convexClient.query(api.sceneFiles.list, { sceneId });
  const known = new Map<string, number>();
  for (const row of attached) {
    known.set(row.fileId, row.version);
  }
  uploadedVersions.set(sceneId, known);
  return known;
};

export const persistSceneFiles = async (
  sceneId: Id<"scenes">,
  canvas: ExcalidrawImperativeAPI,
) => {
  if (!convexClient) {
    throw new Error("Convex is not connected.");
  }
  const files = canvas.getFiles();
  const fileIds = collectSceneFileIds(canvas.getSceneElements());
  let known = uploadedVersions.get(sceneId);
  if (!known) {
    known = await seedUploaded(sceneId);
  }
  const pending = fileIds.flatMap((fileId) => {
    const file = files[fileId];
    if (!file) {
      return [];
    }
    const version = file.version ?? 1;
    if (known.get(fileId) === version) {
      return [];
    }
    return [{ fileId, file, version }];
  });
  if (pending.length === 0) {
    return;
  }
  for (let index = 0; index < pending.length; index += FILE_UPLOAD_BATCH) {
    const batch = pending.slice(index, index + FILE_UPLOAD_BATCH);
    const uploadUrls = await convexClient.mutation(
      api.sceneFiles.generateUploadUrls,
      { count: batch.length },
    );
    const attached = await Promise.all(
      batch.map(async (item, itemIndex) => {
        const uploadUrl = uploadUrls[itemIndex];
        if (!uploadUrl) {
          throw new Error("Could not upload scene file");
        }
        const blob = dataURLToFile(item.file.dataURL, item.fileId);
        if (blob.size > MAX_SCENE_FILE_BYTES) {
          throw new Error("A file in this scene is too large to save.");
        }
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": blob.type || item.file.mimeType },
          body: blob,
        });
        if (!response.ok) {
          throw new Error("Could not upload scene file");
        }
        const storageId = readStorageId(await response.json());
        if (!storageId) {
          throw new Error("Could not upload scene file");
        }
        return {
          fileId: item.fileId,
          storageId,
          mimeType: item.file.mimeType,
          version: item.version,
        };
      }),
    );
    await convexClient.mutation(api.sceneFiles.attachMany, {
      sceneId,
      files: attached,
    });
    for (const file of attached) {
      rememberUploaded(sceneId, file.fileId, file.version);
    }
  }
};

export const takeScenePreview = async (
  sceneId: Id<"scenes">,
  sceneJson: string,
  files: BinaryFiles,
  hasElements: boolean,
) => {
  if (!hasElements) {
    previewSignatures.delete(sceneId);
    return undefined;
  }
  const data = JSON.parse(sceneJson) as ImportedDataState;
  const signature = JSON.stringify(data.elements ?? []);
  if (previewSignatures.get(sceneId) === signature) {
    return undefined;
  }
  const previewDataUrl = await buildScenePreviewDataUrl(sceneJson, files);
  if (!previewDataUrl) {
    return undefined;
  }
  return { previewDataUrl, signature };
};

export const commitScenePreview = (
  sceneId: Id<"scenes">,
  signature: string,
) => {
  previewSignatures.set(sceneId, signature);
};

export const loadSceneFiles = async (
  sceneId: Id<"scenes">,
  canvas: ExcalidrawImperativeAPI,
) => {
  if (!convexClient) {
    return;
  }
  const rows = await convexClient.query(api.sceneFiles.list, { sceneId });
  const known = new Map<string, number>();
  for (const row of rows) {
    known.set(row.fileId, row.version);
  }
  uploadedVersions.set(sceneId, known);
  const loaded = (
    await Promise.all(
      rows.map(async (row) => {
        if (!row.url) {
          return null;
        }
        const response = await fetch(row.url);
        if (!response.ok) {
          return null;
        }
        const file: BinaryFileData = {
          id: row.fileId as FileId,
          dataURL: await getDataURL(await response.blob()),
          mimeType: asFileMime(row.mimeType),
          created: Date.now(),
          version: row.version,
        };
        return file;
      }),
    )
  ).filter((file): file is BinaryFileData => file !== null);
  if (loaded.length > 0) {
    canvas.addFiles(loaded);
  }
};

export const applySceneJsonToCanvas = (
  canvas: ExcalidrawImperativeAPI,
  sceneJson: string,
) => {
  const data = JSON.parse(sceneJson) as ImportedDataState;
  if (!Array.isArray(data.elements)) {
    throw new Error("This scene is not valid.");
  }

  const elements = restoreElements(data.elements, null);
  const appState = restoreAppState(data.appState, canvas.getAppState());
  // Saved scroll/zoom can leave the viewport on empty canvas, so frame the
  // content on load instead.
  const visible = elements.filter((element) => !element.isDeleted);
  const viewport = visible.length
    ? zoomToFitBounds({
        bounds: getCommonBounds(visible),
        appState: { ...canvas.getAppState(), ...appState },
      }).appState
    : null;
  canvas.updateScene({
    elements,
    appState: {
      ...appState,
      ...(viewport && {
        scrollX: viewport.scrollX,
        scrollY: viewport.scrollY,
        zoom: viewport.zoom,
      }),
      isLoading: false,
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });

  if (data.files) {
    canvas.addFiles(Object.values(data.files));
  }
};

export const applySavedSceneToCanvas = async (
  canvas: ExcalidrawImperativeAPI,
  sceneId: Id<"scenes">,
  sceneJson: string,
) => {
  applySceneJsonToCanvas(canvas, sceneJson);
  await loadSceneFiles(sceneId, canvas);
};

export const nextSceneName = (existingNames: string[]) => {
  const used = new Set(existingNames);
  let index = existingNames.length + 1;
  let name = `Scene ${index}`;
  while (used.has(name)) {
    index += 1;
    name = `Scene ${index}`;
  }
  return name;
};

export const saveCanvasAsScene = async (
  apiClient: ExcalidrawImperativeAPI,
  name?: string,
  folderId?: Id<"sceneFolders">,
): Promise<Id<"scenes">> => {
  if (!convexClient) {
    throw new Error("Convex is not connected.");
  }
  const listed = await convexClient.query(api.scenes.list, {
    folderId: folderId ?? null,
  });
  const sceneJson = serializeCurrentCanvas(apiClient);
  const sceneId = await convexClient.mutation(api.scenes.create, {
    name: name?.trim() || nextSceneName(listed.map((scene) => scene.name)),
    sceneJson,
    previewDataUrl: await buildScenePreviewDataUrl(
      sceneJson,
      apiClient.getFiles(),
    ),
    folderId,
  });
  await persistSceneFiles(sceneId, apiClient);
  return sceneId;
};

export const openBlankCanvas = (apiClient: ExcalidrawImperativeAPI) => {
  setActiveSceneId(null);
  apiClient.resetScene({ resetLoadingState: true });
};
