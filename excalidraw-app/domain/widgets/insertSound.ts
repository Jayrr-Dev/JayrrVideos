import { MIME_TYPES } from "@excalidraw/common";
import { CaptureUpdateAction, newEmbeddableElement } from "@excalidraw/element";
import {
  generateIdFromFile,
  getDataURL,
} from "@excalidraw/excalidraw/data/blob";

import type { FileId } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { FILE_UPLOAD_MAX_BYTES } from "../../app_constants";

import { JAYRR_CALLED_OBJECT_KEY, calledObjectLink } from "./model";
import {
  DEFAULT_SOUND,
  SOUND_DEFAULT_HEIGHT,
  SOUND_DEFAULT_WIDTH,
  titleFromSoundFileName,
  type SoundConfig,
} from "./objects/soundConfig";

const AUDIO_EXTENSIONS: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  weba: "audio/webm",
};

const extensionOf = (name: string) =>
  name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

export const isAudioFile = (file: File): boolean =>
  (file.type || "").toLowerCase().startsWith("audio/") ||
  extensionOf(file.name) in AUDIO_EXTENSIONS;

export const audioMimeTypeOf = (file: File): string =>
  (file.type || "").toLowerCase().startsWith("audio/")
    ? file.type
    : AUDIO_EXTENSIONS[extensionOf(file.name)] ?? "audio/mpeg";

/** Registers the audio bytes with the scene and returns the sound config. */
export const addSoundFile = async (
  api: ExcalidrawImperativeAPI,
  file: File,
  base: SoundConfig = DEFAULT_SOUND,
): Promise<SoundConfig> => {
  const mimeType = audioMimeTypeOf(file);
  const fileId = (await generateIdFromFile(file)) as FileId;
  const dataURL = await getDataURL(file);
  if (dataURL.length > FILE_UPLOAD_MAX_BYTES) {
    api.setToast({
      message: `"${file.name}" is over the ${Math.trunc(
        FILE_UPLOAD_MAX_BYTES / 1024 / 1024,
      )}MB sync limit — it plays here but collaborators won't receive it.`,
      duration: 6000,
    });
  }
  api.addFiles([
    {
      id: fileId,
      dataURL,
      mimeType: MIME_TYPES.binary,
      created: Date.now(),
    },
  ]);
  return {
    ...base,
    fileId,
    mimeType,
    title: titleFromSoundFileName(file.name || base.title),
  };
};

export const insertSoundEmbed = async (
  api: ExcalidrawImperativeAPI,
  file: File,
  opts?: { x?: number; y?: number },
) => {
  const config = await addSoundFile(api, file);
  const element = newEmbeddableElement({
    type: "embeddable",
    x: opts?.x != null ? opts.x - SOUND_DEFAULT_WIDTH / 2 : 0,
    y: opts?.y != null ? opts.y - SOUND_DEFAULT_HEIGHT / 2 : 0,
    width: SOUND_DEFAULT_WIDTH,
    height: SOUND_DEFAULT_HEIGHT,
    link: calledObjectLink("sound"),
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    roughness: 0,
    customData: {
      [JAYRR_CALLED_OBJECT_KEY]: { kind: "sound", ...config },
    },
  });

  if (opts?.x != null && opts?.y != null) {
    api.updateScene({
      elements: [...api.getSceneElementsIncludingDeleted(), element],
      appState: { selectedElementIds: { [element.id]: true } },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  } else {
    api.insertElementsFromLibrary({ elements: [element] });
  }
  return element;
};
