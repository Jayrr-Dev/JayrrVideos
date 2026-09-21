import {
  clipLaneId,
  EDITOR_AUDIO_TYPE,
  EDITOR_CLIP_TYPE,
  EDITOR_SOUND_TYPE,
  isEditorAudioType,
  isEditorBlendMode,
  isEditorItemType,
  isEditorSoundType,
  isEditorTransitionKind,
  MAX_STACK_LANES,
  SEQUENCE_LANE_ID,
  type EditorProjectClip,
} from "./buildEditorTimeline";
import { jayrrLocalSoundUrl } from "../../sounds/jayrrSoundPlayback";

import type { Id } from "../../../convex/_generated/dataModel";

export const EDITOR_CLIPS_STORAGE_KEY = "jayrr-editor-recording-clips-v1";
export const EDITOR_STACK_LANES_KEY = "jayrr-editor-stack-lanes-v1";

export type StoredEditorClip = {
  id: string;
  type?: string;
  recordingId?: string;
  soundId?: string;
  path?: string;
  url?: string;
  label?: string;
  durationMs?: number;
  sourceOffsetMs?: number;
  laneId?: string;
  laneStartMs?: number;
  transitionKind?: EditorProjectClip["transitionKind"];
  blendMode?: EditorProjectClip["blendMode"];
  muted?: boolean;
  sourceClipId?: string;
};

export type EditorRecordingLookup = {
  _id: Id<"presentRecordings">;
  url: string;
  posterUrl: string | null;
  durationMs: number;
  name: string | null;
};

const readFiniteMs = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : null;

export const parseStoredEditorClips = (parsed: unknown): StoredEditorClip[] => {
  if (!Array.isArray(parsed)) {
    return [];
  }
  const out: StoredEditorClip[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const id = Reflect.get(item, "id");
    if (typeof id !== "string") {
      continue;
    }
    const typeRaw = Reflect.get(item, "type");
    if (typeRaw !== undefined && !isEditorItemType(typeRaw)) {
      continue;
    }
    const durationRaw = readFiniteMs(Reflect.get(item, "durationMs"));
    const offsetRaw = readFiniteMs(Reflect.get(item, "sourceOffsetMs"));
    const laneRaw = Reflect.get(item, "laneId");
    const laneStartRaw = readFiniteMs(Reflect.get(item, "laneStartMs"));
    const transitionRaw = Reflect.get(item, "transitionKind");
    const blendRaw = Reflect.get(item, "blendMode");
    const mutedRaw = Reflect.get(item, "muted");
    const sourceClipRaw = Reflect.get(item, "sourceClipId");
    const placement = {
      id,
      ...(durationRaw != null && durationRaw > 0
        ? { durationMs: Math.max(1, durationRaw) }
        : {}),
      ...(offsetRaw != null ? { sourceOffsetMs: offsetRaw } : {}),
      ...(typeof laneRaw === "string" && laneRaw ? { laneId: laneRaw } : {}),
      ...(laneStartRaw != null ? { laneStartMs: laneStartRaw } : {}),
      ...(isEditorTransitionKind(transitionRaw)
        ? { transitionKind: transitionRaw }
        : {}),
      ...(isEditorBlendMode(blendRaw) ? { blendMode: blendRaw } : {}),
      ...(mutedRaw === true ? { muted: true } : {}),
      ...(typeof sourceClipRaw === "string" && sourceClipRaw
        ? { sourceClipId: sourceClipRaw }
        : {}),
    };
    if (isEditorSoundType(typeRaw)) {
      const soundId = Reflect.get(item, "soundId");
      const path = Reflect.get(item, "path");
      if (typeof soundId !== "string" || typeof path !== "string") {
        continue;
      }
      const url = Reflect.get(item, "url");
      const label = Reflect.get(item, "label");
      out.push({
        ...placement,
        type: EDITOR_SOUND_TYPE,
        soundId,
        path,
        ...(typeof url === "string" && url ? { url } : {}),
        ...(typeof label === "string" && label ? { label } : {}),
      });
      continue;
    }
    const recordingId = Reflect.get(item, "recordingId");
    if (typeof recordingId !== "string") {
      continue;
    }
    out.push({
      ...placement,
      type: isEditorAudioType(typeRaw) ? EDITOR_AUDIO_TYPE : EDITOR_CLIP_TYPE,
      recordingId,
    });
  }
  return out;
};

export const clipsToStoredEditor = (
  clips: readonly EditorProjectClip[],
): StoredEditorClip[] => {
  return clips.map((clip) => {
    const shared: StoredEditorClip = {
      id: clip.id,
      type: clip.type,
      durationMs: clip.durationMs,
      sourceOffsetMs: clip.sourceOffsetMs ?? 0,
      ...(clip.laneId ? { laneId: clip.laneId } : {}),
      ...(typeof clip.laneStartMs === "number"
        ? { laneStartMs: clip.laneStartMs }
        : {}),
      ...(clip.transitionKind ? { transitionKind: clip.transitionKind } : {}),
      ...(clip.blendMode ? { blendMode: clip.blendMode } : {}),
      ...(clip.type === EDITOR_CLIP_TYPE && clip.muted ? { muted: true } : {}),
      ...(clip.type === EDITOR_AUDIO_TYPE && clip.sourceClipId
        ? { sourceClipId: clip.sourceClipId }
        : {}),
    };
    if (clip.type === EDITOR_SOUND_TYPE) {
      return {
        ...shared,
        soundId: clip.soundId,
        path: clip.path,
        url: clip.url,
        label: clip.label,
      };
    }
    return {
      ...shared,
      recordingId: clip.recordingId,
    };
  });
};

export const parseStoredStackLanes = (parsed: unknown): string[] => {
  if (!Array.isArray(parsed)) {
    return [];
  }
  const out: string[] = [];
  for (const item of parsed) {
    if (typeof item === "string" && item && item !== SEQUENCE_LANE_ID) {
      out.push(item);
    }
    if (out.length >= MAX_STACK_LANES) {
      break;
    }
  }
  return out;
};

export const readStoredClips = (): StoredEditorClip[] => {
  try {
    const raw = localStorage.getItem(EDITOR_CLIPS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return parseStoredEditorClips(JSON.parse(raw));
  } catch {
    return [];
  }
};

export const writeStoredClips = (clips: readonly EditorProjectClip[]) => {
  localStorage.setItem(
    EDITOR_CLIPS_STORAGE_KEY,
    JSON.stringify(clipsToStoredEditor(clips)),
  );
};

export const readStoredStackLanes = (): string[] => {
  try {
    const raw = localStorage.getItem(EDITOR_STACK_LANES_KEY);
    if (!raw) {
      return [];
    }
    return parseStoredStackLanes(JSON.parse(raw));
  } catch {
    return [];
  }
};

export const writeStoredStackLanes = (laneIds: readonly string[]) => {
  localStorage.setItem(EDITOR_STACK_LANES_KEY, JSON.stringify(laneIds));
};

export const recordingIdsFromStored = (stored: readonly StoredEditorClip[]) => {
  const ids: Id<"presentRecordings">[] = [];
  const seen = new Set<string>();
  for (const item of stored) {
    if (!item.recordingId || seen.has(item.recordingId)) {
      continue;
    }
    seen.add(item.recordingId);
    ids.push(item.recordingId as Id<"presentRecordings">);
  }
  return ids;
};

export const restoreProjectClips = (
  stored: readonly StoredEditorClip[],
  recordings: readonly EditorRecordingLookup[] | null,
): EditorProjectClip[] => {
  const byId = new Map((recordings ?? []).map((row) => [row._id, row]));
  const restored: EditorProjectClip[] = [];
  for (const item of stored) {
    if (item.type === EDITOR_SOUND_TYPE && item.soundId && item.path) {
      restored.push({
        id: item.id,
        type: EDITOR_SOUND_TYPE,
        soundId: item.soundId,
        path: item.path,
        url: item.url || jayrrLocalSoundUrl(item.path),
        label: item.label?.trim() || "Sound",
        durationMs: Math.max(1, item.durationMs ?? 1000),
        sourceOffsetMs: item.sourceOffsetMs ?? 0,
        ...(item.laneId ? { laneId: item.laneId } : {}),
        ...(typeof item.laneStartMs === "number"
          ? { laneStartMs: item.laneStartMs }
          : {}),
        ...(item.transitionKind ? { transitionKind: item.transitionKind } : {}),
        ...(item.blendMode ? { blendMode: item.blendMode } : {}),
      });
      continue;
    }
    if (!item.recordingId || !recordings) {
      continue;
    }
    const row = byId.get(item.recordingId as Id<"presentRecordings">);
    if (!row) {
      continue;
    }
    const sourceOffsetMs = Math.max(
      0,
      Math.min(Math.max(0, row.durationMs - 1), item.sourceOffsetMs ?? 0),
    );
    const maxDuration = Math.max(1, row.durationMs - sourceOffsetMs);
    const recordingClip = {
      id: item.id,
      recordingId: row._id,
      url: row.url,
      posterUrl: row.posterUrl,
      label: row.name?.trim() || "Recording",
      durationMs: Math.max(
        1,
        Math.min(maxDuration, item.durationMs ?? maxDuration),
      ),
      sourceOffsetMs,
      ...(item.laneId ? { laneId: item.laneId } : {}),
      ...(typeof item.laneStartMs === "number"
        ? { laneStartMs: item.laneStartMs }
        : {}),
      ...(item.transitionKind ? { transitionKind: item.transitionKind } : {}),
      ...(item.blendMode ? { blendMode: item.blendMode } : {}),
    };
    if (isEditorAudioType(item.type)) {
      restored.push({
        ...recordingClip,
        type: EDITOR_AUDIO_TYPE,
        ...(item.sourceClipId ? { sourceClipId: item.sourceClipId } : {}),
      });
      continue;
    }
    restored.push({
      ...recordingClip,
      type: EDITOR_CLIP_TYPE,
      ...(item.muted ? { muted: true } : {}),
    });
  }
  return restored;
};

export const stackLanesForClips = (
  clips: readonly EditorProjectClip[],
  current: readonly string[] = [],
): string[] => {
  const next = [...current];
  for (const clip of clips) {
    const laneId = clipLaneId(clip);
    if (laneId === SEQUENCE_LANE_ID || next.includes(laneId)) {
      continue;
    }
    if (next.length >= MAX_STACK_LANES) {
      break;
    }
    next.push(laneId);
  }
  return next;
};
