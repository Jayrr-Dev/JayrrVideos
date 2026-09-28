import { isInitializedImageElement } from "@excalidraw/element";

import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";

import { readJayrrBgMediaFileId } from "../background/jayrrBgMedia";

import { readCalledObjectKind } from "./model";
import { readPdfFileId } from "./objects/pdfConfig";

/** Image + Jayrr PDF embed + fill-media file ids referenced by the scene. */
export const collectSceneFileIds = (
  elements: readonly ExcalidrawElement[],
  opts?: { onlyMissing?: Readonly<Record<string, unknown>> },
): FileId[] => {
  const ids: FileId[] = [];
  const seen = new Set<string>();
  const push = (fileId: FileId | null) => {
    if (!fileId || seen.has(fileId)) {
      return;
    }
    if (opts?.onlyMissing && opts.onlyMissing[fileId]) {
      return;
    }
    seen.add(fileId);
    ids.push(fileId);
  };
  for (const element of elements) {
    if (isInitializedImageElement(element)) {
      push(element.fileId);
    }
    if (readCalledObjectKind(element) === "pdf") {
      push(readPdfFileId(element));
    }
    push(readJayrrBgMediaFileId(element));
  }
  return ids;
};
