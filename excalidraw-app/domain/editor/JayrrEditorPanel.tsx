import {
  CODES,
  DEFAULT_SIDEBAR,
  isDarwin,
  KEYS,
  matchKey,
} from "@excalidraw/common";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import {
  BringForwardIcon,
  BringToFrontIcon,
  checkIcon,
  helpIcon,
  SendBackwardIcon,
  SendToBackIcon,
  settingsIcon,
  TrashIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useMutation } from "convex/react";
import { ContextMenu, Popover } from "radix-ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import { appJotaiStore } from "../../app-jotai";
import { FilledButton, Island, Tooltip } from "../../components/ui/editor";
import { JayrrSoundLibraryDialog } from "../../components/ui/JayrrSoundLibraryDialog";
import { api } from "../../convexClient";
import { docsViewAtom, persistDocsView } from "../../present/docsView";
import { JAYRR_RECORDINGS_TAB } from "../../present/JayrrPresentRecordingsPanel";
import { uploadPresentRecording } from "../../present/uploadPresentRecording";

import "../../components/ui/JayrrLibraryMenu.scss";

import {
  canCutAtTime,
  clipAtTimeAcrossLanes,
  clipHasReturnableAudio,
  clipLaneId,
  clipLayerMoveAvailability,
  collectLaneOverlaps,
  EDITOR_CUT_MIN_MS,
  EDITOR_PX_PER_SECOND_OPTIONS,
  editorLanes,
  formatEditorClock,
  getMergeableClips,
  isEditorVideoClip,
  mergeProjectClips,
  moveClipsByLayer,
  moveEditorClip,
  newEditorClipId,
  overlapParticipantIds,
  resizeEditorClip,
  restoreEditorClipEdge,
  SEQUENCE_LANE_ID,
  setClipsBlendMode,
  setClipsRemoveBg,
  setClipsTransition,
  type EditorBlendMode,
  type EditorClip,
  type EditorClipEdge,
  type EditorLayerDirection,
  type EditorProjectClip,
  type EditorTransitionKind,
  type EditorVideoClip,
  type OverlapBand,
} from "./buildEditorTimeline";
import { findEditorTargetVideo } from "./editorPreviewModel";
import {
  clipsToStoredEditor,
  DEFAULT_EDITOR_PROJECT_NAME,
  EDITOR_PROJECT_NAME_MAX,
  serializeEditorView,
} from "./editorProjectStore";
import { exportEditorTimeline } from "./exportEditorTimeline";
import { JayrrEditorAddImageDialog } from "./JayrrEditorAddImageDialog";
import { JayrrEditorAddRecordingDialog } from "./JayrrEditorAddRecordingDialog";
import { JayrrEditorAddStockDialog } from "./JayrrEditorAddStockDialog";
import { JayrrEditorAiDialog } from "./JayrrEditorAiDialog";
import { JayrrEditorBlendModeDialog } from "./JayrrEditorBlendModeDialog";
import { JayrrEditorExportDialog } from "./JayrrEditorExportDialog";
import { JayrrEditorSaveProjectDialog } from "./JayrrEditorSaveProjectDialog";
import { useJayrrEditorSession } from "./JayrrEditorSession";
import { JayrrEditorTimeline } from "./JayrrEditorTimeline";
import { JayrrEditorVolumeControl } from "./JayrrEditorVolumeControl";

import "./JayrrEditorPanel.scss";

export const JAYRR_EDITOR_TAB = "jayrrEditor";

const SETTINGS_INFO =
  "Place or link a canvas box for timeline playback. Volume here is the preview loudness.";

const defaultProjectName = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `Project ${month}-${day} ${hours}:${minutes}`;
};

export const editorTabIcon = (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
    <rect
      x="2.6"
      y="5.2"
      width="10.4"
      height="9.6"
      rx="1.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
    <path
      d="M13 8.2 17.4 5.8v8.4L13 11.8z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  </svg>
);

const PlayGlyph = (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
    <path d="M6.2 3.8v12.4L16.4 10Z" fill="currentColor" />
  </svg>
);

const PauseGlyph = (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
    <rect
      x="4.4"
      y="3.6"
      width="4"
      height="12.8"
      rx="0.8"
      fill="currentColor"
    />
    <rect
      x="11.6"
      y="3.6"
      width="4"
      height="12.8"
      rx="0.8"
      fill="currentColor"
    />
  </svg>
);

const ExportGlyph = (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4.2 13.2v2.4a1 1 0 0 0 1 1h9.6a1 1 0 0 0 1-1v-2.4" />
    <path d="M10 3.6v8.2" />
    <path d="M6.6 7.2 10 3.6l3.4 3.6" />
  </svg>
);

const SaveGlyph = (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4.2 3.4h8.2L16 6.8v9.8a1 1 0 0 1-1 1H4.2a1 1 0 0 1-1-1V4.4a1 1 0 0 1 1-1z" />
    <path d="M6.4 3.4v4.2h6.2" />
    <path d="M6.6 17.6v-5h6.8v5" />
  </svg>
);

const LAYER_MOVE_ACTIONS: readonly {
  direction: EditorLayerDirection;
  label: string;
  icon: ReactNode;
}[] = [
  { direction: "back", label: "Send to back", icon: SendToBackIcon },
  { direction: "backward", label: "Send backward", icon: SendBackwardIcon },
  { direction: "forward", label: "Bring forward", icon: BringForwardIcon },
  { direction: "front", label: "Bring to front", icon: BringToFrontIcon },
];

export const JayrrEditorPanel = () => {
  const {
    container,
    canQuery,
    clips,
    persist,
    stackLaneIds,
    addStackLane,
    removeStackLane,
    moveSelectedByLayer,
    zoomMode,
    setZoomMode,
    pxPerSecond,
    setPxPerSecond,
    selectedClipIds,
    setSelectedClipIds,
    snapshotView,
    timeline,
    currentTimeMs,
    playing,
    stop,
    play,
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
    addStaticClip,
    separateAudio,
    returnAudio,
    undo,
    redo,
    disabled,
    projectName,
    loadedProjectId,
    setProjectName,
    markProjectSaved,
  } = useJayrrEditorSession();
  const excalidrawAPI = useExcalidrawAPI();
  const saveProject = useMutation(api.editorProjects.save);
  const renameSavedProject = useMutation(api.editorProjects.rename);

  const [addRecordingOpen, setAddRecordingOpen] = useState(false);
  const [addSoundOpen, setAddSoundOpen] = useState(false);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [addImageOpen, setAddImageOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [renamingProject, setRenamingProject] = useState(false);
  const [draftProjectName, setDraftProjectName] = useState("");
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const currentTimeMsRef = useRef(currentTimeMs);
  currentTimeMsRef.current = currentTimeMs;
  const [blendPicker, setBlendPicker] = useState<{
    clipIds: readonly string[];
    blendMode: EditorBlendMode;
  } | null>(null);
  const [menuClipId, setMenuClipId] = useState<string | null>(null);

  const selectedIdSet = useMemo(
    () => new Set(selectedClipIds),
    [selectedClipIds],
  );

  useEffect(() => {
    if (!renamingProject) {
      return;
    }
    projectNameInputRef.current?.focus();
    projectNameInputRef.current?.select();
  }, [renamingProject]);

  const startRenameProject = () => {
    setDraftProjectName(
      projectName === DEFAULT_EDITOR_PROJECT_NAME ? "" : projectName,
    );
    setRenamingProject(true);
  };

  const commitProjectName = async () => {
    setRenamingProject(false);
    const next = draftProjectName.trim();
    if (!next || next === projectName) {
      return;
    }
    setProjectName(next);
    if (!loadedProjectId || !canQuery) {
      return;
    }
    try {
      await renameSavedProject({ projectId: loadedProjectId, name: next });
    } catch (error) {
      excalidrawAPI?.setToast({
        message:
          error instanceof Error ? error.message : "Could not rename project.",
        closable: true,
      });
    }
  };

  const saveDefaultName =
    projectName.trim() && projectName !== DEFAULT_EDITOR_PROJECT_NAME
      ? projectName
      : defaultProjectName();

  const layerMoves = useMemo(
    () =>
      clipLayerMoveAvailability({
        clips,
        clipIds: selectedClipIds,
        stackLaneIds,
      }),
    [clips, selectedClipIds, stackLaneIds],
  );
  const lanes = useMemo(
    () => editorLanes(timeline, stackLaneIds),
    [stackLaneIds, timeline],
  );

  const laneOverlaps = useMemo(() => collectLaneOverlaps(lanes), [lanes]);

  const overlapFocus = useCallback(
    (band: OverlapBand) => {
      const participantIds = overlapParticipantIds(
        laneOverlaps,
        band.joinMs,
        band.laneIds,
      );
      const selected = participantIds.find((id) => selectedIdSet.has(id));
      if (selected) {
        return { participantIds, focusId: selected };
      }
      const laneOrder = [SEQUENCE_LANE_ID, ...stackLaneIds];
      let focusId: string | null = null;
      let bestIndex = -1;
      for (const id of participantIds) {
        const clip = clips.find((item) => item.id === id);
        if (!clip) {
          continue;
        }
        const index = laneOrder.indexOf(clipLaneId(clip));
        const rank = index < 0 ? 0 : index;
        if (rank < bestIndex) {
          continue;
        }
        bestIndex = rank;
        focusId = id;
      }
      return { participantIds, focusId };
    },
    [clips, laneOverlaps, selectedIdSet, stackLaneIds],
  );

  const overlapLayerMoves = useCallback(
    (band: OverlapBand) => {
      const { participantIds, focusId } = overlapFocus(band);
      if (!focusId) {
        return {
          back: false,
          backward: false,
          forward: false,
          front: false,
        };
      }
      return clipLayerMoveAvailability({
        clips,
        clipIds: [focusId],
        stackLaneIds,
        peerClipIds: participantIds,
      });
    },
    [clips, overlapFocus, stackLaneIds],
  );

  const reorderOverlap = useCallback(
    (band: OverlapBand, direction: EditorLayerDirection) => {
      const { participantIds, focusId } = overlapFocus(band);
      if (!focusId) {
        return;
      }
      const next = moveClipsByLayer({
        clips,
        clipIds: [focusId],
        stackLaneIds,
        direction,
        peerClipIds: participantIds,
      });
      if (!next) {
        return;
      }
      persist(next.clips);
    },
    [clips, overlapFocus, persist, stackLaneIds],
  );

  const playheadClip = useMemo(
    () => clipAtTimeAcrossLanes(lanes, currentTimeMs, selectedIdSet),
    [currentTimeMs, lanes, selectedIdSet],
  );
  const playheadClipId = playheadClip?.id ?? null;

  const removeSelected = useCallback(() => {
    if (selectedClipIds.length === 0) {
      return;
    }
    const remove = new Set(selectedClipIds);
    const next = clips.filter((clip) => !remove.has(clip.id));
    persist(next);
    setSelectedClipIds([]);
    stop();
  }, [clips, persist, selectedClipIds, setSelectedClipIds, stop]);

  const menuOnClip = menuClipId !== null;
  const menuClip = useMemo(
    () => clips.find((clip) => clip.id === menuClipId) ?? null,
    [clips, menuClipId],
  );
  const canCut =
    menuOnClip && playheadClip
      ? canCutAtTime([playheadClip], currentTimeMs)
      : false;
  const mergeable = useMemo(
    () => getMergeableClips(clips, selectedIdSet),
    [clips, selectedIdSet],
  );
  const canMerge = Boolean(mergeable);
  const separateTargets = useMemo(() => {
    const selected = clips.filter((clip) => {
      if (!selectedIdSet.has(clip.id) || !isEditorVideoClip(clip)) {
        return false;
      }
      return !clip.muted;
    });
    if (selected.length > 0) {
      return selected;
    }
    if (
      playheadClip &&
      isEditorVideoClip(playheadClip) &&
      !playheadClip.muted
    ) {
      return [playheadClip];
    }
    return [];
  }, [clips, playheadClip, selectedIdSet]);
  const canSeparateAudio = Boolean(
    menuClip && isEditorVideoClip(menuClip) && !menuClip.muted,
  );
  const removeBgTargets = useMemo(() => {
    const selected = clips.filter(
      (clip): clip is EditorVideoClip =>
        selectedIdSet.has(clip.id) && isEditorVideoClip(clip),
    );
    if (selected.length > 0) {
      return selected;
    }
    if (menuClip && isEditorVideoClip(menuClip)) {
      return [menuClip];
    }
    if (playheadClip && isEditorVideoClip(playheadClip)) {
      return [playheadClip];
    }
    return [];
  }, [clips, menuClip, playheadClip, selectedIdSet]);
  const canRemoveBg = Boolean(
    menuClip && isEditorVideoClip(menuClip) && removeBgTargets.length > 0,
  );
  const removeBgOn =
    removeBgTargets.length > 0 &&
    removeBgTargets.every((clip) => clip.removeBg === true);
  const returnTargets = useMemo(() => {
    const selected = clips.filter(
      (clip) =>
        selectedIdSet.has(clip.id) && clipHasReturnableAudio(clips, clip),
    );
    if (selected.length > 0) {
      return selected;
    }
    if (selectedIdSet.size > 0) {
      return [];
    }
    if (playheadClip && clipHasReturnableAudio(clips, playheadClip)) {
      return [playheadClip];
    }
    return [];
  }, [clips, playheadClip, selectedIdSet]);
  const canReturnAudio = returnTargets.length > 0;

  const mergeSelected = useCallback(() => {
    const group = getMergeableClips(clips, selectedIdSet);
    if (!group) {
      return;
    }
    const merged = mergeProjectClips(group);
    if (!merged) {
      return;
    }
    const remove = new Set(group.map((clip) => clip.id));
    const insertAt = clips.findIndex((clip) => clip.id === group[0]?.id);
    if (insertAt < 0) {
      return;
    }
    const next = [
      ...clips.slice(0, insertAt),
      merged,
      ...clips.slice(insertAt).filter((clip) => !remove.has(clip.id)),
    ];
    persist(next);
    setSelectedClipIds([merged.id]);
  }, [clips, persist, selectedIdSet, setSelectedClipIds]);

  const cutAtPlayhead = useCallback(() => {
    const clip = clipAtTimeAcrossLanes(lanes, currentTimeMs, selectedIdSet);
    if (!clip || !canCutAtTime([clip], currentTimeMs)) {
      return;
    }
    const offsetInClip = Math.round(currentTimeMs - clip.startMs);
    if (
      offsetInClip < EDITOR_CUT_MIN_MS ||
      clip.durationMs - offsetInClip < EDITOR_CUT_MIN_MS
    ) {
      return;
    }
    const sourceOffsetMs = clip.sourceOffsetMs ?? 0;
    const startMs = clip.laneStartMs ?? clip.startMs;
    const { startMs: _laidStart, ...projectClip } = clip;
    const left: EditorProjectClip = {
      ...projectClip,
      durationMs: offsetInClip,
      sourceOffsetMs,
      laneStartMs: startMs,
    };
    const {
      transitionKind: _transitionKind,
      blendMode: _blendMode,
      ...rightBase
    } = projectClip;
    const right: EditorProjectClip = {
      ...rightBase,
      id: newEditorClipId(),
      durationMs: clip.durationMs - offsetInClip,
      sourceOffsetMs: sourceOffsetMs + offsetInClip,
      laneStartMs: startMs + offsetInClip,
    };
    const index = clips.findIndex((item) => item.id === clip.id);
    if (index < 0) {
      return;
    }
    const next = [
      ...clips.slice(0, index),
      left,
      right,
      ...clips.slice(index + 1),
    ];
    persist(next);
    setSelectedClipIds([left.id, right.id]);
  }, [clips, currentTimeMs, lanes, persist, selectedIdSet, setSelectedClipIds]);

  const separateSelectedAudio = useCallback(() => {
    if (separateTargets.length === 0) {
      return;
    }
    const audioIds = separateAudio(separateTargets.map((clip) => clip.id));
    if (audioIds.length === 0) {
      return;
    }
    setSelectedClipIds(audioIds);
  }, [separateAudio, separateTargets, setSelectedClipIds]);

  const returnSelectedAudio = useCallback(() => {
    if (returnTargets.length === 0) {
      return;
    }
    const videoIds = returnAudio(returnTargets.map((clip) => clip.id));
    setSelectedClipIds(videoIds.length > 0 ? videoIds : []);
  }, [returnAudio, returnTargets, setSelectedClipIds]);

  const toggleSelectedRemoveBg = useCallback(() => {
    if (removeBgTargets.length === 0) {
      return;
    }
    const next = setClipsRemoveBg(
      clips,
      removeBgTargets.map((clip) => clip.id),
      !removeBgOn,
    );
    if (!next) {
      return;
    }
    persist(next);
  }, [clips, persist, removeBgOn, removeBgTargets]);

  const selectClip = useCallback(
    (clip: EditorClip, opts?: { toggle?: boolean }) => {
      if (opts?.toggle) {
        setSelectedClipIds((current) => {
          if (current.includes(clip.id)) {
            return current.filter((id) => id !== clip.id);
          }
          return [...current, clip.id];
        });
        return;
      }
      setSelectedClipIds([clip.id]);
    },
    [setSelectedClipIds],
  );

  const moveClip = useCallback(
    (args: { clipId: string; toLaneId: string; startMs: number }) => {
      const next = moveEditorClip({ clips, ...args });
      if (!next) {
        return;
      }
      persist(next);
    },
    [clips, persist],
  );

  const resizeClip = useCallback(
    (args: { clipId: string; edge: EditorClipEdge; edgeMs: number }) => {
      const next = resizeEditorClip({ clips, ...args });
      if (!next) {
        return;
      }
      persist(next);
    },
    [clips, persist],
  );

  const restoreClipEdge = useCallback(
    (args: { clipId: string; edge: EditorClipEdge }) => {
      const next = restoreEditorClipEdge({ clips, ...args });
      if (!next) {
        return;
      }
      persist(next);
    },
    [clips, persist],
  );

  const setTransition = useCallback(
    (clipIds: readonly string[], kind: EditorTransitionKind) => {
      const next = setClipsTransition(clips, clipIds, kind);
      if (!next) {
        return;
      }
      persist(next);
    },
    [clips, persist],
  );

  const setBlendMode = useCallback(
    (clipIds: readonly string[], blendMode: EditorBlendMode) => {
      const next = setClipsBlendMode(clips, clipIds, blendMode);
      if (!next) {
        return;
      }
      persist(next);
    },
    [clips, persist],
  );

  const playClickTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (playClickTimer.current != null) {
        window.clearTimeout(playClickTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    const doc = container?.ownerDocument ?? document;
    const onEditorHistoryKey = (event: globalThis.KeyboardEvent) => {
      const sidebar = excalidrawAPI?.getAppState().openSidebar;
      if (
        sidebar?.name !== DEFAULT_SIDEBAR.name ||
        sidebar.tab !== JAYRR_EDITOR_TAB
      ) {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }
      if (!event[KEYS.CTRL_OR_CMD] && !event.ctrlKey) {
        return;
      }
      const undoKey = matchKey(event, KEYS.Z) && !event.shiftKey;
      const redoKey =
        matchKey(event, KEYS.Y) || (matchKey(event, KEYS.Z) && event.shiftKey);
      if (undoKey) {
        if (!undo()) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (redoKey) {
        if (!redo()) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (selectedClipIds.length === 0) {
        return;
      }
      const bracketLeft = event.code === CODES.BRACKET_LEFT;
      const bracketRight = event.code === CODES.BRACKET_RIGHT;
      if (!bracketLeft && !bracketRight) {
        return;
      }
      const toEdge = isDarwin ? event.altKey : event.shiftKey;
      if (isDarwin && event.shiftKey) {
        return;
      }
      if (!isDarwin && event.altKey) {
        return;
      }
      let direction: EditorLayerDirection | null = null;
      if (bracketLeft && toEdge) {
        direction = "back";
      } else if (bracketRight && toEdge) {
        direction = "front";
      } else if (bracketLeft) {
        direction = "backward";
      } else if (bracketRight) {
        direction = "forward";
      }
      if (!direction) {
        return;
      }
      if (!moveSelectedByLayer(direction)) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    doc.defaultView?.addEventListener("keydown", onEditorHistoryKey, true);
    return () => {
      doc.defaultView?.removeEventListener("keydown", onEditorHistoryKey, true);
    };
  }, [
    container,
    excalidrawAPI,
    moveSelectedByLayer,
    redo,
    selectedClipIds.length,
    undo,
  ]);

  const onTransportClick = useCallback(
    (event: MouseEvent) => {
      if (event.detail >= 2) {
        if (playClickTimer.current != null) {
          window.clearTimeout(playClickTimer.current);
          playClickTimer.current = null;
        }
        stop();
        return;
      }
      playClickTimer.current = window.setTimeout(() => {
        playClickTimer.current = null;
        togglePlay();
      }, 280);
    },
    [stop, togglePlay],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    if (event.key !== " " && event.code !== "Space") {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    togglePlay();
  };

  return (
    <div
      className="layer-ui__library jayrr-library jayrr-editor-panel"
      onKeyDown={onKeyDown}
    >
      <div className="jayrr-library__header">
        {renamingProject ? (
          <input
            ref={projectNameInputRef}
            className="jayrr-library__rename-input"
            value={draftProjectName}
            maxLength={EDITOR_PROJECT_NAME_MAX}
            aria-label="Project name"
            placeholder={DEFAULT_EDITOR_PROJECT_NAME}
            onChange={(event) => setDraftProjectName(event.target.value)}
            onBlur={() => {
              void commitProjectName();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setRenamingProject(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="jayrr-library__title"
            title="Rename project"
            onClick={startRenameProject}
          >
            {projectName}
          </button>
        )}
        <div className="jayrr-editor-panel__header-actions">
          <button
            type="button"
            className="jayrr-editor-panel__export"
            disabled={!canQuery || clips.length === 0 || saveBusy || exportBusy}
            aria-label="Export video"
            title="Export video"
            onClick={() => setExportOpen(true)}
          >
            {ExportGlyph}
          </button>
          <button
            type="button"
            className="jayrr-editor-panel__save"
            disabled={!canQuery || clips.length === 0 || saveBusy || exportBusy}
            aria-label="Save project"
            title="Save project"
            onClick={() => setSaveOpen(true)}
          >
            {SaveGlyph}
          </button>
          <EditorSettingsPopover
            container={container}
            canLinkSelected={Boolean(selectedLinkable)}
            hasPreview={Boolean(previewElementId)}
            previewElementId={previewElementId}
            onPlace={placePreview}
            onLinkSelected={linkSelected}
            onClear={clearPreviewLink}
            onFocus={focusPreview}
          />
        </div>
      </div>
      <div className="jayrr-editor-panel__body">
        <div className="jayrr-editor-panel__transport">
          {!disabled ? (
            <FilledButton
              color="primary"
              variant="icon"
              label={
                playing
                  ? "Pause. Double-click to reset"
                  : "Play. Double-click to reset"
              }
              icon={playing ? PauseGlyph : PlayGlyph}
              onClick={onTransportClick}
            />
          ) : null}
          <span className="jayrr-editor-panel__clock">
            {formatEditorClock(currentTimeMs)} /{" "}
            {formatEditorClock(timeline.totalMs)}
          </span>
          <div
            className="jayrr-editor-panel__zoom"
            role="group"
            aria-label="Zoom"
          >
            <button
              type="button"
              className={`jayrr-editor-panel__zoom-btn${
                zoomMode === "fit" ? " is-active" : ""
              }`}
              onClick={() => setZoomMode("fit")}
            >
              Fit
            </button>
            <ContextMenu.Root modal={false}>
              <ContextMenu.Trigger asChild>
                <button
                  type="button"
                  className={`jayrr-editor-panel__zoom-btn${
                    zoomMode === "fixed" ? " is-active" : ""
                  }`}
                  title="Right-click to choose scale"
                  onClick={() => setZoomMode("fixed")}
                >
                  {pxPerSecond}px/s
                </button>
              </ContextMenu.Trigger>
              <ContextMenu.Portal container={container}>
                <ContextMenu.Content
                  className="jayrr-editor-menu"
                  collisionPadding={8}
                  data-prevent-outside-click
                  style={{ maxHeight: "none" }}
                >
                  {EDITOR_PX_PER_SECOND_OPTIONS.map((option) => {
                    const selected = option === pxPerSecond;
                    return (
                      <ContextMenu.Item
                        key={option}
                        className={`jayrr-editor-menu__item${
                          selected ? " is-active" : ""
                        }`}
                        onSelect={() => {
                          setPxPerSecond(option);
                          setZoomMode("fixed");
                        }}
                      >
                        <span>{option}px/s</span>
                        <span className="jayrr-editor-menu__check" aria-hidden>
                          {selected ? checkIcon : null}
                        </span>
                      </ContextMenu.Item>
                    );
                  })}
                </ContextMenu.Content>
              </ContextMenu.Portal>
            </ContextMenu.Root>
          </div>
        </div>

        <ContextMenu.Root
          modal={false}
          onOpenChange={(open) => {
            if (!open) {
              setMenuClipId(null);
            }
          }}
        >
          <ContextMenu.Trigger asChild>
            <div
              className="jayrr-editor-panel__timeline-wrap"
              onContextMenu={(event) => {
                const target = event.target;
                if (!(target instanceof Element)) {
                  setMenuClipId(null);
                  return;
                }
                const clipNode = target.closest(".jayrr-editor-clip");
                const clipId = clipNode?.getAttribute("data-clip-id");
                if (!clipId) {
                  setMenuClipId(null);
                  return;
                }
                setMenuClipId(clipId);
                setSelectedClipIds((current) => {
                  if (current.includes(clipId)) {
                    return current;
                  }
                  return [clipId];
                });
              }}
            >
              <JayrrEditorTimeline
                timeline={timeline}
                currentTimeMs={currentTimeMs}
                selectedClipIds={selectedIdSet}
                playheadClipId={playheadClipId}
                zoomMode={zoomMode}
                pxPerSecond={pxPerSecond}
                stackLaneIds={stackLaneIds}
                onSeek={seek}
                onSelectClip={selectClip}
                onMoveClip={moveClip}
                onResizeClip={resizeClip}
                onRestoreClipEdge={restoreClipEdge}
                onSetTransition={setTransition}
                onOpenBlend={(args) => {
                  window.setTimeout(() => setBlendPicker(args), 0);
                }}
                overlapLayerMoves={overlapLayerMoves}
                onReorderOverlap={reorderOverlap}
                onAddStackLane={addStackLane}
                onRemoveStackLane={removeStackLane}
                menuContainer={container}
                emptyAction={
                  <FilledButton
                    color="primary"
                    label="Add recording"
                    onClick={() => setAddRecordingOpen(true)}
                  >
                    Add recording
                  </FilledButton>
                }
              />
            </div>
          </ContextMenu.Trigger>
          <ContextMenu.Portal container={container}>
            <ContextMenu.Content
              className="jayrr-editor-menu"
              collisionPadding={8}
              data-prevent-outside-click
              style={{ maxHeight: "none" }}
            >
              {menuOnClip || selectedClipIds.length > 0 ? (
                <>
                  <ContextMenu.Group className="jayrr-editor-menu__header">
                    {menuOnClip
                      ? LAYER_MOVE_ACTIONS.map((action) => (
                          <ContextMenu.Item
                            key={action.direction}
                            className="jayrr-editor-menu__icon"
                            disabled={!layerMoves[action.direction]}
                            title={action.label}
                            aria-label={action.label}
                            onSelect={() =>
                              moveSelectedByLayer(action.direction)
                            }
                          >
                            {action.icon}
                          </ContextMenu.Item>
                        ))
                      : null}
                    {selectedClipIds.length > 0 ? (
                      <ContextMenu.Item
                        className="jayrr-editor-menu__icon jayrr-editor-menu__icon--danger"
                        title="Remove"
                        aria-label="Remove"
                        onSelect={removeSelected}
                      >
                        {TrashIcon}
                      </ContextMenu.Item>
                    ) : null}
                  </ContextMenu.Group>
                  <ContextMenu.Separator className="jayrr-editor-menu__separator" />
                </>
              ) : null}
              {canCut ? (
                <ContextMenu.Item
                  className="jayrr-editor-menu__item"
                  onSelect={cutAtPlayhead}
                >
                  Cut
                </ContextMenu.Item>
              ) : null}
              <ContextMenu.Item
                className="jayrr-editor-menu__item"
                onSelect={() => setAddRecordingOpen(true)}
              >
                Add recording
              </ContextMenu.Item>
              <ContextMenu.Item
                className="jayrr-editor-menu__item"
                onSelect={() => setAddSoundOpen(true)}
              >
                Add sound
              </ContextMenu.Item>
              <ContextMenu.Item
                className="jayrr-editor-menu__item"
                onSelect={() => setAddStockOpen(true)}
              >
                Add stock
              </ContextMenu.Item>
              <ContextMenu.Item
                className="jayrr-editor-menu__item"
                onSelect={() => setAddImageOpen(true)}
              >
                Add image
              </ContextMenu.Item>
              <ContextMenu.Item
                className="jayrr-editor-menu__item"
                onSelect={() => setAiOpen(true)}
              >
                Add AI Clip
              </ContextMenu.Item>
              {canSeparateAudio ? (
                <ContextMenu.Item
                  className="jayrr-editor-menu__item"
                  onSelect={separateSelectedAudio}
                >
                  Separate Audio
                </ContextMenu.Item>
              ) : null}
              {canReturnAudio ? (
                <ContextMenu.Item
                  className="jayrr-editor-menu__item"
                  onSelect={returnSelectedAudio}
                >
                  Return Audio
                </ContextMenu.Item>
              ) : null}
              {canRemoveBg ? (
                <ContextMenu.Item
                  className="jayrr-editor-menu__item"
                  onSelect={toggleSelectedRemoveBg}
                >
                  {removeBgOn ? "Keep BG" : "Remove BG"}
                </ContextMenu.Item>
              ) : null}
              {canMerge ? (
                <ContextMenu.Item
                  className="jayrr-editor-menu__item"
                  onSelect={mergeSelected}
                >
                  Merge
                </ContextMenu.Item>
              ) : null}
            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      </div>
      {exportOpen ? (
        <JayrrEditorExportDialog
          canQuery={canQuery}
          exporting={exportBusy}
          onClose={() => {
            if (!exportBusy) {
              setExportOpen(false);
            }
          }}
          onExport={async ({ name, folderId }) => {
            setExportBusy(true);
            try {
              let previewId = previewElementId;
              if (!previewId) {
                previewId = placePreview();
              }
              if (!previewId) {
                throw new Error("Place an editor preview on the canvas first.");
              }
              const ownerDocument = container?.ownerDocument ?? document;
              const exported = await exportEditorTimeline({
                previewElementId: previewId,
                ownerDocument,
                durationMs: timeline.totalMs,
                getTimeMs: () => currentTimeMsRef.current,
                play,
                stop,
                seek,
              });
              await uploadPresentRecording(
                exported.blob,
                exported.durationMs,
                exported.width,
                exported.height,
                { name, folderId },
              );
              persistDocsView("record");
              appJotaiStore.set(docsViewAtom, "record");
              setExportOpen(false);
              excalidrawAPI?.setToast({
                message: "Video exported.",
                closable: true,
              });
              excalidrawAPI?.updateScene({
                appState: {
                  openSidebar: {
                    name: DEFAULT_SIDEBAR.name,
                    tab: JAYRR_RECORDINGS_TAB,
                  },
                },
              });
            } catch (error) {
              excalidrawAPI?.setToast({
                message:
                  error instanceof Error
                    ? error.message
                    : "Could not export video.",
                closable: true,
              });
            } finally {
              setExportBusy(false);
            }
          }}
        />
      ) : null}
      {saveOpen ? (
        <JayrrEditorSaveProjectDialog
          canQuery={canQuery}
          defaultName={saveDefaultName}
          saving={saveBusy}
          onClose={() => {
            if (!saveBusy) {
              setSaveOpen(false);
            }
          }}
          onSave={async ({ name, folderId }) => {
            setSaveBusy(true);
            try {
              const projectId = await saveProject({
                name,
                folderId: folderId ?? undefined,
                clipsJson: JSON.stringify(clipsToStoredEditor(clips)),
                stackLanesJson: JSON.stringify(stackLaneIds),
                stateJson: serializeEditorView(snapshotView()),
                durationMs: timeline.totalMs,
                clipCount: clips.length,
              });
              markProjectSaved(projectId, name);
              persistDocsView("project");
              appJotaiStore.set(docsViewAtom, "project");
              setSaveOpen(false);
              excalidrawAPI?.setToast({
                message: "Project saved.",
                closable: true,
              });
              excalidrawAPI?.updateScene({
                appState: {
                  openSidebar: {
                    name: DEFAULT_SIDEBAR.name,
                    tab: JAYRR_RECORDINGS_TAB,
                  },
                },
              });
            } catch (error) {
              excalidrawAPI?.setToast({
                message:
                  error instanceof Error
                    ? error.message
                    : "Could not save project.",
                closable: true,
              });
            } finally {
              setSaveBusy(false);
            }
          }}
        />
      ) : null}
      {addRecordingOpen ? (
        <JayrrEditorAddRecordingDialog
          canQuery={canQuery}
          onClose={() => setAddRecordingOpen(false)}
          onPick={(row) => {
            const clipId = addRecording(row);
            setSelectedClipIds([clipId]);
            setAddRecordingOpen(false);
          }}
        />
      ) : null}
      {addStockOpen ? (
        <JayrrEditorAddStockDialog
          canQuery={canQuery}
          onClose={() => setAddStockOpen(false)}
          onPick={(row) => {
            const clipId = addRecording(row);
            setSelectedClipIds([clipId]);
            setAddStockOpen(false);
          }}
        />
      ) : null}
      {addImageOpen ? (
        <JayrrEditorAddImageDialog
          canQuery={canQuery}
          onClose={() => setAddImageOpen(false)}
          onPick={(row) => {
            const clipId = addStaticClip(row);
            setSelectedClipIds([clipId]);
            setAddImageOpen(false);
          }}
        />
      ) : null}
      {aiOpen ? <JayrrEditorAiDialog onClose={() => setAiOpen(false)} /> : null}
      {addSoundOpen ? (
        <JayrrSoundLibraryDialog
          onClose={() => setAddSoundOpen(false)}
          onSelect={(row) => {
            if (!row) {
              return;
            }
            const clipId = addSound(row);
            setSelectedClipIds([clipId]);
            setAddSoundOpen(false);
          }}
        />
      ) : null}
      {blendPicker ? (
        <JayrrEditorBlendModeDialog
          value={blendPicker.blendMode}
          onClose={() => setBlendPicker(null)}
          onPick={(mode) => {
            setBlendMode(blendPicker.clipIds, mode);
            setBlendPicker(null);
          }}
        />
      ) : null}
    </div>
  );
};

const EditorSettingsPopover = ({
  container,
  canLinkSelected,
  hasPreview,
  previewElementId,
  onPlace,
  onLinkSelected,
  onClear,
  onFocus,
}: {
  container: HTMLDivElement | null;
  canLinkSelected: boolean;
  hasPreview: boolean;
  previewElementId: string | null;
  onPlace: () => void | string | null;
  onLinkSelected: () => void;
  onClear: () => void;
  onFocus: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const extraVideo =
    previewElementId && container
      ? findEditorTargetVideo(previewElementId, container.ownerDocument)
      : null;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="jayrr-editor-panel__settings"
          aria-label="Video editor settings"
          aria-expanded={open}
        >
          {settingsIcon}
        </button>
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={8}
          collisionBoundary={container ?? undefined}
          data-prevent-outside-click
          className="jayrr-editor-panel__settings-popover"
        >
          <Island padding={2}>
            <div className="jayrr-editor-panel__settings-head">
              <h3 className="jayrr-editor-panel__settings-title">Settings</h3>
              <Tooltip label={SETTINGS_INFO} long position="top">
                <span className="jayrr-editor-panel__settings-info">
                  {helpIcon}
                </span>
              </Tooltip>
            </div>
            <p className="visually-hidden">{SETTINGS_INFO}</p>
            <div className="jayrr-editor-panel__settings-volume-row">
              <span className="jayrr-editor-panel__settings-volume-label">
                Preview volume
              </span>
              <JayrrEditorVolumeControl
                className="jayrr-editor-panel__settings-volume"
                buttonClassName="jayrr-editor-panel__settings-volume-btn"
                sliderClassName="jayrr-editor-panel__settings-volume-slider"
                extraVideo={extraVideo}
              />
            </div>
            <div className="jayrr-editor-panel__settings-actions">
              <FilledButton
                color="primary"
                label="Place preview on canvas"
                onClick={() => {
                  onPlace();
                  setOpen(false);
                }}
                fullWidth
              >
                Place preview on canvas
              </FilledButton>
              {canLinkSelected ? (
                <FilledButton
                  color="muted"
                  variant="outlined"
                  label="Link selected object"
                  onClick={() => {
                    onLinkSelected();
                    setOpen(false);
                  }}
                  fullWidth
                >
                  Link selected object
                </FilledButton>
              ) : null}
              {hasPreview ? (
                <>
                  <FilledButton
                    color="muted"
                    variant="outlined"
                    label="Show preview"
                    onClick={() => {
                      onFocus();
                      setOpen(false);
                    }}
                    fullWidth
                  >
                    Show preview
                  </FilledButton>
                  <FilledButton
                    color="danger"
                    variant="outlined"
                    label="Unlink preview"
                    onClick={() => {
                      onClear();
                      setOpen(false);
                    }}
                    fullWidth
                  >
                    Unlink preview
                  </FilledButton>
                </>
              ) : null}
            </div>
          </Island>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
