import { useCallback, useEffect, useRef, useState } from "react";

import {
  clipAtTime,
  collectLaneOverlaps,
  editorHasClips,
  overlayOnLaneAtTime,
  overlapAtTime,
  stackBlendAtTime,
  baseBlendAtTime,
  clipLaneId,
  SEQUENCE_LANE_ID,
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
    return;
  }
  video.style.setProperty("--jayrr-layer-opacity", String(blend.opacity));
  if (blend.clipPath) {
    video.style.clipPath = blend.clipPath;
  } else {
    video.style.removeProperty("clip-path");
  }
};

const setLayerVisible = (
  video: HTMLVideoElement,
  on: boolean,
  blend?: LayerBlend | null,
) => {
  video.classList.toggle(LAYER_ON, on);
  applyBlend(video, on ? (blend ?? { opacity: 1, clipPath: null }) : null);
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
    if (clip.id === current.id) {
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
  }, []);

  const prepareSrc = useCallback(
    async (video: HTMLVideoElement, url: string) => {
      const audio = getEditorPreviewAudio();
      video.volume = audio.volume;
      video.muted = audio.muted;
      if (videoHasUrl(video, url) && video.readyState >= 2) {
        return;
      }
      if (!videoHasUrl(video, url)) {
        video.src = url;
        video.load();
      }
      await waitForData(video);
      video.volume = audio.volume;
      video.muted = audio.muted;
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
      if (!clip) {
        video.pause();
        setLayerVisible(video, false);
        return null;
      }
      await prepareSrc(video, clip.url);
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
        active.pause();
        setLayerVisible(active, false);
        if (idle) {
          idle.pause();
          setLayerVisible(idle, false);
        }
        return null;
      }

      // Same file (including cut siblings): keep the visible frame, just seek.
      if (videoHasUrl(active, clip.url) && active.readyState >= 2) {
        const audio = getEditorPreviewAudio();
        active.volume = audio.volume;
        active.muted = audio.muted;
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
        await prepareSrc(idle, clip.url);
        await seekVideo(idle, sourceOffsetSec(clip, timeMs));
        const audio = getEditorPreviewAudio();
        idle.volume = audio.volume;
        idle.muted = audio.muted;
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

  const prefetchNextBase = useCallback(
    (layers: EditorPreviewLayers, timeMs: number) => {
      const idle = getIdleBase(layers);
      if (!idle) {
        return;
      }
      const current = clipAtTime(timelineRef.current.sequence, timeMs);
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
      void prepareSrc(idle, next.url).then(() => {
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
      const layers = resolveLayers();
      if (!layers) {
        return;
      }
      const { sequence, overlays } = timelineRef.current;
      const sequenceClip = clipAtTime(sequence, timeMs);
      const laneClips = stackLaneIdsRef.current.map((laneId) =>
        overlayOnLaneAtTime(overlays, laneId, timeMs),
      );
      const firstOverlay = laneClips.find((clip) => clip) ?? null;
      const orphanOverlay =
        !sequenceClip && !firstOverlay && layers.stacks.length === 0
          ? clipAtTime(overlays, timeMs)
          : null;
      const baseClip = sequenceClip ?? orphanOverlay;
      const overlaps = timelineOverlaps(timelineRef.current);
      const coveringOverlap = sequenceClip
        ? overlaps.find(
            (item) =>
              item.leftClipId === sequenceClip.id &&
              timeMs >= item.startMs &&
              timeMs < item.endMs,
          ) ?? null
        : null;

      if (!baseClip && !firstOverlay && !orphanOverlay) {
        pauseAll(layers);
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

      const nextBaseId = await applyBaseClip(
        layers,
        baseClip,
        timeMs,
        shouldPlay,
        baseBlendAtTime(timeMs, coveringOverlap),
      );
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

      if (shouldPlay && sequenceClip) {
        prefetchNextBase(layers, timeMs);
      }
    },
    [
      applyBaseClip,
      applyClipToLayer,
      pauseAll,
      prefetchNextBase,
      resolveLayers,
      timelineOverlaps,
    ],
  );

  const syncFromMaster = useCallback(() => {
    const layers = resolveLayers();
    const timeMs = timeRef.current;
    const { sequence, overlays } = timelineRef.current;
    const sequenceClip = clipAtTime(sequence, timeMs);
    if (layers && sequenceClip && baseClipIdRef.current === sequenceClip.id) {
      return projectMsFromVideo(getActiveBase(layers), sequenceClip);
    }
    const lanes = stackLaneIdsRef.current;
    for (let index = 0; index < lanes.length; index++) {
      const laneId = lanes[index];
      if (!laneId) {
        continue;
      }
      const clip = overlayOnLaneAtTime(overlays, laneId, timeMs);
      const video = layers?.stacks[index];
      if (!clip || !video || stackClipIdsRef.current[index] !== clip.id) {
        continue;
      }
      return projectMsFromVideo(video, clip);
    }
    if (layers && !sequenceClip) {
      const overlay = clipAtTime(overlays, timeMs);
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
    const layers = resolveLayers();
    if (
      prevSeq !== nextSeq ||
      prevOverlay !== nextOverlay ||
      prevOrphan !== nextOrphan
    ) {
      void applyProgram(nextMs, true);
    } else if (layers) {
      const sequenceClip = clipAtTime(timelineNow.sequence, nextMs);
      const overlaps = timelineOverlaps(timelineNow);
      const coveringOverlap = sequenceClip
        ? overlaps.find(
            (item) =>
              item.leftClipId === sequenceClip.id &&
              nextMs >= item.startMs &&
              nextMs < item.endMs,
          ) ?? null
        : null;
      if (sequenceClip && baseClipIdRef.current === sequenceClip.id) {
        const active = getActiveBase(layers);
        const expected = sourceOffsetSec(sequenceClip, nextMs);
        if (Math.abs(active.currentTime - expected) > 0.12) {
          seekVideo(active, expected);
        }
        setLayerVisible(
          active,
          true,
          baseBlendAtTime(nextMs, coveringOverlap),
        );
        prefetchNextBase(layers, nextMs);
      }
      stackLaneIdsRef.current.forEach((laneId, index) => {
        const clip = overlayOnLaneAtTime(timelineNow.overlays, laneId, nextMs);
        const video = layers.stacks[index];
        if (!clip || !video || stackClipIdsRef.current[index] !== clip.id) {
          return;
        }
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
    }
  }, [pause, resolveLayers]);

  const play = useCallback(() => {
    if (!editorHasClips(timelineRef.current) || !previewIdRef.current) {
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
      pause();
      return;
    }
    void applyProgram(timeRef.current, playingRef.current);
  }, [applyProgram, pause, previewElementId]);

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
