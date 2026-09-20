import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import {
  acquireJayrrTabAudio,
  listJayrrDisplayStreams,
  listJayrrMics,
  releaseJayrrTabAudio,
  subscribeJayrrStreams,
  unlockJayrrMics,
} from "../../../camera/jayrrCameraStreams";
import {
  mixMicIntoStream,
  openJayrrMic,
} from "../../../camera/mixMicIntoStream";
import { api, convexClient } from "../../../convexClient";
import {
  PRESENT_MIC_DEFAULT,
  PRESENT_MIC_NONE,
  getPresentMic,
  presentMicDeviceId,
  setPresentMic,
} from "../../../present/presentMic";
import {
  listenStreamTranscript,
  type TranscriptSession,
} from "../../transcription/listenStreamTranscript";
import {
  clearTranscript,
  publishTranscript,
} from "../../transcription/publishTranscript";
import {
  ensureSpeakerNames,
  speakerLabel,
  type TranscriptTurn,
} from "../../transcription/transcriptTurns";
import { LiveWidgetToolbar } from "../ui/LiveWidgetToolbar";
import { useRegisterWidgetToolbar } from "../widgetToolbarRegistry";

import {
  EMOTION_QUESTION,
  emotionsFromAnswers,
  type EmotionPick,
} from "./jevEmotionScale";
import {
  IQ_BANDS,
  IQ_QUESTIONS,
  buildIqState,
  compositeFromAnswers,
  iqFromComposite,
  shadeFromComposite,
  type IqResult,
  type IqShade,
} from "./jevIqScale";
import {
  MBTI_BANDS,
  MBTI_QUESTIONS,
  mbtiFromAnswers,
  type MbtiResult,
} from "./jevMbtiScale";
import {
  EMBED_PREFIX,
  MIC_SOURCE,
  isMicSource,
  listAudioSources,
  micDeviceId,
  micSourceId,
  type AudioSourceOption,
} from "./listAudioSources";
import {
  DEFAULT_TRANSCRIBE,
  readTranscribeConfig,
  writeTranscribeConfig,
  type TranscribeConfig,
} from "./transcribeConfig";

const LIVE_TURN_ID = "__live__";
const LIVE_DEBOUNCE_MS = 500;
const MIN_PHRASE_CHARS = 8;
const MAX_SCORED_TURNS = 200;

type ChatTurn = TranscriptTurn & {
  id: string;
  isFinal: boolean;
};

type TurnIq = {
  turnId: string;
  speaker: number | null;
  text: string;
  result: IqResult | null;
  emotion: EmotionPick[];
  mbti: MbtiResult | null;
};

const jevScoringOn = (config: TranscribeConfig) =>
  config.jevIq || config.jevMbti;

const questionsForConfig = (config: TranscribeConfig) => {
  const questions: Array<
    | typeof IQ_QUESTIONS[number]
    | typeof EMOTION_QUESTION
    | typeof MBTI_QUESTIONS[number]
  > = [];
  if (config.jevIq) {
    questions.push(...IQ_QUESTIONS, EMOTION_QUESTION);
  }
  if (config.jevMbti) {
    questions.push(...MBTI_QUESTIONS);
  }
  return questions;
};

type Job = {
  turnId: string;
  speaker: number | null;
  text: string;
  /** Recent talk before this bubble, so fragments keep conversational tone. */
  previousTurn: string | null;
};

const nextTurnId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Keep a spoken thought together. Split only after enough text, or the cap.
const MIN_BUBBLE_CHARS = 140;
const MAX_BUBBLE_CHARS = 320;
const COMPLETE_SENTENCE = /[.!?…]["')\]]*$/;

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

const isCompleteSentence = (text: string) =>
  COMPLETE_SENTENCE.test(text.trim());

const splitSentences = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  const parts = trimmed
    .split(/(?<=[.!?…])["')\]]*\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [trimmed];
};

const packSentences = (text: string) => {
  const packed: string[] = [];
  for (const part of splitSentences(text)) {
    const last = packed[packed.length - 1];
    if (
      last &&
      last.length < MIN_BUBBLE_CHARS &&
      last.length + part.length + 1 <= MAX_BUBBLE_CHARS
    ) {
      packed[packed.length - 1] = joinSentences(last, part);
      continue;
    }
    packed.push(part);
  }
  return packed;
};

const asBubbles = (turn: ChatTurn, text: string, keepId: boolean) => {
  const parts = packSentences(text);
  return parts.map((part, index) => ({
    ...turn,
    id: keepId && index === 0 ? turn.id : nextTurnId(),
    text: part,
  }));
};

const sameVoice = (left: ChatTurn, right: ChatTurn) =>
  left.speaker === right.speaker || right.speaker === null;

const shouldJoin = (left: ChatTurn, right: ChatTurn) => {
  if (left.isFinal !== right.isFinal || !sameVoice(left, right)) {
    return false;
  }
  const joined = left.text.length + right.text.length + 1;
  if (joined > MAX_BUBBLE_CHARS) {
    return false;
  }
  if (right.speaker === null && left.speaker !== null) {
    return !isCompleteSentence(left.text);
  }
  return !isCompleteSentence(left.text) || left.text.length < MIN_BUBBLE_CHARS;
};

const mergeChatTurns = (turns: ChatTurn[]) => {
  const merged: ChatTurn[] = [];
  for (const turn of turns) {
    const last = merged[merged.length - 1];
    if (last && shouldJoin(last, turn)) {
      const pieces = asBubbles(last, joinSentences(last.text, turn.text), true);
      const [head, ...rest] = pieces;
      if (head) {
        merged[merged.length - 1] = head;
      }
      merged.push(...rest);
      continue;
    }
    merged.push(...asBubbles(turn, turn.text, true));
  }
  return merged;
};

// First-seen order, not speaker id: nearby ids used to land on similar hues.
const SPEAKER_HUES = [205, 12, 145, 292, 42, 330, 175, 85, 250, 22];

const hueForSpeaker = (speaker: number | null, order: readonly number[]) => {
  if (speaker === null) {
    return 220;
  }
  const index = order.indexOf(speaker);
  const slot = index === -1 ? speaker : index;
  return SPEAKER_HUES[Math.abs(slot) % SPEAKER_HUES.length] ?? 205;
};

const speakerHueStyle = (
  speaker: number | null,
  order: readonly number[],
): CSSProperties =>
  ({
    "--jayrr-speaker-h": String(hueForSpeaker(speaker, order)),
  } as CSSProperties);

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

// Consecutive different people sit opposite each other. Same speaker stays
// put. Unlabeled turns follow whoever just spoke so mid-sentence "Unknown"
// does not jump.
const sidesForTurns = (turns: ChatTurn[]): Array<"left" | "right"> => {
  let last: "left" | "right" = "left";
  let lastSpeaker: number | null = null;
  return turns.map((turn) => {
    if (turn.speaker === null) {
      return last;
    }
    if (lastSpeaker !== null && turn.speaker !== lastSpeaker) {
      last = last === "left" ? "right" : "left";
    }
    lastSpeaker = turn.speaker;
    return last;
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

const CONTEXT_TURNS = 5;

// Last few bubbles before this line, same speaker included, so a fragment
// like "Phone numbers of the property owners." still sits in the prior plan.
const previousText = (turns: ChatTurn[], index: number) => {
  const start = Math.max(0, index - CONTEXT_TURNS);
  const parts: string[] = [];
  for (let cursor = start; cursor < index; cursor += 1) {
    const text = turns[cursor]?.text.trim() ?? "";
    if (text) {
      parts.push(text);
    }
  }
  if (parts.length === 0) {
    return null;
  }
  return parts.join(" ");
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

const EmotionBadge = ({ emotion }: { emotion: EmotionPick }) => (
  <span
    className={`jayrr-called-embed__emo jayrr-called-embed__emo--${emotion.tone}`}
    title={`${emotion.label} · ${emotion.cluster}`}
  >
    {emotion.label}
  </span>
);

const MbtiBadge = ({ mbti }: { mbti: MbtiResult }) => (
  <span
    className="jayrr-called-embed__iq jayrr-called-embed__mbti"
    title={`MBTI ${mbti.type}`}
  >
    {mbti.type}
  </span>
);

export const TranscribeWidget = ({ elementId }: { elementId: string }) => {
  const editor = useExcalidrawAPI();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<TranscriptSession | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const tabRef = useRef<{ id: string; stream: MediaStream } | null>(null);
  const mixStopRef = useRef<(() => void) | null>(null);
  const [sources, setSources] = useState<AudioSourceOption[]>(() =>
    listAudioSources(null),
  );
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [sourceId, setSourceId] = useState(DEFAULT_TRANSCRIBE.sourceId);
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
    setSourceId(readTranscribeConfig(element).sourceId);
  }, [editor, elementId]);

  useEffect(() => {
    const ownerWindow = rootRef.current?.ownerDocument.defaultView ?? window;
    let cancelled = false;
    const load = async () => {
      let devices: MediaDeviceInfo[] = [];
      try {
        devices = await unlockJayrrMics(ownerWindow);
      } catch {
        devices = await listJayrrMics();
      }
      if (!cancelled) {
        setMics(devices);
      }
    };
    void load();
    const media = ownerWindow.navigator.mediaDevices;
    media?.addEventListener("devicechange", load);
    return () => {
      cancelled = true;
      media?.removeEventListener("devicechange", load);
    };
  }, []);

  useEffect(() => {
    const refresh = () => setSources(listAudioSources(editor, mics));
    refresh();
    const offStreams = subscribeJayrrStreams(refresh);
    const offChange = editor?.onChange(() => refresh());
    return () => {
      offStreams();
      offChange?.();
    };
  }, [editor, mics]);

  useEffect(() => {
    if (isMicSource(sourceId) || sourceId.startsWith(EMBED_PREFIX)) {
      return;
    }
    if (sources.some((source) => source.id === sourceId)) {
      return;
    }
    setSourceId(MIC_SOURCE);
  }, [sourceId, sources]);

  useEffect(() => {
    const stored = getPresentMic();
    if (!stored || stored === PRESENT_MIC_NONE) {
      return;
    }
    const id = micSourceId(stored);
    if (sourceId !== MIC_SOURCE) {
      return;
    }
    if (!sources.some((source) => source.id === id)) {
      return;
    }
    setSourceId(id);
  }, [mics, sourceId, sources]);

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
      const tab = tabRef.current;
      tabRef.current = null;
      if (tab) {
        releaseJayrrTabAudio(tab.id, tab.stream);
      }
      mixStopRef.current?.();
      mixStopRef.current = null;
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

  const stopTab = () => {
    const tab = tabRef.current;
    tabRef.current = null;
    if (!tab) {
      return;
    }
    releaseJayrrTabAudio(tab.id, tab.stream);
  };

  const stopMix = () => {
    mixStopRef.current?.();
    mixStopRef.current = null;
  };

  const stopSession = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    stopMic();
    stopTab();
    stopMix();
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
      const packed = mergeChatTurns(incoming);
      const last = kept[kept.length - 1];
      const first = packed[0];
      if (last && first && shouldJoin(last, first)) {
        const joined = asBubbles(
          last,
          joinSentences(last.text, first.text),
          true,
        );
        return [...kept.slice(0, -1), ...joined, ...packed.slice(1)].slice(-80);
      }
      return [...kept, ...packed].slice(-80);
    });
    setStatus("");
  };

  // One Jev call carries every enabled scale; weights and type letters apply in code.
  const scoreJob = useCallback(async (job: Job) => {
    if (!convexClient) {
      throw new Error("Convex is not connected.");
    }
    const scoring = configRef.current;
    const questions = questionsForConfig(scoring);
    if (questions.length === 0) {
      return { result: null, emotion: [], mbti: null };
    }
    const result = await convexClient.action(api.canvasAi.jev.ask, {
      state: buildIqState(job.text, job.previousTurn),
      questions,
    });
    return {
      result: scoring.jevIq ? compositeFromAnswers(result.answers) : null,
      emotion: scoring.jevIq ? emotionsFromAnswers(result.answers) : [],
      mbti: scoring.jevMbti ? mbtiFromAnswers(result.answers) : null,
    };
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
          const scored = await scoreJob(job);
          if (generation !== generationRef.current) {
            continue;
          }
          const row: TurnIq = {
            turnId: job.turnId,
            speaker: job.speaker,
            text: job.text,
            result: scored.result,
            emotion: scored.emotion,
            mbti: scored.mbti,
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
    if (!jevScoringOn(config)) {
      return;
    }
    let added = false;
    turns.forEach((turn, index) => {
      if (turn.isFinal && enqueueFinal(turn, previousText(turns, index))) {
        added = true;
      }
    });
    if (added) {
      void pump();
    }
  }, [config, enqueueFinal, pump, turns]);

  const liveIndex = turns.findIndex((turn) => !turn.isFinal);
  const liveTurn = liveIndex === -1 ? null : turns[liveIndex] ?? null;
  const livePhrase = liveTurn?.text.trim() ?? "";

  useEffect(() => {
    if (
      !jevScoringOn(config) ||
      !liveTurn ||
      livePhrase.length < MIN_PHRASE_CHARS
    ) {
      setLive(null);
      return;
    }
    const handle = window.setTimeout(() => {
      liveJobRef.current = {
        turnId: LIVE_TURN_ID,
        speaker: liveTurn.speaker,
        text: livePhrase,
        previousTurn: previousText(turns, liveIndex),
      };
      void pump();
    }, LIVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [config, liveIndex, livePhrase, liveTurn, pump, turns]);

  // One number per utterance. Filler that fails the Noul gate has no badge.
  const iqByTurn = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of scores) {
      if (row.result?.substantive) {
        map.set(row.turnId, row.result.composite);
      }
    }
    return map;
  }, [scores]);

  const emotionByTurn = useMemo(() => {
    const map = new Map<string, EmotionPick[]>();
    for (const row of scores) {
      if (row.emotion.length > 0) {
        map.set(row.turnId, row.emotion);
      }
    }
    return map;
  }, [scores]);

  const mbtiByTurn = useMemo(() => {
    const map = new Map<string, MbtiResult>();
    for (const row of scores) {
      if (row.mbti) {
        map.set(row.turnId, row.mbti);
      }
    }
    return map;
  }, [scores]);

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
      if (isMicSource(sourceId)) {
        const picked = micDeviceId(sourceId);
        const stored = presentMicDeviceId();
        if (!picked && stored === null) {
          setStatus("No microphone selected.");
          return;
        }
        stream = await openJayrrMic(ownerWindow, picked || stored || undefined);
        micRef.current = stream;
      } else if (sourceId.startsWith(EMBED_PREFIX)) {
        setStatus("Share this tab with audio…");
        const embedId = sourceId.slice(EMBED_PREFIX.length);
        stream = await acquireJayrrTabAudio(embedId);
        tabRef.current = { id: embedId, stream };
      } else {
        const display =
          listJayrrDisplayStreams().find((item) => item.id === sourceId)
            ?.stream ?? null;
        if (
          display &&
          !display.getAudioTracks().some((track) => track.enabled)
        ) {
          const mixed = await mixMicIntoStream(
            display,
            ownerWindow,
            true,
            presentMicDeviceId(),
          );
          mixStopRef.current = mixed.stop;
          stream = mixed.stream;
        } else {
          stream = display;
        }
      }
      if (!stream) {
        setStatus(
          sourceId.startsWith(EMBED_PREFIX)
            ? "Could not tap that video. Share this tab with audio."
            : "That source is no longer live. Start a Stream first.",
        );
        return;
      }
      const session = listenStreamTranscript(
        stream,
        applyTurns,
        (message) => {
          sessionRef.current?.stop();
          sessionRef.current = null;
          stopMic();
          stopTab();
          stopMix();
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
      stopTab();
      stopMix();
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
      ? "Allow the microphone. Window share has no system audio on its own."
      : status;
  const speakers = uniqueSpeakers(turns);
  const liveSpeaker = turns[turns.length - 1]?.speaker ?? null;

  useRegisterWidgetToolbar(
    elementId,
    () => (
      <LiveWidgetToolbar
        listening={listening}
        paused={paused}
        busy={busy}
        startLabel={startLabel}
        sourceId={sourceId}
        sources={sources}
        clearDisabled={turns.length === 0}
        configOpen={configOpen}
        onClear={clearChat}
        onToggleConfig={() => setConfigOpen((open) => !open)}
        onStart={() => {
          if (listening && !paused) {
            pause();
            return;
          }
          void start();
        }}
        onSourceChange={(nextId) => {
          setSourceId(nextId);
          applyConfig({ ...config, sourceId: nextId }, true);
          if (isMicSource(nextId)) {
            setPresentMic(micDeviceId(nextId) || PRESENT_MIC_DEFAULT);
          }
          if (listening) {
            stopSession();
            setStatus("Pick a source, then Start.");
          }
        }}
      />
    ),
    [
      listening,
      paused,
      busy,
      startLabel,
      sourceId,
      sources,
      turns.length,
      configOpen,
      config,
    ],
  );

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
      {configOpen ? (
        <div className="jayrr-called-embed__cards">
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
          <div className="jayrr-called-embed__card">
            <div className="jayrr-called-embed__title jayrr-called-embed__title--row">
              <div className="jayrr-called-embed__label">Jev MBTI</div>
              <button
                type="button"
                className={
                  config.jevMbti
                    ? "jayrr-called-embed__switch is-on"
                    : "jayrr-called-embed__switch"
                }
                aria-pressed={config.jevMbti}
                aria-label="Score speech with Jev MBTI"
                onClick={() => {
                  const next = { ...config, jevMbti: !config.jevMbti };
                  resetIq();
                  applyConfig(next, true);
                }}
              >
                <span className="jayrr-called-embed__knob" />
              </button>
            </div>
            <div className="jayrr-called-embed__bands jayrr-called-embed__bands--pairs">
              {MBTI_BANDS.map((band) => (
                <span
                  key={band.letter}
                  className={`jayrr-called-embed__iq jayrr-called-embed__mbti jayrr-called-embed__mbti--${band.letter.toLowerCase()}`}
                >
                  {band.letter}
                </span>
              ))}
            </div>
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
                    const iqScore = turn.isFinal
                      ? iqByTurn.get(turn.id)
                      : live?.result?.substantive
                      ? live.result.composite
                      : undefined;
                    const emotions = turn.isFinal
                      ? emotionByTurn.get(turn.id) ?? []
                      : live?.emotion ?? [];
                    const mbti = turn.isFinal
                      ? mbtiByTurn.get(turn.id)
                      : live?.mbti ?? undefined;
                    const prev = turns[index - 1];
                    const follow =
                      prev !== undefined && prev.speaker === turn.speaker;
                    return (
                      <div
                        key={turn.id}
                        className={`jayrr-called-embed__msg jayrr-called-embed__msg--${side}${
                          turn.isFinal ? "" : " is-draft"
                        }${follow ? " is-follow" : ""}`}
                        style={speakerHueStyle(turn.speaker, speakers)}
                      >
                        {follow ? null : (
                          <div className="jayrr-called-embed__who-row">
                            <button
                              type="button"
                              className="jayrr-called-embed__who"
                              onClick={() => {
                                if (turn.speaker === null) {
                                  return;
                                }
                                setEditingSpeaker(turn.speaker);
                              }}
                            >
                              {speakerLabel(turn.speaker, names)}
                            </button>
                            {jevScoringOn(config) ? (
                              <div className="jayrr-called-embed__who-badges">
                                {config.jevIq
                                  ? emotions.map((emotion) => (
                                      <EmotionBadge
                                        key={emotion.id}
                                        emotion={emotion}
                                      />
                                    ))
                                  : null}
                                {config.jevIq ? (
                                  iqScore === undefined ? null : (
                                    <IqBadge composite={iqScore} />
                                  )
                                ) : null}
                                {config.jevMbti ? (
                                  mbti ? (
                                    <MbtiBadge mbti={mbti} />
                                  ) : null
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        )}
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
                  const live = liveSpeaker === speaker;
                  if (editingSpeaker === speaker) {
                    return (
                      <input
                        key={speaker}
                        className="jayrr-called-embed__who-input"
                        style={speakerHueStyle(speaker, speakers)}
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
                      style={speakerHueStyle(speaker, speakers)}
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
