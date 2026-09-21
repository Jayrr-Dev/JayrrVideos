import { JEV_SHARED_EVIDENCE } from "../../transcription/jevSharedState";

import {
  averageChoice,
  choiceFromAnswers,
  choiceQuestion,
  rankedChoice,
  type ChoiceBand,
  type ChoiceResult,
} from "./jevChoiceScale";

const UTTERANCE_SCOPE = `Judge only \`utterance\`. ${JEV_SHARED_EVIDENCE} Score presentation and social style, not biological sex, identity, intelligence, or ability.`;

export type GenderStyleId =
  | "feminine"
  | "womanly"
  | "girly"
  | "neutral"
  | "boyish"
  | "manly"
  | "masculine";

export type GenderStyleDef = ChoiceBand<GenderStyleId>;

export const GENDER_BANDS: readonly GenderStyleDef[] = [
  {
    id: "feminine",
    name: "Feminine",
    what: "Soft, elegant, and feeling-aware. Warm wording and attention to presentation.",
    example: "That color is so pretty on you. How are you feeling about it?",
    option: [
      "Feminine. Core style: soft, elegant, expressive, caring, and highly aware of feelings and presentation.",
      "Traits: gentle, graceful, caring, emotionally open, warm, polite, socially aware, patient, supportive, creative, romantic, detail-focused, sensitive to mood, interested in beauty, careful with presentation.",
      "Stereotype: elegant, emotionally aware, and attentive to how people feel. They notice clothing, atmosphere, manners, relationships, and small personal details. They prefer warmth and cooperation over roughness or direct conflict.",
      "Speech: warm and careful wording; explain feelings in detail; give praise and reassurance; ask personal questions; soften criticism; notice changes in tone or mood; use expressive reactions; try to make conversations comfortable.",
      "Topics: relationships, feelings, fashion, beauty, art, personal growth, family, social events, home design, romantic stories, shared memories, other people’s lives.",
    ].join(" "),
  },
  {
    id: "womanly",
    name: "Womanly",
    what: "Mature, composed, and practical. Care with boundaries, not helplessness.",
    example: "I can help, and I also need that boundary respected.",
    option: [
      "Womanly. Core style: mature, composed, caring, confident, and practical.",
      "Traits: mature, calm, responsible, protective, self-respecting, dependable, patient, caring, emotionally steady, practical, confident, well-spoken, organized, strong-minded, good at setting boundaries.",
      "Stereotype: a mature feminine presence. They care for people but don’t act helpless or overly dependent. They often appear calm, organized, capable, and comfortable taking responsibility for family, work, or social situations.",
      "Speech: calm and clear; thoughtful advice; show care without sounding childish; correct people firmly but politely; discuss emotions without losing control; set clear boundaries; ask practical questions; steady and reassuring tone.",
      "Topics: family, relationships, careers, health, personal standards, life experience, long-term plans, home life, responsibility, community, personal improvement, meaningful social issues.",
    ].join(" "),
  },
  {
    id: "girly",
    name: "Girly",
    what: "Cute, bubbly, and youthful. Playful feminine talk, trends, and open reactions.",
    example: "Oh my god, that is adorable. We have to go.",
    option: [
      "Girly. Core style: cute, playful, expressive, youthful, and openly interested in feminine things.",
      "Traits: bubbly, playful, social, expressive, cheerful, trend-aware, affectionate, excitable, friendly, cute, romantic, talkative, emotionally reactive, fun-loving, interested in appearance.",
      "Stereotype: enjoys cute styles, beauty products, trends, romance, social events, and playful conversations. Their feminine side feels youthful and fun rather than mature and formal. They may become excited easily and openly show what they like or dislike.",
      "Speech: lively and emotional wording; react openly to surprising news; frequent compliments; animated personal stories; playful teasing; ask about relationships and social events; speak quickly when excited; casual terms of affection.",
      "Topics: friends, dating, celebrity news, fashion, makeup, shopping, parties, social media, cute animals, romantic stories, entertainment, personal drama, travel plans, fun experiences.",
    ].join(" "),
  },
  {
    id: "neutral",
    name: "Neutral",
    what: "Balanced and casual. Interests first; not strongly feminine or masculine.",
    example: "Either works. I just want the version that is easier to use.",
    option: [
      "Neutral. Core style: balanced, flexible, moderate, and not strongly feminine or masculine.",
      "Traits: adaptable, calm, practical, moderate, independent, cooperative, open-minded, casual, emotionally balanced, easygoing, situation-aware, comfortable with different groups, neither highly soft nor highly tough, more focused on interests than gender roles.",
      "Stereotype: doesn’t strongly present as feminine or masculine. They choose clothing, interests, and behaviour based on comfort or usefulness. Their personality changes somewhat with the situation, and gendered expectations don’t strongly shape how they act.",
      "Speech: ordinary, direct language; adjust tone to the situation; share feelings without focusing heavily on them; listen and respond without dramatic reactions; move between personal and practical subjects; disagree without becoming too soft or aggressive; avoid strongly gendered expressions.",
      "Topics: work, hobbies, entertainment, technology, current events, friends, travel, food, everyday problems, personal plans, interesting facts, whatever matches the current group.",
    ].join(" "),
  },
  {
    id: "boyish",
    name: "Boyish",
    what: "Casual, playful, and a bit competitive. Youthful masculine energy, not command.",
    example: "Bet. Race you. Last one buys snacks.",
    option: [
      "Boyish. Core style: casual, active, playful, competitive, and slightly masculine.",
      "Traits: energetic, playful, adventurous, casual, competitive, mischievous, direct, independent, restless, curious, physically active, less concerned with appearance, comfortable taking risks, friendly through teasing, easily bored by formal situations.",
      "Stereotype: likes action, jokes, games, challenges, and casual clothing. They may dislike formal manners or serious emotional talks. Their masculine side feels youthful and playful rather than commanding or traditionally manly.",
      "Speech: casual and quick; jokes and playful insults; stories about things they did; change the subject during heavy emotional talks; challenge friends for fun; short and direct answers; show friendship through teasing; become loud when excited.",
      "Topics: games, sports, technology, funny stories, adventures, competition, internet culture, vehicles, outdoor activities, action movies, personal projects, strange facts, things they want to try.",
    ].join(" "),
  },
  {
    id: "manly",
    name: "Manly",
    what: "Tough, protective, and practical. Fixes problems; shows care through action.",
    example: "Stay here. I’ll handle it.",
    option: [
      "Manly. Core style: tough, protective, capable, steady, and traditionally male.",
      "Traits: strong, protective, brave, dependable, practical, tough, loyal, calm under pressure, hands-on, duty-focused, physically confident, hardworking, quietly caring, willing to take responsibility, uncomfortable appearing helpless.",
      "Stereotype: fixes problems, protects others, keeps promises, and stays calm during difficult situations. They may show affection through actions instead of words. Their masculine style is often physical, practical, rugged, and connected to duty.",
      "Speech: get directly to the point; short and confident statements; offer solutions instead of emotional comfort; avoid sharing private feelings widely; dry humour; speak more through actions than explanations; practical advice; stay controlled during arguments.",
      "Topics: work, sports, tools, vehicles, building and repairing things, physical training, outdoor activities, responsibility, providing for others, practical skills, competition, personal achievements, problems that need solutions.",
    ].join(" "),
  },
  {
    id: "masculine",
    name: "Masculine",
    what: "Direct, independent, and results-first. Commands, competes, and stays in control.",
    example: "Decide now. Who owns this, and what is the outcome?",
    option: [
      "Masculine. Core style: direct, independent, disciplined, competitive, commanding, and strongly focused on results.",
      "Traits: assertive, decisive, independent, ambitious, competitive, strategic, disciplined, confident, controlled, goal-focused, strong-willed, risk-tolerant, status-aware, comfortable leading, focused on competence, unwilling to be controlled, protective of personal freedom.",
      "Stereotype: wants control over their life and respects strength, skill, success, and independence. They focus on outcomes and may treat conversations as problems to solve or positions to defend. At the extreme, they can become controlling, aggressive, emotionally closed, or too concerned with winning.",
      "Speech: state opinions directly; confident and certain wording; focus on facts, plans, and outcomes; challenge weak arguments; avoid unnecessary personal details; give instructions clearly; speak competitively; control visible emotion; ask who is responsible; push conversations toward a decision.",
      "Topics: goals, business, money, leadership, strategy, politics, technology, competition, power, status, fitness, sports, skills, future plans, personal freedom, success and achievement.",
    ].join(" "),
  },
];

export const GENDER_QUESTION_ID = "gender";

export const GENDER_QUESTION = choiceQuestion(
  GENDER_QUESTION_ID,
  `Which presentation and social style best matches \`utterance\`? These are playful cultural stereotypes, not sex or identity. The scale is Feminine → Womanly → Girly → Neutral → Boyish → Manly → Masculine. Girly and Womanly mix age-and-style with femininity; Boyish and Manly do the same on the masculine side. The choice is the strongest. Spread probability so a close second is visible. ${UTTERANCE_SCOPE}`,
  GENDER_BANDS,
);

export type GenderStyleResult = ChoiceResult<GenderStyleId>;

export const genderFromAnswers = (
  answers: ReadonlyArray<{ id: string; type: string }>,
): GenderStyleResult | null =>
  choiceFromAnswers(
    answers,
    GENDER_QUESTION_ID,
    GENDER_BANDS,
    "Jev omitted the feminine/masculine scores.",
  );

export const averageGender = (
  rows: readonly GenderStyleResult[],
): GenderStyleResult | null => averageChoice(GENDER_BANDS, rows);

export const rankedGender = (
  row: GenderStyleResult,
  count: number,
): GenderStyleResult[] => rankedChoice(GENDER_BANDS, row, count);
