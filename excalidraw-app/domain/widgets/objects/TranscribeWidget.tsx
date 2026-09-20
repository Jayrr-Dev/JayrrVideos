import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  jayrrCameraLabel,
  jayrrDisplaySurfaceLabel,
  readJayrrCamera,
} from "../../../camera/jayrrCamera";

import {
  listJayrrDisplayStreams,
  subscribeJayrrStreams,
} from "../../../camera/jayrrCameraStreams";

import { api, convexClient } from "../../../convexClient";
import { listenStreamTranscript } from "../../transcription/listenStreamTranscript";
import {
  clearTranscript,
  publishTranscript,
} from "../../transcription/publishTranscript";
import {
  ensureSpeakerNames,
  speakerLabel,
} from "../../transcription/transcriptTurns";

import type { TranscriptSession } from "../../transcription/listenStreamTranscript";
import type { TranscriptTurn } from "../../transcription/transcriptTurns";

import {
  IQ_BANDS,
  IQ_QUESTIONS,
  buildIqState,
  compositeFromAnswers,
  iqFromComposite,
  shadeFromComposite,
  speakerKey,
  weightedComposite,
  type IqResult,
  type IqShade,
} from "./jevIqScale";
import {
  DEFAULT_TRANSCRIBE,
  readTranscribeConfig,
  writeTranscribeConfig,
  type TranscribeConfig,
} from "./transcribeConfig";

const MIC_SOURCE = "mic";
const LIVE_TURN_ID = "__live__";
const LIVE_DEBOUNCE_MS = 500;
const MIN_PHRASE_CHARS = 8;
const MAX_SCORED_TURNS = 200;

type SourceOption = {
  id: string;
  label: string;
  hasAudio: boolean;
};

type ChatTurn = TranscriptTurn & {
  id: string;
  isFinal: boolean;
};

type TurnIq = {
  turnId: string;
  speaker: number | null;
  text: string;
  result: IqResult;
};

type Job = {
  turnId: string;
  speaker: number | null;
  text: string;
  /** What this bubble replies to, so short answers are read in context. */
  previousTurn: string | null;
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

// Stop merging once a bubble gets this long so a monologue still paginates.
const MAX_BUBBLE_CHARS = 700;

const joinSentences = (left: string, right: string) => {
  const head = left.trim();
  const tail = right.trim();
  if (!head) {
    return tail;
  }
  if (!tail) {
    return head;
  }
  return `${head} ${tail}`;
};

// Fold back-to-back turns from one speaker into a single bubble. Unattributed
// (speaker null) turns continue the previous speaker, since diarization often
// drops the label on a few words mid-sentence.
const mergeChatTurns = (turns: ChatTurn[]) => {
  const merged: ChatTurn[] = [];
  for (const turn of turns) {
    const last = merged[merged.length - 1];
    const sameSpeaker =
      last !== undefined &&
      (last.speaker === turn.speaker || turn.speaker === null);
    if (
      last &&
      sameSpeaker &&
      last.isFinal === turn.isFinal &&
      last.text.length < MAX_BUBBLE_CHARS
    ) {
      merged[merged.length - 1] = {
        ...last,
        text: joinSentences(last.text, turn.text),
      };
      continue;
    }
    merged.push(turn);
  }
  return merged;
};

const hueForSpeaker = (speaker: number | null) => {
  if (speaker === null) {
    return 220;
  }
  return Math.abs(speaker * 67) % 360;
};

const uniqueSpeakers = (turns: ChatTurn[]) => {
  const seen = new Set<number>();
  const list: number[] = [];
  for (const turn of turns) {
    if (turn.speaker === null || seen.has(turn.speaker)) {
      continue;
    }
    seen.add(turn.speaker);
    list.push(turn.speaker);
  }
  return list;
};

// First new speaker sits left, the next distinct one sits right, then they
// alternate. Same speaker always keeps their side. Unlabeled turns follow
// whoever just spoke so mid-sentence "Unknown" does not jump.
const sidesForTurns = (turns: ChatTurn[]): Array<"left" | "right"> => {
  const assigned = new Map<number, "left" | "right">();
  let nextIsLeft = true;
  let last: "left" | "right" = "left";
  return turns.map((turn) => {
    if (turn.speaker === null) {
      return last;
    }
    const existing = assigned.get(turn.speaker);
    if (existing) {
      last = existing;
      return existing;
    }
    const side = nextIsLeft ? "left" : "right";
    nextIsLeft = !nextIsLeft;
    assigned.set(turn.speaker, side);
    last = side;
    return side;
  });
};

const scoreErrorMessage = (error: unknown) => {
  const raw = error instanceof Error ? error.message : "";
  if (raw.includes("Could not find public function")) {
    return "Jev scoring is not on the server yet. Restart convex dev.";
  }
  if (raw.includes("TypeSafe is not configured")) {
    return "Missing TYPESAFE_API_KEY on Convex. Set it, then retry.";
  }
  if (raw.includes("Not authenticated")) {
    return "Sign in to score with Jev.";
  }
  const stripped = raw
    .replace(/\[CONVEX[^\]]*\]\s*/g, "")
    .replace(/\[Request ID:[^\]]*\]\s*/g, "")
    .replace(/^(Uncaught\s+)?(Server\s+)?Error:?\s*/i, "")
    .replace(/\s*Called by client\.?$/i, "")
    .trim();
  return stripped || "Could not score with Jev.";
};

// The bubble just before this one, when it belongs to someone else.
const replyContext = (turns: ChatTurn[], index: number) => {
  const previous = turns[index - 1];
  if (!previous || previous.speaker === turns[index]?.speaker) {
    return null;
  }
  return previous.text;
};

const IqBadge = ({ composite }: { composite: number }) => {
  const shade: IqShade = shadeFromComposite(composite);
  return (
    <span
      className={`jayrr-called-embed__iq jayrr-called-embed__iq--${shade}`}
      title={`Verbal IQ ${iqFromComposite(composite)}`}
    >
      IQ {iqFromComposite(composite)}
    </span>
  );
};

export const TranscribeWidget = ({ elementId }: { elementId: string }) => {
  const editor = useExcalidrawAPI();
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
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState<TranscribeConfig>(DEFAULT_TRANSCRIBE);
  const [scores, setScores] = useState<TurnIq[]>([]);
  const [live, setLive] = useState<TurnIq | null>(null);

  const configRef = useRef(config);
  configRef.current = config;
  const queueRef = useRef<Job[]>([]);
  const liveJobRef = useRef<Job | null>(null);
  const runningRef = useRef(false);
  const generationRef = useRef(0);
  const scoredTextRef = useRef(new Map<string, string>());

  const persist = useCallback(
    (next: TranscribeConfig) => {
      if (!editor) {
        return;
      }
      const all = editor.getSceneElementsIncludingDeleted();
      const mapped = all.map((element) => {
        if (element.id !== elementId) {
          return element;
        }
        return newElementWith(element, {
          customData: writeTranscribeConfig(element, next),
        });
      });
      editor.updateScene({
        elements: mapped,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    },
    [editor, elementId],
  );

  const applyConfig = useCallback(
    (next: TranscribeConfig, save: boolean) => {
      setConfig(next);
      if (save) {
        persist(next);
      }
    },
    [persist],
  );

  const resetIq = useCallback(() => {
    generationRef.current += 1;
    queueRef.current = [];
    liveJobRef.current = null;
    scoredTextRef.current.clear();
    setScores([]);
    setLive(null);
  }, []);

  useEffect(() => {
    const element = editor
      ?.getSceneElementsIncludingDeleted()
      .find((item) => item.id === elementId);
    if (!element) {
      return;
    }
    setConfig(readTranscribeConfig(element));
  }, [editor, elementId]);

  useEffect(() => {
    const refresh = () => setSources(listSources(editor));
    refresh();
    return subscribeJayrrStreams(refresh);
  }, [editor]);

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
      clearTranscript(elementId);
    },
    [elementId],
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

  useEffect(() => {
    publishTranscript({
      sourceId: elementId,
      text: turns
        .map((turn) => turn.text.trim())
        .filter(Boolean)
        .join("\n"),
      listening,
      turns: turns.map((turn) => ({
        id: turn.id,
        speaker: turn.speaker,
        text: turn.text,
        isFinal: turn.isFinal,
      })),
      names,
    });
  }, [elementId, listening, names, turns]);

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
      const merged = mergeChatTurns([...kept, ...incoming]).slice(-80);
      return merged;
    });
    setStatus("");
  };

  // One Jev call carries the Noul gate plus every dimension; weights apply in code.
  const scoreJob = useCallback(async (job: Job): Promise<IqResult> => {
    if (!convexClient) {
      throw new Error("Convex is not connected.");
    }
    const result = await convexClient.action(api.canvasAi.jev.ask, {
      state: buildIqState(job.text, job.previousTurn),
      questions: IQ_QUESTIONS,
    });
    return compositeFromAnswers(result.answers);
  }, []);

  const pump = useCallback(async () => {
    if (runningRef.current) {
      return;
    }
    runningRef.current = true;
    try {
      for (;;) {
        const generation = generationRef.current;
        const job = queueRef.current.shift() ?? liveJobRef.current;
        if (!job) {
          break;
        }
        if (job.turnId === LIVE_TURN_ID) {
          liveJobRef.current = null;
        }
        try {
          const result = await scoreJob(job);
          if (generation !== generationRef.current) {
            continue;
          }
          const row: TurnIq = {
            turnId: job.turnId,
            speaker: job.speaker,
            text: job.text,
            result,
          };
          if (job.turnId === LIVE_TURN_ID) {
            setLive(row);
          } else {
            scoredTextRef.current.set(job.turnId, job.text);
            setScores((current) =>
              [
                ...current.filter((item) => item.turnId !== job.turnId),
                row,
              ].slice(-MAX_SCORED_TURNS),
            );
          }
        } catch (error: unknown) {
          if (generation !== generationRef.current) {
            continue;
          }
          setStatus(scoreErrorMessage(error));
          queueRef.current = [];
          liveJobRef.current = null;
        }
      }
    } finally {
      runningRef.current = false;
    }
  }, [scoreJob]);

  const enqueueFinal = useCallback(
    (turn: ChatTurn, previousTurn: string | null) => {
      const text = turn.text.trim();
      if (text.length < MIN_PHRASE_CHARS) {
        return false;
      }
      if (scoredTextRef.current.get(turn.id) === text) {
        return false;
      }
      if (queueRef.current.some((job) => job.turnId === turn.id)) {
        return false;
      }
      queueRef.current.push({
        turnId: turn.id,
        speaker: turn.speaker,
        text,
        previousTurn,
      });
      return true;
    },
    [],
  );

  useEffect(() => {
    if (!config.jevIq) {
      return;
    }
    let added = false;
    turns.forEach((turn, index) => {
      if (turn.isFinal && enqueueFinal(turn, replyContext(turns, index))) {
        added = true;
      }
    });
    if (added) {
      void pump();
    }
  }, [config.jevIq, enqueueFinal, pump, turns]);

  const liveIndex = turns.findIndex((turn) => !turn.isFinal);
  const liveTurn = liveIndex === -1 ? null : turns[liveIndex] ?? null;
  const livePhrase = liveTurn?.text.trim() ?? "";

  useEffect(() => {
    if (!config.jevIq || !liveTurn || livePhrase.length < MIN_PHRASE_CHARS) {
      setLive(null);
      return;
    }
    const handle = window.setTimeout(() => {
      liveJobRef.current = {
        turnId: LIVE_TURN_ID,
        speaker: liveTurn.speaker,
        text: livePhrase,
        previousTurn: replyContext(turns, liveIndex),
      };
      void pump();
    }, LIVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [config.jevIq, liveIndex, livePhrase, liveTurn, pump, turns]);

  // Backchannels ("Right.", "Yeah, exactly.") fail the Noul gate and do not
  // move a speaker's number. Remaining turns are weighted by confidence.
  const speakerAverages = useMemo(() => {
    const groups = new Map<string, IqResult[]>();
    for (const row of scores) {
      if (!row.result.substantive) {
        continue;
      }
      const key = speakerKey(row.speaker);
      const list = groups.get(key) ?? [];
      list.push(row.result);
      groups.set(key, list);
    }
    const averages = new Map<string, number>();
    for (const [key, rows] of groups) {
      const mean = weightedComposite(rows);
      if (mean !== null) {
        averages.set(key, mean);
      }
    }
    if (live?.result.substantive) {
      const key = speakerKey(live.speaker);
      if (!averages.has(key)) {
        averages.set(key, live.result.composite);
      }
    }
    return averages;
  }, [live, scores]);

  const start = async () => {
    if (busy) {
      return;
    }
    if (listening && paused && sessionRef.current) {
      sessionRef.current.setPaused(false);
      setPaused(false);
      setStatus("");
      return;
    }
    stopSession();
    setNames({});
    setTurns([]);
    resetIq();
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
        undefined,
        setStatus,
      );
      sessionRef.current = session;
      setListening(true);
      setPaused(false);
      setStatus("");
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
    setStatus("");
  };

  const clearChat = () => {
    setTurns([]);
    setNames({});
    setEditingSpeaker(null);
    resetIq();
    setStatus(listening ? "" : "Pick a source, then Start.");
  };

  const selected = sources.find((source) => source.id === sourceId);
  const startLabel = listening && !paused ? "Pause" : "Start";
  const hint =
    selected && !selected.hasAudio
      ? "Share tab audio, then Change source on Stream."
      : status;
  const speakers = uniqueSpeakers(turns);
  const liveSpeaker = turns[turns.length - 1]?.speaker ?? null;

  const renameSpeaker = (speaker: number, next: string) => {
    if (next) {
      setNames((current) => ({
        ...current,
        [speaker]: next,
      }));
    }
    setEditingSpeaker(null);
  };

  return (
    <div
      ref={rootRef}
      className="jayrr-called-embed jayrr-called-embed--transcribe"
    >
      <div className="jayrr-called-embed__head">
        <div className="jayrr-called-embed__title">
          {listening && paused ? (
            <span className="jayrr-called-embed__pause" aria-label="Paused">
              <span />
              <span />
            </span>
          ) : listening ? (
            <span
              className="jayrr-called-embed__listen is-live"
              aria-hidden="true"
            >
              <span />
              <span />
              <span />
            </span>
          ) : null}
          <div className="jayrr-called-embed__label">Transcribe</div>
        </div>
        <div className="jayrr-called-embed__actions">
          <button
            type="button"
            className={
              configOpen
                ? "jayrr-called-embed__btn jayrr-called-embed__btn--compact is-on"
                : "jayrr-called-embed__btn jayrr-called-embed__btn--compact"
            }
            onClick={() => setConfigOpen((open) => !open)}
          >
            Config
          </button>
          <button
            type="button"
            className="jayrr-called-embed__btn jayrr-called-embed__btn--compact"
            onClick={clearChat}
            disabled={turns.length === 0}
          >
            Clear
          </button>
          <button
            type="button"
            className="jayrr-called-embed__btn jayrr-called-embed__btn--compact"
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
          <select
            className="jayrr-called-embed__select jayrr-called-embed__select--compact"
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
        </div>
      </div>
      {configOpen ? (
        <div className="jayrr-called-embed__card">
          <div className="jayrr-called-embed__title jayrr-called-embed__title--row">
            <div className="jayrr-called-embed__label">Jev IQ</div>
            <button
              type="button"
              className={
                config.jevIq
                  ? "jayrr-called-embed__switch is-on"
                  : "jayrr-called-embed__switch"
              }
              aria-pressed={config.jevIq}
              aria-label="Score speech with Jev IQ"
              onClick={() => {
                const next = { ...config, jevIq: !config.jevIq };
                resetIq();
                applyConfig(next, true);
              }}
            >
              <span className="jayrr-called-embed__knob" />
            </button>
          </div>
          <div className="jayrr-called-embed__bands">
            {IQ_BANDS.map((band) => (
              <span
                key={band.label}
                className={`jayrr-called-embed__iq jayrr-called-embed__iq--${band.shade}`}
              >
                {band.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="jayrr-called-embed__body">
            <div className="jayrr-called-embed__main">
              {hint ? (
                <div className="jayrr-called-embed__hint">{hint}</div>
              ) : null}
              <div
                ref={logRef}
                className="jayrr-called-embed__chat"
                aria-live="polite"
              >
                {turns.length === 0 ? (
                  <div className="jayrr-called-embed__empty">
                    Speakers will show up as chat.
                  </div>
                ) : (
                  sidesForTurns(turns).map((side, index) => {
                    const turn = turns[index];
                    if (!turn) {
                      return null;
                    }
                    const hue = hueForSpeaker(turn.speaker);
                    const iqScore = speakerAverages.get(
                      speakerKey(turn.speaker),
                    );
                    return (
                      <div
                        key={turn.id}
                        className={`jayrr-called-embed__msg jayrr-called-embed__msg--${side}${
                          turn.isFinal ? "" : " is-draft"
                        }`}
                      >
                        <div className="jayrr-called-embed__who-row">
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
                          {config.jevIq ? (
                            iqScore === undefined ? null : (
                              <IqBadge composite={iqScore} />
                            )
                          ) : null}
                        </div>
                        <div className="jayrr-called-embed__bubble">
                          {turn.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <aside className="jayrr-called-embed__now">
              <div className="jayrr-called-embed__now-label">Speaker</div>
              <div className="jayrr-called-embed__now-list">
                {speakers.map((speaker) => {
                  const hue = hueForSpeaker(speaker);
                  const live = liveSpeaker === speaker;
                  if (editingSpeaker === speaker) {
                    return (
                      <input
                        key={speaker}
                        className="jayrr-called-embed__who-input"
                        autoFocus
                        defaultValue={speakerLabel(speaker, names)}
                        aria-label="Rename speaker"
                        onBlur={(event) => {
                          renameSpeaker(speaker, event.target.value.trim());
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          }
                        }}
                      />
                    );
                  }
                  return (
                    <button
                      key={speaker}
                      type="button"
                      className={
                        live
                          ? "jayrr-called-embed__now-name is-live"
                          : "jayrr-called-embed__now-name"
                      }
                      style={{ color: `hsl(${hue} 55% 42%)` }}
                      onClick={() => setEditingSpeaker(speaker)}
                    >
                      {speakerLabel(speaker, names)}
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
};
