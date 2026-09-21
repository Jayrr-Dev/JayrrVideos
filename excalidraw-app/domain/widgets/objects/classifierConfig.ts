import type { ExcalidrawElement } from "@excalidraw/element/types";

import { JAYRR_CALLED_OBJECT_KEY } from "../model";

import { GENDER_BANDS } from "./jevGenderStyleScale";
import { HOUSE_BANDS } from "./jevHogwartsScale";
import { TRUTH_BANDS } from "./jevTruthScale";

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

const classHint = (what: string, example?: string) =>
  example ? `${what} Example: ${example}` : what;

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

const presetFromCopy = (
  id: string,
  name: string,
  instructions: string,
  bands: readonly {
    name?: string;
    label?: string;
    what: string;
    example?: string;
    option?: string;
  }[],
  includeOther = false,
): ClassifierPreset =>
  preset(
    id,
    name,
    instructions,
    bands.map((band) => [
      band.label ?? band.name ?? "",
      band.option ?? classHint(band.what, band.example),
    ]),
    includeOther,
  );

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
  presetFromCopy(
    "truth",
    "Claim truth",
    "How well does this claim match known facts and available evidence? Judge the claim itself, not whether the speaker meant to lie.",
    TRUTH_BANDS,
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
  presetFromCopy(
    "hogwarts",
    "Hogwarts house",
    "Which Hogwarts house best matches this speaker? These are broad, playful stereotypes. They describe common patterns, not rules every person in a house must follow. Judge from drive, traits, how they speak, typical phrases, and what they like talking about.",
    HOUSE_BANDS,
  ),
  presetFromCopy(
    "genderstyle",
    "Feminine / masculine",
    "Which presentation and social style best matches this speaker? These are playful cultural stereotypes. They describe presentation and social style, not biological sex, identity, intelligence, or ability. The scale moves from strongly feminine to strongly masculine: Feminine → Womanly → Girly → Neutral → Boyish → Manly → Masculine. Girly and Womanly mix age-and-style with femininity; Boyish and Manly do the same on the masculine side. That still works for a fun classifier because each result is a recognizable character type.",
    GENDER_BANDS,
  ),
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
