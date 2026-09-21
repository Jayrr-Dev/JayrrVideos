import { useCallback, useEffect, useRef, useState } from "react";

import { jayrrSoundPlayUrls } from "../../sounds/jayrrSoundPlayback";

import {
  baseBlendAtTime,
  clipAtTime,
  clipLaneId,
  collectLaneOverlaps,
  editorHasClips,
  isEditorAudioLikeClip,
  isEditorSoundClip,
  isEditorVideoClip,
  isSameLaneOverlap,
  overlapAtTime,
  overlapContainsTime,
  overlayOnLaneAtTime,
  SEQUENCE_LANE_ID,
  stackBlendAtTime,
  videoClipAtTime,
  type EditorClip,
  type EditorTimeline,
  type LaneOverlap,
  type LayerBlend,
} from "./buildEditorTimeline";
import {
  findEditorPreviewLayers,
  getEditorPreviewAudio,
  subscribeEditorPreviewVideos,
  type EditorPreviewLayers,
} from "./editorPreviewModel";

type UseEditorPlaybackOpts = {
  timeline: EditorTimeline;
  stackLaneIds: readonly string[];
  /** Linked canvas element that hosts the video. */
  previewElementId: string | null;
  ownerDocument: Document;
};

const LAYER_ON = "is-on";

const applyBlend = (video: HTMLVideoElement, blend: LayerBlend | null) => {
  if (!blend) {
    video.style.removeProperty("--jayrr-layer-opacity");
    video.style.removeProperty("clip-path");
    video.style.removeProperty("mix-blend-mode");
    return;
  }
  video.style.setProperty("--jayrr-layer-opacity", String(blend.opacity));
  if (blend.clipPath) {
    video.style.clipPath = blend.clipPath;
  } else {
    video.style.removeProperty("clip-path");
  }
  if (blend.mixBlendMode) {
    video.style.mixBlendMode = blend.mixBlendMode;
  } else {
    video.style.removeProperty("mix-blend-mode");
  }
};

const setLayerVisible = (
  video: HTMLVideoElement,
  on: boolean,
  blend?: LayerBlend | null,
) => {
  video.classList.toggle(LAYER_ON, on);
  applyBlend(
    video,
    on ? blend ?? { opacity: 1, clipPath: null, mixBlendMode: null } : null,
  );
};
/** Start warming the next cut this far before the boundary. */
const PREFETCH_LEAD_MS = 900;

const waitForData = (video: HTMLVideoElement) =>
  new Promise<void>((resolve) => {
    if (video.readyState >= 2) {
      resolve();
      return;
    }
    const onReady = () => {
      video.removeEventListener("loadeddata", onReady);
      resolve();
    };
    video.addEventListener("loadeddata", onReady);
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
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    try {
      video.currentTime = target;
    } catch {
      video.removeEventListener("seeked", onSeeked);
      resolve();
      return;
    }
    // Some browsers skip seeked when already near the target.
    if (!video.seeking) {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    }
  });
};

const projectMsFromVideo = (video: HTMLVideoElement, clip: EditorClip) => {
  const sourceOffsetMs = clip.sourceOffsetMs ?? 0;
  const withinMs = Math.max(0, video.currentTime * 1000 - sourceOffsetMs);
  return Math.min(clip.startMs + clip.durationMs, clip.startMs + withinMs);
};

const videoHasUrl = (video: HTMLVideoElement, url: string) =>
  video.getAttribute("src") === url || video.currentSrc === url;

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

const clipIsMuted = (clip: EditorClip) =>
  isEditorVideoClip(clip) && clip.muted === true;

const applyVideoMix = (video: HTMLVideoElement, clipMuted: boolean) => {
  const mix = getEditorPreviewAudio();
  if (clipMuted) {
    video.dataset.jayrrClipMuted = "1";
  } else {
    delete video.dataset.jayrrClipMuted;
  }
  video.volume = mix.volume;
  video.muted = mix.muted || clipMuted;
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

  const resolveLayers = useCallback((): EditorPreviewLayers | null => {
    const id = previewIdRef.current;
    if (!id) {
      return null;
    }
    return findEditorPreviewLayers(id, docRef.current);
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
    async (video: HTMLVideoElement, url: string, clipMuted = false) => {
      applyVideoMix(video, clipMuted);
      if (videoHasUrl(video, url) && video.readyState >= 2) {
        return;
      }
      if (!videoHasUrl(video, url)) {
        video.src = url;
        video.load();
      }
      await waitForData(video);
      applyVideoMix(video, clipMuted);
    },
    [],
  );

  const syncSounds = useCallback(
    async (timeMs: number, shouldPlay: boolean) => {
      const active = coveringSounds(timelineRef.current, timeMs);
      const activeIds = new Set(active.map((clip) => clip.id));
      const mix = getEditorPreviewAudio();
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
        }
        audio.volume = mix.volume;
        audio.muted = mix.muted;
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
      await prepareSrc(video, clip.url, clipIsMuted(clip));
      applyVideoMix(video, clipIsMuted(clip));
      await seekVideo(video, sourceOffsetSec(clip, timeMs));
      setLayerVisible(video, true, blend);
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

      // Same file (including cut siblings): keep the visible frame, just seek.
      if (videoHasUrl(active, clip.url) && active.readyState >= 2) {
        applyVideoMix(active, clipIsMuted(clip));
        await seekVideo(active, sourceOffsetSec(clip, timeMs));
        setLayerVisible(active, true, blend);
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
        await prepareSrc(idle, clip.url, clipIsMuted(clip));
        applyVideoMix(idle, clipIsMuted(clip));
        await seekVideo(idle, sourceOffsetSec(clip, timeMs));
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
        setLayerVisible(idle, true, blend);
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
      if (!next || next.url === current.url) {
        return;
      }
      if (prefetchUrlRef.current === next.url && videoHasUrl(idle, next.url)) {
        return;
      }
      prefetchUrlRef.current = next.url;
      void prepareSrc(idle, next.url, clipIsMuted(next)).then(() => {
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
    async (timeMs: number, shouldPlay: boolean) => {
      await syncSounds(timeMs, shouldPlay);
      const layers = resolveLayers();
      if (!layers) {
        return;
      }
      const { sequence, overlays } = timelineRef.current;
      const sequenceClip = videoClipAtTime(sequence, timeMs);
      const laneClips = stackLaneIdsRef.current.map((laneId) =>
        overlayVideoOnLaneAtTime(overlays, laneId, timeMs),
      );
      const firstOverlay = laneClips.find((clip) => clip) ?? null;
      const orphanOverlay =
        !sequenceClip && !firstOverlay && layers.stacks.length === 0
          ? videoClipAtTime(overlays, timeMs)
          : null;
      const baseClip = sequenceClip ?? orphanOverlay;
      const overlaps = timelineOverlaps(timelineRef.current);
      const sameLaneSequence = overlaps.find(
        (item) =>
          isSameLaneOverlap(item) &&
          item.leftLaneId === SEQUENCE_LANE_ID &&
          overlapContainsTime(item, timeMs),
      );
      const coveringOverlap = sequenceClip
        ? overlaps.find(
            (item) =>
              item.leftClipId === sequenceClip.id &&
              overlapContainsTime(item, timeMs),
          ) ?? null
        : null;

      if (!baseClip && !firstOverlay && !orphanOverlay) {
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
        baseClipIdRef.current = null;
        stackClipIdsRef.current = layers.stacks.map(() => null);
        return;
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
        !isEditorAudioLikeClip(incoming)
      ) {
        nextBaseId = await applySameLaneSequence(
          layers,
          outgoing,
          incoming,
          sameLaneSequence,
          timeMs,
          shouldPlay,
        );
      } else {
        nextBaseId = await applyBaseClip(
          layers,
          baseClip,
          timeMs,
          shouldPlay,
          baseBlendAtTime(timeMs, coveringOverlap),
        );
      }
      if (!playingRef.current && shouldPlay) {
        return;
      }
      baseClipIdRef.current = nextBaseId;

      const nextStackIds: (string | null)[] = [];
      for (let index = 0; index < layers.stacks.length; index++) {
        const video = layers.stacks[index];
        if (!video) {
          nextStackIds.push(null);
          continue;
        }
        if (!playingRef.current && shouldPlay) {
          return;
        }
        const clip = laneClips[index] ?? null;
        const overlap = clip ? overlapAtTime(overlaps, clip.id, timeMs) : null;
        nextStackIds.push(
          await applyClipToLayer(
            video,
            clip,
            timeMs,
            shouldPlay,
            clip
              ? stackBlendAtTime(clip, timeMs, overlap, Boolean(sequenceClip))
              : null,
            !baseClip && clip !== null && clip === firstOverlay,
          ),
        );
      }
      stackClipIdsRef.current = nextStackIds;

      if (shouldPlay && sequenceClip && !sameLaneSequence) {
        prefetchNextBase(layers, timeMs);
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
    const elapsed = lastTickRef.current ? now - lastTickRef.current : 0;
    lastTickRef.current = now;
    const timelineNow = timelineRef.current;
    const masterMs = syncFromMaster();
    const nextMs = Math.min(
      timelineNow.totalMs,
      masterMs ?? timeRef.current + elapsed,
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
    if (
      prevSeq !== nextSeq ||
      prevOverlay !== nextOverlay ||
      prevOrphan !== nextOrphan ||
      seqOverlapId(prevMs) !== seqOverlapId(nextMs)
    ) {
      void applyProgram(nextMs, true);
    } else if (layers) {
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
        const active = layers.base;
        applyVideoMix(active, clipIsMuted(sequenceClip));
        const expected = sourceOffsetSec(sequenceClip, nextMs);
        if (Math.abs(active.currentTime - expected) > 0.12) {
          seekVideo(active, expected);
        }
        setLayerVisible(active, true, baseBlendAtTime(nextMs, coveringOverlap));
        if (sameLaneSequence && layers.baseAlt) {
          const incoming = timelineNow.sequence.find(
            (clip) => clip.id === sameLaneSequence.rightClipId,
          );
          if (incoming) {
            const expectedIn = sourceOffsetSec(incoming, nextMs);
            if (Math.abs(layers.baseAlt.currentTime - expectedIn) > 0.12) {
              seekVideo(layers.baseAlt, expectedIn);
            }
            setLayerVisible(
              layers.baseAlt,
              true,
              stackBlendAtTime(incoming, nextMs, sameLaneSequence, true),
            );
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
        applyVideoMix(video, clipIsMuted(clip));
        const expected = sourceOffsetSec(clip, nextMs);
        if (Math.abs(video.currentTime - expected) > 0.12) {
          seekVideo(video, expected);
        }
        const overlap = overlapAtTime(overlaps, clip.id, nextMs);
        setLayerVisible(
          video,
          true,
          stackBlendAtTime(clip, nextMs, overlap, Boolean(sequenceClip)),
        );
      });
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [
    applyProgram,
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
    }
  }, [pause, resolveLayers]);

  const play = useCallback(() => {
    if (!editorHasClips(timelineRef.current)) {
      return;
    }
    if (timelineHasVideo(timelineRef.current) && !previewIdRef.current) {
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
    lastTickRef.current = performance.now();
    void applyProgram(timeRef.current, true).then(() => {
      if (!playingRef.current) {
        return;
      }
      stopRaf();
      rafRef.current = requestAnimationFrame(tick);
    });
  }, [applyProgram, stopRaf, tick]);

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
