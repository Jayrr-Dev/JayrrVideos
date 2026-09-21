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

import "../../components/ui/JayrrLibraryMenu.scss";

import "../../present/JayrrPresentPanel.scss";

import "./JayrrEditorAddRecordingDialog.scss";

import type { Id } from "../../../convex/_generated/dataModel";

const INFO =
  "Name the edit, open a folder if you want one, then save. Projects show up under Docs → Project.";

type FolderRow = {
  _id: Id<"editorProjectFolders">;
  name: string;
  projectCount: number;
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
        {folder.projectCount === 0 ? (
          <span className="jayrr-scene-card__empty">Empty</span>
        ) : (
          <span className="jayrr-scene-card__empty">
            {folder.projectCount}{" "}
            {folder.projectCount === 1 ? "project" : "projects"}
          </span>
        )}
      </button>
    </li>
  );
};

type JayrrEditorSaveProjectDialogProps = {
  canQuery: boolean;
  defaultName: string;
  saving: boolean;
  onClose: () => void;
  onSave: (args: {
    name: string;
    folderId: Id<"editorProjectFolders"> | null;
  }) => Promise<void>;
};

export const JayrrEditorSaveProjectDialog = ({
  canQuery,
  defaultName,
  saving,
  onClose,
  onSave,
}: JayrrEditorSaveProjectDialogProps) => {
  const formId = useId();
  const descriptionId = `${formId}-description`;
  const [name, setName] = useState(defaultName);
  const [folderId, setFolderId] = useState<Id<"editorProjectFolders"> | null>(
    null,
  );

  const folders = useQuery(
    api.editorProjectFolders.list,
    canQuery ? {} : "skip",
  );
  const createFolder = useMutation(api.editorProjectFolders.create);
  const openFolder = folders?.find((folder) => folder._id === folderId) ?? null;
  const trimmed = name.trim();
  const canSubmit = Boolean(canQuery && trimmed && !saving);

  const openFolderById = (id: Id<"editorProjectFolders">) => {
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
    void onSave({ name: trimmed, folderId });
  };

  let listBody;
  if (!canQuery) {
    listBody = (
      <p className="jayrr-editor-add-recording__empty">
        Sign in to save projects.
      </p>
    );
  } else if (folders === undefined) {
    listBody = (
      <p className="jayrr-editor-add-recording__empty">Loading folders…</p>
    );
  } else if (folderId) {
    listBody = (
      <p className="jayrr-editor-add-recording__empty">
        Save into this folder.
      </p>
    );
  } else if (folders.length === 0) {
    listBody = (
      <p className="jayrr-editor-add-recording__empty">
        No folders yet. Save unfiled, or create a folder.
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
          Save project
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
            disabled={saving}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        {folderId ? (
          <div className="jayrr-editor-add-recording__folder-bar">
            <button
              type="button"
              className="jayrr-present__back"
              aria-label="Back to folders"
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
              disabled={saving}
              onClick={() => {
                void onCreateFolder();
              }}
            >
              Create folder
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
