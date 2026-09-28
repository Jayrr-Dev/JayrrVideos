import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { useEffect, useRef, useState } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

import { useAtom } from "../../../app-jotai";
import { JayrrSoundWaveform } from "../../../sounds/JayrrSoundWaveform";
import { addSoundFile, isAudioFile } from "../insertSound";
import { pdfReplaceRequestAtom } from "../pdfReplaceAtom";

import {
  DEFAULT_SOUND,
  readSoundConfig,
  writeSoundConfig,
  type SoundConfig,
} from "./soundConfig";

import "./SoundWidget.scss";

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

export const SoundWidget = ({ elementId }: { elementId: string }) => {
  const api = useExcalidrawAPI();
  const [replaceId, setReplaceId] = useAtom(pdfReplaceRequestAtom);
  const [config, setConfig] = useState<SoundConfig>(DEFAULT_SOUND);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // Collaborators receive the element before its bytes; reload once they land.
  const [fileReady, setFileReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!api) {
      return;
    }
    const sync = (
      elements: readonly ExcalidrawElement[],
      files: BinaryFiles,
    ) => {
      const element = elements.find((el) => el.id === elementId);
      if (element) {
        const next = readSoundConfig(element);
        setConfig(next);
        setFileReady(!!next.fileId && !!files[next.fileId]?.dataURL);
      }
    };
    sync(api.getSceneElements(), api.getFiles());
    return api.onChange((elements, _appState, files) => sync(elements, files));
  }, [api, elementId]);

  useEffect(() => {
    if (replaceId !== elementId) {
      return;
    }
    inputRef.current?.click();
    setReplaceId(null);
  }, [elementId, replaceId, setReplaceId]);

  // Files persist as octet-stream; rebuild a typed blob so <audio> decodes it.
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setSrc(null);
    setError(null);
    setPlaying(false);
    setTime(0);
    setDuration(0);

    const load = async () => {
      if (!api || !config.fileId) {
        return;
      }
      const file = api.getFiles()[config.fileId];
      if (!file?.dataURL) {
        return;
      }
      try {
        const blob = await (await fetch(file.dataURL)).blob();
        const typed = config.mimeType
          ? new Blob([blob], { type: config.mimeType })
          : blob;
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(typed);
        setSrc(objectUrl);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not open this sound.",
          );
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [api, config.fileId, config.mimeType, fileReady]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.loop = config.loop;
      audio.volume = config.volume;
    }
  }, [config.loop, config.volume, src]);

  // timeupdate fires ~4Hz; follow the playhead per frame while playing.
  useEffect(() => {
    if (!playing) {
      return;
    }
    let frame = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (audio) {
        setTime(audio.currentTime);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const persist = (next: SoundConfig) => {
    if (!api) {
      return;
    }
    api.updateScene({
      elements: api
        .getSceneElements()
        .map((el) =>
          el.id === elementId
            ? newElementWith(el, { customData: writeSoundConfig(el, next) })
            : el,
        ),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    setConfig(next);
  };

  const attachFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file || !api || !isAudioFile(file)) {
      return;
    }
    persist(await addSoundFile(api, file, config));
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !src) {
      return;
    }
    if (audio.paused) {
      void audio.play().catch((err) => {
        setError(err instanceof Error ? err.message : "Playback failed.");
      });
    } else {
      audio.pause();
    }
  };

  const seekFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / rect.width),
    );
    audio.currentTime = ratio * duration;
    setTime(audio.currentTime);
  };

  const progress = duration > 0 ? time / duration : 0;

  return (
    <div
      className="jayrr-called-embed jayrr-sound-embed"
      data-element-id={elementId}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="jayrr-sound-embed__file"
        onChange={(event) => {
          void attachFile(event.target.files);
          event.target.value = "";
        }}
      />
      {!config.fileId ? (
        <button
          type="button"
          className="jayrr-sound-embed__empty"
          onClick={() => inputRef.current?.click()}
        >
          Choose a sound
        </button>
      ) : error ? (
        <div className="jayrr-sound-embed__status">{error}</div>
      ) : !fileReady ? (
        <div className="jayrr-sound-embed__status">Loading sound…</div>
      ) : (
        <>
          <audio
            ref={audioRef}
            src={src ?? undefined}
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) =>
              setDuration(event.currentTarget.duration)
            }
            onError={() => setError("This audio format can't be played.")}
          />
          <div className="jayrr-sound-embed__head">
            <button
              type="button"
              className="jayrr-sound-embed__play"
              aria-label={playing ? "Pause" : "Play"}
              disabled={!src}
              onClick={togglePlay}
            >
              {playing ? (
                <svg viewBox="0 0 24 24" aria-hidden>
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
                </svg>
              )}
            </button>
            <div className="jayrr-sound-embed__meta">
              <span className="jayrr-sound-embed__title">{config.title}</span>
              <span className="jayrr-sound-embed__time">
                {formatTime(time)} / {formatTime(duration)}
              </span>
            </div>
            <button
              type="button"
              className={`jayrr-sound-embed__loop${
                config.loop ? " is-on" : ""
              }`}
              aria-pressed={config.loop}
              title="Loop"
              onClick={() => persist({ ...config, loop: !config.loop })}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />
              </svg>
            </button>
          </div>
          <div
            className="jayrr-sound-embed__wave"
            onPointerDown={(event) => {
              event.stopPropagation();
              seekFromPointer(event);
            }}
          >
            {src ? (
              <JayrrSoundWaveform
                sources={[src]}
                tone={playing ? "playing" : "idle"}
                progress={progress}
                volume={config.volume}
                className="jayrr-sound-embed__wave-canvas"
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};
