import { describe, expect, it } from "vitest";

import {
  buildEditorTimeline,
  clipAtTimeAcrossLanes,
  collectLaneOverlaps,
  collectOverlapBands,
  collectSnapPointsMs,
  editorLanes,
  moveEditorClip,
  removeStackLane,
  SEQUENCE_LANE_ID,
  snapClipStart,
  stackBlendAtTime,
  type EditorProjectClip,
} from "./buildEditorTimeline";

import type { Id } from "../../../convex/_generated/dataModel";

const recordingId = "rec1" as Id<"presentRecordings">;

const clip = (
  id: string,
  durationMs: number,
  extras: Partial<EditorProjectClip> = {},
): EditorProjectClip => ({
  id,
  type: "clip",
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

describe("collectLaneOverlaps", () => {
  it("finds time overlap between adjacent columns", () => {
    const timeline = buildEditorTimeline([
      clip("a", 1000, { laneStartMs: 0 }),
      clip("b", 400, { laneId: "stack-1", laneStartMs: 200 }),
    ]);
    const overlaps = collectLaneOverlaps([
      { laneId: SEQUENCE_LANE_ID, clips: timeline.sequence },
      { laneId: "stack-1", clips: timeline.overlays },
    ]);
    expect(overlaps).toEqual([
      expect.objectContaining({
        leftClipId: "a",
        rightClipId: "b",
        startMs: 200,
        endMs: 600,
        transitionKind: "none",
        blendMode: "normal",
      }),
    ]);
  });

  it("finds time overlap inside the same column", () => {
    const timeline = buildEditorTimeline([
      clip("a", 1000, { laneStartMs: 0 }),
      clip("b", 800, { laneStartMs: 400 }),
    ]);
    const overlaps = collectLaneOverlaps([
      { laneId: SEQUENCE_LANE_ID, clips: timeline.sequence },
    ]);
    expect(overlaps).toEqual([
      expect.objectContaining({
        leftClipId: "a",
        rightClipId: "b",
        leftLaneId: SEQUENCE_LANE_ID,
        rightLaneId: SEQUENCE_LANE_ID,
        startMs: 400,
        endMs: 1000,
      }),
    ]);
  });

  it("finds a join when clips in the same column only touch", () => {
    const timeline = buildEditorTimeline([
      clip("a", 1000, { laneStartMs: 0 }),
      clip("b", 500, { laneStartMs: 1000 }),
    ]);
    const overlaps = collectLaneOverlaps([
      { laneId: SEQUENCE_LANE_ID, clips: timeline.sequence },
    ]);
    expect(overlaps).toEqual([
      expect.objectContaining({
        leftClipId: "a",
        rightClipId: "b",
        startMs: 1000,
        endMs: 1000,
      }),
    ]);
  });

  it("finds a join when adjacent columns line up at an edge", () => {
    const timeline = buildEditorTimeline([
      clip("a", 1000, { laneStartMs: 0 }),
      clip("b", 400, { laneId: "stack-1", laneStartMs: 1000 }),
    ]);
    const overlaps = collectLaneOverlaps([
      { laneId: SEQUENCE_LANE_ID, clips: timeline.sequence },
      { laneId: "stack-1", clips: timeline.overlays },
    ]);
    expect(overlaps).toEqual([
      expect.objectContaining({
        leftClipId: "a",
        rightClipId: "b",
        startMs: 1000,
        endMs: 1000,
      }),
    ]);
  });

  it("finds a join across non-adjacent columns", () => {
    const timeline = buildEditorTimeline([
      clip("a", 1000, { laneStartMs: 0 }),
      clip("c", 400, { laneId: "stack-2", laneStartMs: 1000 }),
    ]);
    const overlaps = collectLaneOverlaps([
      { laneId: SEQUENCE_LANE_ID, clips: timeline.sequence },
      { laneId: "stack-1", clips: [] },
      { laneId: "stack-2", clips: timeline.overlays },
    ]);
    expect(overlaps).toEqual([
      expect.objectContaining({
        leftClipId: "a",
        rightClipId: "c",
        leftLaneId: SEQUENCE_LANE_ID,
        rightLaneId: "stack-2",
        startMs: 1000,
        endMs: 1000,
      }),
    ]);
  });
});

describe("collectOverlapBands", () => {
  it("spans every column joined at the same time", () => {
    const timeline = buildEditorTimeline([
      clip("a", 1000, { laneStartMs: 0 }),
      clip("b", 400, { laneId: "stack-1", laneStartMs: 1000 }),
      clip("c", 400, { laneId: "stack-2", laneStartMs: 1000 }),
    ]);
    const overlaps = collectLaneOverlaps([
      { laneId: SEQUENCE_LANE_ID, clips: timeline.sequence },
      {
        laneId: "stack-1",
        clips: timeline.overlays.filter((item) => item.id === "b"),
      },
      {
        laneId: "stack-2",
        clips: timeline.overlays.filter((item) => item.id === "c"),
      },
    ]);
    const bands = collectOverlapBands(overlaps, [
      SEQUENCE_LANE_ID,
      "stack-1",
      "stack-2",
    ]);
    expect(bands).toHaveLength(1);
    expect(bands[0]?.joinMs).toBe(1000);
    expect(bands[0]?.laneIds).toEqual([SEQUENCE_LANE_ID, "stack-1", "stack-2"]);
    expect(bands[0]?.clipIds).toEqual(expect.arrayContaining(["b", "c"]));
  });
});

describe("clipAtTimeAcrossLanes", () => {
  it("picks the rightmost covering clip across stacks", () => {
    const timeline = buildEditorTimeline([
      clip("a", 1000, { laneStartMs: 0 }),
      clip("b", 400, { laneId: "stack-1", laneStartMs: 200 }),
      clip("c", 400, { laneId: "stack-2", laneStartMs: 300 }),
    ]);
    const lanes = editorLanes(timeline, ["stack-1", "stack-2"]);
    expect(clipAtTimeAcrossLanes(lanes, 350)?.id).toBe("c");
    expect(clipAtTimeAcrossLanes(lanes, 250)?.id).toBe("b");
    expect(clipAtTimeAcrossLanes(lanes, 50)?.id).toBe("a");
    expect(clipAtTimeAcrossLanes(lanes, 350, new Set(["a"]))?.id).toBe("a");
  });
});

describe("stackBlendAtTime", () => {
  const overlap = {
    id: "a:b",
    leftClipId: "a",
    rightClipId: "b",
    leftLaneId: SEQUENCE_LANE_ID,
    rightLaneId: "stack-1",
    startMs: 0,
    endMs: 1000,
    transitionKind: "fade" as const,
    blendMode: "normal" as const,
  };
  const overlay = {
    ...clip("b", 1000, { laneId: "stack-1", laneStartMs: 0 }),
    startMs: 0,
  };

  it("fades the overlay in across the overlap", () => {
    expect(stackBlendAtTime(overlay, 500, overlap, true).opacity).toBe(0.5);
  });

  it("stays fully visible with no transition", () => {
    expect(
      stackBlendAtTime(
        overlay,
        500,
        { ...overlap, transitionKind: "none" },
        true,
      ).opacity,
    ).toBe(1);
  });

  it("stays fully visible when not covering the sequence", () => {
    expect(stackBlendAtTime(overlay, 500, overlap, false).opacity).toBe(1);
  });

  it("applies mix blend while covering", () => {
    expect(
      stackBlendAtTime(
        overlay,
        500,
        { ...overlap, transitionKind: "none", blendMode: "multiply" },
        true,
      ).mixBlendMode,
    ).toBe("multiply");
  });
});

describe("removeStackLane", () => {
  it("folds a right stack onto the stack to its left", () => {
    const result = removeStackLane(
      [
        clip("a", 1000, { laneStartMs: 0 }),
        clip("b", 400, { laneId: "stack-1", laneStartMs: 200 }),
        clip("c", 400, { laneId: "stack-2", laneStartMs: 800 }),
      ],
      ["stack-1", "stack-2"],
      "stack-2",
    );
    expect(result?.stackLaneIds).toEqual(["stack-1"]);
    expect(result?.clips.find((item) => item.id === "c")).toEqual(
      expect.objectContaining({
        laneId: "stack-1",
        laneStartMs: 800,
      }),
    );
    expect(result?.clips.find((item) => item.id === "b")?.laneId).toBe(
      "stack-1",
    );
  });

  it("folds the first stack onto sequence", () => {
    const result = removeStackLane(
      [
        clip("a", 1000, { laneStartMs: 0 }),
        clip("b", 400, { laneId: "stack-1", laneStartMs: 200 }),
      ],
      ["stack-1"],
      "stack-1",
    );
    expect(result?.stackLaneIds).toEqual([]);
    expect(result?.clips.find((item) => item.id === "b")).toEqual(
      expect.objectContaining({
        laneId: SEQUENCE_LANE_ID,
        laneStartMs: 200,
      }),
    );
  });
});
