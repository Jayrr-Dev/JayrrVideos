import { describe, expect, it } from "vitest";

import { turnsFromTranscript, turnsFromWords } from "./transcriptTurns";

describe("turnsFromWords", () => {
  it("reads Inworld speaker labels and millisecond clocks", () => {
    const turns = turnsFromWords([
      {
        word: "Hi,",
        startTimeMs: 97,
        endTimeMs: 194,
        speaker: 0,
      },
      {
        word: "I'm",
        startTimeMs: 698,
        endTimeMs: 779,
        speaker: 0,
      },
      {
        word: "calling",
        startTimeMs: 800,
        endTimeMs: 920,
        speaker: 1,
      },
    ]);
    expect(turns).toEqual([
      {
        speaker: 0,
        text: "Hi, I'm",
        startMs: 97,
        endMs: 779,
      },
      {
        speaker: 1,
        text: "calling",
        startMs: 800,
        endMs: 920,
      },
    ]);
  });

  it("fills unlabeled words from the nearby speaker", () => {
    const turns = turnsFromWords([
      { word: "Oh.", startTimeMs: 100, endTimeMs: 180, speaker: 0 },
      { word: "Accountants", startTimeMs: 200, endTimeMs: 320 },
      { word: "cooked.", startTimeMs: 340, endTimeMs: 420, speaker: 0 },
    ]);
    expect(turns).toEqual([
      {
        speaker: 0,
        text: "Oh. Accountants cooked.",
        startMs: 100,
        endMs: 420,
      },
    ]);
  });
});

describe("turnsFromTranscript", () => {
  it("groups Deepgram words by speaker", () => {
    const turns = turnsFromTranscript("Hello there", [
      {
        word: "hello",
        punctuated_word: "Hello",
        start: 0.1,
        end: 0.4,
        speaker: 0,
      },
      {
        word: "there",
        punctuated_word: "there",
        start: 0.45,
        end: 0.7,
        speaker: 0,
      },
    ]);
    expect(turns).toEqual([
      {
        speaker: 0,
        text: "Hello there",
        startMs: 100,
        endMs: 700,
      },
    ]);
  });
});
