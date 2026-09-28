import { isInitializedImageElement } from "@excalidraw/element";

import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";

import { readJayrrBgMediaFileId } from "../background/jayrrBgMedia";

import { readCalledObjectKind } from "./model";
import { readPdfFileId } from "./objects/pdfConfig";
import { readSoundFileId } from "./objects/soundConfig";

/** Image + Jayrr PDF/sound embed + fill-media file ids referenced by the scene. */
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
    const kind = readCalledObjectKind(element);
    if (kind === "pdf") {
      push(readPdfFileId(element));
    }
    if (kind === "sound") {
      push(readSoundFileId(element));
    }
    push(readJayrrBgMediaFileId(element));
  }
  return ids;
};
