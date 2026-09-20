import { describe, expect, it } from "vitest";

import type { Id } from "../../../convex/_generated/dataModel";

import {
  buildEditorTimeline,
  collectSnapPointsMs,
  moveEditorClip,
  SEQUENCE_LANE_ID,
  snapClipStart,
  type EditorProjectClip,
} from "./buildEditorTimeline";

const recordingId = "rec1" as Id<"presentRecordings">;

const clip = (
  id: string,
  durationMs: number,
  extras: Partial<EditorProjectClip> = {},
): EditorProjectClip => ({
  id,
  recordingId,
  url: `https://example.com/${id}.mp4`,
  posterUrl: null,
  label: id,
  durationMs,
  ...extras,
});

describe("snapClipStart", () => {
  it("snaps start edge to a nearby point", () => {
    const result = snapClipStart({
      startMs: 980,
      durationMs: 500,
      snapPoints: [0, 1000, 2000],
      thresholdMs: 50,
    });
    expect(result).toEqual({ startMs: 1000, guideMs: 1000 });
  });

  it("snaps end edge to a nearby point", () => {
    const result = snapClipStart({
      startMs: 480,
      durationMs: 500,
      snapPoints: [0, 1000, 2000],
      thresholdMs: 50,
    });
    expect(result).toEqual({ startMs: 500, guideMs: 1000 });
  });

  it("returns input when outside threshold", () => {
    const result = snapClipStart({
      startMs: 900,
      durationMs: 500,
      snapPoints: [0, 1000, 2000],
      thresholdMs: 50,
    });
    expect(result).toEqual({ startMs: 900, guideMs: null });
  });

  it("picks the closer match at the threshold boundary", () => {
    const result = snapClipStart({
      startMs: 950,
      durationMs: 100,
      snapPoints: [1000],
      thresholdMs: 50,
    });
    expect(result).toEqual({ startMs: 1000, guideMs: 1000 });
  });

  it("ignores snap when threshold is zero", () => {
    const result = snapClipStart({
      startMs: 990,
      durationMs: 100,
      snapPoints: [1000],
      thresholdMs: 0,
    });
    expect(result).toEqual({ startMs: 990, guideMs: null });
  });
});

describe("collectSnapPointsMs", () => {
  it("includes zero, sequence end, playhead, and other clip edges", () => {
    const timeline = buildEditorTimeline([
      clip("a", 1000, { laneStartMs: 0 }),
      clip("b", 500, { laneStartMs: 1000 }),
      clip("c", 200, { laneId: "stack-1", laneStartMs: 300 }),
    ]);
    const points = collectSnapPointsMs({
      timeline,
      excludeClipId: "b",
      playheadMs: 750,
    });
    expect(points).toEqual([0, 300, 500, 750, 1000, 1500]);
  });
});

describe("moveEditorClip", () => {
  it("applies startMs on same-lane moves without disturbing others", () => {
    const clips = [
      clip("a", 1000, { laneStartMs: 0 }),
      clip("b", 500, { laneStartMs: 1000 }),
    ];
    const next = moveEditorClip({
      clips,
      clipId: "b",
      toLaneId: SEQUENCE_LANE_ID,
      startMs: 250,
    });
    expect(next).toEqual([
      expect.objectContaining({ id: "a", laneStartMs: 0 }),
      expect.objectContaining({
        id: "b",
        laneId: SEQUENCE_LANE_ID,
        laneStartMs: 250,
      }),
    ]);
  });

  it("applies startMs on cross-lane moves without packing neighbors", () => {
    const clips = [
      clip("a", 1000, { laneStartMs: 0 }),
      clip("b", 500, { laneStartMs: 1000 }),
      clip("c", 200, { laneId: "stack-1", laneStartMs: 400 }),
    ];
    const next = moveEditorClip({
      clips,
      clipId: "b",
      toLaneId: "stack-1",
      startMs: 800,
    });
    expect(next).toEqual([
      expect.objectContaining({ id: "a", laneStartMs: 0 }),
      expect.objectContaining({
        id: "b",
        laneId: "stack-1",
        laneStartMs: 800,
      }),
      expect.objectContaining({
        id: "c",
        laneId: "stack-1",
        laneStartMs: 400,
      }),
    ]);
  });
});
