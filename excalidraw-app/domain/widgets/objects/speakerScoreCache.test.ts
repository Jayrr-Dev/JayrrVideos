import { describe, expect, it } from "vitest";

import {
  adoptLiveScore,
  attributeSpeakerScores,
  averagesBySpeaker,
  emptyAverageCache,
  mapSpeakersByTurn,
  speakerAssignmentStamp,
} from "./speakerScoreCache";

type Row = {
  turnId: string;
  speaker: number | null;
  value: { n: number };
};

describe("speakerScoreCache", () => {
  it("retains draft evidence when final speech grows or merges into a bubble", () => {
    const live = {
      turnId: "__live__",
      speaker: 0,
      text: "research",
      value: { n: 4 },
    };
    const adopted = adoptLiveScore(live, { id: "final", speaker: 0 });
    expect(adopted).toEqual({ ...live, turnId: "final" });
    expect(adopted?.value).toBe(live.value);
    expect(live.turnId).toBe("__live__");
  });

  it("does not transfer a draft label to another speaker or missing turn", () => {
    const live = { turnId: "__live__", speaker: 0, value: { n: 4 } };
    expect(adoptLiveScore(live, { id: "final", speaker: 1 })).toBeNull();
    expect(adoptLiveScore(live, null)).toBeNull();
    expect(adoptLiveScore(null, { id: "final", speaker: 0 })).toBeNull();
  });

  it("keeps the same scores array when speakers already match", () => {
    const scores: Row[] = [
      { turnId: "a", speaker: 0, value: { n: 1 } },
      { turnId: "b", speaker: 1, value: { n: 2 } },
    ];
    const speakers = mapSpeakersByTurn([
      { id: "a", speaker: 0 },
      { id: "b", speaker: 1 },
    ]);
    expect(attributeSpeakerScores(scores, speakers, null)).toBe(scores);
  });

  it("remaps a score when the turn's speaker changes", () => {
    const scores: Row[] = [{ turnId: "a", speaker: 0, value: { n: 1 } }];
    const speakers = mapSpeakersByTurn([{ id: "a", speaker: 2 }]);
    expect(attributeSpeakerScores(scores, speakers, null)).toEqual([
      { turnId: "a", speaker: 2, value: { n: 1 } },
    ]);
  });

  it("reuses a speaker average while that speaker's items stay the same", () => {
    const cache = emptyAverageCache<{ n: number }, number>();
    const first: Row[] = [
      { turnId: "a", speaker: 0, value: { n: 2 } },
      { turnId: "b", speaker: 0, value: { n: 4 } },
    ];
    const mean = (items: readonly { n: number }[]) =>
      items.reduce((sum, item) => sum + item.n, 0) / items.length;
    const once = averagesBySpeaker(first, (row) => row.value, mean, cache);
    const twice = averagesBySpeaker(first, (row) => row.value, mean, cache);
    expect(twice).toBe(once);
    expect(once.get(0)).toBe(3);
  });

  it("recomputes only after a contributing item is replaced", () => {
    const cache = emptyAverageCache<{ n: number }, number>();
    const valueA = { n: 2 };
    const valueB = { n: 4 };
    const mean = (items: readonly { n: number }[]) =>
      items.reduce((sum, item) => sum + item.n, 0) / items.length;
    averagesBySpeaker(
      [
        { turnId: "a", speaker: 0, value: valueA },
        { turnId: "b", speaker: 0, value: valueB },
      ],
      (row) => row.value,
      mean,
      cache,
    );
    const next = averagesBySpeaker(
      [
        { turnId: "a", speaker: 0, value: valueA },
        { turnId: "b", speaker: 0, value: { n: 8 } },
      ],
      (row) => row.value,
      mean,
      cache,
    );
    expect(next.get(0)).toBe(5);
  });

  it("ignores transcript text in the speaker assignment stamp", () => {
    expect(
      speakerAssignmentStamp([
        { id: "a", speaker: 0 },
        { id: "b", speaker: 1 },
      ]),
    ).toBe(
      speakerAssignmentStamp([
        { id: "a", speaker: 0 },
        { id: "b", speaker: 1 },
      ]),
    );
  });
});
