import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { jayrrSoundPlayUrls } from "../../sounds/jayrrSoundPlayback";

import { audioMimeTypeOf, insertSoundEmbed } from "./insertSound";

/** Drag payload from the Sound Library onto the canvas. */
export const JAYRR_SOUND_LIBRARY_DRAG = "application/x-jayrr-library-sound";

export type LibrarySoundRef = {
  name: string;
  path: string;
  url?: string | null;
};

export const serializeLibrarySoundDrag = (sound: LibrarySoundRef) =>
  JSON.stringify({
    name: sound.name,
    path: sound.path,
    url: sound.url ?? null,
  });

export const parseLibrarySoundDrag = (raw: string): LibrarySoundRef | null => {
  try {
    const data = JSON.parse(raw) as Partial<LibrarySoundRef>;
    if (typeof data.name !== "string") {
      return null;
    }
    const path = typeof data.path === "string" ? data.path : "";
    const url = typeof data.url === "string" ? data.url : null;
    if (!path && !url) {
      return null;
    }
    return { name: data.name, path, url };
  } catch {
    return null;
  }
};

const extensionFrom = (value: string) =>
  value
    .split(/[?#]/)[0]
    .match(/\.([a-z0-9]{2,5})$/i)?.[1]
    ?.toLowerCase() ?? "";

/** Downloads a library sound, trying the local proxy first, then Convex. */
const fetchLibrarySoundFile = async (sound: LibrarySoundRef): Promise<File> => {
  const sources = jayrrSoundPlayUrls(sound.url ?? null, sound.path);
  for (const src of sources) {
    try {
      const response = await fetch(src);
      if (!response.ok) {
        continue;
      }
      const blob = await response.blob();
      if (blob.size === 0) {
        continue;
      }
      const ext = extensionFrom(sound.path) || extensionFrom(src) || "mp3";
      const draft = new File([blob], `${sound.name}.${ext}`);
      const type = blob.type.startsWith("audio/")
        ? blob.type
        : audioMimeTypeOf(draft);
      return new File([blob], draft.name, { type });
    } catch {
      // try the next source
    }
  }
  throw new Error(`Couldn’t download “${sound.name}”.`);
};

/**
 * Adds a Sound Library entry to the canvas as a sound widget. Places it at
 * `point` (scene coords) when given, otherwise at the viewport center.
 */
export const insertLibrarySound = async (
  api: ExcalidrawImperativeAPI,
  sound: LibrarySoundRef,
  point?: { x: number; y: number },
) => {
  try {
    const file = await fetchLibrarySoundFile(sound);
    return await insertSoundEmbed(api, file, point);
  } catch (error) {
    api.setToast({
      message:
        error instanceof Error ? error.message : "Couldn’t add this sound.",
      duration: 4000,
    });
    return null;
  }
};
