import { JEV_SHARED_EVIDENCE } from "../../transcription/jevSharedState";

const UTTERANCE_SCOPE = `Score \`utterance\`. ${JEV_SHARED_EVIDENCE} Do not copy emotions from another speaker or from earlier lines unless this line still carries them.`;

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
  what: string;
  example: string;
};

type EmotionItem = {
  label: string;
  what: string;
  example: string;
};

type Cluster = {
  tone: EmotionTone;
  name: string;
  example: string;
  items: readonly EmotionItem[];
};

const item = (label: string, what: string, example: string): EmotionItem => ({
  label,
  what,
  example,
});

const CLUSTERS: readonly Cluster[] = [
  {
    tone: "uncertain",
    name: "Things are uncertain and overwhelming",
    example: "I can’t keep all of this in my head at once.",
    items: [
      item(
        "Stress",
        "Pressure is piling up and the body is bracing.",
        "I have too much on me and I can’t drop any of it.",
      ),
      item(
        "Overwhelm",
        "There is more coming in than you can process.",
        "Stop. I can’t take another thing right now.",
      ),
      item(
        "Anxiety",
        "The mind is scanning for danger that may not be here yet.",
        "What if this goes wrong and I can’t fix it?",
      ),
      item(
        "Worry",
        "Thoughts loop on a problem you cannot settle.",
        "I keep turning it over and I still don’t know.",
      ),
      item(
        "Avoidance",
        "Steering around the hard thing instead of facing it.",
        "Can we talk about that later? Anything else.",
      ),
      item(
        "Fear",
        "A clear sense that harm is close.",
        "I don’t want to go in there. It feels unsafe.",
      ),
      item(
        "Excitement",
        "High energy about something coming, mixed with nerves.",
        "I can’t sit still. This might actually happen.",
      ),
      item(
        "Dread",
        "Heavy certainty that something bad is coming.",
        "I already know tomorrow is going to be awful.",
      ),
      item(
        "Vulnerability",
        "Being seen without armor, which feels risky.",
        "I’m telling you this even though I might regret it.",
      ),
    ],
  },
  {
    tone: "unplanned",
    name: "Things don't go as planned",
    example: "That is not how this was supposed to go.",
    items: [
      item(
        "Boredom",
        "Nothing here holds interest or challenge.",
        "This is the same thing again. I’m checked out.",
      ),
      item(
        "Expectations",
        "A picture of how it should have gone is still in charge.",
        "I thought this would be done by now.",
      ),
      item(
        "Disappointment",
        "The result is smaller or colder than hoped.",
        "I really thought this would work.",
      ),
      item(
        "Regret",
        "Wishing a past choice had been different.",
        "I should not have said that.",
      ),
      item(
        "Frustration",
        "Effort is blocked and the block feels unnecessary.",
        "I’ve tried this three times and it still won’t go.",
      ),
      item(
        "Discouragement",
        "Hope is dropping after repeated stalls.",
        "What’s the point of trying again?",
      ),
      item(
        "Resignation",
        "Giving up the fight and accepting a worse outcome.",
        "Fine. It is what it is. I’m done pushing.",
      ),
    ],
  },
  {
    tone: "compare",
    name: "We compare with others",
    example: "Look at them. Why isn’t that me?",
    items: [
      item(
        "Comparison",
        "Measuring yourself against someone else.",
        "They got there faster than I did.",
      ),
      item(
        "Admiration",
        "Respect for someone without needing to take it from them.",
        "I love how they handled that.",
      ),
      item(
        "Reverence",
        "Deep respect that feels almost sacred.",
        "Standing there, I just felt small in a good way.",
      ),
      item(
        "Envy",
        "Wanting what someone else has.",
        "I want that life. It should have been mine.",
      ),
      item(
        "Jealousy",
        "Fear of losing someone or something to another person.",
        "Why were you talking to them like that?",
      ),
      item(
        "Resentment",
        "Stored bitterness about unfair advantage.",
        "They always get a pass. I never do.",
      ),
      item(
        "Schadenfreude",
        "Pleasure when someone else fails.",
        "Good. They finally got knocked down.",
      ),
      item(
        "Freudenfreude",
        "Pleasure in someone else’s win.",
        "I’m actually happy they got it.",
      ),
    ],
  },
  {
    tone: "beyond",
    name: "Things are beyond us",
    example: "I don’t fully get this, and I want to.",
    items: [
      item(
        "Awe",
        "Something is so large it stops ordinary thinking.",
        "I have no words for how huge that is.",
      ),
      item(
        "Wonder",
        "Open, childlike interest in how something can be.",
        "How is that even possible?",
      ),
      item(
        "Confusion",
        "The pieces do not fit, so meaning is missing.",
        "Wait. That doesn’t line up with what we just said.",
      ),
      item(
        "Interest",
        "Attention is caught and wants to stay.",
        "Huh. Tell me more about that.",
      ),
      item(
        "Curiosity",
        "An active pull to find out how or why.",
        "How did they have the same idea at the same time?",
      ),
      item(
        "Surprise",
        "A sudden break from what you expected.",
        "I did not see that coming.",
      ),
    ],
  },
  {
    tone: "seem",
    name: "Things aren't what they seem",
    example: "That sounds true, and also not quite true.",
    items: [
      item(
        "Amusement",
        "Finding the mismatch funny without much sting.",
        "Okay, that’s actually funny.",
      ),
      item(
        "Bittersweetness",
        "Joy and sadness in the same moment.",
        "I’m glad we did it, and I’m sad it’s over.",
      ),
      item(
        "Nostalgia",
        "Warm ache for something already gone.",
        "It felt simpler then.",
      ),
      item(
        "Cognitive Dissonance",
        "Two beliefs collide and neither will drop.",
        "I know that’s true, and I still don’t want it to be.",
      ),
      item(
        "Paradox",
        "Both sides can be true at once, which is hard to hold.",
        "It can be both a win and a loss.",
      ),
      item(
        "Irony",
        "The outcome undercuts the intended meaning.",
        "The safety talk is what caused the panic.",
      ),
      item(
        "Sarcasm",
        "Saying the opposite to mock or protect.",
        "Oh great. Another brilliant plan.",
      ),
    ],
  },
  {
    tone: "together",
    name: "We're with others",
    example: "I can feel what this is doing to you.",
    items: [
      item(
        "Empathy",
        "Feeling with someone from inside their view.",
        "That would wreck me too.",
      ),
      item(
        "Compassion",
        "Feeling with someone plus a wish to help.",
        "This is hard. I’m with you. What would help?",
      ),
      item(
        "Pity",
        "Looking down at someone’s pain from a distance.",
        "Poor them. I would never end up there.",
      ),
      item(
        "Boundaries",
        "Naming a limit so closeness can stay safe.",
        "I care about you, and I can’t take that on.",
      ),
      item(
        "Sympathy",
        "Caring about someone’s pain without fully entering it.",
        "I’m sorry you’re going through that.",
      ),
      item(
        "Comparative Suffering",
        "Ranking pain instead of meeting it.",
        "At least you still have a job. Others have it worse.",
      ),
    ],
  },
  {
    tone: "short",
    name: "We fall short",
    example: "I should have been better than that.",
    items: [
      item(
        "Shame",
        "The self feels bad, not only the action.",
        "I’m the problem. People would leave if they knew.",
      ),
      item(
        "Self-Compassion",
        "Offering yourself the same care you’d give a friend.",
        "I messed up, and I can still be decent to myself.",
      ),
      item(
        "Perfectionism",
        "Only a flawless result counts as enough.",
        "If it’s not exact, I don’t want to show it.",
      ),
      item(
        "Guilt",
        "The action feels wrong, and you want to repair it.",
        "I did that. I need to make it right.",
      ),
      item(
        "Humiliation",
        "Being exposed as less-than in front of others.",
        "Everyone saw me fail.",
      ),
      item(
        "Embarrassment",
        "A social stumble that you can still recover from.",
        "Oh no. Please pretend that didn’t happen.",
      ),
    ],
  },
  {
    tone: "heart",
    name: "The heart is open",
    example: "This matters to me more than I wanted to admit.",
    items: [
      item(
        "Love",
        "Care, warmth, and wanting closeness with someone.",
        "I just want you near. That’s enough.",
      ),
      item(
        "Lovelessness",
        "A hollow sense that love is missing or closed.",
        "I don’t feel anything for anyone right now.",
      ),
      item(
        "Heartbreak",
        "Love is still there, and the bond is breaking.",
        "I still care, and this is over.",
      ),
      item(
        "Trust",
        "Believing someone will not use your openness against you.",
        "I can tell you this. I know you won’t use it.",
      ),
      item(
        "Self-Trust",
        "Believing your own read, needs, and follow-through.",
        "I know that’s not how this works. I’m going with what I know.",
      ),
      item(
        "Betrayal",
        "Someone used closeness to harm or abandon you.",
        "You promised, then you did the opposite.",
      ),
      item(
        "Defensiveness",
        "Protecting the self instead of hearing the hit.",
        "That’s not what I meant. You’re twisting it.",
      ),
      item(
        "Flooding",
        "Emotion rises so fast the conversation can’t stay clear.",
        "I can’t talk. I’m too spun up.",
      ),
      item(
        "Hurt",
        "Someone’s words or actions landed as a wound.",
        "That cut. I didn’t expect that from you.",
      ),
    ],
  },
  {
    tone: "connect",
    name: "We search for connection",
    example: "I don’t know if I actually belong here.",
    items: [
      item(
        "Belonging",
        "Feeling accepted as yourself in a group.",
        "I can be myself here and it’s fine.",
      ),
      item(
        "Fitting In",
        "Matching the group so you won’t be left out.",
        "I’ll just do what everyone else is doing.",
      ),
      item(
        "Connection",
        "A live sense of being with someone.",
        "I feel like you’re actually here with me.",
      ),
      item(
        "Disconnection",
        "The link is gone, even if people are nearby.",
        "You’re talking, but I don’t feel you.",
      ),
      item(
        "Insecurity",
        "Doubt about whether you are wanted or enough.",
        "Do you still want me in this?",
      ),
      item(
        "Invisibility",
        "Feeling unseen, unheard, or skipped.",
        "I said that already. Nobody even looked up.",
      ),
      item(
        "Loneliness",
        "Wanting company and not having it.",
        "I’m around people and I still feel alone.",
      ),
    ],
  },
  {
    tone: "hurt",
    name: "We're hurting",
    example: "This ache isn’t going anywhere.",
    items: [
      item(
        "Anguish",
        "Pain so sharp it is hard to stay in the body.",
        "I can’t stand this. Make it stop.",
      ),
      item(
        "Hopelessness",
        "No path forward looks real.",
        "Nothing I do will change this.",
      ),
      item(
        "Despair",
        "Hope is gone and the dark feels total.",
        "I don’t see a way out of this.",
      ),
      item(
        "Sadness",
        "A heavy, slower ache after loss or letdown.",
        "I’m just sad. That’s all it is.",
      ),
      item(
        "Grief",
        "Love continuing after someone or something is gone.",
        "I keep reaching for them and they’re not there.",
      ),
    ],
  },
  {
    tone: "good",
    name: "Life is good",
    example: "This is enough. I can breathe.",
    items: [
      item(
        "Joy",
        "A bright lift that wants to move or share.",
        "This made my whole day.",
      ),
      item(
        "Happiness",
        "A steady good feeling about how life is going.",
        "I’m actually doing okay right now.",
      ),
      item(
        "Calm",
        "The nervous system has settled.",
        "I’m not braced. We can talk.",
      ),
      item(
        "Contentment",
        "Enoughness without needing a bigger high.",
        "I don’t need more than this.",
      ),
      item(
        "Gratitude",
        "Noticing a gift and feeling thankful.",
        "I’m glad you did that. It helped.",
      ),
      item(
        "Relief",
        "A threat or tightness has lifted.",
        "Oh thank god. It’s over.",
      ),
      item(
        "Foreboding Joy",
        "Goodness shows up and fear of losing it follows.",
        "This is great, which means it won’t last.",
      ),
      item(
        "Tranquillity",
        "Quiet ease with little leftover noise.",
        "Everything can wait. This is peaceful.",
      ),
    ],
  },
  {
    tone: "assess",
    name: "We self-assess",
    example: "Look at me. Did I earn this?",
    items: [
      item(
        "Pride",
        "Honest satisfaction in effort or character.",
        "I worked for this, and I’m proud of it.",
      ),
      item(
        "Hubris",
        "Inflated self that needs to sit above others.",
        "Obviously I was going to crush this.",
      ),
      item(
        "Humility",
        "Accurate self-view without shrinking or puffing.",
        "I did my part. Other people made it possible too.",
      ),
    ],
  },
  {
    tone: "wronged",
    name: "We feel wronged",
    example: "That was not fair, and I’m not letting it go.",
    items: [
      item(
        "Anger",
        "Energy rises to protect a boundary or correct a wrong.",
        "That is not okay. Stop.",
      ),
      item(
        "Contempt",
        "Looking down on someone as beneath you.",
        "They’re not even worth arguing with.",
      ),
      item(
        "Disgust",
        "A recoil as if something is contaminated.",
        "I don’t want anything to do with that.",
      ),
      item(
        "Dehumanization",
        "Treating a person as less than a person.",
        "They’re not people. They’re the problem.",
      ),
      item(
        "Hate",
        "A lasting wish to harm or erase a target.",
        "I want them gone.",
      ),
      item(
        "Self-Righteousness",
        "Certainty that your side is morally clean.",
        "I’m the good one here. They’re just wrong.",
      ),
    ],
  },
];

const slug = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

export const emotionLabelsForTone = (tone: EmotionTone) =>
  CLUSTERS.find((cluster) => cluster.tone === tone)?.items.map(
    (row) => row.label,
  ) ?? [];

export const EMOTION_BANDS: readonly {
  tone: EmotionTone;
  label: string;
  what: string;
  example: string;
}[] = [
  {
    tone: "uncertain",
    label: "Uncertain",
    what: "Things feel uncertain or overwhelming.",
    example: "I can’t keep all of this in my head at once.",
  },
  {
    tone: "unplanned",
    label: "Unplanned",
    what: "Things did not go as planned.",
    example: "That is not how this was supposed to go.",
  },
  {
    tone: "compare",
    label: "Compare",
    what: "Comparing yourself or others.",
    example: "Look at them. Why isn’t that me?",
  },
  {
    tone: "beyond",
    label: "Beyond",
    what: "Something feels bigger than you can hold.",
    example: "I don’t fully get this, and I want to.",
  },
  {
    tone: "seem",
    label: "Seem",
    what: "Things are not quite what they seem.",
    example: "That sounds true, and also not quite true.",
  },
  {
    tone: "together",
    label: "Together",
    what: "Feeling with other people.",
    example: "I can feel what this is doing to you.",
  },
  {
    tone: "short",
    label: "Short",
    what: "Feeling like you fell short.",
    example: "I should have been better than that.",
  },
  {
    tone: "heart",
    label: "Heart",
    what: "The heart is open, hurt, or guarded.",
    example: "This matters to me more than I wanted to admit.",
  },
  {
    tone: "connect",
    label: "Connect",
    what: "Searching for belonging or connection.",
    example: "I don’t know if I actually belong here.",
  },
  {
    tone: "hurt",
    label: "Hurt",
    what: "Pain, sadness, or grief.",
    example: "This ache isn’t going anywhere.",
  },
  {
    tone: "good",
    label: "Good",
    what: "Life feels good, calm, or grateful.",
    example: "This is enough. I can breathe.",
  },
  {
    tone: "assess",
    label: "Assess",
    what: "Judging yourself: pride or humility.",
    example: "Look at me. Did I earn this?",
  },
  {
    tone: "wronged",
    label: "Wronged",
    what: "Feeling treated unfairly or angry.",
    example: "That was not fair, and I’m not letting it go.",
  },
];

export const EMOTIONS: readonly EmotionDef[] = CLUSTERS.flatMap((cluster) =>
  cluster.items.map((row) => ({
    id: slug(row.label),
    label: row.label,
    tone: cluster.tone,
    cluster: cluster.name,
    what: row.what,
    example: row.example,
  })),
);

const EMOTION_BY_ID = new Map(EMOTIONS.map((row) => [row.id, row]));

export const emotionCopy = (id: string) => EMOTION_BY_ID.get(id);

export const EMOTION_QUESTION_ID = "emotion";
export const TOP_EMOTION_COUNT = 5;

const emotionOptions = () => {
  const options: Record<string, string> = {};
  for (const row of EMOTIONS) {
    options[
      row.id
    ] = `${row.label}. ${row.what} Example: ${row.example} Place: ${row.cluster}.`;
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
