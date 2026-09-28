import type { ClipboardData } from "@excalidraw/excalidraw/clipboard";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { insertSoundEmbed, isAudioFile } from "./insertSound";

const listAudioFiles = (
  files: FileList | File[] | null | undefined,
): File[] => {
  if (!files || files.length === 0) {
    return [];
  }
  return Array.from(files).filter(isAudioFile);
};

/**
 * Returns true when paste was handled (caller should cancel default paste).
 */
export const tryPasteSound = async (
  api: ExcalidrawImperativeAPI,
  _data: ClipboardData,
  event: ClipboardEvent | null,
): Promise<boolean> => {
  const sounds = listAudioFiles(event?.clipboardData?.files);
  if (sounds.length === 0) {
    return false;
  }
  for (const file of sounds) {
    await insertSoundEmbed(api, file);
  }
  return true;
};

export const tryDropSoundFiles = async (
  api: ExcalidrawImperativeAPI,
  event: DragEvent,
  point?: { x: number; y: number },
): Promise<boolean> => {
  const sounds = listAudioFiles(event.dataTransfer?.files);
  if (sounds.length === 0) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  let offset = 0;
  for (const file of sounds) {
    await insertSoundEmbed(
      api,
      file,
      point ? { x: point.x, y: point.y + offset } : undefined,
    );
    offset += 140;
  }
  return true;
};

export const dataTransferHasSoundFile = (
  dataTransfer: DataTransfer | null,
): boolean => {
  if (!dataTransfer) {
    return false;
  }
  if (dataTransfer.files?.length) {
    return Array.from(dataTransfer.files).some(isAudioFile);
  }
  return Array.from(dataTransfer.items ?? []).some(
    (item) =>
      item.kind === "file" &&
      (item.type || "").toLowerCase().startsWith("audio/"),
  );
};
