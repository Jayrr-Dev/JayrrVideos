import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { appJotaiStore, atom } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";
import { api, convexClient } from "../convexClient";

import type { Id } from "../../convex/_generated/dataModel";

export const openLibraryIdAtom = atom<Id<"libraries"> | null>(
  readStoredOpenLibraryId(),
);

export function readStoredOpenLibraryId(): Id<"libraries"> | null {
  try {
    const stored = localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_OPEN_LIBRARY_ID,
    );
    return stored ? (stored as Id<"libraries">) : null;
  } catch {
    return null;
  }
}

export const serializeFilesForElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  files: BinaryFiles,
): string | undefined => {
  const used: BinaryFiles = {};
  for (const element of elements) {
    if ("fileId" in element && element.fileId && files[element.fileId]) {
      used[element.fileId] = files[element.fileId];
    }
  }
  if (Object.keys(used).length === 0) {
    return undefined;
  }
  return JSON.stringify(used);
};

export const addSelectionToOpenLibrary = async (
  elements: readonly NonDeletedExcalidrawElement[],
  files: BinaryFiles,
) => {
  if (!convexClient) {
    throw new Error("Convex is not connected.");
  }
  if (!elements.length) {
    throw new Error("Select something on the canvas first.");
  }

  let libraryId = appJotaiStore.get(openLibraryIdAtom);
  if (!libraryId) {
    const listed = await convexClient.query(api.libraries.list, {});
    if (listed[0]) {
      libraryId = listed[0]._id;
    } else {
      libraryId = await convexClient.mutation(api.libraries.create, {
        name: "Library 1",
      });
    }
    appJotaiStore.set(openLibraryIdAtom, libraryId);
  }

  await convexClient.mutation(api.libraries.addAsset, {
    libraryId,
    elementsJson: JSON.stringify(elements),
    filesJson: serializeFilesForElements(elements, files),
  });
};
