const UTTERANCE_SCOPE =
  "Score `utterance`. Use `previous_text`, when present, as the talk just before this line so fragments, answers, and continuations keep the right feeling. Do not copy emotions from `previous_text` unless this line still carries them.";

export type EmotionTone =
  | "uncertain"
  | "unplanned"
  | "compare"
  | "beyond"
  | "seem"
  | "together"
  | "short"
  | "heart"
  | "connect"
  | "hurt"
  | "good"
  | "assess"
  | "wronged";

export type EmotionDef = {
  id: string;
  label: string;
  tone: EmotionTone;
  cluster: string;
};

type Cluster = {
  tone: EmotionTone;
  name: string;
  labels: string[];
};

const CLUSTERS: readonly Cluster[] = [
  {
    tone: "uncertain",
    name: "Things are uncertain and overwhelming",
    labels: [
      "Stress",
      "Overwhelm",
      "Anxiety",
      "Worry",
      "Avoidance",
      "Fear",
      "Excitement",
      "Dread",
      "Vulnerability",
    ],
  },
  {
    tone: "unplanned",
    name: "Things don't go as planned",
    labels: [
      "Boredom",
      "Expectations",
      "Disappointment",
      "Regret",
      "Frustration",
      "Discouragement",
      "Resignation",
    ],
  },
  {
    tone: "compare",
    name: "We compare with others",
    labels: [
      "Comparison",
      "Admiration",
      "Reverence",
      "Envy",
      "Jealousy",
      "Resentment",
      "Schadenfreude",
      "Freudenfreude",
    ],
  },
  {
    tone: "beyond",
    name: "Things are beyond us",
    labels: ["Awe", "Wonder", "Confusion", "Interest", "Curiosity", "Surprise"],
  },
  {
    tone: "seem",
    name: "Things aren't what they seem",
    labels: [
      "Amusement",
      "Bittersweetness",
      "Nostalgia",
      "Cognitive Dissonance",
      "Paradox",
      "Irony",
      "Sarcasm",
    ],
  },
  {
    tone: "together",
    name: "We're with others",
    labels: [
      "Empathy",
      "Compassion",
      "Pity",
      "Boundaries",
      "Sympathy",
      "Comparative Suffering",
    ],
  },
  {
    tone: "short",
    name: "We fall short",
    labels: [
      "Shame",
      "Self-Compassion",
      "Perfectionism",
      "Guilt",
      "Humiliation",
      "Embarrassment",
    ],
  },
  {
    tone: "heart",
    name: "The heart is open",
    labels: [
      "Love",
      "Lovelessness",
      "Heartbreak",
      "Trust",
      "Self-Trust",
      "Betrayal",
      "Defensiveness",
      "Flooding",
      "Hurt",
    ],
  },
  {
    tone: "connect",
    name: "We search for connection",
    labels: [
      "Belonging",
      "Fitting In",
      "Connection",
      "Disconnection",
      "Insecurity",
      "Invisibility",
      "Loneliness",
    ],
  },
  {
    tone: "hurt",
    name: "We're hurting",
    labels: ["Anguish", "Hopelessness", "Despair", "Sadness", "Grief"],
  },
  {
    tone: "good",
    name: "Life is good",
    labels: [
      "Joy",
      "Happiness",
      "Calm",
      "Contentment",
      "Gratitude",
      "Relief",
      "Foreboding Joy",
      "Tranquillity",
    ],
  },
  {
    tone: "assess",
    name: "We self-assess",
    labels: ["Pride", "Hubris", "Humility"],
  },
  {
    tone: "wronged",
    name: "We feel wronged",
    labels: [
      "Anger",
      "Contempt",
      "Disgust",
      "Dehumanization",
      "Hate",
      "Self-Righteousness",
    ],
  },
];

const slug = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

export const EMOTION_BANDS: readonly {
  tone: EmotionTone;
  label: string;
}[] = [
  { tone: "uncertain", label: "Uncertain" },
  { tone: "unplanned", label: "Unplanned" },
  { tone: "compare", label: "Compare" },
  { tone: "beyond", label: "Beyond" },
  { tone: "seem", label: "Seem" },
  { tone: "together", label: "Together" },
  { tone: "short", label: "Short" },
  { tone: "heart", label: "Heart" },
  { tone: "connect", label: "Connect" },
  { tone: "hurt", label: "Hurt" },
  { tone: "good", label: "Good" },
  { tone: "assess", label: "Assess" },
  { tone: "wronged", label: "Wronged" },
];

export const EMOTIONS: readonly EmotionDef[] = CLUSTERS.flatMap((cluster) =>
  cluster.labels.map((label) => ({
    id: slug(label),
    label,
    tone: cluster.tone,
    cluster: cluster.name,
  })),
);

const EMOTION_BY_ID = new Map(EMOTIONS.map((row) => [row.id, row]));

export const EMOTION_QUESTION_ID = "emotion";
export const TOP_EMOTION_COUNT = 3;

const emotionOptions = () => {
  const options: Record<string, string> = {};
  for (const row of EMOTIONS) {
    options[row.id] = `${row.label}. Place: ${row.cluster}.`;
  }
  return options;
};

export const EMOTION_QUESTION = {
  id: EMOTION_QUESTION_ID,
  type: "choice" as const,
  instructions: `Which emotions are in \`utterance\`? The choice is the strongest. Spread probability across the mix so 2nd and 3rd feelings are visible when present. ${UTTERANCE_SCOPE}`,
  options: emotionOptions(),
};

export type EmotionPick = {
  id: string;
  label: string;
  tone: EmotionTone;
  cluster: string;
  confidence: number;
};

type ChoiceAnswer = {
  id: string;
  type: "choice";
  choice?: string;
  probabilities?: Record<string, number>;
  confidence?: number;
};

const pickId = (answer: ChoiceAnswer) => {
  const chosen = answer.choice;
  if (chosen && EMOTION_BY_ID.has(chosen)) {
    return chosen;
  }
  let bestId = "";
  let best = -1;
  for (const [id, probability] of Object.entries(answer.probabilities ?? {})) {
    if (probability > best && EMOTION_BY_ID.has(id)) {
      best = probability;
      bestId = id;
    }
  }
  return bestId;
};

const pickFromId = (
  id: string,
  probabilities: Record<string, number> | undefined,
  fallback: number,
): EmotionPick | null => {
  const def = EMOTION_BY_ID.get(id);
  if (!def) {
    return null;
  }
  return {
    id: def.id,
    label: def.label,
    tone: def.tone,
    cluster: def.cluster,
    confidence: probabilities?.[id] ?? fallback,
  };
};

export const emotionsFromAnswers = (
  answers: ReadonlyArray<{ id: string; type: string }>,
): EmotionPick[] => {
  const answer = answers.find(
    (row): row is ChoiceAnswer =>
      row.id === EMOTION_QUESTION_ID && row.type === "choice",
  );
  if (!answer) {
    return [];
  }
  const fallback =
    typeof answer.confidence === "number" ? answer.confidence : 0;
  const ranked = Object.entries(answer.probabilities ?? {})
    .filter(([id, probability]) => EMOTION_BY_ID.has(id) && probability > 0.04)
    .sort((left, right) => right[1] - left[1]);
  const ids: string[] = [];
  const winner = pickId(answer);
  if (winner) {
    ids.push(winner);
  }
  for (const [id] of ranked) {
    if (ids.length >= TOP_EMOTION_COUNT) {
      break;
    }
    if (!ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids
    .map((id) => pickFromId(id, answer.probabilities, fallback))
    .filter((row): row is EmotionPick => row !== null)
    .slice(0, TOP_EMOTION_COUNT);
};

export const emotionFromAnswers = (
  answers: ReadonlyArray<{ id: string; type: string }>,
): EmotionPick | null => emotionsFromAnswers(answers)[0] ?? null;

/** Mean confidence per emotion across turns. Missing turns count as 0. */
export const averageEmotions = (
  turns: readonly EmotionPick[][],
): EmotionPick[] => {
  if (turns.length === 0) {
    return [];
  }
  const sums = new Map<string, number>();
  for (const picks of turns) {
    for (const pick of picks) {
      sums.set(pick.id, (sums.get(pick.id) ?? 0) + pick.confidence);
    }
  }
  return [...sums.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 1)
    .map(([id, total]) =>
      pickFromId(id, { [id]: total / turns.length }, total / turns.length),
    )
    .filter((row): row is EmotionPick => row !== null);
};
