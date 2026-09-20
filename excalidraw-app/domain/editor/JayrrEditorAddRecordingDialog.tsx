import { helpIcon } from "@excalidraw/excalidraw/components/icons";
import { useEffect, useId, useState, type FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import { Dialog, Tooltip } from "../../components/ui/editor";
import { formatRecordingClock } from "../recordings/formatRecording";

import "./JayrrEditorAddRecordingDialog.scss";

import type { Id } from "../../../convex/_generated/dataModel";

const INFO = "Pick a saved recording and add it to the end of the sequence.";

export type EditorRecordingPick = {
  _id: Id<"presentRecordings">;
  url: string;
  posterUrl: string | null;
  durationMs: number;
  name: string | null;
  createdAt: number;
};

type JayrrEditorAddRecordingDialogProps = {
  canQuery: boolean;
  recordings: EditorRecordingPick[] | undefined;
  onClose: () => void;
  onPick: (row: EditorRecordingPick) => void;
};

export const JayrrEditorAddRecordingDialog = ({
  canQuery,
  recordings,
  onClose,
  onPick,
}: JayrrEditorAddRecordingDialogProps) => {
  const formId = useId();
  const descriptionId = `${formId}-description`;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId || !recordings || recordings.length === 0) {
      return;
    }
    const first = recordings[0];
    if (first) {
      setSelectedId(first._id);
    }
  }, [recordings, selectedId]);

  const selected = recordings?.find((row) => row._id === selectedId) ?? null;
  const canSubmit = Boolean(canQuery && selected);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) {
      return;
    }
    onPick(selected);
  };

  let listBody;
  if (!canQuery) {
    listBody = (
      <p className="jayrr-editor-add-recording__empty">
        Sign in to load recordings.
      </p>
    );
  } else if (recordings === undefined) {
    listBody = (
      <p className="jayrr-editor-add-recording__empty">Loading recordings…</p>
    );
  } else if (recordings.length === 0) {
    listBody = (
      <p className="jayrr-editor-add-recording__empty">
        No recordings yet. Use Record on the Present tab.
      </p>
    );
  } else {
    listBody = (
      <fieldset className="jayrr-editor-add-recording__fieldset">
        <legend className="visually-hidden">Recordings</legend>
        <ul className="jayrr-editor-add-recording__list">
          {recordings.map((row) => {
            const title = row.name?.trim() || "Recording";
            const checked = row._id === selectedId;
            return (
              <li key={row._id}>
                <label
                  className={`jayrr-editor-add-recording__option${
                    checked ? " is-selected" : ""
                  }`}
                >
                  <input
                    className="jayrr-editor-add-recording__radio"
                    type="radio"
                    name="recordingId"
                    value={row._id}
                    checked={checked}
                    onChange={() => setSelectedId(row._id)}
                  />
                  {row.posterUrl ? (
                    <img
                      className="jayrr-editor-add-recording__thumb"
                      src={row.posterUrl}
                      alt=""
                    />
                  ) : (
                    <span className="jayrr-editor-add-recording__thumb jayrr-editor-add-recording__thumb--empty" />
                  )}
                  <span className="jayrr-editor-add-recording__meta">
                    <span className="jayrr-editor-add-recording__name">
                      {title}
                    </span>
                    <span className="jayrr-editor-add-recording__clock">
                      {formatRecordingClock(row.durationMs)}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
    );
  }

  return (
    <Dialog
      className="jayrr-editor-add-recording"
      size={440}
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
        {listBody}
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
