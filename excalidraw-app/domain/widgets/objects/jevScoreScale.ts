export type ScoreBand<Id extends string> = {
  id: Id;
  label: string;
  what: string;
  example?: string;
};

export type ScoreResult<Id extends string> = {
  id: Id;
  label: string;
  score: number;
  confidence: number;
};

type ScoreAnswer = {
  id: string;
  type: "score";
  score: number;
  confidence?: number;
};

export const scoreLevels = <Id extends string>(
  bands: readonly ScoreBand<Id>[],
) =>
  bands.map((band) => ({
    what: `${band.label}. ${band.what}`,
    examples: band.example ? [band.example] : [],
  }));

export const scoreQuestion = <Id extends string>(
  id: string,
  instructions: string,
  bands: readonly ScoreBand<Id>[],
) => ({
  id,
  type: "score" as const,
  instructions,
  levels: scoreLevels(bands),
});

const clampScore = (value: number, top: number) =>
  Math.min(top, Math.max(0, Math.round(value)));

export const resultFromScore = <Id extends string>(
  bands: readonly ScoreBand<Id>[],
  score: number,
  confidence: number,
): ScoreResult<Id> | null => {
  const band = bands[clampScore(score, bands.length - 1)];
  if (!band) {
    return null;
  }
  return {
    id: band.id,
    label: band.label,
    score: clampScore(score, bands.length - 1),
    confidence,
  };
};

export const scoreFromAnswers = <Id extends string>(
  answers: ReadonlyArray<{ id: string; type: string }>,
  questionId: string,
  bands: readonly ScoreBand<Id>[],
  omittedError: string,
): ScoreResult<Id> | null => {
  const answer = answers.find(
    (row): row is ScoreAnswer => row.id === questionId && row.type === "score",
  );
  if (!answer) {
    throw new Error(omittedError);
  }
  return resultFromScore(
    bands,
    answer.score,
    typeof answer.confidence === "number" ? answer.confidence : 0,
  );
};

export const rankedScore = <Id extends string>(
  bands: readonly ScoreBand<Id>[],
  row: ScoreResult<Id>,
  count: number,
): ScoreResult<Id>[] => {
  const top = bands.length - 1;
  const picked: ScoreResult<Id>[] = [];
  for (let dist = 0; picked.length < count && dist <= top; dist += 1) {
    const candidates =
      dist === 0 ? [row.score] : [row.score + dist, row.score - dist];
    for (const next of candidates) {
      const mapped = resultFromScore(bands, next, row.confidence);
      if (!mapped || picked.some((item) => item.id === mapped.id)) {
        continue;
      }
      picked.push(mapped);
      if (picked.length >= count) {
        break;
      }
    }
  }
  return picked;
};

export const averageScore = <Id extends string>(
  bands: readonly ScoreBand<Id>[],
  rows: readonly ScoreResult<Id>[],
): ScoreResult<Id> | null => {
  if (rows.length === 0) {
    return null;
  }
  const score = rows.reduce((sum, row) => sum + row.score, 0) / rows.length;
  const confidence =
    rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length;
  return resultFromScore(bands, score, confidence);
};
