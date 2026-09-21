const UTTERANCE_SCOPE =
  "Judge only `utterance`. `previous_text` is recent talk before this line; use it to read fragments and replies, not as extra speech to score. Each trait is a spectrum, not a type. Score how this line behaves, not a life diagnosis.";

export type BigFiveId = "O" | "C" | "E" | "A" | "N";

export type BigFiveBand = {
  id: BigFiveId;
  name: string;
  what: string;
};

const LEVELS = [
  {
    label: "Very low",
    what: "The low end of this trait. The line clearly shows the opposite of the high description.",
  },
  {
    label: "Low",
    what: "Below average. Some of the low-end pattern, without the full high-end pattern.",
  },
  {
    label: "Average",
    what: "Mixed or ordinary. Neither pole stands out in this line.",
  },
  {
    label: "High",
    what: "Above average. The high-end pattern is clear, but not extreme.",
  },
  {
    label: "Very high",
    what: "The high end of this trait. The line strongly matches the high description.",
  },
] as const;

export const BIG5_BANDS: readonly BigFiveBand[] = [
  {
    id: "O",
    name: "Openness",
    what: "Creativity, curiosity, and willingness to entertain new ideas. High: imagination, unusual ideas, art, emotion, adventure, variety. Low: pragmatic, data-driven, prefers the familiar, can sound closed-minded.",
  },
  {
    id: "C",
    name: "Conscientiousness",
    what: "Self-control, diligence, and attention to detail. High: prepared, dutiful, planned, exacting. Low: flexible and spontaneous, or messy and unreliable.",
  },
  {
    id: "E",
    name: "Extraversion",
    what: "Boldness, energy, and social interactivity. High: talkative, enthusiastic, action-oriented, externally engaged. Low: quieter, reserved, independent of the social scene, needs less stimulation.",
  },
  {
    id: "A",
    name: "Agreeableness",
    what: "Kindness, helpfulness, and willingness to cooperate. High: getting along, considerate, trusting, compromise. Low: self-interest first, competitive, skeptical, can sound unfriendly.",
  },
  {
    id: "N",
    name: "Neuroticism",
    what: "Depression, irritability, and proneness to anxiety. High: easily upset, worry, mood swings, stress. Low: calm, emotionally stable, less reactive. Low neuroticism is not the same as extraverted cheer.",
  },
];

const BIG5_TOP = LEVELS.length - 1;

const questionFor = (band: BigFiveBand) => ({
  id: `big5_${band.id.toLowerCase()}`,
  type: "score" as const,
  instructions: `How much ${band.name} (${band.id}) does \`utterance\` show? ${band.what} ${UTTERANCE_SCOPE}`,
  levels: LEVELS.map((level) => ({
    what: `${level.label}. ${level.what}`,
    examples: [] as string[],
  })),
});

export const BIG5_QUESTIONS = BIG5_BANDS.map(questionFor);

export type BigFiveTrait = {
  id: BigFiveId;
  name: string;
  score: number;
  level: string;
  confidence: number;
};

export type BigFiveResult = {
  traits: Record<BigFiveId, BigFiveTrait>;
  label: string;
  confidence: number;
};

type ScoreAnswer = {
  id: string;
  type: "score";
  score: number;
  confidence?: number;
};

const clampScore = (value: number) =>
  Math.min(BIG5_TOP, Math.max(0, Math.round(value)));

const traitFromScore = (
  band: BigFiveBand,
  score: number,
  confidence: number,
): BigFiveTrait => {
  const index = clampScore(score);
  const level = LEVELS[index];
  return {
    id: band.id,
    name: band.name,
    score: index,
    level: level?.label ?? "Average",
    confidence,
  };
};

const labelFromTraits = (traits: Record<BigFiveId, BigFiveTrait>) =>
  BIG5_BANDS.map((band) => `${band.id}${traits[band.id].score + 1}`).join(" ");

const resultFromTraits = (
  traits: Record<BigFiveId, BigFiveTrait>,
): BigFiveResult => {
  const confidence =
    BIG5_BANDS.reduce((sum, band) => sum + traits[band.id].confidence, 0) /
    BIG5_BANDS.length;
  return {
    traits,
    label: labelFromTraits(traits),
    confidence,
  };
};

export const bigFiveFromAnswers = (
  answers: ReadonlyArray<{ id: string; type: string }>,
): BigFiveResult | null => {
  const traits = {} as Record<BigFiveId, BigFiveTrait>;
  for (const band of BIG5_BANDS) {
    const questionId = `big5_${band.id.toLowerCase()}`;
    const answer = answers.find(
      (row): row is ScoreAnswer =>
        row.id === questionId && row.type === "score",
    );
    if (!answer) {
      throw new Error(`Jev omitted the ${band.name} score.`);
    }
    traits[band.id] = traitFromScore(
      band,
      answer.score,
      typeof answer.confidence === "number" ? answer.confidence : 0,
    );
  }
  return resultFromTraits(traits);
};

const BIG5_MID = (LEVELS.length - 1) / 2;

export const rankedBigFiveTraits = (
  row: BigFiveResult,
  count: number,
): BigFiveTrait[] =>
  BIG5_BANDS.map((band) => row.traits[band.id])
    .filter((trait): trait is BigFiveTrait => !!trait)
    .sort((left, right) => {
      const delta =
        Math.abs(right.score - BIG5_MID) - Math.abs(left.score - BIG5_MID);
      if (delta !== 0) {
        return delta;
      }
      return right.confidence - left.confidence;
    })
    .slice(0, Math.max(0, count));

export const averageBigFive = (
  rows: readonly BigFiveResult[],
): BigFiveResult | null => {
  if (rows.length === 0) {
    return null;
  }
  const traits = {} as Record<BigFiveId, BigFiveTrait>;
  for (const band of BIG5_BANDS) {
    const score =
      rows.reduce((sum, row) => sum + row.traits[band.id].score, 0) /
      rows.length;
    const confidence =
      rows.reduce((sum, row) => sum + row.traits[band.id].confidence, 0) /
      rows.length;
    traits[band.id] = traitFromScore(band, score, confidence);
  }
  return resultFromTraits(traits);
};
