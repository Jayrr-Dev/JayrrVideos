import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { helpIcon } from "@excalidraw/excalidraw/components/icons";
import { Popover } from "radix-ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
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
import {
  ConversationIndicators,
  useConversationContext,
} from "../../transcription/useConversationContext";
import { LiveWidgetToolbar } from "../ui/LiveWidgetToolbar";
import { useRegisterWidgetToolbar } from "../widgetToolbarRegistry";

import {
  BIG5_BANDS,
  BIG5_QUESTIONS,
  averageBigFive,
  bigFiveFromAnswers,
  type BigFiveResult,
} from "./jevBigFiveScale";
import {
  EMOTION_BANDS,
  EMOTION_QUESTION,
  emotionsFromAnswers,
  type EmotionPick,
} from "./jevEmotionScale";
import {
  ENERGY_BANDS,
  ENERGY_QUESTION,
  averageEnergy,
  energyFromAnswers,
  type EnergyResult,
} from "./jevEnergyScale";
import {
  ENNEA_BANDS,
  ENNEA_QUESTION,
  averageEnnea,
  enneaFromAnswers,
  type EnneaResult,
} from "./jevEnneagramScale";
import {
  HYPE_BANDS,
  HYPE_QUESTION,
  averageHype,
  hypeFromAnswers,
  type HypeResult,
} from "./jevHypeScale";
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
  COG_BANDS,
  COG_QUESTION,
  advanceFromAnswers,
  advanceStackLabel,
  averageAdvance,
  type MbtiAdvanceResult,
} from "./jevMbtiAdvanceScale";
import {
  MBTI_BANDS,
  MBTI_QUESTIONS,
  averageMbti,
  mbtiFromAnswers,
  type MbtiResult,
} from "./jevMbtiScale";
import {
  ONLINE_BANDS,
  ONLINE_QUESTION,
  averageOnline,
  onlineFromAnswers,
  type OnlineResult,
} from "./jevOnlineScale";
import {
  SMART_BANDS,
  SMART_QUESTION,
  averageSmart,
  smartFromAnswers,
  type SmartResult,
} from "./jevSmartScale";
import {
  SOCION_BANDS,
  SOCION_QUESTION,
  averageSocion,
  socionFromAnswers,
  type SocionResult,
} from "./jevSocionScale";
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
const LIVE_DEBOUNCE_MS = 300;
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
  smart: SmartResult | null;
  emotion: EmotionPick[];
  mbti: MbtiResult | null;
  advance: MbtiAdvanceResult | null;
  ennea: EnneaResult | null;
  hype: HypeResult | null;
  energy: EnergyResult | null;
  online: OnlineResult | null;
  socion: SocionResult | null;
  bigFive: BigFiveResult | null;
};

const jevScoringOn = (config: TranscribeConfig) =>
  !!config.contextEnabled ||
  config.jevIq ||
  config.jevSmart ||
  config.jevMbti ||
  config.jevMbtiAdvance ||
  config.jevEnneagram ||
  config.jevHype ||
  config.jevEnergy ||
  config.jevOnline ||
  config.jevSocion ||
  config.jevBigFive ||
  config.jevEmotion;

const questionsForConfig = (config: TranscribeConfig) => {
  const questions: Array<
    | typeof IQ_QUESTIONS[number]
    | typeof SMART_QUESTION
    | typeof EMOTION_QUESTION
    | typeof MBTI_QUESTIONS[number]
    | typeof COG_QUESTION
    | typeof ENNEA_QUESTION
    | typeof HYPE_QUESTION
    | typeof ENERGY_QUESTION
    | typeof ONLINE_QUESTION
    | typeof SOCION_QUESTION
    | typeof BIG5_QUESTIONS[number]
  > = [];
  if (config.jevIq) {
    questions.push(...IQ_QUESTIONS);
  }
  if (config.jevSmart) {
    questions.push(SMART_QUESTION);
  }
  if (config.jevEmotion) {
    questions.push(EMOTION_QUESTION);
  }
  if (config.jevMbti) {
    questions.push(...MBTI_QUESTIONS);
  }
  if (config.jevMbtiAdvance) {
    questions.push(COG_QUESTION);
  }
  if (config.jevEnneagram) {
    questions.push(ENNEA_QUESTION);
  }
  if (config.jevHype) {
    questions.push(HYPE_QUESTION);
  }
  if (config.jevEnergy) {
    questions.push(ENERGY_QUESTION);
  }
  if (config.jevOnline) {
    questions.push(ONLINE_QUESTION);
  }
  if (config.jevSocion) {
    questions.push(SOCION_QUESTION);
  }
  if (config.jevBigFive) {
    questions.push(...BIG5_QUESTIONS);
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

const hueForSpeaker = (
  speaker: number | null,
  order: readonly (number | null)[],
) => {
  if (speaker === null) {
    return 220;
  }
  const index = order.indexOf(speaker);
  const slot = index === -1 ? speaker : index;
  return SPEAKER_HUES[Math.abs(slot) % SPEAKER_HUES.length] ?? 205;
};

const speakerHueStyle = (
  speaker: number | null,
  order: readonly (number | null)[],
): CSSProperties =>
  ({
    "--jayrr-speaker-h": String(hueForSpeaker(speaker, order)),
  } as CSSProperties);

const uniqueSpeakers = (turns: ChatTurn[]) => {
  const seen = new Set<string>();
  const list: Array<number | null> = [];
  for (const turn of turns) {
    const key = turn.speaker === null ? "null" : String(turn.speaker);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
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

const JevCardHeader = ({
  label,
  pressed,
  ariaLabel,
  onToggle,
  container,
  children,
}: {
  label: string;
  pressed: boolean;
  ariaLabel: string;
  onToggle: () => void;
  container: HTMLElement | null;
  children: ReactNode;
}) => (
  <>
    <div className="jayrr-called-embed__title jayrr-called-embed__title--row">
      <div className="jayrr-called-embed__title-lead">
        <div className="jayrr-called-embed__label">{label}</div>
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="jayrr-called-embed__info"
              aria-label={`${label} scale`}
            >
              {helpIcon}
            </button>
          </Popover.Trigger>
          <Popover.Portal container={container ?? undefined}>
            <Popover.Content
              side="right"
              align="start"
              sideOffset={8}
              collisionPadding={8}
              className="jayrr-called-embed__legend"
            >
              {children}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
      <button
        type="button"
        className={
          pressed
            ? "jayrr-called-embed__switch is-on"
            : "jayrr-called-embed__switch"
        }
        aria-pressed={pressed}
        aria-label={ariaLabel}
        onClick={onToggle}
      >
        <span className="jayrr-called-embed__knob" />
      </button>
    </div>
  </>
);

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

const SmartBadge = ({ smart }: { smart: SmartResult }) => {
  const band = SMART_BANDS.find((row) => row.id === smart.id);
  return (
    <span
      className={`jayrr-called-embed__iq jayrr-called-embed__smart jayrr-called-embed__smart--${smart.id}`}
      title={band ? `${band.label}. ${band.what}` : smart.label}
    >
      {smart.label}
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

const AdvanceBadge = ({ advance }: { advance: MbtiAdvanceResult }) => (
  <span
    className={`jayrr-called-embed__iq jayrr-called-embed__fn jayrr-called-embed__fn--${advance.dominant.toLowerCase()}`}
    title={`${advance.type} · ${advance.stack.join(" ")}`}
  >
    {advanceStackLabel(advance)}
  </span>
);

const EnneaBadge = ({ ennea }: { ennea: EnneaResult }) => (
  <span
    className={`jayrr-called-embed__iq jayrr-called-embed__ennea jayrr-called-embed__ennea--${ennea.id}`}
    title={`Type ${ennea.id} · The ${ennea.name}`}
  >
    {ennea.label}
  </span>
);

const HypeBadge = ({ hype }: { hype: HypeResult }) => {
  const band = HYPE_BANDS.find((row) => row.id === hype.id);
  return (
    <span
      className={`jayrr-called-embed__iq jayrr-called-embed__hype jayrr-called-embed__hype--${hype.id}`}
      title={band ? `${band.label}. ${band.what}` : hype.label}
    >
      {hype.label}
    </span>
  );
};

const EnergyBadge = ({ energy }: { energy: EnergyResult }) => {
  const band = ENERGY_BANDS.find((row) => row.id === energy.id);
  return (
    <span
      className={`jayrr-called-embed__iq jayrr-called-embed__energy jayrr-called-embed__energy--${energy.zone} jayrr-called-embed__energy--${energy.id}`}
      title={
        band
          ? `${band.level} ${band.name}. ${band.what}`
          : `${energy.label} ${energy.name}`
      }
    >
      {energy.label}
    </span>
  );
};

const OnlineBadge = ({ online }: { online: OnlineResult }) => {
  const band = ONLINE_BANDS.find((row) => row.id === online.id);
  return (
    <span
      className={`jayrr-called-embed__iq jayrr-called-embed__online jayrr-called-embed__online--${online.id}`}
      title={
        band
          ? `${band.label}. ${band.what} Example: ${band.example}`
          : online.label
      }
    >
      {online.label}
    </span>
  );
};

const SocionBadge = ({ socion }: { socion: SocionResult }) => (
  <span
    className={`jayrr-called-embed__iq jayrr-called-embed__socion jayrr-called-embed__socion--${
      socion.quadra
    } jayrr-called-embed__socion--${socion.id.toLowerCase()}`}
    title={`${socion.id} ${socion.code4} · ${socion.nick} · ${socion.ego}`}
  >
    {socion.label}
  </span>
);

const BigFiveBadge = ({ bigFive }: { bigFive: BigFiveResult }) => (
  <span
    className="jayrr-called-embed__iq jayrr-called-embed__big5"
    title={BIG5_BANDS.map((band) => {
      const trait = bigFive.traits[band.id];
      return `${band.id} ${band.name}: ${trait.level}`;
    }).join(" · ")}
  >
    {bigFive.label}
  </span>
);

const TurnBadges = ({
  config,
  emotions,
  iqScore,
  smart,
  hype,
  energy,
  online,
  socion,
  bigFive,
  mbti,
  advance,
  ennea,
}: {
  config: TranscribeConfig;
  emotions: EmotionPick[];
  iqScore?: number;
  smart?: SmartResult;
  hype?: HypeResult;
  energy?: EnergyResult;
  online?: OnlineResult;
  socion?: SocionResult;
  bigFive?: BigFiveResult;
  mbti?: MbtiResult;
  advance?: MbtiAdvanceResult;
  ennea?: EnneaResult;
}) => {
  if (!jevScoringOn(config)) {
    return null;
  }
  return (
    <div className="jayrr-called-embed__who-badges">
      {config.jevEmotion
        ? emotions.map((emotion) => (
            <EmotionBadge key={emotion.id} emotion={emotion} />
          ))
        : null}
      {config.jevIq ? (
        iqScore === undefined ? null : (
          <IqBadge composite={iqScore} />
        )
      ) : null}
      {config.jevSmart ? smart ? <SmartBadge smart={smart} /> : null : null}
      {config.jevHype ? hype ? <HypeBadge hype={hype} /> : null : null}
      {config.jevEnergy ? (
        energy ? (
          <EnergyBadge energy={energy} />
        ) : null
      ) : null}
      {config.jevOnline ? (
        online ? (
          <OnlineBadge online={online} />
        ) : null
      ) : null}
      {config.jevSocion ? (
        socion ? (
          <SocionBadge socion={socion} />
        ) : null
      ) : null}
      {config.jevBigFive ? (
        bigFive ? (
          <BigFiveBadge bigFive={bigFive} />
        ) : null
      ) : null}
      {config.jevMbti ? mbti ? <MbtiBadge mbti={mbti} /> : null : null}
      {config.jevMbtiAdvance ? (
        advance ? (
          <AdvanceBadge advance={advance} />
        ) : null
      ) : null}
      {config.jevEnneagram ? ennea ? <EnneaBadge ennea={ennea} /> : null : null}
    </div>
  );
};

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
  const [config, setConfig] = useState<TranscribeConfig>(DEFAULT_TRANSCRIBE);
  const [scores, setScores] = useState<TurnIq[]>([]);
  const [live, setLive] = useState<TurnIq | null>(null);
  const conversation = useConversationContext(
    elementId,
    !!config.contextEnabled,
    rootRef,
  );
  const evaluateContext = conversation.evaluate;
  const contextVersionRef = useRef(conversation.version);
  contextVersionRef.current = conversation.version;
  const turnsRef = useRef(turns);
  turnsRef.current = turns;
  const speakerScores = useMemo(() => {
    void conversation.version;
    return config.contextEnabled
      ? scores.filter(
          (row) =>
            conversation.context.results.get(row.turnId)?.topicId ===
              conversation.topicId && conversation.topicId !== null,
        )
      : scores;
  }, [
    scores,
    config.contextEnabled,
    conversation.context,
    conversation.topicId,
    conversation.version,
  ]);

  const configRef = useRef(config);
  configRef.current = config;
  const queueRef = useRef<Job[]>([]);
  const liveJobRef = useRef<Job | null>(null);
  const runningRef = useRef(false);
  const inFlightRef = useRef<Job | null>(null);
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
    resetIq();
  }, [
    config.contextEnabled,
    config.jevIq,
    config.jevSmart,
    config.jevMbti,
    config.jevMbtiAdvance,
    config.jevEnneagram,
    config.jevHype,
    config.jevEnergy,
    config.jevOnline,
    config.jevSocion,
    config.jevBigFive,
    config.jevEmotion,
    sourceId,
    conversation.session,
    resetIq,
  ]);

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
  const scoreJob = useCallback(
    async (job: Job) => {
      if (!convexClient) {
        throw new Error("Convex is not connected.");
      }
      const scoring = configRef.current;
      const questions = questionsForConfig(scoring);
      if (questions.length === 0 && !scoring.contextEnabled) {
        return {
          result: null,
          smart: null,
          emotion: [],
          mbti: null,
          advance: null,
          ennea: null,
          hype: null,
          energy: null,
          online: null,
          socion: null,
          bigFive: null,
        };
      }
      const result = scoring.contextEnabled
        ? await evaluateContext(job.text, job.turnId, questions)
        : await convexClient.action(api.canvasAi.jev.ask, {
            state: buildIqState(job.text, job.previousTurn),
            questions,
          });
      return {
        result: scoring.jevIq ? compositeFromAnswers(result.answers) : null,
        smart: scoring.jevSmart ? smartFromAnswers(result.answers) : null,
        emotion: scoring.jevEmotion ? emotionsFromAnswers(result.answers) : [],
        mbti: scoring.jevMbti ? mbtiFromAnswers(result.answers) : null,
        advance: scoring.jevMbtiAdvance
          ? advanceFromAnswers(result.answers)
          : null,
        ennea: scoring.jevEnneagram ? enneaFromAnswers(result.answers) : null,
        hype: scoring.jevHype ? hypeFromAnswers(result.answers) : null,
        energy: scoring.jevEnergy ? energyFromAnswers(result.answers) : null,
        online: scoring.jevOnline ? onlineFromAnswers(result.answers) : null,
        socion: scoring.jevSocion ? socionFromAnswers(result.answers) : null,
        bigFive: scoring.jevBigFive ? bigFiveFromAnswers(result.answers) : null,
      };
    },
    [evaluateContext],
  );

  const pump = useCallback(async () => {
    if (runningRef.current) {
      return;
    }
    runningRef.current = true;
    let lastWasLive = false;
    try {
      for (;;) {
        const generation = generationRef.current;
        const contextVersion = contextVersionRef.current;
        const job: Job | null | undefined = lastWasLive
          ? queueRef.current.shift() ?? liveJobRef.current
          : liveJobRef.current ?? queueRef.current.shift();
        if (!job) {
          break;
        }
        if (
          job.turnId !== LIVE_TURN_ID &&
          scoredTextRef.current.get(job.turnId) ===
            `${contextVersion}:${job.text}`
        ) {
          continue;
        }
        inFlightRef.current = job;
        lastWasLive = job.turnId === LIVE_TURN_ID;
        if (job.turnId === LIVE_TURN_ID) {
          liveJobRef.current = null;
        }
        try {
          const scored = await scoreJob(job);
          if (generation !== generationRef.current) {
            continue;
          }
          const currentTurn =
            job.turnId === LIVE_TURN_ID
              ? turnsRef.current.find((turn) => !turn.isFinal)
              : turnsRef.current.find((turn) => turn.id === job.turnId);
          if (
            !currentTurn ||
            currentTurn.text.trim() !== job.text ||
            currentTurn.speaker !== job.speaker
          ) {
            continue;
          }
          const row: TurnIq = {
            turnId: job.turnId,
            speaker: job.speaker,
            text: job.text,
            result: scored.result,
            smart: scored.smart,
            emotion: scored.emotion,
            mbti: scored.mbti,
            advance: scored.advance,
            ennea: scored.ennea,
            hype: scored.hype,
            energy: scored.energy,
            online: scored.online,
            socion: scored.socion,
            bigFive: scored.bigFive,
          };
          if (job.turnId === LIVE_TURN_ID) {
            setLive(row);
          } else {
            scoredTextRef.current.set(
              job.turnId,
              `${contextVersion}:${job.text}`,
            );
            setScores((current) =>
              [
                ...current.filter((item) => item.turnId !== job.turnId),
                row,
              ].slice(-MAX_SCORED_TURNS),
            );
          }
        } catch (error: unknown) {
          if (
            error instanceof Error &&
            error.message === "Stale conversation result"
          ) {
            if (
              generation === generationRef.current &&
              job.turnId !== LIVE_TURN_ID &&
              turnsRef.current.some(
                (turn) =>
                  turn.id === job.turnId && turn.text.trim() === job.text,
              )
            ) {
              queueRef.current.push(job);
            }
            continue;
          }
          if (generation !== generationRef.current) {
            continue;
          }
          setStatus(scoreErrorMessage(error));
          // Preserve final speech even when one model request fails.
        } finally {
          inFlightRef.current = null;
        }
      }
    } finally {
      runningRef.current = false;
    }
  }, [scoreJob]);

  const enqueueFinal = useCallback(
    (turn: ChatTurn, previousTurn: string | null) => {
      const text = turn.text.trim();
      if (
        inFlightRef.current?.turnId === turn.id &&
        inFlightRef.current.text === text
      ) {
        return false;
      }
      if (
        text.length < (configRef.current.contextEnabled ? 1 : MIN_PHRASE_CHARS)
      ) {
        return false;
      }
      const previous = scoredTextRef.current.get(turn.id);
      const recent = turnsRef.current
        .filter((item) => item.isFinal)
        .slice(-6)
        .some((item) => item.id === turn.id);
      if (
        previous === `${contextVersionRef.current}:${text}` ||
        (previous?.endsWith(`:${text}`) && !recent)
      ) {
        return false;
      }
      queueRef.current = queueRef.current.filter(
        (job) => job.turnId !== turn.id,
      );
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
  }, [config, enqueueFinal, pump, turns, conversation.version]);

  const liveIndex = turns.findIndex((turn) => !turn.isFinal);
  const liveTurn = liveIndex === -1 ? null : turns[liveIndex] ?? null;
  const livePhrase = liveTurn?.text.trim() ?? "";

  useEffect(() => {
    if (
      !jevScoringOn(config) ||
      !liveTurn ||
      livePhrase.length < (config.contextEnabled ? 1 : MIN_PHRASE_CHARS)
    ) {
      setLive(null);
      return;
    }
    const ownerWindow = rootRef.current?.ownerDocument.defaultView;
    if (!ownerWindow) {
      return;
    }
    const handle = ownerWindow.setTimeout(() => {
      liveJobRef.current = {
        turnId: LIVE_TURN_ID,
        speaker: liveTurn.speaker,
        text: livePhrase,
        previousTurn: previousText(turns, liveIndex),
      };
      void pump();
    }, LIVE_DEBOUNCE_MS);
    return () => ownerWindow.clearTimeout(handle);
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

  const mbtiBySpeaker = useMemo(() => {
    const groups = new Map<number, MbtiResult[]>();
    const add = (speaker: number | null, mbti: MbtiResult | null) => {
      if (speaker === null || !mbti) {
        return;
      }
      const list = groups.get(speaker) ?? [];
      list.push(mbti);
      groups.set(speaker, list);
    };
    for (const row of speakerScores) {
      add(row.speaker, row.mbti);
    }
    if (live && !config.contextEnabled) {
      add(live.speaker, live.mbti);
    }
    const map = new Map<number, MbtiResult>();
    for (const [speaker, rows] of groups) {
      const average = averageMbti(rows);
      if (average) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [live, speakerScores, config.contextEnabled]);

  const advanceByTurn = useMemo(() => {
    const map = new Map<string, MbtiAdvanceResult>();
    for (const row of scores) {
      if (row.advance) {
        map.set(row.turnId, row.advance);
      }
    }
    return map;
  }, [scores]);

  const advanceBySpeaker = useMemo(() => {
    const groups = new Map<number, MbtiAdvanceResult[]>();
    const add = (speaker: number | null, advance: MbtiAdvanceResult | null) => {
      if (speaker === null || !advance) {
        return;
      }
      const list = groups.get(speaker) ?? [];
      list.push(advance);
      groups.set(speaker, list);
    };
    for (const row of speakerScores) {
      add(row.speaker, row.advance);
    }
    if (live && !config.contextEnabled) {
      add(live.speaker, live.advance);
    }
    const map = new Map<number, MbtiAdvanceResult>();
    for (const [speaker, rows] of groups) {
      const average = averageAdvance(rows);
      if (average) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [live, speakerScores, config.contextEnabled]);

  const enneaByTurn = useMemo(() => {
    const map = new Map<string, EnneaResult>();
    for (const row of scores) {
      if (row.ennea) {
        map.set(row.turnId, row.ennea);
      }
    }
    return map;
  }, [scores]);

  const enneaBySpeaker = useMemo(() => {
    const groups = new Map<number, EnneaResult[]>();
    const add = (speaker: number | null, ennea: EnneaResult | null) => {
      if (speaker === null || !ennea) {
        return;
      }
      const list = groups.get(speaker) ?? [];
      list.push(ennea);
      groups.set(speaker, list);
    };
    for (const row of speakerScores) {
      add(row.speaker, row.ennea);
    }
    if (live && !config.contextEnabled) {
      add(live.speaker, live.ennea);
    }
    const map = new Map<number, EnneaResult>();
    for (const [speaker, rows] of groups) {
      const average = averageEnnea(rows);
      if (average) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [live, speakerScores, config.contextEnabled]);

  const smartByTurn = useMemo(() => {
    const map = new Map<string, SmartResult>();
    for (const row of scores) {
      if (row.smart) {
        map.set(row.turnId, row.smart);
      }
    }
    return map;
  }, [scores]);

  const smartBySpeaker = useMemo(() => {
    const groups = new Map<number, SmartResult[]>();
    const add = (speaker: number | null, smart: SmartResult | null) => {
      if (speaker === null || !smart) {
        return;
      }
      const list = groups.get(speaker) ?? [];
      list.push(smart);
      groups.set(speaker, list);
    };
    for (const row of speakerScores) {
      add(row.speaker, row.smart);
    }
    if (live && !config.contextEnabled) {
      add(live.speaker, live.smart);
    }
    const map = new Map<number, SmartResult>();
    for (const [speaker, rows] of groups) {
      const average = averageSmart(rows);
      if (average) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [live, speakerScores, config.contextEnabled]);

  const hypeByTurn = useMemo(() => {
    const map = new Map<string, HypeResult>();
    for (const row of scores) {
      if (row.hype) {
        map.set(row.turnId, row.hype);
      }
    }
    return map;
  }, [scores]);

  const hypeBySpeaker = useMemo(() => {
    const groups = new Map<number, HypeResult[]>();
    const add = (speaker: number | null, hype: HypeResult | null) => {
      if (speaker === null || !hype) {
        return;
      }
      const list = groups.get(speaker) ?? [];
      list.push(hype);
      groups.set(speaker, list);
    };
    for (const row of speakerScores) {
      add(row.speaker, row.hype);
    }
    if (live && !config.contextEnabled) {
      add(live.speaker, live.hype);
    }
    const map = new Map<number, HypeResult>();
    for (const [speaker, rows] of groups) {
      const average = averageHype(rows);
      if (average) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [live, speakerScores, config.contextEnabled]);

  const energyByTurn = useMemo(() => {
    const map = new Map<string, EnergyResult>();
    for (const row of scores) {
      if (row.energy) {
        map.set(row.turnId, row.energy);
      }
    }
    return map;
  }, [scores]);

  const energyBySpeaker = useMemo(() => {
    const groups = new Map<number, EnergyResult[]>();
    const add = (speaker: number | null, energy: EnergyResult | null) => {
      if (speaker === null || !energy) {
        return;
      }
      const list = groups.get(speaker) ?? [];
      list.push(energy);
      groups.set(speaker, list);
    };
    for (const row of speakerScores) {
      add(row.speaker, row.energy);
    }
    if (live && !config.contextEnabled) {
      add(live.speaker, live.energy);
    }
    const map = new Map<number, EnergyResult>();
    for (const [speaker, rows] of groups) {
      const average = averageEnergy(rows);
      if (average) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [live, speakerScores, config.contextEnabled]);

  const onlineByTurn = useMemo(() => {
    const map = new Map<string, OnlineResult>();
    for (const row of scores) {
      if (row.online) {
        map.set(row.turnId, row.online);
      }
    }
    return map;
  }, [scores]);

  const onlineBySpeaker = useMemo(() => {
    const groups = new Map<number, OnlineResult[]>();
    const add = (speaker: number | null, online: OnlineResult | null) => {
      if (speaker === null || !online) {
        return;
      }
      const list = groups.get(speaker) ?? [];
      list.push(online);
      groups.set(speaker, list);
    };
    for (const row of speakerScores) {
      add(row.speaker, row.online);
    }
    if (live && !config.contextEnabled) {
      add(live.speaker, live.online);
    }
    const map = new Map<number, OnlineResult>();
    for (const [speaker, rows] of groups) {
      const average = averageOnline(rows);
      if (average) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [live, speakerScores, config.contextEnabled]);

  const socionByTurn = useMemo(() => {
    const map = new Map<string, SocionResult>();
    for (const row of scores) {
      if (row.socion) {
        map.set(row.turnId, row.socion);
      }
    }
    return map;
  }, [scores]);

  const socionBySpeaker = useMemo(() => {
    const groups = new Map<number, SocionResult[]>();
    const add = (speaker: number | null, socion: SocionResult | null) => {
      if (speaker === null || !socion) {
        return;
      }
      const list = groups.get(speaker) ?? [];
      list.push(socion);
      groups.set(speaker, list);
    };
    for (const row of speakerScores) {
      add(row.speaker, row.socion);
    }
    if (live && !config.contextEnabled) {
      add(live.speaker, live.socion);
    }
    const map = new Map<number, SocionResult>();
    for (const [speaker, rows] of groups) {
      const average = averageSocion(rows);
      if (average) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [live, speakerScores, config.contextEnabled]);

  const bigFiveByTurn = useMemo(() => {
    const map = new Map<string, BigFiveResult>();
    for (const row of scores) {
      if (row.bigFive) {
        map.set(row.turnId, row.bigFive);
      }
    }
    return map;
  }, [scores]);

  const bigFiveBySpeaker = useMemo(() => {
    const groups = new Map<number, BigFiveResult[]>();
    const add = (speaker: number | null, bigFive: BigFiveResult | null) => {
      if (speaker === null || !bigFive) {
        return;
      }
      const list = groups.get(speaker) ?? [];
      list.push(bigFive);
      groups.set(speaker, list);
    };
    for (const row of speakerScores) {
      add(row.speaker, row.bigFive);
    }
    if (live && !config.contextEnabled) {
      add(live.speaker, live.bigFive);
    }
    const map = new Map<number, BigFiveResult>();
    for (const [speaker, rows] of groups) {
      const average = averageBigFive(rows);
      if (average) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [live, speakerScores, config.contextEnabled]);

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
  const toggleConfig = () =>
    applyConfig({ ...config, configOpen: !config.configOpen }, true);

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
        configOpen={!!config.configOpen}
        onClear={clearChat}
        onToggleConfig={toggleConfig}
        onStart={() => {
          if (listening && !paused) {
            pause();
            return;
          }
          void start();
        }}
        onSourceChange={(nextId) => {
          if (nextId !== sourceId) {
            clearChat();
          }
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
      {config.configOpen ? (
        <div className="jayrr-called-embed__cards">
          <div className="jayrr-called-embed__card">
            <JevCardHeader
              label="Conversation context"
              pressed={!!config.contextEnabled}
              ariaLabel="Show conversation topic view"
              container={rootRef.current}
              onToggle={() =>
                applyConfig(
                  { ...config, contextEnabled: !config.contextEnabled },
                  true,
                )
              }
            >
              <div className="jayrr-called-embed__hint">
                Uses recent talk to pick the active topic on the live view.
              </div>
            </JevCardHeader>
          </div>
          <div className="jayrr-called-embed__card">
            <JevCardHeader
              label="Jev IQ"
              pressed={!!config.jevIq}
              ariaLabel="Show Jev IQ view"
              container={rootRef.current}
              onToggle={() => {
                const next = { ...config, jevIq: !config.jevIq };
                resetIq();
                applyConfig(next, true);
              }}
            >
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
            </JevCardHeader>
          </div>
          <div className="jayrr-called-embed__card">
            <JevCardHeader
              label="Jev Smart"
              pressed={!!config.jevSmart}
              ariaLabel="Score speech with Jev Smart"
              container={rootRef.current}
              onToggle={() => {
                const next = { ...config, jevSmart: !config.jevSmart };
                resetIq();
                applyConfig(next, true);
              }}
            >
              <div className="jayrr-called-embed__bands jayrr-called-embed__bands--hype">
                {SMART_BANDS.map((band) => (
                  <span
                    key={band.id}
                    className={`jayrr-called-embed__iq jayrr-called-embed__smart jayrr-called-embed__smart--${band.id}`}
                    title={band.what}
                  >
                    {band.label}
                  </span>
                ))}
              </div>
            </JevCardHeader>
          </div>
          <div className="jayrr-called-embed__card">
            <JevCardHeader
              label="Jev Hype"
              pressed={!!config.jevHype}
              ariaLabel="Score speech with the hype meter"
              container={rootRef.current}
              onToggle={() => {
                const next = { ...config, jevHype: !config.jevHype };
                resetIq();
                applyConfig(next, true);
              }}
            >
              <div className="jayrr-called-embed__bands jayrr-called-embed__bands--hype">
                {HYPE_BANDS.map((band) => (
                  <span
                    key={band.id}
                    className={`jayrr-called-embed__iq jayrr-called-embed__hype jayrr-called-embed__hype--${band.id}`}
                    title={band.what}
                  >
                    {band.label}
                  </span>
                ))}
              </div>
            </JevCardHeader>
          </div>
          <div className="jayrr-called-embed__card">
            <JevCardHeader
              label="Jev Energy"
              pressed={!!config.jevEnergy}
              ariaLabel="Score speech with Dodson energy levels"
              container={rootRef.current}
              onToggle={() => {
                const next = { ...config, jevEnergy: !config.jevEnergy };
                resetIq();
                applyConfig(next, true);
              }}
            >
              <div className="jayrr-called-embed__bands jayrr-called-embed__bands--energy">
                {ENERGY_BANDS.map((band) => (
                  <span
                    key={band.id}
                    className={`jayrr-called-embed__iq jayrr-called-embed__energy jayrr-called-embed__energy--${band.zone} jayrr-called-embed__energy--${band.id}`}
                    title={`${band.level} ${band.name}. ${band.what}`}
                  >
                    {String(band.level)}
                  </span>
                ))}
              </div>
            </JevCardHeader>
          </div>
          <div className="jayrr-called-embed__card">
            <JevCardHeader
              label="Jev Online"
              pressed={!!config.jevOnline}
              ariaLabel="Score speech with online behaviour levels"
              container={rootRef.current}
              onToggle={() => {
                const next = { ...config, jevOnline: !config.jevOnline };
                resetIq();
                applyConfig(next, true);
              }}
            >
              <div className="jayrr-called-embed__bands jayrr-called-embed__bands--online">
                {ONLINE_BANDS.map((band) => (
                  <span
                    key={band.id}
                    className={`jayrr-called-embed__iq jayrr-called-embed__online jayrr-called-embed__online--${band.id}`}
                    title={`${band.label}. ${band.what} Example: ${band.example}`}
                  >
                    {band.label}
                  </span>
                ))}
              </div>
            </JevCardHeader>
          </div>
          <div className="jayrr-called-embed__card">
            <JevCardHeader
              label="Jev Socion"
              pressed={!!config.jevSocion}
              ariaLabel="Score speech with socionic types"
              container={rootRef.current}
              onToggle={() => {
                const next = { ...config, jevSocion: !config.jevSocion };
                resetIq();
                applyConfig(next, true);
              }}
            >
              <div className="jayrr-called-embed__bands jayrr-called-embed__bands--socion">
                {SOCION_BANDS.map((band) => (
                  <span
                    key={band.id}
                    className={`jayrr-called-embed__iq jayrr-called-embed__socion jayrr-called-embed__socion--${
                      band.quadra
                    } jayrr-called-embed__socion--${band.id.toLowerCase()}`}
                    title={`${band.id} ${band.code4} · ${band.nick} · ${band.ego}. ${band.name}`}
                  >
                    {band.id}
                  </span>
                ))}
              </div>
            </JevCardHeader>
          </div>
          <div className="jayrr-called-embed__card">
            <JevCardHeader
              label="Jev Big Five"
              pressed={!!config.jevBigFive}
              ariaLabel="Score speech with Big Five traits"
              container={rootRef.current}
              onToggle={() => {
                const next = { ...config, jevBigFive: !config.jevBigFive };
                resetIq();
                applyConfig(next, true);
              }}
            >
              <div className="jayrr-called-embed__bands jayrr-called-embed__bands--big5">
                {BIG5_BANDS.map((band) => (
                  <span
                    key={band.id}
                    className={`jayrr-called-embed__iq jayrr-called-embed__big5 jayrr-called-embed__big5--${band.id.toLowerCase()}`}
                    title={`${band.id} ${band.name}. ${band.what}`}
                  >
                    {band.id}
                  </span>
                ))}
              </div>
            </JevCardHeader>
          </div>
          <div className="jayrr-called-embed__card">
            <JevCardHeader
              label="Jev MBTI"
              pressed={!!config.jevMbti}
              ariaLabel="Score speech with Jev MBTI"
              container={rootRef.current}
              onToggle={() => {
                const next = { ...config, jevMbti: !config.jevMbti };
                resetIq();
                applyConfig(next, true);
              }}
            >
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
            </JevCardHeader>
          </div>
          <div className="jayrr-called-embed__card">
            <JevCardHeader
              label="Jev Advance"
              pressed={!!config.jevMbtiAdvance}
              ariaLabel="Score speech with advanced MBTI cognitive functions"
              container={rootRef.current}
              onToggle={() => {
                const next = {
                  ...config,
                  jevMbtiAdvance: !config.jevMbtiAdvance,
                };
                resetIq();
                applyConfig(next, true);
              }}
            >
              <div className="jayrr-called-embed__bands jayrr-called-embed__bands--pairs">
                {COG_BANDS.map((fn) => (
                  <span
                    key={fn}
                    className={`jayrr-called-embed__iq jayrr-called-embed__fn jayrr-called-embed__fn--${fn.toLowerCase()}`}
                  >
                    {fn}
                  </span>
                ))}
              </div>
            </JevCardHeader>
          </div>
          <div className="jayrr-called-embed__card">
            <JevCardHeader
              label="Jev Enneagram"
              pressed={!!config.jevEnneagram}
              ariaLabel="Score speech with Enneagram types"
              container={rootRef.current}
              onToggle={() => {
                const next = {
                  ...config,
                  jevEnneagram: !config.jevEnneagram,
                };
                resetIq();
                applyConfig(next, true);
              }}
            >
              <div className="jayrr-called-embed__bands jayrr-called-embed__bands--ennea">
                {ENNEA_BANDS.map((band) => (
                  <span
                    key={band.id}
                    className={`jayrr-called-embed__iq jayrr-called-embed__ennea jayrr-called-embed__ennea--${band.id}`}
                    title={`Type ${band.id} · The ${band.name}`}
                  >
                    {band.id}
                  </span>
                ))}
              </div>
            </JevCardHeader>
          </div>
          <div className="jayrr-called-embed__card">
            <JevCardHeader
              label="Jev Emotion"
              pressed={!!config.jevEmotion}
              ariaLabel="Score speech with Jev Emotion"
              container={rootRef.current}
              onToggle={() => {
                const next = { ...config, jevEmotion: !config.jevEmotion };
                resetIq();
                applyConfig(next, true);
              }}
            >
              <div className="jayrr-called-embed__bands jayrr-called-embed__bands--emotion">
                {EMOTION_BANDS.map((band) => (
                  <span
                    key={band.tone}
                    className={`jayrr-called-embed__emo jayrr-called-embed__emo--${band.tone}`}
                  >
                    {band.label}
                  </span>
                ))}
              </div>
            </JevCardHeader>
          </div>
        </div>
      ) : (
        <>
          {config.contextEnabled ? (
            <ConversationIndicators conversation={conversation} />
          ) : null}
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
                    const smart = turn.isFinal
                      ? smartByTurn.get(turn.id)
                      : live?.smart ?? undefined;
                    const emotions = turn.isFinal
                      ? emotionByTurn.get(turn.id) ?? []
                      : live?.emotion ?? [];
                    const mbti = turn.isFinal
                      ? mbtiByTurn.get(turn.id)
                      : live?.mbti ?? undefined;
                    const advance = turn.isFinal
                      ? advanceByTurn.get(turn.id)
                      : live?.advance ?? undefined;
                    const ennea = turn.isFinal
                      ? enneaByTurn.get(turn.id)
                      : live?.ennea ?? undefined;
                    const hype = turn.isFinal
                      ? hypeByTurn.get(turn.id)
                      : live?.hype ?? undefined;
                    const energy = turn.isFinal
                      ? energyByTurn.get(turn.id)
                      : live?.energy ?? undefined;
                    const online = turn.isFinal
                      ? onlineByTurn.get(turn.id)
                      : live?.online ?? undefined;
                    const socion = turn.isFinal
                      ? socionByTurn.get(turn.id)
                      : live?.socion ?? undefined;
                    const bigFive = turn.isFinal
                      ? bigFiveByTurn.get(turn.id)
                      : live?.bigFive ?? undefined;
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
                          </div>
                        )}
                        <TurnBadges
                          config={config}
                          emotions={emotions}
                          iqScore={iqScore}
                          smart={smart}
                          hype={hype}
                          energy={energy}
                          online={online}
                          socion={socion}
                          bigFive={bigFive}
                          mbti={mbti}
                          advance={advance}
                          ennea={ennea}
                        />
                        <div className="jayrr-called-embed__bubble">
                          {turn.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <aside
              className={
                config.jevMbti ||
                config.jevMbtiAdvance ||
                config.jevEnneagram ||
                config.jevHype ||
                config.jevEnergy ||
                config.jevOnline ||
                config.jevSocion ||
                config.jevBigFive ||
                config.jevSmart
                  ? "jayrr-called-embed__now jayrr-called-embed__now--mbti"
                  : "jayrr-called-embed__now"
              }
            >
              <div className="jayrr-called-embed__now-label">Speaker</div>
              <div className="jayrr-called-embed__now-list">
                {speakers.map((speaker) => {
                  const speakerKey =
                    speaker === null ? "unknown" : String(speaker);
                  const liveNow = liveSpeaker === speaker;
                  const speakerMbti = config.jevMbti
                    ? mbtiBySpeaker.get(speaker)
                    : undefined;
                  const speakerAdvance = config.jevMbtiAdvance
                    ? advanceBySpeaker.get(speaker)
                    : undefined;
                  const speakerEnnea = config.jevEnneagram
                    ? enneaBySpeaker.get(speaker)
                    : undefined;
                  const speakerHype = config.jevHype
                    ? hypeBySpeaker.get(speaker)
                    : undefined;
                  const speakerEnergy = config.jevEnergy
                    ? energyBySpeaker.get(speaker)
                    : undefined;
                  const speakerOnline = config.jevOnline
                    ? onlineBySpeaker.get(speaker)
                    : undefined;
                  const speakerSocion = config.jevSocion
                    ? socionBySpeaker.get(speaker)
                    : undefined;
                  const speakerBigFive = config.jevBigFive
                    ? bigFiveBySpeaker.get(speaker)
                    : undefined;
                  const speakerSmart = config.jevSmart
                    ? smartBySpeaker.get(speaker)
                    : undefined;
                  const nameControl =
                    speaker === null ? (
                      <span
                        className={
                          liveNow
                            ? "jayrr-called-embed__now-name is-live"
                            : "jayrr-called-embed__now-name"
                        }
                        style={speakerHueStyle(speaker, speakers)}
                      >
                        {speakerLabel(speaker, names)}
                      </span>
                    ) : editingSpeaker === speaker ? (
                      <input
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
                    ) : (
                      <button
                        type="button"
                        className={
                          liveNow
                            ? "jayrr-called-embed__now-name is-live"
                            : "jayrr-called-embed__now-name"
                        }
                        style={speakerHueStyle(speaker, speakers)}
                        onClick={() => setEditingSpeaker(speaker)}
                      >
                        {speakerLabel(speaker, names)}
                      </button>
                    );
                  return (
                    <div
                      key={speakerKey}
                      className="jayrr-called-embed__now-row"
                    >
                      {nameControl}
                      {speakerSmart ? (
                        <SmartBadge smart={speakerSmart} />
                      ) : null}
                      {speakerMbti ? <MbtiBadge mbti={speakerMbti} /> : null}
                      {speakerAdvance ? (
                        <AdvanceBadge advance={speakerAdvance} />
                      ) : null}
                      {speakerEnnea ? (
                        <EnneaBadge ennea={speakerEnnea} />
                      ) : null}
                      {speakerHype ? <HypeBadge hype={speakerHype} /> : null}
                      {speakerEnergy ? (
                        <EnergyBadge energy={speakerEnergy} />
                      ) : null}
                      {speakerOnline ? (
                        <OnlineBadge online={speakerOnline} />
                      ) : null}
                      {speakerSocion ? (
                        <SocionBadge socion={speakerSocion} />
                      ) : null}
                      {speakerBigFive ? (
                        <BigFiveBadge bigFive={speakerBigFive} />
                      ) : null}
                    </div>
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
