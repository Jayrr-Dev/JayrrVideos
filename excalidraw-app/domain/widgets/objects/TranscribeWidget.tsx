import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { useEffect, useRef, useState } from "react";

import {
  jayrrCameraLabel,
  jayrrDisplaySurfaceLabel,
  readJayrrCamera,
} from "../../../camera/jayrrCamera";

import {
  listJayrrDisplayStreams,
  subscribeJayrrStreams,
} from "../../../camera/jayrrCameraStreams";

import { listenStreamTranscript } from "../../transcription/listenStreamTranscript";
import {
  ensureSpeakerNames,
  speakerLabel,
} from "../../transcription/transcriptTurns";

import type { TranscriptSession } from "../../transcription/listenStreamTranscript";
import type { TranscriptTurn } from "../../transcription/transcriptTurns";

const MIC_SOURCE = "mic";

type SourceOption = {
  id: string;
  label: string;
  hasAudio: boolean;
};

type ChatTurn = TranscriptTurn & {
  id: string;
  isFinal: boolean;
};

const listSources = (
  api: ReturnType<typeof useExcalidrawAPI>,
): SourceOption[] => {
  const options: SourceOption[] = [
    { id: MIC_SOURCE, label: "Microphone", hasAudio: true },
  ];
  const elements = api?.getSceneElements() ?? [];
  for (const { id, stream } of listJayrrDisplayStreams()) {
    const element = elements.find((item) => item.id === id);
    const camera = element ? readJayrrCamera(element) : null;
    const named = jayrrCameraLabel(camera);
    const fallback =
      camera && camera.kind === "display"
        ? jayrrDisplaySurfaceLabel(camera.surface)
        : "Shared source";
    const hasAudio = stream.getAudioTracks().some((track) => track.enabled);
    options.push({
      id,
      label: named || fallback,
      hasAudio,
    });
  }
  return options;
};

const nextTurnId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const hueForSpeaker = (speaker: number | null) => {
  if (speaker === null) {
    return 220;
  }
  return Math.abs(speaker * 67) % 360;
};

export const TranscribeWidget = () => {
  const api = useExcalidrawAPI();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<TranscriptSession | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const [sources, setSources] = useState<SourceOption[]>(() =>
    listSources(null),
  );
  const [sourceId, setSourceId] = useState(MIC_SOURCE);
  const [listening, setListening] = useState(false);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [names, setNames] = useState<Record<number, string>>({});
  const [editingSpeaker, setEditingSpeaker] = useState<number | null>(null);
  const [status, setStatus] = useState("Pick a source, then Start.");

  useEffect(() => {
    const refresh = () => setSources(listSources(api));
    refresh();
    return subscribeJayrrStreams(refresh);
  }, [api]);

  useEffect(() => {
    const selected = sources.some((source) => source.id === sourceId);
    if (selected) {
      return;
    }
    setSourceId(MIC_SOURCE);
  }, [sourceId, sources]);

  useEffect(
    () => () => {
      sessionRef.current?.stop();
      sessionRef.current = null;
      const mic = micRef.current;
      micRef.current = null;
      if (mic) {
        for (const track of mic.getTracks()) {
          track.stop();
        }
      }
    },
    [],
  );

  useEffect(() => {
    const log = logRef.current;
    if (!log) {
      return;
    }
    log.scrollTop = log.scrollHeight;
  }, [turns]);

  const stopMic = () => {
    const mic = micRef.current;
    micRef.current = null;
    if (!mic) {
      return;
    }
    for (const track of mic.getTracks()) {
      track.stop();
    }
  };

  const stopSession = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    stopMic();
    setListening(false);
    setPaused(false);
  };

  const applyTurns = (next: TranscriptTurn[], isFinal: boolean) => {
    setNames((current) =>
      ensureSpeakerNames(
        current,
        next.map((turn) => turn.speaker),
      ),
    );
    setTurns((current) => {
      const kept = current.filter((turn) => turn.isFinal);
      const incoming = next.map((turn) => ({
        ...turn,
        id: nextTurnId(),
        isFinal,
      }));
      return [...kept, ...incoming].slice(-80);
    });
    setStatus("Listening…");
  };

  const start = async () => {
    if (busy) {
      return;
    }
    if (listening && paused && sessionRef.current) {
      sessionRef.current.setPaused(false);
      setPaused(false);
      setStatus("Listening…");
      return;
    }
    stopSession();
    setNames({});
    setBusy(true);
    setStatus("Starting…");
    const ownerWindow = rootRef.current?.ownerDocument.defaultView ?? window;
    try {
      let stream: MediaStream | null = null;
      if (sourceId === MIC_SOURCE) {
        stream = await ownerWindow.navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        micRef.current = stream;
      } else {
        stream =
          listJayrrDisplayStreams().find((item) => item.id === sourceId)
            ?.stream ?? null;
      }
      if (!stream) {
        setStatus("That source is no longer live. Start a Stream first.");
        return;
      }
      const session = listenStreamTranscript(
        stream,
        applyTurns,
        (message) => {
          sessionRef.current?.stop();
          sessionRef.current = null;
          stopMic();
          setListening(false);
          setPaused(false);
          setStatus(message);
        },
        ownerWindow,
      );
      sessionRef.current = session;
      setListening(true);
      setPaused(false);
      setStatus("Listening…");
    } catch (error: unknown) {
      stopMic();
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not start transcription.",
      );
    } finally {
      setBusy(false);
    }
  };

  const pause = () => {
    sessionRef.current?.setPaused(true);
    setPaused(true);
    setStatus("Paused.");
  };

  const selected = sources.find((source) => source.id === sourceId);
  const startLabel = listening && !paused ? "Pause" : "Start";

  return (
    <div
      ref={rootRef}
      className="jayrr-called-embed jayrr-called-embed--transcribe"
    >
      <div className="jayrr-called-embed__label">Transcribe</div>
      <select
        className="jayrr-called-embed__select"
        value={sourceId}
        disabled={listening && !paused}
        onChange={(event) => {
          setSourceId(event.target.value);
          if (listening) {
            stopSession();
            setStatus("Pick a source, then Start.");
          }
        }}
      >
        {sources.map((source) => (
          <option key={source.id} value={source.id}>
            {source.hasAudio ? source.label : `${source.label} (no audio)`}
          </option>
        ))}
      </select>
      <div className="jayrr-called-embed__row">
        <button
          type="button"
          className="jayrr-called-embed__btn"
          onClick={() => {
            if (listening && !paused) {
              pause();
              return;
            }
            void start();
          }}
          disabled={busy}
        >
          {startLabel}
        </button>
      </div>
      <div className="jayrr-called-embed__hint">
        {selected && !selected.hasAudio
          ? "Share tab audio, then Change source on Stream."
          : status}
      </div>
      <div ref={logRef} className="jayrr-called-embed__chat" aria-live="polite">
        {turns.length === 0 ? (
          <div className="jayrr-called-embed__empty">
            Speakers will show up as chat.
          </div>
        ) : (
          turns.map((turn) => {
            const hue = hueForSpeaker(turn.speaker);
            const side =
              turn.speaker === null || turn.speaker % 2 === 1
                ? "left"
                : "right";
            return (
              <div
                key={turn.id}
                className={`jayrr-called-embed__msg jayrr-called-embed__msg--${side}${
                  turn.isFinal ? "" : " is-draft"
                }`}
              >
                {editingSpeaker === turn.speaker && turn.speaker !== null ? (
                  <input
                    className="jayrr-called-embed__who-input"
                    autoFocus
                    defaultValue={speakerLabel(turn.speaker, names)}
                    aria-label="Rename speaker"
                    onBlur={(event) => {
                      const next = event.target.value.trim();
                      const speaker = turn.speaker;
                      if (speaker !== null && next) {
                        setNames((current) => ({
                          ...current,
                          [speaker]: next,
                        }));
                      }
                      setEditingSpeaker(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="jayrr-called-embed__who"
                    style={{ color: `hsl(${hue} 55% 42%)` }}
                    onClick={() => {
                      if (turn.speaker === null) {
                        return;
                      }
                      setEditingSpeaker(turn.speaker);
                    }}
                  >
                    {speakerLabel(turn.speaker, names)}
                  </button>
                )}
                <div className="jayrr-called-embed__bubble">{turn.text}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
