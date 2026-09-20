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

/** User-ordered clip on the timeline (before layout). */
export type EditorProjectClip = EditorRecordingSource & {
  id: string;
};

export type EditorClip = EditorProjectClip & {
  startMs: number;
  kind: "recording";
};

export type EditorTimeline = {
  totalMs: number;
  sequence: EditorClip[];
};

/** Lay recording clips end-to-end on the vertical timeline. */
export const buildEditorTimeline = (
  clips: readonly EditorProjectClip[],
): EditorTimeline => {
  const sequence: EditorClip[] = [];
  let cursor = 0;
  for (const clip of clips) {
    const durationMs = Math.max(1, Math.round(clip.durationMs));
    sequence.push({
      ...clip,
      kind: "recording",
      startMs: cursor,
      durationMs,
      sourceOffsetMs: clip.sourceOffsetMs ?? 0,
    });
    cursor += durationMs;
  }
  return { totalMs: cursor, sequence };
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
  const indices: number[] = [];
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
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
    .map((index) => clips[index])
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
