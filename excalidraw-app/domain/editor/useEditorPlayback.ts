import { useCallback, useEffect, useRef, useState } from "react";

import {
  clipAtTime,
  editorHasClips,
  overlayOnLaneAtTime,
  type EditorClip,
  type EditorTimeline,
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
const LAYER_SOLO = "is-solo";

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

const seekVideo = (video: HTMLVideoElement, offsetSec: number) => {
  try {
    video.currentTime = Math.min(
      offsetSec,
      Number.isFinite(video.duration) ? video.duration : offsetSec,
    );
  } catch {
    // Seeking before metadata is ready — ignore.
  }
};

const projectMsFromVideo = (video: HTMLVideoElement, clip: EditorClip) => {
  const sourceOffsetMs = clip.sourceOffsetMs ?? 0;
  const withinMs = Math.max(0, video.currentTime * 1000 - sourceOffsetMs);
  return Math.min(clip.startMs + clip.durationMs, clip.startMs + withinMs);
};

const setLayerVisible = (
  video: HTMLVideoElement,
  on: boolean,
  solo: boolean,
) => {
  video.classList.toggle(LAYER_ON, on);
  video.classList.toggle(LAYER_SOLO, on && solo);
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
  const stackClipIdsRef = useRef<(string | null)[]>([]);
  const lastTickRef = useRef(0);
  const rafRef = useRef(0);
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

  const stopRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const pauseAll = useCallback((layers: EditorPreviewLayers | null) => {
    layers?.base.pause();
    for (const stack of layers?.stacks ?? []) {
      stack.pause();
    }
  }, []);

  const applyClipToLayer = useCallback(
    async (
      video: HTMLVideoElement,
      clip: EditorClip | null,
      timeMs: number,
      shouldPlay: boolean,
      prevClipId: string | null,
      solo: boolean,
      isClockMaster: boolean,
    ): Promise<string | null> => {
      if (!clip) {
        video.pause();
        setLayerVisible(video, false, false);
        return null;
      }
      const audio = getEditorPreviewAudio();
      video.volume = audio.volume;
      video.muted = audio.muted;
      const needsSrc =
        prevClipId !== clip.id || video.getAttribute("src") !== clip.url;
      if (needsSrc) {
        video.src = clip.url;
        video.load();
        await waitForData(video);
        video.volume = audio.volume;
        video.muted = audio.muted;
      }
      seekVideo(video, sourceOffsetSec(clip, timeMs));
      setLayerVisible(video, true, solo);
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
      const overlaySolo = !sequenceClip;

      if (!baseClip && !firstOverlay && !orphanOverlay) {
        pauseAll(layers);
        setLayerVisible(layers.base, false, false);
        for (const stack of layers.stacks) {
          setLayerVisible(stack, false, false);
        }
        baseClipIdRef.current = null;
        stackClipIdsRef.current = layers.stacks.map(() => null);
        return;
      }

      const nextBaseId = await applyClipToLayer(
        layers.base,
        baseClip,
        timeMs,
        shouldPlay,
        baseClipIdRef.current,
        Boolean(baseClip) && !sequenceClip,
        Boolean(baseClip),
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
        nextStackIds.push(
          await applyClipToLayer(
            video,
            clip,
            timeMs,
            shouldPlay,
            stackClipIdsRef.current[index] ?? null,
            overlaySolo,
            !baseClip && clip !== null && clip === firstOverlay,
          ),
        );
      }
      stackClipIdsRef.current = nextStackIds;
    },
    [applyClipToLayer, pauseAll, resolveLayers],
  );

  const syncFromMaster = useCallback(() => {
    const layers = resolveLayers();
    const timeMs = timeRef.current;
    const { sequence, overlays } = timelineRef.current;
    const sequenceClip = clipAtTime(sequence, timeMs);
    if (layers && sequenceClip && baseClipIdRef.current === sequenceClip.id) {
      return projectMsFromVideo(layers.base, sequenceClip);
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
        return projectMsFromVideo(layers.base, overlay);
      }
    }
    return null;
  }, [resolveLayers]);

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
    if (
      prevSeq !== nextSeq ||
      prevOverlay !== nextOverlay ||
      prevOrphan !== nextOrphan
    ) {
      void applyProgram(nextMs, true);
    } else {
      const layers = resolveLayers();
      if (layers) {
        const sequenceClip = clipAtTime(timelineNow.sequence, nextMs);
        if (sequenceClip && baseClipIdRef.current === sequenceClip.id) {
          const expected = sourceOffsetSec(sequenceClip, nextMs);
          if (Math.abs(layers.base.currentTime - expected) > 0.12) {
            seekVideo(layers.base, expected);
          }
        }
        stackLaneIdsRef.current.forEach((laneId, index) => {
          const clip = overlayOnLaneAtTime(
            timelineNow.overlays,
            laneId,
            nextMs,
          );
          const video = layers.stacks[index];
          if (!clip || !video || stackClipIdsRef.current[index] !== clip.id) {
            return;
          }
          const expected = sourceOffsetSec(clip, nextMs);
          if (Math.abs(video.currentTime - expected) > 0.12) {
            seekVideo(video, expected);
          }
        });
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [applyProgram, resolveLayers, stopAtEnd, syncFromMaster]);

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
    const layers = resolveLayers();
    if (layers) {
      setLayerVisible(layers.base, false, false);
      for (const stack of layers.stacks) {
        setLayerVisible(stack, false, false);
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
    stackClipIdsRef.current = [];
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
