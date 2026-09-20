import { helpIcon } from "@excalidraw/excalidraw/components/icons";
import { useConvexAuth, useQuery } from "convex/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { api, isConvexLinked } from "../../convexClient";
import { FilledButton, Tooltip } from "../../components/ui/editor";
import { formatRecordingClock } from "../recordings/formatRecording";

import type { Id } from "../../../../convex/_generated/dataModel";

import {
  buildEditorTimeline,
  formatEditorClock,
  newEditorClipId,
  type EditorClip,
  type EditorProjectClip,
} from "./buildEditorTimeline";
import { JayrrEditorTimeline } from "./JayrrEditorTimeline";
import { useEditorPlayback } from "./useEditorPlayback";

import "../../components/ui/JayrrLibraryMenu.scss";
import "./JayrrEditorPanel.scss";

export const JAYRR_EDITOR_TAB = "jayrrEditor";

const EDITOR_INFO =
  "Assemble a vertical timeline from your Recordings. Pick clips to stack top to bottom. Play previews the cut in the panel above the timeline.";

const STORAGE_KEY = "jayrr-editor-recording-clips-v1";

type StoredClip = {
  id: string;
  recordingId: string;
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
        out.push({
          id: Reflect.get(item, "id") as string,
          recordingId: Reflect.get(item, "recordingId") as string,
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
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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

type RecordingRow = {
  _id: Id<"presentRecordings">;
  url: string;
  posterUrl: string | null;
  durationMs: number;
  name: string | null;
  createdAt: number;
};

export const JayrrEditorPanel = () => {
  const { isAuthenticated } = useConvexAuth();
  const canQuery = isConvexLinked && isAuthenticated;
  const recordings = useQuery(
    api.presentRecordings.listRecent,
    canQuery ? { limit: 40 } : "skip",
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [zoomMode, setZoomMode] = useState<"fit" | "fixed">("fit");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [clips, setClips] = useState<EditorProjectClip[]>([]);
  const hydratedRef = useRef(false);

  // Restore order from localStorage once recordings load.
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
      restored.push({
        id: item.id,
        recordingId: row._id,
        url: row.url,
        posterUrl: row.posterUrl,
        label: row.name?.trim() || "Recording",
        durationMs: row.durationMs,
      });
    }
    if (restored.length > 0) {
      setClips(restored);
    }
  }, [recordings]);

  const timeline = useMemo(() => buildEditorTimeline(clips), [clips]);
  const { currentTimeMs, playing, play, pause, stop, seek, togglePlay } =
    useEditorPlayback({ timeline, videoRef });

  const disabled = timeline.sequence.length === 0;
  const activeClipId =
    selectedClipId ??
    timeline.sequence.find(
      (clip) =>
        currentTimeMs >= clip.startMs &&
        currentTimeMs < clip.startMs + clip.durationMs,
    )?.id ??
    null;

  const persist = useCallback((next: EditorProjectClip[]) => {
    setClips(next);
    writeStoredClips(next);
  }, []);

  const addRecording = useCallback(
    (row: RecordingRow) => {
      const next: EditorProjectClip = {
        id: newEditorClipId(),
        recordingId: row._id,
        url: row.url,
        posterUrl: row.posterUrl,
        label: row.name?.trim() || "Recording",
        durationMs: Math.max(1, row.durationMs),
      };
      persist([...clips, next]);
      setSelectedClipId(next.id);
      setPickerOpen(false);
    },
    [clips, persist],
  );

  const removeSelected = useCallback(() => {
    if (!selectedClipId) {
      return;
    }
    const next = clips.filter((clip) => clip.id !== selectedClipId);
    persist(next);
    setSelectedClipId(null);
    stop();
  }, [clips, persist, selectedClipId, stop]);

  const selectClip = useCallback((clip: EditorClip) => {
    setSelectedClipId(clip.id);
  }, []);

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
        <Tooltip label={EDITOR_INFO} long>
          <span className="jayrr-editor-panel__info" aria-label="More info">
            {helpIcon}
          </span>
        </Tooltip>
        <span className="visually-hidden">{EDITOR_INFO}</span>
      </div>
      <div className="jayrr-editor-panel__body">
        <div className="jayrr-editor-panel__preview">
          <video
            ref={videoRef}
            className="jayrr-editor-panel__video"
            playsInline
            preload="metadata"
            poster={
              timeline.sequence.find((c) => c.id === activeClipId)?.posterUrl ??
              undefined
            }
          />
          {timeline.sequence.length === 0 ? (
            <p className="jayrr-editor-panel__preview-empty">
              Pick a recording to start the timeline.
            </p>
          ) : null}
        </div>

        <div className="jayrr-editor-panel__transport">
          <FilledButton
            color="primary"
            label={playing ? "Pause" : "Play"}
            onClick={() => (playing ? pause() : play())}
            disabled={disabled}
          >
            {playing ? "Pause" : "Play"}
          </FilledButton>
          <FilledButton
            color="muted"
            variant="outlined"
            label="Stop"
            onClick={stop}
            disabled={disabled}
          >
            Stop
          </FilledButton>
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

        <div className="jayrr-editor-panel__actions">
          <FilledButton
            color="muted"
            variant="outlined"
            label="Add recording"
            onClick={() => setPickerOpen((open) => !open)}
            disabled={!canQuery}
          >
            {pickerOpen ? "Hide library" : "Add recording"}
          </FilledButton>
          <FilledButton
            color="danger"
            variant="outlined"
            label="Remove clip"
            onClick={removeSelected}
            disabled={!selectedClipId}
          >
            Remove
          </FilledButton>
        </div>

        {pickerOpen ? (
          <RecordingPicker
            recordings={recordings}
            canQuery={canQuery}
            onPick={addRecording}
          />
        ) : null}

        {timeline.sequence.length === 0 && !pickerOpen ? (
          <p className="jayrr-editor-panel__empty">
            {canQuery
              ? "Add a recording from your library to build the timeline."
              : "Sign in to pick recordings for the timeline."}
          </p>
        ) : timeline.sequence.length > 0 ? (
          <JayrrEditorTimeline
            timeline={timeline}
            currentTimeMs={currentTimeMs}
            activeClipId={activeClipId}
            zoomMode={zoomMode}
            onSeek={seek}
            onSelectClip={selectClip}
          />
        ) : null}
      </div>
    </div>
  );
};

const RecordingPicker = ({
  recordings,
  canQuery,
  onPick,
}: {
  recordings: RecordingRow[] | undefined;
  canQuery: boolean;
  onPick: (row: RecordingRow) => void;
}) => {
  if (!canQuery) {
    return (
      <p className="jayrr-editor-panel__empty">Sign in to browse recordings.</p>
    );
  }
  if (recordings === undefined) {
    return <p className="jayrr-editor-panel__empty">Loading recordings…</p>;
  }
  if (recordings.length === 0) {
    return (
      <p className="jayrr-editor-panel__empty">
        No recordings yet. Record from the Present tab first.
      </p>
    );
  }
  return (
    <ul className="jayrr-editor-picker" aria-label="Pick a recording">
      {recordings.map((row) => {
        const title = row.name?.trim() || "Recording";
        const clock = formatRecordingClock(row.durationMs);
        return (
          <li key={row._id}>
            <button
              type="button"
              className="jayrr-editor-picker__item"
              onClick={() => onPick(row)}
            >
              {row.posterUrl ? (
                <img
                  className="jayrr-editor-picker__thumb"
                  src={row.posterUrl}
                  alt=""
                />
              ) : (
                <span className="jayrr-editor-picker__thumb jayrr-editor-picker__thumb--empty" />
              )}
              <span className="jayrr-editor-picker__meta">
                <span className="jayrr-editor-picker__name">{title}</span>
                <span className="jayrr-editor-picker__clock">{clock}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};
