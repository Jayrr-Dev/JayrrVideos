import { useCallback, useEffect, useRef, useState } from "react";

import { jayrrSoundPlayUrls } from "../../sounds/jayrrSoundPlayback";

import {
  baseBlendAtTime,
  clipAtTime,
  clipLaneId,
  collectLaneOverlaps,
  clipPlaybackMuted,
  clipVolumeValue,
  editorHasClips,
  isEditorAudioLikeClip,
  isEditorClocklessVisual,
  isEditorHtmlClip,
  isEditorSoundClip,
  isEditorStaticClip,
  isEditorVideoClip,
  isSameLaneOverlap,
  overlapAtTime,
  overlapContainsTime,
  overlayOnLaneAtTime,
  SEQUENCE_LANE_ID,
  stackBlendAtTime,
  videoClipAtTime,
  visualClipAtTime,
  type EditorClip,
  type EditorTimeline,
  type LaneOverlap,
  type LayerBlend,
} from "./buildEditorTimeline";
import {
  getEditorPreviewCutoutCanvas,
  syncEditorClipCutout,
} from "./editorClipCutout";
import {
  applyPreviewMediaMix,
  registerEditorPreviewSound,
  resolveEditorPreviewLayers,
  subscribeEditorPreviewVideos,
  type EditorPreviewLayers,
} from "./editorPreviewModel";
import { seekHyperframeFrame } from "./hyperframesClip";

type UseEditorPlaybackOpts = {
  timeline: EditorTimeline;
  stackLaneIds: readonly string[];
  /** Linked canvas element that hosts the video. */
  previewElementId: string | null;
  ownerDocument: Document;
};

const LAYER_ON = "is-on";

const clipHasRemoveBg = (clip: EditorClip | null | undefined) =>
  Boolean(clip && isEditorVideoClip(clip) && clip.removeBg);

const applyBlendToNode = (node: HTMLElement, blend: LayerBlend | null) => {
  if (!blend) {
    node.style.removeProperty("--jayrr-layer-opacity");
    node.style.removeProperty("clip-path");
    node.style.removeProperty("mix-blend-mode");
    return;
  }
  node.style.setProperty("--jayrr-layer-opacity", String(blend.opacity));
  if (blend.clipPath) {
    node.style.clipPath = blend.clipPath;
  } else {
    node.style.removeProperty("clip-path");
  }
  if (blend.mixBlendMode) {
    node.style.mixBlendMode = blend.mixBlendMode;
  } else {
    node.style.removeProperty("mix-blend-mode");
  }
};

const applyBlend = (video: HTMLVideoElement, blend: LayerBlend | null) => {
  const canvas = getEditorPreviewCutoutCanvas(video);
  const targets: HTMLElement[] = canvas ? [video, canvas] : [video];
  for (const node of targets) {
    applyBlendToNode(node, blend);
  }
};

const setLayerVisible = (
  video: HTMLVideoElement,
  on: boolean,
  blend?: LayerBlend | null,
  removeBg = false,
) => {
  video.classList.toggle(LAYER_ON, on);
  applyBlend(
    video,
    on ? blend ?? { opacity: 1, clipPath: null, mixBlendMode: null } : null,
  );
  syncEditorClipCutout(video, on && removeBg);
};

const setStillVisible = (
  image: HTMLImageElement | null | undefined,
  on: boolean,
  blend?: LayerBlend | null,
) => {
  if (!image) {
    return;
  }
  image.classList.toggle(LAYER_ON, on);
  applyBlendToNode(
    image,
    on ? blend ?? { opacity: 1, clipPath: null, mixBlendMode: null } : null,
  );
};

const applyStillSrc = (image: HTMLImageElement, url: string) => {
  if (image.getAttribute("src") !== url) {
    image.src = url;
  }
};

const hideStills = (layers: EditorPreviewLayers) => {
  setStillVisible(layers.staticBase, false);
  for (const image of layers.staticStacks ?? []) {
    setStillVisible(image, false);
  }
};

const overlayVisualOnLaneAtTime = (
  overlays: readonly EditorClip[],
  laneId: string,
  timeMs: number,
) =>
  visualClipAtTime(
    overlays.filter((clip) => clipLaneId(clip) === laneId),
    timeMs,
  );
/** Start warming the next cut this far before the boundary. */
const PREFETCH_LEAD_MS = 900;
/** Skip a seek when the layer is already this close to the timeline clock. */
const SEEK_DRIFT_SEC = 0.35;

const WAIT_DATA_MS = 4000;
const SEEK_WAIT_MS = 1500;

const waitForData = (video: HTMLVideoElement) =>
  new Promise<void>((resolve) => {
    if (video.readyState >= 2) {
      resolve();
      return;
    }
    const finish = () => {
      window.clearTimeout(timer);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onReady);
      resolve();
    };
    const onReady = () => finish();
    const timer = window.setTimeout(finish, WAIT_DATA_MS);
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onReady);
  });

const sourceOffsetSec = (clip: EditorClip, timeMs: number) =>
  Math.max(0, ((clip.sourceOffsetMs ?? 0) + (timeMs - clip.startMs)) / 1000);

const seekVideo = async (video: HTMLVideoElement, offsetSec: number) => {
  const target = Math.min(
    offsetSec,
    Number.isFinite(video.duration) ? video.duration : offsetSec,
  );
  if (Math.abs(video.currentTime - target) < 0.04) {
    return;
  }
  await new Promise<void>((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    const onSeeked = () => finish();
    const timer = window.setTimeout(finish, SEEK_WAIT_MS);
    video.addEventListener("seeked", onSeeked);
    try {
      video.currentTime = target;
    } catch {
      finish();
      return;
    }
    // Some browsers skip seeked when already near the target.
    if (!video.seeking) {
      finish();
    }
  });
};

const projectMsFromVideo = (video: HTMLVideoElement, clip: EditorClip) => {
  const sourceOffsetMs = clip.sourceOffsetMs ?? 0;
  const withinMs = Math.max(0, video.currentTime * 1000 - sourceOffsetMs);
  return Math.min(clip.startMs + clip.durationMs, clip.startMs + withinMs);
};

const compositionTimeMs = (clip: EditorClip, timeMs: number) =>
  Math.max(0, (clip.sourceOffsetMs ?? 0) + (timeMs - clip.startMs));

const htmlClipAtTime = (
  sequence: readonly EditorClip[],
  overlays: readonly EditorClip[],
  laneClips: readonly (EditorClip | null)[],
  timeMs: number,
) => {
  for (let index = laneClips.length - 1; index >= 0; index--) {
    const clip = laneClips[index];
    if (clip && isEditorHtmlClip(clip)) {
      return clip;
    }
  }
  const sequenceClip = visualClipAtTime(sequence, timeMs);
  if (sequenceClip && isEditorHtmlClip(sequenceClip)) {
    return sequenceClip;
  }
  const overlayClip = visualClipAtTime(overlays, timeMs);
  if (overlayClip && isEditorHtmlClip(overlayClip)) {
    return overlayClip;
  }
  return null;
};

const setCompositionOn = (frame: HTMLIFrameElement | null, on: boolean) => {
  frame?.classList.toggle("is-on", on);
};

const videoHasUrl = (video: HTMLVideoElement, url: string) =>
  video.getAttribute("src") === url || video.currentSrc === url;

const videoMatchesClock = (
  video: HTMLVideoElement,
  clip: EditorClip,
  timeMs: number,
) => {
  if (isEditorHtmlClip(clip)) {
    return false;
  }
  return (
    videoHasUrl(video, clip.url) &&
    video.readyState >= 2 &&
    Math.abs(video.currentTime - sourceOffsetSec(clip, timeMs)) < SEEK_DRIFT_SEC
  );
};

type ApplyProgramMode = "all" | "stacks";

const nextSequenceClip = (
  sequence: readonly EditorClip[],
  current: EditorClip,
): EditorClip | null => {
  const endMs = current.startMs + current.durationMs;
  let best: EditorClip | null = null;
  for (const clip of sequence) {
    if (clip.id === current.id || isEditorAudioLikeClip(clip)) {
      continue;
    }
    if (clip.startMs < endMs) {
      continue;
    }
    if (!best || clip.startMs < best.startMs) {
      best = clip;
    }
  }
  return best;
};

const timelineHasVideo = (timeline: EditorTimeline) =>
  timeline.sequence.some((clip) => !isEditorAudioLikeClip(clip)) ||
  timeline.overlays.some((clip) => !isEditorAudioLikeClip(clip));

const coveringSounds = (timeline: EditorTimeline, timeMs: number) =>
  [...timeline.sequence, ...timeline.overlays].filter(
    (clip) =>
      isEditorAudioLikeClip(clip) &&
      timeMs >= clip.startMs &&
      timeMs < clip.startMs + clip.durationMs,
  );

const applyVideoMix = (
  video: HTMLVideoElement,
  clipMuted: boolean,
  clipVolume = 1,
) => {
  applyPreviewMediaMix(video, clipVolume, clipMuted);
};

const applyClipVideoMix = (video: HTMLVideoElement, clip: EditorClip) => {
  applyVideoMix(video, clipPlaybackMuted(clip), clipVolumeValue(clip));
};

const overlayVideoOnLaneAtTime = (
  overlays: readonly EditorClip[],
  laneId: string,
  timeMs: number,
) =>
  videoClipAtTime(
    overlays.filter((clip) => clipLaneId(clip) === laneId),
    timeMs,
  );

export const useEditorPlayback = ({
  timeline,
  stackLaneIds,
  previewElementId,
  ownerDocument,
}: UseEditorPlaybackOpts) => {
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const baseClipIdRef = useRef<string | null>(null);
  const baseActiveIsAltRef = useRef(false);
  const stackClipIdsRef = useRef<(string | null)[]>([]);
  const htmlClipIdRef = useRef<string | null>(null);
  const lastTickRef = useRef(0);
  const rafRef = useRef(0);
  const prefetchUrlRef = useRef<string | null>(null);
  const soundNodesRef = useRef(new Map<string, HTMLAudioElement>());
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;
  const stackLaneIdsRef = useRef(stackLaneIds);
  stackLaneIdsRef.current = stackLaneIds;
  const previewIdRef = useRef(previewElementId);
  previewIdRef.current = previewElementId;
  const docRef = useRef(ownerDocument);
  docRef.current = ownerDocument;

  const clockMs = (requestedMs: number, shouldPlay: boolean) =>
    shouldPlay && playingRef.current ? timeRef.current : requestedMs;

  const resolveLayers = useCallback((): EditorPreviewLayers | null => {
    return resolveEditorPreviewLayers(previewIdRef.current, docRef.current);
  }, []);

  const getActiveBase = useCallback((layers: EditorPreviewLayers) => {
    if (baseActiveIsAltRef.current && layers.baseAlt) {
      return layers.baseAlt;
    }
    return layers.base;
  }, []);

  const getIdleBase = useCallback((layers: EditorPreviewLayers) => {
    if (!layers.baseAlt) {
      return null;
    }
    return baseActiveIsAltRef.current ? layers.base : layers.baseAlt;
  }, []);

  const stopRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const pauseAll = useCallback((layers: EditorPreviewLayers | null) => {
    layers?.base.pause();
    layers?.baseAlt?.pause();
    for (const stack of layers?.stacks ?? []) {
      stack.pause();
    }
    for (const audio of soundNodesRef.current.values()) {
      audio.pause();
    }
  }, []);

  const prepareSrc = useCallback(
    async (
      video: HTMLVideoElement,
      url: string,
      clipMuted = false,
      clipVolume = 1,
    ) => {
      applyVideoMix(video, clipMuted, clipVolume);
      if (!url) {
        return;
      }
      if (video.crossOrigin !== "anonymous") {
        video.crossOrigin = "anonymous";
      }
      if (videoHasUrl(video, url) && video.readyState >= 2) {
        return;
      }
      if (!videoHasUrl(video, url)) {
        video.src = url;
        video.load();
      }
      await waitForData(video);
      applyVideoMix(video, clipMuted, clipVolume);
    },
    [],
  );

  const syncSounds = useCallback(
    async (timeMs: number, shouldPlay: boolean) => {
      const active = coveringSounds(timelineRef.current, timeMs);
      const activeIds = new Set(active.map((clip) => clip.id));
      const doc = docRef.current;
      for (const [id, audio] of soundNodesRef.current) {
        if (!activeIds.has(id)) {
          audio.pause();
        }
      }
      for (const clip of active) {
        if (!isEditorAudioLikeClip(clip)) {
          continue;
        }
        let audio = soundNodesRef.current.get(clip.id);
        if (!audio) {
          audio = doc.createElement("audio");
          audio.preload = "auto";
          soundNodesRef.current.set(clip.id, audio);
          registerEditorPreviewSound(clip.id, audio);
        }
        applyPreviewMediaMix(
          audio,
          clipVolumeValue(clip),
          clipPlaybackMuted(clip),
        );
        const src = isEditorSoundClip(clip)
          ? jayrrSoundPlayUrls(clip.url || null, clip.path)[0]
          : clip.url;
        if (src && audio.getAttribute("src") !== src) {
          audio.src = src;
        }
        const offset = sourceOffsetSec(clip, timeMs);
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          const clamped = Math.min(offset, Math.max(0, audio.duration - 0.05));
          if (Math.abs(audio.currentTime - clamped) > 0.12) {
            try {
              audio.currentTime = clamped;
            } catch {
              // Ignore seek errors on unloaded audio.
            }
          }
        }
        if (shouldPlay) {
          try {
            await audio.play();
          } catch {
            // Autoplay can fail until the user hits Play.
          }
        } else {
          audio.pause();
        }
      }
    },
    [],
  );

  const applyClipToLayer = useCallback(
    async (
      video: HTMLVideoElement,
      clip: EditorClip | null,
      timeMs: number,
      shouldPlay: boolean,
      blend: LayerBlend | null,
      isClockMaster: boolean,
    ): Promise<string | null> => {
      if (!clip || isEditorAudioLikeClip(clip)) {
        applyVideoMix(video, false);
        video.pause();
        setLayerVisible(video, false);
        return null;
      }
      if (isEditorClocklessVisual(clip)) {
        applyVideoMix(video, false);
        video.pause();
        setLayerVisible(video, false);
        return clip.id;
      }
      if (!clip.url) {
        applyVideoMix(video, false);
        video.pause();
        setLayerVisible(video, false);
        return null;
      }
      const at = clockMs(timeMs, shouldPlay);
      if (shouldPlay && videoMatchesClock(video, clip, at)) {
        applyClipVideoMix(video, clip);
        setLayerVisible(video, true, blend, clipHasRemoveBg(clip));
        if (video.paused) {
          try {
            await video.play();
          } catch {
            if (isClockMaster) {
              playingRef.current = false;
              setPlaying(false);
            }
          }
        }
        return clip.id;
      }
      await prepareSrc(
        video,
        clip.url,
        clipPlaybackMuted(clip),
        clipVolumeValue(clip),
      );
      applyClipVideoMix(video, clip);
      await seekVideo(
        video,
        sourceOffsetSec(clip, clockMs(timeMs, shouldPlay)),
      );
      setLayerVisible(video, true, blend, clipHasRemoveBg(clip));
      if (shouldPlay) {
        try {
          await video.play();
        } catch {
          if (isClockMaster) {
            playingRef.current = false;
            setPlaying(false);
          }
        }
      } else {
        video.pause();
      }
      return clip.id;
    },
    [prepareSrc],
  );

  const applyBaseClip = useCallback(
    async (
      layers: EditorPreviewLayers,
      clip: EditorClip | null,
      timeMs: number,
      shouldPlay: boolean,
      blend: LayerBlend | null,
    ): Promise<string | null> => {
      const active = getActiveBase(layers);
      const idle = getIdleBase(layers);

      if (!clip) {
        applyVideoMix(active, false);
        active.pause();
        setLayerVisible(active, false);
        if (idle) {
          applyVideoMix(idle, false);
          idle.pause();
          setLayerVisible(idle, false);
        }
        return null;
      }

      if (isEditorClocklessVisual(clip)) {
        applyVideoMix(active, false);
        active.pause();
        setLayerVisible(active, false);
        if (idle) {
          applyVideoMix(idle, false);
          idle.pause();
          setLayerVisible(idle, false);
        }
        return clip.id;
      }

      if (!clip.url) {
        applyVideoMix(active, false);
        active.pause();
        setLayerVisible(active, false);
        if (idle) {
          applyVideoMix(idle, false);
          idle.pause();
          setLayerVisible(idle, false);
        }
        return null;
      }

      // Same file (including cut siblings): keep the visible frame, just seek.
      if (videoHasUrl(active, clip.url) && active.readyState >= 2) {
        applyClipVideoMix(active, clip);
        const at = clockMs(timeMs, shouldPlay);
        if (!videoMatchesClock(active, clip, at)) {
          await seekVideo(
            active,
            sourceOffsetSec(clip, clockMs(timeMs, shouldPlay)),
          );
        }
        setLayerVisible(active, true, blend, clipHasRemoveBg(clip));
        if (idle) {
          setLayerVisible(idle, false);
          idle.pause();
        }
        if (shouldPlay) {
          try {
            await active.play();
          } catch {
            playingRef.current = false;
            setPlaying(false);
          }
        } else {
          active.pause();
        }
        return clip.id;
      }

      // Different URL with a spare buffer: load on idle, then swap so the old
      // frame stays until the new one has a paint-ready frame.
      if (idle) {
        await prepareSrc(
          idle,
          clip.url,
          clipPlaybackMuted(clip),
          clipVolumeValue(clip),
        );
        applyClipVideoMix(idle, clip);
        await seekVideo(
          idle,
          sourceOffsetSec(clip, clockMs(timeMs, shouldPlay)),
        );
        if (shouldPlay) {
          try {
            await idle.play();
          } catch {
            playingRef.current = false;
            setPlaying(false);
            return baseClipIdRef.current;
          }
        } else {
          idle.pause();
        }
        setLayerVisible(idle, true, blend, clipHasRemoveBg(clip));
        setLayerVisible(active, false);
        active.pause();
        baseActiveIsAltRef.current = idle === layers.baseAlt;
        prefetchUrlRef.current = null;
        return clip.id;
      }

      // Single-buffer fallback (linked non-preview video).
      return applyClipToLayer(active, clip, timeMs, shouldPlay, blend, true);
    },
    [applyClipToLayer, getActiveBase, getIdleBase, prepareSrc],
  );

  const applySameLaneSequence = useCallback(
    async (
      layers: EditorPreviewLayers,
      outgoing: EditorClip,
      incoming: EditorClip,
      overlap: LaneOverlap,
      timeMs: number,
      shouldPlay: boolean,
    ): Promise<string | null> => {
      const leftVideo = layers.base;
      const rightVideo = layers.baseAlt;
      if (!rightVideo) {
        return applyBaseClip(
          layers,
          outgoing,
          timeMs,
          shouldPlay,
          baseBlendAtTime(timeMs, overlap),
        );
      }
      baseActiveIsAltRef.current = false;
      prefetchUrlRef.current = null;
      const leftId = await applyClipToLayer(
        leftVideo,
        outgoing,
        timeMs,
        shouldPlay,
        baseBlendAtTime(timeMs, overlap),
        true,
      );
      if (!playingRef.current && shouldPlay) {
        return leftId;
      }
      await applyClipToLayer(
        rightVideo,
        incoming,
        timeMs,
        shouldPlay,
        stackBlendAtTime(incoming, timeMs, overlap, true),
        false,
      );
      return leftId;
    },
    [applyBaseClip, applyClipToLayer],
  );

  const prefetchNextBase = useCallback(
    (layers: EditorPreviewLayers, timeMs: number) => {
      const idle = getIdleBase(layers);
      if (!idle) {
        return;
      }
      const current = videoClipAtTime(timelineRef.current.sequence, timeMs);
      if (!current) {
        return;
      }
      const endMs = current.startMs + current.durationMs;
      if (endMs - timeMs > PREFETCH_LEAD_MS) {
        return;
      }
      const next = nextSequenceClip(timelineRef.current.sequence, current);
      if (
        !next ||
        isEditorClocklessVisual(next) ||
        isEditorClocklessVisual(current)
      ) {
        return;
      }
      if (next.url === current.url) {
        return;
      }
      if (prefetchUrlRef.current === next.url && videoHasUrl(idle, next.url)) {
        return;
      }
      prefetchUrlRef.current = next.url;
      void prepareSrc(
        idle,
        next.url,
        clipPlaybackMuted(next),
        clipVolumeValue(next),
      ).then(() => {
        if (prefetchUrlRef.current !== next.url) {
          return;
        }
        seekVideo(idle, sourceOffsetSec(next, next.startMs));
      });
    },
    [getIdleBase, prepareSrc],
  );

  const timelineOverlaps = useCallback(
    (timelineNow: EditorTimeline): LaneOverlap[] =>
      collectLaneOverlaps([
        { laneId: SEQUENCE_LANE_ID, clips: timelineNow.sequence },
        ...stackLaneIdsRef.current.map((laneId) => ({
          laneId,
          clips: timelineNow.overlays.filter(
            (clip) => clipLaneId(clip) === laneId,
          ),
        })),
      ]),
    [],
  );

  const applyProgram = useCallback(
    async (
      timeMs: number,
      shouldPlay: boolean,
      mode: ApplyProgramMode = "all",
    ) => {
      const at = () => clockMs(timeMs, shouldPlay);
      await syncSounds(at(), shouldPlay);
      const layers = resolveLayers();
      if (!layers) {
        return;
      }
      const { sequence, overlays } = timelineRef.current;
      const sequenceClip = visualClipAtTime(sequence, at());
      const laneClips = stackLaneIdsRef.current.map((laneId) =>
        overlayVisualOnLaneAtTime(overlays, laneId, at()),
      );
      const firstOverlay = laneClips.find((clip) => clip) ?? null;
      const orphanOverlay =
        !sequenceClip && !firstOverlay && layers.stacks.length === 0
          ? visualClipAtTime(overlays, at())
          : null;
      const baseClip = sequenceClip ?? orphanOverlay;
      const overlaps = timelineOverlaps(timelineRef.current);
      const sameLaneSequence = overlaps.find(
        (item) =>
          isSameLaneOverlap(item) &&
          item.leftLaneId === SEQUENCE_LANE_ID &&
          overlapContainsTime(item, at()),
      );
      const coveringOverlap = sequenceClip
        ? overlaps.find(
            (item) =>
              item.leftClipId === sequenceClip.id &&
              overlapContainsTime(item, at()),
          ) ?? null
        : null;

      if (!baseClip && !firstOverlay && !orphanOverlay) {
        if (mode === "stacks") {
          for (const stack of layers.stacks) {
            stack.pause();
            setLayerVisible(stack, false);
          }
          for (const still of layers.staticStacks ?? []) {
            setStillVisible(still, false);
          }
          stackClipIdsRef.current = layers.stacks.map(() => null);
          return;
        }
        layers.base.pause();
        layers.baseAlt?.pause();
        for (const stack of layers.stacks) {
          stack.pause();
        }
        setLayerVisible(layers.base, false);
        if (layers.baseAlt) {
          setLayerVisible(layers.baseAlt, false);
        }
        for (const stack of layers.stacks) {
          setLayerVisible(stack, false);
        }
        setCompositionOn(layers.composition ?? null, false);
        hideStills(layers);
        htmlClipIdRef.current = null;
        baseClipIdRef.current = null;
        stackClipIdsRef.current = layers.stacks.map(() => null);
        return;
      }

      const htmlBase = htmlClipAtTime(sequence, overlays, laneClips, at());
      const frame = layers.composition ?? null;
      if (htmlBase && frame) {
        if (htmlClipIdRef.current !== htmlBase.id) {
          htmlClipIdRef.current = htmlBase.id;
          frame.onload = () => {
            seekHyperframeFrame(frame, compositionTimeMs(htmlBase, at()));
          };
          frame.srcdoc = htmlBase.html;
        } else {
          seekHyperframeFrame(frame, compositionTimeMs(htmlBase, at()));
        }
        setCompositionOn(frame, true);
      } else if (mode === "all") {
        htmlClipIdRef.current = null;
        setCompositionOn(frame, false);
      }

      if (mode === "all") {
        if (baseClip && isEditorStaticClip(baseClip) && layers.staticBase) {
          applyStillSrc(layers.staticBase, baseClip.url);
          setStillVisible(
            layers.staticBase,
            true,
            baseBlendAtTime(at(), coveringOverlap),
          );
        } else {
          setStillVisible(layers.staticBase, false);
        }

        const outgoing = sameLaneSequence
          ? sequence.find((clip) => clip.id === sameLaneSequence.leftClipId)
          : null;
        const incoming = sameLaneSequence
          ? sequence.find((clip) => clip.id === sameLaneSequence.rightClipId)
          : null;
        let nextBaseId: string | null;
        if (
          sameLaneSequence &&
          outgoing &&
          incoming &&
          !isEditorAudioLikeClip(outgoing) &&
          !isEditorAudioLikeClip(incoming) &&
          !isEditorClocklessVisual(outgoing) &&
          !isEditorClocklessVisual(incoming)
        ) {
          nextBaseId = await applySameLaneSequence(
            layers,
            outgoing,
            incoming,
            sameLaneSequence,
            at(),
            shouldPlay,
          );
        } else {
          nextBaseId = await applyBaseClip(
            layers,
            baseClip,
            at(),
            shouldPlay,
            baseBlendAtTime(at(), coveringOverlap),
          );
        }
        if (!playingRef.current && shouldPlay) {
          return;
        }
        baseClipIdRef.current = nextBaseId;
      }

      const nextStackIds: (string | null)[] = [];
      const liveLaneClips = stackLaneIdsRef.current.map((laneId) =>
        overlayVisualOnLaneAtTime(overlays, laneId, at()),
      );
      const liveFirstOverlay = liveLaneClips.find((clip) => clip) ?? null;
      for (let index = 0; index < layers.stacks.length; index++) {
        const video = layers.stacks[index];
        if (!video) {
          nextStackIds.push(null);
          continue;
        }
        if (!playingRef.current && shouldPlay) {
          return;
        }
        const clip = liveLaneClips[index] ?? null;
        const overlap = clip ? overlapAtTime(overlaps, clip.id, at()) : null;
        const blend = clip
          ? stackBlendAtTime(clip, at(), overlap, Boolean(sequenceClip))
          : null;
        nextStackIds.push(
          await applyClipToLayer(
            video,
            clip,
            at(),
            shouldPlay,
            blend,
            !baseClip && clip !== null && clip === liveFirstOverlay,
          ),
        );
        const still = layers.staticStacks?.[index];
        if (clip && isEditorStaticClip(clip) && still) {
          applyStillSrc(still, clip.url);
          setStillVisible(still, true, blend);
        } else {
          setStillVisible(still, false);
        }
      }
      stackClipIdsRef.current = nextStackIds;

      if (mode === "all" && shouldPlay && sequenceClip && !sameLaneSequence) {
        prefetchNextBase(layers, at());
      }
    },
    [
      applySameLaneSequence,
      applyBaseClip,
      applyClipToLayer,
      prefetchNextBase,
      resolveLayers,
      syncSounds,
      timelineOverlaps,
    ],
  );

  const syncFromMaster = useCallback(() => {
    const layers = resolveLayers();
    const timeMs = timeRef.current;
    const { sequence, overlays } = timelineRef.current;
    const sequenceClip = videoClipAtTime(sequence, timeMs);
    if (layers && sequenceClip && baseClipIdRef.current === sequenceClip.id) {
      return projectMsFromVideo(getActiveBase(layers), sequenceClip);
    }
    const lanes = stackLaneIdsRef.current;
    for (let index = 0; index < lanes.length; index++) {
      const laneId = lanes[index];
      if (!laneId) {
        continue;
      }
      const clip = overlayVideoOnLaneAtTime(overlays, laneId, timeMs);
      const video = layers?.stacks[index];
      if (!clip || !video || stackClipIdsRef.current[index] !== clip.id) {
        continue;
      }
      return projectMsFromVideo(video, clip);
    }
    if (layers && !sequenceClip) {
      const overlay = videoClipAtTime(overlays, timeMs);
      if (overlay && baseClipIdRef.current === overlay.id) {
        return projectMsFromVideo(getActiveBase(layers), overlay);
      }
    }
    return null;
  }, [getActiveBase, resolveLayers]);

  const stopAtEnd = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    stopRaf();
    pauseAll(resolveLayers());
  }, [pauseAll, resolveLayers, stopRaf]);

  const tick = useCallback(() => {
    if (!playingRef.current) {
      return;
    }
    const now = performance.now();
    const rawElapsed = lastTickRef.current ? now - lastTickRef.current : 0;
    const elapsed = Math.min(48, Math.max(0, rawElapsed));
    lastTickRef.current = now;
    const timelineNow = timelineRef.current;
    const masterMs = syncFromMaster();
    const layersNow = resolveLayers();
    const masterVideo = layersNow ? getActiveBase(layersNow) : null;
    const useMaster =
      masterMs != null &&
      masterVideo != null &&
      !masterVideo.paused &&
      !masterVideo.ended;
    const nextMs = Math.min(
      timelineNow.totalMs,
      useMaster ? masterMs : timeRef.current + elapsed,
    );
    const prevMs = timeRef.current;
    timeRef.current = nextMs;
    setCurrentTimeMs(nextMs);
    if (nextMs >= timelineNow.totalMs) {
      stopAtEnd();
      return;
    }
    const prevSeq = clipAtTime(timelineNow.sequence, prevMs)?.id ?? null;
    const nextSeq = clipAtTime(timelineNow.sequence, nextMs)?.id ?? null;
    const prevOverlay = stackLaneIdsRef.current
      .map(
        (laneId) =>
          overlayOnLaneAtTime(timelineNow.overlays, laneId, prevMs)?.id ?? "",
      )
      .join("|");
    const nextOverlay = stackLaneIdsRef.current
      .map(
        (laneId) =>
          overlayOnLaneAtTime(timelineNow.overlays, laneId, nextMs)?.id ?? "",
      )
      .join("|");
    const prevOrphan = clipAtTime(timelineNow.overlays, prevMs)?.id ?? null;
    const nextOrphan = clipAtTime(timelineNow.overlays, nextMs)?.id ?? null;
    const overlapsNow = timelineOverlaps(timelineNow);
    const seqOverlapId = (timeMs: number) =>
      overlapsNow.find(
        (item) =>
          isSameLaneOverlap(item) &&
          item.leftLaneId === SEQUENCE_LANE_ID &&
          overlapContainsTime(item, timeMs),
      )?.id ?? "";
    const layers = resolveLayers();
    const sequenceChanged =
      prevSeq !== nextSeq ||
      prevOrphan !== nextOrphan ||
      seqOverlapId(prevMs) !== seqOverlapId(nextMs);
    const overlayChanged = prevOverlay !== nextOverlay;
    if (sequenceChanged) {
      void applyProgram(nextMs, true, "all");
    } else if (overlayChanged) {
      void applyProgram(nextMs, true, "stacks");
    } else if (layers) {
      const htmlClip = htmlClipAtTime(
        timelineNow.sequence,
        timelineNow.overlays,
        timelineNow.overlays.length
          ? stackLaneIdsRef.current.map((laneId) =>
              overlayVisualOnLaneAtTime(timelineNow.overlays, laneId, nextMs),
            )
          : [],
        nextMs,
      );
      if (htmlClip && layers.composition) {
        seekHyperframeFrame(
          layers.composition,
          compositionTimeMs(htmlClip, nextMs),
        );
      }
      const sequenceClip = videoClipAtTime(timelineNow.sequence, nextMs);
      const overlaps = overlapsNow;
      const sameLaneSequence =
        overlaps.find(
          (item) =>
            isSameLaneOverlap(item) &&
            item.leftLaneId === SEQUENCE_LANE_ID &&
            overlapContainsTime(item, nextMs),
        ) ?? null;
      const coveringOverlap = sequenceClip
        ? overlaps.find(
            (item) =>
              item.leftClipId === sequenceClip.id &&
              overlapContainsTime(item, nextMs),
          ) ?? null
        : null;
      if (sequenceClip && baseClipIdRef.current === sequenceClip.id) {
        const active = getActiveBase(layers);
        applyClipVideoMix(active, sequenceClip);
        const expected = sourceOffsetSec(sequenceClip, nextMs);
        if (Math.abs(active.currentTime - expected) > SEEK_DRIFT_SEC) {
          seekVideo(active, expected);
        }
        setLayerVisible(
          active,
          true,
          baseBlendAtTime(nextMs, coveringOverlap),
          clipHasRemoveBg(sequenceClip),
        );
        if (playingRef.current && active.paused) {
          void active.play().catch(() => {});
        }
        if (sameLaneSequence && layers.baseAlt) {
          const incoming = timelineNow.sequence.find(
            (clip) => clip.id === sameLaneSequence.rightClipId,
          );
          if (incoming) {
            const expectedIn = sourceOffsetSec(incoming, nextMs);
            if (
              Math.abs(layers.baseAlt.currentTime - expectedIn) > SEEK_DRIFT_SEC
            ) {
              seekVideo(layers.baseAlt, expectedIn);
            }
            setLayerVisible(
              layers.baseAlt,
              true,
              stackBlendAtTime(incoming, nextMs, sameLaneSequence, true),
              clipHasRemoveBg(incoming),
            );
            if (playingRef.current && layers.baseAlt.paused) {
              void layers.baseAlt.play().catch(() => {});
            }
          }
        } else if (!sameLaneSequence) {
          prefetchNextBase(layers, nextMs);
        }
      }
      stackLaneIdsRef.current.forEach((laneId, index) => {
        const clip = overlayVideoOnLaneAtTime(
          timelineNow.overlays,
          laneId,
          nextMs,
        );
        const video = layers.stacks[index];
        if (!clip || !video || stackClipIdsRef.current[index] !== clip.id) {
          return;
        }
        applyClipVideoMix(video, clip);
        const expected = sourceOffsetSec(clip, nextMs);
        if (Math.abs(video.currentTime - expected) > SEEK_DRIFT_SEC) {
          seekVideo(video, expected);
        }
        const overlap = overlapAtTime(overlaps, clip.id, nextMs);
        setLayerVisible(
          video,
          true,
          stackBlendAtTime(clip, nextMs, overlap, Boolean(sequenceClip)),
          clipHasRemoveBg(clip),
        );
        if (playingRef.current && video.paused) {
          void video.play().catch(() => {});
        }
      });
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [
    applyProgram,
    getActiveBase,
    prefetchNextBase,
    resolveLayers,
    stopAtEnd,
    syncFromMaster,
    timelineOverlaps,
  ]);

  const seek = useCallback(
    (nextMs: number) => {
      const total = timelineRef.current.totalMs;
      const clamped = Math.max(0, Math.min(total, nextMs));
      timeRef.current = clamped;
      setCurrentTimeMs(clamped);
      void applyProgram(clamped, playingRef.current);
    },
    [applyProgram],
  );

  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    stopRaf();
    pauseAll(resolveLayers());
  }, [pauseAll, resolveLayers, stopRaf]);

  const stop = useCallback(() => {
    pause();
    timeRef.current = 0;
    setCurrentTimeMs(0);
    baseClipIdRef.current = null;
    stackClipIdsRef.current = [];
    prefetchUrlRef.current = null;
    const layers = resolveLayers();
    if (layers) {
      setLayerVisible(layers.base, false);
      if (layers.baseAlt) {
        setLayerVisible(layers.baseAlt, false);
      }
      for (const stack of layers.stacks) {
        setLayerVisible(stack, false);
      }
      hideStills(layers);
    }
  }, [pause, resolveLayers]);

  const play = useCallback(() => {
    if (!editorHasClips(timelineRef.current)) {
      return;
    }
    if (timelineHasVideo(timelineRef.current) && !resolveLayers()) {
      return;
    }
    if (timeRef.current >= timelineRef.current.totalMs) {
      timeRef.current = 0;
      setCurrentTimeMs(0);
      baseClipIdRef.current = null;
      stackClipIdsRef.current = [];
      prefetchUrlRef.current = null;
    }
    playingRef.current = true;
    setPlaying(true);
    void applyProgram(timeRef.current, true).then(() => {
      if (!playingRef.current) {
        return;
      }
      lastTickRef.current = performance.now();
      stopRaf();
      rafRef.current = requestAnimationFrame(tick);
    });
  }, [applyProgram, resolveLayers, stopRaf, tick]);

  const togglePlay = useCallback(() => {
    if (playingRef.current) {
      pause();
      return;
    }
    play();
  }, [pause, play]);

  useEffect(() => {
    const total = timeline.totalMs;
    if (timeRef.current > total) {
      timeRef.current = total;
      setCurrentTimeMs(total);
    }
    if (!editorHasClips(timeline)) {
      pause();
      baseClipIdRef.current = null;
      stackClipIdsRef.current = [];
      return;
    }
    void applyProgram(timeRef.current, playingRef.current);
  }, [applyProgram, pause, timeline]);

  useEffect(() => {
    baseClipIdRef.current = null;
    baseActiveIsAltRef.current = false;
    stackClipIdsRef.current = [];
    prefetchUrlRef.current = null;
    if (!previewElementId) {
      void applyProgram(timeRef.current, playingRef.current);
      return;
    }
    void applyProgram(timeRef.current, playingRef.current);
  }, [applyProgram, previewElementId]);

  useEffect(() => {
    return subscribeEditorPreviewVideos(() => {
      if (!previewIdRef.current) {
        return;
      }
      void applyProgram(timeRef.current, playingRef.current);
    });
  }, [applyProgram]);

  useEffect(() => {
    return () => {
      stopRaf();
      pauseAll(resolveLayers());
    };
  }, [pauseAll, resolveLayers, stopRaf]);

  return {
    currentTimeMs,
    playing,
    play,
    pause,
    stop,
    seek,
    togglePlay,
  };
};
