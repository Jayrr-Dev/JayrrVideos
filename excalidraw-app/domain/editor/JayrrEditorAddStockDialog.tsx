import { helpIcon } from "@excalidraw/excalidraw/components/icons";
import { useAction } from "convex/react";
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

const INFO = "Search free Pexels video by keyword.";

type StockClip = {
  id: number;
  durationSec: number;
  width: number;
  height: number;
  image: string;
  author: string;
};

type JayrrEditorAddStockDialogProps = {
  canQuery: boolean;
  onClose: () => void;
};

export const JayrrEditorAddStockDialog = ({
  canQuery,
  onClose,
}: JayrrEditorAddStockDialogProps) => {
  const descriptionId = useId();
  const searchStock = useAction(api.stockVideos.search);
  const [query, setQuery] = useState("");
  const [clips, setClips] = useState<StockClip[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const trimmed = query.trim();
  let canSearch = false;
  if (canQuery) {
    if (trimmed.length > 0) {
      if (!busy) {
        canSearch = true;
      }
    }
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSearch) {
      return;
    }
    setBusy(true);
    setError("");
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

  let listBody;
  if (!canQuery) {
    listBody = (
      <p className="jayrr-editor-add-stock__empty">Sign in to search stock.</p>
    );
  } else if (busy) {
    listBody = (
      <p className="jayrr-editor-add-stock__empty">Searching…</p>
    );
  } else if (error) {
    listBody = <p className="jayrr-editor-add-stock__empty">{error}</p>;
  } else if (!searched) {
    listBody = (
      <p className="jayrr-editor-add-stock__empty">
        Search for a clip.
      </p>
    );
  } else if (clips.length === 0) {
    listBody = (
      <p className="jayrr-editor-add-stock__empty">No clips for that search.</p>
    );
  } else {
    listBody = (
      <ul className="jayrr-present__recordings-list">
        {clips.map((clip) => {
          const clock = formatRecordingClock(clip.durationSec * 1000);
          const quality = formatRecordingQuality(clip.width, clip.height);
          return (
            <li key={clip.id} className="jayrr-present__recording">
              <span className="jayrr-present__recording-name">{clip.author}</span>
              <span className="jayrr-present__recording-thumb">
                <img src={clip.image} alt="" />
                <span className="jayrr-present__recording-badges">
                  {quality ? (
                    <span className="jayrr-present__recording-quality">
                      {quality}
                    </span>
                  ) : null}
                </span>
                <span className="jayrr-present__recording-clock">{clock}</span>
              </span>
            </li>
          );
        })}
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
        <div className="jayrr-editor-add-stock__buttons">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!canSearch}>
            Search
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
