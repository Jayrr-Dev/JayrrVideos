const UTTERANCE_SCOPE =
  "Judge only `utterance`. `previous_text` is recent talk before this line; use it to read fragments and replies, not as extra speech to type. There are no better or worse preferences. Score the natural orientation this line shows, not a life diagnosis.";

export type MbtiLetter = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";

export type MbtiPairId = "ei" | "sn" | "tf" | "jp";

export type MbtiBand = {
  letter: MbtiLetter;
  pair: MbtiPairId;
};

export const MBTI_BANDS: readonly MbtiBand[] = [
  { letter: "E", pair: "ei" },
  { letter: "I", pair: "ei" },
  { letter: "S", pair: "sn" },
  { letter: "N", pair: "sn" },
  { letter: "T", pair: "tf" },
  { letter: "F", pair: "tf" },
  { letter: "J", pair: "jp" },
  { letter: "P", pair: "jp" },
];

export const MBTI_PAIRS: readonly {
  id: MbtiPairId;
  left: MbtiLetter;
  right: MbtiLetter;
  title: string;
  instructions: string;
  options: Record<string, string>;
}[] = [
  {
    id: "ei",
    left: "E",
    right: "I",
    title: "Extraversion or Introversion",
    instructions: `Which energy orientation does \`utterance\` show: Extraversion (E) or Introversion (I)? ${UTTERANCE_SCOPE} E orients to the outer world of people and things. I orients to the inner world of ideas and reflection. Ignore everyday slang (outgoing vs shy); score Jung's energy direction.`,
    options: {
      E: "Extraversion. Outer focus, talking to think, action first, many broad interests. Keywords: open, expressive, action-oriented, gregarious, active, enthusiastic.",
      I: "Introversion. Inner focus, thinking before speaking, reflection first, fewer interests in depth. Keywords: private, quiet, contemplative, intimate, reflective, contained.",
    },
  },
  {
    id: "sn",
    left: "S",
    right: "N",
    title: "Sensing or Intuition",
    instructions: `How does \`utterance\` take in information: Sensing (S) or Intuition (N)? ${UTTERANCE_SCOPE} S trusts concrete facts, details, and what is. N trusts patterns, possibilities, and what could be.`,
    options: {
      S: "Sensing. Facts, specifics, here and now, step by step, practical use, trust experience. Keywords: concrete, realistic, present, practical, experiential, traditional.",
      N: "Intuition. New ideas, big picture, future patterns, frameworks, concepts, trust hunches. Keywords: abstract, imaginative, future, conceptual, theoretical, original.",
    },
  },
  {
    id: "tf",
    left: "T",
    right: "F",
    title: "Thinking or Feeling",
    instructions: `How does \`utterance\` decide: Thinking (T) or Feeling (F)? ${UTTERANCE_SCOPE} This is decision style, not intellect vs emotion. T weighs impersonal logic and systems. F weighs people, values, and harmony.`,
    options: {
      T: "Thinking. Logic, objective analysis, pros and cons, scan for what is wrong, task first. Keywords: logical, reasonable, questioning, objective, critical, tough-minded.",
      F: "Feeling. Personal and social values, empathy, praise, scan for what is right, relationships first. Keywords: empathetic, compassionate, accommodating, subjective, accepting, tender-hearted.",
    },
  },
  {
    id: "jp",
    left: "J",
    right: "P",
    title: "Judging or Perceiving",
    instructions: `How does \`utterance\` approach the outer world: Judging (J) or Perceiving (P)? ${UTTERANCE_SCOPE} J wants plans, closure, and a decided path. P wants options, flexibility, and room to adapt.`,
    options: {
      J: "Judging. Plans, schedules, structure, methodical work, avoid last-minute stress. Keywords: systematic, planful, early starting, closure, scheduled, methodical.",
      P: "Perceiving. Flexible, keep options open, spontaneous, last-minute energy. Keywords: casual, open-ended, pressure-prompted, options, spontaneous, emergent.",
    },
  },
];

export const MBTI_QUESTIONS = MBTI_PAIRS.map((pair) => ({
  id: pair.id,
  type: "choice" as const,
  instructions: pair.instructions,
  options: pair.options,
}));

export type MbtiPairScore = {
  letter: MbtiLetter;
  left: number;
  right: number;
};

export type MbtiResult = {
  type: string;
  letters: Record<MbtiPairId, MbtiLetter>;
  pairs: Record<MbtiPairId, MbtiPairScore>;
  confidence: number;
};

type ChoiceAnswer = {
  id: string;
  type: "choice";
  choice?: string;
  probabilities?: Record<string, number>;
  confidence?: number;
};

const typeFromLetters = (letters: Record<MbtiPairId, MbtiLetter>) =>
  `${letters.ei}${letters.sn}${letters.tf}${letters.jp}`;

const pickPair = (
  answer: ChoiceAnswer,
  left: MbtiLetter,
  right: MbtiLetter,
): MbtiPairScore => {
  const leftP = answer.probabilities?.[left] ?? 0;
  const rightP = answer.probabilities?.[right] ?? 0;
  if (leftP > 0 || rightP > 0) {
    const letter = leftP >= rightP ? left : right;
    return { letter, left: leftP, right: rightP };
  }
  if (answer.choice === left || answer.choice === right) {
    const confidence =
      typeof answer.confidence === "number" ? answer.confidence : 1;
    return {
      letter: answer.choice,
      left: answer.choice === left ? confidence : 1 - confidence,
      right: answer.choice === right ? confidence : 1 - confidence,
    };
  }
  return { letter: left, left: 0, right: 0 };
};

const resultFromPairs = (
  pairs: Record<MbtiPairId, MbtiPairScore>,
): MbtiResult => {
  const letters = {} as Record<MbtiPairId, MbtiLetter>;
  let confidence = 0;
  for (const pair of MBTI_PAIRS) {
    letters[pair.id] = pairs[pair.id]?.letter ?? pair.left;
    confidence += Math.max(
      pairs[pair.id]?.left ?? 0,
      pairs[pair.id]?.right ?? 0,
    );
  }
  return {
    type: typeFromLetters(letters),
    letters,
    pairs,
    confidence: confidence / MBTI_PAIRS.length,
  };
};

export const mbtiFromAnswers = (
  answers: ReadonlyArray<{ id: string; type: string }>,
): MbtiResult => {
  const byId = new Map(answers.map((answer) => [answer.id, answer]));
  const pairs = {} as Record<MbtiPairId, MbtiPairScore>;
  for (const pair of MBTI_PAIRS) {
    const answer = byId.get(pair.id);
    if (!answer || answer.type !== "choice") {
      throw new Error(`Jev omitted the ${pair.id} preference.`);
    }
    pairs[pair.id] = pickPair(answer as ChoiceAnswer, pair.left, pair.right);
  }
  return resultFromPairs(pairs);
};

export const averageMbti = (rows: readonly MbtiResult[]): MbtiResult | null => {
  if (rows.length === 0) {
    return null;
  }
  const pairs = {} as Record<MbtiPairId, MbtiPairScore>;
  for (const pair of MBTI_PAIRS) {
    let left = 0;
    let right = 0;
    for (const row of rows) {
      left += row.pairs[pair.id]?.left ?? 0;
      right += row.pairs[pair.id]?.right ?? 0;
    }
    left /= rows.length;
    right /= rows.length;
    pairs[pair.id] = {
      letter: left >= right ? pair.left : pair.right,
      left,
      right,
    };
  }
  return resultFromPairs(pairs);
};
