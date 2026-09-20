import type { ClipboardData } from "@excalidraw/excalidraw/clipboard";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { insertPdfEmbed, isPdfFile } from "./insertPdf";

const listPdfFiles = (files: FileList | File[] | null | undefined): File[] => {
  if (!files || files.length === 0) {
    return [];
  }
  return Array.from(files).filter(isPdfFile);
};

/**
 * Returns true when paste was handled (caller should cancel default paste).
 */
export const tryPastePdf = async (
  api: ExcalidrawImperativeAPI,
  _data: ClipboardData,
  event: ClipboardEvent | null,
): Promise<boolean> => {
  if (
    event != null &&
    "shiftKey" in event &&
    (event as { shiftKey?: boolean }).shiftKey
  ) {
    return false;
  }

  const pdfs = listPdfFiles(event?.clipboardData?.files);
  if (pdfs.length === 0) {
    return false;
  }

  for (const file of pdfs) {
    await insertPdfEmbed(api, file);
  }
  return true;
};

export const tryDropPdfFiles = async (
  api: ExcalidrawImperativeAPI,
  event: DragEvent,
): Promise<boolean> => {
  const pdfs = listPdfFiles(event.dataTransfer?.files);
  if (pdfs.length === 0) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  for (const file of pdfs) {
    await insertPdfEmbed(api, file);
  }
  return true;
};

export const dataTransferHasPdfFile = (
  dataTransfer: DataTransfer | null,
): boolean => {
  if (!dataTransfer) {
    return false;
  }
  if (dataTransfer.files?.length) {
    return Array.from(dataTransfer.files).some(isPdfFile);
  }
  return Array.from(dataTransfer.items ?? []).some((item) => {
    if (item.kind !== "file") {
      return false;
    }
    return (item.type || "").toLowerCase() === "application/pdf";
  });
};
