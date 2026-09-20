const UTTERANCE_SCOPE =
  "Judge only `utterance`. `previous_text` is recent talk before this line; use it to read fragments and replies, not as extra speech to score. Score how well this line understands the situation, not a lifetime IQ or whether you like the speaker.";

export type SmartId =
  | "clueless"
  | "dumb"
  | "basic"
  | "normal"
  | "smart"
  | "brilliant"
  | "genius";

export type SmartBand = {
  id: SmartId;
  label: string;
  what: string;
};

export const SMART_BANDS: readonly SmartBand[] = [
  {
    id: "clueless",
    label: "Clueless",
    what: "Does not understand what is happening and makes choices without knowing the basic facts.",
  },
  {
    id: "dumb",
    label: "Dumb",
    what: "Understands simple things but often misses clear clues, repeats mistakes, or chooses answers that do not make sense.",
  },
  {
    id: "basic",
    label: "Basic",
    what: "Knows enough to handle easy problems but struggles when a problem has several steps or needs deeper thought.",
  },
  {
    id: "normal",
    label: "Normal",
    what: "Understands most everyday problems, learns at a normal speed, and usually makes reasonable choices.",
  },
  {
    id: "smart",
    label: "Smart",
    what: "Learns quickly, notices patterns, asks good questions, and solves hard problems with less help.",
  },
  {
    id: "brilliant",
    label: "Brilliant",
    what: "Understands complex ideas very quickly, makes strong links between ideas, and finds answers most people miss.",
  },
  {
    id: "genius",
    label: "Genius",
    what: "Thinks in rare and original ways, solves problems that stop almost everyone else, and may create ideas that change an entire field.",
  },
];

export const SMART_QUESTION_ID = "smart";
const SMART_TOP = SMART_BANDS.length - 1;

export const SMART_QUESTION = {
  id: SMART_QUESTION_ID,
  type: "score" as const,
  instructions: `How clearly does \`utterance\` understand what is going on? Score the thinking in this line, not a running speaker mean. Do not jump to Brilliant or Genius unless the line actually shows rare, original, or field-changing thought. ${UTTERANCE_SCOPE}`,
  levels: SMART_BANDS.map((band) => ({
    what: `${band.label}. ${band.what}`,
    examples: [] as string[],
  })),
};

export type SmartResult = {
  id: SmartId;
  label: string;
  score: number;
  confidence: number;
};

type ScoreAnswer = {
  id: string;
  type: "score";
  score: number;
  confidence?: number;
};

const clampScore = (value: number) =>
  Math.min(SMART_TOP, Math.max(0, Math.round(value)));

const resultFromScore = (
  score: number,
  confidence: number,
): SmartResult | null => {
  const index = clampScore(score);
  const band = SMART_BANDS[index];
  if (!band) {
    return null;
  }
  return {
    id: band.id,
    label: band.label,
    score: index,
    confidence,
  };
};

export const smartFromAnswers = (
  answers: ReadonlyArray<{ id: string; type: string }>,
): SmartResult | null => {
  const answer = answers.find(
    (row): row is ScoreAnswer =>
      row.id === SMART_QUESTION_ID && row.type === "score",
  );
  if (!answer) {
    throw new Error("Jev omitted the smart score.");
  }
  return resultFromScore(
    answer.score,
    typeof answer.confidence === "number" ? answer.confidence : 0,
  );
};

export const averageSmart = (
  rows: readonly SmartResult[],
): SmartResult | null => {
  if (rows.length === 0) {
    return null;
  }
  const score = rows.reduce((sum, row) => sum + row.score, 0) / rows.length;
  const confidence =
    rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length;
  return resultFromScore(score, confidence);
};
