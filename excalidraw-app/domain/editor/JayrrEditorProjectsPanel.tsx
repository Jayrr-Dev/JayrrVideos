import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import DropdownMenu from "@excalidraw/excalidraw/components/dropdownMenu/DropdownMenu";
import {
  chevronLeftIcon,
  DotsHorizontalIcon,
  FolderPlusIcon,
  TrashIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import { useAtom } from "../../app-jotai";
import { JayrrConfirmDialog } from "../../components/ui";
import { LibrariesPane } from "../../components/ui/librariesChrome";
import { api as convexApi, isConvexLinked } from "../../convexClient";
import {
  formatRecordingClock,
  formatRecordingWhen,
} from "../recordings/formatRecording";

import "../../components/ui/JayrrLibraryMenu.scss";
import "../../present/JayrrPresentPanel.scss";

import { useJayrrEditorSession } from "./JayrrEditorSession";
import {
  openEditorProjectFolderIdAtom,
  persistOpenEditorProjectFolderId,
} from "./openEditorProjectFolder";

import type { Id } from "../../../convex/_generated/dataModel";

type ProjectRow = {
  _id: Id<"editorProjects">;
  folderId: Id<"editorProjectFolders"> | null;
  name: string;
  durationMs: number;
  clipCount: number;
  updatedAt: number;
};

type FolderRow = {
  _id: Id<"editorProjectFolders">;
  name: string;
  projectCount: number;
  updatedAt: number;
};

const openCardMenu = (
  event: MouseEvent,
  renaming: boolean,
  menuOpen: boolean,
  onMenuToggle: () => void,
) => {
  event.preventDefault();
  if (renaming || menuOpen) {
    return;
  }
  onMenuToggle();
};

const EditGlyph = (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
    <path
      d="M4 14.6 13.4 5.2l2.4 2.4L6.4 17H4z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const ProjectCard = ({
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
  onOpen,
}: {
  row: ProjectRow;
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
  onMove: (folderId: Id<"editorProjectFolders"> | null) => void;
  onOpen: () => void;
}) => {
  const clock = formatRecordingClock(row.durationMs);
  const when = formatRecordingWhen(row.updatedAt);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const moveTargets = folders.filter((folder) => folder._id !== row.folderId);
  const clipsLabel = `${row.clipCount} ${
    row.clipCount === 1 ? "clip" : "clips"
  }`;

  useEffect(() => {
    if (!renaming) {
      return;
    }
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [renaming]);

  return (
    <li
      className="jayrr-present__recording"
      onContextMenu={(event) =>
        openCardMenu(event, renaming, menuOpen, onMenuToggle)
      }
    >
      {renaming ? (
        <input
          ref={nameInputRef}
          className="jayrr-present__recording-name-input"
          value={draftName}
          aria-label="Project name"
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
        <span className="jayrr-present__recording-name">{row.name}</span>
      )}
      <button
        type="button"
        className="jayrr-present__recording-thumb"
        aria-label={`Open ${row.name}`}
        title="Double-click to open"
        onMouseDown={(event) => {
          if (event.detail > 1) {
            event.preventDefault();
          }
        }}
        onClick={(event) => {
          if (event.detail === 0) {
            onOpen();
          }
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          onOpen();
        }}
      >
        <span className="jayrr-scene-card__empty">{clipsLabel}</span>
        <span className="jayrr-present__recording-clock">{clock}</span>
      </button>
      <div className="jayrr-present__recording-meta">
        <span className="jayrr-present__recording-when">{when}</span>
        <DropdownMenu open={menuOpen}>
          <DropdownMenu.Trigger
            className="jayrr-present__recording-menu"
            aria-label={`${row.name} menu`}
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
            <DropdownMenu.Item onSelect={onOpen}>Open</DropdownMenu.Item>
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
                Move to Docs
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

  useEffect(() => {
    if (!renaming) {
      return;
    }
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [renaming]);

  return (
    <li
      className="jayrr-scene-card"
      onContextMenu={(event) =>
        openCardMenu(event, renaming, menuOpen, onMenuToggle)
      }
    >
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
        {folder.projectCount === 0 ? (
          <span className="jayrr-scene-card__empty">Empty</span>
        ) : (
          <span className="jayrr-scene-card__empty">
            {folder.projectCount}{" "}
            {folder.projectCount === 1 ? "project" : "projects"}
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

export const JayrrEditorProjectsPanel = () => {
  if (!isConvexLinked) {
    return (
      <ProjectsShell>
        <p className="jayrr-present__empty">Sign in to store projects here.</p>
      </ProjectsShell>
    );
  }

  return <JayrrEditorProjectsAuthed />;
};

const ProjectsShell = ({
  actions,
  title,
  onBack,
  children,
}: {
  actions?: ReactNode;
  title?: ReactNode;
  onBack?: () => void;
  children: ReactNode;
}) => {
  return (
    <LibrariesPane
      className="jayrr-present jayrr-present--recordings"
      actions={actions}
      title={title}
      back={
        onBack ? (
          <button
            type="button"
            className="jayrr-library__icon-button"
            aria-label="Back to projects"
            onClick={onBack}
          >
            {chevronLeftIcon}
          </button>
        ) : undefined
      }
    >
      <span className="jayrr-present__sr">
        Saved editor projects in folders. Double-click a project card to load it
        into the video editor.
      </span>
      <div className="jayrr-present__recordings-body">{children}</div>
    </LibrariesPane>
  );
};

const JayrrEditorProjectsAuthed = () => {
  const api = useExcalidrawAPI();
  const { isAuthenticated } = useConvexAuth();
  const { loadProject } = useJayrrEditorSession();
  const [openFolderId, setOpenFolderId] = useAtom(
    openEditorProjectFolderIdAtom,
  );
  const folders = useQuery(
    convexApi.editorProjectFolders.list,
    isAuthenticated ? {} : "skip",
  );
  const openFolder = useQuery(
    convexApi.editorProjectFolders.get,
    isAuthenticated && openFolderId ? { folderId: openFolderId } : "skip",
  );
  const projects = useQuery(
    convexApi.editorProjects.list,
    isAuthenticated ? { folderId: openFolderId ?? null } : "skip",
  );
  const createFolder = useMutation(convexApi.editorProjectFolders.create);
  const renameFolder = useMutation(convexApi.editorProjectFolders.rename);
  const removeFolder = useMutation(convexApi.editorProjectFolders.remove);
  const removeProject = useMutation(convexApi.editorProjects.remove);
  const renameProject = useMutation(convexApi.editorProjects.rename);
  const moveProject = useMutation(convexApi.editorProjects.move);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] =
    useState<ProjectRow | null>(null);
  const [pendingDeleteFolder, setPendingDeleteFolder] =
    useState<FolderRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renamingProjectId, setRenamingProjectId] =
    useState<Id<"editorProjects"> | null>(null);
  const [renamingFolderId, setRenamingFolderId] =
    useState<Id<"editorProjectFolders"> | null>(null);
  const [draftName, setDraftName] = useState("");
  const folderRenameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    persistOpenEditorProjectFolderId(openFolderId);
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

  if (!isAuthenticated) {
    return (
      <ProjectsShell>
        <p className="jayrr-present__empty">Sign in to store projects here.</p>
      </ProjectsShell>
    );
  }

  const openFolderById = (folderId: Id<"editorProjectFolders">) => {
    setOpenFolderId(folderId);
    setRenamingProjectId(null);
    setOpenMenuId(null);
  };

  const commitProjectRename = async () => {
    if (!renamingProjectId) {
      return;
    }
    const id = renamingProjectId;
    const name = draftName.trim();
    setRenamingProjectId(null);
    if (!name) {
      return;
    }
    try {
      await renameProject({ projectId: id, name });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not rename project.";
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

  const folderAction = (
    <button
      type="button"
      className="jayrr-library__icon-button"
      aria-label="Create folder"
      title="Create folder"
      onClick={() => {
        void onCreateFolder();
      }}
    >
      {FolderPlusIcon}
    </button>
  );

  const onOpenProject = async (row: ProjectRow) => {
    try {
      await loadProject(row._id);
    } catch (error) {
      api?.setToast({
        message:
          error instanceof Error ? error.message : "Could not load project.",
        closable: true,
      });
    }
  };

  const renderProjectList = (rows: ProjectRow[]) => (
    <ul className="jayrr-present__recordings-list">
      {rows.map((row) => (
        <ProjectCard
          key={row._id}
          row={row}
          folders={folders ?? []}
          menuOpen={openMenuId === row._id}
          renaming={renamingProjectId === row._id}
          draftName={draftName}
          onMenuToggle={() => {
            setOpenMenuId((current) => (current === row._id ? null : row._id));
          }}
          onDelete={() => {
            setPendingDeleteProject(row);
          }}
          onStartRename={() => {
            setDraftName(row.name);
            setRenamingProjectId(row._id);
          }}
          onDraftChange={setDraftName}
          onCommitRename={() => {
            void commitProjectRename();
          }}
          onCancelRename={() => {
            setRenamingProjectId(null);
          }}
          onOpen={() => {
            setOpenMenuId(null);
            void onOpenProject(row);
          }}
          onMove={(folderId) => {
            void (async () => {
              try {
                await moveProject({ projectId: row._id, folderId });
              } catch (error) {
                const message =
                  error instanceof Error
                    ? error.message
                    : "Could not move project.";
                api?.setToast({ message, closable: true });
              }
            })();
          }}
        />
      ))}
    </ul>
  );

  const deleteProjectDialog = pendingDeleteProject ? (
    <JayrrConfirmDialog
      title={`Delete "${pendingDeleteProject.name}"?`}
      info="Removes this project from Libraries. This cannot be undone."
      busy={deleting}
      onCancel={() => {
        if (!deleting) {
          setPendingDeleteProject(null);
        }
      }}
      onConfirm={() => {
        void (async () => {
          setDeleting(true);
          try {
            await removeProject({ projectId: pendingDeleteProject._id });
            setPendingDeleteProject(null);
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "Could not delete project.";
            api?.setToast({ message, closable: true });
          } finally {
            setDeleting(false);
          }
        })();
      }}
    />
  ) : null;

  if (openFolderId && openFolder) {
    let body: ReactNode;
    if (projects === undefined) {
      body = <p className="jayrr-present__empty">Loading projects…</p>;
    } else if (projects.length === 0) {
      body = (
        <p className="jayrr-present__empty">
          No projects in this folder yet. Save from the video editor.
        </p>
      );
    } else {
      body = renderProjectList(projects);
    }

    return (
      <ProjectsShell
        actions={folderAction}
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
              className="jayrr-library__title"
              title="Double-click to rename"
              onDoubleClick={() => {
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
        {deleteProjectDialog}
      </ProjectsShell>
    );
  }

  const folderList = folders ?? [];
  const unfiled = projects ?? [];
  const loading = folders === undefined || projects === undefined;

  let body: ReactNode;
  if (loading) {
    body = <p className="jayrr-present__empty">Loading projects…</p>;
  } else if (folderList.length === 0 && unfiled.length === 0) {
    body = (
      <div className="jayrr-present__empty-block">
        <p className="jayrr-present__empty">
          No projects yet. Create a folder, or save from the video editor.
        </p>
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
            {renderProjectList(unfiled)}
          </>
        ) : null}
      </>
    );
  }

  return (
    <ProjectsShell actions={folderAction}>
      {body}
      {deleteProjectDialog}
      {pendingDeleteFolder ? (
        <JayrrConfirmDialog
          title={`Delete "${pendingDeleteFolder.name}"?`}
          info="Removes the folder. Projects inside move back to the list."
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
    </ProjectsShell>
  );
};
