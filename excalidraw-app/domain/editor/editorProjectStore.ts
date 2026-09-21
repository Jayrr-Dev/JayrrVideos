import { jayrrLocalSoundUrl } from "../../sounds/jayrrSoundPlayback";

import {
  clipLaneId,
  EDITOR_AUDIO_TYPE,
  EDITOR_CLIP_TYPE,
  EDITOR_HTML_TYPE,
  EDITOR_PX_PER_SECOND,
  EDITOR_PX_PER_SECOND_OPTIONS,
  EDITOR_SOUND_TYPE,
  EDITOR_STATIC_TYPE,
  isEditorAudioType,
  isEditorBlendMode,
  isEditorHtmlType,
  isEditorItemType,
  isEditorSoundType,
  isEditorStaticMediaKind,
  isEditorStaticType,
  isEditorTransitionKind,
  MAX_STACK_LANES,
  SEQUENCE_LANE_ID,
  type EditorProjectClip,
} from "./buildEditorTimeline";

import type { Id } from "../../../convex/_generated/dataModel";

export const EDITOR_CLIPS_STORAGE_KEY = "jayrr-editor-recording-clips-v1";
export const EDITOR_STACK_LANES_KEY = "jayrr-editor-stack-lanes-v1";
export const EDITOR_VIEW_STORAGE_KEY = "jayrr-editor-view-v1";
export const EDITOR_PROJECT_META_KEY = "jayrr-editor-project-meta-v1";
export const DEFAULT_EDITOR_PROJECT_NAME = "Untitled project";
export const EDITOR_PROJECT_NAME_MAX = 80;

export type StoredEditorProjectMeta = {
  name: string;
  projectId: Id<"editorProjects"> | null;
};

export type EditorZoomMode = "fit" | "fixed";

export type StoredEditorView = {
  zoomMode: EditorZoomMode;
  pxPerSecond: number;
  currentTimeMs: number;
  selectedClipIds: string[];
  previewElementId: string | null;
  volume: number;
  muted: boolean;
};

export const DEFAULT_EDITOR_VIEW: StoredEditorView = {
  zoomMode: "fit",
  pxPerSecond: EDITOR_PX_PER_SECOND,
  currentTimeMs: 0,
  selectedClipIds: [],
  previewElementId: null,
  volume: 1,
  muted: false,
};

export type StoredEditorClip = {
  id: string;
  type?: string;
  recordingId?: string;
  soundId?: string;
  path?: string;
  url?: string;
  html?: string;
  mediaKind?: string;
  label?: string;
  durationMs?: number;
  sourceOffsetMs?: number;
  sourceDurationMs?: number;
  laneId?: string;
  laneStartMs?: number;
  transitionKind?: EditorProjectClip["transitionKind"];
  blendMode?: EditorProjectClip["blendMode"];
  muted?: boolean;
  removeBg?: boolean;
  sourceClipId?: string;
  width?: number;
  height?: number;
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
    const sourceDurationRaw = readFiniteMs(
      Reflect.get(item, "sourceDurationMs"),
    );
    const labelRaw = Reflect.get(item, "label");
    const storedLabel =
      typeof labelRaw === "string" && labelRaw.trim()
        ? labelRaw.trim()
        : undefined;
    const laneRaw = Reflect.get(item, "laneId");
    const laneStartRaw = readFiniteMs(Reflect.get(item, "laneStartMs"));
    const transitionRaw = Reflect.get(item, "transitionKind");
    const blendRaw = Reflect.get(item, "blendMode");
    const mutedRaw = Reflect.get(item, "muted");
    const removeBgRaw = Reflect.get(item, "removeBg");
    const sourceClipRaw = Reflect.get(item, "sourceClipId");
    const placement = {
      id,
      ...(durationRaw != null && durationRaw > 0
        ? { durationMs: Math.max(1, durationRaw) }
        : {}),
      ...(offsetRaw != null ? { sourceOffsetMs: offsetRaw } : {}),
      ...(sourceDurationRaw != null && sourceDurationRaw > 0
        ? { sourceDurationMs: Math.max(1, sourceDurationRaw) }
        : {}),
      ...(typeof laneRaw === "string" && laneRaw ? { laneId: laneRaw } : {}),
      ...(laneStartRaw != null ? { laneStartMs: laneStartRaw } : {}),
      ...(isEditorTransitionKind(transitionRaw)
        ? { transitionKind: transitionRaw }
        : {}),
      ...(isEditorBlendMode(blendRaw) ? { blendMode: blendRaw } : {}),
      ...(mutedRaw === true ? { muted: true } : {}),
      ...(removeBgRaw === true ? { removeBg: true } : {}),
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
      out.push({
        ...placement,
        type: EDITOR_SOUND_TYPE,
        soundId,
        path,
        ...(typeof url === "string" && url ? { url } : {}),
        ...(storedLabel ? { label: storedLabel } : {}),
      });
      continue;
    }
    if (isEditorHtmlType(typeRaw)) {
      const html = Reflect.get(item, "html");
      if (typeof html !== "string" || !html.trim()) {
        continue;
      }
      const widthRaw = Reflect.get(item, "width");
      const heightRaw = Reflect.get(item, "height");
      out.push({
        ...placement,
        type: EDITOR_HTML_TYPE,
        html,
        ...(storedLabel ? { label: storedLabel } : {}),
        ...(typeof widthRaw === "number" && Number.isFinite(widthRaw)
          ? { width: Math.round(widthRaw) }
          : {}),
        ...(typeof heightRaw === "number" && Number.isFinite(heightRaw)
          ? { height: Math.round(heightRaw) }
          : {}),
      });
      continue;
    }
    if (isEditorStaticType(typeRaw)) {
      const url = Reflect.get(item, "url");
      if (typeof url !== "string" || !url.trim()) {
        continue;
      }
      const mediaRaw = Reflect.get(item, "mediaKind");
      const widthRaw = Reflect.get(item, "width");
      const heightRaw = Reflect.get(item, "height");
      out.push({
        ...placement,
        type: EDITOR_STATIC_TYPE,
        url,
        ...(isEditorStaticMediaKind(mediaRaw) ? { mediaKind: mediaRaw } : {}),
        ...(storedLabel ? { label: storedLabel } : {}),
        ...(typeof widthRaw === "number" && Number.isFinite(widthRaw)
          ? { width: Math.round(widthRaw) }
          : {}),
        ...(typeof heightRaw === "number" && Number.isFinite(heightRaw)
          ? { height: Math.round(heightRaw) }
          : {}),
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
      ...(storedLabel ? { label: storedLabel } : {}),
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
      ...(clip.label ? { label: clip.label } : {}),
      durationMs: clip.durationMs,
      sourceOffsetMs: clip.sourceOffsetMs ?? 0,
      ...(typeof clip.sourceDurationMs === "number" && clip.sourceDurationMs > 0
        ? { sourceDurationMs: clip.sourceDurationMs }
        : {}),
      ...(clip.laneId ? { laneId: clip.laneId } : {}),
      ...(typeof clip.laneStartMs === "number"
        ? { laneStartMs: clip.laneStartMs }
        : {}),
      ...(clip.transitionKind ? { transitionKind: clip.transitionKind } : {}),
      ...(clip.blendMode ? { blendMode: clip.blendMode } : {}),
      ...(clip.type === EDITOR_CLIP_TYPE && clip.muted ? { muted: true } : {}),
      ...(clip.type === EDITOR_CLIP_TYPE && clip.removeBg
        ? { removeBg: true }
        : {}),
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
    if (clip.type === EDITOR_HTML_TYPE) {
      return {
        ...shared,
        html: clip.html,
        label: clip.label,
        ...(typeof clip.width === "number" ? { width: clip.width } : {}),
        ...(typeof clip.height === "number" ? { height: clip.height } : {}),
      };
    }
    if (clip.type === EDITOR_STATIC_TYPE) {
      return {
        ...shared,
        url: clip.url,
        mediaKind: clip.mediaKind,
        label: clip.label,
        ...(typeof clip.width === "number" ? { width: clip.width } : {}),
        ...(typeof clip.height === "number" ? { height: clip.height } : {}),
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

const isEditorZoomMode = (value: unknown): value is EditorZoomMode =>
  value === "fit" || value === "fixed";

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

export const parseStoredEditorView = (parsed: unknown): StoredEditorView => {
  if (!parsed || typeof parsed !== "object") {
    return { ...DEFAULT_EDITOR_VIEW };
  }
  const zoomRaw = Reflect.get(parsed, "zoomMode");
  const pxRaw = Reflect.get(parsed, "pxPerSecond");
  const timeRaw = readFiniteMs(Reflect.get(parsed, "currentTimeMs"));
  const selectedRaw = Reflect.get(parsed, "selectedClipIds");
  const previewRaw = Reflect.get(parsed, "previewElementId");
  const volumeRaw = Reflect.get(parsed, "volume");
  const mutedRaw = Reflect.get(parsed, "muted");
  const selectedClipIds: string[] = [];
  if (Array.isArray(selectedRaw)) {
    for (const id of selectedRaw) {
      if (typeof id === "string" && id) {
        selectedClipIds.push(id);
      }
    }
  }
  const pxAllowed = (
    EDITOR_PX_PER_SECOND_OPTIONS as readonly number[]
  ).includes(typeof pxRaw === "number" ? pxRaw : NaN);
  return {
    zoomMode: isEditorZoomMode(zoomRaw)
      ? zoomRaw
      : DEFAULT_EDITOR_VIEW.zoomMode,
    pxPerSecond: pxAllowed
      ? (pxRaw as number)
      : DEFAULT_EDITOR_VIEW.pxPerSecond,
    currentTimeMs: timeRaw ?? 0,
    selectedClipIds,
    previewElementId:
      typeof previewRaw === "string" && previewRaw ? previewRaw : null,
    volume:
      typeof volumeRaw === "number" && Number.isFinite(volumeRaw)
        ? clampUnit(volumeRaw)
        : DEFAULT_EDITOR_VIEW.volume,
    muted: mutedRaw === true,
  };
};

export const readStoredEditorView = (): StoredEditorView => {
  try {
    const raw = localStorage.getItem(EDITOR_VIEW_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_EDITOR_VIEW };
    }
    return parseStoredEditorView(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_EDITOR_VIEW };
  }
};

export const writeStoredEditorView = (view: StoredEditorView) => {
  localStorage.setItem(EDITOR_VIEW_STORAGE_KEY, JSON.stringify(view));
};

export const normalizeEditorProjectName = (name: string) => {
  const trimmed = name.trim().slice(0, EDITOR_PROJECT_NAME_MAX);
  return trimmed || DEFAULT_EDITOR_PROJECT_NAME;
};

export const readStoredEditorProjectMeta = (): StoredEditorProjectMeta => {
  try {
    const raw = localStorage.getItem(EDITOR_PROJECT_META_KEY);
    if (!raw) {
      return { name: DEFAULT_EDITOR_PROJECT_NAME, projectId: null };
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { name: DEFAULT_EDITOR_PROJECT_NAME, projectId: null };
    }
    const nameRaw = Reflect.get(parsed, "name");
    const idRaw = Reflect.get(parsed, "projectId");
    return {
      name:
        typeof nameRaw === "string"
          ? normalizeEditorProjectName(nameRaw)
          : DEFAULT_EDITOR_PROJECT_NAME,
      projectId:
        typeof idRaw === "string" && idRaw
          ? (idRaw as Id<"editorProjects">)
          : null,
    };
  } catch {
    return { name: DEFAULT_EDITOR_PROJECT_NAME, projectId: null };
  }
};

export const writeStoredEditorProjectMeta = (meta: StoredEditorProjectMeta) => {
  localStorage.setItem(EDITOR_PROJECT_META_KEY, JSON.stringify(meta));
};

export const serializeEditorView = (view: StoredEditorView) =>
  JSON.stringify(view);

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
        ...(typeof item.sourceDurationMs === "number" &&
        item.sourceDurationMs > 0
          ? { sourceDurationMs: Math.max(1, item.sourceDurationMs) }
          : {}),
        ...(item.laneId ? { laneId: item.laneId } : {}),
        ...(typeof item.laneStartMs === "number"
          ? { laneStartMs: item.laneStartMs }
          : {}),
        ...(item.transitionKind ? { transitionKind: item.transitionKind } : {}),
        ...(item.blendMode ? { blendMode: item.blendMode } : {}),
      });
      continue;
    }
    if (item.type === EDITOR_HTML_TYPE && item.html) {
      restored.push({
        id: item.id,
        type: EDITOR_HTML_TYPE,
        html: item.html,
        label: item.label?.trim() || "AI clip",
        durationMs: Math.max(1, item.durationMs ?? 1000),
        sourceOffsetMs: item.sourceOffsetMs ?? 0,
        ...(typeof item.sourceDurationMs === "number" &&
        item.sourceDurationMs > 0
          ? { sourceDurationMs: Math.max(1, item.sourceDurationMs) }
          : {}),
        ...(item.laneId ? { laneId: item.laneId } : {}),
        ...(typeof item.laneStartMs === "number"
          ? { laneStartMs: item.laneStartMs }
          : {}),
        ...(item.transitionKind ? { transitionKind: item.transitionKind } : {}),
        ...(item.blendMode ? { blendMode: item.blendMode } : {}),
        ...(typeof item.width === "number" ? { width: item.width } : {}),
        ...(typeof item.height === "number" ? { height: item.height } : {}),
      });
      continue;
    }
    if (item.type === EDITOR_STATIC_TYPE && item.url) {
      restored.push({
        id: item.id,
        type: EDITOR_STATIC_TYPE,
        url: item.url,
        mediaKind: isEditorStaticMediaKind(item.mediaKind)
          ? item.mediaKind
          : "image",
        label: item.label?.trim() || "Image",
        durationMs: Math.max(1, item.durationMs ?? 1000),
        sourceOffsetMs: item.sourceOffsetMs ?? 0,
        ...(typeof item.sourceDurationMs === "number" &&
        item.sourceDurationMs > 0
          ? { sourceDurationMs: Math.max(1, item.sourceDurationMs) }
          : {}),
        ...(item.laneId ? { laneId: item.laneId } : {}),
        ...(typeof item.laneStartMs === "number"
          ? { laneStartMs: item.laneStartMs }
          : {}),
        ...(item.transitionKind ? { transitionKind: item.transitionKind } : {}),
        ...(item.blendMode ? { blendMode: item.blendMode } : {}),
        ...(typeof item.width === "number" ? { width: item.width } : {}),
        ...(typeof item.height === "number" ? { height: item.height } : {}),
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
      label: item.label?.trim() || row.name?.trim() || "Recording",
      durationMs: Math.max(
        1,
        Math.min(maxDuration, item.durationMs ?? maxDuration),
      ),
      sourceOffsetMs,
      sourceDurationMs: Math.max(1, row.durationMs),
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
      ...(item.removeBg ? { removeBg: true } : {}),
    });
  }
  return restored;
};

export const attachRecordingMedia = (
  clips: readonly EditorProjectClip[],
  recordings: readonly EditorRecordingLookup[] | null,
): EditorProjectClip[] => {
  if (!recordings || recordings.length === 0) {
    return clips as EditorProjectClip[];
  }
  const byId = new Map(recordings.map((row) => [row._id, row]));
  let changed = false;
  const next = clips.map((clip) => {
    if (
      (clip.type !== EDITOR_CLIP_TYPE && clip.type !== EDITOR_AUDIO_TYPE) ||
      !clip.recordingId
    ) {
      return clip;
    }
    const row = byId.get(clip.recordingId);
    if (!row) {
      return clip;
    }
    const url = clip.url || row.url;
    if (clip.type === EDITOR_CLIP_TYPE) {
      const posterUrl = clip.posterUrl || row.posterUrl;
      if (url === clip.url && posterUrl === clip.posterUrl) {
        return clip;
      }
      changed = true;
      return { ...clip, url, posterUrl };
    }
    if (url === clip.url) {
      return clip;
    }
    changed = true;
    return { ...clip, url };
  });
  return changed ? next : (clips as EditorProjectClip[]);
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
