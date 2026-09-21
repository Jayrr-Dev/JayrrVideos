export type SpeakerScoreRow = {
  turnId: string;
  speaker: number | null;
};

export type SpeakerTurn = {
  id: string;
  speaker: number | null;
};

export type AverageCache<Item, Result> = {
  speakers: Map<number, { items: readonly Item[]; result: Result }>;
  output: Map<number, Result>;
};

export const emptyAverageCache = <Item, Result>(): AverageCache<
  Item,
  Result
> => ({
  speakers: new Map(),
  output: new Map(),
});

export const speakerAssignmentStamp = (turns: readonly SpeakerTurn[]) => {
  let stamp = "";
  for (const turn of turns) {
    stamp += turn.id;
    stamp += ":";
    stamp += turn.speaker === null ? "n" : String(turn.speaker);
    stamp += ",";
  }
  return stamp;
};

export const mapSpeakersByTurn = (turns: readonly SpeakerTurn[]) => {
  const map = new Map<string, number | null>();
  for (const turn of turns) {
    map.set(turn.id, turn.speaker);
  }
  return map;
};

export const attributeSpeakerScores = <T extends SpeakerScoreRow>(
  scores: readonly T[],
  speakers: ReadonlyMap<string, number | null>,
  live: T | null,
): readonly T[] => {
  const rows = live ? [...scores, live] : scores;
  let changed = Boolean(live);
  const next: T[] = [];
  for (const row of rows) {
    const speaker = speakers.get(row.turnId);
    if (speaker === undefined || speaker === row.speaker) {
      next.push(row);
      continue;
    }
    changed = true;
    next.push({ ...row, speaker });
  }
  if (!changed) {
    return scores;
  }
  return next;
};

const sameItems = <Item>(
  left: readonly Item[],
  right: readonly Item[],
): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
};

export const averagesBySpeaker = <
  Row extends SpeakerScoreRow,
  Item,
  Result,
>(
  rows: readonly Row[],
  pick: (row: Row) => Item | null | undefined,
  average: (items: readonly Item[]) => Result | null | undefined,
  cache: AverageCache<Item, Result>,
): Map<number, Result> => {
  const groups = new Map<number, Item[]>();
  for (const row of rows) {
    if (row.speaker === null) {
      continue;
    }
    const item = pick(row);
    if (!item) {
      continue;
    }
    const list = groups.get(row.speaker) ?? [];
    list.push(item);
    groups.set(row.speaker, list);
  }
  const next = new Map<number, Result>();
  let allHit = groups.size === cache.output.size;
  for (const [speaker, items] of groups) {
    const hit = cache.speakers.get(speaker);
    if (hit && sameItems(hit.items, items)) {
      next.set(speaker, hit.result);
      continue;
    }
    allHit = false;
    const result = average(items);
    if (result === null || result === undefined) {
      cache.speakers.delete(speaker);
      continue;
    }
    if (Array.isArray(result) && result.length === 0) {
      cache.speakers.delete(speaker);
      continue;
    }
    cache.speakers.set(speaker, { items, result });
    next.set(speaker, result);
  }
  for (const speaker of [...cache.speakers.keys()]) {
    if (!next.has(speaker)) {
      allHit = false;
      cache.speakers.delete(speaker);
    }
  }
  if (allHit) {
    for (const speaker of next.keys()) {
      if (cache.output.get(speaker) !== next.get(speaker)) {
        allHit = false;
        break;
      }
    }
  }
  if (allHit) {
    return cache.output;
  }
  cache.output = next;
  return next;
};
