import { CaptureUpdateAction, useExcalidrawAPI } from "@excalidraw/excalidraw";
import { useExcalidrawContainer } from "@excalidraw/excalidraw/components/App";
import {
  helpIcon,
  settingsIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useConvexAuth, useQuery } from "convex/react";
import { ContextMenu, Popover } from "radix-ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { FilledButton, Island, Tooltip } from "../../components/ui/editor";
import { api, isConvexLinked } from "../../convexClient";

import "../../components/ui/JayrrLibraryMenu.scss";

import {
  buildEditorTimeline,
  canCutAtTime,
  EDITOR_CUT_MIN_MS,
  formatEditorClock,
  getMergeableClips,
  mergeProjectClips,
  newEditorClipId,
  type EditorClip,
  type EditorProjectClip,
} from "./buildEditorTimeline";
import { publishEditorPlayback } from "./editorPlaybackBridge";
import {
  findEditorTargetVideo,
  isJayrrEditorPreviewElement,
} from "./editorPreviewModel";
import { insertEditorPreview } from "./insertEditorPreview";
import {
  JayrrEditorAddRecordingDialog,
  type EditorRecordingPick,
} from "./JayrrEditorAddRecordingDialog";
import { JayrrEditorTimeline } from "./JayrrEditorTimeline";
import { JayrrEditorVolumeControl } from "./JayrrEditorVolumeControl";
import { useEditorPlayback } from "./useEditorPlayback";

import "./JayrrEditorPanel.scss";

import type { Id } from "../../../convex/_generated/dataModel";

export const JAYRR_EDITOR_TAB = "jayrrEditor";

const SETTINGS_INFO =
  "Place or link a canvas box for timeline playback. Volume here is the preview loudness.";

const PREVIEW_ID_KEY = "jayrr-editor-preview-element-v1";
const STORAGE_KEY = "jayrr-editor-recording-clips-v1";

type StoredClip = {
  id: string;
  recordingId: string;
  durationMs?: number;
  sourceOffsetMs?: number;
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
        out.push({
          id: Reflect.get(item, "id") as string,
          recordingId: Reflect.get(item, "recordingId") as string,
          ...(typeof durationRaw === "number" && Number.isFinite(durationRaw)
            ? { durationMs: Math.max(1, Math.round(durationRaw)) }
            : {}),
          ...(typeof offsetRaw === "number" && Number.isFinite(offsetRaw)
            ? { sourceOffsetMs: Math.max(0, Math.round(offsetRaw)) }
            : {}),
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
    recordingId: clip.recordingId,
    durationMs: clip.durationMs,
    sourceOffsetMs: clip.sourceOffsetMs ?? 0,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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

export const JayrrEditorPanel = () => {
  const apiExcal = useExcalidrawAPI();
  const { container } = useExcalidrawContainer();
  const ownerDocument = container?.ownerDocument ?? document;
  const { isAuthenticated } = useConvexAuth();
  const canQuery = isConvexLinked && isAuthenticated;
  const recordings = useQuery(
    api.presentRecordings.listRecent,
    canQuery ? { limit: 40 } : "skip",
  );

  const [zoomMode, setZoomMode] = useState<"fit" | "fixed">("fit");
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [clips, setClips] = useState<EditorProjectClip[]>([]);
  const [addRecordingOpen, setAddRecordingOpen] = useState(false);
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

  // Drop link if the canvas element was deleted.
  useEffect(() => {
    if (!apiExcal || !previewElementId) {
      return;
    }
    const exists = apiExcal
      .getSceneElements()
      .some((element) => element.id === previewElementId);
    if (!exists) {
      setPreviewElementId(null);
      writeStoredPreviewId(null);
    }
  }, [apiExcal, previewElementId, selectedElementIds]);

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
        recordingId: row._id,
        url: row.url,
        posterUrl: row.posterUrl,
        label: row.name?.trim() || "Recording",
        durationMs: Math.max(
          1,
          Math.min(maxDuration, item.durationMs ?? maxDuration),
        ),
        sourceOffsetMs,
      });
    }
    if (restored.length > 0) {
      setClips(restored);
    }
  }, [recordings]);

  const timeline = useMemo(() => buildEditorTimeline(clips), [clips]);
  const { currentTimeMs, playing, play, pause, stop, seek, togglePlay } =
    useEditorPlayback({
      timeline,
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

  const selectedIdSet = useMemo(
    () => new Set(selectedClipIds),
    [selectedClipIds],
  );

  // Drop selection for clips that no longer exist.
  useEffect(() => {
    const alive = new Set(clips.map((clip) => clip.id));
    setSelectedClipIds((current) => {
      const next = current.filter((id) => alive.has(id));
      return next.length === current.length ? current : next;
    });
  }, [clips]);

  const disabled = timeline.sequence.length === 0 || !previewElementId;
  const playheadClipId =
    timeline.sequence.find(
      (clip) =>
        currentTimeMs >= clip.startMs &&
        currentTimeMs < clip.startMs + clip.durationMs,
    )?.id ?? null;

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

  const persist = useCallback((next: EditorProjectClip[]) => {
    setClips(next);
    writeStoredClips(next);
  }, []);

  const linkPreview = useCallback((id: string) => {
    setPreviewElementId(id);
    writeStoredPreviewId(id);
  }, []);

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
      const next: EditorProjectClip = {
        id: newEditorClipId(),
        recordingId: row._id,
        url: row.url,
        posterUrl: row.posterUrl,
        label: row.name?.trim() || "Recording",
        durationMs: Math.max(1, row.durationMs),
      };
      persist([...clips, next]);
      setSelectedClipIds([next.id]);
    },
    [clips, persist],
  );

  const removeSelected = useCallback(() => {
    if (selectedClipIds.length === 0) {
      return;
    }
    const remove = new Set(selectedClipIds);
    const next = clips.filter((clip) => !remove.has(clip.id));
    persist(next);
    setSelectedClipIds([]);
    stop();
  }, [clips, persist, selectedClipIds, stop]);

  const canCut = canCutAtTime(timeline.sequence, currentTimeMs);
  const mergeable = useMemo(
    () => getMergeableClips(clips, selectedIdSet),
    [clips, selectedIdSet],
  );
  const canMerge = Boolean(mergeable);

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
  }, [clips, persist, selectedIdSet]);

  const cutAtPlayhead = useCallback(() => {
    if (!canCutAtTime(timeline.sequence, currentTimeMs)) {
      return;
    }
    const clip = timeline.sequence.find(
      (item) =>
        currentTimeMs >= item.startMs &&
        currentTimeMs < item.startMs + item.durationMs,
    );
    if (!clip) {
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
    const left: EditorProjectClip = {
      id: clip.id,
      recordingId: clip.recordingId,
      url: clip.url,
      posterUrl: clip.posterUrl,
      label: clip.label,
      durationMs: offsetInClip,
      sourceOffsetMs,
    };
    const right: EditorProjectClip = {
      id: newEditorClipId(),
      recordingId: clip.recordingId,
      url: clip.url,
      posterUrl: clip.posterUrl,
      label: clip.label,
      durationMs: clip.durationMs - offsetInClip,
      sourceOffsetMs: sourceOffsetMs + offsetInClip,
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
  }, [clips, currentTimeMs, persist, timeline.sequence]);

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
    [],
  );

  const reorderClips = useCallback(
    (orderedIds: readonly string[]) => {
      const byId = new Map(clips.map((clip) => [clip.id, clip]));
      const next: EditorProjectClip[] = [];
      for (const id of orderedIds) {
        const clip = byId.get(id);
        if (clip) {
          next.push(clip);
        }
      }
      if (next.length !== clips.length) {
        return;
      }
      persist(next);
    },
    [clips, persist],
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
        <div className="jayrr-library__title">Video editor</div>
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
      <div className="jayrr-editor-panel__body">
        <div className="jayrr-editor-panel__transport">
          {!disabled ? (
            <FilledButton
              color="primary"
              label={playing ? "Pause" : "Play"}
              onClick={() => (playing ? pause() : play())}
            >
              {playing ? "Pause" : "Play"}
            </FilledButton>
          ) : null}
          {timeline.sequence.length > 0 ? (
            <FilledButton
              color="muted"
              variant="outlined"
              label="Stop"
              onClick={stop}
            >
              Stop
            </FilledButton>
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
            <button
              type="button"
              className={`jayrr-editor-panel__zoom-btn${
                zoomMode === "fixed" ? " is-active" : ""
              }`}
              onClick={() => setZoomMode("fixed")}
            >
              40px/s
            </button>
          </div>
        </div>

        <ContextMenu.Root modal={false}>
          <ContextMenu.Trigger asChild>
            <div className="jayrr-editor-panel__timeline-wrap">
              <JayrrEditorTimeline
                timeline={timeline}
                currentTimeMs={currentTimeMs}
                selectedClipIds={selectedIdSet}
                playheadClipId={playheadClipId}
                zoomMode={zoomMode}
                onSeek={seek}
                onSelectClip={selectClip}
                onReorderClips={reorderClips}
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
            >
              <ContextMenu.Item
                className="jayrr-editor-menu__item"
                onSelect={() => setAddRecordingOpen(true)}
              >
                Add recording
              </ContextMenu.Item>
              {canCut ? (
                <ContextMenu.Item
                  className="jayrr-editor-menu__item"
                  onSelect={cutAtPlayhead}
                >
                  Cut
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
              {selectedClipIds.length > 0 ? (
                <ContextMenu.Item
                  className="jayrr-editor-menu__item jayrr-editor-menu__item--danger"
                  onSelect={removeSelected}
                >
                  Remove
                </ContextMenu.Item>
              ) : null}
            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      </div>
      {addRecordingOpen ? (
        <JayrrEditorAddRecordingDialog
          canQuery={canQuery}
          recordings={recordings}
          onClose={() => setAddRecordingOpen(false)}
          onPick={(row) => {
            addRecording(row);
            setAddRecordingOpen(false);
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
  onPlace: () => void;
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
