import { useCallback, useEffect, useRef, useState } from "react";

import { clipAtTime, type EditorTimeline } from "./buildEditorTimeline";
import {
  findEditorTargetVideo,
  getEditorPreviewAudio,
  subscribeEditorPreviewVideos,
} from "./editorPreviewModel";

type UseEditorPlaybackOpts = {
  timeline: EditorTimeline;
  /** Linked canvas element that hosts the video. */
  previewElementId: string | null;
  ownerDocument: Document;
};

export const useEditorPlayback = ({
  timeline,
  previewElementId,
  ownerDocument,
}: UseEditorPlaybackOpts) => {
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const clipIdRef = useRef<string | null>(null);
  const rafRef = useRef(0);
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;
  const previewIdRef = useRef(previewElementId);
  previewIdRef.current = previewElementId;
  const docRef = useRef(ownerDocument);
  docRef.current = ownerDocument;

  const resolveVideo = useCallback((): HTMLVideoElement | null => {
    const id = previewIdRef.current;
    if (!id) {
      return null;
    }
    return findEditorTargetVideo(id, docRef.current);
  }, []);

  const stopRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const applyClipToVideo = useCallback(
    async (timeMs: number, shouldPlay: boolean) => {
      const video = resolveVideo();
      const clip = clipAtTime(timelineRef.current.sequence, timeMs);
      if (!video || !clip) {
        if (shouldPlay && !clip) {
          playingRef.current = false;
          setPlaying(false);
        }
        return;
      }
      const sourceOffsetMs = clip.sourceOffsetMs ?? 0;
      const offsetSec = Math.max(
        0,
        (sourceOffsetMs + (timeMs - clip.startMs)) / 1000,
      );
      const needsSrc =
        clipIdRef.current !== clip.id || video.getAttribute("src") !== clip.url;
      clipIdRef.current = clip.id;
      const audio = getEditorPreviewAudio();
      video.volume = audio.volume;
      video.muted = audio.muted;
      if (needsSrc) {
        video.src = clip.url;
        video.load();
        await new Promise<void>((resolve) => {
          const onReady = () => {
            video.removeEventListener("loadeddata", onReady);
            resolve();
          };
          if (video.readyState >= 2) {
            resolve();
            return;
          }
          video.addEventListener("loadeddata", onReady);
        });
        video.volume = audio.volume;
        video.muted = audio.muted;
      }
      try {
        video.currentTime = Math.min(
          offsetSec,
          Number.isFinite(video.duration) ? video.duration : offsetSec,
        );
      } catch {
        // Seeking before metadata is ready — ignore.
      }
      if (shouldPlay) {
        try {
          await video.play();
        } catch {
          playingRef.current = false;
          setPlaying(false);
        }
      } else {
        video.pause();
      }
    },
    [resolveVideo],
  );

  const syncFromVideo = useCallback(() => {
    const video = resolveVideo();
    const clip = clipAtTime(timelineRef.current.sequence, timeRef.current);
    if (!video || !clip || clipIdRef.current !== clip.id) {
      return;
    }
    const sourceOffsetMs = clip.sourceOffsetMs ?? 0;
    const withinMs = Math.max(0, video.currentTime * 1000 - sourceOffsetMs);
    const projectMs = Math.min(
      clip.startMs + clip.durationMs,
      clip.startMs + withinMs,
    );
    timeRef.current = projectMs;
    setCurrentTimeMs(projectMs);

    if (projectMs >= clip.startMs + clip.durationMs - 16) {
      const next = timelineRef.current.sequence.find(
        (item) => item.startMs >= clip.startMs + clip.durationMs,
      );
      if (next && playingRef.current) {
        timeRef.current = next.startMs;
        setCurrentTimeMs(next.startMs);
        void applyClipToVideo(next.startMs, true);
        return;
      }
      if (playingRef.current) {
        playingRef.current = false;
        setPlaying(false);
        video.pause();
        stopRaf();
      }
    }
  }, [applyClipToVideo, resolveVideo, stopRaf]);

  const tick = useCallback(() => {
    if (!playingRef.current) {
      return;
    }
    syncFromVideo();
    rafRef.current = requestAnimationFrame(tick);
  }, [syncFromVideo]);

  const seek = useCallback(
    (nextMs: number) => {
      const total = timelineRef.current.totalMs;
      const clamped = Math.max(0, Math.min(total, nextMs));
      timeRef.current = clamped;
      setCurrentTimeMs(clamped);
      void applyClipToVideo(clamped, playingRef.current);
    },
    [applyClipToVideo],
  );

  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    stopRaf();
    resolveVideo()?.pause();
  }, [resolveVideo, stopRaf]);

  const stop = useCallback(() => {
    pause();
    timeRef.current = 0;
    setCurrentTimeMs(0);
    clipIdRef.current = null;
    const video = resolveVideo();
    if (video) {
      video.pause();
      // Keep src on dedicated preview; clear only if we own the element via registry.
    }
  }, [pause, resolveVideo]);

  const play = useCallback(() => {
    if (timelineRef.current.sequence.length === 0 || !previewIdRef.current) {
      return;
    }
    if (timeRef.current >= timelineRef.current.totalMs) {
      timeRef.current = 0;
      setCurrentTimeMs(0);
      clipIdRef.current = null;
    }
    playingRef.current = true;
    setPlaying(true);
    void applyClipToVideo(timeRef.current, true).then(() => {
      stopRaf();
      rafRef.current = requestAnimationFrame(tick);
    });
  }, [applyClipToVideo, stopRaf, tick]);

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
    if (timeline.sequence.length === 0) {
      pause();
      clipIdRef.current = null;
    }
  }, [pause, timeline.sequence.length, timeline.totalMs]);

  useEffect(() => {
    clipIdRef.current = null;
    if (!previewElementId) {
      pause();
      return;
    }
    void applyClipToVideo(timeRef.current, playingRef.current);
  }, [applyClipToVideo, pause, previewElementId]);

  useEffect(() => {
    return subscribeEditorPreviewVideos(() => {
      if (!previewIdRef.current) {
        return;
      }
      void applyClipToVideo(timeRef.current, playingRef.current);
    });
  }, [applyClipToVideo]);

  useEffect(() => {
    return () => {
      stopRaf();
      resolveVideo()?.pause();
    };
  }, [resolveVideo, stopRaf]);

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
