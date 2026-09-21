import { CaptureUpdateAction, useExcalidrawAPI } from "@excalidraw/excalidraw";
import { useExcalidrawContainer } from "@excalidraw/excalidraw/components/App";
import { useConvexAuth, useQuery } from "convex/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { api, isConvexLinked } from "../../convexClient";

import {
  buildEditorTimeline,
  clipLaneId,
  EDITOR_CLIP_TYPE,
  removeStackLane as foldStackLane,
  isEditorBlendMode,
  isEditorClipType,
  isEditorTransitionKind,
  MAX_STACK_LANES,
  newEditorClipId,
  newEditorLaneId,
  SEQUENCE_LANE_ID,
  sequenceEndMs,
  withFrozenStarts,
  type EditorProjectClip,
} from "./buildEditorTimeline";
import { publishEditorPlayback } from "./editorPlaybackBridge";
import { isJayrrEditorPreviewElement } from "./editorPreviewModel";
import { insertEditorPreview } from "./insertEditorPreview";
import { type EditorRecordingPick } from "./JayrrEditorAddRecordingDialog";
import { useEditorPlayback } from "./useEditorPlayback";

import type { Id } from "../../../convex/_generated/dataModel";

const PREVIEW_ID_KEY = "jayrr-editor-preview-element-v1";
const STORAGE_KEY = "jayrr-editor-recording-clips-v1";
const STACK_LANES_KEY = "jayrr-editor-stack-lanes-v1";

type StoredClip = {
  id: string;
  type?: string;
  recordingId: string;
  durationMs?: number;
  sourceOffsetMs?: number;
  laneId?: string;
  laneStartMs?: number;
  transitionKind?: EditorProjectClip["transitionKind"];
  blendMode?: EditorProjectClip["blendMode"];
};

const readStoredClips = (): StoredClip[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const out: StoredClip[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === "object" &&
        typeof Reflect.get(item, "id") === "string" &&
        typeof Reflect.get(item, "recordingId") === "string"
      ) {
        const durationRaw = Reflect.get(item, "durationMs");
        const offsetRaw = Reflect.get(item, "sourceOffsetMs");
        const laneRaw = Reflect.get(item, "laneId");
        const laneStartRaw = Reflect.get(item, "laneStartMs");
        const transitionRaw = Reflect.get(item, "transitionKind");
        const blendRaw = Reflect.get(item, "blendMode");
        const typeRaw = Reflect.get(item, "type");
        if (typeRaw !== undefined && !isEditorClipType(typeRaw)) {
          continue;
        }
        out.push({
          id: Reflect.get(item, "id") as string,
          type: EDITOR_CLIP_TYPE,
          recordingId: Reflect.get(item, "recordingId") as string,
          ...(typeof durationRaw === "number" && Number.isFinite(durationRaw)
            ? { durationMs: Math.max(1, Math.round(durationRaw)) }
            : {}),
          ...(typeof offsetRaw === "number" && Number.isFinite(offsetRaw)
            ? { sourceOffsetMs: Math.max(0, Math.round(offsetRaw)) }
            : {}),
          ...(typeof laneRaw === "string" && laneRaw
            ? { laneId: laneRaw }
            : {}),
          ...(typeof laneStartRaw === "number" && Number.isFinite(laneStartRaw)
            ? { laneStartMs: Math.max(0, Math.round(laneStartRaw)) }
            : {}),
          ...(isEditorTransitionKind(transitionRaw)
            ? { transitionKind: transitionRaw }
            : {}),
          ...(isEditorBlendMode(blendRaw) ? { blendMode: blendRaw } : {}),
        });
      }
    }
    return out;
  } catch {
    return [];
  }
};

const writeStoredClips = (clips: readonly EditorProjectClip[]) => {
  const payload: StoredClip[] = clips.map((clip) => ({
    id: clip.id,
    type: clip.type,
    recordingId: clip.recordingId,
    durationMs: clip.durationMs,
    sourceOffsetMs: clip.sourceOffsetMs ?? 0,
    ...(clip.laneId ? { laneId: clip.laneId } : {}),
    ...(typeof clip.laneStartMs === "number"
      ? { laneStartMs: clip.laneStartMs }
      : {}),
    ...(clip.transitionKind ? { transitionKind: clip.transitionKind } : {}),
    ...(clip.blendMode ? { blendMode: clip.blendMode } : {}),
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const readStoredStackLanes = (): string[] => {
  try {
    const raw = localStorage.getItem(STACK_LANES_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
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
  } catch {
    return [];
  }
};

const writeStoredStackLanes = (laneIds: readonly string[]) => {
  localStorage.setItem(STACK_LANES_KEY, JSON.stringify(laneIds));
};

const readStoredPreviewId = (): string | null => {
  try {
    return localStorage.getItem(PREVIEW_ID_KEY);
  } catch {
    return null;
  }
};

const writeStoredPreviewId = (id: string | null) => {
  if (!id) {
    localStorage.removeItem(PREVIEW_ID_KEY);
    return;
  }
  localStorage.setItem(PREVIEW_ID_KEY, id);
};

const isLinkablePreviewTarget = (
  element: NonDeletedExcalidrawElement,
): boolean => {
  if (element.type !== "embeddable") {
    return false;
  }
  if (isJayrrEditorPreviewElement(element)) {
    return true;
  }
  return Boolean(element.link);
};

type EditorSessionValue = {
  container: HTMLDivElement | null;
  canQuery: boolean;
  clips: EditorProjectClip[];
  persist: (next: EditorProjectClip[]) => void;
  stackLaneIds: readonly string[];
  addStackLane: () => void;
  removeStackLane: (laneId: string) => void;
  timeline: ReturnType<typeof buildEditorTimeline>;
  currentTimeMs: number;
  playing: boolean;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (ms: number) => void;
  togglePlay: () => void;
  previewElementId: string | null;
  selectedLinkable: NonDeletedExcalidrawElement | null;
  placePreview: () => void;
  linkSelected: () => void;
  clearPreviewLink: () => void;
  focusPreview: () => void;
  addRecording: (row: EditorRecordingPick) => string;
  disabled: boolean;
};

const EditorSessionContext = createContext<EditorSessionValue | null>(null);

export const useJayrrEditorSession = () => {
  const value = useContext(EditorSessionContext);
  if (!value) {
    throw new Error("JayrrEditorSession is missing");
  }
  return value;
};

export const JayrrEditorSession = ({ children }: { children: ReactNode }) => {
  const apiExcal = useExcalidrawAPI();
  const { container } = useExcalidrawContainer();
  const ownerDocument = container?.ownerDocument ?? document;
  const { isAuthenticated } = useConvexAuth();
  const canQuery = isConvexLinked && isAuthenticated;
  const recordings = useQuery(
    api.presentRecordings.listRecent,
    canQuery ? { limit: 40 } : "skip",
  );

  const [clips, setClips] = useState<EditorProjectClip[]>([]);
  const [stackLaneIds, setStackLaneIds] =
    useState<readonly string[]>(readStoredStackLanes);
  const [previewElementId, setPreviewElementId] = useState<string | null>(
    readStoredPreviewId,
  );
  const [selectedElementIds, setSelectedElementIds] = useState<
    Record<string, boolean>
  >({});
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!apiExcal) {
      return;
    }
    setSelectedElementIds(apiExcal.getAppState().selectedElementIds);
    return apiExcal.onChange((_elements, appState) => {
      setSelectedElementIds(appState.selectedElementIds);
    });
  }, [apiExcal]);

  const linkPreview = useCallback((id: string) => {
    setPreviewElementId(id);
    writeStoredPreviewId(id);
  }, []);

  useEffect(() => {
    if (!apiExcal) {
      return;
    }
    const elements = apiExcal.getSceneElements();
    if (previewElementId) {
      const exists = elements.some(
        (element) => element.id === previewElementId,
      );
      if (exists) {
        return;
      }
      setPreviewElementId(null);
      writeStoredPreviewId(null);
    }
    const selected = Object.keys(selectedElementIds).filter(
      (id) => selectedElementIds[id],
    );
    if (selected.length !== 1) {
      return;
    }
    const picked = elements.find((element) => element.id === selected[0]);
    if (picked && isJayrrEditorPreviewElement(picked)) {
      linkPreview(picked.id);
    }
  }, [apiExcal, linkPreview, previewElementId, selectedElementIds]);

  useEffect(() => {
    if (hydratedRef.current || recordings === undefined) {
      return;
    }
    hydratedRef.current = true;
    const stored = readStoredClips();
    if (stored.length === 0 || !recordings) {
      return;
    }
    const byId = new Map(recordings.map((row) => [row._id, row]));
    const restored: EditorProjectClip[] = [];
    for (const item of stored) {
      const row = byId.get(item.recordingId as Id<"presentRecordings">);
      if (!row) {
        continue;
      }
      const sourceOffsetMs = Math.max(
        0,
        Math.min(Math.max(0, row.durationMs - 1), item.sourceOffsetMs ?? 0),
      );
      const maxDuration = Math.max(1, row.durationMs - sourceOffsetMs);
      restored.push({
        id: item.id,
        type: EDITOR_CLIP_TYPE,
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
      });
    }
    if (restored.length > 0) {
      setClips(restored);
      setStackLaneIds((current) => {
        const next = [...current];
        for (const clip of restored) {
          const laneId = clipLaneId(clip);
          if (laneId === SEQUENCE_LANE_ID || next.includes(laneId)) {
            continue;
          }
          if (next.length >= MAX_STACK_LANES) {
            break;
          }
          next.push(laneId);
        }
        if (next.length === current.length) {
          return current;
        }
        writeStoredStackLanes(next);
        return next;
      });
    }
  }, [recordings]);

  const timeline = useMemo(() => buildEditorTimeline(clips), [clips]);
  const { currentTimeMs, playing, play, pause, stop, seek, togglePlay } =
    useEditorPlayback({
      timeline,
      stackLaneIds,
      previewElementId,
      ownerDocument,
    });

  useEffect(() => {
    publishEditorPlayback({
      playing,
      currentTimeMs,
      totalMs: timeline.totalMs,
      play,
      pause,
      stop,
      seek,
    });
  }, [currentTimeMs, pause, play, playing, seek, stop, timeline.totalMs]);

  useEffect(() => {
    return () => publishEditorPlayback(null);
  }, []);

  const persist = useCallback((next: EditorProjectClip[]) => {
    const frozen = withFrozenStarts(next);
    setClips(frozen);
    writeStoredClips(frozen);
  }, []);

  const addStackLane = useCallback(() => {
    setStackLaneIds((current) => {
      if (current.length >= MAX_STACK_LANES) {
        return current;
      }
      const next = [...current, newEditorLaneId()];
      writeStoredStackLanes(next);
      return next;
    });
  }, []);

  const removeStackLane = useCallback(
    (laneId: string) => {
      const next = foldStackLane(clips, stackLaneIds, laneId);
      if (!next) {
        return;
      }
      persist(next.clips);
      setStackLaneIds(next.stackLaneIds);
      writeStoredStackLanes(next.stackLaneIds);
    },
    [clips, persist, stackLaneIds],
  );

  const selectedLinkable = useMemo(() => {
    if (!apiExcal) {
      return null;
    }
    const ids = Object.keys(selectedElementIds).filter(
      (id) => selectedElementIds[id],
    );
    if (ids.length !== 1) {
      return null;
    }
    const id = ids[0];
    const element = apiExcal.getSceneElements().find((item) => item.id === id);
    if (!element || !isLinkablePreviewTarget(element)) {
      return null;
    }
    return element;
  }, [apiExcal, selectedElementIds]);

  const placePreview = useCallback(() => {
    if (!apiExcal) {
      return;
    }
    const id = insertEditorPreview(apiExcal);
    linkPreview(id);
  }, [apiExcal, linkPreview]);

  const linkSelected = useCallback(() => {
    if (!selectedLinkable) {
      return;
    }
    linkPreview(selectedLinkable.id);
    apiExcal?.setToast({
      message: "Linked selection as editor preview.",
      closable: true,
    });
  }, [apiExcal, linkPreview, selectedLinkable]);

  const clearPreviewLink = useCallback(() => {
    setPreviewElementId(null);
    writeStoredPreviewId(null);
    stop();
  }, [stop]);

  const focusPreview = useCallback(() => {
    if (!apiExcal || !previewElementId) {
      return;
    }
    const element = apiExcal
      .getSceneElements()
      .find((item) => item.id === previewElementId);
    if (!element) {
      return;
    }
    const appState = apiExcal.getAppState();
    const zoom = appState.zoom.value || 1;
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    apiExcal.updateScene({
      appState: {
        selectedElementIds: { [previewElementId]: true },
        scrollX: appState.width / 2 / zoom - cx,
        scrollY: appState.height / 2 / zoom - cy,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    });
  }, [apiExcal, previewElementId]);

  const addRecording = useCallback(
    (row: EditorRecordingPick) => {
      const frozen = withFrozenStarts(clips);
      const next: EditorProjectClip = {
        id: newEditorClipId(),
        type: EDITOR_CLIP_TYPE,
        recordingId: row._id,
        url: row.url,
        posterUrl: row.posterUrl,
        label: row.name?.trim() || "Recording",
        durationMs: Math.max(1, row.durationMs),
        laneId: SEQUENCE_LANE_ID,
        laneStartMs: sequenceEndMs(frozen),
      };
      persist([...frozen, next]);
      return next.id;
    },
    [clips, persist],
  );

  const disabled =
    (timeline.sequence.length === 0 && timeline.overlays.length === 0) ||
    !previewElementId;

  const value = useMemo(
    (): EditorSessionValue => ({
      container,
      canQuery,
      clips,
      persist,
      stackLaneIds,
      addStackLane,
      removeStackLane,
      timeline,
      currentTimeMs,
      playing,
      play,
      pause,
      stop,
      seek,
      togglePlay,
      previewElementId,
      selectedLinkable,
      placePreview,
      linkSelected,
      clearPreviewLink,
      focusPreview,
      addRecording,
      disabled,
    }),
    [
      addRecording,
      addStackLane,
      canQuery,
      clearPreviewLink,
      clips,
      container,
      currentTimeMs,
      disabled,
      focusPreview,
      linkSelected,
      pause,
      persist,
      placePreview,
      play,
      playing,
      previewElementId,
      removeStackLane,
      seek,
      selectedLinkable,
      stackLaneIds,
      stop,
      timeline,
      togglePlay,
    ],
  );

  return (
    <EditorSessionContext.Provider value={value}>
      {children}
    </EditorSessionContext.Provider>
  );
};
