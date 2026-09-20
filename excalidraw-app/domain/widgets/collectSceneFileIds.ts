import { isInitializedImageElement } from "@excalidraw/element";

import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";

import { readCalledObjectKind } from "./model";
import { readPdfFileId } from "./objects/pdfConfig";

/** Image + Jayrr PDF embed file ids referenced by the scene. */
export const collectSceneFileIds = (
  elements: readonly ExcalidrawElement[],
  opts?: { onlyMissing?: Readonly<Record<string, unknown>> },
): FileId[] => {
  const ids: FileId[] = [];
  const seen = new Set<string>();
  for (const element of elements) {
    if (isInitializedImageElement(element)) {
      if (opts?.onlyMissing && opts.onlyMissing[element.fileId]) {
        continue;
      }
      if (!seen.has(element.fileId)) {
        seen.add(element.fileId);
        ids.push(element.fileId);
      }
      continue;
    }
    if (readCalledObjectKind(element) !== "pdf") {
      continue;
    }
    const fileId = readPdfFileId(element);
    if (!fileId) {
      continue;
    }
    if (opts?.onlyMissing && opts.onlyMissing[fileId]) {
      continue;
    }
    if (!seen.has(fileId)) {
      seen.add(fileId);
      ids.push(fileId);
    }
  }
  return ids;
};
