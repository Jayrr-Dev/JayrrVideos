import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";

import { JAYRR_CALLED_OBJECT_KEY } from "../model";

export type PdfConfig = {
  fileId: FileId | "";
  title: string;
};

export const DEFAULT_PDF: PdfConfig = {
  fileId: "",
  title: "PDF",
};

export const PDF_DEFAULT_WIDTH = 480;
export const PDF_DEFAULT_HEIGHT = 640;

export const readPdfConfig = (
  element: Pick<ExcalidrawElement, "customData">,
): PdfConfig => {
  const bag = element.customData?.[JAYRR_CALLED_OBJECT_KEY];
  if (!bag || typeof bag !== "object") {
    return DEFAULT_PDF;
  }
  const fileId = (bag as { fileId?: unknown }).fileId;
  const title = (bag as { title?: unknown }).title;
  return {
    fileId: typeof fileId === "string" ? (fileId as FileId | "") : "",
    title:
      typeof title === "string" && title.trim()
        ? title.trim()
        : DEFAULT_PDF.title,
  };
};

export const writePdfConfig = (
  element: Pick<ExcalidrawElement, "customData">,
  config: PdfConfig,
): ExcalidrawElement["customData"] => {
  const previous = element.customData?.[JAYRR_CALLED_OBJECT_KEY];
  const bag: Record<string, unknown> =
    previous && typeof previous === "object"
      ? { ...(previous as Record<string, unknown>) }
      : {};
  bag.kind = "pdf";
  bag.fileId = config.fileId;
  bag.title = config.title;
  return {
    ...(element.customData ?? {}),
    [JAYRR_CALLED_OBJECT_KEY]: bag,
  };
};

export const readPdfFileId = (
  element: Pick<ExcalidrawElement, "customData" | "link" | "isDeleted">,
): FileId | null => {
  if (element.isDeleted) {
    return null;
  }
  const { fileId } = readPdfConfig(element);
  return fileId || null;
};

export const titleFromPdfFileName = (name: string) =>
  name.replace(/\.pdf$/i, "").trim() || "PDF";
