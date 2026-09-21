import {
  chevronLeftIcon,
  helpIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useAction, useQuery } from "convex/react";
import { useId, useState, type FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import { Dialog, Tooltip } from "../../components/ui/editor";
import { Field, Input } from "../../components/ui/Field";
import { api } from "../../convexClient";
import { formatRecordingQuality } from "../recordings/formatRecording";

import "../../present/JayrrPresentPanel.scss";

import "./JayrrEditorAddStockDialog.scss";

import {
  EDITOR_STATIC_DURATION_MS,
  editorStaticMediaKindFromMime,
  type EditorStaticMediaKind,
} from "./buildEditorTimeline";

import type { Id } from "../../../convex/_generated/dataModel";

const INFO =
  "Pick a still from Docs, or search free Pexels photos, then add it to the sequence.";

export type EditorStaticPick = {
  url: string;
  label: string;
  durationMs: number;
  mediaKind: EditorStaticMediaKind;
  width?: number;
  height?: number;
};

type ImageSource = "docs" | "search";

type StockImage = {
  id: number;
  width: number;
  height: number;
  image: string;
  url: string;
  author: string;
};

type FolderRow = {
  _id: Id<"presentRecordingFolders">;
  name: string;
  recordingCount: number;
};

type RecordingRow = {
  _id: Id<"presentRecordings">;
  mimeType: string;
  url: string;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  name: string | null;
};

type DocsStill = {
  id: string;
  url: string;
  image: string;
  label: string;
  mediaKind: EditorStaticMediaKind;
  width: number;
  height: number;
};

const stillFromRecording = (row: RecordingRow): DocsStill | null => {
  const mime = row.mimeType.toLowerCase();
  const label = row.name?.trim() || "Untitled";
  const width = row.width && row.width > 0 ? row.width : 0;
  const height = row.height && row.height > 0 ? row.height : 0;
  if (mime.startsWith("image/")) {
    return {
      id: row._id,
      url: row.url,
      image: row.url,
      label,
      mediaKind: editorStaticMediaKindFromMime(mime),
      width,
      height,
    };
  }
  if (!row.posterUrl) {
    return null;
  }
  return {
    id: row._id,
    url: row.posterUrl,
    image: row.posterUrl,
    label,
    mediaKind: "image",
    width,
    height,
  };
};

const PickImageCard = ({
  image,
  label,
  quality,
  selected,
  onSelect,
  onAdd,
}: {
  image: string;
  label: string;
  quality: string;
  selected: boolean;
  onSelect: () => void;
  onAdd: () => void;
}) => {
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
        aria-label={`Select ${label}`}
        onClick={onSelect}
        onDoubleClick={onAdd}
      >
        <img src={image} alt="" />
        <span className="jayrr-present__recording-badges">
          {quality ? (
            <span className="jayrr-present__recording-quality">{quality}</span>
          ) : null}
        </span>
      </button>
    </li>
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
  const thumbs = (previews ?? [])
    .map(stillFromRecording)
    .filter((row): row is DocsStill => Boolean(row))
    .slice(0, 4);
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
              <span key={row.id} className="jayrr-present__folder-thumb">
                <img src={row.image} alt="" />
              </span>
            ))}
          </span>
        )}
      </button>
    </li>
  );
};

type JayrrEditorAddImageDialogProps = {
  canQuery: boolean;
  onClose: () => void;
  onPick: (row: EditorStaticPick) => void;
};

export const JayrrEditorAddImageDialog = ({
  canQuery,
  onClose,
  onPick,
}: JayrrEditorAddImageDialogProps) => {
  const descriptionId = useId();
  const searchImages = useAction(api.stockImages.search);
  const [source, setSource] = useState<ImageSource>("docs");
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<StockImage[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [folderId, setFolderId] =
    useState<Id<"presentRecordingFolders"> | null>(null);

  const folders = useQuery(
    api.presentRecordingFolders.list,
    canQuery && source === "docs" ? {} : "skip",
  );
  const recordings = useQuery(
    api.presentRecordings.list,
    canQuery && source === "docs"
      ? { folderId: folderId ?? undefined }
      : "skip",
  );

  const trimmed = query.trim();
  const docsStills = (recordings ?? [])
    .map(stillFromRecording)
    .filter((row): row is DocsStill => Boolean(row));
  const openFolder = folders?.find((folder) => folder._id === folderId) ?? null;
  const selectedPhoto =
    photos.find((photo) => String(photo.id) === selectedKey) ?? null;
  const selectedDoc = docsStills.find((row) => row.id === selectedKey) ?? null;

  let canSearch = false;
  if (canQuery && source === "search" && trimmed.length > 0 && !busy) {
    canSearch = true;
  }
  let canAdd = false;
  if (canQuery && !busy) {
    if (source === "search" && selectedPhoto) {
      canAdd = true;
    }
    if (source === "docs" && selectedDoc) {
      canAdd = true;
    }
  }

  const setImageSource = (next: ImageSource) => {
    setSource(next);
    setSelectedKey(null);
    setError("");
  };

  const runSearch = async () => {
    if (!canSearch) {
      return;
    }
    setBusy(true);
    setError("");
    setSelectedKey(null);
    try {
      const rows = await searchImages({ query: trimmed });
      setPhotos(rows);
      setSearched(true);
    } catch (caught) {
      setPhotos([]);
      setSearched(true);
      setError(
        caught instanceof Error ? caught.message : "Image search failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const pickPhoto = (photo: StockImage) => {
    onPick({
      url: photo.url,
      label: photo.author,
      durationMs: EDITOR_STATIC_DURATION_MS,
      mediaKind: "image",
      ...(photo.width > 0 ? { width: photo.width } : {}),
      ...(photo.height > 0 ? { height: photo.height } : {}),
    });
  };

  const pickDoc = (row: DocsStill) => {
    onPick({
      url: row.url,
      label: row.label,
      durationMs: EDITOR_STATIC_DURATION_MS,
      mediaKind: row.mediaKind,
      ...(row.width > 0 ? { width: row.width } : {}),
      ...(row.height > 0 ? { height: row.height } : {}),
    });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (source === "search") {
      await runSearch();
      return;
    }
    if (!selectedDoc) {
      return;
    }
    pickDoc(selectedDoc);
  };

  const renderPhotoGrid = (rows: StockImage[]) => (
    <ul className="jayrr-present__recordings-list">
      {rows.map((photo) => (
        <PickImageCard
          key={photo.id}
          image={photo.image}
          label={photo.author}
          quality={formatRecordingQuality(photo.width, photo.height)}
          selected={String(photo.id) === selectedKey}
          onSelect={() => setSelectedKey(String(photo.id))}
          onAdd={() => pickPhoto(photo)}
        />
      ))}
    </ul>
  );

  const renderDocsGrid = (rows: DocsStill[]) => (
    <ul className="jayrr-present__recordings-list">
      {rows.map((row) => (
        <PickImageCard
          key={row.id}
          image={row.image}
          label={row.label}
          quality={formatRecordingQuality(row.width, row.height)}
          selected={row.id === selectedKey}
          onSelect={() => setSelectedKey(row.id)}
          onAdd={() => pickDoc(row)}
        />
      ))}
    </ul>
  );

  let listBody;
  if (!canQuery) {
    listBody = (
      <p className="jayrr-editor-add-stock__empty">Sign in to add images.</p>
    );
  } else if (source === "search") {
    if (busy && photos.length === 0) {
      listBody = <p className="jayrr-editor-add-stock__empty">Searching…</p>;
    } else if (error && photos.length === 0) {
      listBody = <p className="jayrr-editor-add-stock__empty">{error}</p>;
    } else if (!searched) {
      listBody = (
        <p className="jayrr-editor-add-stock__empty">Search for a photo.</p>
      );
    } else if (photos.length === 0) {
      listBody = (
        <p className="jayrr-editor-add-stock__empty">
          No photos for that search.
        </p>
      );
    } else {
      listBody = renderPhotoGrid(photos);
    }
  } else if (folders === undefined || recordings === undefined) {
    listBody = <p className="jayrr-editor-add-stock__empty">Loading Docs…</p>;
  } else if (folderId) {
    if (docsStills.length === 0) {
      listBody = (
        <p className="jayrr-editor-add-stock__empty">
          No stills in this folder yet.
        </p>
      );
    } else {
      listBody = renderDocsGrid(docsStills);
    }
  } else if (folders.length === 0 && docsStills.length === 0) {
    listBody = (
      <p className="jayrr-editor-add-stock__empty">
        No stills in Docs yet. Record a clip or search stock photos.
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
                onOpen={() => {
                  setFolderId(folder._id);
                  setSelectedKey(null);
                }}
              />
            ))}
          </ul>
        ) : null}
        {docsStills.length > 0 ? (
          <>
            {folders.length > 0 ? (
              <h3 className="jayrr-present__section-label">Unfiled</h3>
            ) : null}
            {renderDocsGrid(docsStills)}
          </>
        ) : null}
      </>
    );
  }

  return (
    <Dialog
      className="jayrr-editor-add-stock"
      size={560}
      onCloseRequest={onClose}
      title={
        <span className="jayrr-editor-add-stock__title-row">
          Add image
          <Tooltip label={INFO} long position="top">
            <span
              className="jayrr-editor-add-stock__info"
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
        className="jayrr-editor-add-stock__form"
        aria-describedby={descriptionId}
        onSubmit={onSubmit}
      >
        <div
          className="jayrr-editor-add-stock__sources"
          role="group"
          aria-label="Image source"
        >
          <button
            type="button"
            className={`jayrr-editor-add-stock__source${
              source === "docs" ? " is-active" : ""
            }`}
            aria-pressed={source === "docs"}
            onClick={() => setImageSource("docs")}
          >
            Docs
          </button>
          <button
            type="button"
            className={`jayrr-editor-add-stock__source${
              source === "search" ? " is-active" : ""
            }`}
            aria-pressed={source === "search"}
            onClick={() => setImageSource("search")}
          >
            Search
          </button>
        </div>
        {source === "search" ? (
          <Field label="Search">
            <Input
              value={query}
              placeholder="City, ocean, office"
              disabled={!canQuery || busy}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </Field>
        ) : null}
        {source === "docs" && folderId ? (
          <div className="jayrr-editor-add-stock__folder-bar">
            <button
              type="button"
              className="jayrr-present__back"
              aria-label="Back to Docs"
              onClick={() => {
                setFolderId(null);
                setSelectedKey(null);
              }}
            >
              {chevronLeftIcon}
            </button>
            <span className="jayrr-editor-add-stock__folder-name">
              {openFolder?.name ?? "Folder"}
            </span>
          </div>
        ) : null}
        <div className="jayrr-editor-add-stock__body">{listBody}</div>
        {photos.length > 0 && error && source === "search" ? (
          <p className="jayrr-editor-add-stock__error">{error}</p>
        ) : null}
        <div className="jayrr-editor-add-stock__buttons">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {source === "search" ? (
            <Button type="submit" variant="secondary" disabled={!canSearch}>
              Search
            </Button>
          ) : null}
          <Button
            type={source === "docs" ? "submit" : "button"}
            variant="primary"
            disabled={!canAdd}
            onClick={() => {
              if (source === "search") {
                if (!selectedPhoto) {
                  return;
                }
                pickPhoto(selectedPhoto);
                return;
              }
            }}
          >
            Add
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
