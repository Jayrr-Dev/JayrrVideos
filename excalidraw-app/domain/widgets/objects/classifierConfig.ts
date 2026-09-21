import type { ExcalidrawElement } from "@excalidraw/element/types";

import { JAYRR_CALLED_OBJECT_KEY } from "../model";

export type ClassifierClass = {
  id: string;
  name: string;
  hint: string;
};

export type ClassifierConfig = {
  contextEnabled?: boolean;
  classes: ClassifierClass[];
  sourceId: string;
  instructions: string;
  includeOther: boolean;
};

export const OTHER_CLASS_ID = "other";

export const DEFAULT_CLASSIFIER: ClassifierConfig = {
  contextEnabled: true,
  classes: [
    { id: "yes", name: "Yes", hint: "The answer is yes." },
    { id: "no", name: "No", hint: "The answer is no." },
  ],
  sourceId: "",
  instructions: "Which label best fits this transcript?",
  includeOther: false,
};

export type ClassifierPreset = {
  id: string;
  name: string;
  instructions: string;
  includeOther: boolean;
  classes: ClassifierClass[];
};

const preset = (
  id: string,
  name: string,
  instructions: string,
  rows: [string, string][],
  includeOther = false,
): ClassifierPreset => ({
  id,
  name,
  instructions,
  includeOther,
  classes: rows.map(([label, hint], index) => ({
    id: `${id}_${index}`,
    name: label,
    hint,
  })),
});

export const CLASSIFIER_PRESETS: ClassifierPreset[] = [
  preset("yesno", "Yes / No", "Is the speaker saying yes or no?", [
    ["Yes", "Agreeing, confirming, or saying yes."],
    ["No", "Refusing, denying, or saying no."],
  ]),
  preset("mood", "Mood", "What mood is the speaker in?", [
    ["Happy", "Upbeat, pleased, or cheerful."],
    ["Angry", "Frustrated, hostile, or annoyed."],
    ["Sad", "Down, disappointed, or gloomy."],
    ["Calm", "Neutral, relaxed, or matter-of-fact."],
  ]),
  preset("hype", "Hype meter", "How excited is the speaker?", [
    ["Bored", "Flat, tired, or uninterested."],
    ["Meh", "Mildly interested, lukewarm."],
    ["Hyped", "Excited, energetic, enthusiastic."],
    ["Losing it", "Over the top, screaming, can't contain it."],
  ]),
  preset("sarcasm", "Sarcasm detector", "Is the speaker being sarcastic?", [
    ["Sincere", "Means it literally."],
    ["Sarcastic", "Says the opposite of what they mean, mocking tone."],
  ]),
  preset(
    "truth",
    "Claim truth",
    "How well does this claim match known facts and available evidence? Judge the claim itself, not whether the speaker meant to lie.",
    [
      [
        "Fabricated",
        "Completely invented. The main event, source, person, number, quote, or evidence doesn’t exist. Real details may be added, but the central claim has no factual basis.",
      ],
      [
        "False",
        "Reliable evidence directly shows the claim is wrong. The speaker may believe it. False is not the same as lying.",
      ],
      [
        "Misleading",
        "Contains some truth but creates the wrong impression by dropping context, cherry-picking a number, confusing cause with coincidence, exaggerating, or treating an unusual case as normal.",
      ],
      [
        "Unclear",
        "Not enough good evidence to decide. Sources conflict, facts are missing, or the claim is too vague to test. Unclear is not false.",
      ],
      [
        "Plausible",
        "Reasonable and fits what is known, but evidence is still limited or indirect. Another explanation remains possible. Raise confidence only slightly.",
      ],
      [
        "Supported",
        "Good evidence backs the main claim. Several reliable facts or sources agree, and nothing strong clearly disproves it. Small details may still be uncertain.",
      ],
      [
        "Proven",
        "Strong, direct, checkable evidence. Independent sources agree, and reasonable competing explanations have been ruled out. Still not absolute certainty.",
      ],
    ],
  ),
  preset("lie", "Truth or lie", "Does this sound truthful?", [
    ["Truth", "Direct, specific, consistent."],
    ["Lie", "Vague, evasive, over-explaining, or contradictory."],
  ]),
  preset(
    "questions",
    "Question or statement",
    "What kind of sentence is this?",
    [
      ["Question", "Asking something."],
      ["Statement", "Stating a fact or opinion."],
      ["Command", "Telling someone to do something."],
    ],
  ),
  preset("rizz", "Rizz check", "How smooth is this line?", [
    ["Cringe", "Awkward, trying too hard."],
    ["Mid", "Fine but forgettable."],
    ["Smooth", "Charming and confident."],
    ["Legendary", "Unreal, movie-level charisma."],
  ]),
  preset("villain", "Hero or villain", "Who would say this?", [
    ["Hero", "Brave, selfless, protective."],
    ["Villain", "Scheming, cruel, power-hungry."],
    ["Sidekick", "Supportive, comic relief, loyal."],
    ["Narrator", "Describing events from the outside."],
  ]),
  preset("meeting", "Meeting talk", "What is this contribution?", [
    ["Idea", "Proposing something new."],
    ["Question", "Asking for clarification."],
    ["Decision", "Committing to a course of action."],
    ["Tangent", "Off-topic or rambling."],
  ]),
  preset(
    "pizza",
    "Food fight",
    "Which food is being talked about or vibed?",
    [
      ["Pizza", "Pizza, slices, toppings, cheese."],
      ["Tacos", "Tacos, salsa, tortillas."],
      ["Sushi", "Sushi, rolls, fish, rice."],
      ["Burgers", "Burgers, fries, patties."],
    ],
    true,
  ),
  preset("pirate", "Pirate speak", "How pirate does this sound?", [
    ["Landlubber", "Plain, ordinary talk."],
    ["Deckhand", "A hint of pirate flavor."],
    ["Captain", "Full pirate: arr, matey, treasure."],
  ]),
];

export const applyClassifierPreset = (
  config: ClassifierConfig,
  presetId: string,
): ClassifierConfig => {
  const found = CLASSIFIER_PRESETS.find((item) => item.id === presetId);
  if (!found) {
    return config;
  }
  return {
    ...config,
    classes: found.classes.map((row) => ({ ...row })),
    instructions: found.instructions,
    includeOther: found.includeOther,
  };
};

const isClass = (value: unknown): value is ClassifierClass => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as { id?: unknown; name?: unknown; hint?: unknown };
  return (
    typeof row.id === "string" &&
    row.id.length > 0 &&
    typeof row.name === "string" &&
    typeof row.hint === "string"
  );
};

export const nextClassId = () =>
  `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export const readClassifierConfig = (
  element: Pick<ExcalidrawElement, "customData">,
): ClassifierConfig => {
  const data = element.customData?.[JAYRR_CALLED_OBJECT_KEY];
  if (!data || typeof data !== "object") {
    return DEFAULT_CLASSIFIER;
  }
  const bag = data as {
    contextEnabled?: unknown;
    classes?: unknown;
    sourceId?: unknown;
    instructions?: unknown;
    includeOther?: unknown;
  };
  const classes = Array.isArray(bag.classes)
    ? bag.classes.filter(isClass)
    : DEFAULT_CLASSIFIER.classes;
  return {
    classes: classes.length >= 2 ? classes : DEFAULT_CLASSIFIER.classes,
    sourceId: typeof bag.sourceId === "string" ? bag.sourceId : "",
    instructions:
      typeof bag.instructions === "string" && bag.instructions.trim()
        ? bag.instructions
        : DEFAULT_CLASSIFIER.instructions,
    includeOther: bag.includeOther === true,
    contextEnabled: bag.contextEnabled !== false,
  };
};

export const writeClassifierConfig = (
  element: Pick<ExcalidrawElement, "customData">,
  config: ClassifierConfig,
): ExcalidrawElement["customData"] => {
  const previous = element.customData?.[JAYRR_CALLED_OBJECT_KEY];
  const bag: Record<string, unknown> =
    previous && typeof previous === "object"
      ? { ...(previous as Record<string, unknown>) }
      : {};
  bag.kind = "classifier";
  bag.contextEnabled = config.contextEnabled === true;
  bag.classes = config.classes;
  bag.sourceId = config.sourceId;
  bag.instructions = config.instructions;
  bag.includeOther = config.includeOther;
  return {
    ...(element.customData ?? {}),
    [JAYRR_CALLED_OBJECT_KEY]: bag,
  };
};

export const classOptionsForJev = (config: ClassifierConfig) => {
  const options: Record<string, string | null> = {};
  for (const row of config.classes) {
    const name = row.name.trim();
    if (!name) {
      continue;
    }
    const hint = row.hint.trim();
    options[row.id] = hint || name;
  }
  if (config.includeOther) {
    options[OTHER_CLASS_ID] = "None of the other labels fit.";
  }
  return options;
};
