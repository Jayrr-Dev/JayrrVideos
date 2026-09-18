import { useMutation, useQuery } from "convex/react";
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Button,
  exportToSvg,
  restoreLibraryItems,
  useExcalidrawAPI,
  useExcalidrawStateValue,
} from "@excalidraw/excalidraw";
import {
  LoadIcon,
  PlusIcon,
  TrashIcon,
  chevronLeftIcon,
} from "@excalidraw/excalidraw/components/icons";

import type { BinaryFiles } from "@excalidraw/excalidraw/types";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { useAtom } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";
import { api, isConvexLinked } from "../convexClient";
import { getOwnerKey } from "../data/ownerKey";
import {
  openLibraryIdAtom,
  serializeFilesForElements,
} from "../data/jayrrLibraries";

import "./JayrrLibraryMenu.scss";

import type { ReactNode } from "react";

import type { Id } from "../../convex/_generated/dataModel";

const ownerKey = getOwnerKey();

const persistOpenLibraryId = (libraryId: Id<"libraries"> | null) => {
  try {
    if (libraryId) {
      localStorage.setItem(
        STORAGE_KEYS.LOCAL_STORAGE_OPEN_LIBRARY_ID,
        libraryId,
      );
      return;
    }
    localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_OPEN_LIBRARY_ID);
  } catch {
    // ignore quota / private mode
  }
};

class LibraryMenuErrorBoundary extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return {
      message:
        error instanceof Error ? error.message : "Libraries failed to load",
    };
  }

  render() {
    if (this.state.message) {
      return (
        <div className="layer-ui__library jayrr-library">
          <div className="library-menu-items__no-items">
            <div className="library-menu-items__no-items__label">
              Libraries unavailable
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

export const JayrrLibraryMenu = () => {
  if (!isConvexLinked) {
    return (
      <div className="layer-ui__library jayrr-library">
        <div className="library-menu-items__no-items">
          <div className="library-menu-items__no-items__label">
            Libraries need Convex
          </div>
          <div className="library-menu-items__no-items__hint">
            Add VITE_CONVEX_URL, then restart the app.
          </div>
        </div>
      </div>
    );
  }

  return (
    <LibraryMenuErrorBoundary>
      <JayrrLibraryMenuConnected />
    </LibraryMenuErrorBoundary>
  );
};

const JayrrLibraryMenuConnected = () => {
  const excalidrawAPI = useExcalidrawAPI();
  const [openLibraryId, setOpenLibraryId] = useAtom(openLibraryIdAtom);
  const [renamingId, setRenamingId] = useState<Id<"libraries"> | null>(null);
  const [draftName, setDraftName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const libraries = useQuery(api.libraries.list, { ownerKey });
  const openLibrary = useQuery(
    api.libraries.get,
    openLibraryId ? { ownerKey, libraryId: openLibraryId } : "skip",
  );
  const assets = useQuery(
    api.libraries.listAssets,
    openLibraryId ? { ownerKey, libraryId: openLibraryId } : "skip",
  );

  const createLibrary = useMutation(api.libraries.create);
  const renameLibrary = useMutation(api.libraries.rename);
  const removeLibrary = useMutation(api.libraries.remove);
  const addAsset = useMutation(api.libraries.addAsset);
  const removeAsset = useMutation(api.libraries.removeAsset);

  const selectedElementIds = useExcalidrawStateValue("selectedElementIds");

  useEffect(() => {
    persistOpenLibraryId(openLibraryId);
  }, [openLibraryId]);

  useEffect(() => {
    if (openLibraryId && openLibrary === null) {
      setOpenLibraryId(null);
    }
  }, [openLibrary, openLibraryId, setOpenLibraryId]);

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  const pendingElements = useMemo(() => {
    const ids = selectedElementIds ?? {};
    if (!excalidrawAPI || Object.keys(ids).length === 0) {
      return [];
    }
    return excalidrawAPI
      .getSceneElements()
      .filter((element) => ids[element.id]);
  }, [excalidrawAPI, selectedElementIds]);

  const openLibraryById = useCallback(
    (libraryId: Id<"libraries">) => {
      setOpenLibraryId(libraryId);
      setRenamingId(null);
    },
    [setOpenLibraryId],
  );

  const onCreateLibrary = async () => {
    try {
      const nextIndex = (libraries?.length ?? 0) + 1;
      const libraryId = await createLibrary({
        ownerKey,
        name: `Library ${nextIndex}`,
      });
      openLibraryById(libraryId);
      setRenamingId(libraryId);
      setDraftName(`Library ${nextIndex}`);
    } catch (error) {
      excalidrawAPI?.setToast({
        message:
          error instanceof Error ? error.message : "Could not create library",
        closable: true,
      });
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
      await renameLibrary({ ownerKey, libraryId: renamingId, name });
    } catch (error) {
      excalidrawAPI?.setToast({
        message: error instanceof Error ? error.message : "Rename failed",
        closable: true,
      });
    }
  };

  const onAddPending = async () => {
    if (!openLibraryId) {
      excalidrawAPI?.setToast({
        message: "Open a library first.",
        closable: true,
      });
      return;
    }
    if (!pendingElements.length) {
      return;
    }
    try {
      await addAsset({
        ownerKey,
        libraryId: openLibraryId,
        elementsJson: JSON.stringify(pendingElements),
        filesJson: serializeFilesForElements(
          pendingElements,
          excalidrawAPI?.getFiles() ?? {},
        ),
      });
      excalidrawAPI?.setToast({ message: "Added to library", closable: true });
    } catch (error) {
      excalidrawAPI?.setToast({
        message: error instanceof Error ? error.message : "Could not add asset",
        closable: true,
      });
    }
  };

  const onInsertAsset = async (elementsJson: string, filesJson?: string) => {
    if (!excalidrawAPI) {
      return;
    }
    const [item] = restoreLibraryItems(
      [
        {
          status: "unpublished" as const,
          elements: JSON.parse(elementsJson),
          id: crypto.randomUUID(),
          created: Date.now(),
        },
      ],
      "unpublished",
    );
    if (!item) {
      return;
    }
    const files = parseFilesJson(filesJson);
    if (files) {
      excalidrawAPI.addFiles(Object.values(files));
    }
    excalidrawAPI.insertElementsFromLibrary({
      elements: item.elements,
      files,
    });
  };

  if (libraries === undefined) {
    return (
      <div className="layer-ui__library jayrr-library">
        <div className="layer-ui__library-message">Loading libraries…</div>
      </div>
    );
  }

  if (openLibraryId && openLibrary) {
    return (
      <div className="layer-ui__library jayrr-library">
        <div className="jayrr-library__header">
          <button
            type="button"
            className="jayrr-library__icon-button"
            aria-label="Back to libraries"
            onClick={() => setOpenLibraryId(null)}
          >
            {chevronLeftIcon}
          </button>
          {renamingId === openLibrary._id ? (
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
                  setRenamingId(null);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="jayrr-library__title"
              onClick={() => {
                setDraftName(openLibrary.name);
                setRenamingId(openLibrary._id);
              }}
            >
              {openLibrary.name}
            </button>
          )}
        </div>

        <div className="jayrr-library__body">
          {pendingElements.length > 0 && (
            <button
              type="button"
              className="jayrr-library__pending"
              onClick={() => {
                void onAddPending();
              }}
            >
              <span className="library-unit__adder">{PlusIcon}</span>
              Add selection to this library
            </button>
          )}

          {assets === undefined && (
            <div className="library-menu-items__no-items__hint">
              Loading assets…
            </div>
          )}

          {assets && assets.length === 0 && pendingElements.length === 0 && (
            <div className="library-menu-items__no-items">
              <div className="library-menu-items__no-items__label">
                No assets yet
              </div>
              <div className="library-menu-items__no-items__hint">
                Select shapes on the canvas, then add them here.
              </div>
            </div>
          )}

          {assets && assets.length > 0 && (
            <div className="library-menu-items-container__grid">
              {assets.map((asset) => (
                <AssetThumb
                  key={asset._id}
                  elementsJson={asset.elementsJson}
                  onInsert={() => {
                    void onInsertAsset(asset.elementsJson, asset.filesJson);
                  }}
                  onDelete={() => {
                    void removeAsset({ ownerKey, assetId: asset._id });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="layer-ui__library jayrr-library">
      <div className="jayrr-library__header">
        <div className="jayrr-library__title">Libraries</div>
      </div>
      <div className="jayrr-library__body">
        {libraries.length === 0 && (
          <div className="library-menu-items__no-items">
            <div className="library-menu-items__no-items__label">
              No libraries yet
            </div>
            <div className="library-menu-items__no-items__hint">
              Create a library, then drop canvas selections into it.
            </div>
            <Button
              className="jayrr-library__create"
              onSelect={() => {
                void onCreateLibrary();
              }}
            >
              Create library
            </Button>
          </div>
        )}
        <ul className="jayrr-library__list">
          {libraries.map((library) => (
            <li key={library._id} className="jayrr-library__row">
              {renamingId === library._id ? (
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
                      setRenamingId(null);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="jayrr-library__folder"
                  onClick={() => openLibraryById(library._id)}
                >
                  <span className="jayrr-library__folder-icon">{LoadIcon}</span>
                  <span className="jayrr-library__folder-copy">
                    <span className="jayrr-library__folder-name">
                      {library.name}
                    </span>
                    <span className="jayrr-library__folder-meta">
                      {library.assetCount}{" "}
                      {library.assetCount === 1 ? "asset" : "assets"}
                    </span>
                  </span>
                </button>
              )}
              <div className="jayrr-library__row-actions">
                <button
                  type="button"
                  className="jayrr-library__icon-button"
                  aria-label={`Rename ${library.name}`}
                  onClick={() => {
                    setDraftName(library.name);
                    setRenamingId(library._id);
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="jayrr-library__icon-button jayrr-library__icon-button--danger"
                  aria-label={`Delete ${library.name}`}
                  onClick={() => {
                    if (
                      window.confirm(`Delete "${library.name}" and its assets?`)
                    ) {
                      void removeLibrary({
                        ownerKey,
                        libraryId: library._id,
                      });
                    }
                  }}
                >
                  {TrashIcon}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {libraries.length > 0 && (
        <div className="jayrr-library__footer">
          <Button
            className="jayrr-library__create"
            onSelect={() => {
              void onCreateLibrary();
            }}
          >
            Create library
          </Button>
        </div>
      )}
    </div>
  );
};

const AssetThumb = ({
  elementsJson,
  onInsert,
  onDelete,
}: {
  elementsJson: string;
  onInsert: () => void;
  onDelete: () => void;
}) => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    const render = async () => {
      try {
        const parsed = JSON.parse(
          elementsJson,
        ) as NonDeletedExcalidrawElement[];
        const svg = await exportToSvg({
          elements: parsed,
          appState: {
            exportBackground: false,
            viewBackgroundColor: "#ffffff",
          },
          files: {},
        });
        svg.querySelector(".style-fonts")?.remove();
        if (!cancelled && host) {
          host.innerHTML = svg.outerHTML;
        }
      } catch {
        if (!cancelled && host) {
          host.textContent = "Asset";
        }
      }
    };
    void render();
    return () => {
      cancelled = true;
      if (host) {
        host.innerHTML = "";
      }
    };
  }, [elementsJson]);

  return (
    <div className="library-unit library-unit__active">
      <div className="library-unit__dragger" ref={hostRef} onClick={onInsert} />
      <button
        type="button"
        className="jayrr-library__asset-delete"
        aria-label="Remove asset"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        {TrashIcon}
      </button>
    </div>
  );
};

const parseFilesJson = (filesJson?: string): BinaryFiles | null => {
  if (!filesJson) {
    return null;
  }
  try {
    return JSON.parse(filesJson) as BinaryFiles;
  } catch {
    return null;
  }
};
