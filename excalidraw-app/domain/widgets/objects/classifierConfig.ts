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
        "Neutral",
        "Not enough good evidence to decide. Sources conflict, facts are missing, or the claim is too vague to test. Neutral is not false.",
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
  preset(
    "hogwarts",
    "Hogwarts house",
    "Which Hogwarts house best matches this speaker? These are broad, playful stereotypes. They describe common patterns, not rules every person in a house must follow. Judge from drive, traits, how they speak, typical phrases, and what they like talking about.",
    [
      [
        "Gryffindor",
        [
          "Main drive: be brave, take action, and stand up for what matters.",
          "Traits: brave, bold, direct, active, confident, competitive, protective, loyal, passionate, impulsive, stubborn, adventurous, honest, emotional, willing to lead, comfortable with risk, quick to defend others, motivated by challenges.",
          "Stereotype: the loud hero who runs toward danger without a plan. They want to save everyone, win the contest, challenge the bully, and tell a dramatic story afterward. They may treat caution as fear and assume courage can solve every problem.",
          "Speech: clear and direct; say what they feel with little filtering; strong, certain words; exciting stories about things they did; challenge people openly; interrupt when excited or angry; make quick promises; encourage action; competitive language; visible emotion.",
          "Typical phrases: “Let’s just do it.” “Someone has to stand up to them.” “What’s the worst that could happen?” “I’m not backing down.” “That isn’t right.” “Trust me. I have a plan.” “We’ll figure it out as we go.”",
          "Topics: adventures, competitions, sports, personal challenges, heroic people, injustice, risky experiences, arguments and conflicts, leadership, protecting friends, exciting plans, stories of overcoming fear.",
        ].join(" "),
      ],
      [
        "Hufflepuff",
        [
          "Main drive: be fair, dependable, and good to people.",
          "Traits: kind, loyal, patient, fair, honest, helpful, dependable, friendly, calm, hardworking, humble, cooperative, supportive, forgiving, practical, welcoming, consistent, good at listening.",
          "Stereotype: the friendly person who brings snacks, checks whether everyone is okay, and does most of the group work without complaining. They want peace and may forgive too easily. Others may mistake kindness for weakness or assume they lack ambition.",
          "Speech: warm and polite; ask how people are feeling; include quieter people; avoid insulting or embarrassing others; sincere praise; explain disagreements gently; listen before responding; use “we” more than “I”; try to calm arguments; steady and friendly.",
          "Typical phrases: “Is everyone okay with that?” “How can I help?” “Let’s be fair.” “We can work it out.” “You did your best.” “Don’t leave them out.” “I’ll take care of it.”",
          "Topics: friends and family, food, pets and animals, comfortable places, community events, helping people, everyday life, shared memories, work and practical tasks, relationships, fair treatment, plans everyone can enjoy.",
        ].join(" "),
      ],
      [
        "Ravenclaw",
        [
          "Main drive: understand things, learn, and form original ideas.",
          "Traits: curious, intelligent, creative, observant, independent, analytical, imaginative, logical, thoughtful, open-minded, quiet, unusual, detail-focused, skeptical, self-directed, good at solving problems, interested in complex ideas, comfortable questioning others.",
          "Stereotype: the quiet expert who corrects small mistakes, reads unusual books, and turns simple questions into long discussions. They know many facts but may forget basic daily tasks. They can spend hours researching a decision everyone else made in five minutes.",
          "Speech: ask many questions; define words carefully; add context and exceptions; correct inaccurate statements; explain how something works; use examples and comparisons; pause to think; change their view when evidence changes; explore several possible answers; sometimes make simple ideas sound complicated.",
          "Typical phrases: “It depends.” “How do we know that?” “What exactly do you mean?” “There’s another way to look at it.” “Technically, that isn’t correct.” “I read something about this.” “Let me think about it.”",
          "Topics: science, technology, books, history, philosophy, art, strange facts, unsolved problems, theories, systems, new inventions, how and why things work, alternative explanations, subjects most people consider too specific.",
        ].join(" "),
      ],
      [
        "Slytherin",
        [
          "Main drive: succeed, gain control, and protect their interests.",
          "Traits: ambitious, strategic, determined, resourceful, persuasive, private, adaptable, competitive, confident, careful, goal-focused, independent, status-aware, selectively loyal, good at reading people, patient when planning, strong at negotiation, willing to make hard choices.",
          "Stereotype: the smooth planner who already knows what they want and who can help them get it. They protect useful information, build strong connections, and avoid showing weakness. Ambition and strategy don’t automatically make someone cruel; the negative stereotype treats them as dishonest or selfish.",
          "Speech: choose words carefully; avoid revealing everything they know; ask questions that uncover useful information; adjust tone for different people; speak with confidence; make clear offers and deals; focus on results; use praise in a planned way; avoid public emotional reactions; say different things to different audiences when needed.",
          "Typical phrases: “What do I get from this?” “Let’s think ahead.” “There’s a better way to handle this.” “You don’t need to tell everyone.” “Who makes the final decision?” “I know someone who can help.” “Wait for the right moment.”",
          "Topics: goals, money, business, careers, influence, leadership, reputation, strategy, powerful people, useful connections, competition, negotiation, social groups, future plans, ways to gain an advantage.",
        ].join(" "),
      ],
    ],
  ),
  preset(
    "genderstyle",
    "Feminine / masculine",
    "Which presentation and social style best matches this speaker? These are playful cultural stereotypes. They describe presentation and social style, not biological sex, identity, intelligence, or ability. The scale moves from strongly feminine to strongly masculine: Feminine → Womanly → Girly → Neutral → Boyish → Manly → Masculine. Girly and Womanly mix age-and-style with femininity; Boyish and Manly do the same on the masculine side. That still works for a fun classifier because each result is a recognizable character type.",
    [
      [
        "Feminine",
        [
          "Core style: soft, elegant, expressive, caring, and highly aware of feelings and presentation.",
          "Traits: gentle, graceful, caring, emotionally open, warm, polite, socially aware, patient, supportive, creative, romantic, detail-focused, sensitive to mood, interested in beauty, careful with presentation.",
          "Stereotype: elegant, emotionally aware, and attentive to how people feel. They notice clothing, atmosphere, manners, relationships, and small personal details. They prefer warmth and cooperation over roughness or direct conflict.",
          "Speech: warm and careful wording; explain feelings in detail; give praise and reassurance; ask personal questions; soften criticism; notice changes in tone or mood; use expressive reactions; try to make conversations comfortable.",
          "Topics: relationships, feelings, fashion, beauty, art, personal growth, family, social events, home design, romantic stories, shared memories, other people’s lives.",
        ].join(" "),
      ],
      [
        "Womanly",
        [
          "Core style: mature, composed, caring, confident, and practical.",
          "Traits: mature, calm, responsible, protective, self-respecting, dependable, patient, caring, emotionally steady, practical, confident, well-spoken, organized, strong-minded, good at setting boundaries.",
          "Stereotype: a mature feminine presence. They care for people but don’t act helpless or overly dependent. They often appear calm, organized, capable, and comfortable taking responsibility for family, work, or social situations.",
          "Speech: calm and clear; thoughtful advice; show care without sounding childish; correct people firmly but politely; discuss emotions without losing control; set clear boundaries; ask practical questions; steady and reassuring tone.",
          "Topics: family, relationships, careers, health, personal standards, life experience, long-term plans, home life, responsibility, community, personal improvement, meaningful social issues.",
        ].join(" "),
      ],
      [
        "Girly",
        [
          "Core style: cute, playful, expressive, youthful, and openly interested in feminine things.",
          "Traits: bubbly, playful, social, expressive, cheerful, trend-aware, affectionate, excitable, friendly, cute, romantic, talkative, emotionally reactive, fun-loving, interested in appearance.",
          "Stereotype: enjoys cute styles, beauty products, trends, romance, social events, and playful conversations. Their feminine side feels youthful and fun rather than mature and formal. They may become excited easily and openly show what they like or dislike.",
          "Speech: lively and emotional wording; react openly to surprising news; frequent compliments; animated personal stories; playful teasing; ask about relationships and social events; speak quickly when excited; casual terms of affection.",
          "Topics: friends, dating, celebrity news, fashion, makeup, shopping, parties, social media, cute animals, romantic stories, entertainment, personal drama, travel plans, fun experiences.",
        ].join(" "),
      ],
      [
        "Neutral",
        [
          "Core style: balanced, flexible, moderate, and not strongly feminine or masculine.",
          "Traits: adaptable, calm, practical, moderate, independent, cooperative, open-minded, casual, emotionally balanced, easygoing, situation-aware, comfortable with different groups, neither highly soft nor highly tough, more focused on interests than gender roles.",
          "Stereotype: doesn’t strongly present as feminine or masculine. They choose clothing, interests, and behaviour based on comfort or usefulness. Their personality changes somewhat with the situation, and gendered expectations don’t strongly shape how they act.",
          "Speech: ordinary, direct language; adjust tone to the situation; share feelings without focusing heavily on them; listen and respond without dramatic reactions; move between personal and practical subjects; disagree without becoming too soft or aggressive; avoid strongly gendered expressions.",
          "Topics: work, hobbies, entertainment, technology, current events, friends, travel, food, everyday problems, personal plans, interesting facts, whatever matches the current group.",
        ].join(" "),
      ],
      [
        "Boyish",
        [
          "Core style: casual, active, playful, competitive, and slightly masculine.",
          "Traits: energetic, playful, adventurous, casual, competitive, mischievous, direct, independent, restless, curious, physically active, less concerned with appearance, comfortable taking risks, friendly through teasing, easily bored by formal situations.",
          "Stereotype: likes action, jokes, games, challenges, and casual clothing. They may dislike formal manners or serious emotional talks. Their masculine side feels youthful and playful rather than commanding or traditionally manly.",
          "Speech: casual and quick; jokes and playful insults; stories about things they did; change the subject during heavy emotional talks; challenge friends for fun; short and direct answers; show friendship through teasing; become loud when excited.",
          "Topics: games, sports, technology, funny stories, adventures, competition, internet culture, vehicles, outdoor activities, action movies, personal projects, strange facts, things they want to try.",
        ].join(" "),
      ],
      [
        "Manly",
        [
          "Core style: tough, protective, capable, steady, and traditionally male.",
          "Traits: strong, protective, brave, dependable, practical, tough, loyal, calm under pressure, hands-on, duty-focused, physically confident, hardworking, quietly caring, willing to take responsibility, uncomfortable appearing helpless.",
          "Stereotype: fixes problems, protects others, keeps promises, and stays calm during difficult situations. They may show affection through actions instead of words. Their masculine style is often physical, practical, rugged, and connected to duty.",
          "Speech: get directly to the point; short and confident statements; offer solutions instead of emotional comfort; avoid sharing private feelings widely; dry humour; speak more through actions than explanations; practical advice; stay controlled during arguments.",
          "Topics: work, sports, tools, vehicles, building and repairing things, physical training, outdoor activities, responsibility, providing for others, practical skills, competition, personal achievements, problems that need solutions.",
        ].join(" "),
      ],
      [
        "Masculine",
        [
          "Core style: direct, independent, disciplined, competitive, commanding, and strongly focused on results.",
          "Traits: assertive, decisive, independent, ambitious, competitive, strategic, disciplined, confident, controlled, goal-focused, strong-willed, risk-tolerant, status-aware, comfortable leading, focused on competence, unwilling to be controlled, protective of personal freedom.",
          "Stereotype: wants control over their life and respects strength, skill, success, and independence. They focus on outcomes and may treat conversations as problems to solve or positions to defend. At the extreme, they can become controlling, aggressive, emotionally closed, or too concerned with winning.",
          "Speech: state opinions directly; confident and certain wording; focus on facts, plans, and outcomes; challenge weak arguments; avoid unnecessary personal details; give instructions clearly; speak competitively; control visible emotion; ask who is responsible; push conversations toward a decision.",
          "Topics: goals, business, money, leadership, strategy, politics, technology, competition, power, status, fitness, sports, skills, future plans, personal freedom, success and achievement.",
        ].join(" "),
      ],
    ],
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
