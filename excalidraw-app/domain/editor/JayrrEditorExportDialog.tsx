import {
  chevronLeftIcon,
  helpIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useMutation, useQuery } from "convex/react";
import { useId, useState, type FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import { Dialog, Tooltip } from "../../components/ui/editor";
import { Field, Input } from "../../components/ui/Field";
import { api } from "../../convexClient";
import { getOpenRecordingFolderId } from "../../present/openRecordingFolder";

import "../../components/ui/JayrrLibraryMenu.scss";
import "../../present/JayrrPresentPanel.scss";

import { DEFAULT_EDITOR_PROJECT_NAME } from "./editorProjectStore";

import "./JayrrEditorAddRecordingDialog.scss";

import type { Id } from "../../../convex/_generated/dataModel";

const INFO =
  "Plays the timeline once and saves a flattened video under Docs. Default name is the project name plus date.";

const exportNameFromProject = (projectName: string) => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const year = String(now.getFullYear());
  const trimmed = projectName.trim() || DEFAULT_EDITOR_PROJECT_NAME;
  return `${trimmed} ${month}-${day}-${year}`.slice(0, 80);
};

type FolderRow = {
  _id: Id<"presentRecordingFolders">;
  name: string;
  recordingCount: number;
};

const PickFolderCard = ({
  folder,
  onOpen,
}: {
  folder: FolderRow;
  onOpen: () => void;
}) => {
  return (
    <li className="jayrr-scene-card">
      <span className="jayrr-scene-card__name">{folder.name}</span>
      <button
        type="button"
        className="jayrr-scene-card__preview"
        aria-label={`Open ${folder.name}`}
        onClick={onOpen}
      >
        {folder.recordingCount === 0 ? (
          <span className="jayrr-scene-card__empty">Empty</span>
        ) : (
          <span className="jayrr-scene-card__empty">
            {folder.recordingCount}{" "}
            {folder.recordingCount === 1 ? "recording" : "recordings"}
          </span>
        )}
      </button>
    </li>
  );
};

type JayrrEditorExportDialogProps = {
  canQuery: boolean;
  exporting: boolean;
  projectName: string;
  onClose: () => void;
  onExport: (args: {
    name: string;
    folderId: Id<"presentRecordingFolders"> | null;
  }) => Promise<void>;
};

export const JayrrEditorExportDialog = ({
  canQuery,
  exporting,
  projectName,
  onClose,
  onExport,
}: JayrrEditorExportDialogProps) => {
  const formId = useId();
  const descriptionId = `${formId}-description`;
  const [name, setName] = useState(() => exportNameFromProject(projectName));
  const [folderId, setFolderId] =
    useState<Id<"presentRecordingFolders"> | null>(getOpenRecordingFolderId());

  const folders = useQuery(
    api.presentRecordingFolders.list,
    canQuery ? {} : "skip",
  );
  const createFolder = useMutation(api.presentRecordingFolders.create);
  const openFolder = folders?.find((folder) => folder._id === folderId) ?? null;
  const trimmed = name.trim();
  const canSubmit = Boolean(canQuery && trimmed && !exporting);

  const openFolderById = (id: Id<"presentRecordingFolders">) => {
    setFolderId(id);
  };

  const closeFolder = () => {
    setFolderId(null);
  };

  const onCreateFolder = async () => {
    const nextIndex = (folders?.length ?? 0) + 1;
    const folderName = `Folder ${nextIndex}`;
    const id = await createFolder({ name: folderName });
    setFolderId(id);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    void onExport({ name: trimmed, folderId });
  };

  let listBody;
  if (!canQuery) {
    listBody = (
      <p className="jayrr-editor-add-recording__empty">
        Sign in to export video.
      </p>
    );
  } else if (folders === undefined) {
    listBody = (
      <p className="jayrr-editor-add-recording__empty">Loading folders…</p>
    );
  } else if (folderId) {
    listBody = (
      <p className="jayrr-editor-add-recording__empty">
        Export into this folder.
      </p>
    );
  } else if (folders.length === 0) {
    listBody = (
      <p className="jayrr-editor-add-recording__empty">
        No folders yet. Export unfiled, or create a folder.
      </p>
    );
  } else {
    listBody = (
      <ul className="jayrr-scene-grid">
        {folders.map((folder) => (
          <PickFolderCard
            key={folder._id}
            folder={folder}
            onOpen={() => openFolderById(folder._id)}
          />
        ))}
      </ul>
    );
  }

  return (
    <Dialog
      className="jayrr-editor-add-recording"
      size={560}
      onCloseRequest={onClose}
      title={
        <span className="jayrr-editor-add-recording__title-row">
          Export video
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
        <Field label="Name">
          <Input
            value={name}
            maxLength={80}
            autoFocus
            disabled={exporting}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        {folderId ? (
          <div className="jayrr-editor-add-recording__folder-bar">
            <button
              type="button"
              className="jayrr-present__back"
              aria-label="Back to folders"
              disabled={exporting}
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
          {canQuery && !folderId ? (
            <Button
              type="button"
              variant="secondary"
              disabled={exporting}
              onClick={() => {
                void onCreateFolder();
              }}
            >
              Create folder
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={exporting}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {exporting ? "Exporting…" : "Export"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
