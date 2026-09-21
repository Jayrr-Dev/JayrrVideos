import type { Id } from "../../../convex/_generated/dataModel";

export const EDITOR_PX_PER_SECOND = 40;
export const EDITOR_PX_PER_SECOND_OPTIONS = [10, 20, 40, 80, 160] as const;
export const EDITOR_PX_PER_SECOND_MIN = 6;
export const EDITOR_PX_PER_SECOND_MAX = 320;

export const clampEditorPxPerSecond = (px: number) =>
  Math.min(EDITOR_PX_PER_SECOND_MAX, Math.max(EDITOR_PX_PER_SECOND_MIN, px));

export type EditorRecordingSource = {
  recordingId: Id<"presentRecordings">;
  url: string;
  posterUrl: string | null;
  label: string;
  durationMs: number;
  /** Offset into the source recording (ms). Used after Cut or edge trim. */
  sourceOffsetMs?: number;
  /** Full source media length (ms). Caps how far an edge can be dragged out. */
  sourceDurationMs?: number;
};

export const SEQUENCE_LANE_ID = "sequence";
export const MAX_STACK_LANES = 8;

export const EDITOR_TRANSITION_KINDS = [
  "none",
  "fade",
  "cut",
  "fadeBlack",
  "wipe",
] as const;

export type EditorTransitionKind = typeof EDITOR_TRANSITION_KINDS[number];

export const DEFAULT_OVERLAP_TRANSITION: EditorTransitionKind = "none";
/** Edges count as touching / lined up within this window. */
export const EDITOR_EDGE_ALIGN_MS = 50;
/** Blend length used when clips only touch instead of overlapping. */
export const EDITOR_TOUCH_BLEND_MS = 400;

export const EDITOR_TRANSITION_OPTIONS: ReadonlyArray<{
  id: EditorTransitionKind;
  label: string;
}> = [
  { id: "none", label: "None" },
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

/** CSS mix-blend-mode values that match Photoshop groups. */
export const EDITOR_BLEND_MODES = [
  "normal",
  "darken",
  "multiply",
  "color-burn",
  "lighten",
  "screen",
  "color-dodge",
  "overlay",
  "soft-light",
  "hard-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
] as const;

export type EditorBlendMode = typeof EDITOR_BLEND_MODES[number];

export const DEFAULT_OVERLAP_BLEND: EditorBlendMode = "normal";

export const EDITOR_BLEND_GROUPS: ReadonlyArray<{
  label: string;
  options: ReadonlyArray<{ id: EditorBlendMode; label: string }>;
}> = [
  { label: "Normal", options: [{ id: "normal", label: "Normal" }] },
  {
    label: "Darken",
    options: [
      { id: "darken", label: "Darken" },
      { id: "multiply", label: "Multiply" },
      { id: "color-burn", label: "Color Burn" },
    ],
  },
  {
    label: "Lighten",
    options: [
      { id: "lighten", label: "Lighten" },
      { id: "screen", label: "Screen" },
      { id: "color-dodge", label: "Color Dodge" },
    ],
  },
  {
    label: "Contrast",
    options: [
      { id: "overlay", label: "Overlay" },
      { id: "soft-light", label: "Soft Light" },
      { id: "hard-light", label: "Hard Light" },
    ],
  },
  {
    label: "Inversion",
    options: [
      { id: "difference", label: "Difference" },
      { id: "exclusion", label: "Exclusion" },
    ],
  },
  {
    label: "Component",
    options: [
      { id: "hue", label: "Hue" },
      { id: "saturation", label: "Saturation" },
      { id: "color", label: "Color" },
      { id: "luminosity", label: "Luminosity" },
    ],
  },
];

export const isEditorBlendMode = (value: unknown): value is EditorBlendMode =>
  typeof value === "string" &&
  (EDITOR_BLEND_MODES as readonly string[]).includes(value);

export const EDITOR_CLIP_TYPE = "clip" as const;
export const EDITOR_SOUND_TYPE = "sound" as const;
export const EDITOR_AUDIO_TYPE = "audio" as const;
export const EDITOR_HTML_TYPE = "html" as const;
export const EDITOR_STATIC_TYPE = "static" as const;
export const EDITOR_STATIC_DURATION_MS = 3000;
export const EDITOR_STATIC_MEDIA_KINDS = ["image", "svg", "gif"] as const;

export type EditorStaticMediaKind = typeof EDITOR_STATIC_MEDIA_KINDS[number];

export type EditorTimelineItemType =
  | typeof EDITOR_CLIP_TYPE
  | typeof EDITOR_SOUND_TYPE
  | typeof EDITOR_AUDIO_TYPE
  | typeof EDITOR_HTML_TYPE
  | typeof EDITOR_STATIC_TYPE;

export const isEditorClipType = (
  value: unknown,
): value is typeof EDITOR_CLIP_TYPE => value === EDITOR_CLIP_TYPE;

export const isEditorSoundType = (
  value: unknown,
): value is typeof EDITOR_SOUND_TYPE => value === EDITOR_SOUND_TYPE;

export const isEditorAudioType = (
  value: unknown,
): value is typeof EDITOR_AUDIO_TYPE => value === EDITOR_AUDIO_TYPE;

export const isEditorHtmlType = (
  value: unknown,
): value is typeof EDITOR_HTML_TYPE => value === EDITOR_HTML_TYPE;

export const isEditorStaticType = (
  value: unknown,
): value is typeof EDITOR_STATIC_TYPE => value === EDITOR_STATIC_TYPE;

export const isEditorStaticMediaKind = (
  value: unknown,
): value is EditorStaticMediaKind =>
  typeof value === "string" &&
  (EDITOR_STATIC_MEDIA_KINDS as readonly string[]).includes(value);

export const isEditorItemType = (
  value: unknown,
): value is EditorTimelineItemType =>
  isEditorClipType(value) ||
  isEditorSoundType(value) ||
  isEditorAudioType(value) ||
  isEditorHtmlType(value) ||
  isEditorStaticType(value);

export const editorStaticMediaKind = (url: string): EditorStaticMediaKind => {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".gif")) {
    return "gif";
  }
  if (path.endsWith(".svg")) {
    return "svg";
  }
  return "image";
};

export const editorStaticMediaKindFromMime = (
  mime: string,
): EditorStaticMediaKind => {
  const lower = mime.toLowerCase();
  if (lower.includes("gif")) {
    return "gif";
  }
  if (lower.includes("svg")) {
    return "svg";
  }
  return "image";
};

export type EditorSoundSource = {
  soundId: string;
  path: string;
  url: string;
  label: string;
  durationMs: number;
  /** Offset into the source file (ms). Used after Cut or edge trim. */
  sourceOffsetMs?: number;
  /** Full source media length (ms). Caps how far an edge can be dragged out. */
  sourceDurationMs?: number;
};

type EditorItemPlacement = {
  id: string;
  /** Sequence is the main packed track; any other id is a stack overlay. */
  laneId?: string;
  /** Start time on the clip's lane. Sequence and stacks both keep this. */
  laneStartMs?: number;
  /** How this clip blends over the column to its left while they overlap. */
  transitionKind?: EditorTransitionKind;
  /** Pixel mix while this clip covers the column to its left. */
  blendMode?: EditorBlendMode;
};

export type EditorVideoClip = EditorRecordingSource &
  EditorItemPlacement & {
    type: typeof EDITOR_CLIP_TYPE;
    /** Picture-only after Separate Audio. */
    muted?: boolean;
    /** Live person cutout using the camera cutout engine. */
    removeBg?: boolean;
  };

export type EditorSoundClip = EditorSoundSource &
  EditorItemPlacement & {
    type: typeof EDITOR_SOUND_TYPE;
  };

export type EditorAudioClip = EditorRecordingSource &
  EditorItemPlacement & {
    type: typeof EDITOR_AUDIO_TYPE;
    /** Video clip this audio was split from. */
    sourceClipId?: string;
  };

export type EditorHtmlClip = EditorItemPlacement & {
  type: typeof EDITOR_HTML_TYPE;
  html: string;
  label: string;
  durationMs: number;
  sourceOffsetMs?: number;
  sourceDurationMs?: number;
  width?: number;
  height?: number;
};

export type EditorStaticClip = EditorItemPlacement & {
  type: typeof EDITOR_STATIC_TYPE;
  url: string;
  label: string;
  durationMs: number;
  mediaKind: EditorStaticMediaKind;
  sourceOffsetMs?: number;
  sourceDurationMs?: number;
  width?: number;
  height?: number;
};

/** User-ordered item on the timeline (before layout). */
export type EditorProjectClip =
  | EditorVideoClip
  | EditorSoundClip
  | EditorAudioClip
  | EditorHtmlClip
  | EditorStaticClip;

export const isEditorVideoClip = (
  clip: EditorProjectClip,
): clip is EditorVideoClip => clip.type === EDITOR_CLIP_TYPE;

export const isEditorSoundClip = (
  clip: EditorProjectClip,
): clip is EditorSoundClip => clip.type === EDITOR_SOUND_TYPE;

export const isEditorAudioClip = (
  clip: EditorProjectClip,
): clip is EditorAudioClip => clip.type === EDITOR_AUDIO_TYPE;

export const isEditorHtmlClip = (
  clip: EditorProjectClip,
): clip is EditorHtmlClip => clip.type === EDITOR_HTML_TYPE;

export const isEditorStaticClip = (
  clip: EditorProjectClip,
): clip is EditorStaticClip => clip.type === EDITOR_STATIC_TYPE;

export const isEditorAudioLikeClip = (
  clip: EditorProjectClip,
): clip is EditorSoundClip | EditorAudioClip =>
  isEditorSoundClip(clip) || isEditorAudioClip(clip);

export const isEditorClocklessVisual = (
  clip: EditorProjectClip,
): clip is EditorHtmlClip | EditorStaticClip =>
  isEditorHtmlClip(clip) || isEditorStaticClip(clip);

export const isEditorVisualClip = (
  clip: EditorProjectClip,
): clip is EditorVideoClip | EditorHtmlClip | EditorStaticClip =>
  isEditorVideoClip(clip) || isEditorClocklessVisual(clip);

export type EditorClip = EditorProjectClip & {
  startMs: number;
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
    startMs: Math.max(0, Math.round(startMs)),
    durationMs,
    sourceOffsetMs: clip.sourceOffsetMs ?? 0,
    laneId: clipLaneId(clip),
  };
};

export const editorLanes = (
  timeline: EditorTimeline,
  stackLaneIds: readonly string[],
): Array<{ laneId: string; clips: EditorClip[] }> => [
  { laneId: SEQUENCE_LANE_ID, clips: timeline.sequence },
  ...stackLaneIds.map((laneId) => ({
    laneId,
    clips: timeline.overlays.filter((clip) => clipLaneId(clip) === laneId),
  })),
];

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

export const snapTimeMs = ({
  timeMs,
  snapPoints,
  thresholdMs,
}: {
  timeMs: number;
  snapPoints: readonly number[];
  thresholdMs: number;
}): { timeMs: number; guideMs: number | null } => {
  const proposed = Math.round(timeMs);
  const threshold = Math.max(0, thresholdMs);
  if (threshold <= 0 || snapPoints.length === 0) {
    return { timeMs: proposed, guideMs: null };
  }
  let bestDelta = Infinity;
  let bestTime = proposed;
  let bestGuide: number | null = null;
  for (const point of snapPoints) {
    const delta = Math.abs(proposed - point);
    if (delta > threshold || delta > bestDelta) {
      continue;
    }
    if (delta === bestDelta && bestGuide !== null && point >= bestGuide) {
      continue;
    }
    bestDelta = delta;
    bestGuide = Math.round(point);
    bestTime = bestGuide;
  }
  return { timeMs: bestTime, guideMs: bestGuide };
};

export type EditorClipEdge = "start" | "end";

export const clipSourceDurationMs = (clip: EditorProjectClip) => {
  if (
    typeof clip.sourceDurationMs === "number" &&
    Number.isFinite(clip.sourceDurationMs) &&
    clip.sourceDurationMs > 0
  ) {
    return Math.max(1, Math.round(clip.sourceDurationMs));
  }
  return Math.max(1, (clip.sourceOffsetMs ?? 0) + clipDurationMs(clip));
};

export const resolveClipResize = ({
  clip,
  startMs,
  edge,
  edgeMs,
}: {
  clip: EditorProjectClip;
  startMs: number;
  edge: EditorClipEdge;
  edgeMs: number;
}): {
  startMs: number;
  durationMs: number;
  sourceOffsetMs: number;
} => {
  const origin = Math.max(0, Math.round(startMs));
  const durationMs = clipDurationMs(clip);
  const sourceOffsetMs = Math.max(0, Math.round(clip.sourceOffsetMs ?? 0));
  const endMs = origin + durationMs;
  const minDuration = EDITOR_CUT_MIN_MS;
  const sourceDurationMs = clipSourceDurationMs(clip);
  const wanted = Math.round(edgeMs);

  if (edge === "start") {
    const minStart = Math.max(0, origin - sourceOffsetMs);
    const maxStart = Math.max(minStart, endMs - minDuration);
    const nextStart = Math.min(maxStart, Math.max(minStart, wanted));
    const delta = nextStart - origin;
    return {
      startMs: nextStart,
      durationMs: Math.max(minDuration, durationMs - delta),
      sourceOffsetMs: Math.max(0, sourceOffsetMs + delta),
    };
  }

  const minEnd = origin + minDuration;
  const maxEnd =
    origin + Math.max(minDuration, sourceDurationMs - sourceOffsetMs);
  const nextEnd = Math.max(minEnd, Math.min(maxEnd, Math.max(0, wanted)));
  return {
    startMs: origin,
    durationMs: Math.max(minDuration, nextEnd - origin),
    sourceOffsetMs,
  };
};

export const restoreClipEdge = ({
  clip,
  startMs,
  edge,
}: {
  clip: EditorProjectClip;
  startMs: number;
  edge: EditorClipEdge;
}): {
  startMs: number;
  durationMs: number;
  sourceOffsetMs: number;
} => {
  const origin = Math.max(0, Math.round(startMs));
  const durationMs = clipDurationMs(clip);
  const sourceOffsetMs = Math.max(0, Math.round(clip.sourceOffsetMs ?? 0));
  const sourceDurationMs = clipSourceDurationMs(clip);
  const minDuration = EDITOR_CUT_MIN_MS;

  if (edge === "start") {
    return {
      startMs: Math.max(0, origin - sourceOffsetMs),
      durationMs: Math.min(sourceDurationMs, durationMs + sourceOffsetMs),
      sourceOffsetMs: 0,
    };
  }

  return {
    startMs: origin,
    durationMs: Math.max(minDuration, sourceDurationMs - sourceOffsetMs),
    sourceOffsetMs,
  };
};

export const resizeEditorClip = ({
  clips,
  clipId,
  edge,
  edgeMs,
}: {
  clips: readonly EditorProjectClip[];
  clipId: string;
  edge: EditorClipEdge;
  edgeMs: number;
}): EditorProjectClip[] | null => {
  const frozen = withFrozenStarts(clips);
  const current = frozen.find((clip) => clip.id === clipId);
  if (!current) {
    return null;
  }
  const startMs = current.laneStartMs ?? 0;
  const next = resolveClipResize({
    clip: current,
    startMs,
    edge,
    edgeMs,
  });
  return applyClipResize(frozen, current, next);
};

export const restoreEditorClipEdge = ({
  clips,
  clipId,
  edge,
}: {
  clips: readonly EditorProjectClip[];
  clipId: string;
  edge: EditorClipEdge;
}): EditorProjectClip[] | null => {
  const frozen = withFrozenStarts(clips);
  const current = frozen.find((clip) => clip.id === clipId);
  if (!current) {
    return null;
  }
  const startMs = current.laneStartMs ?? 0;
  const next = restoreClipEdge({
    clip: current,
    startMs,
    edge,
  });
  return applyClipResize(frozen, current, next);
};

const applyClipResize = (
  clips: readonly EditorProjectClip[],
  current: EditorProjectClip,
  next: {
    startMs: number;
    durationMs: number;
    sourceOffsetMs: number;
  },
): EditorProjectClip[] | null => {
  const startMs = current.laneStartMs ?? 0;
  if (
    next.startMs === startMs &&
    next.durationMs === clipDurationMs(current) &&
    next.sourceOffsetMs === Math.round(current.sourceOffsetMs ?? 0)
  ) {
    return null;
  }
  const updated: EditorProjectClip = {
    ...current,
    durationMs: next.durationMs,
    sourceOffsetMs: next.sourceOffsetMs,
    laneStartMs: next.startMs,
    sourceDurationMs: clipSourceDurationMs(current),
  };
  return clips.map((clip) => (clip.id === current.id ? updated : clip));
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

export type EditorLayerDirection = "back" | "backward" | "forward" | "front";

const laneOrderFor = (stackLaneIds: readonly string[]) => [
  SEQUENCE_LANE_ID,
  ...stackLaneIds,
];

const laneIndexIn = (laneOrder: readonly string[], laneId: string) => {
  const index = laneOrder.indexOf(laneId);
  if (index < 0) {
    return 0;
  }
  return index;
};

/** Which layer moves can change stacking for at least one selected overlap. */
export const clipLayerMoveAvailability = ({
  clips,
  clipIds,
  stackLaneIds,
  peerClipIds,
}: {
  clips: readonly EditorProjectClip[];
  clipIds: readonly string[];
  stackLaneIds: readonly string[];
  peerClipIds?: readonly string[];
}): Record<EditorLayerDirection, boolean> => ({
  back:
    moveClipsByLayer({
      clips,
      clipIds,
      stackLaneIds,
      direction: "back",
      peerClipIds,
    }) !== null,
  backward:
    moveClipsByLayer({
      clips,
      clipIds,
      stackLaneIds,
      direction: "backward",
      peerClipIds,
    }) !== null,
  forward:
    moveClipsByLayer({
      clips,
      clipIds,
      stackLaneIds,
      direction: "forward",
      peerClipIds,
    }) !== null,
  front:
    moveClipsByLayer({
      clips,
      clipIds,
      stackLaneIds,
      direction: "front",
      peerClipIds,
    }) !== null,
});

const overlapPeerIds = (overlaps: readonly LaneOverlap[], clipId: string) => {
  const ids: string[] = [];
  for (const overlap of overlaps) {
    let other: string | null = null;
    if (overlap.leftClipId === clipId) {
      other = overlap.rightClipId;
    } else if (overlap.rightClipId === clipId) {
      other = overlap.leftClipId;
    }
    if (other && !ids.includes(other)) {
      ids.push(other);
    }
  }
  return ids;
};

const compareOverlapLayer = (
  laneOrder: readonly string[],
  a: EditorProjectClip,
  b: EditorProjectClip,
) => {
  const laneDelta =
    laneIndexIn(laneOrder, clipLaneId(a)) -
    laneIndexIn(laneOrder, clipLaneId(b));
  if (laneDelta !== 0) {
    return laneDelta;
  }
  const startDelta = (a.laneStartMs ?? 0) - (b.laneStartMs ?? 0);
  if (startDelta !== 0) {
    return startDelta;
  }
  return a.id.localeCompare(b.id);
};

/**
 * Change which overlapping clip is in front. Left is behind, right is in front.
 * Swaps columns with the overlapping neighbor. Does not move clips that do not
 * overlap, and does not add a column.
 */
export const moveClipsByLayer = ({
  clips,
  clipIds,
  stackLaneIds,
  direction,
  peerClipIds,
}: {
  clips: readonly EditorProjectClip[];
  clipIds: readonly string[];
  stackLaneIds: readonly string[];
  direction: EditorLayerDirection;
  /** When set, only these clips count as the overlap group. */
  peerClipIds?: readonly string[];
}): { clips: EditorProjectClip[]; stackLaneIds: string[] } | null => {
  if (clipIds.length === 0) {
    return null;
  }
  const laneOrder = laneOrderFor(stackLaneIds);
  const allowedPeers = peerClipIds ? new Set(peerClipIds) : null;
  let next = withFrozenStarts(clips);
  const touched = new Set<string>();
  let changed = false;

  const orderedIds = [...clipIds].sort((a, b) => {
    const clipA = next.find((clip) => clip.id === a);
    const clipB = next.find((clip) => clip.id === b);
    if (!clipA || !clipB) {
      return a.localeCompare(b);
    }
    const delta = compareOverlapLayer(laneOrder, clipA, clipB);
    if (direction === "forward" || direction === "front") {
      return -delta;
    }
    return delta;
  });

  const shiftSameLane = (
    current: EditorProjectClip[],
    focus: EditorProjectClip,
  ) => {
    const index = laneIndexIn(laneOrder, clipLaneId(focus));
    let destIndex = index;
    if (direction === "back") {
      destIndex = 0;
    } else if (direction === "backward") {
      destIndex = index - 1;
    } else if (direction === "forward") {
      destIndex = index + 1;
    } else {
      destIndex = laneOrder.length - 1;
    }
    if (destIndex === index || destIndex < 0 || destIndex >= laneOrder.length) {
      return null;
    }
    const destLane = laneOrder[destIndex];
    if (!destLane) {
      return null;
    }
    return current.map((clip) =>
      clip.id === focus.id ? { ...clip, laneId: destLane } : clip,
    );
  };

  for (const focusId of orderedIds) {
    if (touched.has(focusId)) {
      continue;
    }
    const timeline = buildEditorTimeline(next);
    const overlaps = collectLaneOverlaps(editorLanes(timeline, stackLaneIds));
    let peerIds = overlapPeerIds(overlaps, focusId);
    if (allowedPeers) {
      peerIds = peerIds.filter((id) => allowedPeers.has(id));
    }
    const focus = next.find((clip) => clip.id === focusId);
    if (!focus || peerIds.length === 0) {
      continue;
    }
    const peers: EditorProjectClip[] = [];
    for (const peerId of peerIds) {
      const peer = next.find((clip) => clip.id === peerId);
      if (peer) {
        peers.push(peer);
      }
    }
    const group = [focus, ...peers].sort((a, b) =>
      compareOverlapLayer(laneOrder, a, b),
    );
    const index = group.findIndex((clip) => clip.id === focusId);
    let partner: EditorProjectClip | undefined;
    if (direction === "back") {
      partner = group[0];
    } else if (direction === "front") {
      partner = group[group.length - 1];
    } else if (direction === "backward") {
      partner = group[index - 1];
    } else {
      partner = group[index + 1];
    }
    if (!partner || partner.id === focusId) {
      continue;
    }
    let updated: EditorProjectClip[] | null = null;
    if (clipLaneId(partner) !== clipLaneId(focus)) {
      const focusLane = clipLaneId(focus);
      const partnerLane = clipLaneId(partner);
      updated = next.map((clip) => {
        if (clip.id === focus.id) {
          return { ...clip, laneId: partnerLane };
        }
        if (clip.id === partner.id) {
          return { ...clip, laneId: focusLane };
        }
        return clip;
      });
      touched.add(partner.id);
    } else {
      updated = shiftSameLane(next, focus);
    }
    if (!updated) {
      continue;
    }
    touched.add(focusId);
    next = updated;
    changed = true;
  }

  if (!changed) {
    return null;
  }
  return { clips: next, stackLaneIds: [...stackLaneIds] };
};

/** Drop a stack column and fold its clips onto the column to its left. */
export const removeStackLane = (
  clips: readonly EditorProjectClip[],
  stackLaneIds: readonly string[],
  laneId: string,
): { clips: EditorProjectClip[]; stackLaneIds: string[] } | null => {
  const index = stackLaneIds.indexOf(laneId);
  if (index < 0) {
    return null;
  }
  const destLaneId =
    index === 0
      ? SEQUENCE_LANE_ID
      : stackLaneIds[index - 1] ?? SEQUENCE_LANE_ID;
  const frozen = withFrozenStarts(clips);
  return {
    clips: frozen.map((clip) =>
      clipLaneId(clip) === laneId
        ? {
            ...clip,
            laneId: destLaneId,
            laneStartMs: clip.laneStartMs ?? 0,
          }
        : clip,
    ),
    stackLaneIds: stackLaneIds.filter((id) => id !== laneId),
  };
};

export const setClipTransition = (
  clips: readonly EditorProjectClip[],
  clipId: string,
  transitionKind: EditorTransitionKind,
): EditorProjectClip[] | null =>
  setClipsTransition(clips, [clipId], transitionKind);

export const setClipsTransition = (
  clips: readonly EditorProjectClip[],
  clipIds: readonly string[],
  transitionKind: EditorTransitionKind,
): EditorProjectClip[] | null => {
  const frozen = withFrozenStarts(clips);
  const update = new Set(clipIds);
  if (!frozen.some((clip) => update.has(clip.id))) {
    return null;
  }
  return frozen.map((clip) =>
    update.has(clip.id) ? { ...clip, transitionKind } : clip,
  );
};

export const setClipsBlendMode = (
  clips: readonly EditorProjectClip[],
  clipIds: readonly string[],
  blendMode: EditorBlendMode,
): EditorProjectClip[] | null => {
  const frozen = withFrozenStarts(clips);
  const update = new Set(clipIds);
  if (!frozen.some((clip) => update.has(clip.id))) {
    return null;
  }
  return frozen.map((clip) =>
    update.has(clip.id) ? { ...clip, blendMode } : clip,
  );
};

export const setClipsRemoveBg = (
  clips: readonly EditorProjectClip[],
  clipIds: readonly string[],
  removeBg: boolean,
): EditorProjectClip[] | null => {
  const frozen = withFrozenStarts(clips);
  const update = new Set(clipIds);
  if (!frozen.some((clip) => update.has(clip.id) && isEditorVideoClip(clip))) {
    return null;
  }
  return frozen.map((clip) => {
    if (!update.has(clip.id) || !isEditorVideoClip(clip)) {
      return clip;
    }
    if (removeBg) {
      return { ...clip, removeBg: true };
    }
    const { removeBg: _removeBg, ...rest } = clip;
    return rest;
  });
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
  blendMode: EditorBlendMode;
};

const clipEndMs = (clip: { startMs: number; durationMs: number }) =>
  clip.startMs + clip.durationMs;

const edgesAlign = (a: number, b: number) =>
  Math.abs(a - b) <= EDITOR_EDGE_ALIGN_MS;

export const overlapWindow = (overlap: LaneOverlap) => {
  if (overlap.endMs - overlap.startMs >= 1) {
    return { startMs: overlap.startMs, endMs: overlap.endMs };
  }
  const half = Math.round(EDITOR_TOUCH_BLEND_MS / 2);
  return {
    startMs: overlap.startMs - half,
    endMs: overlap.startMs + half,
  };
};

export const overlapContainsTime = (overlap: LaneOverlap, timeMs: number) => {
  const window = overlapWindow(overlap);
  return timeMs >= window.startMs && timeMs < window.endMs;
};

export const collectLaneOverlaps = (
  lanes: ReadonlyArray<{
    laneId: string;
    clips: readonly EditorClip[];
  }>,
): LaneOverlap[] => {
  const out: LaneOverlap[] = [];
  const pushPair = (
    outgoing: EditorClip,
    incoming: EditorClip,
    leftLaneId: string,
    rightLaneId: string,
  ) => {
    const overlapStart = Math.max(outgoing.startMs, incoming.startMs);
    const overlapEnd = Math.min(clipEndMs(outgoing), clipEndMs(incoming));
    let startMs = overlapStart;
    let endMs = overlapEnd;
    if (endMs - startMs < 1) {
      const outStart = outgoing.startMs;
      const outEnd = clipEndMs(outgoing);
      const inStart = incoming.startMs;
      const inEnd = clipEndMs(incoming);
      let join: number | null = null;
      if (edgesAlign(outEnd, inStart)) {
        join = inStart;
      } else if (edgesAlign(outStart, inStart)) {
        join = inStart;
      } else if (edgesAlign(outEnd, inEnd)) {
        join = outEnd;
      } else if (edgesAlign(outStart, inEnd)) {
        join = outStart;
      }
      if (join === null) {
        return;
      }
      startMs = join;
      endMs = join;
    }
    out.push({
      id: `${outgoing.id}:${incoming.id}`,
      leftClipId: outgoing.id,
      rightClipId: incoming.id,
      leftLaneId,
      rightLaneId,
      startMs,
      endMs,
      transitionKind: incoming.transitionKind ?? DEFAULT_OVERLAP_TRANSITION,
      blendMode: incoming.blendMode ?? DEFAULT_OVERLAP_BLEND,
    });
  };

  for (const lane of lanes) {
    const sorted = [...lane.clips].sort(
      (a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id),
    );
    for (let i = 0; i < sorted.length; i++) {
      const outgoing = sorted[i];
      if (!outgoing) {
        continue;
      }
      for (let j = i + 1; j < sorted.length; j++) {
        const incoming = sorted[j];
        if (!incoming) {
          continue;
        }
        pushPair(outgoing, incoming, lane.laneId, lane.laneId);
      }
    }
  }

  for (let leftIndex = 0; leftIndex < lanes.length; leftIndex++) {
    const left = lanes[leftIndex];
    if (!left) {
      continue;
    }
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < lanes.length;
      rightIndex++
    ) {
      const right = lanes[rightIndex];
      if (!right) {
        continue;
      }
      for (const a of left.clips) {
        for (const b of right.clips) {
          pushPair(a, b, left.laneId, right.laneId);
        }
      }
    }
  }
  return out;
};

export const overlapParticipantIds = (
  overlaps: readonly LaneOverlap[],
  joinMs: number,
  laneIds: readonly string[],
) => {
  const lanes = new Set(laneIds);
  const ids: string[] = [];
  for (const overlap of overlaps) {
    if (Math.abs(overlap.startMs - joinMs) > EDITOR_EDGE_ALIGN_MS) {
      continue;
    }
    if (!lanes.has(overlap.leftLaneId) || !lanes.has(overlap.rightLaneId)) {
      continue;
    }
    if (!ids.includes(overlap.leftClipId)) {
      ids.push(overlap.leftClipId);
    }
    if (!ids.includes(overlap.rightClipId)) {
      ids.push(overlap.rightClipId);
    }
  }
  return ids;
};

export type OverlapBand = {
  id: string;
  joinMs: number;
  laneIds: readonly string[];
  clipIds: readonly string[];
  transitionKind: EditorTransitionKind;
  blendMode: EditorBlendMode;
};

const uniquePush = (list: string[], value: string) => {
  if (!list.includes(value)) {
    list.push(value);
  }
};

/** Merge joins that share a time so the handle spans every involved column. */
export const collectOverlapBands = (
  overlaps: readonly LaneOverlap[],
  laneOrder: readonly string[],
): OverlapBand[] => {
  const laneRank = (laneId: string) => {
    const index = laneOrder.indexOf(laneId);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  const sorted = [...overlaps].sort(
    (a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id),
  );
  const bands: Array<{
    id: string;
    joinMs: number;
    laneIds: string[];
    clipIds: string[];
    transitionKind: EditorTransitionKind;
    blendMode: EditorBlendMode;
  }> = [];
  for (const overlap of sorted) {
    const last = bands[bands.length - 1];
    if (last && edgesAlign(overlap.startMs, last.joinMs)) {
      last.id = `${last.id}+${overlap.id}`;
      uniquePush(last.laneIds, overlap.leftLaneId);
      uniquePush(last.laneIds, overlap.rightLaneId);
      uniquePush(last.clipIds, overlap.rightClipId);
      continue;
    }
    bands.push({
      id: overlap.id,
      joinMs: overlap.startMs,
      laneIds: [overlap.leftLaneId, overlap.rightLaneId].filter(
        (laneId, index, all) => all.indexOf(laneId) === index,
      ),
      clipIds: [overlap.rightClipId],
      transitionKind: overlap.transitionKind,
      blendMode: overlap.blendMode,
    });
  }
  return bands.map((band) => ({
    ...band,
    laneIds: [...band.laneIds].sort((a, b) => laneRank(a) - laneRank(b)),
  }));
};

export const isSameLaneOverlap = (overlap: LaneOverlap) =>
  overlap.leftLaneId === overlap.rightLaneId;

export const overlapAtTime = (
  overlaps: readonly LaneOverlap[],
  clipId: string,
  timeMs: number,
): LaneOverlap | null =>
  overlaps.find(
    (item) => item.rightClipId === clipId && overlapContainsTime(item, timeMs),
  ) ?? null;

export type LayerBlend = {
  opacity: number;
  clipPath: string | null;
  mixBlendMode: EditorBlendMode | null;
};

export const stackBlendAtTime = (
  clip: EditorClip,
  timeMs: number,
  overlap: LaneOverlap | null,
  coveringBase: boolean,
): LayerBlend => {
  const mixBlendMode =
    coveringBase && overlap && overlap.blendMode !== DEFAULT_OVERLAP_BLEND
      ? overlap.blendMode
      : null;
  if (!coveringBase || !overlap) {
    return { opacity: 1, clipPath: null, mixBlendMode };
  }
  const window = overlapWindow(overlap);
  const span = Math.max(1, window.endMs - window.startMs);
  const t = Math.min(1, Math.max(0, (timeMs - window.startMs) / span));
  if (overlap.transitionKind === "none" || overlap.transitionKind === "cut") {
    return { opacity: 1, clipPath: null, mixBlendMode };
  }
  if (overlap.transitionKind === "wipe") {
    return {
      opacity: 1,
      clipPath: `inset(0 ${Math.round((1 - t) * 100)}% 0 0)`,
      mixBlendMode,
    };
  }
  if (overlap.transitionKind === "fadeBlack") {
    return {
      opacity: t < 0.5 ? 0 : (t - 0.5) * 2,
      clipPath: null,
      mixBlendMode,
    };
  }
  return { opacity: t, clipPath: null, mixBlendMode };
};

export const baseBlendAtTime = (
  timeMs: number,
  overlap: LaneOverlap | null,
): LayerBlend => {
  if (!overlap || overlap.transitionKind !== "fadeBlack") {
    return { opacity: 1, clipPath: null, mixBlendMode: null };
  }
  const window = overlapWindow(overlap);
  const span = Math.max(1, window.endMs - window.startMs);
  const t = Math.min(1, Math.max(0, (timeMs - window.startMs) / span));
  return {
    opacity: t < 0.5 ? 1 - t * 2 : 0,
    clipPath: null,
    mixBlendMode: null,
  };
};

export const videoClipAtTime = (
  clips: readonly EditorClip[],
  timeMs: number,
): EditorClip | null => clipAtTime(clips.filter(isEditorVideoClip), timeMs);

export const visualClipAtTime = (
  clips: readonly EditorClip[],
  timeMs: number,
): EditorClip | null => clipAtTime(clips.filter(isEditorVisualClip), timeMs);

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

/** Rightmost covering lane wins so stack clips beat sequence at the same time. */
export const clipAtTimeAcrossLanes = (
  lanes: ReadonlyArray<{ clips: readonly EditorClip[] }>,
  timeMs: number,
  selectedIds?: ReadonlySet<string>,
): EditorClip | null => {
  const t = Math.max(0, timeMs);
  if (selectedIds && selectedIds.size > 0) {
    for (let i = lanes.length - 1; i >= 0; i--) {
      for (const clip of lanes[i]?.clips ?? []) {
        if (
          selectedIds.has(clip.id) &&
          t >= clip.startMs &&
          t < clip.startMs + clip.durationMs
        ) {
          return clip;
        }
      }
    }
  }
  for (let i = lanes.length - 1; i >= 0; i--) {
    const hit = clipAtTime(lanes[i]?.clips ?? [], timeMs);
    if (hit) {
      return hit;
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
    if (cur.type !== first.type) {
      return null;
    }
    if (
      isEditorVideoClip(first) &&
      isEditorVideoClip(cur) &&
      cur.recordingId !== first.recordingId
    ) {
      return null;
    }
    if (
      isEditorSoundClip(first) &&
      isEditorSoundClip(cur) &&
      cur.soundId !== first.soundId
    ) {
      return null;
    }
    if (
      isEditorAudioClip(first) &&
      isEditorAudioClip(cur) &&
      cur.recordingId !== first.recordingId
    ) {
      return null;
    }
    if (
      isEditorHtmlClip(first) &&
      isEditorHtmlClip(cur) &&
      cur.html !== first.html
    ) {
      return null;
    }
    if (
      isEditorStaticClip(first) &&
      isEditorStaticClip(cur) &&
      (cur.url !== first.url || cur.mediaKind !== first.mediaKind)
    ) {
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
    ...first,
    sourceOffsetMs: first.sourceOffsetMs ?? 0,
    durationMs,
    laneStartMs: first.laneStartMs ?? 0,
  };
};

export const separateClipsAudio = (
  clips: readonly EditorProjectClip[],
  clipIds: readonly string[],
  stackLaneIds: readonly string[],
): {
  clips: EditorProjectClip[];
  stackLaneIds: string[];
  audioIds: string[];
} | null => {
  const wanted = new Set(clipIds);
  const sources = clips.filter(
    (clip): clip is EditorVideoClip =>
      wanted.has(clip.id) && isEditorVideoClip(clip),
  );
  if (sources.length === 0) {
    return null;
  }
  const audioLaneId = stackLaneIds[0] ?? newEditorLaneId();
  const nextLanes = stackLaneIds.includes(audioLaneId)
    ? [...stackLaneIds]
    : stackLaneIds.length >= MAX_STACK_LANES
    ? [...stackLaneIds]
    : [...stackLaneIds, audioLaneId];
  const laneId = nextLanes[0] ?? audioLaneId;
  const audioIds: string[] = [];
  const mutedIds = new Set(sources.map((clip) => clip.id));
  const extras: EditorAudioClip[] = sources.map((clip) => {
    const audioId = newEditorClipId();
    audioIds.push(audioId);
    return {
      id: audioId,
      type: EDITOR_AUDIO_TYPE,
      recordingId: clip.recordingId,
      url: clip.url,
      posterUrl: clip.posterUrl,
      label: clip.label,
      durationMs: clip.durationMs,
      sourceOffsetMs: clip.sourceOffsetMs ?? 0,
      laneId,
      laneStartMs: clip.laneStartMs ?? 0,
      sourceClipId: clip.id,
    };
  });
  const nextClips = clips.map((clip) => {
    if (!mutedIds.has(clip.id) || !isEditorVideoClip(clip)) {
      return clip;
    }
    return { ...clip, muted: true };
  });
  return {
    clips: [...nextClips, ...extras],
    stackLaneIds: nextLanes,
    audioIds,
  };
};

const clipRange = (clip: EditorProjectClip) => {
  const start = Math.max(0, Math.round(clip.laneStartMs ?? 0));
  return { start, end: start + Math.max(1, Math.round(clip.durationMs)) };
};

const rangesOverlap = (a: EditorProjectClip, b: EditorProjectClip) => {
  const left = clipRange(a);
  const right = clipRange(b);
  return left.start < right.end && right.start < left.end;
};

const audioBelongsToVideo = (
  audio: EditorAudioClip,
  video: EditorVideoClip,
) => {
  if (audio.sourceClipId === video.id) {
    return true;
  }
  if (audio.recordingId !== video.recordingId) {
    return false;
  }
  return rangesOverlap(audio, video);
};

export const clipHasReturnableAudio = (
  clips: readonly EditorProjectClip[],
  clip: EditorProjectClip,
): boolean => {
  if (isEditorAudioClip(clip)) {
    return clips.some(
      (other) => isEditorVideoClip(other) && audioBelongsToVideo(clip, other),
    );
  }
  if (!isEditorVideoClip(clip) || clip.muted !== true) {
    return false;
  }
  return clips.some(
    (other) => isEditorAudioClip(other) && audioBelongsToVideo(other, clip),
  );
};

export const returnClipsAudio = (
  clips: readonly EditorProjectClip[],
  clipIds: readonly string[],
): { clips: EditorProjectClip[]; videoIds: string[] } | null => {
  const wanted = new Set(clipIds);
  const selected = clips.filter((clip) => wanted.has(clip.id));
  if (selected.length === 0) {
    return null;
  }
  const removeAudio = new Set<string>();
  const unmuteVideo = new Set<string>();
  for (const clip of selected) {
    if (!clipHasReturnableAudio(clips, clip)) {
      continue;
    }
    if (isEditorAudioClip(clip)) {
      removeAudio.add(clip.id);
      for (const other of clips) {
        if (isEditorVideoClip(other) && audioBelongsToVideo(clip, other)) {
          unmuteVideo.add(other.id);
        }
      }
      continue;
    }
    if (!isEditorVideoClip(clip) || !clip.muted) {
      continue;
    }
    unmuteVideo.add(clip.id);
    for (const other of clips) {
      if (isEditorAudioClip(other) && audioBelongsToVideo(other, clip)) {
        removeAudio.add(other.id);
      }
    }
  }
  if (unmuteVideo.size === 0 && removeAudio.size === 0) {
    return null;
  }
  const next = clips.flatMap((clip) => {
    if (removeAudio.has(clip.id)) {
      return [];
    }
    if (!unmuteVideo.has(clip.id) || !isEditorVideoClip(clip)) {
      return [clip];
    }
    const { muted: _muted, ...rest } = clip;
    return [rest];
  });
  return { clips: next, videoIds: [...unmuteVideo] };
};
