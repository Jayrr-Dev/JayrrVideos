import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { checkIcon, helpIcon } from "@excalidraw/excalidraw/components/icons";
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
import { conversationFor } from "../../transcription/conversationContext";
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
  rankedBigFiveTraits,
  type BigFiveResult,
  type BigFiveTrait,
} from "./jevBigFiveScale";
import {
  EMOTION_BANDS,
  EMOTION_QUESTION,
  averageEmotions,
  emotionsFromAnswers,
  type EmotionPick,
} from "./jevEmotionScale";
import {
  ENERGY_BANDS,
  ENERGY_QUESTION,
  averageEnergy,
  energyFromAnswers,
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
  rankedAdvanceFns,
  type CogFn,
  type MbtiAdvanceResult,
} from "./jevMbtiAdvanceScale";
import {
  MBTI_BANDS,
  MBTI_QUESTIONS,
  averageMbti,
  mbtiFromAnswers,
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
  EMBED_PREFIX,
  MIC_SOURCE,
  isMicSource,
  listAudioSources,
  micDeviceId,
  micSourceId,
  type AudioSourceOption,
} from "./listAudioSources";
import {
  DEFAULT_JEV_SHOW,
  DEFAULT_TRANSCRIBE,
  JEV_TOP_OPTIONS,
  jevScoreVisible,
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

const JevCardHeader = ({
  label,
  pressed,
  ariaLabel,
  onToggle,
  showWhere,
  onShowWhere,
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
  classCount?: number;
  onClassCount?: (next: number) => void;
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
      <div className="jayrr-called-embed__title-actions">
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
        {onClassCount ? (
          <select
            className="jayrr-called-embed__select jayrr-called-embed__select--top"
            value={classCount ?? 1}
            aria-label={`How many ${label} classes show`}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (JEV_TOP_OPTIONS.some((option) => option === next)) {
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
              if (next === "line" || next === "speaker" || next === "both") {
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
    </div>
  </>
);

const IqBadge = ({ composite }: { composite: number }) => {
  const shade: IqShade = shadeFromComposite(composite);
  return (
    <JevTip title={`Verbal IQ ${iqFromComposite(composite)}`}>
      <span
        className={`jayrr-called-embed__iq jayrr-called-embed__iq--${shade}`}
      >
        IQ {iqFromComposite(composite)}
      </span>
    </JevTip>
  );
};

const SmartBadge = ({ smart }: { smart: SmartResult }) => {
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
      </span>
    </JevTip>
  );
};

const EmotionBadge = ({ emotion }: { emotion: EmotionPick }) => (
  <JevTip title={`${emotion.label} · ${emotion.cluster}`}>
    <span
      className={`jayrr-called-embed__emo jayrr-called-embed__emo--${emotion.tone}`}
    >
      {emotion.label}
    </span>
  </JevTip>
);

const MbtiBadge = ({ mbti }: { mbti: MbtiResult }) => (
  <JevTip title={`MBTI ${mbti.type}`}>
    <span className="jayrr-called-embed__iq jayrr-called-embed__mbti">
      {mbti.type}
    </span>
  </JevTip>
);

const CogBadge = ({ fn }: { fn: CogFn }) => (
  <JevTip title={fn}>
    <span
      className={`jayrr-called-embed__iq jayrr-called-embed__fn jayrr-called-embed__fn--${fn.toLowerCase()}`}
    >
      {fn}
    </span>
  </JevTip>
);

const EnneaBadge = ({ ennea }: { ennea: EnneaResult }) => (
  <JevTip title={`Type ${ennea.id} · The ${ennea.name}`}>
    <span
      className={`jayrr-called-embed__iq jayrr-called-embed__ennea jayrr-called-embed__ennea--${ennea.id}`}
    >
      {ennea.label}
    </span>
  </JevTip>
);

const HypeBadge = ({ hype }: { hype: HypeResult }) => {
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
      </span>
    </JevTip>
  );
};

const EnergyBadge = ({ energy }: { energy: EnergyResult }) => {
  const band = ENERGY_BANDS.find((row) => row.id === energy.id);
  return (
    <JevTip
      title={
        band ? `${band.level} ${band.name}` : `${energy.label} ${energy.name}`
      }
      body={band ? band.what : undefined}
    >
      <span
        className={`jayrr-called-embed__iq jayrr-called-embed__energy jayrr-called-embed__energy--${energy.zone} jayrr-called-embed__energy--${energy.id}`}
      >
        {energy.label}
      </span>
    </JevTip>
  );
};

const OnlineBadge = ({ online }: { online: OnlineResult }) => {
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
      </span>
    </JevTip>
  );
};

const SocionBadge = ({ socion }: { socion: SocionResult }) => (
  <JevTip
    title={`${socion.id} ${socion.code4} · ${socion.nick} · ${socion.ego}`}
  >
    <span
      className={`jayrr-called-embed__iq jayrr-called-embed__socion jayrr-called-embed__socion--${
        socion.quadra
      } jayrr-called-embed__socion--${socion.id.toLowerCase()}`}
    >
      {socion.label}
    </span>
  </JevTip>
);

const BigFiveBadge = ({ bigFive }: { bigFive: BigFiveResult }) => (
  <JevTip
    title={bigFive.label}
    body={
      <ul>
        {BIG5_BANDS.map((band) => {
          const trait = bigFive.traits[band.id];
          return (
            <li key={band.id}>
              {band.id} {band.name}: {trait.level}
            </li>
          );
        })}
      </ul>
    }
  >
    <span className="jayrr-called-embed__iq jayrr-called-embed__big5">
      {bigFive.label}
    </span>
  </JevTip>
);

const BigFiveTraitBadge = ({ trait }: { trait: BigFiveTrait }) => (
  <JevTip title={`${trait.name}: ${trait.level}`}>
    <span
      className={`jayrr-called-embed__iq jayrr-called-embed__big5 jayrr-called-embed__big5--${trait.id.toLowerCase()}`}
    >
      {trait.id} {trait.level}
    </span>
  </JevTip>
);

const bigFiveBadges = (bigFive: BigFiveResult, count: number) =>
  count <= 1
    ? [<BigFiveBadge key="all" bigFive={bigFive} />]
    : rankedBigFiveTraits(bigFive, count).map((trait) => (
        <BigFiveTraitBadge key={trait.id} trait={trait} />
      ));

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
      {jevScoreVisible(config, config.jevEmotion, "emotion", "line")
        ? emotions
            .slice(0, jevTopCount(config, "emotion"))
            .map((emotion) => (
              <EmotionBadge key={emotion.id} emotion={emotion} />
            ))
        : null}
      {jevScoreVisible(config, config.jevIq, "iq", "line")
        ? iqScore === undefined
          ? null
          : rankedIqComposites(iqScore, jevTopCount(config, "iq")).map(
              (composite) => <IqBadge key={composite} composite={composite} />,
            )
        : null}
      {jevScoreVisible(config, config.jevSmart, "smart", "line")
        ? smart
          ? rankedSmart(smart, jevTopCount(config, "smart")).map((row) => (
              <SmartBadge key={row.id} smart={row} />
            ))
          : null
        : null}
      {jevScoreVisible(config, config.jevHype, "hype", "line")
        ? hype
          ? rankedHype(hype, jevTopCount(config, "hype")).map((row) => (
              <HypeBadge key={row.id} hype={row} />
            ))
          : null
        : null}
      {jevScoreVisible(config, config.jevEnergy, "energy", "line")
        ? energy
          ? rankedEnergy(energy, jevTopCount(config, "energy")).map((row) => (
              <EnergyBadge key={row.id} energy={row} />
            ))
          : null
        : null}
      {jevScoreVisible(config, config.jevOnline, "online", "line")
        ? online
          ? rankedOnline(online, jevTopCount(config, "online")).map((row) => (
              <OnlineBadge key={row.id} online={row} />
            ))
          : null
        : null}
      {jevScoreVisible(config, config.jevSocion, "socion", "line")
        ? socion
          ? rankedSocion(socion, jevTopCount(config, "socion")).map((row) => (
              <SocionBadge key={row.id} socion={row} />
            ))
          : null
        : null}
      {jevScoreVisible(config, config.jevBigFive, "bigFive", "line")
        ? bigFive
          ? bigFiveBadges(bigFive, jevTopCount(config, "bigFive"))
          : null
        : null}
      {jevScoreVisible(config, config.jevMbti, "mbti", "line")
        ? mbti
          ? rankedMbti(mbti, jevTopCount(config, "mbti")).map((row) => (
              <MbtiBadge key={row.type} mbti={row} />
            ))
          : null
        : null}
      {jevScoreVisible(config, config.jevMbtiAdvance, "mbtiAdvance", "line")
        ? advance
          ? rankedAdvanceFns(advance, jevTopCount(config, "mbtiAdvance")).map(
              (fn) => <CogBadge key={fn} fn={fn} />,
            )
          : null
        : null}
      {jevScoreVisible(config, config.jevEnneagram, "enneagram", "line")
        ? ennea
          ? rankedEnnea(ennea, jevTopCount(config, "enneagram")).map((row) => (
              <EnneaBadge key={row.id} ennea={row} />
            ))
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
  const speakerScores = useMemo(() => {
    void conversation.version;
    const base =
      config.contextEnabled && conversation.topicId !== null
        ? scores.filter(
            (row) =>
              conversation.context.results.get(row.turnId)?.topicId ===
              conversation.topicId,
          )
        : scores;
    return base;
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
      setConfig(next);
      if (save) {
        persist(next);
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
    let adopted: ChatTurn | null = null;
    let skipped = false;
    let incomingIds: string[] = [];
    const leftoverIds = turnsRef.current
      .filter((turn) => !turn.isFinal)
      .map((turn) => turn.id);
    setTurns((current) => {
      const kept = current.filter((turn) => turn.isFinal);
      const incoming = withLiveIds(current, attributed, isFinal);
      incomingIds = incoming.map((turn) => turn.id);
      const packed = mergeChatTurns(incoming);
      const last = kept[kept.length - 1];
      const first = packed[0];
      if (last && first && shouldJoin(last, first)) {
        const joined = asBubbles(
          last,
          joinSentences(last.text, first.text),
          true,
        );
        const nextTurns = [
          ...kept.slice(0, -1),
          ...joined,
          ...packed.slice(1),
        ].slice(-80);
        if (sameChatTurns(current, nextTurns)) {
          skipped = true;
          return current;
        }
        if (isFinal) {
          adopted = joined[0] ?? first;
        }
        return nextTurns;
      }
      const nextTurns = [...kept, ...packed].slice(-80);
      if (sameChatTurns(current, nextTurns)) {
        skipped = true;
        return current;
      }
      if (isFinal) {
        adopted = first ?? null;
      }
      return nextTurns;
    });
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
      const snapshot = liveRef.current;
      const turn = adopted;
      if (
        snapshot &&
        turn &&
        snapshot.text === turn.text.trim() &&
        snapshot.speaker === turn.speaker
      ) {
        scoredTextRef.current.set(
          turn.id,
          `${contextVersionRef.current}:${turn.text.trim()}`,
        );
        setScores((current) =>
          [
            ...current.filter((row) => row.turnId !== turn.id),
            {
              ...snapshot,
              turnId: turn.id,
              speaker: turn.speaker,
              text: turn.text.trim(),
            },
          ].slice(-MAX_SCORED_TURNS),
        );
      }
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
          debugTranscribe("score ok", {
            turnId: job.turnId,
            mbti: row.mbti?.type ?? null,
            socion: row.socion?.id ?? null,
            ennea: row.ennea?.label ?? null,
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
              queueRef.current.push(job);
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
      const previous = scoredTextRef.current.get(turn.id);
      if (previous === `${contextVersionRef.current}:${text}`) {
        return false;
      }
      if (previous?.endsWith(`:${text}`)) {
        const result = conversationFor(elementId).results.get(turn.id);
        if (!result?.provisional) {
          return false;
        }
        debugTranscribe("enqueue retry", {
          turnId: turn.id,
          reason: "provisional",
          version: contextVersionRef.current,
        });
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
    [elementId],
  );

  useEffect(() => {
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
    const map = new Map<string, number>();
    for (const row of scores) {
      if (row.result?.substantive) {
        map.set(row.turnId, row.result.composite);
      }
    }
    return map;
  }, [scores]);

  const iqBySpeaker = useMemo(() => {
    const groups = new Map<number, IqResult[]>();
    for (const row of speakerScores) {
      if (row.speaker === null || !row.result) {
        continue;
      }
      const list = groups.get(row.speaker) ?? [];
      list.push(row.result);
      groups.set(row.speaker, list);
    }
    const map = new Map<number, number>();
    for (const [speaker, rows] of groups) {
      const average = averageIqComposite(rows);
      if (average !== null) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [speakerScores]);

  const emotionByTurn = useMemo(() => {
    const map = new Map<string, EmotionPick[]>();
    for (const row of scores) {
      if (row.emotion.length > 0) {
        map.set(row.turnId, row.emotion);
      }
    }
    return map;
  }, [scores]);

  const emotionBySpeaker = useMemo(() => {
    const groups = new Map<number, EmotionPick[][]>();
    for (const row of speakerScores) {
      if (row.speaker === null || row.emotion.length === 0) {
        continue;
      }
      const list = groups.get(row.speaker) ?? [];
      list.push(row.emotion);
      groups.set(row.speaker, list);
    }
    const map = new Map<number, EmotionPick[]>();
    for (const [speaker, rows] of groups) {
      const average = averageEmotions(rows);
      if (average.length > 0) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [speakerScores]);

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
    const map = new Map<number, MbtiResult>();
    for (const [speaker, rows] of groups) {
      const average = averageMbti(rows);
      if (average) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [speakerScores]);

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
    const map = new Map<number, MbtiAdvanceResult>();
    for (const [speaker, rows] of groups) {
      const average = averageAdvance(rows);
      if (average) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [speakerScores]);

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
    const map = new Map<number, EnneaResult>();
    for (const [speaker, rows] of groups) {
      const average = averageEnnea(rows);
      if (average) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [speakerScores]);

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
    const map = new Map<number, SmartResult>();
    for (const [speaker, rows] of groups) {
      const average = averageSmart(rows);
      if (average) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [speakerScores]);

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
    const map = new Map<number, HypeResult>();
    for (const [speaker, rows] of groups) {
      const average = averageHype(rows);
      if (average) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [speakerScores]);

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
    const map = new Map<number, EnergyResult>();
    for (const [speaker, rows] of groups) {
      const average = averageEnergy(rows);
      if (average) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [speakerScores]);

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
    const map = new Map<number, OnlineResult>();
    for (const [speaker, rows] of groups) {
      const average = averageOnline(rows);
      if (average) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [speakerScores]);

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
    const map = new Map<number, SocionResult>();
    for (const [speaker, rows] of groups) {
      const average = averageSocion(rows);
      if (average) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [speakerScores]);

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
    const map = new Map<number, BigFiveResult>();
    for (const [speaker, rows] of groups) {
      const average = averageBigFive(rows);
      if (average) {
        map.set(speaker, average);
      }
    }
    return map;
  }, [speakerScores]);

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

  return (
    <Tooltip.Provider delayDuration={200} skipDelayDuration={200}>
      <div
        ref={rootRef}
        className="jayrr-called-embed jayrr-called-embed--transcribe"
        onContextMenu={(event) => {
          event.stopPropagation();
        }}
      >
        {config.configOpen ? (
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
                classCount={jevTopCount(config, "iq")}
                onClassCount={(count) => setJevTop("iq", count)}
                onToggle={() => {
                  const next = { ...config, jevIq: !config.jevIq };
                  resetIq();
                  applyConfig(next, true);
                }}
              >
                <div className="jayrr-called-embed__hint">
                  Scores this line’s reasoning density on a 70–160 verbal IQ
                  scale.
                </div>
                <div className="jayrr-called-embed__bands">
                  {IQ_BANDS.map((band) => (
                    <JevTip key={band.label} title={`Verbal IQ ${band.label}`}>
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
                classCount={jevTopCount(config, "hype")}
                onClassCount={(count) => setJevTop("hype", count)}
                onToggle={() => {
                  const next = { ...config, jevHype: !config.jevHype };
                  resetIq();
                  applyConfig(next, true);
                }}
              >
                <div className="jayrr-called-embed__hint">
                  Scores how strongly this line would hold a listener’s
                  attention.
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
                      body={band.what}
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
                classCount={jevTopCount(config, "online")}
                onClassCount={(count) => setJevTop("online", count)}
                onToggle={() => {
                  const next = { ...config, jevOnline: !config.jevOnline };
                  resetIq();
                  applyConfig(next, true);
                }}
              >
                <div className="jayrr-called-embed__hint">
                  Scores how this line treats other people, from troll to
                  wholesome.
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
                label="Socionics type"
                pressed={!!config.jevSocion}
                ariaLabel="Score speech with socionics type"
                container={rootRef.current}
                showWhere={jevShowWhere(config, "socion")}
                onShowWhere={(where) => setJevShow("socion", where)}
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
                      body={band.name}
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
                label="MBTI functions"
                pressed={!!config.jevMbtiAdvance}
                ariaLabel="Score speech with MBTI cognitive functions"
                container={rootRef.current}
                showWhere={jevShowWhere(config, "mbtiAdvance")}
                onShowWhere={(where) => setJevShow("mbtiAdvance", where)}
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
                  Picks the Jungian cognitive function this line is using (Se,
                  Si, Ne, Ni, Te, Ti, Fe, Fi).
                </div>
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
                label="Enneagram type"
                pressed={!!config.jevEnneagram}
                ariaLabel="Score speech with Enneagram type"
                container={rootRef.current}
                showWhere={jevShowWhere(config, "enneagram")}
                onShowWhere={(where) => setJevShow("enneagram", where)}
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
                  Picks the Enneagram habit of attention this line shows (types
                  1–9).
                </div>
                <div className="jayrr-called-embed__bands jayrr-called-embed__bands--ennea">
                  {ENNEA_BANDS.map((band) => (
                    <JevTip
                      key={band.id}
                      title={`Type ${band.id} · The ${band.name}`}
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
                label="Emotion labels"
                pressed={!!config.jevEmotion}
                ariaLabel="Score speech with emotion labels"
                container={rootRef.current}
                showWhere={jevShowWhere(config, "emotion")}
                onShowWhere={(where) => setJevShow("emotion", where)}
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
                    <JevTip key={band.tone} title={band.label}>
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
                  config.jevMbti ||
                  config.jevMbtiAdvance ||
                  config.jevEnneagram ||
                  config.jevHype ||
                  config.jevEnergy ||
                  config.jevOnline ||
                  config.jevSocion ||
                  config.jevBigFive ||
                  config.jevSmart ||
                  config.jevIq ||
                  config.jevEmotion
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
                      jevScoreVisible(config, config.jevMbti, "mbti", "speaker")
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
                    const speakerHype =
                      speaker !== null &&
                      jevScoreVisible(config, config.jevHype, "hype", "speaker")
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
                        {speakerIq === undefined
                          ? null
                          : rankedIqComposites(
                              speakerIq,
                              jevTopCount(config, "iq"),
                            ).map((composite) => (
                              <IqBadge key={composite} composite={composite} />
                            ))}
                        {speakerEmotions
                          ? speakerEmotions
                              .slice(0, jevTopCount(config, "emotion"))
                              .map((emotion) => (
                                <EmotionBadge
                                  key={emotion.id}
                                  emotion={emotion}
                                />
                              ))
                          : null}
                        {speakerSmart
                          ? rankedSmart(
                              speakerSmart,
                              jevTopCount(config, "smart"),
                            ).map((row) => (
                              <SmartBadge key={row.id} smart={row} />
                            ))
                          : null}
                        {speakerMbti
                          ? rankedMbti(
                              speakerMbti,
                              jevTopCount(config, "mbti"),
                            ).map((row) => (
                              <MbtiBadge key={row.type} mbti={row} />
                            ))
                          : null}
                        {speakerAdvance
                          ? rankedAdvanceFns(
                              speakerAdvance,
                              jevTopCount(config, "mbtiAdvance"),
                            ).map((fn) => <CogBadge key={fn} fn={fn} />)
                          : null}
                        {speakerEnnea
                          ? rankedEnnea(
                              speakerEnnea,
                              jevTopCount(config, "enneagram"),
                            ).map((row) => (
                              <EnneaBadge key={row.id} ennea={row} />
                            ))
                          : null}
                        {speakerHype
                          ? rankedHype(
                              speakerHype,
                              jevTopCount(config, "hype"),
                            ).map((row) => (
                              <HypeBadge key={row.id} hype={row} />
                            ))
                          : null}
                        {speakerEnergy
                          ? rankedEnergy(
                              speakerEnergy,
                              jevTopCount(config, "energy"),
                            ).map((row) => (
                              <EnergyBadge key={row.id} energy={row} />
                            ))
                          : null}
                        {speakerOnline
                          ? rankedOnline(
                              speakerOnline,
                              jevTopCount(config, "online"),
                            ).map((row) => (
                              <OnlineBadge key={row.id} online={row} />
                            ))
                          : null}
                        {speakerSocion
                          ? rankedSocion(
                              speakerSocion,
                              jevTopCount(config, "socion"),
                            ).map((row) => (
                              <SocionBadge key={row.id} socion={row} />
                            ))
                          : null}
                        {speakerBigFive
                          ? bigFiveBadges(
                              speakerBigFive,
                              jevTopCount(config, "bigFive"),
                            )
                          : null}
                      </div>
                    );
                  })}
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </Tooltip.Provider>
  );
};
