import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";

import { JAYRR_CALLED_OBJECT_KEY } from "../model";

export type SoundConfig = {
  fileId: FileId | "";
  title: string;
  /** Original audio mime type; stored files come back as octet-stream. */
  mimeType: string;
  loop: boolean;
  volume: number;
};

export const DEFAULT_SOUND: SoundConfig = {
  fileId: "",
  title: "Sound",
  mimeType: "",
  loop: false,
  volume: 1,
};

export const SOUND_DEFAULT_WIDTH = 240;
export const SOUND_DEFAULT_HEIGHT = 40;

const clampVolume = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : DEFAULT_SOUND.volume;

export const readSoundConfig = (
  element: Pick<ExcalidrawElement, "customData">,
): SoundConfig => {
  const bag = element.customData?.[JAYRR_CALLED_OBJECT_KEY];
  if (!bag || typeof bag !== "object") {
    return DEFAULT_SOUND;
  }
  const { fileId, title, mimeType, loop, volume } = bag as Record<
    string,
    unknown
  >;
  return {
    fileId: typeof fileId === "string" ? (fileId as FileId | "") : "",
    title:
      typeof title === "string" && title.trim()
        ? title.trim()
        : DEFAULT_SOUND.title,
    mimeType: typeof mimeType === "string" ? mimeType : "",
    loop: loop === true,
    volume: clampVolume(volume),
  };
};

export const writeSoundConfig = (
  element: Pick<ExcalidrawElement, "customData">,
  config: SoundConfig,
): ExcalidrawElement["customData"] => {
  const previous = element.customData?.[JAYRR_CALLED_OBJECT_KEY];
  const bag: Record<string, unknown> =
    previous && typeof previous === "object"
      ? { ...(previous as Record<string, unknown>) }
      : {};
  bag.kind = "sound";
  bag.fileId = config.fileId;
  bag.title = config.title;
  bag.mimeType = config.mimeType;
  bag.loop = config.loop;
  bag.volume = clampVolume(config.volume);
  return {
    ...(element.customData ?? {}),
    [JAYRR_CALLED_OBJECT_KEY]: bag,
  };
};

export const readSoundFileId = (
  element: Pick<ExcalidrawElement, "customData" | "link" | "isDeleted">,
): FileId | null => {
  if (element.isDeleted) {
    return null;
  }
  const { fileId } = readSoundConfig(element);
  return fileId || null;
};

export const titleFromSoundFileName = (name: string) =>
  name.replace(/\.[a-z0-9]{2,5}$/i, "").trim() || DEFAULT_SOUND.title;
