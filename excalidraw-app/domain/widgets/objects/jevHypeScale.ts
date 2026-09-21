import { JEV_SHARED_EVIDENCE } from "../../transcription/jevSharedState";

const UTTERANCE_SCOPE = `Judge only \`utterance\`. ${JEV_SHARED_EVIDENCE} Score how much this line would hold attention, not whether you personally like the speaker.`;

export type HypeId =
  | "dull"
  | "boring"
  | "mild"
  | "normal"
  | "interesting"
  | "exciting"
  | "hype";

export type HypeBand = {
  id: HypeId;
  label: string;
  what: string;
};

export const HYPE_BANDS: readonly HypeBand[] = [
  {
    id: "dull",
    label: "Dull",
    what: "Gives almost nothing to think or feel about. Attention starts to drift, but the subject may not be bad enough to leave. Little reason to keep going.",
  },
  {
    id: "boring",
    label: "Boring",
    what: "Takes effort to keep paying attention. Too slow, too long, repeated, or not useful. You want to skip parts, check something else, or stop.",
  },
  {
    id: "mild",
    label: "Mild",
    what: "Catches some attention, but the interest is weak. You may continue if it is short or easy, but you would not search for it, save it, or discuss it later.",
  },
  {
    id: "normal",
    label: "Normal",
    what: "Holds attention well enough without a strong feeling. You follow it because it is useful, clear, or fits what you are doing. Once it ends, you usually move on.",
  },
  {
    id: "interesting",
    label: "Interesting",
    what: "Makes you want to know more. You stay focused, ask questions, save it, or look for more details. You may mention it to someone with the same interest.",
  },
  {
    id: "exciting",
    label: "Exciting",
    what: "Creates strong interest and emotion. You want to keep going, try it, join it, buy it, or tell other people about it. You may keep thinking about it after.",
  },
  {
    id: "hype",
    label: "Hype",
    what: "Creates very high excitement across many people. People talk about it, share it, follow updates, and rush so they do not miss out. Attention may be greater than its lasting value.",
  },
];

export const HYPE_QUESTION_ID = "hype";
const HYPE_TOP = HYPE_BANDS.length - 1;

export const HYPE_QUESTION = {
  id: HYPE_QUESTION_ID,
  type: "score" as const,
  instructions: `How much would \`utterance\` hold a listener's attention? Score the pull of this line, not a running speaker mean. ${UTTERANCE_SCOPE}`,
  levels: HYPE_BANDS.map((band) => ({
    what: `${band.label}. ${band.what}`,
    examples: [] as string[],
  })),
};

export type HypeResult = {
  id: HypeId;
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
  Math.min(HYPE_TOP, Math.max(0, Math.round(value)));

const resultFromScore = (
  score: number,
  confidence: number,
): HypeResult | null => {
  const index = clampScore(score);
  const band = HYPE_BANDS[index];
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

export const hypeFromAnswers = (
  answers: ReadonlyArray<{ id: string; type: string }>,
): HypeResult | null => {
  const answer = answers.find(
    (row): row is ScoreAnswer =>
      row.id === HYPE_QUESTION_ID && row.type === "score",
  );
  if (!answer) {
    throw new Error("Jev omitted the hype score.");
  }
  return resultFromScore(
    answer.score,
    typeof answer.confidence === "number" ? answer.confidence : 0,
  );
};

export const rankedHype = (row: HypeResult, count: number): HypeResult[] => {
  const picked: HypeResult[] = [];
  for (let dist = 0; picked.length < count && dist <= HYPE_TOP; dist += 1) {
    const candidates =
      dist === 0 ? [row.score] : [row.score + dist, row.score - dist];
    for (const next of candidates) {
      const mapped = resultFromScore(next, row.confidence);
      if (!mapped || picked.some((item) => item.id === mapped.id)) {
        continue;
      }
      picked.push(mapped);
      if (picked.length >= count) {
        break;
      }
    }
  }
  return picked;
};

export const averageHype = (rows: readonly HypeResult[]): HypeResult | null => {
  if (rows.length === 0) {
    return null;
  }
  const score = rows.reduce((sum, row) => sum + row.score, 0) / rows.length;
  const confidence =
    rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length;
  return resultFromScore(score, confidence);
};
