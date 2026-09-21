import { JEV_SHARED_EVIDENCE } from "../../transcription/jevSharedState";

import {
  averageScore,
  rankedScore,
  scoreFromAnswers,
  scoreQuestion,
  type ScoreBand,
  type ScoreResult,
} from "./jevScoreScale";

const UTTERANCE_SCOPE = `Judge only \`utterance\`. ${JEV_SHARED_EVIDENCE} Score how well this line understands the situation, not a lifetime IQ or whether you like the speaker.`;

export type SmartId =
  | "clueless"
  | "dumb"
  | "basic"
  | "normal"
  | "smart"
  | "brilliant"
  | "genius";

export type SmartBand = ScoreBand<SmartId>;

export const SMART_BANDS: readonly SmartBand[] = [
  {
    id: "clueless",
    label: "Clueless",
    what: "Does not understand what is happening and makes choices without knowing the basic facts.",
    example: "Wait, are we even talking about the same file?",
  },
  {
    id: "dumb",
    label: "Dumb",
    what: "Understands simple things but often misses clear clues, repeats mistakes, or chooses answers that do not make sense.",
    example: "If the site is down, just refresh it until it works.",
  },
  {
    id: "basic",
    label: "Basic",
    what: "Knows enough to handle easy problems but struggles when a problem has several steps or needs deeper thought.",
    example: "Restart it. If that fails, I am not sure what to try next.",
  },
  {
    id: "normal",
    label: "Normal",
    what: "Understands most everyday problems, learns at a normal speed, and usually makes reasonable choices.",
    example:
      "The login failed, so check the password and whether the server is up.",
  },
  {
    id: "smart",
    label: "Smart",
    what: "Learns quickly, notices patterns, asks good questions, and solves hard problems with less help.",
    example:
      "That error only happens after the cache warms, so the stale token is the likely cause.",
  },
  {
    id: "brilliant",
    label: "Brilliant",
    what: "Understands complex ideas very quickly, makes strong links between ideas, and finds answers most people miss.",
    example:
      "The delay matches lock contention, not network lag, because retries cluster on one table.",
  },
  {
    id: "genius",
    label: "Genius",
    what: "Thinks in rare and original ways, solves problems that stop almost everyone else, and may create ideas that change an entire field.",
    example:
      "Treat the outage as a feedback loop: the retry storm is the outage, so cap retries before adding servers.",
  },
];

export const SMART_QUESTION_ID = "smart";

export const SMART_QUESTION = scoreQuestion(
  SMART_QUESTION_ID,
  `How clearly does \`utterance\` understand what is going on? Score the thinking in this line, not a running speaker mean. Do not jump to Brilliant or Genius unless the line actually shows rare, original, or field-changing thought. ${UTTERANCE_SCOPE}`,
  SMART_BANDS,
);

export type SmartResult = ScoreResult<SmartId>;

export const smartFromAnswers = (
  answers: ReadonlyArray<{ id: string; type: string }>,
): SmartResult | null =>
  scoreFromAnswers(
    answers,
    SMART_QUESTION_ID,
    SMART_BANDS,
    "Jev omitted the smart score.",
  );

export const rankedSmart = (row: SmartResult, count: number): SmartResult[] =>
  rankedScore(SMART_BANDS, row, count);

export const averageSmart = (
  rows: readonly SmartResult[],
): SmartResult | null => averageScore(SMART_BANDS, rows);
