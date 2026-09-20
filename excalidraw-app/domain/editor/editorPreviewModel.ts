import { useEffect, useState } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";

export const JAYRR_EDITOR_PREVIEW_KEY = "jayrrEditorPreview";
export const JAYRR_EDITOR_PREVIEW_PROTOCOL = "jayrr-editor:";
export const JAYRR_EDITOR_PREVIEW_KIND = "preview";
const AUDIO_STORAGE_KEY = "jayrr-editor-preview-audio-v1";

export const EDITOR_PREVIEW_WIDTH = 560;
export const EDITOR_PREVIEW_HEIGHT = 315;

export const editorPreviewLink = () =>
  `${JAYRR_EDITOR_PREVIEW_PROTOCOL}${JAYRR_EDITOR_PREVIEW_KIND}`;

export const isJayrrEditorPreviewLink = (link: string | null | undefined) =>
  Boolean(
    link &&
      link.startsWith(JAYRR_EDITOR_PREVIEW_PROTOCOL) &&
      link.slice(JAYRR_EDITOR_PREVIEW_PROTOCOL.length) ===
        JAYRR_EDITOR_PREVIEW_KIND,
  );

export const isJayrrEditorPreviewElement = (
  element: Pick<ExcalidrawElement, "customData" | "link" | "type">,
) => {
  if (element.type !== "embeddable") {
    return false;
  }
  if (isJayrrEditorPreviewLink(element.link)) {
    return true;
  }
  const bag = element.customData?.[JAYRR_EDITOR_PREVIEW_KEY];
  return Boolean(bag && typeof bag === "object");
};

const videos = new Map<string, HTMLVideoElement>();
const audioListeners = new Set<(audio: EditorPreviewAudio) => void>();

export type EditorPreviewAudio = { volume: number; muted: boolean };

const clampVolume = (value: number) => Math.min(1, Math.max(0, value));

const readStoredAudio = (): EditorPreviewAudio => {
  try {
    const raw = localStorage.getItem(AUDIO_STORAGE_KEY);
    if (!raw) {
      return { volume: 1, muted: false };
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { volume: 1, muted: false };
    }
    const volumeRaw = Reflect.get(parsed, "volume");
    const mutedRaw = Reflect.get(parsed, "muted");
    return {
      volume:
        typeof volumeRaw === "number" && Number.isFinite(volumeRaw)
          ? clampVolume(volumeRaw)
          : 1,
      muted: mutedRaw === true,
    };
  } catch {
    return { volume: 1, muted: false };
  }
};

const writeStoredAudio = (audio: EditorPreviewAudio) => {
  localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(audio));
};

let globalAudio = readStoredAudio();

export const getEditorPreviewAudio = (): EditorPreviewAudio => globalAudio;

const applyAudioToVideo = (
  video: HTMLVideoElement,
  audio: EditorPreviewAudio,
) => {
  video.volume = audio.volume;
  video.muted = audio.muted;
};

const applyAudioToVideos = (
  audio: EditorPreviewAudio,
  extra?: HTMLVideoElement | null,
) => {
  let extraIsRegistered = false;
  for (const video of videos.values()) {
    applyAudioToVideo(video, audio);
    if (video === extra) {
      extraIsRegistered = true;
    }
  }
  if (extra && !extraIsRegistered) {
    applyAudioToVideo(extra, audio);
  }
};

export const setEditorPreviewAudio = (
  audio: EditorPreviewAudio,
  extraVideo?: HTMLVideoElement | null,
) => {
  globalAudio = {
    volume: clampVolume(audio.volume),
    muted: audio.muted,
  };
  writeStoredAudio(globalAudio);
  applyAudioToVideos(globalAudio, extraVideo);
  for (const listener of audioListeners) {
    listener(globalAudio);
  }
};

export const subscribeEditorPreviewAudio = (
  listener: (audio: EditorPreviewAudio) => void,
) => {
  audioListeners.add(listener);
  listener(globalAudio);
  return () => {
    audioListeners.delete(listener);
  };
};

export const useEditorPreviewAudio = (extraVideo?: HTMLVideoElement | null) => {
  const [audio, setAudio] = useState(getEditorPreviewAudio);

  useEffect(() => subscribeEditorPreviewAudio(setAudio), []);

  const writeAudio = (nextVolume: number, nextMuted: boolean) => {
    setEditorPreviewAudio({ volume: nextVolume, muted: nextMuted }, extraVideo);
  };

  return { volume: audio.volume, muted: audio.muted, writeAudio };
};

export const registerEditorPreviewVideo = (
  elementId: string,
  video: HTMLVideoElement,
) => {
  videos.set(elementId, video);
  applyAudioToVideo(video, getEditorPreviewAudio());
  return () => {
    if (videos.get(elementId) === video) {
      videos.delete(elementId);
    }
  };
};

export const getEditorPreviewVideo = (elementId: string) =>
  videos.get(elementId) ?? null;

/** Resolve the video for a linked canvas object (preview widget or recording embed). */
export const findEditorTargetVideo = (
  elementId: string,
  doc: Document,
): HTMLVideoElement | null => {
  const registered = getEditorPreviewVideo(elementId);
  if (registered) {
    return registered;
  }
  return doc.querySelector<HTMLVideoElement>(
    `video[data-element-id="${CSS.escape(elementId)}"]`,
  );
};
