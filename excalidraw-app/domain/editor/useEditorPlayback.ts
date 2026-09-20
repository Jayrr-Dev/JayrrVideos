import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { clipAtTime, type EditorTimeline } from "./buildEditorTimeline";

type UseEditorPlaybackOpts = {
  timeline: EditorTimeline;
  videoRef: RefObject<HTMLVideoElement | null>;
};

export const useEditorPlayback = ({
  timeline,
  videoRef,
}: UseEditorPlaybackOpts) => {
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const clipIdRef = useRef<string | null>(null);
  const rafRef = useRef(0);
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;

  const stopRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const applyClipToVideo = useCallback(
    async (timeMs: number, shouldPlay: boolean) => {
      const video = videoRef.current;
      const clip = clipAtTime(timelineRef.current.sequence, timeMs);
      if (!video || !clip) {
        return;
      }
      const offsetSec = Math.max(0, (timeMs - clip.startMs) / 1000);
      const switched = clipIdRef.current !== clip.id;
      if (switched) {
        clipIdRef.current = clip.id;
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
    [videoRef],
  );

  const syncFromVideo = useCallback(() => {
    const video = videoRef.current;
    const clip = clipAtTime(timelineRef.current.sequence, timeRef.current);
    if (!video || !clip || clipIdRef.current !== clip.id) {
      return;
    }
    const withinMs = Math.max(0, video.currentTime * 1000);
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
  }, [applyClipToVideo, stopRaf, videoRef]);

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
    videoRef.current?.pause();
  }, [stopRaf, videoRef]);

  const stop = useCallback(() => {
    pause();
    timeRef.current = 0;
    setCurrentTimeMs(0);
    clipIdRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
  }, [pause, videoRef]);

  const play = useCallback(() => {
    if (timelineRef.current.sequence.length === 0) {
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
    const video = videoRef.current;
    return () => {
      stopRaf();
      video?.pause();
    };
  }, [stopRaf, videoRef]);

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
