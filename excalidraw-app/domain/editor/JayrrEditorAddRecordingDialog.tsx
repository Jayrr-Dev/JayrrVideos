import {
  chevronLeftIcon,
  helpIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useQuery } from "convex/react";
import { useId, useState, type FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import { Dialog, Tooltip } from "../../components/ui/editor";
import { api } from "../../convexClient";
import {
  formatRecordingClock,
  formatRecordingQuality,
  formatRecordingSize,
  formatRecordingWhen,
} from "../recordings/formatRecording";

import "../../components/ui/JayrrLibraryMenu.scss";

import "../../present/JayrrPresentPanel.scss";

import "./JayrrEditorAddRecordingDialog.scss";

import type { Id } from "../../../convex/_generated/dataModel";

const INFO =
  "Open a folder, then pick a recording card and add it to the end of the sequence.";

export type EditorRecordingPick = {
  _id: Id<"presentRecordings">;
  url: string;
  posterUrl: string | null;
  durationMs: number;
  name: string | null;
  createdAt: number;
};

type RecordingListRow = EditorRecordingPick & {
  sizeBytes: number;
  width: number | null;
  height: number | null;
};

type FolderRow = {
  _id: Id<"presentRecordingFolders">;
  name: string;
  recordingCount: number;
};

const recordingLabel = (row: EditorRecordingPick) => {
  return row.name?.trim() || "Untitled";
};

const thumbVideoSrc = (url: string) => {
  if (url.includes("#")) {
    return url;
  }
  return `${url}#t=1`;
};

const thumbSeekTime = (mediaDuration: number, durationHintMs?: number) => {
  const hinted =
    durationHintMs != null && durationHintMs > 400 ? durationHintMs / 1000 : 0;
  const duration =
    Number.isFinite(mediaDuration) && mediaDuration > 0.4
      ? mediaDuration
      : hinted;
  if (duration > 2) {
    return Math.min(duration * 0.2, 2);
  }
  if (duration > 0.4) {
    return duration * 0.35;
  }
  return 1;
};

const paintThumbFrame = (video: HTMLVideoElement, durationHintMs?: number) => {
  if (video.readyState < 1) {
    return;
  }
  const seekTo = thumbSeekTime(video.duration, durationHintMs);
  if (Math.abs(video.currentTime - seekTo) < 0.08) {
    return;
  }
  video.currentTime = seekTo;
};

const RecordingThumbMedia = ({
  url,
  durationMs,
}: {
  url: string;
  durationMs?: number;
}) => {
  return (
    <video
      src={thumbVideoSrc(url)}
      muted
      playsInline
      preload="auto"
      onLoadedMetadata={(event) =>
        paintThumbFrame(event.currentTarget, durationMs)
      }
      onLoadedData={(event) => paintThumbFrame(event.currentTarget, durationMs)}
    />
  );
};

const PickFolderCard = ({
  folder,
  onOpen,
}: {
  folder: FolderRow;
  onOpen: () => void;
}) => {
  const previews = useQuery(
    api.presentRecordings.list,
    folder.recordingCount > 0 ? { folderId: folder._id } : "skip",
  );
  const thumbs = previews?.slice(0, 4) ?? [];
  const empty =
    folder.recordingCount === 0 || (previews && thumbs.length === 0);

  return (
    <li className="jayrr-scene-card">
      <span className="jayrr-scene-card__name">{folder.name}</span>
      <button
        type="button"
        className="jayrr-scene-card__preview"
        aria-label={`Open ${folder.name}`}
        onClick={onOpen}
      >
        {empty ? (
          <span className="jayrr-scene-card__empty">Empty</span>
        ) : (
          <span className="jayrr-present__folder-thumbs">
            {thumbs.map((row) => (
              <span key={row._id} className="jayrr-present__folder-thumb">
                <RecordingThumbMedia
                  url={row.url}
                  durationMs={row.durationMs}
                />
              </span>
            ))}
          </span>
        )}
      </button>
    </li>
  );
};

const PickRecordingCard = ({
  row,
  selected,
  onSelect,
  onAdd,
}: {
  row: RecordingListRow;
  selected: boolean;
  onSelect: () => void;
  onAdd: () => void;
}) => {
  const clock = formatRecordingClock(row.durationMs);
  const size = formatRecordingSize(row.sizeBytes);
  const when = formatRecordingWhen(row.createdAt);
  const label = recordingLabel(row);
  const quality = formatRecordingQuality(row.width ?? 0, row.height ?? 0);
  const itemClass = selected
    ? "jayrr-present__recording is-selected"
    : "jayrr-present__recording";

  return (
    <li className={itemClass}>
      <span className="jayrr-present__recording-name">{label}</span>
      <button
        type="button"
        className="jayrr-present__recording-thumb"
        aria-pressed={selected}
        aria-label={`Select ${label}, ${clock}`}
        onClick={onSelect}
        onDoubleClick={onAdd}
      >
        <RecordingThumbMedia url={row.url} durationMs={row.durationMs} />
        <span className="jayrr-present__recording-badges">
          {quality ? (
            <span className="jayrr-present__recording-quality">{quality}</span>
          ) : null}
          <span className="jayrr-present__recording-size">{size}</span>
        </span>
        <span className="jayrr-present__recording-clock">{clock}</span>
      </button>
      <span className="jayrr-present__recording-meta">
        <span className="jayrr-present__recording-when">{when}</span>
      </span>
    </li>
  );
};

type JayrrEditorAddRecordingDialogProps = {
  canQuery: boolean;
  onClose: () => void;
  onPick: (row: EditorRecordingPick) => void;
};

export const JayrrEditorAddRecordingDialog = ({
  canQuery,
  onClose,
  onPick,
}: JayrrEditorAddRecordingDialogProps) => {
  const formId = useId();
  const descriptionId = `${formId}-description`;
  const [folderId, setFolderId] =
    useState<Id<"presentRecordingFolders"> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const folders = useQuery(
    api.presentRecordingFolders.list,
    canQuery ? {} : "skip",
  );
  const recordings = useQuery(
    api.presentRecordings.list,
    canQuery ? { folderId: folderId ?? undefined } : "skip",
  );

  const openFolder = folders?.find((folder) => folder._id === folderId) ?? null;
  const selected = recordings?.find((row) => row._id === selectedId) ?? null;
  const canSubmit = Boolean(canQuery && selected);

  const openFolderById = (id: Id<"presentRecordingFolders">) => {
    setFolderId(id);
    setSelectedId(null);
  };

  const closeFolder = () => {
    setFolderId(null);
    setSelectedId(null);
  };

  const pickRow = (row: RecordingListRow) => {
    onPick({
      _id: row._id,
      url: row.url,
      posterUrl: row.posterUrl,
      durationMs: row.durationMs,
      name: row.name,
      createdAt: row.createdAt,
    });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) {
      return;
    }
    pickRow(selected);
  };

  const renderRecordingGrid = (rows: RecordingListRow[]) => {
    return (
      <ul className="jayrr-present__recordings-list">
        {rows.map((row) => (
          <PickRecordingCard
            key={row._id}
            row={row}
            selected={row._id === selectedId}
            onSelect={() => setSelectedId(row._id)}
            onAdd={() => pickRow(row)}
          />
        ))}
      </ul>
    );
  };

  let listBody;
  if (!canQuery) {
    listBody = (
      <p className="jayrr-editor-add-recording__empty">
        Sign in to load recordings.
      </p>
    );
  } else if (folders === undefined || recordings === undefined) {
    listBody = (
      <p className="jayrr-editor-add-recording__empty">Loading recordings…</p>
    );
  } else if (folderId) {
    if (recordings.length === 0) {
      listBody = (
        <p className="jayrr-editor-add-recording__empty">
          No recordings in this folder yet.
        </p>
      );
    } else {
      listBody = renderRecordingGrid(recordings);
    }
  } else if (folders.length === 0 && recordings.length === 0) {
    listBody = (
      <p className="jayrr-editor-add-recording__empty">
        No recordings yet. Use Record on the Present tab.
      </p>
    );
  } else {
    listBody = (
      <>
        {folders.length > 0 ? (
          <ul className="jayrr-scene-grid">
            {folders.map((folder) => (
              <PickFolderCard
                key={folder._id}
                folder={folder}
                onOpen={() => openFolderById(folder._id)}
              />
            ))}
          </ul>
        ) : null}
        {recordings.length > 0 ? (
          <>
            {folders.length > 0 ? (
              <h3 className="jayrr-present__section-label">Unfiled</h3>
            ) : null}
            {renderRecordingGrid(recordings)}
          </>
        ) : null}
      </>
    );
  }

  return (
    <Dialog
      className="jayrr-editor-add-recording"
      size={560}
      onCloseRequest={onClose}
      title={
        <span className="jayrr-editor-add-recording__title-row">
          Add recording
          <Tooltip label={INFO} long position="top">
            <span
              className="jayrr-editor-add-recording__info"
              aria-label="More info"
            >
              {helpIcon}
            </span>
          </Tooltip>
        </span>
      }
    >
      <p id={descriptionId} className="visually-hidden">
        {INFO}
      </p>
      <form
        className="jayrr-editor-add-recording__form"
        onSubmit={onSubmit}
        aria-describedby={descriptionId}
      >
        {folderId ? (
          <div className="jayrr-editor-add-recording__folder-bar">
            <button
              type="button"
              className="jayrr-present__back"
              aria-label="Back to recordings"
              onClick={closeFolder}
            >
              {chevronLeftIcon}
            </button>
            <span className="jayrr-editor-add-recording__folder-name">
              {openFolder?.name ?? "Folder"}
            </span>
          </div>
        ) : null}
        <div className="jayrr-editor-add-recording__body">{listBody}</div>
        <div className="jayrr-editor-add-recording__buttons">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            Add
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
