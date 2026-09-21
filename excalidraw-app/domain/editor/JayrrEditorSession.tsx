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

import { api, convexClient, isConvexLinked } from "../../convexClient";

import {
  buildEditorTimeline,
  EDITOR_CLIP_TYPE,
  EDITOR_SOUND_TYPE,
  removeStackLane as foldStackLane,
  isEditorVideoClip,
  MAX_STACK_LANES,
  newEditorClipId,
  newEditorLaneId,
  returnClipsAudio,
  separateClipsAudio,
  SEQUENCE_LANE_ID,
  sequenceEndMs,
  withFrozenStarts,
  type EditorProjectClip,
} from "./buildEditorTimeline";
import { publishEditorPlayback } from "./editorPlaybackBridge";
import { isJayrrEditorPreviewElement } from "./editorPreviewModel";
import {
  parseStoredEditorClips,
  parseStoredStackLanes,
  readStoredClips,
  readStoredStackLanes,
  recordingIdsFromStored,
  restoreProjectClips,
  stackLanesForClips,
  writeStoredClips,
  writeStoredStackLanes,
} from "./editorProjectStore";
import { insertEditorPreview } from "./insertEditorPreview";
import { type EditorRecordingPick } from "./JayrrEditorAddRecordingDialog";
import { useEditorPlayback } from "./useEditorPlayback";

import type { JayrrSoundPick } from "../../components/ui/JayrrSoundLibraryDialog";
import { jayrrLocalSoundUrl } from "../../sounds/jayrrSoundPlayback";

import type { Id } from "../../../convex/_generated/dataModel";

const EDITOR_HISTORY_LIMIT = 80;

type EditorHistorySnapshot = {
  clips: EditorProjectClip[];
  stackLaneIds: readonly string[];
};

const cloneEditorSnapshot = (
  clips: readonly EditorProjectClip[],
  stackLaneIds: readonly string[],
): EditorHistorySnapshot => ({
  clips: clips.map((clip) => ({ ...clip })),
  stackLaneIds: [...stackLaneIds],
});

const editorSnapshotsEqual = (
  a: EditorHistorySnapshot,
  b: EditorHistorySnapshot,
) =>
  JSON.stringify(a.clips) === JSON.stringify(b.clips) &&
  a.stackLaneIds.length === b.stackLaneIds.length &&
  a.stackLaneIds.every((id, index) => id === b.stackLaneIds[index]);

const PREVIEW_ID_KEY = "jayrr-editor-preview-element-v1";

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
  addSound: (row: JayrrSoundPick) => string;
  separateAudio: (clipIds: readonly string[]) => string[];
  returnAudio: (clipIds: readonly string[]) => string[];
  loadProject: (projectId: Id<"editorProjects">) => Promise<void>;
  undo: () => boolean;
  redo: () => boolean;
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
  const clipsRef = useRef(clips);
  const stackLaneIdsRef = useRef(stackLaneIds);
  const skipHistoryRef = useRef(false);
  const undoStackRef = useRef<EditorHistorySnapshot[]>([]);
  const redoStackRef = useRef<EditorHistorySnapshot[]>([]);
  clipsRef.current = clips;
  stackLaneIdsRef.current = stackLaneIds;

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
    if (hydratedRef.current) {
      return;
    }
    if (canQuery && recordings === undefined) {
      return;
    }
    hydratedRef.current = true;
    const stored = readStoredClips();
    if (stored.length === 0) {
      return;
    }
    const restored = restoreProjectClips(stored, recordings ?? null);
    if (restored.length > 0) {
      setClips(restored);
      setStackLaneIds((current) => {
        const next = stackLanesForClips(restored, current);
        if (next.length === current.length) {
          return current;
        }
        writeStoredStackLanes(next);
        return next;
      });
    }
  }, [canQuery, recordings]);

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
    if (!skipHistoryRef.current) {
      const previous = cloneEditorSnapshot(
        clipsRef.current,
        stackLaneIdsRef.current,
      );
      const upcoming = cloneEditorSnapshot(frozen, stackLaneIdsRef.current);
      if (!editorSnapshotsEqual(previous, upcoming)) {
        undoStackRef.current = [...undoStackRef.current, previous].slice(
          -EDITOR_HISTORY_LIMIT,
        );
        redoStackRef.current = [];
      }
    }
    clipsRef.current = frozen;
    setClips(frozen);
    writeStoredClips(frozen);
  }, []);

  const applyHistorySnapshot = useCallback(
    (snapshot: EditorHistorySnapshot) => {
      skipHistoryRef.current = true;
      clipsRef.current = snapshot.clips;
      stackLaneIdsRef.current = snapshot.stackLaneIds;
      setClips(snapshot.clips);
      writeStoredClips(snapshot.clips);
      setStackLaneIds(snapshot.stackLaneIds);
      writeStoredStackLanes(snapshot.stackLaneIds);
      skipHistoryRef.current = false;
    },
    [],
  );

  const undo = useCallback(() => {
    const previous = undoStackRef.current.at(-1);
    if (!previous) {
      return false;
    }
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [
      ...redoStackRef.current,
      cloneEditorSnapshot(clipsRef.current, stackLaneIdsRef.current),
    ].slice(-EDITOR_HISTORY_LIMIT);
    applyHistorySnapshot(previous);
    return true;
  }, [applyHistorySnapshot]);

  const redo = useCallback(() => {
    const next = redoStackRef.current.at(-1);
    if (!next) {
      return false;
    }
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [
      ...undoStackRef.current,
      cloneEditorSnapshot(clipsRef.current, stackLaneIdsRef.current),
    ].slice(-EDITOR_HISTORY_LIMIT);
    applyHistorySnapshot(next);
    return true;
  }, [applyHistorySnapshot]);

  const addStackLane = useCallback(() => {
    const current = stackLaneIdsRef.current;
    if (current.length >= MAX_STACK_LANES) {
      return;
    }
    const previous = cloneEditorSnapshot(clipsRef.current, current);
    const next = [...current, newEditorLaneId()];
    undoStackRef.current = [...undoStackRef.current, previous].slice(
      -EDITOR_HISTORY_LIMIT,
    );
    redoStackRef.current = [];
    stackLaneIdsRef.current = next;
    setStackLaneIds(next);
    writeStoredStackLanes(next);
  }, []);

  const removeStackLane = useCallback(
    (laneId: string) => {
      const next = foldStackLane(clips, stackLaneIds, laneId);
      if (!next) {
        return;
      }
      persist(next.clips);
      stackLaneIdsRef.current = next.stackLaneIds;
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

  const addSound = useCallback(
    (row: JayrrSoundPick) => {
      const frozen = withFrozenStarts(clips);
      const durationMs = Math.max(
        1,
        Math.round(
          (row.durationSec && row.durationSec > 0 ? row.durationSec : 1) * 1000,
        ),
      );
      const next: EditorProjectClip = {
        id: newEditorClipId(),
        type: EDITOR_SOUND_TYPE,
        soundId: row.id,
        path: row.path,
        url: row.url || jayrrLocalSoundUrl(row.path),
        label: row.name.trim() || "Sound",
        durationMs,
        laneId: SEQUENCE_LANE_ID,
        laneStartMs: sequenceEndMs(frozen),
      };
      persist([...frozen, next]);
      return next.id;
    },
    [clips, persist],
  );

  const separateAudio = useCallback(
    (clipIds: readonly string[]) => {
      const result = separateClipsAudio(clips, clipIds, stackLaneIds);
      if (!result) {
        return [];
      }
      persist(result.clips);
      if (
        stackLaneIdsRef.current.length !== result.stackLaneIds.length ||
        stackLaneIdsRef.current.some(
          (id, index) => id !== result.stackLaneIds[index],
        )
      ) {
        stackLaneIdsRef.current = result.stackLaneIds;
        setStackLaneIds(result.stackLaneIds);
        writeStoredStackLanes(result.stackLaneIds);
      }
      return result.audioIds;
    },
    [clips, persist, stackLaneIds],
  );

  const returnAudio = useCallback(
    (clipIds: readonly string[]) => {
      const result = returnClipsAudio(clips, clipIds);
      if (!result) {
        return [];
      }
      persist(result.clips);
      return result.videoIds;
    },
    [clips, persist],
  );

  const applyRestored = useCallback(
    (restored: EditorProjectClip[], stackLanes: readonly string[]) => {
      persist(restored);
      const nextLanes = stackLanesForClips(restored, stackLanes);
      stackLaneIdsRef.current = nextLanes;
      setStackLaneIds(nextLanes);
      writeStoredStackLanes(nextLanes);
      stop();
    },
    [persist, stop],
  );

  const loadProject = useCallback(
    async (projectId: Id<"editorProjects">) => {
      if (!convexClient) {
        throw new Error("Sign in to load projects.");
      }
      const project = await convexClient.query(api.editorProjects.get, {
        projectId,
      });
      if (!project) {
        throw new Error("Project not found");
      }
      let clipsParsed: unknown = [];
      let lanesParsed: unknown = [];
      try {
        clipsParsed = JSON.parse(project.clipsJson);
        lanesParsed = JSON.parse(project.stackLanesJson);
      } catch {
        throw new Error("Project data is invalid");
      }
      const stored = parseStoredEditorClips(clipsParsed);
      const recordingIds = recordingIdsFromStored(stored);
      const rows =
        recordingIds.length > 0
          ? await convexClient.query(api.presentRecordings.getMany, {
              recordingIds,
            })
          : [];
      const restored = restoreProjectClips(stored, rows);
      if (restored.length === 0 && stored.length > 0) {
        throw new Error("Could not restore clips from this project.");
      }
      applyRestored(restored, parseStoredStackLanes(lanesParsed));
      apiExcal?.setToast({
        message: `Loaded "${project.name}".`,
        closable: true,
      });
    },
    [apiExcal, applyRestored],
  );

  const hasVideo = clips.some(isEditorVideoClip);
  const disabled =
    (timeline.sequence.length === 0 && timeline.overlays.length === 0) ||
    (hasVideo && !previewElementId);

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
      addSound,
      separateAudio,
      returnAudio,
      loadProject,
      undo,
      redo,
      disabled,
    }),
    [
      addRecording,
      addSound,
      separateAudio,
      returnAudio,
      addStackLane,
      redo,
      undo,
      canQuery,
      clearPreviewLink,
      clips,
      container,
      currentTimeMs,
      disabled,
      focusPreview,
      linkSelected,
      loadProject,
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
