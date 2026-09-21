import { JEV_SHARED_EVIDENCE } from "../../transcription/jevSharedState";

const UTTERANCE_SCOPE = `Judge only \`utterance\`. ${JEV_SHARED_EVIDENCE} There are no better or worse preferences. Score the natural orientation this line shows, not a life diagnosis.`;

export type MbtiLetter = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";

export type MbtiPairId = "ei" | "sn" | "tf" | "jp";

export type MbtiBand = {
  letter: MbtiLetter;
  pair: MbtiPairId;
  what: string;
  example: string;
};

export const MBTI_BANDS: readonly MbtiBand[] = [
  {
    letter: "E",
    pair: "ei",
    what: "Gets energy from people and action.",
    example: "Let’s talk it through together and try it now.",
  },
  {
    letter: "I",
    pair: "ei",
    what: "Gets energy from thinking things through.",
    example: "I need a minute to think before I answer.",
  },
  {
    letter: "S",
    pair: "sn",
    what: "Trusts facts and what is here now.",
    example: "What actually happened, in order, with the numbers?",
  },
  {
    letter: "N",
    pair: "sn",
    what: "Trusts ideas and what could be.",
    example: "The interesting part is where this could go next.",
  },
  {
    letter: "T",
    pair: "tf",
    what: "Decides with logic.",
    example: "Ignore how it feels. Which option is more consistent?",
  },
  {
    letter: "F",
    pair: "tf",
    what: "Decides with people and values.",
    example: "I care more about how this lands on people than the score.",
  },
  {
    letter: "J",
    pair: "jp",
    what: "Likes plans and finishing things.",
    example: "Let’s decide, put it on the calendar, and close it.",
  },
  {
    letter: "P",
    pair: "jp",
    what: "Likes options and staying flexible.",
    example: "Keep it open. We can change it if something better shows up.",
  },
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

const pairProb = (row: MbtiResult, pairId: MbtiPairId, letter: MbtiLetter) => {
  const pair = MBTI_PAIRS.find((item) => item.id === pairId);
  const score = row.pairs[pairId];
  if (!pair || !score) {
    return 0;
  }
  if (letter === pair.left) {
    return score.left;
  }
  if (letter === pair.right) {
    return score.right;
  }
  return 0;
};

const MBTI_TYPE_COPY: Record<string, { what: string; example: string }> = {
  INTJ: {
    what: "Plans the future with inner vision and logic.",
    example: "This only works if we commit to the long path now.",
  },
  INTP: {
    what: "Builds mental models and questions how things work.",
    example: "How do we know that, and what follows if it is true?",
  },
  ENTJ: {
    what: "Directs people and plans to get results.",
    example: "Here is the plan. Who owns each piece?",
  },
  ENTP: {
    what: "Plays with ideas and debates possibilities.",
    example: "Okay, but what if the opposite is also true?",
  },
  INFJ: {
    what: "Follows an inner vision while caring about people.",
    example: "I can see where this is heading, and people will get hurt.",
  },
  INFP: {
    what: "Stays true to personal values and meaning.",
    example: "That may work, but it doesn’t feel like the right thing.",
  },
  ENFJ: {
    what: "Rallies people around a shared feeling or cause.",
    example: "We can do this together. Everyone has a place here.",
  },
  ENFP: {
    what: "Connects people and possibilities with warmth.",
    example: "You would love this. It opens so many doors.",
  },
  ISTJ: {
    what: "Relies on proven methods, facts, and duty.",
    example: "We already have a process. Follow it and check the facts.",
  },
  ISFJ: {
    what: "Cares for people through practical, reliable help.",
    example: "I already packed extras so nobody is left without one.",
  },
  ESTJ: {
    what: "Organizes work and people to get things done.",
    example: "Stop debating. Assign it and finish it today.",
  },
  ESFJ: {
    what: "Takes care of the group and keeps things running smoothly.",
    example: "Did everyone eat? I’ll make sure the plan works for us.",
  },
  ISTP: {
    what: "Fixes problems in the moment with calm logic.",
    example: "Hand me that. I can see why it jammed.",
  },
  ISFP: {
    what: "Follows personal taste and stays true to what feels right.",
    example: "I don’t want that look. This one feels more like me.",
  },
  ESTP: {
    what: "Acts on what is happening now and makes things happen.",
    example: "Forget the plan. Jump in before we miss it.",
  },
  ESFP: {
    what: "Brings energy to the moment and reads people.",
    example: "This room is dead. Let’s make it fun.",
  },
};

export const mbtiLetterWhat = (letter: MbtiLetter) =>
  MBTI_BANDS.find((band) => band.letter === letter)?.what;

export const mbtiLetterExample = (letter: MbtiLetter) =>
  MBTI_BANDS.find((band) => band.letter === letter)?.example;

export const mbtiTypeWhat = (type: string) => MBTI_TYPE_COPY[type]?.what;

export const mbtiTypeExample = (type: string) => MBTI_TYPE_COPY[type]?.example;

export const rankedMbti = (row: MbtiResult, count: number): MbtiResult[] => {
  const lettersFor = {
    ei: ["E", "I"],
    sn: ["S", "N"],
    tf: ["T", "F"],
    jp: ["J", "P"],
  } as const;
  const combos: MbtiResult[] = [];
  for (const ei of lettersFor.ei) {
    for (const sn of lettersFor.sn) {
      for (const tf of lettersFor.tf) {
        for (const jp of lettersFor.jp) {
          const letters = { ei, sn, tf, jp };
          combos.push({
            type: typeFromLetters(letters),
            letters,
            pairs: row.pairs,
            confidence:
              pairProb(row, "ei", ei) *
              pairProb(row, "sn", sn) *
              pairProb(row, "tf", tf) *
              pairProb(row, "jp", jp),
          });
        }
      }
    }
  }
  combos.sort((left, right) => {
    if (left.type === row.type) {
      return -1;
    }
    if (right.type === row.type) {
      return 1;
    }
    return right.confidence - left.confidence;
  });
  return combos.slice(0, Math.max(0, count));
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
