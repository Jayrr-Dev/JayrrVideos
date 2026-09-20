import { playerPlayIcon } from "@excalidraw/excalidraw/components/icons";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { finiteMediaSeconds, formatMediaClock } from "../formatRecording";

import "./VideoPlayer.scss";

type VideoPlayerProps = {
  src: string;
  poster?: string | null;
  autoPlay?: boolean;
  label?: string;
  /** Known duration when the media element reports Infinity/NaN (e.g. webm). */
  durationHintMs?: number;
};

const PauseGlyph = (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <rect x="5" y="4" width="5" height="16" rx="1.2" />
    <rect x="14" y="4" width="5" height="16" rx="1.2" />
  </svg>
);

const VolumeGlyph = (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 10v4h3l4 4V6L7 10H4z" fill="currentColor" stroke="none" />
    <path d="M15.5 8.5a4.5 4.5 0 0 1 0 7" />
    <path d="M18 6a8 8 0 0 1 0 12" />
  </svg>
);

const MuteGlyph = (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 10v4h3l4 4V6L7 10H4z" fill="currentColor" stroke="none" />
    <path d="M18 9l-5 5M13 9l5 5" />
  </svg>
);

const FullscreenGlyph = (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
  </svg>
);

const ExitFullscreenGlyph = (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 4v4H5M15 4v4h4M9 20v-4H5M15 20v-4h4" />
  </svg>
);

const ControlButton = ({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) => {
  return (
    <button
      type="button"
      className="jayrr-video-player__btn"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
};

export const VideoPlayer = ({
  src,
  poster,
  autoPlay = true,
  label = "Video",
  durationHintMs,
}: VideoPlayerProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<number | null>(null);

  const hintSeconds = finiteMediaSeconds(
    durationHintMs != null ? durationHintMs / 1000 : null,
  );

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(hintSeconds);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);

  const resolveDuration = (value: number) => {
    const next = finiteMediaSeconds(value);
    return next > 0 ? next : hintSeconds;
  };

  const clearHideTimer = () => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const scheduleHideControls = () => {
    clearHideTimer();
    if (!playing || scrubbing) {
      return;
    }
    hideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 2200);
  };

  const revealControls = () => {
    setControlsVisible(true);
    scheduleHideControls();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.volume = volume;
    video.muted = muted;
  }, [muted, volume]);

  useEffect(() => {
    setDuration(hintSeconds);
    setCurrentTime(0);
    setPlaying(false);
  }, [src, hintSeconds]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !autoPlay) {
      return;
    }
    void video.play().catch(() => {
      setPlaying(false);
    });
  }, [autoPlay, src]);

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      const root = rootRef.current;
      const active = !!root && root.ownerDocument.fullscreenElement === root;
      setIsFullscreen(active);
    };
    const doc = rootRef.current?.ownerDocument ?? document;
    doc.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      doc.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearHideTimer();
    };
  }, []);

  useEffect(() => {
    clearHideTimer();
    if (!playing || scrubbing) {
      setControlsVisible(true);
      return;
    }
    hideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 2200);
  }, [playing, scrubbing]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.paused) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
    revealControls();
  };

  const seekToRatio = (ratio: number) => {
    const video = videoRef.current;
    const max = duration > 0 ? duration : resolveDuration(video?.duration ?? 0);
    if (!video || max <= 0) {
      return;
    }
    const next = Math.min(1, Math.max(0, ratio)) * max;
    video.currentTime = next;
    setCurrentTime(next);
  };

  const toggleMute = () => {
    setMuted((value) => !value);
    revealControls();
  };

  const toggleFullscreen = async () => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const doc = root.ownerDocument;
    try {
      if (doc.fullscreenElement === root) {
        await doc.exitFullscreen();
      } else {
        await root.requestFullscreen();
      }
    } catch {
      // Fullscreen can be blocked by the browser; ignore.
    }
    revealControls();
  };

  const progress =
    duration > 0
      ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
      : 0;

  return (
    <div
      ref={rootRef}
      className={`jayrr-video-player${
        controlsVisible ? " jayrr-video-player--controls" : ""
      }${playing ? " jayrr-video-player--playing" : ""}`}
      tabIndex={0}
      onMouseMove={revealControls}
      onMouseLeave={() => {
        if (playing && !scrubbing) {
          setControlsVisible(false);
        }
      }}
      onKeyDown={(event) => {
        const key = event.key.toLowerCase();
        if (key === " " || key === "k") {
          event.preventDefault();
          togglePlay();
        } else if (key === "m") {
          event.preventDefault();
          toggleMute();
        } else if (key === "f") {
          event.preventDefault();
          void toggleFullscreen();
        } else if (key === "arrowleft") {
          event.preventDefault();
          const video = videoRef.current;
          if (video) {
            video.currentTime = Math.max(0, video.currentTime - 5);
          }
        } else if (key === "arrowright") {
          event.preventDefault();
          const video = videoRef.current;
          if (video) {
            const max = duration > 0 ? duration : video.currentTime + 5;
            video.currentTime = Math.min(max, video.currentTime + 5);
          }
        } else if (key === "arrowup") {
          event.preventDefault();
          setVolume((value) => Math.min(1, value + 0.05));
          setMuted(false);
        } else if (key === "arrowdown") {
          event.preventDefault();
          setVolume((value) => Math.max(0, value - 0.05));
        }
      }}
    >
      <video
        ref={videoRef}
        className="jayrr-video-player__video"
        src={src}
        poster={poster ?? undefined}
        playsInline
        preload="metadata"
        aria-label={label}
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => {
          if (!scrubbing) {
            setCurrentTime(finiteMediaSeconds(event.currentTarget.currentTime));
          }
        }}
        onLoadedMetadata={(event) => {
          setDuration(resolveDuration(event.currentTarget.duration));
          setCurrentTime(finiteMediaSeconds(event.currentTarget.currentTime));
        }}
        onDurationChange={(event) => {
          setDuration(resolveDuration(event.currentTarget.duration));
        }}
        onEnded={() => {
          setPlaying(false);
          setControlsVisible(true);
        }}
      />

      {!playing ? (
        <button
          type="button"
          className="jayrr-video-player__big-play"
          aria-label={`Play ${label}`}
          onClick={togglePlay}
        >
          {playerPlayIcon}
        </button>
      ) : null}

      <div
        className="jayrr-video-player__bar"
        onClick={(event) => event.stopPropagation()}
      >
        <ControlButton label={playing ? "Pause" : "Play"} onClick={togglePlay}>
          {playing ? PauseGlyph : playerPlayIcon}
        </ControlButton>

        <span className="jayrr-video-player__time">
          {formatMediaClock(currentTime)} / {formatMediaClock(duration)}
        </span>

        <input
          className="jayrr-video-player__scrub"
          type="range"
          min={0}
          max={1000}
          step={1}
          value={Math.round(progress * 10)}
          aria-label="Seek"
          style={{
            background: `linear-gradient(to right, #fff ${progress}%, rgb(255 255 255 / 28%) ${progress}%)`,
          }}
          onPointerDown={() => {
            setScrubbing(true);
            revealControls();
          }}
          onPointerUp={() => {
            setScrubbing(false);
            scheduleHideControls();
          }}
          onChange={(event) => {
            const ratio = Number(event.currentTarget.value) / 1000;
            seekToRatio(ratio);
            revealControls();
          }}
        />

        <div className="jayrr-video-player__volume">
          <ControlButton
            label={muted || volume === 0 ? "Unmute" : "Mute"}
            onClick={toggleMute}
          >
            {muted || volume === 0 ? MuteGlyph : VolumeGlyph}
          </ControlButton>
          <input
            className="jayrr-video-player__volume-slider"
            type="range"
            min={0}
            max={100}
            step={1}
            value={muted ? 0 : Math.round(volume * 100)}
            aria-label="Volume"
            onChange={(event) => {
              const next = Number(event.currentTarget.value) / 100;
              setVolume(next);
              setMuted(next === 0);
              revealControls();
            }}
          />
        </div>

        <ControlButton
          label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={() => {
            void toggleFullscreen();
          }}
        >
          {isFullscreen ? ExitFullscreenGlyph : FullscreenGlyph}
        </ControlButton>
      </div>
    </div>
  );
};
