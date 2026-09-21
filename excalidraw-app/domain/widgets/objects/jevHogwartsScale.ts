import { JEV_SHARED_EVIDENCE } from "../../transcription/jevSharedState";

import {
  averageChoice,
  choiceFromAnswers,
  choiceQuestion,
  rankedChoice,
  type ChoiceBand,
  type ChoiceResult,
} from "./jevChoiceScale";

const UTTERANCE_SCOPE = `Judge only \`utterance\`. ${JEV_SHARED_EVIDENCE} Score the playful house stereotype this line shows, not a life diagnosis.`;

export type HouseId =
  | "gryffindor"
  | "hufflepuff"
  | "ravenclaw"
  | "slytherin";

export type HouseDef = ChoiceBand<HouseId>;

export const HOUSE_BANDS: readonly HouseDef[] = [
  {
    id: "gryffindor",
    name: "Gryffindor",
    what: "Brave, bold, and ready to act. Stands up for people and treats caution as optional.",
    option: [
      "Gryffindor. Main drive: be brave, take action, and stand up for what matters.",
      "Traits: brave, bold, direct, active, confident, competitive, protective, loyal, passionate, impulsive, stubborn, adventurous, honest, emotional, willing to lead, comfortable with risk, quick to defend others, motivated by challenges.",
      "Stereotype: the loud hero who runs toward danger without a plan. They want to save everyone, win the contest, challenge the bully, and tell a dramatic story afterward. They may treat caution as fear and assume courage can solve every problem.",
      "Speech: clear and direct; say what they feel with little filtering; strong, certain words; exciting stories about things they did; challenge people openly; interrupt when excited or angry; make quick promises; encourage action; competitive language; visible emotion.",
      "Typical phrases: “Let’s just do it.” “Someone has to stand up to them.” “What’s the worst that could happen?” “I’m not backing down.” “That isn’t right.” “Trust me. I have a plan.” “We’ll figure it out as we go.”",
      "Topics: adventures, competitions, sports, personal challenges, heroic people, injustice, risky experiences, arguments and conflicts, leadership, protecting friends, exciting plans, stories of overcoming fear.",
    ].join(" "),
  },
  {
    id: "hufflepuff",
    name: "Hufflepuff",
    what: "Fair, dependable, and kind. Keeps the group okay and does the work without fuss.",
    option: [
      "Hufflepuff. Main drive: be fair, dependable, and good to people.",
      "Traits: kind, loyal, patient, fair, honest, helpful, dependable, friendly, calm, hardworking, humble, cooperative, supportive, forgiving, practical, welcoming, consistent, good at listening.",
      "Stereotype: the friendly person who brings snacks, checks whether everyone is okay, and does most of the group work without complaining. They want peace and may forgive too easily. Others may mistake kindness for weakness or assume they lack ambition.",
      "Speech: warm and polite; ask how people are feeling; include quieter people; avoid insulting or embarrassing others; sincere praise; explain disagreements gently; listen before responding; use “we” more than “I”; try to calm arguments; steady and friendly.",
      "Typical phrases: “Is everyone okay with that?” “How can I help?” “Let’s be fair.” “We can work it out.” “You did your best.” “Don’t leave them out.” “I’ll take care of it.”",
      "Topics: friends and family, food, pets and animals, comfortable places, community events, helping people, everyday life, shared memories, work and practical tasks, relationships, fair treatment, plans everyone can enjoy.",
    ].join(" "),
  },
  {
    id: "ravenclaw",
    name: "Ravenclaw",
    what: "Curious and idea-first. Asks how we know, then turns a simple point into a longer one.",
    option: [
      "Ravenclaw. Main drive: understand things, learn, and form original ideas.",
      "Traits: curious, intelligent, creative, observant, independent, analytical, imaginative, logical, thoughtful, open-minded, quiet, unusual, detail-focused, skeptical, self-directed, good at solving problems, interested in complex ideas, comfortable questioning others.",
      "Stereotype: the quiet expert who corrects small mistakes, reads unusual books, and turns simple questions into long discussions. They know many facts but may forget basic daily tasks. They can spend hours researching a decision everyone else made in five minutes.",
      "Speech: ask many questions; define words carefully; add context and exceptions; correct inaccurate statements; explain how something works; use examples and comparisons; pause to think; change their view when evidence changes; explore several possible answers; sometimes make simple ideas sound complicated.",
      "Typical phrases: “It depends.” “How do we know that?” “What exactly do you mean?” “There’s another way to look at it.” “Technically, that isn’t correct.” “I read something about this.” “Let me think about it.”",
      "Topics: science, technology, books, history, philosophy, art, strange facts, unsolved problems, theories, systems, new inventions, how and why things work, alternative explanations, subjects most people consider too specific.",
    ].join(" "),
  },
  {
    id: "slytherin",
    name: "Slytherin",
    what: "Ambitious and strategic. Protects advantage, picks words, and thinks ahead.",
    option: [
      "Slytherin. Main drive: succeed, gain control, and protect their interests.",
      "Traits: ambitious, strategic, determined, resourceful, persuasive, private, adaptable, competitive, confident, careful, goal-focused, independent, status-aware, selectively loyal, good at reading people, patient when planning, strong at negotiation, willing to make hard choices.",
      "Stereotype: the smooth planner who already knows what they want and who can help them get it. They protect useful information, build strong connections, and avoid showing weakness. Ambition and strategy don’t automatically make someone cruel; the negative stereotype treats them as dishonest or selfish.",
      "Speech: choose words carefully; avoid revealing everything they know; ask questions that uncover useful information; adjust tone for different people; speak with confidence; make clear offers and deals; focus on results; use praise in a planned way; avoid public emotional reactions; say different things to different audiences when needed.",
      "Typical phrases: “What do I get from this?” “Let’s think ahead.” “There’s a better way to handle this.” “You don’t need to tell everyone.” “Who makes the final decision?” “I know someone who can help.” “Wait for the right moment.”",
      "Topics: goals, money, business, careers, influence, leadership, reputation, strategy, powerful people, useful connections, competition, negotiation, social groups, future plans, ways to gain an advantage.",
    ].join(" "),
  },
];

export const HOUSE_QUESTION_ID = "house";

export const HOUSE_QUESTION = choiceQuestion(
  HOUSE_QUESTION_ID,
  `Which Hogwarts house best matches \`utterance\`? These are broad, playful stereotypes. They describe common patterns, not rules every person in a house must follow. The choice is the strongest. Spread probability so a close second house is visible. ${UTTERANCE_SCOPE} Judge from drive, traits, how they speak, typical phrases, and topics.`,
  HOUSE_BANDS,
);

export type HouseResult = ChoiceResult<HouseId>;

export const houseFromAnswers = (
  answers: ReadonlyArray<{ id: string; type: string }>,
): HouseResult | null =>
  choiceFromAnswers(
    answers,
    HOUSE_QUESTION_ID,
    HOUSE_BANDS,
    "Jev omitted the Hogwarts house scores.",
  );

export const averageHouse = (rows: readonly HouseResult[]): HouseResult | null =>
  averageChoice(HOUSE_BANDS, rows);

export const rankedHouse = (row: HouseResult, count: number): HouseResult[] =>
  rankedChoice(HOUSE_BANDS, row, count);
