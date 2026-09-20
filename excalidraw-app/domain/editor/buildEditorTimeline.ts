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

/** User-ordered clip on the timeline (before layout). */
export type EditorProjectClip = EditorRecordingSource & {
  id: string;
  /** Sequence is the main packed track; any other id is a stack overlay. */
  laneId?: string;
  /** Start time on a stack lane. Ignored for sequence clips. */
  laneStartMs?: number;
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

/** Sequence clips pack end-to-end; stack clips keep their own start times. */
export const buildEditorTimeline = (
  clips: readonly EditorProjectClip[],
): EditorTimeline => {
  const sequence: EditorClip[] = [];
  const overlays: EditorClip[] = [];
  let cursor = 0;
  for (const clip of clips) {
    if (isSequenceClip(clip)) {
      const laid = toLaidClip(clip, cursor);
      sequence.push(laid);
      cursor += laid.durationMs;
      continue;
    }
    overlays.push(toLaidClip(clip, clip.laneStartMs ?? 0));
  }
  let totalMs = cursor;
  for (const clip of overlays) {
    totalMs = Math.max(totalMs, clip.startMs + clip.durationMs);
  }
  return { totalMs, sequence, overlays };
};

export const newEditorLaneId = () =>
  `stack-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const moveEditorClip = ({
  clips,
  clipId,
  toLaneId,
  timeMs,
  overClipId,
}: {
  clips: readonly EditorProjectClip[];
  clipId: string;
  toLaneId: string;
  timeMs: number;
  overClipId?: string | null;
}): EditorProjectClip[] | null => {
  const moving = clips.find((clip) => clip.id === clipId);
  if (!moving) {
    return null;
  }
  const destLane = toLaneId || SEQUENCE_LANE_ID;
  const others = clips.filter((clip) => clip.id !== clipId);
  const sequence = others.filter(isSequenceClip);
  const overlays = others.filter((clip) => !isSequenceClip(clip));
  const droppedMs = Math.max(0, Math.round(timeMs));

  if (destLane === SEQUENCE_LANE_ID) {
    const updated: EditorProjectClip = {
      ...moving,
      laneId: SEQUENCE_LANE_ID,
      laneStartMs: undefined,
    };
    let insertAt = sequence.length;
    if (overClipId) {
      const overIdx = sequence.findIndex((clip) => clip.id === overClipId);
      if (overIdx >= 0) {
        let cursor = 0;
        for (let i = 0; i < overIdx; i++) {
          const earlier = sequence[i];
          cursor += earlier ? Math.max(1, Math.round(earlier.durationMs)) : 0;
        }
        const overClip = sequence[overIdx];
        const overDur = overClip
          ? Math.max(1, Math.round(overClip.durationMs))
          : 0;
        insertAt = droppedMs >= cursor + overDur / 2 ? overIdx + 1 : overIdx;
      }
    } else {
      let cursor = 0;
      insertAt = sequence.length;
      for (let i = 0; i < sequence.length; i++) {
        const clip = sequence[i];
        if (!clip) {
          continue;
        }
        const dur = Math.max(1, Math.round(clip.durationMs));
        if (droppedMs < cursor + dur / 2) {
          insertAt = i;
          break;
        }
        cursor += dur;
      }
    }
    return [
      ...sequence.slice(0, insertAt),
      updated,
      ...sequence.slice(insertAt),
      ...overlays,
    ];
  }

  const updated: EditorProjectClip = {
    ...moving,
    laneId: destLane,
    laneStartMs: droppedMs,
  };
  return [...sequence, ...overlays, updated];
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
    if (t < clip.startMs + clip.durationMs) {
      return clip;
    }
  }
  return clips[clips.length - 1] ?? null;
};

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
  const sequence = clips.filter(isSequenceClip);
  const indices: number[] = [];
  for (let i = 0; i < sequence.length; i++) {
    const clip = sequence[i];
    if (clip && selectedIds.has(clip.id)) {
      indices.push(i);
    }
  }
  if (indices.length < 2) {
    return null;
  }
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== (indices[i - 1] ?? -2) + 1) {
      return null;
    }
  }
  const group = indices
    .map((index) => sequence[index])
    .filter((clip): clip is EditorProjectClip => Boolean(clip));
  if (group.length < 2) {
    return null;
  }
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
  };
};
