import { helpIcon } from "@excalidraw/excalidraw/components/icons";
import { useAction, useMutation } from "convex/react";
import { useId, useState, type FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import { Dialog, Tooltip } from "../../components/ui/editor";
import { Field, Input } from "../../components/ui/Field";
import { api } from "../../convexClient";
import {
  formatRecordingClock,
  formatRecordingQuality,
} from "../recordings/formatRecording";

import "../../present/JayrrPresentPanel.scss";

import "./JayrrEditorAddStockDialog.scss";

import type { EditorRecordingPick } from "./JayrrEditorAddRecordingDialog";

const INFO =
  "Search free Pexels video, then pick a clip and add it to the sequence.";

type StockClip = {
  id: number;
  durationSec: number;
  width: number;
  height: number;
  image: string;
  url: string;
  author: string;
};

const PickStockCard = ({
  clip,
  selected,
  onSelect,
  onAdd,
}: {
  clip: StockClip;
  selected: boolean;
  onSelect: () => void;
  onAdd: () => void;
}) => {
  const clock = formatRecordingClock(clip.durationSec * 1000);
  const quality = formatRecordingQuality(clip.width, clip.height);
  const label = clip.author;
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
        <img src={clip.image} alt="" />
        <span className="jayrr-present__recording-badges">
          {quality ? (
            <span className="jayrr-present__recording-quality">{quality}</span>
          ) : null}
        </span>
        <span className="jayrr-present__recording-clock">{clock}</span>
      </button>
    </li>
  );
};

type JayrrEditorAddStockDialogProps = {
  canQuery: boolean;
  onClose: () => void;
  onPick: (row: EditorRecordingPick) => void;
};

export const JayrrEditorAddStockDialog = ({
  canQuery,
  onClose,
  onPick,
}: JayrrEditorAddStockDialogProps) => {
  const descriptionId = useId();
  const searchStock = useAction(api.stockVideos.search);
  const saveRecording = useMutation(api.presentRecordings.save);
  const [query, setQuery] = useState("");
  const [clips, setClips] = useState<StockClip[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const trimmed = query.trim();
  const selected = clips.find((clip) => clip.id === selectedId) ?? null;
  let canSearch = false;
  if (canQuery) {
    if (trimmed.length > 0) {
      if (!busy) {
        canSearch = true;
      }
    }
  }
  let canAdd = false;
  if (canQuery && selected && !busy) {
    canAdd = true;
  }

  const runSearch = async () => {
    if (!canSearch) {
      return;
    }
    setBusy(true);
    setError("");
    setSelectedId(null);
    try {
      const rows = await searchStock({ query: trimmed });
      setClips(rows);
      setSearched(true);
    } catch (caught) {
      setClips([]);
      setSearched(true);
      setError(
        caught instanceof Error ? caught.message : "Stock search failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const pickClip = async (clip: StockClip) => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const durationMs = Math.max(1, Math.round(clip.durationSec * 1000));
      const recordingId = await saveRecording({
        pathname: `stock/pexels-${clip.id}.mp4`,
        url: clip.url,
        downloadUrl: clip.url,
        mimeType: "video/mp4",
        durationMs,
        sizeBytes: 0,
        posterUrl: clip.image,
        width: clip.width > 0 ? clip.width : undefined,
        height: clip.height > 0 ? clip.height : undefined,
        name: clip.author,
      });
      onPick({
        _id: recordingId,
        url: clip.url,
        posterUrl: clip.image,
        durationMs,
        name: clip.author,
        createdAt: Date.now(),
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not add stock clip.",
      );
      setBusy(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runSearch();
  };

  let listBody;
  if (!canQuery) {
    listBody = (
      <p className="jayrr-editor-add-stock__empty">Sign in to search stock.</p>
    );
  } else if (busy && clips.length === 0) {
    listBody = <p className="jayrr-editor-add-stock__empty">Searching…</p>;
  } else if (error && clips.length === 0) {
    listBody = <p className="jayrr-editor-add-stock__empty">{error}</p>;
  } else if (!searched) {
    listBody = (
      <p className="jayrr-editor-add-stock__empty">Search for a clip.</p>
    );
  } else if (clips.length === 0) {
    listBody = (
      <p className="jayrr-editor-add-stock__empty">No clips for that search.</p>
    );
  } else {
    listBody = (
      <ul className="jayrr-present__recordings-list">
        {clips.map((clip) => (
          <PickStockCard
            key={clip.id}
            clip={clip}
            selected={clip.id === selectedId}
            onSelect={() => setSelectedId(clip.id)}
            onAdd={() => {
              void pickClip(clip);
            }}
          />
        ))}
      </ul>
    );
  }

  return (
    <Dialog
      className="jayrr-editor-add-stock"
      size={560}
      onCloseRequest={onClose}
      title={
        <span className="jayrr-editor-add-stock__title-row">
          Add stock
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
        <Field label="Search">
          <Input
            value={query}
            placeholder="City, ocean, office"
            disabled={!canQuery || busy}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </Field>
        <div className="jayrr-editor-add-stock__body">{listBody}</div>
        {clips.length > 0 && error ? (
          <p className="jayrr-editor-add-stock__error">{error}</p>
        ) : null}
        <div className="jayrr-editor-add-stock__buttons">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="secondary" disabled={!canSearch}>
            Search
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canAdd}
            onClick={() => {
              if (!selected) {
                return;
              }
              void pickClip(selected);
            }}
          >
            Add
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
