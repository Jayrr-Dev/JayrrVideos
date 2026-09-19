export type TranscriptTurn = {
  speaker: number | null;
  text: string;
};

type WordStamp = {
  word?: unknown;
  speaker?: unknown;
};

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
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.trunc(value);
};

export const turnsFromWords = (words: WordStamp[]): TranscriptTurn[] => {
  const turns: TranscriptTurn[] = [];
  for (const stamp of words) {
    const token = typeof stamp.word === "string" ? stamp.word.trim() : "";
    if (!token) {
      continue;
    }
    const speaker = readSpeaker(stamp.speaker);
    const last = turns[turns.length - 1];
    if (last && last.speaker === speaker) {
      last.text = joinToken(last.text, token);
      continue;
    }
    turns.push({ speaker, text: token });
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

const SPEAKER_NAMES = [
  "Bob",
  "Jason",
  "Jev",
  "Devin",
  "Elon",
  "Maya",
  "Sam",
  "Nico",
  "Priya",
  "Alex",
  "Kim",
  "Jordan",
  "Riley",
  "Tess",
  "Omar",
  "Luca",
  "Sage",
  "Quinn",
  "Mira",
  "Theo",
];

export const pickSpeakerName = (taken: string[]) => {
  const used = new Set(
    taken.map((name) => name.trim().toLowerCase()).filter(Boolean),
  );
  const free = SPEAKER_NAMES.filter((name) => !used.has(name.toLowerCase()));
  if (free.length === 0) {
    return `Guest ${taken.length + 1}`;
  }
  const index = Math.floor(Math.random() * free.length);
  return free[index] ?? "Guest";
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
  return names[speaker] ?? "Guest";
};
