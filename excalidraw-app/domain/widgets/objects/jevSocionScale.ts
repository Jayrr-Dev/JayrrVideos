const UTTERANCE_SCOPE =
  "Judge only `utterance`. `previous_text` is recent talk before this line; use it to read fragments and replies, not as extra speech to type. Score the Model A ego this line uses, not an MBTI code and not a life diagnosis. Socionics j/p follows the leading function, not the extraverted one.";

export type SocionId =
  | "ILE"
  | "SEI"
  | "ESE"
  | "LII"
  | "EIE"
  | "LSI"
  | "SLE"
  | "IEI"
  | "SEE"
  | "ILI"
  | "LIE"
  | "ESI"
  | "LSE"
  | "EII"
  | "IEE"
  | "SLI";

export type SocionQuadra = "alpha" | "beta" | "gamma" | "delta";

export type SocionDef = {
  id: SocionId;
  code4: string;
  name: string;
  ego: string;
  nick: string;
  quadra: SocionQuadra;
  option: string;
};

export const SOCION_TYPES: readonly SocionDef[] = [
  {
    id: "ILE",
    code4: "ENTp",
    name: "Intuitive Logical Extratim",
    ego: "Ne-Ti",
    nick: "Seeker",
    quadra: "alpha",
    option:
      "ILE ENTp. Intuitive Logical Extravert. Ego Ne-Ti. Seeker/Inventor. Alpha. Leading extraverted intuition: potential, alternatives, new possibilities, curiosity, parallel ideas. Creative introverted logic: structure, categories, how the idea fits.",
  },
  {
    id: "SEI",
    code4: "ISFp",
    name: "Sensing Ethical Introtim",
    ego: "Si-Fe",
    nick: "Mediator",
    quadra: "alpha",
    option:
      "SEI ISFp. Sensing Ethical Introvert. Ego Si-Fe. Mediator/Peacemaker. Alpha. Leading introverted sensing: comfort, harmony of experience, pleasant timing and atmosphere. Creative extraverted ethics: mood, emotional tone, making the room feel easy.",
  },
  {
    id: "ESE",
    code4: "ESFj",
    name: "Ethical Sensing Extratim",
    ego: "Fe-Si",
    nick: "Enthusiast",
    quadra: "alpha",
    option:
      "ESE ESFj. Ethical Sensing Extravert. Ego Fe-Si. Enthusiast. Alpha. Leading extraverted ethics: visible emotion, group mood, warmth, getting people involved. Creative introverted sensing: comfort, care, what feels good in the moment.",
  },
  {
    id: "LII",
    code4: "INTj",
    name: "Logical Intuitive Introtim",
    ego: "Ti-Ne",
    nick: "Analyst",
    quadra: "alpha",
    option:
      "LII INTj. Logical Intuitive Introvert. Ego Ti-Ne. Analyst. Alpha. Leading introverted logic: definitions, systems, consistency, what follows from the rules. Creative extraverted intuition: other angles, missing possibilities, clarifying the idea.",
  },
  {
    id: "EIE",
    code4: "ENFj",
    name: "Ethical Intuitive Extratim",
    ego: "Fe-Ni",
    nick: "Mentor",
    quadra: "beta",
    option:
      "EIE ENFj. Ethical Intuitive Extravert. Ego Fe-Ni. Actor/Mentor. Beta. Leading extraverted ethics: dramatic feeling, shared emotion, rallying people. Creative introverted intuition: timing, meaning, where this is heading.",
  },
  {
    id: "LSI",
    code4: "ISTj",
    name: "Logical Sensing Introtim",
    ego: "Ti-Se",
    nick: "Inspector",
    quadra: "beta",
    option:
      "LSI ISTj. Logical Sensing Introvert. Ego Ti-Se. Inspector. Beta. Leading introverted logic: rules, order, correct classification. Creative extraverted sensing: force, facts on the ground, what must be done now.",
  },
  {
    id: "SLE",
    code4: "ESTp",
    name: "Sensing Logical Extratim",
    ego: "Se-Ti",
    nick: "Marshal",
    quadra: "beta",
    option:
      "SLE ESTp. Sensing Logical Extravert. Ego Se-Ti. Conqueror/Marshal. Beta. Leading extraverted sensing: will, impact, territory, pushing through. Creative introverted logic: the structure that makes the push work.",
  },
  {
    id: "IEI",
    code4: "INFp",
    name: "Intuitive Ethical Introtim",
    ego: "Ni-Fe",
    nick: "Lyricist",
    quadra: "beta",
    option:
      "IEI INFp. Intuitive Ethical Introvert. Ego Ni-Fe. Romantic/Lyricist. Beta. Leading introverted intuition: inner time, images, how the story unfolds. Creative extraverted ethics: feeling-tone, atmosphere, emotional coloring.",
  },
  {
    id: "SEE",
    code4: "ESFp",
    name: "Sensing Ethical Extratim",
    ego: "Se-Fi",
    nick: "Ambassador",
    quadra: "gamma",
    option:
      "SEE ESFp. Sensing Ethical Extravert. Ego Se-Fi. Politician/Ambassador. Gamma. Leading extraverted sensing: presence, influence, reading the room’s power. Creative introverted ethics: personal bonds, likes and dislikes, who is close.",
  },
  {
    id: "ILI",
    code4: "INTp",
    name: "Intuitive Logical Introtim",
    ego: "Ni-Te",
    nick: "Critic",
    quadra: "gamma",
    option:
      "ILI INTp. Intuitive Logical Introvert. Ego Ni-Te. Critic/Observer. Gamma. Leading introverted intuition: likely outcomes, doubt, the long view. Creative extraverted logic: efficiency, facts, whether it actually works.",
  },
  {
    id: "LIE",
    code4: "ENTj",
    name: "Logical Intuitive Extratim",
    ego: "Te-Ni",
    nick: "Pioneer",
    quadra: "gamma",
    option:
      "LIE ENTj. Logical Intuitive Extravert. Ego Te-Ni. Enterpriser/Pioneer. Gamma. Leading extraverted logic: useful action, profit, getting results moving. Creative introverted intuition: timing, trends, where effort should go next.",
  },
  {
    id: "ESI",
    code4: "ISFj",
    name: "Ethical Sensing Introtim",
    ego: "Fi-Se",
    nick: "Guardian",
    quadra: "gamma",
    option:
      "ESI ISFj. Ethical Sensing Introvert. Ego Fi-Se. Guardian. Gamma. Leading introverted ethics: personal distance, loyalty, right vs wrong between people. Creative extraverted sensing: firm boundaries, acting on those judgments.",
  },
  {
    id: "LSE",
    code4: "ESTj",
    name: "Logical Sensing Extratim",
    ego: "Te-Si",
    nick: "Administrator",
    quadra: "delta",
    option:
      "LSE ESTj. Logical Sensing Extravert. Ego Te-Si. Director/Administrator. Delta. Leading extraverted logic: procedure, work, how to get it done correctly. Creative introverted sensing: quality of process, comfort of the working setup.",
  },
  {
    id: "EII",
    code4: "INFj",
    name: "Ethical Intuitive Introtim",
    ego: "Fi-Ne",
    nick: "Humanist",
    quadra: "delta",
    option:
      "EII INFj. Ethical Intuitive Introvert. Ego Fi-Ne. Empath/Humanist. Delta. Leading introverted ethics: inner values, sincerity, how people ought to be treated. Creative extraverted intuition: potential in people, other ways to understand them.",
  },
  {
    id: "IEE",
    code4: "ENFp",
    name: "Intuitive Ethical Extratim",
    ego: "Ne-Fi",
    nick: "Psychologist",
    quadra: "delta",
    option:
      "IEE ENFp. Intuitive Ethical Extravert. Ego Ne-Fi. Psychologist/Reporter. Delta. Leading extraverted intuition: people-possibilities, new connections, interesting angles. Creative introverted ethics: personal insight, who someone really is.",
  },
  {
    id: "SLI",
    code4: "ISTp",
    name: "Sensing Logical Introtim",
    ego: "Si-Te",
    nick: "Artisan",
    quadra: "delta",
    option:
      "SLI ISTp. Sensing Logical Introvert. Ego Si-Te. Craftsman/Artisan. Delta. Leading introverted sensing: practical comfort, how it feels to use, sensory quality. Creative extraverted logic: useful method, the efficient way to make it work.",
  },
];

const SOCION_BY_ID = new Map(SOCION_TYPES.map((row) => [row.id, row]));

export const SOCION_BANDS: readonly SocionDef[] = SOCION_TYPES;

export const SOCION_QUESTION_ID = "socion";

const socionOptions = () => {
  const options: Record<string, string> = {};
  for (const row of SOCION_TYPES) {
    options[row.id] = row.option;
  }
  return options;
};

export const SOCION_QUESTION = {
  id: SOCION_QUESTION_ID,
  type: "choice" as const,
  instructions: `Which socionic type (TIM) is \`utterance\` using? The choice is the strongest. Spread probability so a close second type is visible. Use Model A ego (leading then creative IM element), not Myers-Briggs. ${UTTERANCE_SCOPE}`,
  options: socionOptions(),
};

export type SocionResult = {
  id: SocionId;
  code4: string;
  name: string;
  ego: string;
  nick: string;
  quadra: SocionQuadra;
  label: string;
  confidence: number;
  probabilities: Record<SocionId, number>;
};

type ChoiceAnswer = {
  id: string;
  type: "choice";
  choice?: string;
  probabilities?: Record<string, number>;
  confidence?: number;
};

const emptyProbabilities = (): Record<SocionId, number> => {
  const probabilities = {} as Record<SocionId, number>;
  for (const row of SOCION_TYPES) {
    probabilities[row.id] = 0;
  }
  return probabilities;
};

const isSocionId = (id: string): id is SocionId =>
  SOCION_BY_ID.has(id as SocionId);

const pickId = (
  probabilities: Record<SocionId, number>,
  chosen: SocionId | null,
) => {
  if (chosen && (probabilities[chosen] ?? 0) > 0) {
    return chosen;
  }
  let best: SocionId | null = chosen;
  let top = best ? probabilities[best] ?? 0 : -1;
  for (const row of SOCION_TYPES) {
    const value = probabilities[row.id] ?? 0;
    if (value > top) {
      top = value;
      best = row.id;
    }
  }
  return best;
};

const resultFromProbabilities = (
  probabilities: Record<SocionId, number>,
  chosen: SocionId | null,
): SocionResult | null => {
  const id = pickId(probabilities, chosen);
  if (!id || (probabilities[id] ?? 0) <= 0) {
    return null;
  }
  const def = SOCION_BY_ID.get(id);
  if (!def) {
    return null;
  }
  return {
    id,
    code4: def.code4,
    name: def.name,
    ego: def.ego,
    nick: def.nick,
    quadra: def.quadra,
    label: def.id,
    confidence: probabilities[id] ?? 0,
    probabilities,
  };
};

export const socionFromAnswers = (
  answers: ReadonlyArray<{ id: string; type: string }>,
): SocionResult | null => {
  const answer = answers.find(
    (row): row is ChoiceAnswer =>
      row.id === SOCION_QUESTION_ID && row.type === "choice",
  );
  if (!answer) {
    throw new Error("Jev omitted the socion scores.");
  }
  const probabilities = emptyProbabilities();
  for (const [id, value] of Object.entries(answer.probabilities ?? {})) {
    if (isSocionId(id)) {
      probabilities[id] = value;
    }
  }
  const chosen =
    answer.choice && isSocionId(answer.choice) ? answer.choice : null;
  if (chosen && (probabilities[chosen] ?? 0) <= 0) {
    probabilities[chosen] =
      typeof answer.confidence === "number" ? answer.confidence : 1;
  }
  return resultFromProbabilities(probabilities, chosen);
};

export const averageSocion = (
  rows: readonly SocionResult[],
): SocionResult | null => {
  if (rows.length === 0) {
    return null;
  }
  const probabilities = emptyProbabilities();
  for (const type of SOCION_TYPES) {
    let sum = 0;
    for (const row of rows) {
      sum += row.probabilities[type.id] ?? 0;
    }
    probabilities[type.id] = sum / rows.length;
  }
  return resultFromProbabilities(probabilities, null);
};
