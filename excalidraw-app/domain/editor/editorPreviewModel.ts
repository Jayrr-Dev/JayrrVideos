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
const layerTargets = new Map<string, EditorPreviewLayers>();
const soundElements = new Map<string, HTMLMediaElement>();
const videoListeners = new Set<() => void>();
const audioListeners = new Set<(audio: EditorPreviewAudio) => void>();

const notifyVideoListeners = () => {
  for (const listener of videoListeners) {
    listener();
  }
};

export type EditorPreviewAudio = { volume: number; muted: boolean };

export type EditorPreviewLayers = {
  /** Currently preferred / primary base element (always present). */
  base: HTMLVideoElement;
  /** Second base used to cross-cut without clearing the visible frame. */
  baseAlt?: HTMLVideoElement | null;
  stacks: readonly HTMLVideoElement[];
  composition?: HTMLIFrameElement | null;
  staticBase?: HTMLImageElement | null;
  staticStacks?: readonly HTMLImageElement[];
};

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

export const applyPreviewMediaMix = (
  media: HTMLMediaElement,
  clipVolume = 1,
  clipMuted = false,
) => {
  const mix = getEditorPreviewAudio();
  const gain = clampVolume(clipVolume);
  media.dataset.jayrrClipVolume = String(gain);
  if (clipMuted) {
    media.dataset.jayrrClipMuted = "1";
  } else {
    delete media.dataset.jayrrClipMuted;
  }
  media.volume = clampVolume(mix.volume * gain);
  media.muted = mix.muted || clipMuted;
};

const applyAudioToVideo = (
  video: HTMLVideoElement,
  audio: EditorPreviewAudio,
) => {
  const stored = Number.parseFloat(video.dataset.jayrrClipVolume ?? "1");
  const gain = Number.isFinite(stored) ? clampVolume(stored) : 1;
  video.volume = clampVolume(audio.volume * gain);
  video.muted = audio.muted || video.dataset.jayrrClipMuted === "1";
};

const applyAudioToSounds = (audio: EditorPreviewAudio) => {
  for (const sound of soundElements.values()) {
    const stored = Number.parseFloat(sound.dataset.jayrrClipVolume ?? "1");
    const gain = Number.isFinite(stored) ? clampVolume(stored) : 1;
    sound.volume = clampVolume(audio.volume * gain);
    sound.muted = audio.muted || sound.dataset.jayrrClipMuted === "1";
  }
};

const eachRegisteredVideo = (visit: (video: HTMLVideoElement) => void) => {
  const seen = new Set<HTMLVideoElement>();
  for (const layers of layerTargets.values()) {
    const pair = [layers.base, layers.baseAlt, ...layers.stacks];
    for (const video of pair) {
      if (!video || seen.has(video)) {
        continue;
      }
      seen.add(video);
      visit(video);
    }
  }
  for (const video of videos.values()) {
    if (seen.has(video)) {
      continue;
    }
    seen.add(video);
    visit(video);
  }
};

const applyAudioToVideos = (
  audio: EditorPreviewAudio,
  extra?: HTMLVideoElement | null,
) => {
  let extraIsRegistered = false;
  eachRegisteredVideo((video) => {
    applyAudioToVideo(video, audio);
    if (video === extra) {
      extraIsRegistered = true;
    }
  });
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
  applyAudioToSounds(globalAudio);
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
  notifyVideoListeners();
  return () => {
    if (videos.get(elementId) === video) {
      videos.delete(elementId);
      notifyVideoListeners();
    }
  };
};

export const registerEditorPreviewLayers = (
  elementId: string,
  layers: EditorPreviewLayers,
) => {
  layerTargets.set(elementId, layers);
  videos.set(elementId, layers.base);
  const audio = getEditorPreviewAudio();
  applyAudioToVideo(layers.base, audio);
  if (layers.baseAlt) {
    applyAudioToVideo(layers.baseAlt, audio);
  }
  for (const stack of layers.stacks) {
    applyAudioToVideo(stack, audio);
  }
  notifyVideoListeners();
  return () => {
    if (layerTargets.get(elementId) === layers) {
      layerTargets.delete(elementId);
    }
    if (videos.get(elementId) === layers.base) {
      videos.delete(elementId);
    }
    notifyVideoListeners();
  };
};

export const getEditorPreviewLayers = (elementId: string) =>
  layerTargets.get(elementId) ?? null;

export const subscribeEditorPreviewVideos = (listener: () => void) => {
  videoListeners.add(listener);
  listener();
  return () => {
    videoListeners.delete(listener);
  };
};

export const getEditorPreviewVideo = (elementId: string) =>
  videos.get(elementId) ?? null;

export const registerEditorPreviewSound = (
  clipId: string,
  audio: HTMLMediaElement,
) => {
  soundElements.set(clipId, audio);
  applyPreviewMediaMix(audio);
  return () => {
    if (soundElements.get(clipId) === audio) {
      soundElements.delete(clipId);
    }
  };
};

export const getEditorPreviewSounds = () => [...soundElements.values()];

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

export const findEditorPreviewLayers = (
  elementId: string,
  doc: Document,
): EditorPreviewLayers | null => {
  const registered = getEditorPreviewLayers(elementId);
  if (registered) {
    return registered;
  }
  const base = findEditorTargetVideo(elementId, doc);
  if (!base) {
    return null;
  }
  return { base, stacks: [], staticStacks: [] };
};

/** Prefer the linked preview; otherwise use any registered editor preview on the page. */
export const resolveEditorPreviewLayers = (
  elementId: string | null,
  doc: Document,
): EditorPreviewLayers | null => {
  if (elementId) {
    const linked = findEditorPreviewLayers(elementId, doc);
    if (linked) {
      return linked;
    }
  }
  for (const layers of layerTargets.values()) {
    return layers;
  }
  const embed = doc.querySelector<HTMLElement>(".jayrr-editor-preview-embed");
  const fallbackId = embed?.getAttribute("data-element-id");
  if (fallbackId && fallbackId !== elementId) {
    return findEditorPreviewLayers(fallbackId, doc);
  }
  return null;
};

export const firstRegisteredPreviewElementId = () => {
  for (const id of layerTargets.keys()) {
    return id;
  }
  return null;
};
