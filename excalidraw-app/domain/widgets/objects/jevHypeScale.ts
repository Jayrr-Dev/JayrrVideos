import { JEV_SHARED_EVIDENCE } from "../../transcription/jevSharedState";

import {
  averageScore,
  rankedScore,
  scoreFromAnswers,
  scoreQuestion,
  type ScoreBand,
  type ScoreResult,
} from "./jevScoreScale";

const UTTERANCE_SCOPE = `Judge only \`utterance\`. ${JEV_SHARED_EVIDENCE} Score how much this line would hold attention, not whether you personally like the speaker.`;

export type HypeId =
  | "dull"
  | "boring"
  | "mild"
  | "normal"
  | "interesting"
  | "exciting"
  | "hype";

export type HypeBand = ScoreBand<HypeId>;

export const HYPE_BANDS: readonly HypeBand[] = [
  {
    id: "dull",
    label: "Dull",
    what: "Gives almost nothing to think or feel about. Attention starts to drift, but the subject may not be bad enough to leave. Little reason to keep going.",
    example: "Yeah. Okay. Anyway.",
  },
  {
    id: "boring",
    label: "Boring",
    what: "Takes effort to keep paying attention. Too slow, too long, repeated, or not useful. You want to skip parts, check something else, or stop.",
    example:
      "As I said before, and as I also said last time, we should maybe think about it.",
  },
  {
    id: "mild",
    label: "Mild",
    what: "Catches some attention, but the interest is weak. You may continue if it is short or easy, but you would not search for it, save it, or discuss it later.",
    example: "There is a new version out. It looks fine.",
  },
  {
    id: "normal",
    label: "Normal",
    what: "Holds attention well enough without a strong feeling. You follow it because it is useful, clear, or fits what you are doing. Once it ends, you usually move on.",
    example: "Here is the plan for tomorrow, then we can stop.",
  },
  {
    id: "interesting",
    label: "Interesting",
    what: "Makes you want to know more. You stay focused, ask questions, save it, or look for more details. You may mention it to someone with the same interest.",
    example:
      "Wait, that would mean the first test was measuring the wrong thing.",
  },
  {
    id: "exciting",
    label: "Exciting",
    what: "Creates strong interest and emotion. You want to keep going, try it, join it, buy it, or tell other people about it. You may keep thinking about it after.",
    example: "We actually got it working. You have to see this.",
  },
  {
    id: "hype",
    label: "Hype",
    what: "Creates very high excitement across many people. People talk about it, share it, follow updates, and rush so they do not miss out. Attention may be greater than its lasting value.",
    example: "Drop everything. This changes the whole field overnight.",
  },
];

export const HYPE_QUESTION_ID = "hype";

export const HYPE_QUESTION = scoreQuestion(
  HYPE_QUESTION_ID,
  `How much would \`utterance\` hold a listener's attention? Score the pull of this line, not a running speaker mean. ${UTTERANCE_SCOPE}`,
  HYPE_BANDS,
);

export type HypeResult = ScoreResult<HypeId>;

export const hypeFromAnswers = (
  answers: ReadonlyArray<{ id: string; type: string }>,
): HypeResult | null =>
  scoreFromAnswers(
    answers,
    HYPE_QUESTION_ID,
    HYPE_BANDS,
    "Jev omitted the hype score.",
  );

export const rankedHype = (row: HypeResult, count: number): HypeResult[] =>
  rankedScore(HYPE_BANDS, row, count);

export const averageHype = (rows: readonly HypeResult[]): HypeResult | null =>
  averageScore(HYPE_BANDS, rows);
