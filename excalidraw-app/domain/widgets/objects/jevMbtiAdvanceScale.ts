const UTTERANCE_SCOPE =
  "Judge only `utterance`. `previous_text` is recent talk before this line; use it to read fragments and replies, not as extra speech to type. Score the cognitive function this line is using, not a life diagnosis.";

export type CogFn = "Se" | "Si" | "Ne" | "Ni" | "Te" | "Ti" | "Fe" | "Fi";

type CogDef = {
  id: CogFn;
  attitude: "E" | "I";
  axis: "perceive" | "judge";
  family: "S" | "N" | "T" | "F";
  option: string;
};

export const COG_FUNCTIONS: readonly CogDef[] = [
  {
    id: "Se",
    attitude: "E",
    axis: "perceive",
    family: "S",
    option:
      "Extraverted Sensing. Immersed in the present, acts on what is here now, improvises, seizes chances. Adventurous, realistic, sensory.",
  },
  {
    id: "Si",
    attitude: "I",
    axis: "perceive",
    family: "S",
    option:
      "Introverted Sensing. Compares now with memory, prefers the familiar, details, routines, what has worked. Reliable, meticulous, traditional.",
  },
  {
    id: "Ne",
    attitude: "E",
    axis: "perceive",
    family: "N",
    option:
      "Extraverted Intuition. Generates alternatives and connections, plays with ideas, sees potential everywhere. Creative, curious, scattered if stretched.",
  },
  {
    id: "Ni",
    attitude: "I",
    axis: "perceive",
    family: "N",
    option:
      "Introverted Intuition. One inner vision, hidden pattern, forecast. Insightful, strategic, converges instead of branching.",
  },
  {
    id: "Te",
    attitude: "E",
    axis: "judge",
    family: "T",
    option:
      "Extraverted Thinking. Organizes the outer world for results, plans, metrics, efficiency. Decisive, pragmatic, systems and execution.",
  },
  {
    id: "Ti",
    attitude: "I",
    axis: "judge",
    family: "T",
    option:
      "Introverted Thinking. Internal logic, precise models, finds the flaw. Independent, accuracy over harmony, challenges assumptions.",
  },
  {
    id: "Fe",
    attitude: "E",
    axis: "judge",
    family: "F",
    option:
      "Extraverted Feeling. Reads the room, group values, mood, belonging. Empathetic, expressive, people over things.",
  },
  {
    id: "Fi",
    attitude: "I",
    axis: "judge",
    family: "F",
    option:
      "Introverted Feeling. Personal values and identity, sincere, individual. Ethics over logic, meaning and authenticity.",
  },
];

const COG_BY_ID = new Map(COG_FUNCTIONS.map((row) => [row.id, row]));

export const COG_BANDS: readonly CogFn[] = COG_FUNCTIONS.map((row) => row.id);

export const COG_QUESTION_ID = "cogfn";

const cogOptions = () => {
  const options: Record<string, string> = {};
  for (const row of COG_FUNCTIONS) {
    options[row.id] = row.option;
  }
  return options;
};

export const COG_QUESTION = {
  id: COG_QUESTION_ID,
  type: "choice" as const,
  instructions: `Which Jungian cognitive function is \`utterance\` using? The choice is the strongest. Spread probability so the supporting function is visible. ${UTTERANCE_SCOPE} Do not score four-letter preference letters. Score the mental process: Se Si Ne Ni Te Ti Fe Fi.`,
  options: cogOptions(),
};

export type MbtiAdvanceResult = {
  type: string;
  dominant: CogFn;
  auxiliary: CogFn;
  stack: CogFn[];
  confidence: number;
  probabilities: Record<CogFn, number>;
};

type ChoiceAnswer = {
  id: string;
  type: "choice";
  choice?: string;
  probabilities?: Record<string, number>;
  confidence?: number;
};

const OPPOSITE: Record<CogFn, CogFn> = {
  Se: "Ni",
  Si: "Ne",
  Ne: "Si",
  Ni: "Se",
  Te: "Fi",
  Ti: "Fe",
  Fe: "Ti",
  Fi: "Te",
};

const emptyProbabilities = (): Record<CogFn, number> => ({
  Se: 0,
  Si: 0,
  Ne: 0,
  Ni: 0,
  Te: 0,
  Ti: 0,
  Fe: 0,
  Fi: 0,
});

const isCogFn = (id: string): id is CogFn => COG_BY_ID.has(id as CogFn);

const pairsWith = (dominant: CogFn, other: CogFn) => {
  const hero = COG_BY_ID.get(dominant);
  const parent = COG_BY_ID.get(other);
  if (!hero || !parent) {
    return false;
  }
  return hero.attitude !== parent.attitude && hero.axis !== parent.axis;
};

const rankedFns = (probabilities: Record<CogFn, number>) =>
  COG_BANDS.slice().sort(
    (left, right) => (probabilities[right] ?? 0) - (probabilities[left] ?? 0),
  );

const pickDominant = (
  probabilities: Record<CogFn, number>,
  fallback: CogFn | null,
): CogFn | null => {
  if (fallback && isCogFn(fallback)) {
    return fallback;
  }
  const [first] = rankedFns(probabilities);
  if (!first || (probabilities[first] ?? 0) <= 0) {
    return null;
  }
  return first;
};

const pickAuxiliary = (
  dominant: CogFn,
  probabilities: Record<CogFn, number>,
): CogFn => {
  for (const id of rankedFns(probabilities)) {
    if (id !== dominant && pairsWith(dominant, id)) {
      return id;
    }
  }
  const hero = COG_BY_ID.get(dominant);
  const fallback = COG_FUNCTIONS.find(
    (row) =>
      row.id !== dominant &&
      hero &&
      row.attitude !== hero.attitude &&
      row.axis !== hero.axis,
  );
  return fallback?.id ?? (dominant === "Ni" ? "Te" : "Ni");
};

const typeFromStack = (dominant: CogFn, auxiliary: CogFn) => {
  const hero = COG_BY_ID.get(dominant);
  const parent = COG_BY_ID.get(auxiliary);
  if (!hero || !parent) {
    return "????";
  }
  const energy = hero.attitude;
  const perceive = hero.axis === "perceive" ? hero.family : parent.family;
  const judge = hero.axis === "judge" ? hero.family : parent.family;
  const outer = energy === "E" ? hero : parent;
  const lifestyle = outer.axis === "judge" ? "J" : "P";
  return `${energy}${perceive}${judge}${lifestyle}`;
};

const stackFromPair = (dominant: CogFn, auxiliary: CogFn): CogFn[] => [
  dominant,
  auxiliary,
  OPPOSITE[auxiliary],
  OPPOSITE[dominant],
];

const resultFromProbabilities = (
  probabilities: Record<CogFn, number>,
  chosen: CogFn | null,
): MbtiAdvanceResult | null => {
  const dominant = pickDominant(probabilities, chosen);
  if (!dominant) {
    return null;
  }
  const auxiliary = pickAuxiliary(dominant, probabilities);
  return {
    type: typeFromStack(dominant, auxiliary),
    dominant,
    auxiliary,
    stack: stackFromPair(dominant, auxiliary),
    confidence: Math.max(
      probabilities[dominant] ?? 0,
      probabilities[auxiliary] ?? 0,
    ),
    probabilities,
  };
};

export const advanceFromAnswers = (
  answers: ReadonlyArray<{ id: string; type: string }>,
): MbtiAdvanceResult | null => {
  const answer = answers.find(
    (row): row is ChoiceAnswer =>
      row.id === COG_QUESTION_ID && row.type === "choice",
  );
  if (!answer) {
    throw new Error("Jev omitted the cognitive function scores.");
  }
  const probabilities = emptyProbabilities();
  for (const [id, value] of Object.entries(answer.probabilities ?? {})) {
    if (isCogFn(id)) {
      probabilities[id] = value;
    }
  }
  const chosen = answer.choice && isCogFn(answer.choice) ? answer.choice : null;
  if (chosen && (probabilities[chosen] ?? 0) <= 0) {
    probabilities[chosen] =
      typeof answer.confidence === "number" ? answer.confidence : 1;
  }
  return resultFromProbabilities(probabilities, chosen);
};

export const averageAdvance = (
  rows: readonly MbtiAdvanceResult[],
): MbtiAdvanceResult | null => {
  if (rows.length === 0) {
    return null;
  }
  const probabilities = emptyProbabilities();
  for (const id of COG_BANDS) {
    let sum = 0;
    for (const row of rows) {
      sum += row.probabilities[id] ?? 0;
    }
    probabilities[id] = sum / rows.length;
  }
  return resultFromProbabilities(probabilities, null);
};

export const advanceStackLabel = (row: MbtiAdvanceResult) =>
  `${row.dominant}-${row.auxiliary}`;

export const rankedAdvanceFns = (
  row: MbtiAdvanceResult,
  count: number,
): CogFn[] => row.stack.slice(0, Math.max(0, count));
