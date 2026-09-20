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
  { shade: "white", label: "~70" },
  { shade: "white2", label: "~80" },
  { shade: "yellow", label: "~90" },
  { shade: "yellow2", label: "~100" },
  { shade: "yellow3", label: "~110" },
  { shade: "orange", label: "~120" },
  { shade: "orange2", label: "~130" },
  { shade: "red", label: "~140" },
  { shade: "red2", label: "~150" },
  { shade: "red3", label: "~160" },
];

type IqLevel = { what: string; examples: string[] };

export type IqDimension = {
  id: "structure" | "reasoning" | "language";
  weight: number;
  instructions: string;
  levels: IqLevel[];
};

const UTTERANCE_SCOPE =
  "Judge only `utterance`. `previous_turn`, when present, is only what the speaker is replying to.";

/**
 * Composite scoring: one Score per dimension so each question measures a
 * single thing. Levels describe situations Jev can match, with spoken-style
 * examples. Weights are combined in code (compositeFromAnswers).
 */
export const IQ_DIMENSIONS: readonly IqDimension[] = [
  {
    id: "reasoning",
    weight: 0.5,
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
    id: "structure",
    weight: 0.25,
    instructions: `How well does \`utterance\` hold together as one thought? ${UTTERANCE_SCOPE}`,
    levels: [
      {
        what: "Fragments or filler with no complete statement.",
        examples: ["uh, yeah, so", "the thing, the... yeah"],
      },
      {
        what: "Starts a statement but loses it: restarts, repeats, or drifts before finishing.",
        examples: [
          "So we could, like, the packages, I mean the thing is, so anyway.",
        ],
      },
      {
        what: "Complete statements, loosely strung together.",
        examples: ["We use a lot of packages. Some might be bad. It's scary."],
      },
      {
        what: "Statements connect: each one follows from or supports the previous one.",
        examples: [
          "We trust many packages, so one bad one is a real risk, which is why linting rules matter.",
        ],
      },
      {
        what: "Tightly built: a clear line from premise to conclusion with nothing off track.",
        examples: [
          "Every package is trusted code we did not read. Trust without review cannot be audited, so we enforce conventions instead of trusting people.",
        ],
      },
    ],
  },
  {
    id: "language",
    weight: 0.25,
    instructions: `How precise is the word choice in \`utterance\`? Judge wording only, not the idea. ${UTTERANCE_SCOPE}`,
    levels: [
      {
        what: "Mostly filler and placeholder words: like, thing, stuff, you know.",
        examples: ["like the thing with the stuff, you know"],
      },
      {
        what: "Everyday words, vague where a specific word was available.",
        examples: ["some package had a bad thing in it"],
      },
      {
        what: "Everyday words with a few specific terms used correctly.",
        examples: ["a package had an exploit that was added years ago"],
      },
      {
        what: "Specific, exact terms throughout; says precisely what it means.",
        examples: [
          "a supply-chain exploit was engineered into a maintained package three years ago",
        ],
      },
      {
        what: "Dense, exact vocabulary with no wasted words; every term carries meaning.",
        examples: [
          "a dormant supply-chain compromise, staged by a maintainer three years prior, activated after adoption",
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

const PREVIOUS_TURN_CHARS = 300;

/** Named fields so instructions can point at `utterance` by name. */
export const buildIqState = (
  utterance: string,
  previousTurn: string | null,
) => {
  const state: Record<string, string> = { utterance: utterance.trim() };
  const context = previousTurn?.trim() ?? "";
  if (context) {
    state.previous_turn = context.slice(-PREVIOUS_TURN_CHARS);
  }
  return state;
};

export type IqAnswer =
  | { id: string; type: "noul"; noul: number }
  | { id: string; type: "score"; score: number; confidence: number }
  | { id: string; type: "choice" };

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
const MIN_CONFIDENCE_WEIGHT = 0.05;

export const iqFromComposite = (composite: number) => {
  const clamped = Math.min(1, Math.max(0, composite));
  return Math.round(IQ_MIN + clamped * (IQ_MAX - IQ_MIN));
};

export const shadeFromComposite = (composite: number): IqShade => {
  const index = Math.min(IQ_TOP, Math.max(0, Math.round(composite * IQ_TOP)));
  return IQ_BANDS[index]?.shade ?? "white";
};

/** Confidence-weighted mean so a split distribution counts for less. */
export const weightedComposite = (results: IqResult[]) => {
  let total = 0;
  let weight = 0;
  for (const result of results) {
    const w = Math.max(MIN_CONFIDENCE_WEIGHT, result.confidence);
    total += w * result.composite;
    weight += w;
  }
  return weight > 0 ? total / weight : null;
};

export const speakerKey = (speaker: number | null) =>
  speaker === null ? "null" : String(speaker);
