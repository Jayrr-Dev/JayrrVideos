import {
  CaptureUpdateAction,
  exportToCanvas,
  isInvisiblySmallElement,
  restoreAppState,
  restoreElements,
  serializeAsJSON,
} from "@excalidraw/excalidraw";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { appJotaiStore, atom } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";
import { api, convexClient } from "../convexClient";

import type { Id } from "../../convex/_generated/dataModel";

export const activeSceneIdAtom = atom<Id<"scenes"> | null>(
  readStoredActiveSceneId(),
);

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

export const serializeCurrentCanvas = (canvas: ExcalidrawImperativeAPI) => {
  const compact = JSON.parse(
    serializeAsJSON(
      canvas.getSceneElementsIncludingDeleted(),
      canvas.getAppState(),
      canvas.getFiles(),
      "local",
    ),
  ) as ImportedDataState;
  return JSON.stringify(compact);
};

export const buildScenePreviewDataUrl = async (sceneJson: string) => {
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
      files: data.files ?? null,
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
  canvas.updateScene({
    elements,
    appState: {
      ...appState,
      isLoading: false,
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });

  if (data.files) {
    canvas.addFiles(Object.values(data.files));
  }
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
    previewDataUrl: await buildScenePreviewDataUrl(sceneJson),
    folderId,
  });
  setActiveSceneId(sceneId);
  return sceneId;
};
