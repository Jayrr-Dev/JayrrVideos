import {
  helpIcon,
  settingsIcon,
} from "@excalidraw/excalidraw/components/icons";
import { ContextMenu, Popover } from "radix-ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";

import { FilledButton, Island, Tooltip } from "../../components/ui/editor";

import "../../components/ui/JayrrLibraryMenu.scss";

import {
  canCutAtTime,
  clipAtTimeAcrossLanes,
  EDITOR_CLIP_TYPE,
  EDITOR_CUT_MIN_MS,
  editorLanes,
  formatEditorClock,
  getMergeableClips,
  mergeProjectClips,
  moveEditorClip,
  newEditorClipId,
  setClipsBlendMode,
  setClipsTransition,
  type EditorBlendMode,
  type EditorClip,
  type EditorProjectClip,
  type EditorTransitionKind,
} from "./buildEditorTimeline";
import { findEditorTargetVideo } from "./editorPreviewModel";
import { JayrrEditorAddRecordingDialog } from "./JayrrEditorAddRecordingDialog";
import { JayrrEditorBlendModeDialog } from "./JayrrEditorBlendModeDialog";
import { useJayrrEditorSession } from "./JayrrEditorSession";
import { JayrrEditorTimeline } from "./JayrrEditorTimeline";
import { JayrrEditorVolumeControl } from "./JayrrEditorVolumeControl";

import "./JayrrEditorPanel.scss";

export const JAYRR_EDITOR_TAB = "jayrrEditor";

const SETTINGS_INFO =
  "Place or link a canvas box for timeline playback. Volume here is the preview loudness.";

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

export const JayrrEditorPanel = () => {
  const {
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
  } = useJayrrEditorSession();

  const [zoomMode, setZoomMode] = useState<"fit" | "fixed">("fit");
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [addRecordingOpen, setAddRecordingOpen] = useState(false);
  const [blendPicker, setBlendPicker] = useState<{
    clipIds: readonly string[];
    blendMode: EditorBlendMode;
  } | null>(null);

  const selectedIdSet = useMemo(
    () => new Set(selectedClipIds),
    [selectedClipIds],
  );

  useEffect(() => {
    const alive = new Set(clips.map((clip) => clip.id));
    setSelectedClipIds((current) => {
      const next = current.filter((id) => alive.has(id));
      return next.length === current.length ? current : next;
    });
  }, [clips]);

  const lanes = useMemo(
    () => editorLanes(timeline, stackLaneIds),
    [stackLaneIds, timeline],
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
  }, [clips, persist, selectedClipIds, stop]);

  const canCut = playheadClip
    ? canCutAtTime([playheadClip], currentTimeMs)
    : false;
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
    const left: EditorProjectClip = {
      id: clip.id,
      type: EDITOR_CLIP_TYPE,
      recordingId: clip.recordingId,
      url: clip.url,
      posterUrl: clip.posterUrl,
      label: clip.label,
      durationMs: offsetInClip,
      sourceOffsetMs,
      laneId: clip.laneId,
      laneStartMs: startMs,
      ...(clip.transitionKind ? { transitionKind: clip.transitionKind } : {}),
      ...(clip.blendMode ? { blendMode: clip.blendMode } : {}),
    };
    const right: EditorProjectClip = {
      id: newEditorClipId(),
      type: EDITOR_CLIP_TYPE,
      recordingId: clip.recordingId,
      url: clip.url,
      posterUrl: clip.posterUrl,
      label: clip.label,
      durationMs: clip.durationMs - offsetInClip,
      sourceOffsetMs: sourceOffsetMs + offsetInClip,
      laneId: clip.laneId,
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
  }, [clips, currentTimeMs, lanes, persist, selectedIdSet]);

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
          {timeline.sequence.length > 0 || timeline.overlays.length > 0 ? (
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
                stackLaneIds={stackLaneIds}
                onSeek={seek}
                onSelectClip={selectClip}
                onMoveClip={moveClip}
                onSetTransition={setTransition}
                onOpenBlend={(args) => {
                  window.setTimeout(() => setBlendPicker(args), 0);
                }}
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
          onClose={() => setAddRecordingOpen(false)}
          onPick={(row) => {
            const clipId = addRecording(row);
            setSelectedClipIds([clipId]);
            setAddRecordingOpen(false);
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
