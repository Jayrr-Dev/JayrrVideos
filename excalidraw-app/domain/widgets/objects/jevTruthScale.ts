import { JEV_SHARED_EVIDENCE } from "../../transcription/jevSharedState";

import {
  averageScore,
  rankedScore,
  scoreFromAnswers,
  scoreQuestion,
  type ScoreBand,
  type ScoreResult,
} from "./jevScoreScale";

const UTTERANCE_SCOPE = `Judge only the claim in \`utterance\`. ${JEV_SHARED_EVIDENCE} Score how well that claim matches known facts and available evidence. Do not score whether the speaker meant to lie.`;

export type TruthId =
  | "fabricated"
  | "false"
  | "misleading"
  | "neutral"
  | "plausible"
  | "supported"
  | "proven";

export type TruthBand = ScoreBand<TruthId>;

export const TRUTH_BANDS: readonly TruthBand[] = [
  {
    id: "fabricated",
    label: "Fabricated",
    what: "The claim appears to be completely invented. Its main event, source, person, number, quote, or evidence doesn’t exist. Real details may be added to make the story sound believable, but the central claim has no factual basis.",
    example:
      "“NASA confirmed that the Moon disappeared for seven minutes yesterday,” when NASA made no such report and the event never happened.",
  },
  {
    id: "false",
    label: "False",
    what: "Reliable evidence directly shows that the claim is wrong. The person may believe it, so “false” doesn’t automatically mean they’re lying. A lie requires knowing that the statement is false and choosing to say it anyway.",
    example: "“Canada’s capital is Toronto.”",
  },
  {
    id: "misleading",
    label: "Misleading",
    what: "The claim contains some truth but creates the wrong impression. It may remove context, use a carefully selected number, confuse cause with coincidence, exaggerate a result, or present an unusual case as normal.",
    example:
      "“This investment increased by 50%,” without mentioning that it had previously fallen by 80%.",
  },
  {
    id: "neutral",
    label: "Neutral",
    what: "There isn’t enough good evidence to decide. Sources may conflict, important facts may be missing, or the claim may be too vague to test. “Neutral” doesn’t mean false. It means a fair conclusion can’t yet be made.",
    example:
      "“This company will become profitable soon,” without defining “soon” or providing current financial records.",
  },
  {
    id: "plausible",
    label: "Plausible",
    what: "The claim is reasonable and fits what is already known, but the evidence is still limited or indirect. It could be true, yet another explanation remains possible. Plausibility should increase confidence only slightly.",
    example:
      "“The website went down because too many people visited it,” when traffic increased but the cause hasn’t been confirmed.",
  },
  {
    id: "supported",
    label: "Supported",
    what: "Good evidence backs the main claim. Several reliable facts or sources point to the same conclusion, and no strong evidence clearly disproves it. Small details may still be uncertain, so the claim should remain open to correction.",
    example:
      "“The outage was caused by excess traffic,” when server logs show a traffic spike and engineers identify overloaded systems.",
  },
  {
    id: "proven",
    label: "Proven",
    what: "Strong, direct, and checkable evidence establishes the claim with very high confidence. Independent sources agree, the evidence is authentic, and reasonable competing explanations have been ruled out. “Proven” still isn’t the same as absolute certainty because new evidence can sometimes change a conclusion.",
    example:
      "“The payment was made at 2:15 p.m.,” confirmed by the sender’s bank, the receiver’s records, and the payment processor.",
  },
];

export const TRUTH_QUESTION_ID = "truth";

export const TRUTH_QUESTION = scoreQuestion(
  TRUTH_QUESTION_ID,
  `How well does the claim in \`utterance\` match known facts and available evidence? Judge the claim itself, not whether the speaker meant to lie. Scale: Fabricated (invented), False (directly disproven), Misleading (some truth, wrong impression), Neutral (not enough to decide), Plausible (fits known facts, evidence thin), Supported (good evidence, open to correction), Proven (strong independent checkable evidence). Prefer Neutral over guessing. Do not pick Proven unless the evidence is direct and checkable. ${UTTERANCE_SCOPE}`,
  TRUTH_BANDS,
);

export type TruthResult = ScoreResult<TruthId>;

export const truthFromAnswers = (
  answers: ReadonlyArray<{ id: string; type: string }>,
): TruthResult | null =>
  scoreFromAnswers(
    answers,
    TRUTH_QUESTION_ID,
    TRUTH_BANDS,
    "Jev omitted the truth score.",
  );

export const rankedTruth = (row: TruthResult, count: number): TruthResult[] =>
  rankedScore(TRUTH_BANDS, row, count);

export const averageTruth = (
  rows: readonly TruthResult[],
): TruthResult | null => averageScore(TRUTH_BANDS, rows);
