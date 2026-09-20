import type { Id } from "../../../convex/_generated/dataModel";

export const EDITOR_PX_PER_SECOND = 40;

export type EditorRecordingSource = {
  recordingId: Id<"presentRecordings">;
  url: string;
  posterUrl: string | null;
  label: string;
  durationMs: number;
  /** Offset into the source recording (ms). Used after Cut. */
  sourceOffsetMs?: number;
};

export const SEQUENCE_LANE_ID = "sequence";
export const MAX_STACK_LANES = 8;

export const EDITOR_TRANSITION_KINDS = [
  "fade",
  "cut",
  "fadeBlack",
  "wipe",
] as const;

export type EditorTransitionKind = (typeof EDITOR_TRANSITION_KINDS)[number];

export const DEFAULT_OVERLAP_TRANSITION: EditorTransitionKind = "fade";

export const EDITOR_TRANSITION_OPTIONS: ReadonlyArray<{
  id: EditorTransitionKind;
  label: string;
}> = [
  { id: "fade", label: "Fade" },
  { id: "cut", label: "Cut" },
  { id: "fadeBlack", label: "Fade black" },
  { id: "wipe", label: "Wipe" },
];

export const isEditorTransitionKind = (
  value: unknown,
): value is EditorTransitionKind =>
  typeof value === "string" &&
  (EDITOR_TRANSITION_KINDS as readonly string[]).includes(value);

/** User-ordered clip on the timeline (before layout). */
export type EditorProjectClip = EditorRecordingSource & {
  id: string;
  /** Sequence is the main packed track; any other id is a stack overlay. */
  laneId?: string;
  /** Start time on the clip's lane. Sequence and stacks both keep this. */
  laneStartMs?: number;
  /** How this clip blends over the column to its left while they overlap. */
  transitionKind?: EditorTransitionKind;
};

export type EditorClip = EditorProjectClip & {
  startMs: number;
  kind: "recording";
};

export type EditorTimeline = {
  totalMs: number;
  sequence: EditorClip[];
  overlays: EditorClip[];
};

export const clipLaneId = (clip: { laneId?: string }) => {
  if (!clip.laneId || clip.laneId === SEQUENCE_LANE_ID) {
    return SEQUENCE_LANE_ID;
  }
  return clip.laneId;
};

export const isSequenceClip = (clip: { laneId?: string }) =>
  clipLaneId(clip) === SEQUENCE_LANE_ID;

const toLaidClip = (clip: EditorProjectClip, startMs: number): EditorClip => {
  const durationMs = Math.max(1, Math.round(clip.durationMs));
  return {
    ...clip,
    kind: "recording",
    startMs: Math.max(0, Math.round(startMs)),
    durationMs,
    sourceOffsetMs: clip.sourceOffsetMs ?? 0,
    laneId: clipLaneId(clip),
  };
};

const clipDurationMs = (clip: { durationMs: number }) =>
  Math.max(1, Math.round(clip.durationMs));

/** Packed start times for sequence clips that do not yet store laneStartMs. */
export const resolveProjectStarts = (
  clips: readonly EditorProjectClip[],
): Map<string, number> => {
  const starts = new Map<string, number>();
  let cursor = 0;
  for (const clip of clips) {
    if (!isSequenceClip(clip)) {
      starts.set(clip.id, Math.max(0, Math.round(clip.laneStartMs ?? 0)));
      continue;
    }
    if (typeof clip.laneStartMs === "number") {
      const start = Math.max(0, Math.round(clip.laneStartMs));
      starts.set(clip.id, start);
      cursor = Math.max(cursor, start + clipDurationMs(clip));
      continue;
    }
    starts.set(clip.id, cursor);
    cursor += clipDurationMs(clip);
  }
  return starts;
};

export const withFrozenStarts = (
  clips: readonly EditorProjectClip[],
): EditorProjectClip[] => {
  const starts = resolveProjectStarts(clips);
  return clips.map((clip) => ({
    ...clip,
    laneStartMs: starts.get(clip.id) ?? 0,
  }));
};

export const sequenceEndMs = (clips: readonly EditorProjectClip[]) => {
  const starts = resolveProjectStarts(clips);
  let end = 0;
  for (const clip of clips) {
    if (!isSequenceClip(clip)) {
      continue;
    }
    end = Math.max(end, (starts.get(clip.id) ?? 0) + clipDurationMs(clip));
  }
  return end;
};

/** Clips keep stored start times; missing sequence starts pack once. */
export const buildEditorTimeline = (
  clips: readonly EditorProjectClip[],
): EditorTimeline => {
  const starts = resolveProjectStarts(clips);
  const sequence: EditorClip[] = [];
  const overlays: EditorClip[] = [];
  let totalMs = 0;
  for (const clip of clips) {
    const laid = toLaidClip(clip, starts.get(clip.id) ?? 0);
    if (isSequenceClip(clip)) {
      sequence.push(laid);
    } else {
      overlays.push(laid);
    }
    totalMs = Math.max(totalMs, laid.startMs + laid.durationMs);
  }
  sequence.sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
  overlays.sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
  return { totalMs, sequence, overlays };
};

export const newEditorLaneId = () =>
  `stack-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const collectSnapPointsMs = ({
  timeline,
  excludeClipId,
  playheadMs,
}: {
  timeline: EditorTimeline;
  excludeClipId: string;
  playheadMs: number;
}): number[] => {
  const points = new Set<number>([0]);
  let sequenceEnd = 0;
  for (const clip of timeline.sequence) {
    sequenceEnd = Math.max(sequenceEnd, clip.startMs + clip.durationMs);
    if (clip.id === excludeClipId) {
      continue;
    }
    points.add(clip.startMs);
    points.add(clip.startMs + clip.durationMs);
  }
  points.add(sequenceEnd);
  for (const clip of timeline.overlays) {
    if (clip.id === excludeClipId) {
      continue;
    }
    points.add(clip.startMs);
    points.add(clip.startMs + clip.durationMs);
  }
  if (Number.isFinite(playheadMs)) {
    points.add(Math.max(0, Math.round(playheadMs)));
  }
  return [...points].sort((a, b) => a - b);
};

export type SnapClipStartResult = {
  startMs: number;
  guideMs: number | null;
};

/** Soft-snap a clip's start so its start or end aligns with a snap point. */
export const snapClipStart = ({
  startMs,
  durationMs,
  snapPoints,
  thresholdMs,
}: {
  startMs: number;
  durationMs: number;
  snapPoints: readonly number[];
  thresholdMs: number;
}): SnapClipStartResult => {
  const proposed = Math.max(0, Math.round(startMs));
  const duration = Math.max(1, Math.round(durationMs));
  const threshold = Math.max(0, thresholdMs);
  if (threshold <= 0 || snapPoints.length === 0) {
    return { startMs: proposed, guideMs: null };
  }

  let bestDelta = Infinity;
  let bestStart = proposed;
  let bestGuide: number | null = null;

  const consider = (edgeMs: number, guideMs: number, shift: number) => {
    const delta = Math.abs(edgeMs - guideMs);
    if (delta > threshold || delta > bestDelta) {
      return;
    }
    if (delta === bestDelta && bestGuide !== null && guideMs >= bestGuide) {
      return;
    }
    bestDelta = delta;
    bestGuide = guideMs;
    bestStart = Math.max(0, Math.round(proposed + shift));
  };

  for (const point of snapPoints) {
    consider(proposed, point, point - proposed);
    const endMs = proposed + duration;
    consider(endMs, point, point - endMs);
  }

  return { startMs: bestStart, guideMs: bestGuide };
};

export const moveEditorClip = ({
  clips,
  clipId,
  toLaneId,
  startMs,
}: {
  clips: readonly EditorProjectClip[];
  clipId: string;
  toLaneId: string;
  startMs: number;
}): EditorProjectClip[] | null => {
  const frozen = withFrozenStarts(clips);
  const moving = frozen.find((clip) => clip.id === clipId);
  if (!moving) {
    return null;
  }
  const destLane = toLaneId || SEQUENCE_LANE_ID;
  const nextStart = Math.max(0, Math.round(startMs));

  const updated: EditorProjectClip = {
    ...moving,
    laneId: destLane,
    laneStartMs: nextStart,
  };
  return frozen.map((clip) => (clip.id === clipId ? updated : clip));
};

export const setClipTransition = (
  clips: readonly EditorProjectClip[],
  clipId: string,
  transitionKind: EditorTransitionKind,
): EditorProjectClip[] | null => {
  const frozen = withFrozenStarts(clips);
  if (!frozen.some((clip) => clip.id === clipId)) {
    return null;
  }
  return frozen.map((clip) =>
    clip.id === clipId ? { ...clip, transitionKind } : clip,
  );
};

export type LaneOverlap = {
  id: string;
  leftClipId: string;
  rightClipId: string;
  leftLaneId: string;
  rightLaneId: string;
  startMs: number;
  endMs: number;
  transitionKind: EditorTransitionKind;
};

const clipEndMs = (clip: { startMs: number; durationMs: number }) =>
  clip.startMs + clip.durationMs;

export const collectLaneOverlaps = (
  lanes: ReadonlyArray<{
    laneId: string;
    clips: readonly EditorClip[];
  }>,
): LaneOverlap[] => {
  const out: LaneOverlap[] = [];
  for (let index = 0; index < lanes.length - 1; index++) {
    const left = lanes[index];
    const right = lanes[index + 1];
    if (!left || !right) {
      continue;
    }
    for (const a of left.clips) {
      for (const b of right.clips) {
        const startMs = Math.max(a.startMs, b.startMs);
        const endMs = Math.min(clipEndMs(a), clipEndMs(b));
        if (endMs - startMs < 1) {
          continue;
        }
        out.push({
          id: `${a.id}:${b.id}`,
          leftClipId: a.id,
          rightClipId: b.id,
          leftLaneId: left.laneId,
          rightLaneId: right.laneId,
          startMs,
          endMs,
          transitionKind: b.transitionKind ?? DEFAULT_OVERLAP_TRANSITION,
        });
      }
    }
  }
  return out;
};

export const overlapAtTime = (
  overlaps: readonly LaneOverlap[],
  clipId: string,
  timeMs: number,
): LaneOverlap | null =>
  overlaps.find(
    (item) =>
      item.rightClipId === clipId &&
      timeMs >= item.startMs &&
      timeMs < item.endMs,
  ) ?? null;

export type LayerBlend = {
  opacity: number;
  clipPath: string | null;
};

export const stackBlendAtTime = (
  clip: EditorClip,
  timeMs: number,
  overlap: LaneOverlap | null,
  coveringBase: boolean,
): LayerBlend => {
  if (!coveringBase || !overlap) {
    return { opacity: 1, clipPath: null };
  }
  const span = Math.max(1, overlap.endMs - overlap.startMs);
  const t = Math.min(1, Math.max(0, (timeMs - overlap.startMs) / span));
  if (overlap.transitionKind === "cut") {
    return { opacity: 1, clipPath: null };
  }
  if (overlap.transitionKind === "wipe") {
    return {
      opacity: 1,
      clipPath: `inset(0 ${Math.round((1 - t) * 100)}% 0 0)`,
    };
  }
  if (overlap.transitionKind === "fadeBlack") {
    return { opacity: t < 0.5 ? 0 : (t - 0.5) * 2, clipPath: null };
  }
  return { opacity: t, clipPath: null };
};

export const baseBlendAtTime = (
  timeMs: number,
  overlap: LaneOverlap | null,
): LayerBlend => {
  if (!overlap || overlap.transitionKind !== "fadeBlack") {
    return { opacity: 1, clipPath: null };
  }
  const span = Math.max(1, overlap.endMs - overlap.startMs);
  const t = Math.min(1, Math.max(0, (timeMs - overlap.startMs) / span));
  return { opacity: t < 0.5 ? 1 - t * 2 : 0, clipPath: null };
};

export const clipAtTime = (
  clips: readonly EditorClip[],
  timeMs: number,
): EditorClip | null => {
  if (clips.length === 0) {
    return null;
  }
  const t = Math.max(0, timeMs);
  for (const clip of clips) {
    if (t >= clip.startMs && t < clip.startMs + clip.durationMs) {
      return clip;
    }
  }
  return null;
};

export const overlayOnLaneAtTime = (
  overlays: readonly EditorClip[],
  laneId: string,
  timeMs: number,
): EditorClip | null =>
  clipAtTime(
    overlays.filter((clip) => clipLaneId(clip) === laneId),
    timeMs,
  );

export const editorHasClips = (timeline: EditorTimeline) =>
  timeline.sequence.length > 0 || timeline.overlays.length > 0;

export const formatEditorClock = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const newEditorClipId = () =>
  `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Minimum slice length so Cut does not create empty fragments. */
export const EDITOR_CUT_MIN_MS = 120;

/** True when playhead is inside a clip with room to split on both sides. */
export const canCutAtTime = (
  clips: readonly EditorClip[],
  timeMs: number,
  minMs = EDITOR_CUT_MIN_MS,
): boolean => {
  const clip = clipAtTime(clips, timeMs);
  if (!clip) {
    return false;
  }
  const offsetInClip = timeMs - clip.startMs;
  return offsetInClip >= minMs && clip.durationMs - offsetInClip >= minMs;
};

/**
 * Selected clips that can merge: 2+ contiguous timeline neighbors from the
 * same recording with abutting source offsets (typical undo of Cut).
 */
export const getMergeableClips = (
  clips: readonly EditorProjectClip[],
  selectedIds: ReadonlySet<string>,
): EditorProjectClip[] | null => {
  if (selectedIds.size < 2) {
    return null;
  }
  const starts = resolveProjectStarts(clips);
  const selected = clips
    .filter((clip) => selectedIds.has(clip.id))
    .sort(
      (a, b) =>
        (starts.get(a.id) ?? 0) - (starts.get(b.id) ?? 0) ||
        a.id.localeCompare(b.id),
    );
  if (selected.length < 2) {
    return null;
  }
  const laneId = clipLaneId(selected[0] ?? {});
  for (const clip of selected) {
    if (clipLaneId(clip) !== laneId) {
      return null;
    }
  }
  const group = selected;
  const first = group[0];
  if (!first) {
    return null;
  }
  for (let i = 1; i < group.length; i++) {
    const prev = group[i - 1];
    const cur = group[i];
    if (!prev || !cur) {
      return null;
    }
    if (cur.recordingId !== first.recordingId) {
      return null;
    }
    const prevEnd = (prev.sourceOffsetMs ?? 0) + prev.durationMs;
    if ((cur.sourceOffsetMs ?? 0) !== prevEnd) {
      return null;
    }
    const prevStart = starts.get(prev.id) ?? 0;
    const curStart = starts.get(cur.id) ?? 0;
    if (curStart !== prevStart + clipDurationMs(prev)) {
      return null;
    }
  }
  return group;
};

export const mergeProjectClips = (
  group: readonly EditorProjectClip[],
): EditorProjectClip | null => {
  const first = group[0];
  if (!first || group.length < 2) {
    return null;
  }
  let durationMs = 0;
  for (const clip of group) {
    durationMs += Math.max(1, Math.round(clip.durationMs));
  }
  return {
    id: first.id,
    recordingId: first.recordingId,
    url: first.url,
    posterUrl: first.posterUrl,
    label: first.label,
    sourceOffsetMs: first.sourceOffsetMs ?? 0,
    durationMs,
    laneId: first.laneId,
    laneStartMs: first.laneStartMs ?? 0,
    ...(first.transitionKind ? { transitionKind: first.transitionKind } : {}),
  };
};
