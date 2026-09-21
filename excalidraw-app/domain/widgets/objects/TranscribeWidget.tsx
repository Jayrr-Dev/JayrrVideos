import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import {
  checkIcon,
  helpIcon,
  settingsIcon,
} from "@excalidraw/excalidraw/components/icons";
import { ContextMenu, Popover, Tooltip } from "radix-ui";
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
import { debugTranscribe } from "../../transcription/debugTranscribe";
import {
  listenStreamTranscript,
  type TranscriptSession,
} from "../../transcription/listenStreamTranscript";
import {
  clearTranscript,
  dropTranscriptTurns,
  publishTranscript,
} from "../../transcription/publishTranscript";
import {
  pruneScoredText,
  retryStaleScore,
} from "../../transcription/scoringQueue";
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
  bigFiveChipLabel,
  bigFiveFromAnswers,
  rankedBigFiveTraits,
  type BigFiveResult,
  type BigFiveTrait,
} from "./jevBigFiveScale";
import {
  EMOTION_BANDS,
  EMOTION_QUESTION,
  averageEmotions,
  emotionLabelsForTone,
  emotionsFromAnswers,
  type EmotionPick,
} from "./jevEmotionScale";
import {
  ENERGY_BANDS,
  ENERGY_QUESTION,
  averageEnergy,
  energyFromAnswers,
  energyGroupIds,
  rankedEnergy,
  type EnergyResult,
} from "./jevEnergyScale";
import {
  ENNEA_BANDS,
  ENNEA_QUESTION,
  averageEnnea,
  enneaFromAnswers,
  rankedEnnea,
  type EnneaResult,
} from "./jevEnneagramScale";
import {
  GENDER_BANDS,
  GENDER_QUESTION,
  averageGender,
  genderFromAnswers,
  rankedGender,
  type GenderStyleResult,
} from "./jevGenderStyleScale";
import {
  HOUSE_BANDS,
  HOUSE_QUESTION,
  averageHouse,
  houseFromAnswers,
  rankedHouse,
  type HouseResult,
} from "./jevHogwartsScale";
import {
  HYPE_BANDS,
  HYPE_QUESTION,
  averageHype,
  hypeFromAnswers,
  rankedHype,
  type HypeResult,
} from "./jevHypeScale";
import {
  IQ_BANDS,
  IQ_QUESTIONS,
  averageIqComposite,
  buildIqState,
  compositeFromAnswers,
  iqFromComposite,
  iqWhat,
  rankedIqComposites,
  shadeFromComposite,
  type IqResult,
  type IqShade,
} from "./jevIqScale";
import {
  COG_BANDS,
  COG_QUESTION,
  advanceFromAnswers,
  averageAdvance,
  cogWhat,
  rankedAdvanceFns,
  type CogFn,
  type MbtiAdvanceResult,
} from "./jevMbtiAdvanceScale";
import {
  MBTI_BANDS,
  MBTI_PAIRS,
  MBTI_QUESTIONS,
  averageMbti,
  mbtiFromAnswers,
  mbtiTypeWhat,
  rankedMbti,
  type MbtiResult,
} from "./jevMbtiScale";
import {
  ONLINE_BANDS,
  ONLINE_QUESTION,
  averageOnline,
  onlineFromAnswers,
  rankedOnline,
  type OnlineResult,
} from "./jevOnlineScale";
import {
  SMART_BANDS,
  SMART_QUESTION,
  averageSmart,
  rankedSmart,
  smartFromAnswers,
  type SmartResult,
} from "./jevSmartScale";
import {
  SOCION_BANDS,
  SOCION_QUESTION,
  averageSocion,
  rankedSocion,
  socionFromAnswers,
  type SocionResult,
} from "./jevSocionScale";
import {
  TRUTH_BANDS,
  TRUTH_QUESTION,
  averageTruth,
  rankedTruth,
  truthFromAnswers,
  type TruthResult,
} from "./jevTruthScale";
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
  adoptLiveScore,
  attributeSpeakerScores,
  averagesBySpeaker,
  clearAverageCache,
  emptyAverageCache,
  lockFinalScore,
  mapSpeakersByTurn,
} from "./speakerScoreCache";
import {
  DEFAULT_JEV_SHOW,
  DEFAULT_TRANSCRIBE,
  JEV_TOP_OPTIONS,
  jevScoreVisible,
  jevShowScoreOn,
  jevShowWhere,
  jevTopCount,
  readTranscribeConfig,
  writeTranscribeConfig,
  type JevShowKey,
  type JevShowWhere,
  type JevTopKey,
  type TranscribeConfig,
} from "./transcribeConfig";

const JEV_SHOW_OPTIONS: { id: JevShowWhere; label: string }[] = [
  { id: "line", label: "Line" },
  { id: "speaker", label: "Speaker" },
  { id: "both", label: "Both" },
];

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
  emotion?: EmotionPick[];
  mbti: MbtiResult | null;
  advance: MbtiAdvanceResult | null;
  ennea: EnneaResult | null;
  house: HouseResult | null;
  gender: GenderStyleResult | null;
  hype: HypeResult | null;
  energy: EnergyResult | null;
  online: OnlineResult | null;
  socion: SocionResult | null;
  bigFive: BigFiveResult | null;
  truth: TruthResult | null;
};

const jevScoringOn = (config: TranscribeConfig) =>
  !!config.contextEnabled ||
  config.jevIq ||
  config.jevSmart ||
  config.jevMbti ||
  config.jevMbtiAdvance ||
  config.jevEnneagram ||
  config.jevHogwarts ||
  config.jevGenderStyle ||
  config.jevHype ||
  config.jevEnergy ||
  config.jevOnline ||
  config.jevSocion ||
  config.jevBigFive ||
  config.jevEmotion ||
  config.jevTruth;

const questionsForConfig = (config: TranscribeConfig) => {
  const questions: Array<
    | typeof IQ_QUESTIONS[number]
    | typeof SMART_QUESTION
    | typeof EMOTION_QUESTION
    | typeof MBTI_QUESTIONS[number]
    | typeof COG_QUESTION
    | typeof ENNEA_QUESTION
    | typeof HOUSE_QUESTION
    | typeof GENDER_QUESTION
    | typeof HYPE_QUESTION
    | typeof ENERGY_QUESTION
    | typeof ONLINE_QUESTION
    | typeof SOCION_QUESTION
    | typeof BIG5_QUESTIONS[number]
    | typeof TRUTH_QUESTION
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
  if (config.jevHogwarts) {
    questions.push(HOUSE_QUESTION);
  }
  if (config.jevGenderStyle) {
    questions.push(GENDER_QUESTION);
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
  if (config.jevTruth) {
    questions.push(TRUTH_QUESTION);
  }
  return questions;
};

type Job = {
  staleRetries?: number;
  turnId: string;
  speaker: number | null;
  text: string;
  /** Recent talk before this bubble, so fragments keep conversational tone. */
  previousTurn: string | null;
  speakerRecent: string | null;
  recentTurns: string | null;
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

const sameChatTurns = (left: ChatTurn[], right: ChatTurn[]) =>
  left.length === right.length &&
  left.every((turn, index) => {
    const other = right[index];
    return (
      !!other &&
      turn.id === other.id &&
      turn.speaker === other.speaker &&
      turn.text === other.text &&
      turn.isFinal === other.isFinal
    );
  });

const withLiveIds = (
  current: ChatTurn[],
  incoming: TranscriptTurn[],
  isFinal: boolean,
): ChatTurn[] => {
  const leftover = current.filter((turn) => !turn.isFinal);
  const idsBySpeaker = new Map<string, string[]>();
  for (const turn of leftover) {
    const key = String(turn.speaker);
    const ids = idsBySpeaker.get(key) ?? [];
    ids.push(turn.id);
    idsBySpeaker.set(key, ids);
  }
  return incoming.map((turn) => {
    const ids = idsBySpeaker.get(String(turn.speaker));
    return {
      ...turn,
      id: ids?.shift() ?? nextTurnId(),
      isFinal,
    };
  });
};

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

const foldIncomingTurns = (
  current: ChatTurn[],
  attributed: TranscriptTurn[],
  isFinal: boolean,
) => {
  const kept = current.filter((turn) => turn.isFinal);
  const incoming = withLiveIds(current, attributed, isFinal);
  const incomingIds = incoming.map((turn) => turn.id);
  const packed = mergeChatTurns(incoming);
  const last = kept[kept.length - 1];
  const first = packed[0] ?? null;
  if (last && first && shouldJoin(last, first)) {
    const joined = asBubbles(last, joinSentences(last.text, first.text), true);
    const nextTurns = [
      ...kept.slice(0, -1),
      ...joined,
      ...packed.slice(1),
    ].slice(-80);
    if (sameChatTurns(current, nextTurns)) {
      return {
        turns: current,
        incomingIds,
        skipped: true,
        adopted: null,
      };
    }
    return {
      turns: nextTurns,
      incomingIds,
      skipped: false,
      adopted: isFinal ? joined[0] ?? first : null,
    };
  }
  const nextTurns = [...kept, ...packed].slice(-80);
  if (sameChatTurns(current, nextTurns)) {
    return {
      turns: current,
      incomingIds,
      skipped: true,
      adopted: null,
    };
  }
  return {
    turns: nextTurns,
    incomingIds,
    skipped: false,
    adopted: isFinal ? first : null,
  };
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
  const labeled = list.filter((speaker): speaker is number => speaker !== null);
  return labeled.length > 0 ? labeled : list;
};

const countSpokenWords = (text: string) => {
  const matches = text.trim().match(/\S+/g);
  return matches?.length ?? 0;
};

const spokenWordsBySpeaker = (turns: readonly ChatTurn[]) => {
  const totals = new Map<string, number>();
  for (const turn of turns) {
    const key = turn.speaker === null ? "unknown" : String(turn.speaker);
    totals.set(key, (totals.get(key) ?? 0) + countSpokenWords(turn.text));
  }
  return totals;
};

const numberedSpeakers = (turns: ChatTurn[]) =>
  uniqueSpeakers(turns).filter(
    (speaker): speaker is number => speaker !== null,
  );

const nextSpeakerId = (turns: ChatTurn[], names: Record<number, string>) => {
  let max = -1;
  for (const turn of turns) {
    if (turn.speaker !== null && turn.speaker > max) {
      max = turn.speaker;
    }
  }
  for (const key of Object.keys(names)) {
    const id = Number(key);
    if (Number.isFinite(id) && id > max) {
      max = id;
    }
  }
  return max + 1;
};

const TranscriptTurnMenu = ({
  turn,
  speakers,
  names,
  container,
  onAssign,
  onNewSpeaker,
  onDelete,
  children,
}: {
  turn: ChatTurn;
  speakers: number[];
  names: Record<number, string>;
  container: HTMLElement | undefined;
  onAssign: (speaker: number) => void;
  onNewSpeaker: () => void;
  onDelete: () => void;
  children: ReactNode;
}) => (
  <ContextMenu.Root modal={false}>
    <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
    <ContextMenu.Portal container={container}>
      <ContextMenu.Content
        className="jayrr-editor-menu"
        collisionPadding={8}
        data-prevent-outside-click
      >
        {speakers.map((speaker) => {
          const selected = turn.speaker === speaker;
          return (
            <ContextMenu.Item
              key={speaker}
              className={
                selected
                  ? "jayrr-editor-menu__item is-active"
                  : "jayrr-editor-menu__item"
              }
              onSelect={() => onAssign(speaker)}
            >
              <span>{speakerLabel(speaker, names)}</span>
              <span className="jayrr-editor-menu__check" aria-hidden>
                {selected ? checkIcon : null}
              </span>
            </ContextMenu.Item>
          );
        })}
        <ContextMenu.Item
          className="jayrr-editor-menu__item"
          onSelect={onNewSpeaker}
        >
          New speaker
        </ContextMenu.Item>
        <ContextMenu.Separator className="jayrr-editor-menu__separator" />
        <ContextMenu.Item
          className="jayrr-editor-menu__item jayrr-editor-menu__item--danger"
          onSelect={onDelete}
        >
          Delete message
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Portal>
  </ContextMenu.Root>
);

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

const formatContextTurn = (turn: ChatTurn) => {
  const text = turn.text.trim();
  if (!text) {
    return "";
  }
  const speaker = turn.speaker === null ? "unknown" : String(turn.speaker);
  return `[speaker ${speaker}] ${text}`;
};

const recentTurnsText = (turns: ChatTurn[], index: number) => {
  const start = Math.max(0, index - CONTEXT_TURNS);
  const parts: string[] = [];
  for (let cursor = start; cursor < index; cursor += 1) {
    const line = turns[cursor] ? formatContextTurn(turns[cursor]) : "";
    if (line) {
      parts.push(line);
    }
  }
  if (parts.length === 0) {
    return null;
  }
  return parts.join("\n");
};

const speakerRecentText = (
  turns: ChatTurn[],
  index: number,
  speaker: number | null,
) => {
  const start = Math.max(0, index - CONTEXT_TURNS);
  const parts: string[] = [];
  for (let cursor = start; cursor < index; cursor += 1) {
    const turn = turns[cursor];
    if (!turn || turn.speaker !== speaker) {
      continue;
    }
    const line = formatContextTurn(turn);
    if (line) {
      parts.push(line);
    }
  }
  if (parts.length === 0) {
    return null;
  }
  return parts.join("\n");
};

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

const JevTip = ({
  title,
  body,
  children,
}: {
  title: string;
  body?: ReactNode;
  children: React.ReactElement;
}) => (
  <Tooltip.Root>
    <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content
        side="top"
        sideOffset={6}
        collisionPadding={8}
        className="jayrr-called-embed__tip"
      >
        <p className="jayrr-called-embed__tip-lead">{title}</p>
        {body ? (
          <div className="jayrr-called-embed__tip-body">{body}</div>
        ) : null}
        <Tooltip.Arrow
          width={10}
          height={5}
          className="jayrr-called-embed__tip-arrow"
        />
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
);

const jevScoreMark = (show: boolean, value?: number) => {
  if (!show || typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }
  return ` ${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
};

const percentText = (value: number) =>
  `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;

type JevTipRow = { key: string; label: string; mark?: string };

const jevTipBody = (
  definition?: ReactNode,
  rows?: readonly JevTipRow[],
): ReactNode => {
  const list = rows?.filter((row) => row.label) ?? [];
  if (!definition && list.length === 0) {
    return undefined;
  }
  return (
    <>
      {typeof definition === "string" ? <p>{definition}</p> : definition}
      {list.length > 0 ? (
        <ul>
          {list.map((row) => (
            <li key={row.key}>
              {row.label}
              {row.mark ? ` ${row.mark}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
};

const probabilityRows = (
  entries: readonly (readonly [string, number])[],
  labelFor: (id: string) => string,
): JevTipRow[] =>
  entries
    .filter(([, value]) => value > 0.04)
    .sort((left, right) => right[1] - left[1])
    .map(([id, value]) => ({
      key: id,
      label: labelFor(id),
      mark: percentText(value),
    }));

const JevSwitch = ({
  pressed,
  ariaLabel,
  onToggle,
}: {
  pressed: boolean;
  ariaLabel: string;
  onToggle: () => void;
}) => (
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
);

const JevCardHeader = ({
  label,
  pressed,
  ariaLabel,
  onToggle,
  showWhere,
  onShowWhere,
  showScore,
  onShowScore,
  classCount,
  onClassCount,
  container,
  children,
}: {
  label: string;
  pressed: boolean;
  ariaLabel: string;
  onToggle: () => void;
  showWhere?: JevShowWhere;
  onShowWhere?: (next: JevShowWhere) => void;
  showScore?: boolean;
  onShowScore?: (next: boolean) => void;
  classCount?: number;
  onClassCount?: (next: number) => void;
  container: HTMLElement | null;
  children: ReactNode;
}) => {
  const hasSettings = Boolean(onShowScore || onClassCount || onShowWhere);
  return (
    <div className="jayrr-called-embed__card-body">
      <div className="jayrr-called-embed__card-head">
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
              side="left"
              align="start"
              sideOffset={8}
              collisionPadding={8}
              className="jayrr-called-embed__legend"
            >
              <p className="jayrr-called-embed__legend-title">{label}</p>
              {children}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <div className="jayrr-called-embed__title-lead">
          <div className="jayrr-called-embed__label">{label}</div>
        </div>
        <div className="jayrr-called-embed__title-actions">
          {hasSettings ? (
            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="jayrr-called-embed__info"
                  aria-label={`${label} settings`}
                >
                  {settingsIcon}
                </button>
              </Popover.Trigger>
              <Popover.Portal container={container ?? undefined}>
                <Popover.Content
                  side="bottom"
                  align="end"
                  sideOffset={6}
                  collisionPadding={8}
                  className="jayrr-called-embed__settings"
                  onFocusOutside={(event) => event.preventDefault()}
                >
                  {onShowScore ? (
                    <div className="jayrr-called-embed__switch-row">
                      <span>Score</span>
                      <JevSwitch
                        pressed={!!showScore}
                        ariaLabel={`Show ${label} score`}
                        onToggle={() => onShowScore(!showScore)}
                      />
                    </div>
                  ) : null}
                  {onClassCount || onShowWhere ? (
                    <div className="jayrr-called-embed__card-tools">
                      {onClassCount ? (
                        <select
                          className="jayrr-called-embed__select jayrr-called-embed__select--top"
                          value={classCount ?? 1}
                          aria-label={`How many ${label} classes show`}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            if (
                              JEV_TOP_OPTIONS.some((option) => option === next)
                            ) {
                              onClassCount(next);
                            }
                          }}
                        >
                          {JEV_TOP_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      {onShowWhere ? (
                        <select
                          className="jayrr-called-embed__select jayrr-called-embed__select--show"
                          value={showWhere ?? DEFAULT_JEV_SHOW}
                          aria-label={`Where ${label} classes show`}
                          onChange={(event) => {
                            const next = event.target.value;
                            if (
                              next === "line" ||
                              next === "speaker" ||
                              next === "both"
                            ) {
                              onShowWhere(next);
                            }
                          }}
                        >
                          {JEV_SHOW_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  ) : null}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          ) : null}
          <input
            type="checkbox"
            className="jayrr-called-embed__active"
            checked={pressed}
            aria-label={ariaLabel}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={onToggle}
          />
        </div>
      </div>
    </div>
  );
};

const IqBadge = ({
  composite,
  showScore,
  confidence,
}: {
  composite: number;
  showScore?: boolean;
  confidence?: number;
}) => {
  const shade: IqShade = shadeFromComposite(composite);
  return (
    <JevTip
      title={`Verbal IQ ${iqFromComposite(composite)}`}
      body={iqWhat(composite)}
    >
      <span
        className={`jayrr-called-embed__iq jayrr-called-embed__iq--${shade}`}
      >
        IQ {iqFromComposite(composite)}
        {jevScoreMark(!!showScore, confidence)}
      </span>
    </JevTip>
  );
};

const SmartBadge = ({
  smart,
  showScore,
}: {
  smart: SmartResult;
  showScore?: boolean;
}) => {
  const band = SMART_BANDS.find((row) => row.id === smart.id);
  return (
    <JevTip
      title={band ? band.label : smart.label}
      body={band ? band.what : undefined}
    >
      <span
        className={`jayrr-called-embed__iq jayrr-called-embed__smart jayrr-called-embed__smart--${smart.id}`}
      >
        {smart.label}
        {jevScoreMark(!!showScore, smart.confidence)}
      </span>
    </JevTip>
  );
};

const EmotionBadge = ({
  emotion,
  showScore,
  all,
}: {
  emotion: EmotionPick;
  showScore?: boolean;
  all?: readonly EmotionPick[];
}) => (
  <JevTip
    title={`${emotion.label} · ${emotion.cluster}`}
    body={jevTipBody(
      EMOTION_BANDS.find((band) => band.tone === emotion.tone)?.what ??
        emotion.cluster,
      (all ?? [emotion]).map((row) => ({
        key: row.id,
        label: row.label,
        mark: percentText(row.confidence),
      })),
    )}
  >
    <span
      className={`jayrr-called-embed__emo jayrr-called-embed__emo--${emotion.tone}`}
    >
      {emotion.label}
      {jevScoreMark(!!showScore, emotion.confidence)}
    </span>
  </JevTip>
);

const MbtiBadge = ({
  mbti,
  showScore,
}: {
  mbti: MbtiResult;
  showScore?: boolean;
}) => (
  <JevTip
    title={`MBTI ${mbti.type}`}
    body={jevTipBody(
      mbtiTypeWhat(mbti.type),
      MBTI_PAIRS.map((pair) => {
        const score = mbti.pairs[pair.id];
        return {
          key: pair.id,
          label: `${pair.left}/${pair.right}`,
          mark: `${percentText(score?.left ?? 0)} · ${percentText(
            score?.right ?? 0,
          )}`,
        };
      }),
    )}
  >
    <span className="jayrr-called-embed__iq jayrr-called-embed__mbti">
      {mbti.type}
      {jevScoreMark(!!showScore, mbti.confidence)}
    </span>
  </JevTip>
);

const CogBadge = ({
  fn,
  showScore,
  confidence,
  all,
}: {
  fn: CogFn;
  showScore?: boolean;
  confidence?: number;
  all?: MbtiAdvanceResult;
}) => (
  <JevTip
    title={fn}
    body={jevTipBody(
      cogWhat(fn),
      all
        ? probabilityRows(
            COG_BANDS.map((id) => [id, all.probabilities[id] ?? 0]),
            (id) => id,
          )
        : undefined,
    )}
  >
    <span
      className={`jayrr-called-embed__iq jayrr-called-embed__fn jayrr-called-embed__fn--${fn.toLowerCase()}`}
    >
      {fn}
      {jevScoreMark(!!showScore, confidence)}
    </span>
  </JevTip>
);

const EnneaBadge = ({
  ennea,
  showScore,
}: {
  ennea: EnneaResult;
  showScore?: boolean;
}) => (
  <JevTip
    title={`Type ${ennea.id} · The ${ennea.name}`}
    body={jevTipBody(
      ennea.what,
      probabilityRows(
        ENNEA_BANDS.map((band) => [band.id, ennea.probabilities[band.id] ?? 0]),
        (id) => {
          const band = ENNEA_BANDS.find((row) => row.id === id);
          return band ? `${band.id} ${band.name}` : id;
        },
      ),
    )}
  >
    <span
      className={`jayrr-called-embed__iq jayrr-called-embed__ennea jayrr-called-embed__ennea--${ennea.id}`}
    >
      {ennea.label}
      {jevScoreMark(!!showScore, ennea.confidence)}
    </span>
  </JevTip>
);

const HouseBadge = ({
  house,
  showScore,
}: {
  house: HouseResult;
  showScore?: boolean;
}) => (
  <JevTip
    title={house.name}
    body={jevTipBody(
      house.what,
      probabilityRows(
        HOUSE_BANDS.map((band) => [band.id, house.probabilities[band.id] ?? 0]),
        (id) => HOUSE_BANDS.find((row) => row.id === id)?.name ?? id,
      ),
    )}
  >
    <span
      className={`jayrr-called-embed__iq jayrr-called-embed__house jayrr-called-embed__house--${house.id}`}
    >
      {house.label}
      {jevScoreMark(!!showScore, house.confidence)}
    </span>
  </JevTip>
);

const GenderBadge = ({
  gender,
  showScore,
}: {
  gender: GenderStyleResult;
  showScore?: boolean;
}) => (
  <JevTip
    title={gender.name}
    body={jevTipBody(
      gender.what,
      probabilityRows(
        GENDER_BANDS.map((band) => [
          band.id,
          gender.probabilities[band.id] ?? 0,
        ]),
        (id) => GENDER_BANDS.find((row) => row.id === id)?.name ?? id,
      ),
    )}
  >
    <span
      className={`jayrr-called-embed__iq jayrr-called-embed__gender jayrr-called-embed__gender--${gender.id}`}
    >
      {gender.label}
      {jevScoreMark(!!showScore, gender.confidence)}
    </span>
  </JevTip>
);

const HypeBadge = ({
  hype,
  showScore,
}: {
  hype: HypeResult;
  showScore?: boolean;
}) => {
  const band = HYPE_BANDS.find((row) => row.id === hype.id);
  return (
    <JevTip
      title={band ? band.label : hype.label}
      body={band ? band.what : undefined}
    >
      <span
        className={`jayrr-called-embed__iq jayrr-called-embed__hype jayrr-called-embed__hype--${hype.id}`}
      >
        {hype.label}
        {jevScoreMark(!!showScore, hype.confidence)}
      </span>
    </JevTip>
  );
};

const EnergyBadge = ({
  energy,
  showScore,
}: {
  energy: EnergyResult;
  showScore?: boolean;
}) => {
  const band = ENERGY_BANDS.find((row) => row.id === energy.id);
  return (
    <JevTip
      title={
        band ? `${band.level} ${band.name}` : `${energy.label} ${energy.name}`
      }
      body={jevTipBody(
        band?.what,
        energyGroupIds(energy.id).map((id) => {
          const sibling = ENERGY_BANDS.find((row) => row.id === id);
          return {
            key: id,
            label: sibling ? `${sibling.level} ${sibling.name}` : id,
          };
        }),
      )}
    >
      <span
        className={`jayrr-called-embed__iq jayrr-called-embed__energy jayrr-called-embed__energy--${energy.zone} jayrr-called-embed__energy--${energy.id}`}
      >
        {energy.label}
        {jevScoreMark(!!showScore, energy.confidence)}
      </span>
    </JevTip>
  );
};

const OnlineBadge = ({
  online,
  showScore,
}: {
  online: OnlineResult;
  showScore?: boolean;
}) => {
  const band = ONLINE_BANDS.find((row) => row.id === online.id);
  return (
    <JevTip
      title={band ? band.label : online.label}
      body={
        band ? (
          <>
            <p>{band.what}</p>
            <p>Example: {band.example}</p>
          </>
        ) : undefined
      }
    >
      <span
        className={`jayrr-called-embed__iq jayrr-called-embed__online jayrr-called-embed__online--${online.id}`}
      >
        {online.label}
        {jevScoreMark(!!showScore, online.confidence)}
      </span>
    </JevTip>
  );
};

const TruthBadge = ({
  truth,
  showScore,
}: {
  truth: TruthResult;
  showScore?: boolean;
}) => {
  const band = TRUTH_BANDS.find((row) => row.id === truth.id);
  return (
    <JevTip
      title={band ? band.label : truth.label}
      body={
        band ? (
          <>
            <p>{band.what}</p>
            <p>Example: {band.example}</p>
          </>
        ) : undefined
      }
    >
      <span
        className={`jayrr-called-embed__iq jayrr-called-embed__truth jayrr-called-embed__truth--${truth.id}`}
      >
        {truth.label}
        {jevScoreMark(!!showScore, truth.confidence)}
      </span>
    </JevTip>
  );
};

const SocionBadge = ({
  socion,
  showScore,
}: {
  socion: SocionResult;
  showScore?: boolean;
}) => (
  <JevTip
    title={`${socion.id} ${socion.code4} · ${socion.nick} · ${socion.ego}`}
    body={jevTipBody(
      socion.what,
      probabilityRows(
        SOCION_BANDS.map((band) => [
          band.id,
          socion.probabilities[band.id] ?? 0,
        ]),
        (id) => {
          const band = SOCION_BANDS.find((row) => row.id === id);
          return band ? `${band.id} ${band.code4}` : id;
        },
      ),
    )}
  >
    <span
      className={`jayrr-called-embed__iq jayrr-called-embed__socion jayrr-called-embed__socion--${
        socion.quadra
      } jayrr-called-embed__socion--${socion.id.toLowerCase()}`}
    >
      {socion.label}
      {jevScoreMark(!!showScore, socion.confidence)}
    </span>
  </JevTip>
);

const bigFiveTraitRows = (bigFive: BigFiveResult): JevTipRow[] =>
  BIG5_BANDS.map((band) => {
    const row = bigFive.traits[band.id];
    return {
      key: band.id,
      label: band.name,
      mark: row.level,
    };
  });

const BigFiveBadge = ({
  bigFive,
  showScore,
}: {
  bigFive: BigFiveResult;
  showScore?: boolean;
}) => (
  <JevTip
    title={bigFive.label}
    body={jevTipBody(undefined, bigFiveTraitRows(bigFive))}
  >
    <span className="jayrr-called-embed__iq jayrr-called-embed__big5">
      {bigFive.label}
      {jevScoreMark(!!showScore, bigFive.confidence)}
    </span>
  </JevTip>
);

const BigFiveTraitBadge = ({
  trait,
  showScore,
  all,
}: {
  trait: BigFiveTrait;
  showScore?: boolean;
  all?: BigFiveResult;
}) => (
  <JevTip
    title={`${trait.name}: ${trait.level}`}
    body={jevTipBody(
      BIG5_BANDS.find((band) => band.id === trait.id)?.what,
      all ? bigFiveTraitRows(all) : undefined,
    )}
  >
    <span
      className={`jayrr-called-embed__iq jayrr-called-embed__big5 jayrr-called-embed__big5--${trait.id.toLowerCase()}`}
    >
      {bigFiveChipLabel(trait)}
      {jevScoreMark(!!showScore, trait.confidence)}
    </span>
  </JevTip>
);

const bigFiveBadges = (
  bigFive: BigFiveResult,
  count: number,
  showScore: boolean,
) =>
  count <= 1
    ? [<BigFiveBadge key="all" bigFive={bigFive} showScore={showScore} />]
    : rankedBigFiveTraits(bigFive, count).map((trait) => (
        <BigFiveTraitBadge
          key={trait.id}
          trait={trait}
          showScore={showScore}
          all={bigFive}
        />
      ));

const TurnBadges = ({
  config,
  emotions,
  iqScore,
  iqConfidence,
  smart,
  hype,
  energy,
  online,
  socion,
  bigFive,
  truth,
  mbti,
  advance,
  ennea,
  house,
  gender,
}: {
  config: TranscribeConfig;
  emotions: EmotionPick[];
  iqScore?: number;
  iqConfidence?: number;
  smart?: SmartResult;
  hype?: HypeResult;
  energy?: EnergyResult;
  online?: OnlineResult;
  socion?: SocionResult;
  bigFive?: BigFiveResult;
  truth?: TruthResult;
  mbti?: MbtiResult;
  advance?: MbtiAdvanceResult;
  ennea?: EnneaResult;
  house?: HouseResult;
  gender?: GenderStyleResult;
}) => {
  if (!jevScoringOn(config)) {
    return null;
  }
  return (
    <div className="jayrr-called-embed__who-badges">
      {jevScoreVisible(config, config.jevEmotion, "emotion", "line")
        ? emotions
            .slice(0, jevTopCount(config, "emotion"))
            .map((emotion) => (
              <EmotionBadge
                key={emotion.id}
                emotion={emotion}
                showScore={jevShowScoreOn(config, "emotion")}
                all={emotions}
              />
            ))
        : null}
      {jevScoreVisible(config, config.jevIq, "iq", "line")
        ? iqScore === undefined
          ? null
          : rankedIqComposites(iqScore, jevTopCount(config, "iq")).map(
              (composite) => (
                <IqBadge
                  key={composite}
                  composite={composite}
                  showScore={jevShowScoreOn(config, "iq")}
                  confidence={iqConfidence}
                />
              ),
            )
        : null}
      {jevScoreVisible(config, config.jevSmart, "smart", "line")
        ? smart
          ? rankedSmart(smart, jevTopCount(config, "smart")).map((row) => (
              <SmartBadge
                key={row.id}
                smart={row}
                showScore={jevShowScoreOn(config, "smart")}
              />
            ))
          : null
        : null}
      {jevScoreVisible(config, config.jevHype, "hype", "line")
        ? hype
          ? rankedHype(hype, jevTopCount(config, "hype")).map((row) => (
              <HypeBadge
                key={row.id}
                hype={row}
                showScore={jevShowScoreOn(config, "hype")}
              />
            ))
          : null
        : null}
      {jevScoreVisible(config, config.jevEnergy, "energy", "line")
        ? energy
          ? rankedEnergy(energy, jevTopCount(config, "energy")).map((row) => (
              <EnergyBadge
                key={row.id}
                energy={row}
                showScore={jevShowScoreOn(config, "energy")}
              />
            ))
          : null
        : null}
      {jevScoreVisible(config, config.jevOnline, "online", "line")
        ? online
          ? rankedOnline(online, jevTopCount(config, "online")).map((row) => (
              <OnlineBadge
                key={row.id}
                online={row}
                showScore={jevShowScoreOn(config, "online")}
              />
            ))
          : null
        : null}
      {jevScoreVisible(config, config.jevSocion, "socion", "line")
        ? socion
          ? rankedSocion(socion, jevTopCount(config, "socion")).map((row) => (
              <SocionBadge
                key={row.id}
                socion={row}
                showScore={jevShowScoreOn(config, "socion")}
              />
            ))
          : null
        : null}
      {jevScoreVisible(config, config.jevBigFive, "bigFive", "line")
        ? bigFive
          ? bigFiveBadges(
              bigFive,
              jevTopCount(config, "bigFive"),
              jevShowScoreOn(config, "bigFive"),
            )
          : null
        : null}
      {jevScoreVisible(config, config.jevTruth, "truth", "line")
        ? truth
          ? rankedTruth(truth, jevTopCount(config, "truth")).map((row) => (
              <TruthBadge
                key={row.id}
                truth={row}
                showScore={jevShowScoreOn(config, "truth")}
              />
            ))
          : null
        : null}
      {jevScoreVisible(config, config.jevMbti, "mbti", "line")
        ? mbti
          ? rankedMbti(mbti, jevTopCount(config, "mbti")).map((row) => (
              <MbtiBadge
                key={row.type}
                mbti={row}
                showScore={jevShowScoreOn(config, "mbti")}
              />
            ))
          : null
        : null}
      {jevScoreVisible(config, config.jevMbtiAdvance, "mbtiAdvance", "line")
        ? advance
          ? rankedAdvanceFns(advance, jevTopCount(config, "mbtiAdvance")).map(
              (fn) => (
                <CogBadge
                  key={fn}
                  fn={fn}
                  showScore={jevShowScoreOn(config, "mbtiAdvance")}
                  confidence={advance.probabilities[fn]}
                  all={advance}
                />
              ),
            )
          : null
        : null}
      {jevScoreVisible(config, config.jevEnneagram, "enneagram", "line")
        ? ennea
          ? rankedEnnea(ennea, jevTopCount(config, "enneagram")).map((row) => (
              <EnneaBadge
                key={row.id}
                ennea={row}
                showScore={jevShowScoreOn(config, "enneagram")}
              />
            ))
          : null
        : null}
      {jevScoreVisible(config, config.jevHogwarts, "hogwarts", "line")
        ? house
          ? rankedHouse(house, jevTopCount(config, "hogwarts")).map((row) => (
              <HouseBadge
                key={row.id}
                house={row}
                showScore={jevShowScoreOn(config, "hogwarts")}
              />
            ))
          : null
        : null}
      {jevScoreVisible(config, config.jevGenderStyle, "genderStyle", "line")
        ? gender
          ? rankedGender(gender, jevTopCount(config, "genderStyle")).map(
              (row) => (
                <GenderBadge
                  key={row.id}
                  gender={row}
                  showScore={jevShowScoreOn(config, "genderStyle")}
                />
              ),
            )
          : null
        : null}
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
  const skipLiveRef = useRef(false);
  const liveSpeakerPinRef = useRef<number | null>(null);
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
  const namesRef = useRef(names);
  namesRef.current = names;
  const speakerByTurn = useMemo(() => mapSpeakersByTurn(turns), [turns]);
  const speakerScores = useMemo(
    () => attributeSpeakerScores(scores, speakerByTurn, null),
    [scores, speakerByTurn],
  );
  const speakerAverageCache = useMemo(
    () => ({
      iq: emptyAverageCache<
        IqResult,
        { composite: number; confidence: number }
      >(),
      emotion: emptyAverageCache<EmotionPick[], EmotionPick[]>(),
      mbti: emptyAverageCache<MbtiResult, MbtiResult>(),
      advance: emptyAverageCache<MbtiAdvanceResult, MbtiAdvanceResult>(),
      ennea: emptyAverageCache<EnneaResult, EnneaResult>(),
      house: emptyAverageCache<HouseResult, HouseResult>(),
      gender: emptyAverageCache<GenderStyleResult, GenderStyleResult>(),
      smart: emptyAverageCache<SmartResult, SmartResult>(),
      hype: emptyAverageCache<HypeResult, HypeResult>(),
      energy: emptyAverageCache<EnergyResult, EnergyResult>(),
      online: emptyAverageCache<OnlineResult, OnlineResult>(),
      socion: emptyAverageCache<SocionResult, SocionResult>(),
      bigFive: emptyAverageCache<BigFiveResult, BigFiveResult>(),
      truth: emptyAverageCache<TruthResult, TruthResult>(),
    }),
    [],
  );

  const configRef = useRef(config);
  configRef.current = config;
  const queueRef = useRef<Job[]>([]);
  const liveJobRef = useRef<Job | null>(null);
  const runningRef = useRef(false);
  const inFlightRef = useRef<Job | null>(null);
  const generationRef = useRef(0);
  const scoredTextRef = useRef(new Map<string, string>());
  const liveRef = useRef(live);
  liveRef.current = live;

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
      const healed: TranscribeConfig = {
        ...DEFAULT_TRANSCRIBE,
        ...next,
        jevShow: next.jevShow ?? {},
        jevShowScore: next.jevShowScore ?? {},
        jevTop: next.jevTop ?? {},
      };
      setConfig(healed);
      if (save) {
        persist(healed);
      }
    },
    [persist],
  );

  const setJevShow = (key: JevShowKey, where: JevShowWhere) => {
    applyConfig(
      {
        ...config,
        jevShow: { ...config.jevShow, [key]: where },
      },
      true,
    );
  };

  const setJevShowScore = (key: JevShowKey, on: boolean) => {
    applyConfig(
      {
        ...config,
        jevShowScore: { ...config.jevShowScore, [key]: on },
      },
      true,
    );
  };

  const setJevTop = (key: JevTopKey, count: number) => {
    applyConfig(
      {
        ...config,
        jevTop: { ...config.jevTop, [key]: count },
      },
      true,
    );
  };

  const resetIq = useCallback(() => {
    generationRef.current += 1;
    queueRef.current = [];
    liveJobRef.current = null;
    scoredTextRef.current.clear();
    debugTranscribe("score reset", { generation: generationRef.current });
    liveRef.current = null;
    clearAverageCache(speakerAverageCache.iq);
    clearAverageCache(speakerAverageCache.emotion);
    clearAverageCache(speakerAverageCache.mbti);
    clearAverageCache(speakerAverageCache.advance);
    clearAverageCache(speakerAverageCache.ennea);
    clearAverageCache(speakerAverageCache.house);
    clearAverageCache(speakerAverageCache.gender);
    clearAverageCache(speakerAverageCache.smart);
    clearAverageCache(speakerAverageCache.hype);
    clearAverageCache(speakerAverageCache.energy);
    clearAverageCache(speakerAverageCache.online);
    clearAverageCache(speakerAverageCache.socion);
    clearAverageCache(speakerAverageCache.bigFive);
    clearAverageCache(speakerAverageCache.truth);
    setScores([]);
    setLive(null);
  }, [speakerAverageCache]);

  useEffect(() => {
    resetIq();
  }, [
    config.contextEnabled,
    config.jevIq,
    config.jevSmart,
    config.jevMbti,
    config.jevMbtiAdvance,
    config.jevEnneagram,
    config.jevHogwarts,
    config.jevGenderStyle,
    config.jevHype,
    config.jevEnergy,
    config.jevOnline,
    config.jevSocion,
    config.jevBigFive,
    config.jevEmotion,
    config.jevTruth,
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
      generationRef.current += 1;
      queueRef.current = [];
      liveJobRef.current = null;
      scoredTextRef.current.clear();
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
    if (!isFinal && skipLiveRef.current) {
      debugTranscribe("applyTurns skip", "live drafts ignored after delete");
      return;
    }
    const pin = liveSpeakerPinRef.current;
    if (isFinal) {
      skipLiveRef.current = false;
      liveSpeakerPinRef.current = null;
    }
    const attributed = next.map((turn) =>
      pin === null ? turn : { ...turn, speaker: pin },
    );
    setNames((current) =>
      ensureSpeakerNames(
        current,
        attributed.map((turn) => turn.speaker),
      ),
    );
    const leftoverIds = turnsRef.current
      .filter((turn) => !turn.isFinal)
      .map((turn) => turn.id);
    // ASR can publish multiple events before React commits a render.
    const folded = foldIncomingTurns(turnsRef.current, attributed, isFinal);
    turnsRef.current = folded.turns;
    setTurns(folded.turns);
    const adopted = folded.adopted;
    const skipped = folded.skipped;
    const incomingIds = folded.incomingIds;
    debugTranscribe("applyTurns", {
      isFinal,
      skipped,
      incoming: attributed.length,
      ids: incomingIds,
      reused: incomingIds.filter((id) => leftoverIds.includes(id)),
      adoptedId: adopted?.id ?? null,
      text: attributed
        .map((turn) => turn.text)
        .join(" | ")
        .slice(0, 160),
    });
    if (isFinal) {
      const snapshot = adoptLiveScore(liveRef.current, adopted);
      const turn = adopted;
      if (
        snapshot &&
        turn &&
        snapshot.speaker === turn.speaker &&
        snapshot.text === turn.text.trim() &&
        !configRef.current.contextEnabled
      ) {
        scoredTextRef.current.set(turn.id, turn.text.trim());
        queueRef.current = queueRef.current.filter(
          (job) => job.turnId !== turn.id,
        );
        setScores((current) =>
          lockFinalScore(
            current,
            {
              ...snapshot,
              turnId: turn.id,
              speaker: turn.speaker,
              text: snapshot.text,
            },
            MAX_SCORED_TURNS,
          ),
        );
      }
      liveRef.current = null;
      liveJobRef.current = null;
      setLive(null);
    }
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
          house: null,
          gender: null,
          hype: null,
          energy: null,
          online: null,
          socion: null,
          bigFive: null,
          truth: null,
        };
      }
      const result = scoring.contextEnabled
        ? await evaluateContext(job.text, job.turnId, questions)
        : await convexClient.action(api.canvasAi.jev.ask, {
            state: buildIqState(job.text, job.previousTurn, {
              speaker: job.speaker === null ? "unknown" : String(job.speaker),
              speakerRecent: job.speakerRecent,
              recentTurns: job.recentTurns,
            }),
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
        house: scoring.jevHogwarts ? houseFromAnswers(result.answers) : null,
        gender: scoring.jevGenderStyle
          ? genderFromAnswers(result.answers)
          : null,
        hype: scoring.jevHype ? hypeFromAnswers(result.answers) : null,
        energy: scoring.jevEnergy ? energyFromAnswers(result.answers) : null,
        online: scoring.jevOnline ? onlineFromAnswers(result.answers) : null,
        socion: scoring.jevSocion ? socionFromAnswers(result.answers) : null,
        bigFive: scoring.jevBigFive ? bigFiveFromAnswers(result.answers) : null,
        truth: scoring.jevTruth ? truthFromAnswers(result.answers) : null,
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
          scoredTextRef.current.get(job.turnId) === job.text
        ) {
          debugTranscribe("score skip", {
            turnId: job.turnId,
            reason: "already-scored",
          });
          continue;
        }
        inFlightRef.current = job;
        lastWasLive = job.turnId === LIVE_TURN_ID;
        debugTranscribe("score start", {
          turnId: job.turnId,
          speaker: job.speaker,
          queue: queueRef.current.length,
          version: contextVersion,
          text: job.text.slice(0, 120),
        });
        if (job.turnId === LIVE_TURN_ID) {
          liveJobRef.current = null;
        }
        try {
          const scored = await scoreJob(job);
          if (generation !== generationRef.current) {
            debugTranscribe("score drop", {
              turnId: job.turnId,
              reason: "generation",
            });
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
            debugTranscribe("score drop", {
              turnId: job.turnId,
              reason: "text-changed",
              expected: job.text.slice(0, 80),
              actual: currentTurn?.text.trim().slice(0, 80) ?? null,
            });
            continue;
          }
          const row: TurnIq = {
            turnId: job.turnId,
            speaker: job.speaker,
            text: job.text,
            result: scored.result,
            smart: scored.smart,
            emotion: scored?.emotion ?? [],
            mbti: scored.mbti,
            advance: scored.advance,
            ennea: scored.ennea,
            house: scored.house,
            gender: scored.gender,
            hype: scored.hype,
            energy: scored.energy,
            online: scored.online,
            socion: scored.socion,
            bigFive: scored.bigFive,
            truth: scored.truth,
          };
          if (job.turnId === LIVE_TURN_ID) {
            liveRef.current = row;
            setLive(row);
          } else if (scoredTextRef.current.get(job.turnId) === job.text) {
            debugTranscribe("score skip", {
              turnId: job.turnId,
              reason: "locked-final",
            });
          } else {
            scoredTextRef.current.set(job.turnId, job.text);
            queueRef.current = queueRef.current.filter(
              (pending) => pending.turnId !== job.turnId,
            );
            setScores((current) =>
              lockFinalScore(current, row, MAX_SCORED_TURNS),
            );
          }
          debugTranscribe("score ok", {
            turnId: job.turnId,
            mbti: row.mbti?.type ?? null,
            socion: row.socion?.id ?? null,
            ennea: row.ennea?.label ?? null,
            house: row.house?.label ?? null,
            gender: row.gender?.label ?? null,
            fns: row.advance?.stack.slice(0, 2) ?? null,
          });
        } catch (error: unknown) {
          if (
            error instanceof Error &&
            error.message === "Stale conversation result"
          ) {
            const requeue =
              generation === generationRef.current &&
              job.turnId !== LIVE_TURN_ID &&
              turnsRef.current.some(
                (turn) =>
                  turn.id === job.turnId && turn.text.trim() === job.text,
              );
            debugTranscribe("score stale", {
              turnId: job.turnId,
              requeue,
              version: contextVersionRef.current,
            });
            if (requeue) {
              retryStaleScore(queueRef.current, job);
            }
            continue;
          }
          if (generation !== generationRef.current) {
            continue;
          }
          setStatus(scoreErrorMessage(error));
          debugTranscribe("score error", {
            turnId: job.turnId,
            message: error instanceof Error ? error.message : String(error),
          });
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
    (
      turn: ChatTurn,
      previousTurn: string | null,
      speakerRecent: string | null,
      recentTurns: string | null,
    ) => {
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
      if (scoredTextRef.current.get(turn.id) === text) {
        return false;
      }
      if (
        queueRef.current.some(
          (job) => job.turnId === turn.id && job.text === text,
        )
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
        speakerRecent,
        recentTurns,
      });
      debugTranscribe("enqueue", {
        turnId: turn.id,
        queue: queueRef.current.length,
        text: text.slice(0, 120),
      });
      return true;
    },
    [],
  );

  useEffect(() => {
    pruneScoredText(scoredTextRef.current, turns);
    if (!jevScoringOn(config)) {
      return;
    }
    let added = false;
    turns.forEach((turn, index) => {
      if (
        turn.isFinal &&
        enqueueFinal(
          turn,
          previousText(turns, index),
          speakerRecentText(turns, index, turn.speaker),
          recentTurnsText(turns, index),
        )
      ) {
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
        speakerRecent: speakerRecentText(turns, liveIndex, liveTurn.speaker),
        recentTurns: recentTurnsText(turns, liveIndex),
      };
      debugTranscribe("live job", {
        speaker: liveTurn.speaker,
        chars: livePhrase.length,
        text: livePhrase.slice(0, 120),
      });
      void pump();
    }, LIVE_DEBOUNCE_MS);
    return () => ownerWindow.clearTimeout(handle);
  }, [config, liveIndex, livePhrase, liveTurn, pump, turns]);

  // One number per utterance. Filler that fails the Noul gate has no badge.
  const iqByTurn = useMemo(() => {
    const map = new Map<string, IqResult>();
    for (const row of scores) {
      if (row.result?.substantive) {
        map.set(row.turnId, row.result);
      }
    }
    return map;
  }, [scores]);

  const iqBySpeaker = useMemo(
    () =>
      averagesBySpeaker(
        speakerScores,
        (row) => row.result,
        (rows) => {
          const composite = averageIqComposite(rows);
          if (composite === null) {
            return null;
          }
          const substantive = rows.filter((row) => row.substantive);
          const confidence =
            substantive.reduce((sum, row) => sum + row.confidence, 0) /
            substantive.length;
          return { composite, confidence };
        },
        speakerAverageCache.iq,
      ),
    [speakerScores, speakerAverageCache],
  );

  const emotionByTurn = useMemo(() => {
    const map = new Map<string, EmotionPick[]>();
    for (const row of scores) {
      if (row.emotion?.length) {
        map.set(row.turnId, row.emotion);
      }
    }
    return map;
  }, [scores]);

  const emotionBySpeaker = useMemo(
    () =>
      averagesBySpeaker(
        speakerScores,
        (row) => (row.emotion?.length ? row.emotion : null),
        averageEmotions,
        speakerAverageCache.emotion,
      ),
    [speakerScores, speakerAverageCache],
  );

  const mbtiByTurn = useMemo(() => {
    const map = new Map<string, MbtiResult>();
    for (const row of scores) {
      if (row.mbti) {
        map.set(row.turnId, row.mbti);
      }
    }
    return map;
  }, [scores]);

  const mbtiBySpeaker = useMemo(
    () =>
      averagesBySpeaker(
        speakerScores,
        (row) => row.mbti,
        averageMbti,
        speakerAverageCache.mbti,
      ),
    [speakerScores, speakerAverageCache],
  );

  const advanceByTurn = useMemo(() => {
    const map = new Map<string, MbtiAdvanceResult>();
    for (const row of scores) {
      if (row.advance) {
        map.set(row.turnId, row.advance);
      }
    }
    return map;
  }, [scores]);

  const advanceBySpeaker = useMemo(
    () =>
      averagesBySpeaker(
        speakerScores,
        (row) => row.advance,
        averageAdvance,
        speakerAverageCache.advance,
      ),
    [speakerScores, speakerAverageCache],
  );

  const enneaByTurn = useMemo(() => {
    const map = new Map<string, EnneaResult>();
    for (const row of scores) {
      if (row.ennea) {
        map.set(row.turnId, row.ennea);
      }
    }
    return map;
  }, [scores]);

  const enneaBySpeaker = useMemo(
    () =>
      averagesBySpeaker(
        speakerScores,
        (row) => row.ennea,
        averageEnnea,
        speakerAverageCache.ennea,
      ),
    [speakerScores, speakerAverageCache],
  );

  const houseByTurn = useMemo(() => {
    const map = new Map<string, HouseResult>();
    for (const row of scores) {
      if (row.house) {
        map.set(row.turnId, row.house);
      }
    }
    return map;
  }, [scores]);

  const houseBySpeaker = useMemo(
    () =>
      averagesBySpeaker(
        speakerScores,
        (row) => row.house,
        averageHouse,
        speakerAverageCache.house,
      ),
    [speakerScores, speakerAverageCache],
  );

  const genderByTurn = useMemo(() => {
    const map = new Map<string, GenderStyleResult>();
    for (const row of scores) {
      if (row.gender) {
        map.set(row.turnId, row.gender);
      }
    }
    return map;
  }, [scores]);

  const genderBySpeaker = useMemo(
    () =>
      averagesBySpeaker(
        speakerScores,
        (row) => row.gender,
        averageGender,
        speakerAverageCache.gender,
      ),
    [speakerScores, speakerAverageCache],
  );

  const smartByTurn = useMemo(() => {
    const map = new Map<string, SmartResult>();
    for (const row of scores) {
      if (row.smart) {
        map.set(row.turnId, row.smart);
      }
    }
    return map;
  }, [scores]);

  const smartBySpeaker = useMemo(
    () =>
      averagesBySpeaker(
        speakerScores,
        (row) => row.smart,
        averageSmart,
        speakerAverageCache.smart,
      ),
    [speakerScores, speakerAverageCache],
  );

  const hypeByTurn = useMemo(() => {
    const map = new Map<string, HypeResult>();
    for (const row of scores) {
      if (row.hype) {
        map.set(row.turnId, row.hype);
      }
    }
    return map;
  }, [scores]);

  const hypeBySpeaker = useMemo(
    () =>
      averagesBySpeaker(
        speakerScores,
        (row) => row.hype,
        averageHype,
        speakerAverageCache.hype,
      ),
    [speakerScores, speakerAverageCache],
  );

  const energyByTurn = useMemo(() => {
    const map = new Map<string, EnergyResult>();
    for (const row of scores) {
      if (row.energy) {
        map.set(row.turnId, row.energy);
      }
    }
    return map;
  }, [scores]);

  const energyBySpeaker = useMemo(
    () =>
      averagesBySpeaker(
        speakerScores,
        (row) => row.energy,
        averageEnergy,
        speakerAverageCache.energy,
      ),
    [speakerScores, speakerAverageCache],
  );

  const onlineByTurn = useMemo(() => {
    const map = new Map<string, OnlineResult>();
    for (const row of scores) {
      if (row.online) {
        map.set(row.turnId, row.online);
      }
    }
    return map;
  }, [scores]);

  const onlineBySpeaker = useMemo(
    () =>
      averagesBySpeaker(
        speakerScores,
        (row) => row.online,
        averageOnline,
        speakerAverageCache.online,
      ),
    [speakerScores, speakerAverageCache],
  );

  const socionByTurn = useMemo(() => {
    const map = new Map<string, SocionResult>();
    for (const row of scores) {
      if (row.socion) {
        map.set(row.turnId, row.socion);
      }
    }
    return map;
  }, [scores]);

  const socionBySpeaker = useMemo(
    () =>
      averagesBySpeaker(
        speakerScores,
        (row) => row.socion,
        averageSocion,
        speakerAverageCache.socion,
      ),
    [speakerScores, speakerAverageCache],
  );

  const bigFiveByTurn = useMemo(() => {
    const map = new Map<string, BigFiveResult>();
    for (const row of scores) {
      if (row.bigFive) {
        map.set(row.turnId, row.bigFive);
      }
    }
    return map;
  }, [scores]);

  const bigFiveBySpeaker = useMemo(
    () =>
      averagesBySpeaker(
        speakerScores,
        (row) => row.bigFive,
        averageBigFive,
        speakerAverageCache.bigFive,
      ),
    [speakerScores, speakerAverageCache],
  );

  const truthByTurn = useMemo(() => {
    const map = new Map<string, TruthResult>();
    for (const row of scores) {
      if (row.truth) {
        map.set(row.turnId, row.truth);
      }
    }
    return map;
  }, [scores]);

  const truthBySpeaker = useMemo(
    () =>
      averagesBySpeaker(
        speakerScores,
        (row) => row.truth,
        averageTruth,
        speakerAverageCache.truth,
      ),
    [speakerScores, speakerAverageCache],
  );

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
    skipLiveRef.current = false;
    liveSpeakerPinRef.current = null;
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
    skipLiveRef.current = false;
    liveSpeakerPinRef.current = null;
    resetIq();
    setStatus(listening ? "" : "Pick a source, then Start.");
  };

  const assignTurnSpeaker = (turnId: string, speaker: number) => {
    setNames((current) => ensureSpeakerNames(current, [speaker]));
    setTurns((current) =>
      current.map((turn) => (turn.id === turnId ? { ...turn, speaker } : turn)),
    );
    setScores((current) =>
      current.map((row) => (row.turnId === turnId ? { ...row, speaker } : row)),
    );
    const turn = turnsRef.current.find((item) => item.id === turnId);
    if (turn && !turn.isFinal) {
      liveSpeakerPinRef.current = speaker;
      setLive((current) => (current ? { ...current, speaker } : current));
    }
  };

  const deleteTurn = (turnId: string) => {
    const turn = turnsRef.current.find((item) => item.id === turnId);
    dropTranscriptTurns(elementId, [turnId]);
    setTurns((current) => current.filter((item) => item.id !== turnId));
    setScores((current) => current.filter((row) => row.turnId !== turnId));
    scoredTextRef.current.delete(turnId);
    queueRef.current = queueRef.current.filter((job) => job.turnId !== turnId);
    if (turn && !turn.isFinal) {
      skipLiveRef.current = true;
      liveJobRef.current = null;
      liveSpeakerPinRef.current = null;
      setLive(null);
    }
  };

  const selected = sources.find((source) => source.id === sourceId);
  const startLabel = listening && !paused ? "Pause" : "Start";
  const hint =
    selected && !selected.hasAudio
      ? "Allow the microphone. Window share has no system audio on its own."
      : status;
  const speakers = uniqueSpeakers(turns);
  const wordCounts = spokenWordsBySpeaker(turns);
  const roster = numberedSpeakers(turns);
  const excalidrawRoot = rootRef.current?.closest(".excalidraw");
  const menuContainer =
    excalidrawRoot instanceof HTMLElement
      ? excalidrawRoot
      : rootRef.current?.ownerDocument.body ?? undefined;
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

  const flagCards = (
    <div className="jayrr-called-embed__cards">
      <div className="jayrr-called-embed__card">
        <JevCardHeader
          label="Topic tracking"
          pressed={!!config.contextEnabled}
          ariaLabel="Show conversation topic tracking"
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
          label="Verbal IQ"
          pressed={!!config.jevIq}
          ariaLabel="Score speech with verbal IQ"
          container={rootRef.current}
          showWhere={jevShowWhere(config, "iq")}
          onShowWhere={(where) => setJevShow("iq", where)}
          showScore={jevShowScoreOn(config, "iq")}
          onShowScore={(next) => setJevShowScore("iq", next)}
          classCount={jevTopCount(config, "iq")}
          onClassCount={(count) => setJevTop("iq", count)}
          onToggle={() => {
            const next = { ...config, jevIq: !config.jevIq };
            resetIq();
            applyConfig(next, true);
          }}
        >
          <div className="jayrr-called-embed__hint">
            Scores this line’s reasoning density on a 70–160 verbal IQ scale.
          </div>
          <div className="jayrr-called-embed__bands">
            {IQ_BANDS.map((band) => (
              <JevTip
                key={band.label}
                title={`Verbal IQ ${band.label}`}
                body={band.what}
              >
                <span
                  className={`jayrr-called-embed__iq jayrr-called-embed__iq--${band.shade}`}
                >
                  {band.label}
                </span>
              </JevTip>
            ))}
          </div>
        </JevCardHeader>
      </div>
      <div className="jayrr-called-embed__card">
        <JevCardHeader
          label="Situational smarts"
          pressed={!!config.jevSmart}
          ariaLabel="Score speech with situational smarts"
          container={rootRef.current}
          showWhere={jevShowWhere(config, "smart")}
          onShowWhere={(where) => setJevShow("smart", where)}
          showScore={jevShowScoreOn(config, "smart")}
          onShowScore={(next) => setJevShowScore("smart", next)}
          classCount={jevTopCount(config, "smart")}
          onClassCount={(count) => setJevTop("smart", count)}
          onToggle={() => {
            const next = { ...config, jevSmart: !config.jevSmart };
            resetIq();
            applyConfig(next, true);
          }}
        >
          <div className="jayrr-called-embed__hint">
            Scores how clearly this line understands what is going on.
          </div>
          <div className="jayrr-called-embed__bands jayrr-called-embed__bands--hype">
            {SMART_BANDS.map((band) => (
              <JevTip key={band.id} title={band.label} body={band.what}>
                <span
                  className={`jayrr-called-embed__iq jayrr-called-embed__smart jayrr-called-embed__smart--${band.id}`}
                >
                  {band.label}
                </span>
              </JevTip>
            ))}
          </div>
        </JevCardHeader>
      </div>
      <div className="jayrr-called-embed__card">
        <JevCardHeader
          label="Attention pull"
          pressed={!!config.jevHype}
          ariaLabel="Score speech with attention pull"
          container={rootRef.current}
          showWhere={jevShowWhere(config, "hype")}
          onShowWhere={(where) => setJevShow("hype", where)}
          showScore={jevShowScoreOn(config, "hype")}
          onShowScore={(next) => setJevShowScore("hype", next)}
          classCount={jevTopCount(config, "hype")}
          onClassCount={(count) => setJevTop("hype", count)}
          onToggle={() => {
            const next = { ...config, jevHype: !config.jevHype };
            resetIq();
            applyConfig(next, true);
          }}
        >
          <div className="jayrr-called-embed__hint">
            Scores how strongly this line would hold a listener’s attention.
          </div>
          <div className="jayrr-called-embed__bands jayrr-called-embed__bands--hype">
            {HYPE_BANDS.map((band) => (
              <JevTip key={band.id} title={band.label} body={band.what}>
                <span
                  className={`jayrr-called-embed__iq jayrr-called-embed__hype jayrr-called-embed__hype--${band.id}`}
                >
                  {band.label}
                </span>
              </JevTip>
            ))}
          </div>
        </JevCardHeader>
      </div>
      <div className="jayrr-called-embed__card">
        <JevCardHeader
          label="Consciousness map"
          pressed={!!config.jevEnergy}
          ariaLabel="Score speech with the Hawkins consciousness map"
          container={rootRef.current}
          showWhere={jevShowWhere(config, "energy")}
          onShowWhere={(where) => setJevShow("energy", where)}
          showScore={jevShowScoreOn(config, "energy")}
          onShowScore={(next) => setJevShowScore("energy", next)}
          classCount={jevTopCount(config, "energy")}
          onClassCount={(count) => setJevTop("energy", count)}
          onToggle={() => {
            const next = { ...config, jevEnergy: !config.jevEnergy };
            resetIq();
            applyConfig(next, true);
          }}
        >
          <div className="jayrr-called-embed__hint">
            Scores this line on Hawkins consciousness levels (30–1000).
          </div>
          <div className="jayrr-called-embed__bands jayrr-called-embed__bands--energy">
            {ENERGY_BANDS.map((band) => (
              <JevTip
                key={band.id}
                title={`${band.level} ${band.name}`}
                body={jevTipBody(
                  band.what,
                  energyGroupIds(band.id).map((id) => {
                    const sibling = ENERGY_BANDS.find((row) => row.id === id);
                    return {
                      key: id,
                      label: sibling ? `${sibling.level} ${sibling.name}` : id,
                    };
                  }),
                )}
              >
                <span
                  className={`jayrr-called-embed__iq jayrr-called-embed__energy jayrr-called-embed__energy--${band.zone} jayrr-called-embed__energy--${band.id}`}
                >
                  {String(band.level)}
                </span>
              </JevTip>
            ))}
          </div>
        </JevCardHeader>
      </div>
      <div className="jayrr-called-embed__card">
        <JevCardHeader
          label="Online civility"
          pressed={!!config.jevOnline}
          ariaLabel="Score speech with online civility"
          container={rootRef.current}
          showWhere={jevShowWhere(config, "online")}
          onShowWhere={(where) => setJevShow("online", where)}
          showScore={jevShowScoreOn(config, "online")}
          onShowScore={(next) => setJevShowScore("online", next)}
          classCount={jevTopCount(config, "online")}
          onClassCount={(count) => setJevTop("online", count)}
          onToggle={() => {
            const next = { ...config, jevOnline: !config.jevOnline };
            resetIq();
            applyConfig(next, true);
          }}
        >
          <div className="jayrr-called-embed__hint">
            Scores how this line treats other people, from troll to wholesome.
          </div>
          <div className="jayrr-called-embed__bands jayrr-called-embed__bands--online">
            {ONLINE_BANDS.map((band) => (
              <JevTip
                key={band.id}
                title={band.label}
                body={
                  <>
                    <p>{band.what}</p>
                    <p>Example: {band.example}</p>
                  </>
                }
              >
                <span
                  className={`jayrr-called-embed__iq jayrr-called-embed__online jayrr-called-embed__online--${band.id}`}
                >
                  {band.label}
                </span>
              </JevTip>
            ))}
          </div>
        </JevCardHeader>
      </div>
      <div className="jayrr-called-embed__card">
        <JevCardHeader
          label="Claim truth"
          pressed={!!config.jevTruth}
          ariaLabel="Score speech with claim truth"
          container={rootRef.current}
          showWhere={jevShowWhere(config, "truth")}
          onShowWhere={(where) => setJevShow("truth", where)}
          showScore={jevShowScoreOn(config, "truth")}
          onShowScore={(next) => setJevShowScore("truth", next)}
          classCount={jevTopCount(config, "truth")}
          onClassCount={(count) => setJevTop("truth", count)}
          onToggle={() => {
            const next = { ...config, jevTruth: !config.jevTruth };
            resetIq();
            applyConfig(next, true);
          }}
        >
          <div className="jayrr-called-embed__hint">
            Scores how well this claim matches known facts, not whether the
            speaker meant to lie.
          </div>
          <div className="jayrr-called-embed__bands jayrr-called-embed__bands--truth">
            {TRUTH_BANDS.map((band) => (
              <JevTip
                key={band.id}
                title={band.label}
                body={
                  <>
                    <p>{band.what}</p>
                    <p>Example: {band.example}</p>
                  </>
                }
              >
                <span
                  className={`jayrr-called-embed__iq jayrr-called-embed__truth jayrr-called-embed__truth--${band.id}`}
                >
                  {band.label}
                </span>
              </JevTip>
            ))}
          </div>
        </JevCardHeader>
      </div>
      <div className="jayrr-called-embed__card">
        <JevCardHeader
          label="Socionics type"
          pressed={!!config.jevSocion}
          ariaLabel="Score speech with socionics type"
          container={rootRef.current}
          showWhere={jevShowWhere(config, "socion")}
          onShowWhere={(where) => setJevShow("socion", where)}
          showScore={jevShowScoreOn(config, "socion")}
          onShowScore={(next) => setJevShowScore("socion", next)}
          classCount={jevTopCount(config, "socion")}
          onClassCount={(count) => setJevTop("socion", count)}
          onToggle={() => {
            const next = { ...config, jevSocion: !config.jevSocion };
            resetIq();
            applyConfig(next, true);
          }}
        >
          <div className="jayrr-called-embed__hint">
            Picks the socionics Model A type this line is using.
          </div>
          <div className="jayrr-called-embed__bands jayrr-called-embed__bands--socion">
            {SOCION_BANDS.map((band) => (
              <JevTip
                key={band.id}
                title={`${band.id} ${band.code4} · ${band.nick} · ${band.ego}`}
                body={band.what}
              >
                <span
                  className={`jayrr-called-embed__iq jayrr-called-embed__socion jayrr-called-embed__socion--${
                    band.quadra
                  } jayrr-called-embed__socion--${band.id.toLowerCase()}`}
                >
                  {band.id}
                </span>
              </JevTip>
            ))}
          </div>
        </JevCardHeader>
      </div>
      <div className="jayrr-called-embed__card">
        <JevCardHeader
          label="Big Five traits"
          pressed={!!config.jevBigFive}
          ariaLabel="Score speech with Big Five traits"
          container={rootRef.current}
          showWhere={jevShowWhere(config, "bigFive")}
          onShowWhere={(where) => setJevShow("bigFive", where)}
          showScore={jevShowScoreOn(config, "bigFive")}
          onShowScore={(next) => setJevShowScore("bigFive", next)}
          classCount={jevTopCount(config, "bigFive")}
          onClassCount={(count) => setJevTop("bigFive", count)}
          onToggle={() => {
            const next = { ...config, jevBigFive: !config.jevBigFive };
            resetIq();
            applyConfig(next, true);
          }}
        >
          <div className="jayrr-called-embed__hint">
            Scores this line on each Big Five trait.
          </div>
          <div className="jayrr-called-embed__bands jayrr-called-embed__bands--big5">
            {BIG5_BANDS.map((band) => (
              <JevTip key={band.id} title={band.name} body={band.what}>
                <span
                  className={`jayrr-called-embed__iq jayrr-called-embed__big5 jayrr-called-embed__big5--${band.id.toLowerCase()}`}
                >
                  {band.name}
                </span>
              </JevTip>
            ))}
          </div>
        </JevCardHeader>
      </div>
      <div className="jayrr-called-embed__card">
        <JevCardHeader
          label="MBTI letters"
          pressed={!!config.jevMbti}
          ariaLabel="Score speech with MBTI letters"
          container={rootRef.current}
          showWhere={jevShowWhere(config, "mbti")}
          onShowWhere={(where) => setJevShow("mbti", where)}
          showScore={jevShowScoreOn(config, "mbti")}
          onShowScore={(next) => setJevShowScore("mbti", next)}
          classCount={jevTopCount(config, "mbti")}
          onClassCount={(count) => setJevTop("mbti", count)}
          onToggle={() => {
            const next = { ...config, jevMbti: !config.jevMbti };
            resetIq();
            applyConfig(next, true);
          }}
        >
          <div className="jayrr-called-embed__hint">
            Picks Extraversion/Introversion, Sensing/Intuition,
            Thinking/Feeling, and Judging/Perceiving from this line.
          </div>
          <div className="jayrr-called-embed__bands jayrr-called-embed__bands--pairs">
            {MBTI_BANDS.map((band) => (
              <JevTip
                key={band.letter}
                title={band.letter}
                body={jevTipBody(
                  band.what,
                  MBTI_BANDS.filter((row) => row.pair === band.pair).map(
                    (row) => ({
                      key: row.letter,
                      label: row.letter,
                      mark: row.what,
                    }),
                  ),
                )}
              >
                <span
                  className={`jayrr-called-embed__iq jayrr-called-embed__mbti jayrr-called-embed__mbti--${band.letter.toLowerCase()}`}
                >
                  {band.letter}
                </span>
              </JevTip>
            ))}
          </div>
        </JevCardHeader>
      </div>
      <div className="jayrr-called-embed__card">
        <JevCardHeader
          label="MBTI functions"
          pressed={!!config.jevMbtiAdvance}
          ariaLabel="Score speech with MBTI cognitive functions"
          container={rootRef.current}
          showWhere={jevShowWhere(config, "mbtiAdvance")}
          onShowWhere={(where) => setJevShow("mbtiAdvance", where)}
          showScore={jevShowScoreOn(config, "mbtiAdvance")}
          onShowScore={(next) => setJevShowScore("mbtiAdvance", next)}
          classCount={jevTopCount(config, "mbtiAdvance")}
          onClassCount={(count) => setJevTop("mbtiAdvance", count)}
          onToggle={() => {
            const next = {
              ...config,
              jevMbtiAdvance: !config.jevMbtiAdvance,
            };
            resetIq();
            applyConfig(next, true);
          }}
        >
          <div className="jayrr-called-embed__hint">
            Picks the Jungian cognitive function this line is using (Se, Si, Ne,
            Ni, Te, Ti, Fe, Fi).
          </div>
          <div className="jayrr-called-embed__bands jayrr-called-embed__bands--pairs">
            {COG_BANDS.map((fn) => (
              <JevTip key={fn} title={fn} body={cogWhat(fn)}>
                <span
                  className={`jayrr-called-embed__iq jayrr-called-embed__fn jayrr-called-embed__fn--${fn.toLowerCase()}`}
                >
                  {fn}
                </span>
              </JevTip>
            ))}
          </div>
        </JevCardHeader>
      </div>
      <div className="jayrr-called-embed__card">
        <JevCardHeader
          label="Enneagram type"
          pressed={!!config.jevEnneagram}
          ariaLabel="Score speech with Enneagram type"
          container={rootRef.current}
          showWhere={jevShowWhere(config, "enneagram")}
          onShowWhere={(where) => setJevShow("enneagram", where)}
          showScore={jevShowScoreOn(config, "enneagram")}
          onShowScore={(next) => setJevShowScore("enneagram", next)}
          classCount={jevTopCount(config, "enneagram")}
          onClassCount={(count) => setJevTop("enneagram", count)}
          onToggle={() => {
            const next = {
              ...config,
              jevEnneagram: !config.jevEnneagram,
            };
            resetIq();
            applyConfig(next, true);
          }}
        >
          <div className="jayrr-called-embed__hint">
            Picks the Enneagram habit of attention this line shows (types 1–9).
          </div>
          <div className="jayrr-called-embed__bands jayrr-called-embed__bands--ennea">
            {ENNEA_BANDS.map((band) => (
              <JevTip
                key={band.id}
                title={`Type ${band.id} · The ${band.name}`}
                body={band.what}
              >
                <span
                  className={`jayrr-called-embed__iq jayrr-called-embed__ennea jayrr-called-embed__ennea--${band.id}`}
                >
                  {band.id}
                </span>
              </JevTip>
            ))}
          </div>
        </JevCardHeader>
      </div>
      <div className="jayrr-called-embed__card">
        <JevCardHeader
          label="Hogwarts house"
          pressed={!!config.jevHogwarts}
          ariaLabel="Score speech with Hogwarts house"
          container={rootRef.current}
          showWhere={jevShowWhere(config, "hogwarts")}
          onShowWhere={(where) => setJevShow("hogwarts", where)}
          showScore={jevShowScoreOn(config, "hogwarts")}
          onShowScore={(next) => setJevShowScore("hogwarts", next)}
          classCount={jevTopCount(config, "hogwarts")}
          onClassCount={(count) => setJevTop("hogwarts", count)}
          onToggle={() => {
            const next = {
              ...config,
              jevHogwarts: !config.jevHogwarts,
            };
            resetIq();
            applyConfig(next, true);
          }}
        >
          <div className="jayrr-called-embed__hint">
            Picks the playful Hogwarts house stereotype this line shows.
          </div>
          <div className="jayrr-called-embed__bands jayrr-called-embed__bands--house">
            {HOUSE_BANDS.map((band) => (
              <JevTip key={band.id} title={band.name} body={band.what}>
                <span
                  className={`jayrr-called-embed__iq jayrr-called-embed__house jayrr-called-embed__house--${band.id}`}
                >
                  {band.name}
                </span>
              </JevTip>
            ))}
          </div>
        </JevCardHeader>
      </div>
      <div className="jayrr-called-embed__card">
        <JevCardHeader
          label="Feminine / masculine"
          pressed={!!config.jevGenderStyle}
          ariaLabel="Score speech with feminine to masculine style"
          container={rootRef.current}
          showWhere={jevShowWhere(config, "genderStyle")}
          onShowWhere={(where) => setJevShow("genderStyle", where)}
          showScore={jevShowScoreOn(config, "genderStyle")}
          onShowScore={(next) => setJevShowScore("genderStyle", next)}
          classCount={jevTopCount(config, "genderStyle")}
          onClassCount={(count) => setJevTop("genderStyle", count)}
          onToggle={() => {
            const next = {
              ...config,
              jevGenderStyle: !config.jevGenderStyle,
            };
            resetIq();
            applyConfig(next, true);
          }}
        >
          <div className="jayrr-called-embed__hint">
            Scores presentation and social style, not sex or identity.
          </div>
          <div className="jayrr-called-embed__bands jayrr-called-embed__bands--gender">
            {GENDER_BANDS.map((band) => (
              <JevTip key={band.id} title={band.name} body={band.what}>
                <span
                  className={`jayrr-called-embed__iq jayrr-called-embed__gender jayrr-called-embed__gender--${band.id}`}
                >
                  {band.name}
                </span>
              </JevTip>
            ))}
          </div>
        </JevCardHeader>
      </div>
      <div className="jayrr-called-embed__card">
        <JevCardHeader
          label="Emotion labels"
          pressed={!!config.jevEmotion}
          ariaLabel="Score speech with emotion labels"
          container={rootRef.current}
          showWhere={jevShowWhere(config, "emotion")}
          onShowWhere={(where) => setJevShow("emotion", where)}
          showScore={jevShowScoreOn(config, "emotion")}
          onShowScore={(next) => setJevShowScore("emotion", next)}
          classCount={jevTopCount(config, "emotion")}
          onClassCount={(count) => setJevTop("emotion", count)}
          onToggle={() => {
            const next = { ...config, jevEmotion: !config.jevEmotion };
            resetIq();
            applyConfig(next, true);
          }}
        >
          <div className="jayrr-called-embed__hint">
            Labels the feeling this line carries.
          </div>
          <div className="jayrr-called-embed__bands jayrr-called-embed__bands--emotion">
            {EMOTION_BANDS.map((band) => (
              <JevTip
                key={band.tone}
                title={band.label}
                body={jevTipBody(
                  band.what,
                  emotionLabelsForTone(band.tone).map((label) => ({
                    key: label,
                    label,
                  })),
                )}
              >
                <span
                  className={`jayrr-called-embed__emo jayrr-called-embed__emo--${band.tone}`}
                >
                  {band.label}
                </span>
              </JevTip>
            ))}
          </div>
        </JevCardHeader>
      </div>
    </div>
  );

  return (
    <Tooltip.Provider delayDuration={200} skipDelayDuration={200}>
      <div
        ref={rootRef}
        className="jayrr-called-embed jayrr-called-embed--transcribe"
        onContextMenu={(event) => {
          event.stopPropagation();
        }}
      >
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
                    const iqResult = turn.isFinal
                      ? iqByTurn.get(turn.id)
                      : live?.result?.substantive
                      ? live.result
                      : undefined;
                    const iqScore = iqResult?.composite;
                    const iqConfidence = iqResult?.confidence;
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
                    const house = turn.isFinal
                      ? houseByTurn.get(turn.id)
                      : live?.house ?? undefined;
                    const gender = turn.isFinal
                      ? genderByTurn.get(turn.id)
                      : live?.gender ?? undefined;
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
                    const truth = turn.isFinal
                      ? truthByTurn.get(turn.id)
                      : live?.truth ?? undefined;
                    const prev = turns[index - 1];
                    const follow =
                      prev !== undefined && prev.speaker === turn.speaker;
                    return (
                      <TranscriptTurnMenu
                        key={turn.id}
                        turn={turn}
                        speakers={roster}
                        names={names}
                        container={menuContainer}
                        onAssign={(speaker) =>
                          assignTurnSpeaker(turn.id, speaker)
                        }
                        onNewSpeaker={() =>
                          assignTurnSpeaker(
                            turn.id,
                            nextSpeakerId(turnsRef.current, namesRef.current),
                          )
                        }
                        onDelete={() => deleteTurn(turn.id)}
                      >
                        <div
                          className={`jayrr-called-embed__msg jayrr-called-embed__msg--${side}${
                            turn.isFinal ? "" : " is-draft"
                          }${follow ? " is-follow" : ""}`}
                          style={speakerHueStyle(turn.speaker, speakers)}
                          onContextMenu={(event) => {
                            event.stopPropagation();
                          }}
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
                          <div className="jayrr-called-embed__bubble">
                            <TurnBadges
                              config={config}
                              emotions={emotions}
                              iqScore={iqScore}
                              iqConfidence={iqConfidence}
                              smart={smart}
                              hype={hype}
                              energy={energy}
                              online={online}
                              socion={socion}
                              bigFive={bigFive}
                              truth={truth}
                              mbti={mbti}
                              advance={advance}
                              ennea={ennea}
                              house={house}
                              gender={gender}
                            />
                            {turn.text}
                          </div>
                        </div>
                      </TranscriptTurnMenu>
                    );
                  })
                )}
              </div>
            </div>
            <aside
              className={
                config.configOpen ||
                config.jevMbti ||
                config.jevMbtiAdvance ||
                config.jevEnneagram ||
                config.jevHogwarts ||
                config.jevGenderStyle ||
                config.jevHype ||
                config.jevEnergy ||
                config.jevOnline ||
                config.jevSocion ||
                config.jevBigFive ||
                config.jevSmart ||
                config.jevIq ||
                config.jevEmotion ||
                config.jevTruth
                  ? "jayrr-called-embed__now jayrr-called-embed__now--mbti"
                  : "jayrr-called-embed__now"
              }
            >
              {config.configOpen ? (
                flagCards
              ) : (
                <>
                  <div className="jayrr-called-embed__now-label">Speaker</div>
                  <div className="jayrr-called-embed__now-list">
                    {speakers.map((speaker) => {
                      const speakerKey =
                        speaker === null ? "unknown" : String(speaker);
                      const liveNow = liveSpeaker === speaker;
                      const speakerIq =
                        speaker !== null &&
                        jevScoreVisible(config, config.jevIq, "iq", "speaker")
                          ? iqBySpeaker.get(speaker)
                          : undefined;
                      const speakerEmotions =
                        speaker !== null &&
                        jevScoreVisible(
                          config,
                          config.jevEmotion,
                          "emotion",
                          "speaker",
                        )
                          ? emotionBySpeaker.get(speaker)
                          : undefined;
                      const speakerMbti =
                        speaker !== null &&
                        jevScoreVisible(
                          config,
                          config.jevMbti,
                          "mbti",
                          "speaker",
                        )
                          ? mbtiBySpeaker.get(speaker)
                          : undefined;
                      const speakerAdvance =
                        speaker !== null &&
                        jevScoreVisible(
                          config,
                          config.jevMbtiAdvance,
                          "mbtiAdvance",
                          "speaker",
                        )
                          ? advanceBySpeaker.get(speaker)
                          : undefined;
                      const speakerEnnea =
                        speaker !== null &&
                        jevScoreVisible(
                          config,
                          config.jevEnneagram,
                          "enneagram",
                          "speaker",
                        )
                          ? enneaBySpeaker.get(speaker)
                          : undefined;
                      const speakerHouse =
                        speaker !== null &&
                        jevScoreVisible(
                          config,
                          config.jevHogwarts,
                          "hogwarts",
                          "speaker",
                        )
                          ? houseBySpeaker.get(speaker)
                          : undefined;
                      const speakerGender =
                        speaker !== null &&
                        jevScoreVisible(
                          config,
                          config.jevGenderStyle,
                          "genderStyle",
                          "speaker",
                        )
                          ? genderBySpeaker.get(speaker)
                          : undefined;
                      const speakerHype =
                        speaker !== null &&
                        jevScoreVisible(
                          config,
                          config.jevHype,
                          "hype",
                          "speaker",
                        )
                          ? hypeBySpeaker.get(speaker)
                          : undefined;
                      const speakerEnergy =
                        speaker !== null &&
                        jevScoreVisible(
                          config,
                          config.jevEnergy,
                          "energy",
                          "speaker",
                        )
                          ? energyBySpeaker.get(speaker)
                          : undefined;
                      const speakerOnline =
                        speaker !== null &&
                        jevScoreVisible(
                          config,
                          config.jevOnline,
                          "online",
                          "speaker",
                        )
                          ? onlineBySpeaker.get(speaker)
                          : undefined;
                      const speakerSocion =
                        speaker !== null &&
                        jevScoreVisible(
                          config,
                          config.jevSocion,
                          "socion",
                          "speaker",
                        )
                          ? socionBySpeaker.get(speaker)
                          : undefined;
                      const speakerBigFive =
                        speaker !== null &&
                        jevScoreVisible(
                          config,
                          config.jevBigFive,
                          "bigFive",
                          "speaker",
                        )
                          ? bigFiveBySpeaker.get(speaker)
                          : undefined;
                      const speakerSmart =
                        speaker !== null &&
                        jevScoreVisible(
                          config,
                          config.jevSmart,
                          "smart",
                          "speaker",
                        )
                          ? smartBySpeaker.get(speaker)
                          : undefined;
                      const speakerTruth =
                        speaker !== null &&
                        jevScoreVisible(
                          config,
                          config.jevTruth,
                          "truth",
                          "speaker",
                        )
                          ? truthBySpeaker.get(speaker)
                          : undefined;
                      const wordCount = wordCounts.get(speakerKey) ?? 0;
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
                          className={
                            liveNow
                              ? "jayrr-called-embed__card jayrr-called-embed__now-row is-live"
                              : "jayrr-called-embed__card jayrr-called-embed__now-row"
                          }
                        >
                          <div className="jayrr-called-embed__now-head">
                            {nameControl}
                            <span className="jayrr-called-embed__now-words">
                              {wordCount} {wordCount === 1 ? "word" : "words"}
                            </span>
                          </div>
                          {speakerIq === undefined
                            ? null
                            : rankedIqComposites(
                                speakerIq.composite,
                                jevTopCount(config, "iq"),
                              ).map((composite) => (
                                <IqBadge
                                  key={composite}
                                  composite={composite}
                                  showScore={jevShowScoreOn(config, "iq")}
                                  confidence={speakerIq.confidence}
                                />
                              ))}
                          {speakerEmotions
                            ? speakerEmotions
                                .slice(0, jevTopCount(config, "emotion"))
                                .map((emotion) => (
                                  <EmotionBadge
                                    key={emotion.id}
                                    emotion={emotion}
                                    showScore={jevShowScoreOn(
                                      config,
                                      "emotion",
                                    )}
                                    all={speakerEmotions}
                                  />
                                ))
                            : null}
                          {speakerSmart
                            ? rankedSmart(
                                speakerSmart,
                                jevTopCount(config, "smart"),
                              ).map((row) => (
                                <SmartBadge
                                  key={row.id}
                                  smart={row}
                                  showScore={jevShowScoreOn(config, "smart")}
                                />
                              ))
                            : null}
                          {speakerMbti
                            ? rankedMbti(
                                speakerMbti,
                                jevTopCount(config, "mbti"),
                              ).map((row) => (
                                <MbtiBadge
                                  key={row.type}
                                  mbti={row}
                                  showScore={jevShowScoreOn(config, "mbti")}
                                />
                              ))
                            : null}
                          {speakerAdvance
                            ? rankedAdvanceFns(
                                speakerAdvance,
                                jevTopCount(config, "mbtiAdvance"),
                              ).map((fn) => (
                                <CogBadge
                                  key={fn}
                                  fn={fn}
                                  showScore={jevShowScoreOn(
                                    config,
                                    "mbtiAdvance",
                                  )}
                                  confidence={speakerAdvance.probabilities[fn]}
                                  all={speakerAdvance}
                                />
                              ))
                            : null}
                          {speakerEnnea
                            ? rankedEnnea(
                                speakerEnnea,
                                jevTopCount(config, "enneagram"),
                              ).map((row) => (
                                <EnneaBadge
                                  key={row.id}
                                  ennea={row}
                                  showScore={jevShowScoreOn(
                                    config,
                                    "enneagram",
                                  )}
                                />
                              ))
                            : null}
                          {speakerHouse
                            ? rankedHouse(
                                speakerHouse,
                                jevTopCount(config, "hogwarts"),
                              ).map((row) => (
                                <HouseBadge
                                  key={row.id}
                                  house={row}
                                  showScore={jevShowScoreOn(config, "hogwarts")}
                                />
                              ))
                            : null}
                          {speakerGender
                            ? rankedGender(
                                speakerGender,
                                jevTopCount(config, "genderStyle"),
                              ).map((row) => (
                                <GenderBadge
                                  key={row.id}
                                  gender={row}
                                  showScore={jevShowScoreOn(
                                    config,
                                    "genderStyle",
                                  )}
                                />
                              ))
                            : null}
                          {speakerHype
                            ? rankedHype(
                                speakerHype,
                                jevTopCount(config, "hype"),
                              ).map((row) => (
                                <HypeBadge
                                  key={row.id}
                                  hype={row}
                                  showScore={jevShowScoreOn(config, "hype")}
                                />
                              ))
                            : null}
                          {speakerEnergy
                            ? rankedEnergy(
                                speakerEnergy,
                                jevTopCount(config, "energy"),
                              ).map((row) => (
                                <EnergyBadge
                                  key={row.id}
                                  energy={row}
                                  showScore={jevShowScoreOn(config, "energy")}
                                />
                              ))
                            : null}
                          {speakerOnline
                            ? rankedOnline(
                                speakerOnline,
                                jevTopCount(config, "online"),
                              ).map((row) => (
                                <OnlineBadge
                                  key={row.id}
                                  online={row}
                                  showScore={jevShowScoreOn(config, "online")}
                                />
                              ))
                            : null}
                          {speakerSocion
                            ? rankedSocion(
                                speakerSocion,
                                jevTopCount(config, "socion"),
                              ).map((row) => (
                                <SocionBadge
                                  key={row.id}
                                  socion={row}
                                  showScore={jevShowScoreOn(config, "socion")}
                                />
                              ))
                            : null}
                          {speakerBigFive
                            ? bigFiveBadges(
                                speakerBigFive,
                                jevTopCount(config, "bigFive"),
                                jevShowScoreOn(config, "bigFive"),
                              )
                            : null}
                          {speakerTruth
                            ? rankedTruth(
                                speakerTruth,
                                jevTopCount(config, "truth"),
                              ).map((row) => (
                                <TruthBadge
                                  key={row.id}
                                  truth={row}
                                  showScore={jevShowScoreOn(config, "truth")}
                                />
                              ))
                            : null}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </aside>
          </div>
        </>
      </div>
    </Tooltip.Provider>
  );
};
