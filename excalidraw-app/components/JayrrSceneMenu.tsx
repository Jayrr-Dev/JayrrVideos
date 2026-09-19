import { useMutation, useQuery } from "convex/react";
import { Component, useEffect, useRef, useState } from "react";

import { Button, useExcalidrawAPI } from "@excalidraw/excalidraw";
import DropdownMenu from "@excalidraw/excalidraw/components/dropdownMenu/DropdownMenu";
import {
  DotsHorizontalIcon,
  TrashIcon,
} from "@excalidraw/excalidraw/components/icons";
import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";

import { useAtom } from "../app-jotai";
import { api, convexClient, isConvexLinked } from "../convexClient";
import {
  activeSceneIdAtom,
  applySceneJsonToCanvas,
  buildScenePreviewDataUrl,
  nextSceneName,
  serializeCurrentCanvas,
  setActiveSceneId,
} from "../data/jayrrScenes";
import { getOwnerKey } from "../data/ownerKey";

import "./JayrrLibraryMenu.scss";

import type { ReactNode } from "react";

import type { Id } from "../../convex/_generated/dataModel";

const ownerKey = getOwnerKey();

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

  return (
    <SceneMenuErrorBoundary>
      <JayrrSceneMenuConnected />
    </SceneMenuErrorBoundary>
  );
};

const JayrrSceneMenuConnected = () => {
  const excalidrawAPI = useExcalidrawAPI();
  const [activeSceneId] = useAtom(activeSceneIdAtom);
  const [openMenuId, setOpenMenuId] = useState<Id<"scenes"> | null>(null);
  const [renamingId, setRenamingId] = useState<Id<"scenes"> | null>(null);
  const [draftName, setDraftName] = useState("");
  const [busy, setBusy] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const scenes = useQuery(api.scenes.list, { ownerKey });
  const createScene = useMutation(api.scenes.create);
  const updateScene = useMutation(api.scenes.update);
  const renameScene = useMutation(api.scenes.rename);
  const removeScene = useMutation(api.scenes.remove);

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  const toast = (message: string) => {
    excalidrawAPI?.setToast({ message, closable: true });
  };

  const confirmOverwrite = async () => {
    const elements = excalidrawAPI?.getSceneElements() ?? [];
    if (!elements.length) {
      return true;
    }
    return openConfirmModal({
      title: "Load scene?",
      description: "This replaces the current canvas with the saved scene.",
      actionLabel: "Load scene",
      color: "warning",
    });
  };

  const onSaveCanvas = async () => {
    if (!excalidrawAPI || busy) {
      return;
    }
    setBusy(true);
    try {
      const sceneJson = serializeCurrentCanvas(excalidrawAPI);
      const sceneId = await createScene({
        ownerKey,
        name: nextSceneName(scenes?.map((scene) => scene.name) ?? []),
        sceneJson,
        previewDataUrl: await buildScenePreviewDataUrl(sceneJson),
      });
      setDraftName(
        scenes?.find((scene) => scene._id === sceneId)?.name ?? "Scene",
      );
      setRenamingId(sceneId);
      setActiveSceneId(sceneId);
      toast("Canvas saved as a scene");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save scene");
    } finally {
      setBusy(false);
    }
  };

  const onUpdateScene = async (sceneId: Id<"scenes">) => {
    if (!excalidrawAPI || busy) {
      return;
    }
    setBusy(true);
    try {
      const sceneJson = serializeCurrentCanvas(excalidrawAPI);
      await updateScene({
        ownerKey,
        sceneId,
        sceneJson,
        previewDataUrl: await buildScenePreviewDataUrl(sceneJson),
      });
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
    if (!(await confirmOverwrite())) {
      return;
    }
    if (!convexClient) {
      return;
    }
    setBusy(true);
    try {
      const scene = await convexClient.query(api.scenes.get, {
        ownerKey,
        sceneId,
      });
      if (!scene) {
        throw new Error("Scene not found");
      }
      applySceneJsonToCanvas(excalidrawAPI, scene.sceneJson);
      setActiveSceneId(scene._id);
      toast(`Loaded ${scene.name}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not load scene");
    } finally {
      setBusy(false);
    }
  };

  const commitRename = async () => {
    if (!renamingId) {
      return;
    }
    const name = draftName.trim();
    setRenamingId(null);
    if (!name) {
      return;
    }
    try {
      await renameScene({ ownerKey, sceneId: renamingId, name });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Rename failed");
    }
  };

  if (scenes === undefined) {
    return (
      <div className="layer-ui__library jayrr-library">
        <div className="layer-ui__library-message">Loading scenes…</div>
      </div>
    );
  }

  return (
    <div className="layer-ui__library jayrr-library">
      <div className="jayrr-library__header">
        <div className="jayrr-library__title">Scenes</div>
      </div>
      <div className="jayrr-library__body">
        {scenes.length === 0 ? (
          <div className="library-menu-items__no-items">
            <div className="library-menu-items__no-items__label">
              No scenes yet
            </div>
            <div className="library-menu-items__no-items__hint">
              Save the current canvas to keep it in Convex.
            </div>
          </div>
        ) : (
          <ul className="jayrr-scene-grid">
            {scenes.map((scene) => (
              <li
                key={scene._id}
                className={
                  scene._id === activeSceneId
                    ? "jayrr-scene-card jayrr-scene-card--active"
                    : "jayrr-scene-card"
                }
              >
                {renamingId === scene._id ? (
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
                        setRenamingId(null);
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
                  onLoad={() => {
                    void onLoadScene(scene._id);
                  }}
                />
                <DropdownMenu open={openMenuId === scene._id}>
                  <DropdownMenu.Trigger
                    className="jayrr-scene-card__menu"
                    aria-label={`${scene.name} menu`}
                    onToggle={() => {
                      setOpenMenuId((current) =>
                        current === scene._id ? null : scene._id,
                      );
                    }}
                  >
                    {DotsHorizontalIcon}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    onClickOutside={() => setOpenMenuId(null)}
                    onSelect={() => setOpenMenuId(null)}
                  >
                    <DropdownMenu.Item
                      icon={SaveGlyph}
                      disabled={busy}
                      onSelect={() => {
                        void onUpdateScene(scene._id);
                      }}
                    >
                      Save
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      icon={EditGlyph}
                      onSelect={() => {
                        setDraftName(scene.name);
                        setRenamingId(scene._id);
                      }}
                    >
                      Rename
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      icon={TrashIcon}
                      onSelect={() => {
                        if (window.confirm(`Delete "${scene.name}"?`)) {
                          void removeScene({
                            ownerKey,
                            sceneId: scene._id,
                          }).then(() => {
                            if (activeSceneId === scene._id) {
                              setActiveSceneId(null);
                            }
                          });
                        }
                      }}
                    >
                      Delete
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="jayrr-library__footer">
        <Button
          className="jayrr-library__create"
          disabled={busy}
          onSelect={() => {
            void onSaveCanvas();
          }}
        >
          Save canvas as scene
        </Button>
      </div>
    </div>
  );
};

const ScenePreviewButton = ({
  name,
  previewDataUrl,
  sceneId,
  busy,
  onLoad,
}: {
  name: string;
  previewDataUrl?: string;
  sceneId: Id<"scenes">;
  busy: boolean;
  onLoad: () => void;
}) => {
  const [fallbackPreview, setFallbackPreview] = useState<string | undefined>();

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
          ownerKey,
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
      onClick={onLoad}
    >
      {src ? (
        <img alt={name} src={src} />
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
