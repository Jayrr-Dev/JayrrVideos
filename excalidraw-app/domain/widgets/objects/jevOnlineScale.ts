import { JEV_SHARED_EVIDENCE } from "../../transcription/jevSharedState";

const UTTERANCE_SCOPE =
  `Judge only \`utterance\`. ${JEV_SHARED_EVIDENCE} Score how this line treats other people, not whether the topic is serious.`;

export type OnlineId =
  | "troll"
  | "toxic"
  | "rude"
  | "normal"
  | "friendly"
  | "helpful"
  | "wholesome";

export type OnlineBand = {
  id: OnlineId;
  label: string;
  what: string;
  example: string;
};

export const ONLINE_BANDS: readonly OnlineBand[] = [
  {
    id: "troll",
    label: "Troll",
    what: "Tries to get a strong reaction for fun or attention. Posts bait, fake claims, personal attacks, or extreme takes they may not even believe. Keeps arguing after being corrected because making people angry is the goal.",
    example: "Everyone who likes this is an idiot. Cry about it.",
  },
  {
    id: "toxic",
    label: "Toxic",
    what: "Brings anger, blame, and drama into most talks. Insults people, twists their words, refuses to admit mistakes, starts fights, and may tell others to attack someone. Unlike a troll, they may believe they are right and feel that their anger excuses their actions.",
    example: "You always ruin everything. Nobody here wants you.",
  },
  {
    id: "rude",
    label: "Rude",
    what: "Speaks in a harsh or careless way but may not be trying to cause a large fight. Talks down to people, mocks simple questions, uses insults, or gives cold replies. They may calm down or say sorry when called out.",
    example: "That's a stupid question. Just look it up.",
  },
  {
    id: "normal",
    label: "Normal",
    what: "Talks in a plain and fair way. Shares opinions, asks questions, and disagrees without attacking people. Does not add much warmth, but also does not make the space worse.",
    example: "I don’t agree. I think the second option works better.",
  },
  {
    id: "friendly",
    label: "Friendly",
    what: "Makes an effort to be polite and easy to talk to. Welcomes questions, gives people the benefit of the doubt, and keeps disagreements calm. May use light jokes or kind words to make the talk feel relaxed.",
    example: "I see your point, but I read it a bit differently.",
  },
  {
    id: "helpful",
    label: "Helpful",
    what: "Tries to solve the person's real problem. Gives clear steps, useful facts, examples, or links and corrects mistakes without making anyone feel dumb. Asks questions when more details are needed instead of making bad guesses.",
    example:
      "That error usually comes from a missing setting. Check this file first, then restart the app.",
  },
  {
    id: "wholesome",
    label: "Wholesome",
    what: "Makes people feel welcome, safe, and valued. Thanks people for their work, praises real effort, supports beginners, and steps in calmly when someone is being treated badly. Helps build a group where people want to return and take part.",
    example:
      "You've made good progress. That mistake is common, and your main idea is still solid.",
  },
];

export const ONLINE_QUESTION_ID = "online";
const ONLINE_TOP = ONLINE_BANDS.length - 1;

export const ONLINE_QUESTION = {
  id: ONLINE_QUESTION_ID,
  type: "score" as const,
  instructions: `How does \`utterance\` treat other people in the talk? Score this line’s online behaviour, not a running speaker mean. Troll bait is for reaction. Toxic believes the anger is justified. Rude is harsh without a large fight. Normal is fair. Friendly is polite. Helpful solves the problem. Wholesome makes people feel welcome. ${UTTERANCE_SCOPE}`,
  levels: ONLINE_BANDS.map((band) => ({
    what: `${band.label}. ${band.what}`,
    examples: [band.example],
  })),
};

export type OnlineResult = {
  id: OnlineId;
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
  Math.min(ONLINE_TOP, Math.max(0, Math.round(value)));

const resultFromScore = (
  score: number,
  confidence: number,
): OnlineResult | null => {
  const index = clampScore(score);
  const band = ONLINE_BANDS[index];
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

export const onlineFromAnswers = (
  answers: ReadonlyArray<{ id: string; type: string }>,
): OnlineResult | null => {
  const answer = answers.find(
    (row): row is ScoreAnswer =>
      row.id === ONLINE_QUESTION_ID && row.type === "score",
  );
  if (!answer) {
    throw new Error("Jev omitted the online behaviour score.");
  }
  return resultFromScore(
    answer.score,
    typeof answer.confidence === "number" ? answer.confidence : 0,
  );
};

export const rankedOnline = (
  row: OnlineResult,
  count: number,
): OnlineResult[] => {
  const picked: OnlineResult[] = [];
  for (let dist = 0; picked.length < count && dist <= ONLINE_TOP; dist += 1) {
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

export const averageOnline = (
  rows: readonly OnlineResult[],
): OnlineResult | null => {
  if (rows.length === 0) {
    return null;
  }
  const score = rows.reduce((sum, row) => sum + row.score, 0) / rows.length;
  const confidence =
    rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length;
  return resultFromScore(score, confidence);
};
