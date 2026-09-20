import type { Id } from "../../../../convex/_generated/dataModel";

export const EDITOR_PX_PER_SECOND = 40;

export type EditorRecordingSource = {
  recordingId: Id<"presentRecordings">;
  url: string;
  posterUrl: string | null;
  label: string;
  durationMs: number;
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
