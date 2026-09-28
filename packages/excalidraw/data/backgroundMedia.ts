import { IMAGE_MIME_TYPES, MIME_TYPES } from "@excalidraw/common";
import { hasBackground, isStickyNoteElement } from "@excalidraw/element";

import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";

import type { BinaryFileData, DataURL } from "../types";

export const JAYRR_BG_MEDIA_KEY = "jayrrBgMedia";

export type JayrrBgMedia = {
  fileId: FileId;
  mime: string;
};

export const canUseJayrrBgMedia = (element: ExcalidrawElement) =>
  !element.isDeleted &&
  hasBackground(element.type) &&
  !isStickyNoteElement(element) &&
  (element.type === "rectangle" ||
    element.type === "ellipse" ||
    element.type === "diamond");

export const readJayrrBgMedia = (
  element: Pick<ExcalidrawElement, "customData" | "isDeleted">,
): JayrrBgMedia | null => {
  if (element.isDeleted) {
    return null;
  }
  const bag = element.customData?.[JAYRR_BG_MEDIA_KEY];
  if (!bag || typeof bag !== "object") {
    return null;
  }
  const fileId = (bag as { fileId?: unknown }).fileId;
  const mime = (bag as { mime?: unknown }).mime;
  if (typeof fileId !== "string" || !fileId) {
    return null;
  }
  return {
    fileId: fileId as FileId,
    mime: typeof mime === "string" && mime ? mime : MIME_TYPES.binary,
  };
};

export const writeJayrrBgMedia = (
  element: Pick<ExcalidrawElement, "customData">,
  media: JayrrBgMedia | null,
): ExcalidrawElement["customData"] => {
  const customData: Record<string, unknown> = {
    ...(element.customData ?? {}),
  };
  if (!media) {
    delete customData[JAYRR_BG_MEDIA_KEY];
  } else {
    customData[JAYRR_BG_MEDIA_KEY] = media;
  }
  return Object.keys(customData).length
    ? (customData as ExcalidrawElement["customData"])
    : undefined;
};

export const readJayrrBgMediaFileId = (
  element: Pick<ExcalidrawElement, "customData" | "isDeleted">,
): FileId | null => readJayrrBgMedia(element)?.fileId ?? null;

const IMAGE_MIME = new Set<string>(Object.values(IMAGE_MIME_TYPES));

export const jayrrBgMediaKind = (mime: string) => {
  const lower = mime.toLowerCase();
  if (lower.startsWith("video/")) {
    return "video" as const;
  }
  return "image" as const;
};

export const normalizeJayrrBgMediaFile = (file: File): File | null => {
  const type = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  if (type.startsWith("image/") || type.startsWith("video/")) {
    return file;
  }
  if (name.endsWith(".gif")) {
    return new File([file], file.name, { type: IMAGE_MIME_TYPES.gif });
  }
  if (name.endsWith(".webp")) {
    return new File([file], file.name, { type: IMAGE_MIME_TYPES.webp });
  }
  if (name.endsWith(".png")) {
    return new File([file], file.name, { type: IMAGE_MIME_TYPES.png });
  }
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return new File([file], file.name, { type: IMAGE_MIME_TYPES.jpg });
  }
  if (name.endsWith(".mp4")) {
    return new File([file], file.name, { type: "video/mp4" });
  }
  if (name.endsWith(".webm")) {
    return new File([file], file.name, { type: "video/webm" });
  }
  if (name.endsWith(".mov")) {
    return new File([file], file.name, { type: "video/quicktime" });
  }
  return null;
};

export const binaryFileForJayrrBgMedia = (
  fileId: FileId,
  dataURL: DataURL,
  mime: string,
): BinaryFileData => ({
  id: fileId,
  dataURL,
  mimeType: IMAGE_MIME.has(mime)
    ? (mime as BinaryFileData["mimeType"])
    : MIME_TYPES.binary,
  created: Date.now(),
});
