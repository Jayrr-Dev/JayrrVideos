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
import DropdownMenu from "@excalidraw/excalidraw/components/dropdownMenu/DropdownMenu";
import {
  DotsHorizontalIcon,
  PlusIcon,
  TrashIcon,
  chevronLeftIcon,
} from "@excalidraw/excalidraw/components/icons";

import type { BinaryFiles } from "@excalidraw/excalidraw/types";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { useAtom } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";
import { api, isConvexLinked } from "../convexClient";
import {
  openLibraryIdAtom,
  serializeFilesForElements,
} from "../data/jayrrLibraries";
import { getOwnerKey } from "../data/ownerKey";

import "../../packages/excalidraw/components/LibraryMenuItems.scss";
import "../../packages/excalidraw/components/LibraryUnit.scss";

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
  const [openMenuId, setOpenMenuId] = useState<Id<"libraries"> | null>(null);
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

          {(pendingElements.length > 0 || (assets && assets.length > 0)) && (
            <div className="library-menu-items-container__grid">
              {pendingElements.length > 0 && (
                <PendingLibraryUnit
                  elements={pendingElements}
                  files={excalidrawAPI?.getFiles() ?? {}}
                  onAdd={() => {
                    void onAddPending();
                  }}
                />
              )}
              {assets?.map((asset) => (
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
        {libraries.length > 0 && (
          <ul className="jayrr-scene-grid">
            {libraries.map((library) => (
              <li key={library._id} className="jayrr-scene-card">
                {renamingId === library._id ? (
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
                  <span className="jayrr-scene-card__name">{library.name}</span>
                )}
                <button
                  type="button"
                  className="jayrr-scene-card__preview"
                  aria-label={`Open ${library.name}`}
                  onClick={() => openLibraryById(library._id)}
                >
                  <LibraryCardThumbs
                    libraryId={library._id}
                    assetCount={library.assetCount}
                  />
                </button>
                <DropdownMenu open={openMenuId === library._id}>
                  <DropdownMenu.Trigger
                    className="jayrr-scene-card__menu"
                    aria-label={`${library.name} menu`}
                    onToggle={() => {
                      setOpenMenuId((current) =>
                        current === library._id ? null : library._id,
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
                      icon={EditGlyph}
                      onSelect={() => {
                        setDraftName(library.name);
                        setRenamingId(library._id);
                      }}
                    >
                      Rename
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      icon={TrashIcon}
                      onSelect={() => {
                        if (
                          window.confirm(
                            `Delete "${library.name}" and its assets?`,
                          )
                        ) {
                          void removeLibrary({
                            ownerKey,
                            libraryId: library._id,
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

const LibraryCardThumbs = ({
  libraryId,
  assetCount,
}: {
  libraryId: Id<"libraries">;
  assetCount: number;
}) => {
  const assets = useQuery(
    api.libraries.listAssets,
    assetCount > 0 ? { ownerKey, libraryId } : "skip",
  );
  const previews = assets?.slice(0, 4) ?? [];

  if (assetCount === 0 || (assets && previews.length === 0)) {
    return <span className="jayrr-scene-card__empty">Empty</span>;
  }

  return (
    <span className="jayrr-library-card__thumbs">
      {previews.map((asset) => (
        <AssetSvg key={asset._id} elementsJson={asset.elementsJson} />
      ))}
    </span>
  );
};

const PendingLibraryUnit = ({
  elements,
  files,
  onAdd,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  onAdd: () => void;
}) => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    return paintElementsSvg(host, elements, files);
  }, [elements, files]);

  return (
    <div className="library-unit library-unit__active" title="Add to library">
      <div
        className="library-unit__dragger library-unit__pulse"
        ref={hostRef}
        onClick={onAdd}
      />
      <div className="library-unit__adder">{PlusIcon}</div>
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
    const host = hostRef.current;
    return paintAssetSvg(host, elementsJson);
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

const AssetSvg = ({ elementsJson }: { elementsJson: string }) => {
  const hostRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    return paintAssetSvg(host, elementsJson);
  }, [elementsJson]);

  return <span className="jayrr-library-card__thumb" ref={hostRef} />;
};

const paintAssetSvg = (host: HTMLElement | null, elementsJson: string) => {
  try {
    const parsed = JSON.parse(elementsJson) as NonDeletedExcalidrawElement[];
    return paintElementsSvg(host, parsed, {});
  } catch {
    return () => {};
  }
};

const paintElementsSvg = (
  host: HTMLElement | null,
  elements: readonly NonDeletedExcalidrawElement[],
  files: BinaryFiles,
) => {
  let cancelled = false;
  const render = async () => {
    if (!host) {
      return;
    }
    try {
      const svg = await exportToSvg({
        elements,
        appState: {
          exportBackground: false,
          viewBackgroundColor: "#ffffff",
        },
        files,
      });
      svg.querySelector(".style-fonts")?.remove();
      if (!cancelled) {
        host.innerHTML = svg.outerHTML;
      }
    } catch {
      if (!cancelled && host) {
        host.textContent = "";
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
