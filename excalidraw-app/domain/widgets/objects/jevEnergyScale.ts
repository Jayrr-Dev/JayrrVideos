const UTTERANCE_SCOPE =
  "Judge only `utterance`. `previous_text` is recent talk before this line; use it to read fragments and replies, not as extra speech to score. Score the emotional energy this line expresses, not a life diagnosis or a running speaker mean.";

export type EnergyZone = "low" | "mid" | "high";

export type EnergyId =
  | "30"
  | "50"
  | "80"
  | "100"
  | "120"
  | "160"
  | "180"
  | "190"
  | "200"
  | "275"
  | "320"
  | "400"
  | "450"
  | "475"
  | "505"
  | "510"
  | "530"
  | "540"
  | "550"
  | "570"
  | "600"
  | "700"
  | "1000";

export type EnergyBand = {
  id: EnergyId;
  level: number;
  zone: EnergyZone;
  name: string;
  what: string;
};

export const ENERGY_BANDS: readonly EnergyBand[] = [
  {
    id: "30",
    level: 30,
    zone: "low",
    name: "Guilt",
    what: "Something feels deeply wrong with them. Shame says “I am bad”; guilt says “I did something bad.” They may hide, punish themselves, expect rejection, or believe they do not deserve help. Attention stays on faults, mistakes, and fear of being exposed.",
  },
  {
    id: "50",
    level: 50,
    zone: "low",
    name: "Apathy",
    what: "Very little drive. They may believe nothing can improve, so they do not fight the situation. Daily care, work, relationships, and health may be ignored. Unlike peaceful acceptance, there is little interest, hope, or willingness to act.",
  },
  {
    id: "80",
    level: 80,
    zone: "low",
    name: "Grief",
    what: "Life is viewed through loss, regret, and past failure. They can still feel strongly, unlike apathy, but most of that feeling is pain. They replay what happened, focus on what is gone, and struggle to imagine a better future. Self-pity appears when they feel singled out and want the suffering recognized.",
  },
  {
    id: "100",
    level: 100,
    zone: "low",
    name: "Fear",
    what: "The world feels unsafe. Attention stays on threats. They may avoid risks, people, decisions, or new experiences because they expect harm, failure, or embarrassment. They seek safety and certainty before acting. More energy than apathy because they want protection, but action is still limited.",
  },
  {
    id: "120",
    level: 120,
    zone: "low",
    name: "Craving",
    what: "They strongly want something outside themselves: money, attention, food, status, sex, entertainment, or approval. The mind says they need this before they can feel good. Motivation is stronger, but satisfaction usually does not last. One want is replaced by another.",
  },
  {
    id: "160",
    level: 160,
    zone: "low",
    name: "Anger",
    what: "Frustration turns into force. They are more willing to act than someone controlled by fear, but the action may involve threats, blame, pressure, or domination. Anger can stop powerlessness, yet it damages judgment and relationships when it is the normal state.",
  },
  {
    id: "180",
    level: 180,
    zone: "low",
    name: "Conflict",
    what: "They clearly see what they dislike but spend more energy attacking problems than solving them. They may argue, find faults, complain, and hold others responsible. Unlike direct anger, this can look like constant negativity, bitterness, resistance, or dissatisfaction.",
  },
  {
    id: "190",
    level: 190,
    zone: "low",
    name: "Pride",
    what: "Self-worth comes from feeling better, smarter, stronger, richer, or more moral than other people. They may appear confident, but confidence depends on comparison and outside respect. Disagreement feels like a personal attack because an error threatens the identity they built.",
  },
  {
    id: "200",
    level: 200,
    zone: "mid",
    name: "Contentment",
    what: "The major change from emotional struggle to basic stability. They can work, follow routines, meet responsibilities, and manage ordinary life. Life may feel plain, repetitive, or lacking passion. Nothing is seriously wrong, but there may be little excitement, growth, or deeper purpose.",
  },
  {
    id: "275",
    level: 275,
    zone: "mid",
    name: "Courage",
    what: "Willing to face uncertainty and try something new. Problems look manageable instead of threatening. They can act without a guaranteed result and recover more easily when something fails. Relaxation here means acting without being controlled by fear or pressure.",
  },
  {
    id: "320",
    level: 320,
    zone: "mid",
    name: "Willingness",
    what: "Life becomes active and constructive. They want to learn, help, work, improve, and take responsibility. They generally expect effort to produce useful results. Optimism is connected to action: they participate in improving life, not only hope it improves.",
  },
  {
    id: "400",
    level: 400,
    zone: "mid",
    name: "Acceptance",
    what: "They can look at reality without quickly rejecting or judging it. They listen, study, and consider different views. Acceptance does not mean agreeing with everything. It means seeing what is present before deciding how to respond. Neutrality makes them less defensive.",
  },
  {
    id: "450",
    level: 450,
    zone: "mid",
    name: "Intelligence",
    what: "Thinking is the main tool for understanding life. They value facts, logic, learning, planning, and clear explanations. They can study complex ideas and question weak beliefs. The risk is relying too much on the mind while ignoring emotion, intuition, or relationships.",
  },
  {
    id: "475",
    level: 475,
    zone: "high",
    name: "Joy",
    what: "A strong desire to create, explore, express, and contribute. Work may feel meaningful rather than forced. Ideas arise easily, and they enjoy turning them into art, solutions, inventions, or useful experiences. Joy here is active and productive, not only pleasant comfort.",
  },
  {
    id: "505",
    level: 505,
    zone: "high",
    name: "Beauty",
    what: "They see beauty and possibility in ordinary things. Imagination is clearer and less limited by fear or social approval. They can form ideas that feel original, complete, and meaningful. Creation comes from inspiration rather than a need to prove personal worth.",
  },
  {
    id: "510",
    level: 510,
    zone: "high",
    name: "Power",
    what: "The ability to act clearly and produce results without forcing others. They begin tasks, keep their word, and accept responsibility for their choices. Integrity means actions match values. Confidence comes from inner stability rather than status or control.",
  },
  {
    id: "530",
    level: 530,
    zone: "high",
    name: "Love",
    what: "They relate to life through care and gratitude rather than need. They value people without constantly asking what they can receive. Intuition matters more: they notice feelings, patterns, and subtle signals that pure logic may miss. Appreciation makes ordinary experiences feel valuable.",
  },
  {
    id: "540",
    level: 540,
    zone: "high",
    name: "Humour",
    what: "Happiness is less dependent on perfect conditions. They can see the lighter side of difficulties without denying them. Humour is warm rather than cruel, and it connects people instead of placing someone beneath others. Life feels enjoyable, open, and less controlled by fear.",
  },
  {
    id: "550",
    level: 550,
    zone: "high",
    name: "Unconditional",
    what: "Love is no longer reserved only for people who behave as expected. They care without always demanding agreement, reward, or repayment. This does not mean accepting abuse or losing boundaries. Another person’s value is not removed because they are difficult, flawed, or different.",
  },
  {
    id: "570",
    level: 570,
    zone: "high",
    name: "Ecstasy",
    what: "Intense wonder, love, gratitude, or spiritual connection. Ordinary self-concern becomes much weaker. Life can feel unusually vivid and meaningful. This is a rare state that may appear for a short time rather than remain as a normal baseline.",
  },
  {
    id: "600",
    level: 600,
    zone: "high",
    name: "Bliss",
    what: "Inner conflict becomes very quiet. They do not feel a strong need to fight reality, gain approval, or control every outcome. Peace is stable and comes from within rather than from getting everything they want. Problems may still exist, but they create less fear and resistance.",
  },
  {
    id: "700",
    level: 700,
    zone: "high",
    name: "Oneness",
    what: "The usual division between “me” and “everything else” begins to disappear. Life is experienced as one connected whole rather than separate people and objects competing. Personal identity and private desires become less important. Deep spiritual awareness sits in this range.",
  },
  {
    id: "1000",
    level: 1000,
    zone: "high",
    name: "Infinity",
    what: "Complete unity with existence, without a separate personal self, private desire, fear, or resistance. Not an ordinary emotion or personality. An extremely rare ideal of total awareness.",
  },
];

export const ENERGY_QUESTION_ID = "energy";

/** Jev score questions allow at most 10 levels; legend chips stay on ENERGY_BANDS. */
const ENERGY_SCORE_GROUPS: readonly {
  ids: readonly EnergyId[];
  what: string;
}[] = [
  {
    ids: ["30", "50"],
    what: "30 Guilt / 50 Apathy. Self-blame, hiding, or no drive. They punish themselves or give up because nothing can improve.",
  },
  {
    ids: ["80", "100"],
    what: "80 Grief / 100 Fear. Loss, regret, or threat. They replay what is gone or avoid acting because harm feels likely.",
  },
  {
    ids: ["120", "160"],
    what: "120 Craving / 160 Anger. Wanting something outside themselves, or forcing the world with blame, pressure, or domination.",
  },
  {
    ids: ["180", "190"],
    what: "180 Conflict / 190 Pride. Attacking problems more than solving them, or needing to look better than other people.",
  },
  {
    ids: ["200", "275"],
    what: "200 Contentment / 275 Courage. Ordinary function and routines, or willingness to face uncertainty and try something new.",
  },
  {
    ids: ["320", "400"],
    what: "320 Willingness / 400 Acceptance. Constructive effort and responsibility, or seeing reality without rushing to reject it.",
  },
  {
    ids: ["450", "475"],
    what: "450 Intelligence / 475 Joy. Clear thinking as the main tool, or a strong drive to create, explore, and contribute.",
  },
  {
    ids: ["505", "510"],
    what: "505 Beauty / 510 Power. Seeing possibility in ordinary things, or acting clearly and producing results without forcing others.",
  },
  {
    ids: ["530", "540", "550"],
    what: "530 Love / 540 Humour / 550 Unconditional. Care and gratitude, warm humour, or valuing people without demanding repayment.",
  },
  {
    ids: ["570", "600", "700", "1000"],
    what: "570 Ecstasy to 1000 Infinity. Intense wonder, inner peace, oneness, or total unity. Do not pick this unless the line actually shows that state.",
  },
];

const ENERGY_SCORE_TOP = ENERGY_SCORE_GROUPS.length - 1;
const ENERGY_BAND_BY_ID = new Map(
  ENERGY_BANDS.map((band) => [band.id, band] as const),
);

export const ENERGY_QUESTION = {
  id: ENERGY_QUESTION_ID,
  type: "score" as const,
  instructions: `What Dodson energy level does \`utterance\` express? Score this line’s emotional energy, not the speaker’s whole life. Lower levels are self-rejection, helplessness, fear, craving, conflict, and pride. Mid levels are function, courage, responsibility, and understanding. Higher levels are creativity, love, peace, and unity. Do not skip to a high level unless the line actually shows that state. ${UTTERANCE_SCOPE}`,
  levels: ENERGY_SCORE_GROUPS.map((group) => ({
    what: group.what,
    examples: [] as string[],
  })),
};

export type EnergyResult = {
  id: EnergyId;
  label: string;
  name: string;
  zone: EnergyZone;
  level: number;
  confidence: number;
};

type ScoreAnswer = {
  id: string;
  type: "score";
  score: number;
  confidence?: number;
};

const clampScoreIndex = (value: number) =>
  Math.min(ENERGY_SCORE_TOP, Math.max(0, Math.round(value)));

const resultFromBand = (
  band: EnergyBand,
  confidence: number,
): EnergyResult => ({
  id: band.id,
  label: String(band.level),
  name: band.name,
  zone: band.zone,
  level: band.level,
  confidence,
});

const resultFromScoreIndex = (
  index: number,
  confidence: number,
): EnergyResult | null => {
  const group = ENERGY_SCORE_GROUPS[clampScoreIndex(index)];
  const id = group?.ids[0];
  const band = id ? ENERGY_BAND_BY_ID.get(id) : undefined;
  if (!band) {
    return null;
  }
  return resultFromBand(band, confidence);
};

const nearestBand = (value: number): EnergyBand | undefined => {
  let best: EnergyBand | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const band of ENERGY_BANDS) {
    const dist = Math.abs(band.level - value);
    if (dist < bestDist) {
      best = band;
      bestDist = dist;
    }
  }
  return best;
};

export const energyFromAnswers = (
  answers: ReadonlyArray<{ id: string; type: string }>,
): EnergyResult | null => {
  const answer = answers.find(
    (row): row is ScoreAnswer =>
      row.id === ENERGY_QUESTION_ID && row.type === "score",
  );
  if (!answer) {
    throw new Error("Jev omitted the energy score.");
  }
  return resultFromScoreIndex(
    answer.score,
    typeof answer.confidence === "number" ? answer.confidence : 0,
  );
};

export const averageEnergy = (
  rows: readonly EnergyResult[],
): EnergyResult | null => {
  if (rows.length === 0) {
    return null;
  }
  const level = rows.reduce((sum, row) => sum + row.level, 0) / rows.length;
  const confidence =
    rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length;
  const band = nearestBand(level);
  if (!band) {
    return null;
  }
  return resultFromBand(band, confidence);
};
