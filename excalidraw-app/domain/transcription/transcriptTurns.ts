export type TranscriptTurn = {
  speaker: number | null;
  text: string;
  startMs?: number;
  endMs?: number;
};

type WordStamp = {
  word?: unknown;
  punctuated_word?: unknown;
  speaker?: unknown;
  speaker_id?: unknown;
  startMs?: unknown;
  startTimeMs?: unknown;
  startTime?: unknown;
  startOffset?: unknown;
  start?: unknown;
  start_time?: unknown;
  endMs?: unknown;
  endTimeMs?: unknown;
  endTime?: unknown;
  endOffset?: unknown;
  end?: unknown;
  end_time?: unknown;
};

// A longer hesitation, not a breath. Split the bubble when silence hits this.
const PAUSE_SPLIT_MS = 2200;

const START_TIME_KEYS = [
  "startTimeMs",
  "startMs",
  "startTime",
  "startOffset",
  "start",
  "start_time",
] as const;

const END_TIME_KEYS = [
  "endTimeMs",
  "endMs",
  "endTime",
  "endOffset",
  "end",
  "end_time",
] as const;

const MILLISECOND_KEYS = new Set([
  "startTimeMs",
  "endTimeMs",
  "startMs",
  "endMs",
]);

const joinToken = (left: string, right: string) => {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  if (/^[,.?!:;]/.test(right) || left.endsWith(" ") || right.startsWith(" ")) {
    return `${left}${right}`;
  }
  return `${left} ${right}`;
};

const readSpeaker = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return null;
};

const readTimeMs = (value: unknown, unit: "ms" | "auto"): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    if (unit === "ms") {
      return value;
    }
    if (Number.isInteger(value) && value >= 100) {
      return value;
    }
    return value * 1000;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    const seconds = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*s$/i);
    if (seconds?.[1]) {
      return Math.round(Number(seconds[1]) * 1000);
    }
    const millis = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*ms$/i);
    if (millis?.[1]) {
      return Math.round(Number(millis[1]));
    }
    const plain = Number(trimmed);
    if (Number.isFinite(plain) && plain >= 0) {
      if (unit === "ms") {
        return plain;
      }
      if (Number.isInteger(plain) && plain >= 100) {
        return plain;
      }
      return plain * 1000;
    }
  }
  if (value && typeof value === "object") {
    const rec = value as { seconds?: unknown; nanos?: unknown; ms?: unknown };
    if (typeof rec.ms === "number" && Number.isFinite(rec.ms)) {
      return rec.ms;
    }
    const sec =
      typeof rec.seconds === "number"
        ? rec.seconds
        : typeof rec.seconds === "string"
        ? Number(rec.seconds)
        : null;
    const nano = typeof rec.nanos === "number" ? rec.nanos : 0;
    if (sec !== null && Number.isFinite(sec)) {
      return Math.round(sec * 1000 + nano / 1e6);
    }
  }
  return null;
};

const stampTime = (stamp: WordStamp, keys: readonly (keyof WordStamp)[]) => {
  for (const key of keys) {
    const unit = MILLISECOND_KEYS.has(key) ? "ms" : "auto";
    const ms = readTimeMs(stamp[key], unit);
    if (ms !== null) {
      return ms;
    }
  }
  return null;
};

const stampWord = (stamp: WordStamp) => {
  if (
    typeof stamp.punctuated_word === "string" &&
    stamp.punctuated_word.trim()
  ) {
    return stamp.punctuated_word.trim();
  }
  if (typeof stamp.word === "string" && stamp.word.trim()) {
    return stamp.word.trim();
  }
  return "";
};

const fillNearbySpeakers = (
  tokens: Array<{
    speaker: number | null;
    startMs: number | null;
    endMs: number | null;
  }>,
) => {
  let last: number | null = null;
  let lastEndMs: number | null = null;
  for (const token of tokens) {
    const pauseMs =
      token.startMs !== null && lastEndMs !== null
        ? token.startMs - lastEndMs
        : 0;
    if (token.speaker === null && last !== null && pauseMs < PAUSE_SPLIT_MS) {
      token.speaker = last;
    }
    if (token.speaker !== null) {
      last = token.speaker;
    }
    lastEndMs = token.endMs ?? token.startMs ?? lastEndMs;
  }
  last = null;
  let nextStartMs: number | null = null;
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index];
    if (!token) {
      continue;
    }
    const pauseMs =
      nextStartMs !== null && token.endMs !== null
        ? nextStartMs - token.endMs
        : 0;
    if (token.speaker === null && last !== null && pauseMs < PAUSE_SPLIT_MS) {
      token.speaker = last;
    }
    if (token.speaker !== null) {
      last = token.speaker;
    }
    nextStartMs = token.startMs ?? token.endMs ?? nextStartMs;
  }
};

export const turnsFromWords = (words: WordStamp[]): TranscriptTurn[] => {
  const tokens: Array<{
    token: string;
    speaker: number | null;
    startMs: number | null;
    endMs: number | null;
  }> = [];
  for (const stamp of words) {
    const token = stampWord(stamp);
    if (!token) {
      continue;
    }
    const startMs = stampTime(stamp, START_TIME_KEYS);
    const endMs = stampTime(stamp, END_TIME_KEYS) ?? startMs;
    tokens.push({
      token,
      speaker: readSpeaker(stamp.speaker) ?? readSpeaker(stamp.speaker_id),
      startMs,
      endMs,
    });
  }
  fillNearbySpeakers(tokens);
  const turns: TranscriptTurn[] = [];
  let lastEndMs: number | null = null;
  for (const word of tokens) {
    const last = turns[turns.length - 1];
    const pauseMs =
      word.startMs !== null && lastEndMs !== null
        ? word.startMs - lastEndMs
        : 0;
    const newBubble =
      !last || last.speaker !== word.speaker || pauseMs >= PAUSE_SPLIT_MS;
    if (newBubble) {
      turns.push({
        speaker: word.speaker,
        text: word.token,
        ...(word.startMs !== null ? { startMs: word.startMs } : {}),
        ...(word.endMs !== null ? { endMs: word.endMs } : {}),
      });
    } else if (last) {
      last.text = joinToken(last.text, word.token);
      if (word.endMs !== null) {
        last.endMs = word.endMs;
      }
    }
    lastEndMs = word.endMs ?? word.startMs ?? lastEndMs;
  }
  return turns;
};

export const turnsFromTranscript = (
  transcript: string,
  words?: WordStamp[],
): TranscriptTurn[] => {
  if (words && words.length > 0) {
    const grouped = turnsFromWords(words);
    if (grouped.length > 0) {
      return grouped;
    }
  }
  const text = transcript.trim();
  if (!text) {
    return [];
  }
  return [{ speaker: null, text }];
};

const speakerLetterName = (index: number) => {
  let n = Math.max(0, index);
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `Speaker ${label}`;
};

export const pickSpeakerName = (taken: string[]) => {
  const used = new Set(
    taken.map((name) => name.trim().toLowerCase()).filter(Boolean),
  );
  let index = 0;
  while (used.has(speakerLetterName(index).toLowerCase())) {
    index += 1;
  }
  return speakerLetterName(index);
};

export const ensureSpeakerNames = (
  names: Record<number, string>,
  speakers: Array<number | null>,
) => {
  let next = names;
  for (const speaker of speakers) {
    if (speaker === null || next[speaker]) {
      continue;
    }
    if (next === names) {
      next = { ...names };
    }
    next[speaker] = pickSpeakerName(Object.values(next));
  }
  return next;
};

const CUE_MAX_MS = 8000;
const CUE_GAP_MS = 2500;

const formatClock = (ms: number) => {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      seconds,
    ).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

type TranscriptCue = {
  startMs: number;
  lastMs: number;
  speaker: number | null;
  text: string;
};

const buildTranscriptCues = (
  turns: Array<{
    speaker: number | null;
    text: string;
    startMs?: number;
  }>,
): TranscriptCue[] => {
  const cues: TranscriptCue[] = [];
  for (const turn of turns) {
    const body = turn.text.trim();
    if (!body) {
      continue;
    }
    const at = turn.startMs ?? cues[cues.length - 1]?.lastMs ?? 0;
    const last = cues[cues.length - 1];
    const pause = last ? at - last.lastMs : 0;
    const held = last ? at - last.startMs : 0;
    const newCue =
      !last ||
      last.speaker !== turn.speaker ||
      pause >= CUE_GAP_MS ||
      held >= CUE_MAX_MS;
    if (newCue) {
      cues.push({
        startMs: at,
        lastMs: at,
        speaker: turn.speaker,
        text: body,
      });
      continue;
    }
    last.text = joinToken(last.text, body);
    last.lastMs = at;
  }
  return cues;
};

export const formatVideoTranscript = (
  turns: Array<{
    speaker: number | null;
    text: string;
    startMs?: number;
  }>,
  names: Record<number, string> = {},
): string => {
  const cues = buildTranscriptCues(turns);
  const named = new Set(
    cues
      .map((cue) => cue.speaker)
      .filter((speaker): speaker is number => speaker !== null),
  );
  const showNames = named.size > 1;
  return cues
    .map((cue) => {
      const who =
        showNames && cue.speaker !== null
          ? `${speakerLabel(cue.speaker, names)}\n`
          : "";
      return `${formatClock(cue.startMs)}\n${who}${cue.text}`;
    })
    .join("\n\n");
};

const CAPTION_LINE = 42;
const CAPTION_LINES = 2;

const wrapCaptionLines = (text: string) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [""];
  for (const word of words) {
    const line = lines[lines.length - 1] ?? "";
    const next = line ? `${line} ${word}` : word;
    if (next.length <= CAPTION_LINE || !line) {
      lines[lines.length - 1] = next;
      continue;
    }
    lines.push(word);
    if (lines.length > CAPTION_LINES) {
      lines.shift();
    }
  }
  return lines.filter(Boolean).join("\n");
};

const lastSentences = (text: string) => {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return text.trim();
  }
  let chunk = "";
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const next = chunk ? `${parts[index]} ${chunk}` : parts[index];
    if (chunk && next.length > CAPTION_LINE * CAPTION_LINES) {
      break;
    }
    chunk = next;
  }
  return chunk;
};

export const formatLiveCaption = (
  turns: Array<{
    speaker: number | null;
    text: string;
    startMs?: number;
  }>,
  names: Record<number, string> = {},
  opts?: { clock?: boolean },
): string => {
  const cues = buildTranscriptCues(turns);
  const cue = cues[cues.length - 1];
  if (!cue) {
    return "";
  }
  const showClock = opts?.clock !== false;
  const otherSpeaker = cues.some(
    (item) => item.speaker !== null && item.speaker !== cue.speaker,
  );
  const who =
    showClock && otherSpeaker && cue.speaker !== null
      ? `${speakerLabel(cue.speaker, names)}\n`
      : "";
  const body = wrapCaptionLines(lastSentences(cue.text));
  if (!showClock) {
    return body;
  }
  return `${formatClock(cue.startMs)}\n${who}${body}`;
};

export const speakerLabel = (
  speaker: number | null,
  names: Record<number, string>,
) => {
  if (speaker === null) {
    return "Unknown";
  }
  const named = names[speaker]?.trim();
  if (named) {
    return named;
  }
  return speakerLetterName(speaker);
};
