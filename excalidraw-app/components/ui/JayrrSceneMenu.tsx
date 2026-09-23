import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Component, useEffect, useRef, useState } from "react";

import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import DropdownMenu from "@excalidraw/excalidraw/components/dropdownMenu/DropdownMenu";
import {
  DeviceFloppyIcon,
  DotsHorizontalIcon,
  FilePlusIcon,
  FolderPlusIcon,
  TrashIcon,
  chevronLeftIcon,
} from "@excalidraw/excalidraw/components/icons";

import { appJotaiStore, useAtom } from "../../app-jotai";
import { api, convexClient, isConvexLinked } from "../../convexClient";
import {
  activeSceneIdAtom,
  applySceneJsonToCanvas,
  buildScenePreviewDataUrl,
  nextSceneName,
  openBlankCanvas,
  openSceneFolderIdAtom,
  persistOpenSceneFolderId,
  serializeCurrentCanvas,
  setActiveSceneId,
} from "../../data/jayrrScenes";

import { JayrrConfirmDialog } from "./JayrrConfirmDialog";
import "./JayrrLibraryMenu.scss";

import type { DragEvent, ReactNode, RefObject } from "react";

import type { Id } from "../../../convex/_generated/dataModel";

const SCENE_AUTOSAVE_DELAY_MS = 1000;
const JAYRR_SCENE_DRAG = "application/x-jayrr-scene";

let draggingSceneId: Id<"scenes"> | null = null;

const readDraggedSceneId = (dataTransfer: DataTransfer) => {
  const fromTransfer = dataTransfer.getData(JAYRR_SCENE_DRAG);
  if (fromTransfer) {
    return fromTransfer as Id<"scenes">;
  }
  return draggingSceneId;
};

const acceptSceneDrop = (event: DragEvent) => {
  const types = Array.from(event.dataTransfer.types);
  if (!draggingSceneId && !types.includes(JAYRR_SCENE_DRAG)) {
    return false;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  return true;
};

type MenuTarget =
  | { kind: "scene"; id: Id<"scenes"> }
  | { kind: "folder"; id: Id<"sceneFolders"> };

type PendingDelete = MenuTarget & { name: string };

class SceneMenuErrorBoundary extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return {
      message: error instanceof Error ? error.message : "Scenes failed to load",
    };
  }

  render() {
    if (this.state.message) {
      return (
        <div className="layer-ui__library jayrr-library">
          <div className="library-menu-items__no-items">
            <div className="library-menu-items__no-items__label">
              Scenes unavailable
            </div>
            <div className="library-menu-items__no-items__hint">
              {this.state.message}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const JayrrSceneMenu = () => {
  if (!isConvexLinked) {
    return (
      <div className="layer-ui__library jayrr-library">
        <div className="library-menu-items__no-items">
          <div className="library-menu-items__no-items__label">
            Scenes need Convex
          </div>
          <div className="library-menu-items__no-items__hint">
            Add VITE_CONVEX_URL, then restart the app.
          </div>
        </div>
      </div>
    );
  }

  return <JayrrSceneMenuAuthed />;
};

const JayrrSceneMenuAuthed = () => {
  const { isAuthenticated } = useConvexAuth();

  return (
    <SceneMenuErrorBoundary key={isAuthenticated ? "in" : "out"}>
      <JayrrSceneMenuConnected />
    </SceneMenuErrorBoundary>
  );
};

const JayrrSceneMenuConnected = () => {
  const excalidrawAPI = useExcalidrawAPI();
  const [activeSceneId] = useAtom(activeSceneIdAtom);
  const [openFolderId, setOpenFolderIdAtom] = useAtom(openSceneFolderIdAtom);
  const [openMenu, setOpenMenu] = useState<MenuTarget | null>(null);
  const [renaming, setRenaming] = useState<MenuTarget | null>(null);
  const [draftName, setDraftName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);
  const saveQueueRef = useRef(Promise.resolve());
  const skipAutosaveRef = useRef(false);
  const sceneBoundRef = useRef(false);
  const lastSavedIdRef = useRef<Id<"scenes"> | null>(null);
  const lastSavedJsonRef = useRef<string | null>(null);
  const lastErrorRef = useRef<string | null>(null);

  const { isAuthenticated } = useConvexAuth();
  const folders = useQuery(
    api.sceneFolders.list,
    isAuthenticated ? {} : "skip",
  );
  const openFolder = useQuery(
    api.sceneFolders.get,
    openFolderId ? { folderId: openFolderId } : "skip",
  );
  const scenes = useQuery(
    api.scenes.list,
    isAuthenticated ? { folderId: openFolderId ?? null } : "skip",
  );
  const createScene = useMutation(api.scenes.create);
  const updateScene = useMutation(api.scenes.update);
  const renameScene = useMutation(api.scenes.rename);
  const moveScene = useMutation(api.scenes.move);
  const removeScene = useMutation(api.scenes.remove);
  const createFolder = useMutation(api.sceneFolders.create);
  const renameFolder = useMutation(api.sceneFolders.rename);
  const removeFolder = useMutation(api.sceneFolders.remove);

  const excalidrawAPIRef = useRef(excalidrawAPI);
  const updateSceneRef = useRef(updateScene);
  excalidrawAPIRef.current = excalidrawAPI;
  updateSceneRef.current = updateScene;

  useEffect(() => {
    persistOpenSceneFolderId(openFolderId);
  }, [openFolderId]);

  useEffect(() => {
    if (openFolderId && openFolder === null) {
      setOpenFolderIdAtom(null);
    }
  }, [openFolder, openFolderId, setOpenFolderIdAtom]);

  useEffect(() => {
    if (renaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renaming]);

  const toast = (message: string) => {
    excalidrawAPI?.setToast({ message, closable: true });
  };

  const rememberSaved = (sceneId: Id<"scenes">, sceneJson: string) => {
    lastSavedIdRef.current = sceneId;
    lastSavedJsonRef.current = sceneJson;
    sceneBoundRef.current = true;
    lastErrorRef.current = null;
  };

  const persistSceneNow = async (sceneId: Id<"scenes">) => {
    const canvas = excalidrawAPIRef.current;
    if (!canvas) {
      return;
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const elements = canvas.getSceneElements();
      if (!elements.length && !sceneBoundRef.current) {
        return;
      }
      let sceneJson = serializeCurrentCanvas(canvas);
      if (
        lastSavedIdRef.current === sceneId &&
        lastSavedJsonRef.current === sceneJson
      ) {
        return;
      }
      const previewDataUrl = elements.length
        ? await buildScenePreviewDataUrl(sceneJson)
        : "";
      sceneJson = serializeCurrentCanvas(canvas);
      const latestElements = canvas.getSceneElements();
      const payload: {
        sceneId: Id<"scenes">;
        sceneJson: string;
        previewDataUrl?: string;
      } = {
        sceneId,
        sceneJson,
      };
      if (!latestElements.length) {
        payload.previewDataUrl = "";
      } else if (previewDataUrl) {
        payload.previewDataUrl = previewDataUrl;
      }
      await updateSceneRef.current(payload);
      rememberSaved(sceneId, sceneJson);
      if (serializeCurrentCanvas(canvas) === sceneJson) {
        return;
      }
    }
  };

  const enqueuePersist = (sceneId: Id<"scenes">) => {
    const run = saveQueueRef.current
      .catch(() => undefined)
      .then(() => persistSceneNow(sceneId));
    saveQueueRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const enqueuePersistRef = useRef(enqueuePersist);
  enqueuePersistRef.current = enqueuePersist;

  const reportAutosaveError = (error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Could not save scene";
    if (lastErrorRef.current === message) {
      return;
    }
    lastErrorRef.current = message;
    excalidrawAPIRef.current?.setToast({ message, closable: true });
  };
  const reportAutosaveErrorRef = useRef(reportAutosaveError);
  reportAutosaveErrorRef.current = reportAutosaveError;

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }
    return excalidrawAPI.onChange(() => {
      if (skipAutosaveRef.current) {
        return;
      }
      const sceneId = appJotaiStore.get(activeSceneIdAtom);
      if (!sceneId) {
        return;
      }
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void enqueuePersistRef.current(sceneId).catch((error: unknown) => {
          reportAutosaveErrorRef.current(error);
        });
      }, SCENE_AUTOSAVE_DELAY_MS);
    });
  }, [excalidrawAPI]);

  useEffect(() => {
    const flush = () => {
      const sceneId = appJotaiStore.get(activeSceneIdAtom);
      if (!sceneId || skipAutosaveRef.current) {
        return;
      }
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void enqueuePersistRef.current(sceneId).catch(() => undefined);
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const clearPendingAutosave = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const openFolderById = (folderId: Id<"sceneFolders">) => {
    setOpenFolderIdAtom(folderId);
    setRenaming(null);
    setOpenMenu(null);
  };

  const onCreateFolder = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const nextIndex = (folders?.length ?? 0) + 1;
      const name = `Folder ${nextIndex}`;
      const folderId = await createFolder({ name });
      openFolderById(folderId);
      setDraftName(name);
      setRenaming({ kind: "folder", id: folderId });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not create folder");
    } finally {
      setBusy(false);
    }
  };

  const persistCurrentCanvas = async () => {
    if (activeSceneId) {
      await enqueuePersist(activeSceneId);
      return activeSceneId;
    }
    if (!excalidrawAPI) {
      return null;
    }
    if (!excalidrawAPI.getSceneElements().length) {
      return null;
    }
    const name = nextSceneName(scenes?.map((scene) => scene.name) ?? []);
    const sceneJson = serializeCurrentCanvas(excalidrawAPI);
    const sceneId = await createScene({
      name,
      sceneJson,
      previewDataUrl: await buildScenePreviewDataUrl(sceneJson),
      folderId: openFolderId ?? undefined,
    });
    rememberSaved(sceneId, sceneJson);
    setActiveSceneId(sceneId);
    setDraftName(name);
    setRenaming({ kind: "scene", id: sceneId });
    return sceneId;
  };

  const onSaveScene = async () => {
    if (!excalidrawAPI || busy) {
      return;
    }
    setBusy(true);
    clearPendingAutosave();
    skipAutosaveRef.current = true;
    try {
      const sceneId = await persistCurrentCanvas();
      if (!sceneId) {
        toast("Nothing to save");
        return;
      }
      toast("Scene saved");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save scene");
    } finally {
      skipAutosaveRef.current = false;
      setBusy(false);
    }
  };

  const onNewScene = async () => {
    if (!excalidrawAPI || busy) {
      return;
    }
    setBusy(true);
    clearPendingAutosave();
    skipAutosaveRef.current = true;
    try {
      if (activeSceneId || excalidrawAPI.getSceneElements().length > 0) {
        await persistCurrentCanvas();
      }
      sceneBoundRef.current = false;
      lastSavedIdRef.current = null;
      lastSavedJsonRef.current = null;
      openBlankCanvas(excalidrawAPI);
      toast("New scene");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not start a new scene",
      );
    } finally {
      skipAutosaveRef.current = false;
      setBusy(false);
    }
  };

  const onUpdateScene = async (sceneId: Id<"scenes">) => {
    if (!excalidrawAPI || busy) {
      return;
    }
    setBusy(true);
    clearPendingAutosave();
    try {
      await enqueuePersist(sceneId);
      setActiveSceneId(sceneId);
      toast("Scene updated");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not update scene");
    } finally {
      setBusy(false);
    }
  };

  const onLoadScene = async (sceneId: Id<"scenes">) => {
    if (!excalidrawAPI || busy) {
      return;
    }
    if (sceneId === activeSceneId) {
      return;
    }
    if (!convexClient) {
      return;
    }
    clearPendingAutosave();
    setBusy(true);
    skipAutosaveRef.current = true;
    try {
      let savedCurrent = false;
      if (activeSceneId) {
        await enqueuePersist(activeSceneId);
      } else if (excalidrawAPI.getSceneElements().length > 0) {
        const sceneJson = serializeCurrentCanvas(excalidrawAPI);
        await createScene({
          name: nextSceneName(scenes?.map((scene) => scene.name) ?? []),
          sceneJson,
          previewDataUrl: await buildScenePreviewDataUrl(sceneJson),
          folderId: openFolderId ?? undefined,
        });
        savedCurrent = true;
      }
      const scene = await convexClient.query(api.scenes.get, {
        sceneId,
      });
      if (!scene) {
        throw new Error("Scene not found");
      }
      applySceneJsonToCanvas(excalidrawAPI, scene.sceneJson);
      setActiveSceneId(scene._id);
      rememberSaved(scene._id, serializeCurrentCanvas(excalidrawAPI));
      toast(
        savedCurrent
          ? `Saved current canvas. Loaded ${scene.name}`
          : `Loaded ${scene.name}`,
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not load scene");
    } finally {
      skipAutosaveRef.current = false;
      setBusy(false);
    }
  };

  const onMoveScene = async (
    sceneId: Id<"scenes">,
    folderId: Id<"sceneFolders"> | null,
  ) => {
    try {
      await moveScene({ sceneId, folderId });
      toast(folderId ? "Moved to folder" : "Moved out of folder");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not move scene");
    }
  };

  const onConfirmDelete = async () => {
    if (!pendingDelete || busy) {
      return;
    }
    setBusy(true);
    try {
      if (pendingDelete.kind === "folder") {
        await removeFolder({ folderId: pendingDelete.id });
        if (openFolderId === pendingDelete.id) {
          setOpenFolderIdAtom(null);
        }
        toast(`Deleted ${pendingDelete.name}`);
      } else {
        await removeScene({ sceneId: pendingDelete.id });
        if (activeSceneId === pendingDelete.id) {
          clearPendingAutosave();
          sceneBoundRef.current = false;
          lastSavedIdRef.current = null;
          lastSavedJsonRef.current = null;
          setActiveSceneId(null);
        }
        toast(`Deleted ${pendingDelete.name}`);
      }
      setPendingDelete(null);
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : pendingDelete.kind === "folder"
          ? "Could not delete folder"
          : "Could not delete scene",
      );
    } finally {
      setBusy(false);
    }
  };

  const commitRename = async () => {
    if (!renaming) {
      return;
    }
    const name = draftName.trim();
    const target = renaming;
    setRenaming(null);
    if (!name) {
      return;
    }
    try {
      if (target.kind === "folder") {
        await renameFolder({ folderId: target.id, name });
      } else {
        await renameScene({ sceneId: target.id, name });
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "Rename failed");
    }
  };

  const isMenuOpen = (target: MenuTarget) =>
    openMenu?.kind === target.kind && openMenu.id === target.id;

  const isRenaming = (target: MenuTarget) =>
    renaming?.kind === target.kind && renaming.id === target.id;

  if (folders === undefined || scenes === undefined) {
    return (
      <div className="layer-ui__library jayrr-library">
        <div className="layer-ui__library-message">Loading scenes…</div>
      </div>
    );
  }

  if (openFolderId && openFolder) {
    return (
      <div className="layer-ui__library jayrr-library">
        <div className="jayrr-library__header">
          <button
            type="button"
            className="jayrr-library__icon-button"
            aria-label="Back to scenes. Drop a scene here to move it out of this folder."
            onClick={() => setOpenFolderIdAtom(null)}
            onDragOver={(event) => {
              if (busy) {
                return;
              }
              acceptSceneDrop(event);
              event.currentTarget.classList.add(
                "jayrr-library__icon-button--drop",
              );
            }}
            onDragLeave={(event) => {
              event.currentTarget.classList.remove(
                "jayrr-library__icon-button--drop",
              );
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.currentTarget.classList.remove(
                "jayrr-library__icon-button--drop",
              );
              const sceneId = readDraggedSceneId(event.dataTransfer);
              if (!sceneId || busy) {
                return;
              }
              void onMoveScene(sceneId, null);
            }}
          >
            {chevronLeftIcon}
          </button>
          {isRenaming({ kind: "folder", id: openFolder._id }) ? (
            <input
              ref={renameInputRef}
              className="jayrr-library__rename-input"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={() => {
                void commitRename();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  setRenaming(null);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="jayrr-library__title"
              onClick={() => {
                setDraftName(openFolder.name);
                setRenaming({ kind: "folder", id: openFolder._id });
              }}
            >
              {openFolder.name}
            </button>
          )}
          <SceneHeaderActions
            busy={busy}
            onCreateFolder={() => {
              void onCreateFolder();
            }}
            onNewScene={() => {
              void onNewScene();
            }}
            onSaveScene={() => {
              void onSaveScene();
            }}
          />
        </div>
        <div className="jayrr-library__body">
          {scenes.length === 0 ? (
            <div className="library-menu-items__no-items">
              <div className="library-menu-items__no-items__label">
                No scenes yet
              </div>
              <div className="library-menu-items__no-items__hint">
                Save the current canvas into this folder.
              </div>
            </div>
          ) : (
            <SceneGrid
              scenes={scenes}
              activeSceneId={activeSceneId}
              busy={busy}
              folders={folders}
              renameInputRef={renameInputRef}
              draftName={draftName}
              setDraftName={setDraftName}
              isRenaming={isRenaming}
              isMenuOpen={isMenuOpen}
              setOpenMenu={setOpenMenu}
              setRenaming={setRenaming}
              setPendingDelete={setPendingDelete}
              commitRename={commitRename}
              onLoadScene={onLoadScene}
              onUpdateScene={onUpdateScene}
              onMoveScene={onMoveScene}
            />
          )}
        </div>
        {pendingDelete ? (
          <DeleteConfirm
            pendingDelete={pendingDelete}
            busy={busy}
            onCancel={() => {
              if (!busy) {
                setPendingDelete(null);
              }
            }}
            onConfirm={() => {
              void onConfirmDelete();
            }}
          />
        ) : null}
      </div>
    );
  }

  const hasContent = folders.length > 0 || scenes.length > 0;

  return (
    <div className="layer-ui__library jayrr-library">
      <div className="jayrr-library__header">
        <div className="jayrr-library__title">Scenes</div>
        <SceneHeaderActions
          busy={busy}
          onCreateFolder={() => {
            void onCreateFolder();
          }}
          onNewScene={() => {
            void onNewScene();
          }}
          onSaveScene={() => {
            void onSaveScene();
          }}
        />
      </div>
      <div className="jayrr-library__body">
        {!hasContent ? (
          <div className="library-menu-items__no-items">
            <div className="library-menu-items__no-items__label">
              No scenes yet
            </div>
            <div className="library-menu-items__no-items__hint">
              Create a folder, or save the current canvas.
            </div>
          </div>
        ) : (
          <ul className="jayrr-scene-grid">
            {folders.map((folder) => (
              <FolderCard
                key={folder._id}
                folder={folder}
                busy={busy}
                renameInputRef={renameInputRef}
                draftName={draftName}
                setDraftName={setDraftName}
                renaming={isRenaming({ kind: "folder", id: folder._id })}
                menuOpen={isMenuOpen({ kind: "folder", id: folder._id })}
                setOpenMenu={setOpenMenu}
                setRenaming={setRenaming}
                setPendingDelete={setPendingDelete}
                commitRename={commitRename}
                onOpen={() => openFolderById(folder._id)}
                onDropScene={(sceneId) => {
                  void onMoveScene(sceneId, folder._id);
                }}
              />
            ))}
            {scenes.map((scene) => (
              <SceneCard
                key={scene._id}
                scene={scene}
                active={scene._id === activeSceneId}
                busy={busy}
                folders={folders}
                renameInputRef={renameInputRef}
                draftName={draftName}
                setDraftName={setDraftName}
                renaming={isRenaming({ kind: "scene", id: scene._id })}
                menuOpen={isMenuOpen({ kind: "scene", id: scene._id })}
                setOpenMenu={setOpenMenu}
                setRenaming={setRenaming}
                setPendingDelete={setPendingDelete}
                commitRename={commitRename}
                onLoad={() => {
                  void onLoadScene(scene._id);
                }}
                onUpdate={() => {
                  void onUpdateScene(scene._id);
                }}
                onMove={(folderId) => {
                  void onMoveScene(scene._id, folderId);
                }}
                onDragScene={() => setOpenMenu(null)}
              />
            ))}
          </ul>
        )}
      </div>
      {pendingDelete ? (
        <DeleteConfirm
          pendingDelete={pendingDelete}
          busy={busy}
          onCancel={() => {
            if (!busy) {
              setPendingDelete(null);
            }
          }}
          onConfirm={() => {
            void onConfirmDelete();
          }}
        />
      ) : null}
    </div>
  );
};

const SceneHeaderActions = ({
  busy,
  onCreateFolder,
  onNewScene,
  onSaveScene,
}: {
  busy: boolean;
  onCreateFolder: () => void;
  onNewScene: () => void;
  onSaveScene: () => void;
}) => {
  return (
    <div className="jayrr-library__header-actions">
      <button
        type="button"
        className="jayrr-library__icon-button"
        aria-label="Create folder"
        title="Create folder"
        disabled={busy}
        onClick={onCreateFolder}
      >
        {FolderPlusIcon}
      </button>
      <button
        type="button"
        className="jayrr-library__icon-button"
        aria-label="New scene"
        title="New scene"
        disabled={busy}
        onClick={onNewScene}
      >
        {FilePlusIcon}
      </button>
      <button
        type="button"
        className="jayrr-library__icon-button"
        aria-label="Save scene"
        title="Save scene"
        disabled={busy}
        onClick={onSaveScene}
      >
        {DeviceFloppyIcon}
      </button>
    </div>
  );
};

type SceneRow = {
  _id: Id<"scenes">;
  folderId: Id<"sceneFolders"> | null;
  name: string;
  previewDataUrl?: string;
};

type FolderRow = {
  _id: Id<"sceneFolders">;
  name: string;
  sceneCount: number;
};

const SceneGrid = ({
  scenes,
  activeSceneId,
  busy,
  folders,
  renameInputRef,
  draftName,
  setDraftName,
  isRenaming,
  isMenuOpen,
  setOpenMenu,
  setRenaming,
  setPendingDelete,
  commitRename,
  onLoadScene,
  onUpdateScene,
  onMoveScene,
}: {
  scenes: SceneRow[];
  activeSceneId: Id<"scenes"> | null;
  busy: boolean;
  folders: FolderRow[];
  renameInputRef: RefObject<HTMLInputElement | null>;
  draftName: string;
  setDraftName: (value: string) => void;
  isRenaming: (target: MenuTarget) => boolean;
  isMenuOpen: (target: MenuTarget) => boolean;
  setOpenMenu: (value: MenuTarget | null) => void;
  setRenaming: (value: MenuTarget | null) => void;
  setPendingDelete: (value: PendingDelete | null) => void;
  commitRename: () => void;
  onLoadScene: (sceneId: Id<"scenes">) => void;
  onUpdateScene: (sceneId: Id<"scenes">) => void;
  onMoveScene: (
    sceneId: Id<"scenes">,
    folderId: Id<"sceneFolders"> | null,
  ) => void;
}) => (
  <ul className="jayrr-scene-grid">
    {scenes.map((scene) => (
      <SceneCard
        key={scene._id}
        scene={scene}
        active={scene._id === activeSceneId}
        busy={busy}
        folders={folders}
        renameInputRef={renameInputRef}
        draftName={draftName}
        setDraftName={setDraftName}
        renaming={isRenaming({ kind: "scene", id: scene._id })}
        menuOpen={isMenuOpen({ kind: "scene", id: scene._id })}
        setOpenMenu={setOpenMenu}
        setRenaming={setRenaming}
        setPendingDelete={setPendingDelete}
        commitRename={commitRename}
        onLoad={() => onLoadScene(scene._id)}
        onUpdate={() => onUpdateScene(scene._id)}
        onMove={(folderId) => onMoveScene(scene._id, folderId)}
        onDragScene={() => setOpenMenu(null)}
      />
    ))}
  </ul>
);

const SceneCard = ({
  scene,
  active,
  busy,
  folders,
  renameInputRef,
  draftName,
  setDraftName,
  renaming,
  menuOpen,
  setOpenMenu,
  setRenaming,
  setPendingDelete,
  commitRename,
  onLoad,
  onUpdate,
  onMove,
  onDragScene,
}: {
  scene: SceneRow;
  active: boolean;
  busy: boolean;
  folders: FolderRow[];
  renameInputRef: RefObject<HTMLInputElement | null>;
  draftName: string;
  setDraftName: (value: string) => void;
  renaming: boolean;
  menuOpen: boolean;
  setOpenMenu: (value: MenuTarget | null) => void;
  setRenaming: (value: MenuTarget | null) => void;
  setPendingDelete: (value: PendingDelete | null) => void;
  commitRename: () => void;
  onLoad: () => void;
  onUpdate: () => void;
  onMove: (folderId: Id<"sceneFolders"> | null) => void;
  onDragScene: () => void;
}) => {
  const otherFolders = folders.filter(
    (folder) => folder._id !== scene.folderId,
  );

  return (
    <li
      className={
        active
          ? "jayrr-scene-card jayrr-scene-card--active"
          : "jayrr-scene-card"
      }
    >
      {renaming ? (
        <input
          ref={renameInputRef}
          className="jayrr-scene-card__name-input"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={() => {
            void commitRename();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void commitRename();
            }
            if (event.key === "Escape") {
              setRenaming(null);
            }
          }}
        />
      ) : (
        <span className="jayrr-scene-card__name">{scene.name}</span>
      )}
      <ScenePreviewButton
        name={scene.name}
        previewDataUrl={scene.previewDataUrl}
        sceneId={scene._id}
        busy={busy}
        draggable={!renaming && !busy}
        onLoad={onLoad}
        onDragScene={onDragScene}
      />
      <DropdownMenu open={menuOpen}>
        <DropdownMenu.Trigger
          className="jayrr-scene-card__menu"
          aria-label={`${scene.name} menu`}
          onToggle={() => {
            setOpenMenu(menuOpen ? null : { kind: "scene", id: scene._id });
          }}
        >
          {DotsHorizontalIcon}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          onClickOutside={() => setOpenMenu(null)}
          onSelect={() => setOpenMenu(null)}
        >
          <DropdownMenu.Item
            icon={SaveGlyph}
            disabled={busy}
            onSelect={onUpdate}
          >
            Save
          </DropdownMenu.Item>
          <DropdownMenu.Item
            icon={EditGlyph}
            onSelect={() => {
              setDraftName(scene.name);
              setRenaming({ kind: "scene", id: scene._id });
            }}
          >
            Rename
          </DropdownMenu.Item>
          {otherFolders.map((folder) => (
            <DropdownMenu.Item
              key={folder._id}
              icon={FolderGlyph}
              onSelect={() => onMove(folder._id)}
            >
              {`Move to ${folder.name}`}
            </DropdownMenu.Item>
          ))}
          {scene.folderId ? (
            <DropdownMenu.Item icon={FolderGlyph} onSelect={() => onMove(null)}>
              Move to unfiled
            </DropdownMenu.Item>
          ) : null}
          <DropdownMenu.Item
            icon={TrashIcon}
            onSelect={() => {
              setPendingDelete({
                kind: "scene",
                id: scene._id,
                name: scene.name,
              });
            }}
          >
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    </li>
  );
};

const FolderCard = ({
  folder,
  busy,
  renameInputRef,
  draftName,
  setDraftName,
  renaming,
  menuOpen,
  setOpenMenu,
  setRenaming,
  setPendingDelete,
  commitRename,
  onOpen,
  onDropScene,
}: {
  folder: FolderRow;
  busy: boolean;
  renameInputRef: RefObject<HTMLInputElement | null>;
  draftName: string;
  setDraftName: (value: string) => void;
  renaming: boolean;
  menuOpen: boolean;
  setOpenMenu: (value: MenuTarget | null) => void;
  setRenaming: (value: MenuTarget | null) => void;
  setPendingDelete: (value: PendingDelete | null) => void;
  commitRename: () => void;
  onOpen: () => void;
  onDropScene: (sceneId: Id<"scenes">) => void;
}) => {
  const [isOver, setIsOver] = useState(false);
  const skipClickRef = useRef(false);

  return (
    <li
      className={
        isOver ? "jayrr-scene-card jayrr-scene-card--drop" : "jayrr-scene-card"
      }
      onDragOver={(event) => {
        if (busy) {
          return;
        }
        if (!acceptSceneDrop(event)) {
          return;
        }
        setIsOver(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }
        setIsOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsOver(false);
        skipClickRef.current = true;
        const sceneId = readDraggedSceneId(event.dataTransfer);
        if (!sceneId || busy) {
          return;
        }
        onDropScene(sceneId);
      }}
    >
      {renaming ? (
        <input
          ref={renameInputRef}
          className="jayrr-scene-card__name-input"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={() => {
            void commitRename();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void commitRename();
            }
            if (event.key === "Escape") {
              setRenaming(null);
            }
          }}
        />
      ) : (
        <span className="jayrr-scene-card__name">{folder.name}</span>
      )}
      <button
        type="button"
        className="jayrr-scene-card__preview"
        aria-label={`Open ${folder.name}. Drop a scene here to move it in.`}
        disabled={busy}
        onClick={() => {
          if (skipClickRef.current) {
            skipClickRef.current = false;
            return;
          }
          onOpen();
        }}
      >
        <FolderCardThumbs
          folderId={folder._id}
          sceneCount={folder.sceneCount}
        />
      </button>
      <DropdownMenu open={menuOpen}>
        <DropdownMenu.Trigger
          className="jayrr-scene-card__menu"
          aria-label={`${folder.name} menu`}
          onToggle={() => {
            setOpenMenu(menuOpen ? null : { kind: "folder", id: folder._id });
          }}
        >
          {DotsHorizontalIcon}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          onClickOutside={() => setOpenMenu(null)}
          onSelect={() => setOpenMenu(null)}
        >
          <DropdownMenu.Item
            icon={EditGlyph}
            onSelect={() => {
              setDraftName(folder.name);
              setRenaming({ kind: "folder", id: folder._id });
            }}
          >
            Rename
          </DropdownMenu.Item>
          <DropdownMenu.Item
            icon={TrashIcon}
            onSelect={() => {
              setPendingDelete({
                kind: "folder",
                id: folder._id,
                name: folder.name,
              });
            }}
          >
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    </li>
  );
};

const FolderCardThumbs = ({
  folderId,
  sceneCount,
}: {
  folderId: Id<"sceneFolders">;
  sceneCount: number;
}) => {
  const scenes = useQuery(
    api.scenes.list,
    sceneCount > 0 ? { folderId } : "skip",
  );
  const previews = scenes?.slice(0, 4) ?? [];

  if (sceneCount === 0 || (scenes && previews.length === 0)) {
    return <span className="jayrr-scene-card__empty">Empty</span>;
  }

  return (
    <span className="jayrr-library-card__thumbs">
      {previews.map((scene) =>
        scene.previewDataUrl ? (
          <img
            key={scene._id}
            className="jayrr-library-card__thumb"
            alt=""
            src={scene.previewDataUrl}
          />
        ) : (
          <span key={scene._id} className="jayrr-library-card__thumb" />
        ),
      )}
    </span>
  );
};

const DeleteConfirm = ({
  pendingDelete,
  busy,
  onCancel,
  onConfirm,
}: {
  pendingDelete: PendingDelete;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => (
  <JayrrConfirmDialog
    title={`Delete "${pendingDelete.name}"?`}
    info={
      pendingDelete.kind === "folder"
        ? "Scenes in this folder move back to unfiled. You cannot undo it."
        : "This permanently removes the scene. You cannot undo it."
    }
    busy={busy}
    onCancel={onCancel}
    onConfirm={onConfirm}
  />
);

const ScenePreviewButton = ({
  name,
  previewDataUrl,
  sceneId,
  busy,
  draggable,
  onLoad,
  onDragScene,
}: {
  name: string;
  previewDataUrl?: string;
  sceneId: Id<"scenes">;
  busy: boolean;
  draggable: boolean;
  onLoad: () => void;
  onDragScene: () => void;
}) => {
  const [fallbackPreview, setFallbackPreview] = useState<string | undefined>();
  const draggedRef = useRef(false);

  useEffect(() => {
    const client = convexClient;
    if (previewDataUrl || !client) {
      setFallbackPreview(undefined);
      return;
    }
    let cancelled = false;
    const loadPreview = async () => {
      try {
        const scene = await client.query(api.scenes.get, {
          sceneId,
        });
        if (!scene || cancelled) {
          return;
        }
        const dataUrl = await buildScenePreviewDataUrl(scene.sceneJson);
        if (!cancelled) {
          setFallbackPreview(dataUrl);
        }
      } catch {
        if (!cancelled) {
          setFallbackPreview(undefined);
        }
      }
    };
    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [previewDataUrl, sceneId]);

  const src = previewDataUrl ?? fallbackPreview;

  return (
    <button
      type="button"
      className="jayrr-scene-card__preview"
      disabled={busy}
      draggable={draggable}
      onDragStart={(event) => {
        draggedRef.current = true;
        draggingSceneId = sceneId;
        event.dataTransfer.setData(JAYRR_SCENE_DRAG, sceneId);
        event.dataTransfer.effectAllowed = "move";
        onDragScene();
      }}
      onDragEnd={() => {
        draggingSceneId = null;
        window.setTimeout(() => {
          draggedRef.current = false;
        }, 0);
      }}
      onClick={() => {
        if (draggedRef.current) {
          return;
        }
        onLoad();
      }}
    >
      {src ? (
        <img alt={name} src={src} draggable={false} />
      ) : (
        <span className="jayrr-scene-card__empty">Empty</span>
      )}
    </button>
  );
};

const SaveGlyph = (
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
    <path d="M5 4h11l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
    <path d="M8 4v5h8" />
    <path d="M8 20v-6h8v6" />
  </svg>
);

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

const FolderGlyph = (
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
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);
