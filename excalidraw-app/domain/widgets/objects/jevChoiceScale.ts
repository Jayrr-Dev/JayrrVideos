type ChoiceAnswer = {
  id: string;
  type: "choice";
  choice?: string;
  probabilities?: Record<string, number>;
  confidence?: number;
};

export type ChoiceBand<Id extends string> = {
  id: Id;
  name: string;
  what: string;
  option: string;
};

export type ChoiceResult<Id extends string> = {
  id: Id;
  name: string;
  what: string;
  label: string;
  confidence: number;
  probabilities: Record<Id, number>;
};

export const choiceQuestion = <Id extends string>(
  id: string,
  instructions: string,
  bands: readonly ChoiceBand<Id>[],
) => {
  const options: Record<string, string> = {};
  for (const row of bands) {
    options[row.id] = row.option;
  }
  return {
    id,
    type: "choice" as const,
    instructions,
    options,
  };
};

const emptyProbabilities = <Id extends string>(
  bands: readonly ChoiceBand<Id>[],
): Record<Id, number> => {
  const probabilities = {} as Record<Id, number>;
  for (const row of bands) {
    probabilities[row.id] = 0;
  }
  return probabilities;
};

const byId = <Id extends string>(bands: readonly ChoiceBand<Id>[]) =>
  new Map(bands.map((row) => [row.id, row]));

const pickId = <Id extends string>(
  bands: readonly ChoiceBand<Id>[],
  probabilities: Record<Id, number>,
  chosen: Id | null,
) => {
  if (chosen && (probabilities[chosen] ?? 0) > 0) {
    return chosen;
  }
  let best: Id | null = chosen;
  let top = best ? probabilities[best] ?? 0 : -1;
  for (const row of bands) {
    const value = probabilities[row.id] ?? 0;
    if (value > top) {
      top = value;
      best = row.id;
    }
  }
  return best;
};

export const resultFromChoice = <Id extends string>(
  bands: readonly ChoiceBand<Id>[],
  probabilities: Record<Id, number>,
  chosen: Id | null,
): ChoiceResult<Id> | null => {
  const id = pickId(bands, probabilities, chosen);
  if (!id || (probabilities[id] ?? 0) <= 0) {
    return null;
  }
  const def = byId(bands).get(id);
  if (!def) {
    return null;
  }
  return {
    id,
    name: def.name,
    what: def.what,
    label: def.name,
    confidence: probabilities[id] ?? 0,
    probabilities,
  };
};

export const choiceFromAnswers = <Id extends string>(
  answers: ReadonlyArray<{ id: string; type: string }>,
  questionId: string,
  bands: readonly ChoiceBand<Id>[],
  omittedError: string,
): ChoiceResult<Id> | null => {
  const ids = new Set(bands.map((row) => row.id));
  const answer = answers.find(
    (row): row is ChoiceAnswer =>
      row.id === questionId && row.type === "choice",
  );
  if (!answer) {
    throw new Error(omittedError);
  }
  const probabilities = emptyProbabilities(bands);
  for (const [id, value] of Object.entries(answer.probabilities ?? {})) {
    if (ids.has(id as Id)) {
      probabilities[id as Id] = value;
    }
  }
  const chosen =
    answer.choice && ids.has(answer.choice as Id)
      ? (answer.choice as Id)
      : null;
  if (chosen && (probabilities[chosen] ?? 0) <= 0) {
    probabilities[chosen] =
      typeof answer.confidence === "number" ? answer.confidence : 1;
  }
  return resultFromChoice(bands, probabilities, chosen);
};

export const averageChoice = <Id extends string>(
  bands: readonly ChoiceBand<Id>[],
  rows: readonly ChoiceResult<Id>[],
): ChoiceResult<Id> | null => {
  if (rows.length === 0) {
    return null;
  }
  const probabilities = emptyProbabilities(bands);
  for (const type of bands) {
    let sum = 0;
    for (const row of rows) {
      sum += row.probabilities[type.id] ?? 0;
    }
    probabilities[type.id] = sum / rows.length;
  }
  return resultFromChoice(bands, probabilities, null);
};

export const rankedChoice = <Id extends string>(
  bands: readonly ChoiceBand<Id>[],
  row: ChoiceResult<Id>,
  count: number,
): ChoiceResult<Id>[] => {
  const ids = bands
    .map((type) => type.id)
    .filter((id) => (row.probabilities[id] ?? 0) > 0)
    .sort(
      (left, right) =>
        (row.probabilities[right] ?? 0) - (row.probabilities[left] ?? 0),
    )
    .slice(0, Math.max(0, count));
  return ids
    .map((id) => resultFromChoice(bands, row.probabilities, id))
    .filter((item): item is ChoiceResult<Id> => item !== null);
};
