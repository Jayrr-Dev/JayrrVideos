import { Button, useExcalidrawAPI } from "@excalidraw/excalidraw";
import DropdownMenu from "@excalidraw/excalidraw/components/dropdownMenu/DropdownMenu";
import {
  chevronLeftIcon,
  DotsHorizontalIcon,
  playerPlayIcon,
  TrashIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useAtom } from "../app-jotai";
import { JayrrConfirmDialog } from "../components/ui";
import { api as convexApi, isConvexLinked } from "../convexClient";
import {
  formatRecordingClock,
  formatRecordingQuality,
  formatRecordingSize,
  formatRecordingWhen,
  VideoPreviewDialog,
} from "../domain/recordings";

import "../components/ui/JayrrLibraryMenu.scss";

import { JAYRR_RECORDING_DRAG } from "./insertPresentRecording";
import {
  openRecordingFolderIdAtom,
  persistOpenRecordingFolderId,
} from "./openRecordingFolder";

import type { Id } from "../../convex/_generated/dataModel";

export const JAYRR_RECORDINGS_TAB = "jayrrRecordings";

export const recordingsTabIcon = (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
    <circle
      cx="10"
      cy="10"
      r="7.15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
    />
    <circle cx="10" cy="10" r="3.55" fill="#e10600" />
  </svg>
);

type RecordingRow = {
  _id: Id<"presentRecordings">;
  folderId: Id<"presentRecordingFolders"> | null;
  url: string;
  durationMs: number;
  sizeBytes: number;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  name: string | null;
  createdAt: number;
};

type FolderRow = {
  _id: Id<"presentRecordingFolders">;
  name: string;
  recordingCount: number;
  updatedAt: number;
};

const recordingLabel = (row: RecordingRow) => {
  return row.name ?? "Untitled";
};

const EditGlyph = (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);

const RecordingCard = ({
  row,
  folders,
  menuOpen,
  renaming,
  draftName,
  onMenuToggle,
  onDelete,
  onStartRename,
  onDraftChange,
  onCommitRename,
  onCancelRename,
  onMove,
  onPreview,
}: {
  row: RecordingRow;
  folders: FolderRow[];
  menuOpen: boolean;
  renaming: boolean;
  draftName: string;
  onMenuToggle: () => void;
  onDelete: () => void;
  onStartRename: () => void;
  onDraftChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onMove: (folderId: Id<"presentRecordingFolders"> | null) => void;
  onPreview: () => void;
}) => {
  const clock = formatRecordingClock(row.durationMs);
  const size = formatRecordingSize(row.sizeBytes);
  const when = formatRecordingWhen(row.createdAt);
  const label = recordingLabel(row);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const draggedRef = useRef(false);
  const [probed, setProbed] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const quality = formatRecordingQuality(
    row.width ?? probed?.width ?? 0,
    row.height ?? probed?.height ?? 0,
  );
  const rememberSize = (video: HTMLVideoElement) => {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      setProbed({
        width: video.videoWidth,
        height: video.videoHeight,
      });
    }
  };
  const moveTargets = folders.filter((folder) => folder._id !== row.folderId);

  useEffect(() => {
    if (!renaming) {
      return;
    }
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [renaming]);

  return (
    <li className="jayrr-present__recording">
      {renaming ? (
        <input
          ref={nameInputRef}
          className="jayrr-present__recording-name-input"
          value={draftName}
          aria-label="Recording name"
          onChange={(event) => onDraftChange(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onBlur={() => onCommitRename()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onCommitRename();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onCancelRename();
            }
          }}
        />
      ) : (
        <span className="jayrr-present__recording-name">{label}</span>
      )}
      <button
        type="button"
        className="jayrr-present__recording-thumb"
        draggable={!renaming}
        aria-label={
          quality
            ? `Play recording ${label}, ${clock}, ${quality}, ${size}`
            : `Play recording ${label}, ${clock}, ${size}`
        }
        onDragStart={(event) => {
          draggedRef.current = true;
          event.dataTransfer.setData(
            JAYRR_RECORDING_DRAG,
            JSON.stringify({
              url: row.url,
              width: row.width ?? probed?.width ?? null,
              height: row.height ?? probed?.height ?? null,
            }),
          );
          event.dataTransfer.setData("text/plain", row.url);
          event.dataTransfer.effectAllowed = "copy";
        }}
        onDragEnd={() => {
          window.setTimeout(() => {
            draggedRef.current = false;
          }, 0);
        }}
        onClick={() => {
          if (draggedRef.current) {
            return;
          }
          onPreview();
        }}
      >
        {row.posterUrl ? (
          <img src={row.posterUrl} alt="" />
        ) : (
          <video
            src={row.url}
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(event) => rememberSize(event.currentTarget)}
          />
        )}
        {row.posterUrl && !row.width ? (
          <video
            className="jayrr-present__recording-probe"
            src={row.url}
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(event) => rememberSize(event.currentTarget)}
          />
        ) : null}
        <span className="jayrr-present__recording-play" aria-hidden="true">
          {playerPlayIcon}
        </span>
        <span className="jayrr-present__recording-badges">
          {quality ? (
            <span className="jayrr-present__recording-quality">{quality}</span>
          ) : null}
          <span className="jayrr-present__recording-size">{size}</span>
        </span>
        <span className="jayrr-present__recording-clock">{clock}</span>
      </button>
      <div className="jayrr-present__recording-meta">
        <span className="jayrr-present__recording-when">{when}</span>
        <DropdownMenu open={menuOpen}>
          <DropdownMenu.Trigger
            className="jayrr-present__recording-menu"
            aria-label={`${label} menu`}
            onToggle={onMenuToggle}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {DotsHorizontalIcon}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            onClickOutside={onMenuToggle}
            onSelect={onMenuToggle}
          >
            <DropdownMenu.Item onSelect={onPreview}>Open</DropdownMenu.Item>
            <DropdownMenu.Item onSelect={onStartRename}>
              Rename
            </DropdownMenu.Item>
            {moveTargets.map((folder) => (
              <DropdownMenu.Item
                key={folder._id}
                onSelect={() => onMove(folder._id)}
              >
                {`Move to ${folder.name}`}
              </DropdownMenu.Item>
            ))}
            {row.folderId ? (
              <DropdownMenu.Item onSelect={() => onMove(null)}>
                Move to Recordings
              </DropdownMenu.Item>
            ) : null}
            <DropdownMenu.Item icon={TrashIcon} onSelect={onDelete}>
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
    </li>
  );
};

const FolderCard = ({
  folder,
  menuOpen,
  renaming,
  draftName,
  onOpen,
  onMenuToggle,
  onStartRename,
  onDraftChange,
  onCommitRename,
  onCancelRename,
  onDelete,
}: {
  folder: FolderRow;
  menuOpen: boolean;
  renaming: boolean;
  draftName: string;
  onOpen: () => void;
  onMenuToggle: () => void;
  onStartRename: () => void;
  onDraftChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
}) => {
  const renameInputRef = useRef<HTMLInputElement>(null);
  const previews = useQuery(
    convexApi.presentRecordings.list,
    folder.recordingCount > 0 ? { folderId: folder._id } : "skip",
  );
  const thumbs = previews?.slice(0, 4) ?? [];

  useEffect(() => {
    if (!renaming) {
      return;
    }
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [renaming]);

  return (
    <li className="jayrr-scene-card">
      {renaming ? (
        <input
          ref={renameInputRef}
          className="jayrr-scene-card__name-input"
          value={draftName}
          aria-label="Folder name"
          onChange={(event) => onDraftChange(event.target.value)}
          onBlur={() => onCommitRename()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onCommitRename();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onCancelRename();
            }
          }}
        />
      ) : (
        <span className="jayrr-scene-card__name">{folder.name}</span>
      )}
      <button
        type="button"
        className="jayrr-scene-card__preview"
        aria-label={`Open ${folder.name}`}
        onClick={onOpen}
      >
        {folder.recordingCount === 0 || (previews && thumbs.length === 0) ? (
          <span className="jayrr-scene-card__empty">Empty</span>
        ) : (
          <span className="jayrr-present__folder-thumbs">
            {thumbs.map((row) => (
              <span key={row._id} className="jayrr-present__folder-thumb">
                {row.posterUrl ? (
                  <img src={row.posterUrl} alt="" />
                ) : (
                  <video src={row.url} muted playsInline preload="metadata" />
                )}
              </span>
            ))}
          </span>
        )}
      </button>
      <DropdownMenu open={menuOpen}>
        <DropdownMenu.Trigger
          className="jayrr-scene-card__menu"
          aria-label={`${folder.name} menu`}
          onToggle={onMenuToggle}
        >
          {DotsHorizontalIcon}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          onClickOutside={onMenuToggle}
          onSelect={onMenuToggle}
        >
          <DropdownMenu.Item icon={EditGlyph} onSelect={onStartRename}>
            Rename
          </DropdownMenu.Item>
          <DropdownMenu.Item icon={TrashIcon} onSelect={onDelete}>
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    </li>
  );
};

export const JayrrPresentRecordingsPanel = ({
  uploading,
}: {
  uploading: boolean;
}) => {
  if (!isConvexLinked) {
    return (
      <RecordingsShell uploading={uploading} title="Recordings">
        <p className="jayrr-present__empty">
          Sign in to store recordings here.
        </p>
      </RecordingsShell>
    );
  }

  return <JayrrPresentRecordingsAuthed uploading={uploading} />;
};

const RecordingsShell = ({
  uploading,
  title,
  onBack,
  footer,
  children,
}: {
  uploading: boolean;
  title: ReactNode;
  onBack?: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) => {
  return (
    <div className="jayrr-present jayrr-present--recordings">
      <div className="jayrr-present__title-row">
        {onBack ? (
          <button
            type="button"
            className="jayrr-present__back"
            aria-label="Back to recordings"
            onClick={onBack}
          >
            {chevronLeftIcon}
          </button>
        ) : null}
        {typeof title === "string" ? (
          <h2 className="jayrr-present__title">{title}</h2>
        ) : (
          title
        )}
        <span className="jayrr-present__sr">
          Saved slideshow recordings in folders. Drag a clip onto the canvas.
          Rename, move, or delete from the menu.
        </span>
      </div>
      {uploading ? (
        <p className="jayrr-present__status" aria-live="polite">
          Saving recording…
        </p>
      ) : null}
      <div className="jayrr-present__recordings-body">{children}</div>
      {footer}
    </div>
  );
};

const JayrrPresentRecordingsAuthed = ({
  uploading,
}: {
  uploading: boolean;
}) => {
  const api = useExcalidrawAPI();
  const [openFolderId, setOpenFolderId] = useAtom(openRecordingFolderIdAtom);
  const folders = useQuery(convexApi.presentRecordingFolders.list);
  const openFolder = useQuery(
    convexApi.presentRecordingFolders.get,
    openFolderId ? { folderId: openFolderId } : "skip",
  );
  const recordings = useQuery(convexApi.presentRecordings.list, {
    folderId: openFolderId ?? null,
  });
  const createFolder = useMutation(convexApi.presentRecordingFolders.create);
  const renameFolder = useMutation(convexApi.presentRecordingFolders.rename);
  const removeFolder = useMutation(convexApi.presentRecordingFolders.remove);
  const removeRecording = useAction(convexApi.presentBlob.removeRecording);
  const renameRecording = useMutation(convexApi.presentRecordings.rename);
  const moveRecording = useMutation(convexApi.presentRecordings.move);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [previewRecording, setPreviewRecording] = useState<RecordingRow | null>(
    null,
  );
  const [pendingDeleteRecording, setPendingDeleteRecording] =
    useState<RecordingRow | null>(null);
  const [pendingDeleteFolder, setPendingDeleteFolder] =
    useState<FolderRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renamingRecordingId, setRenamingRecordingId] =
    useState<Id<"presentRecordings"> | null>(null);
  const [renamingFolderId, setRenamingFolderId] =
    useState<Id<"presentRecordingFolders"> | null>(null);
  const [draftName, setDraftName] = useState("");
  const folderRenameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    persistOpenRecordingFolderId(openFolderId);
  }, [openFolderId]);

  useEffect(() => {
    if (openFolderId && openFolder === null) {
      setOpenFolderId(null);
    }
  }, [openFolder, openFolderId, setOpenFolderId]);

  useEffect(() => {
    if (!renamingFolderId || !openFolderId) {
      return;
    }
    folderRenameRef.current?.focus();
    folderRenameRef.current?.select();
  }, [renamingFolderId, openFolderId]);

  const openFolderById = (folderId: Id<"presentRecordingFolders">) => {
    setOpenFolderId(folderId);
    setRenamingRecordingId(null);
    setOpenMenuId(null);
  };

  const commitRecordingRename = async () => {
    if (!renamingRecordingId) {
      return;
    }
    const id = renamingRecordingId;
    const name = draftName;
    setRenamingRecordingId(null);
    try {
      await renameRecording({ recordingId: id, name });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not rename recording.";
      api?.setToast({ message, closable: true });
    }
  };

  const commitFolderRename = async () => {
    if (!renamingFolderId) {
      return;
    }
    const id = renamingFolderId;
    const name = draftName.trim();
    setRenamingFolderId(null);
    if (!name) {
      return;
    }
    try {
      await renameFolder({ folderId: id, name });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not rename folder.";
      api?.setToast({ message, closable: true });
    }
  };

  const onCreateFolder = async () => {
    try {
      const nextIndex = (folders?.length ?? 0) + 1;
      const name = `Folder ${nextIndex}`;
      const folderId = await createFolder({ name });
      openFolderById(folderId);
      setDraftName(name);
      setRenamingFolderId(folderId);
    } catch (error) {
      api?.setToast({
        message:
          error instanceof Error ? error.message : "Could not create folder.",
        closable: true,
      });
    }
  };

  const renderRecordingList = (rows: RecordingRow[]) => (
    <ul className="jayrr-present__recordings-list">
      {rows.map((row) => (
        <RecordingCard
          key={row._id}
          row={row}
          folders={folders ?? []}
          menuOpen={openMenuId === row._id}
          renaming={renamingRecordingId === row._id}
          draftName={draftName}
          onMenuToggle={() => {
            setOpenMenuId((current) => (current === row._id ? null : row._id));
          }}
          onDelete={() => {
            setPendingDeleteRecording(row);
          }}
          onStartRename={() => {
            setDraftName(row.name ?? "");
            setRenamingRecordingId(row._id);
          }}
          onDraftChange={setDraftName}
          onCommitRename={() => {
            void commitRecordingRename();
          }}
          onCancelRename={() => {
            setRenamingRecordingId(null);
          }}
          onPreview={() => {
            setOpenMenuId(null);
            setPreviewRecording(row);
          }}
          onMove={(folderId) => {
            void (async () => {
              try {
                await moveRecording({ recordingId: row._id, folderId });
              } catch (error) {
                const message =
                  error instanceof Error
                    ? error.message
                    : "Could not move recording.";
                api?.setToast({ message, closable: true });
              }
            })();
          }}
        />
      ))}
    </ul>
  );

  const previewDialog = previewRecording ? (
    <VideoPreviewDialog
      source={{
        url: previewRecording.url,
        posterUrl: previewRecording.posterUrl,
        title: recordingLabel(previewRecording),
        durationMs: previewRecording.durationMs,
      }}
      onClose={() => setPreviewRecording(null)}
    />
  ) : null;

  if (openFolderId && openFolder) {
    let body: ReactNode;
    if (recordings === undefined) {
      body = <p className="jayrr-present__empty">Loading recordings…</p>;
    } else if (recordings.length === 0) {
      body = (
        <p className="jayrr-present__empty">
          No recordings in this folder yet. Use Record on the Present tab.
        </p>
      );
    } else {
      body = renderRecordingList(recordings);
    }

    return (
      <RecordingsShell
        uploading={uploading}
        onBack={() => setOpenFolderId(null)}
        title={
          renamingFolderId === openFolder._id ? (
            <input
              ref={folderRenameRef}
              className="jayrr-present__folder-rename"
              value={draftName}
              aria-label="Folder name"
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={() => {
                void commitFolderRename();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  setRenamingFolderId(null);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="jayrr-present__folder-title"
              onClick={() => {
                setDraftName(openFolder.name);
                setRenamingFolderId(openFolder._id);
              }}
            >
              {openFolder.name}
            </button>
          )
        }
      >
        {body}
        {previewDialog}
        {pendingDeleteRecording ? (
          <DeleteRecordingDialog
            busy={deleting}
            onCancel={() => {
              if (!deleting) {
                setPendingDeleteRecording(null);
              }
            }}
            onConfirm={() => {
              void (async () => {
                setDeleting(true);
                try {
                  await removeRecording({
                    recordingId: pendingDeleteRecording._id,
                  });
                  setPendingDeleteRecording(null);
                } catch (error) {
                  const message =
                    error instanceof Error
                      ? error.message
                      : "Could not delete recording.";
                  api?.setToast({ message, closable: true });
                } finally {
                  setDeleting(false);
                }
              })();
            }}
          />
        ) : null}
      </RecordingsShell>
    );
  }

  const folderList = folders ?? [];
  const unfiled = recordings ?? [];
  const loading = folders === undefined || recordings === undefined;

  let body: ReactNode;
  if (loading) {
    body = <p className="jayrr-present__empty">Loading recordings…</p>;
  } else if (folderList.length === 0 && unfiled.length === 0) {
    body = (
      <div className="jayrr-present__empty-block">
        <p className="jayrr-present__empty">
          No recordings yet. Create a folder, or use Record on the Present tab.
        </p>
        <Button
          className="jayrr-present__create-folder"
          onSelect={() => {
            void onCreateFolder();
          }}
        >
          Create folder
        </Button>
      </div>
    );
  } else {
    body = (
      <>
        {folderList.length > 0 ? (
          <ul className="jayrr-scene-grid">
            {folderList.map((folder) => (
              <FolderCard
                key={folder._id}
                folder={folder}
                menuOpen={openMenuId === folder._id}
                renaming={renamingFolderId === folder._id}
                draftName={draftName}
                onOpen={() => openFolderById(folder._id)}
                onMenuToggle={() => {
                  setOpenMenuId((current) =>
                    current === folder._id ? null : folder._id,
                  );
                }}
                onStartRename={() => {
                  setDraftName(folder.name);
                  setRenamingFolderId(folder._id);
                }}
                onDraftChange={setDraftName}
                onCommitRename={() => {
                  void commitFolderRename();
                }}
                onCancelRename={() => {
                  setRenamingFolderId(null);
                }}
                onDelete={() => {
                  setPendingDeleteFolder(folder);
                }}
              />
            ))}
          </ul>
        ) : null}
        {unfiled.length > 0 ? (
          <>
            {folderList.length > 0 ? (
              <h3 className="jayrr-present__section-label">Unfiled</h3>
            ) : null}
            {renderRecordingList(unfiled)}
          </>
        ) : null}
      </>
    );
  }

  return (
    <RecordingsShell
      uploading={uploading}
      title="Recordings"
      footer={
        folderList.length > 0 || unfiled.length > 0 ? (
          <div className="jayrr-present__recordings-footer">
            <Button
              className="jayrr-present__create-folder"
              onSelect={() => {
                void onCreateFolder();
              }}
            >
              Create folder
            </Button>
          </div>
        ) : null
      }
    >
      {body}
      {previewDialog}
      {pendingDeleteRecording ? (
        <DeleteRecordingDialog
          busy={deleting}
          onCancel={() => {
            if (!deleting) {
              setPendingDeleteRecording(null);
            }
          }}
          onConfirm={() => {
            void (async () => {
              setDeleting(true);
              try {
                await removeRecording({
                  recordingId: pendingDeleteRecording._id,
                });
                setPendingDeleteRecording(null);
              } catch (error) {
                const message =
                  error instanceof Error
                    ? error.message
                    : "Could not delete recording.";
                api?.setToast({ message, closable: true });
              } finally {
                setDeleting(false);
              }
            })();
          }}
        />
      ) : null}
      {pendingDeleteFolder ? (
        <JayrrConfirmDialog
          title={`Delete "${pendingDeleteFolder.name}"?`}
          info="Removes the folder. Recordings inside move back to Recordings."
          busy={deleting}
          onCancel={() => {
            if (!deleting) {
              setPendingDeleteFolder(null);
            }
          }}
          onConfirm={() => {
            void (async () => {
              setDeleting(true);
              try {
                await removeFolder({ folderId: pendingDeleteFolder._id });
                setPendingDeleteFolder(null);
              } catch (error) {
                const message =
                  error instanceof Error
                    ? error.message
                    : "Could not delete folder.";
                api?.setToast({ message, closable: true });
              } finally {
                setDeleting(false);
              }
            })();
          }}
        />
      ) : null}
    </RecordingsShell>
  );
};

const DeleteRecordingDialog = ({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  return (
    <JayrrConfirmDialog
      title="Delete recording"
      info="Removes this clip from Recordings. This cannot be undone."
      busy={busy}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
};
