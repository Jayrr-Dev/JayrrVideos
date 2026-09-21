import { JEV_SHARED_EVIDENCE } from "../../transcription/jevSharedState";

const UTTERANCE_SCOPE = `Judge only \`utterance\`. ${JEV_SHARED_EVIDENCE} Score the Enneagram habit of attention this line shows, not a life diagnosis. There is no better type.`;

export type EnneaId = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

export type EnneaDef = {
  id: EnneaId;
  name: string;
  what: string;
  example: string;
  option: string;
};

export const ENNEA_TYPES: readonly EnneaDef[] = [
  {
    id: "1",
    name: "Improver",
    what: "Wants things to be right, fair, and done correctly.",
    example: "That’s not the right way to do it. We should fix it properly.",
    option:
      "Type 1 The Improver. Body center. Must be good and right to be worthy. Attention on right vs wrong, inner critic, standards, making things correct. Precise, conscientious, responsible. Can sound judgmental, sermonizing, resentful. Angry when rules that matter are ignored.",
  },
  {
    id: "2",
    name: "Giver",
    what: "Helps others to feel needed and loved.",
    example: "You look tired. Let me take that for you.",
    option:
      "Type 2 The Giver. Heart center. Must give fully to others to be loved. Attention on others' needs, feelings, being needed. Friendly, helpful, supportive, quick with advice. Can sound prideful, intrusive, nagging, or resentful when giving is not returned.",
  },
  {
    id: "3",
    name: "Performer",
    what: "Focuses on winning, goals, and looking successful.",
    example: "Let’s ship it. We can polish the story after we win.",
    option:
      "Type 3 The Performer. Heart center. Must accomplish and succeed to be loved. Attention on tasks, goals, image, winning. Fast, efficient, confident, topic-focused. Can sound impatient, image-driven, all doing and no feeling.",
  },
  {
    id: "4",
    name: "Individualist",
    what: "Wants to feel unique, deep, and true to themselves.",
    example: "Nobody else gets how this actually feels.",
    option:
      "Type 4 The Individualist. Heart center. Seeks the unique, missing, or ideal love. Attention on what is absent, authenticity, depth of feeling. Expressive, original, personal. Can sound moody, envious, dramatic, or unsatisfied with the ordinary.",
  },
  {
    id: "5",
    name: "Observer",
    what: "Protects energy by watching, thinking, and knowing.",
    example: "I need more data before I talk about this.",
    option:
      "Type 5 The Observer. Head center. Protects energy from a world that asks too much. Attention on knowledge, privacy, not being intruded on. Clear, analytic, content-focused, little small talk. Can sound detached, withholding, over-intellectual.",
  },
  {
    id: "6",
    name: "Questioner",
    what: "Looks for what could go wrong and who is safe to trust.",
    example: "What if this fails? Who is actually looking out for us?",
    option:
      "Type 6 The Questioner. Head center. Needs certainty in a world that cannot be trusted. Attention on what could go wrong, worst cases, testing trust. Thoughtful, loyal, contrary, questioning. Can sound doubtful, accusatory, pessimistic, or stuck before a decision.",
  },
  {
    id: "7",
    name: "Enthusiast",
    what: "Keeps options open and stays upbeat to avoid pain.",
    example: "This is fun. We can always switch if it gets boring.",
    option:
      "Type 7 The Enthusiast. Head center. Stays upbeat and keeps options open to avoid pain. Attention on pleasure, plans, multiple futures. Fast, spontaneous, idea-oriented, adventurous. Can skip topics, dodge limits, stay uncommitted or self-absorbed.",
  },
  {
    id: "8",
    name: "Protector",
    what: "Stays strong so nobody can control them.",
    example: "Don’t tell me what to do. I’ll handle it.",
    option:
      "Type 8 The Protector. Body center. Must be strong and powerful to stay safe. Attention on injustice, not being controlled, getting things moving. Direct, firm, justice-minded, impactful. Can sound loud, excessive, impulsive, or intimidating. Hides vulnerability.",
  },
  {
    id: "9",
    name: "Mediator",
    what: "Keeps the peace and goes with the flow.",
    example: "Whatever you all want is fine. I don’t want a fight.",
    option:
      "Type 9 The Mediator. Body center. Blends in and goes with the flow to belong. Attention on others' agendas and keeping comfort. Inclusive, easygoing, sees every side. Can sound indecisive, self-forgetting, conflict-avoidant, or stubbornly merged.",
  },
];

const ENNEA_BY_ID = new Map(ENNEA_TYPES.map((row) => [row.id, row]));

export const ENNEA_BANDS: readonly EnneaDef[] = ENNEA_TYPES;

export const ENNEA_QUESTION_ID = "ennea";

const enneaOptions = () => {
  const options: Record<string, string> = {};
  for (const row of ENNEA_TYPES) {
    options[row.id] = row.option;
  }
  return options;
};

export const ENNEA_QUESTION = {
  id: ENNEA_QUESTION_ID,
  type: "choice" as const,
  instructions: `Which Narrative Enneagram type is \`utterance\` using? The choice is the strongest. Spread probability so a close second type is visible. ${UTTERANCE_SCOPE} Score the habit of attention (right/wrong, others' needs, goals, what's missing, privacy, threat, options, power, harmony), not a mood snapshot.`,
  options: enneaOptions(),
};

export type EnneaResult = {
  id: EnneaId;
  name: string;
  what: string;
  example: string;
  label: string;
  confidence: number;
  probabilities: Record<EnneaId, number>;
};

type ChoiceAnswer = {
  id: string;
  type: "choice";
  choice?: string;
  probabilities?: Record<string, number>;
  confidence?: number;
};

const emptyProbabilities = (): Record<EnneaId, number> => ({
  "1": 0,
  "2": 0,
  "3": 0,
  "4": 0,
  "5": 0,
  "6": 0,
  "7": 0,
  "8": 0,
  "9": 0,
});

const isEnneaId = (id: string): id is EnneaId => ENNEA_BY_ID.has(id as EnneaId);

const pickId = (
  probabilities: Record<EnneaId, number>,
  chosen: EnneaId | null,
) => {
  if (chosen && (probabilities[chosen] ?? 0) > 0) {
    return chosen;
  }
  let best: EnneaId | null = chosen;
  let top = best ? probabilities[best] ?? 0 : -1;
  for (const row of ENNEA_TYPES) {
    const value = probabilities[row.id] ?? 0;
    if (value > top) {
      top = value;
      best = row.id;
    }
  }
  return best;
};

const resultFromProbabilities = (
  probabilities: Record<EnneaId, number>,
  chosen: EnneaId | null,
): EnneaResult | null => {
  const id = pickId(probabilities, chosen);
  if (!id || (probabilities[id] ?? 0) <= 0) {
    return null;
  }
  const def = ENNEA_BY_ID.get(id);
  if (!def) {
    return null;
  }
  return {
    id,
    name: def.name,
    what: def.what,
    example: def.example,
    label: `${def.id} ${def.name}`,
    confidence: probabilities[id] ?? 0,
    probabilities,
  };
};

export const enneaFromAnswers = (
  answers: ReadonlyArray<{ id: string; type: string }>,
): EnneaResult | null => {
  const answer = answers.find(
    (row): row is ChoiceAnswer =>
      row.id === ENNEA_QUESTION_ID && row.type === "choice",
  );
  if (!answer) {
    throw new Error("Jev omitted the Enneagram scores.");
  }
  const probabilities = emptyProbabilities();
  for (const [id, value] of Object.entries(answer.probabilities ?? {})) {
    if (isEnneaId(id)) {
      probabilities[id] = value;
    }
  }
  const chosen =
    answer.choice && isEnneaId(answer.choice) ? answer.choice : null;
  if (chosen && (probabilities[chosen] ?? 0) <= 0) {
    probabilities[chosen] =
      typeof answer.confidence === "number" ? answer.confidence : 1;
  }
  return resultFromProbabilities(probabilities, chosen);
};

export const averageEnnea = (
  rows: readonly EnneaResult[],
): EnneaResult | null => {
  if (rows.length === 0) {
    return null;
  }
  const probabilities = emptyProbabilities();
  for (const type of ENNEA_TYPES) {
    let sum = 0;
    for (const row of rows) {
      sum += row.probabilities[type.id] ?? 0;
    }
    probabilities[type.id] = sum / rows.length;
  }
  return resultFromProbabilities(probabilities, null);
};

export const rankedEnnea = (row: EnneaResult, count: number): EnneaResult[] => {
  const ids = ENNEA_TYPES.map((type) => type.id)
    .filter((id) => (row.probabilities[id] ?? 0) > 0)
    .sort(
      (left, right) =>
        (row.probabilities[right] ?? 0) - (row.probabilities[left] ?? 0),
    )
    .slice(0, Math.max(0, count));
  return ids
    .map((id) => resultFromProbabilities(row.probabilities, id))
    .filter((item): item is EnneaResult => item !== null);
};
