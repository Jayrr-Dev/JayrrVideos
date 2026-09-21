import { JEV_SHARED_EVIDENCE } from "../../transcription/jevSharedState";

export type IqShade =
  | "white"
  | "white2"
  | "yellow"
  | "yellow2"
  | "yellow3"
  | "orange"
  | "orange2"
  | "red"
  | "red2"
  | "red3";

export type IqBand = {
  shade: IqShade;
  label: string;
};

// Legend chips only. The rubric Jev sees lives in IQ_DIMENSIONS below.
export const IQ_BANDS: readonly IqBand[] = [
  { shade: "white", label: "70" },
  { shade: "white2", label: "80" },
  { shade: "yellow", label: "90" },
  { shade: "yellow2", label: "100" },
  { shade: "yellow3", label: "110" },
  { shade: "orange", label: "120" },
  { shade: "orange2", label: "130" },
  { shade: "red", label: "140" },
  { shade: "red2", label: "150" },
  { shade: "red3", label: "160" },
];

type IqLevel = { what: string; examples: string[] };

export type IqDimension = {
  id: "reasoning" | "idea_density" | "lexical_fit" | "delivery";
  weight: number;
  instructions: string;
  levels: IqLevel[];
};

const UTTERANCE_SCOPE = `Judge only \`utterance\`. If it has several sentences, score the most intellectually loaded complete sentence — not an average with filler, agreement, or small talk. ${JEV_SHARED_EVIDENCE}`;

/**
 * Score intellectual speech in this utterance, not a running speaker mean.
 * - idea density / propositional density (Snowdon, Kemper, Nun Study, 1996)
 * - vocabulary ↔ reasoning mutualism (Kieffer et al., 2017)
 * - lexical diversity → perceived competence (Bradac et al., 1977)
 * - empty thesaurus words without extra meaning (Oppenheimer, 2006)
 * - repairs/repetitions track verbal IQ; filled pauses (um) do not
 *   (Engelhardt, Nigg, Ferreira, 2013/2018)
 */
export const IQ_DIMENSIONS: readonly IqDimension[] = [
  {
    id: "reasoning",
    weight: 0.3,
    instructions: `How much reasoning does the speaker do in \`utterance\`? ${UTTERANCE_SCOPE}`,
    levels: [
      {
        what: "States a fact, feeling, or reaction with no reason given.",
        examples: ["Yeah, that's scary.", "I agree, honestly."],
      },
      {
        what: "Gives one reason or one example for a claim.",
        examples: ["It's scary because we use so many packages."],
      },
      {
        what: "Makes a distinction or follows a cause to its effect.",
        examples: [
          "If a maintainer plants an exploit, every project that trusts the package inherits it.",
        ],
      },
      {
        what: "Weighs two or more constraints against each other and names the tradeoff.",
        examples: [
          "We want fast installs, but every dependency is unreviewed trust, so we cap the count and lint the rest.",
        ],
      },
      {
        what: "Builds a model of the problem: a general principle or new framing that explains several cases at once.",
        examples: [
          "Dependency risk is a trust graph. Every edge is a review we skipped, so the fix is making edges cheap to audit, not having fewer edges.",
        ],
      },
    ],
  },
  {
    id: "idea_density",
    weight: 0.2,
    instructions: `How many distinct ideas per stretch of speech are packed into \`utterance\`? Count claims, qualifications, and links, not word count. ${UTTERANCE_SCOPE}`,
    levels: [
      {
        what: "Almost no claim: names, fillers, or the same idea said twice.",
        examples: ["the packages, the thing, you know, the packages"],
      },
      {
        what: "One simple claim; the rest is padding or repetition.",
        examples: ["Yeah so packages, packages are scary, you know?"],
      },
      {
        what: "Several claims listed side by side, not linked.",
        examples: ["We use a lot of packages. Some might be bad. It's scary."],
      },
      {
        what: "Claims are linked: each one qualifies or follows from the last.",
        examples: [
          "We trust many packages, so one bad one is a real risk, which is why linting rules matter.",
        ],
      },
      {
        what: "High density: several constraints or qualifications packed with almost no fluff.",
        examples: [
          "We trust packages we never read, so one bad maintainer is inherited by every downstream project.",
        ],
      },
    ],
  },
  {
    id: "lexical_fit",
    weight: 0.4,
    instructions: `How intellectual is the wording in \`utterance\`? Reward conceptual, academic, or technical register used correctly (abstractions, precise terms, epistemic framing). Penalize slang, placeholders (thing, stuff), and long words that add no meaning. ${UTTERANCE_SCOPE}`,
    levels: [
      {
        what: "Slang, fillers, or placeholders: thing, stuff, like, you know.",
        examples: ["like the thing with the stuff, you know"],
      },
      {
        what: "Casual everyday chat; vague where a specific word was available.",
        examples: ["some package had a bad thing in it"],
      },
      {
        what: "Clear adult wording with a few specific terms.",
        examples: ["a package had a security hole that was added years ago"],
      },
      {
        what: "Correct technical or academic terms; ideas are named, not gestured at.",
        examples: [
          "a supply-chain exploit was planted in a transitive dependency years before detection",
        ],
      },
      {
        what: "Dense intellectual register: abstractions and precise jargon carrying the argument.",
        examples: [
          "Dependency risk is a trust graph: each unreviewed edge is inherited liability, so the constraint is audit cost, not package count.",
        ],
      },
    ],
  },
  {
    id: "delivery",
    weight: 0.1,
    instructions: `How clean is the delivery of \`utterance\`? Score repairs and false starts, not planning sounds. Um, uh, and like used while thinking do not lower the score by themselves. ${UTTERANCE_SCOPE}`,
    levels: [
      {
        what: "Abandons the sentence and starts over with a different thought.",
        examples: [
          "So we could, like, the packages, I mean the thing is, so anyway.",
        ],
      },
      {
        what: "Repeats words or phrases while searching, then barely finishes.",
        examples: ["We we we use packages packages that we we trust."],
      },
      {
        what: "Finishes the thought. Planning sounds (um, uh, like) are fine.",
        examples: [
          "Um, we trust a lot of packages, and uh that is getting scary.",
        ],
      },
      {
        what: "One clean pass: maybe a brief um, no repairs or repeated words.",
        examples: ["We trust a lot of packages, and that is getting scary."],
      },
      {
        what: "Fluent run with no repairs, no repeated words, and no abandoned starts.",
        examples: [
          "We trust packages we never read, so one bad maintainer reaches every downstream project.",
        ],
      },
    ],
  },
];

export const SUBSTANTIVE_ID = "substantive";

/**
 * Noul gate: a Choice/Score is relative and will place "Right, exactly."
 * somewhere on the scale anyway. The Noul is absolute and tells us whether
 * there is a thought to score at all.
 */
export const SUBSTANTIVE_QUESTION = {
  id: SUBSTANTIVE_ID,
  type: "noul" as const,
  instructions: `Does \`utterance\` state at least one complete idea of its own (a claim, question, or explanation), rather than only agreeing, reacting, or filling time? ${UTTERANCE_SCOPE}`,
  yes: "Contains a claim, question, or explanation of its own.",
  no: "Only agreement, reaction, greeting, or filler such as 'right', 'yeah exactly', 'okay'.",
};

export const SUBSTANTIVE_THRESHOLD = 0.5;

export const IQ_QUESTIONS = [
  SUBSTANTIVE_QUESTION,
  ...IQ_DIMENSIONS.map((dimension) => ({
    id: dimension.id,
    type: "score" as const,
    instructions: dimension.instructions,
    levels: dimension.levels,
  })),
];

const PREVIOUS_TEXT_CHARS = 800;

/** Named fields so instructions can point at `utterance` by name. */
export const buildIqState = (
  utterance: string,
  previousText: string | null,
  extras?: {
    speaker?: string;
    speakerRecent?: string | null;
    recentTurns?: string | null;
  },
) => {
  const state: Record<string, string> = { utterance: utterance.trim() };
  if (extras?.speaker) {
    state.speaker = extras.speaker;
  }
  const context = previousText?.trim() ?? "";
  if (context) {
    state.previous_text = context.slice(-PREVIOUS_TEXT_CHARS);
  }
  const speakerRecent = extras?.speakerRecent?.trim() ?? "";
  if (speakerRecent) {
    state.speaker_recent = speakerRecent.slice(-PREVIOUS_TEXT_CHARS);
  }
  const recentTurns = extras?.recentTurns?.trim() ?? "";
  if (recentTurns) {
    state.recent_turns = recentTurns.slice(-PREVIOUS_TEXT_CHARS);
  }
  return state;
};

export type IqAnswer =
  | { id: string; type: "noul"; noul: number }
  | { id: string; type: "score"; score: number; confidence: number }
  | {
      id: string;
      type: "choice";
      choice?: string;
      probabilities?: Record<string, number>;
      confidence?: number;
    };

export type IqResult = {
  /** 0–1 weighted composite across dimensions. */
  composite: number;
  /** 0–1 weighted mean of per-dimension confidence. */
  confidence: number;
  /** False when the Noul says there is no thought to score. */
  substantive: boolean;
};

/** Weights live here, not in the prompt. Normalise each score, then combine. */
export const compositeFromAnswers = (answers: IqAnswer[]): IqResult => {
  const byId = new Map(answers.map((answer) => [answer.id, answer]));
  let composite = 0;
  let confidence = 0;
  let totalWeight = 0;
  for (const dimension of IQ_DIMENSIONS) {
    const answer = byId.get(dimension.id);
    if (!answer || answer.type !== "score") {
      throw new Error(`Jev omitted the ${dimension.id} score.`);
    }
    const top = dimension.levels.length - 1;
    const normalized = Math.min(1, Math.max(0, answer.score / top));
    composite += dimension.weight * normalized;
    confidence += dimension.weight * answer.confidence;
    totalWeight += dimension.weight;
  }
  const gate = byId.get(SUBSTANTIVE_ID);
  const substantive =
    gate?.type === "noul" ? gate.noul >= SUBSTANTIVE_THRESHOLD : true;
  return {
    composite: composite / totalWeight,
    confidence: confidence / totalWeight,
    substantive,
  };
};

const IQ_MIN = 70;
const IQ_MAX = 160;
const IQ_TOP = IQ_BANDS.length - 1;

export const averageIqComposite = (
  rows: readonly IqResult[],
): number | null => {
  const substantive = rows.filter((row) => row.substantive);
  if (substantive.length === 0) {
    return null;
  }
  return (
    substantive.reduce((sum, row) => sum + row.composite, 0) /
    substantive.length
  );
};

export const iqFromComposite = (composite: number) => {
  const clamped = Math.min(1, Math.max(0, composite));
  return Math.round(IQ_MIN + clamped * (IQ_MAX - IQ_MIN));
};

export const shadeFromComposite = (composite: number): IqShade => {
  const index = Math.min(IQ_TOP, Math.max(0, Math.round(composite * IQ_TOP)));
  return IQ_BANDS[index]?.shade ?? "white";
};

export const rankedIqComposites = (
  composite: number,
  count: number,
): number[] => {
  const index = Math.min(IQ_TOP, Math.max(0, Math.round(composite * IQ_TOP)));
  const picked: number[] = [];
  for (let dist = 0; picked.length < count && dist <= IQ_TOP; dist += 1) {
    const candidates = dist === 0 ? [index] : [index + dist, index - dist];
    for (const next of candidates) {
      if (next < 0 || next > IQ_TOP) {
        continue;
      }
      picked.push(next / IQ_TOP);
      if (picked.length >= count) {
        break;
      }
    }
  }
  return picked;
};
