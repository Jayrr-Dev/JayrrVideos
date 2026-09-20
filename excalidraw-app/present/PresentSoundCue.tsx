import { useExcalidrawContainer } from "@excalidraw/excalidraw/components/App";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Popover } from "radix-ui";
import { useMemo, useState } from "react";

import { api, isConvexLinked } from "../convexClient";

import type { PresentSound } from "./buildPresentDeck";

const noteIcon = (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      d="M6.2 12.4c0 1.1-.9 1.9-2.1 1.9S2 13.5 2 12.4s.9-1.9 2.1-1.9c.4 0 .8.1 1.1.3V4.7l7.6-1.3v7.4c0 1.1-.9 1.9-2.1 1.9s-2.1-.8-2.1-1.9.9-1.9 2.1-1.9c.4 0 .8.1 1.1.3V4.4L6.2 5.6z"
      fill="currentColor"
    />
  </svg>
);

export const PresentSoundCue = ({
  sound,
  label,
  disabled,
  onSound,
}: {
  sound: PresentSound | null;
  label: string;
  disabled: boolean;
  onSound: (sound: PresentSound | null) => void;
}) => {
  const { container } = useExcalidrawContainer();
  const layerUi = container?.querySelector<HTMLElement>(".layer-ui__wrapper");
  const [open, setOpen] = useState(false);
  const title = sound ? `${label}: ${sound.name}` : label;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={
            sound
              ? "jayrr-present__sound-cue is-set"
              : "jayrr-present__sound-cue"
          }
          aria-label={title}
          title={title}
          disabled={disabled}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {noteIcon}
        </button>
      </Popover.Trigger>
      <Popover.Portal container={layerUi ?? container}>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className="jayrr-present__sound-pop"
          style={{ zIndex: "var(--zIndex-ui-styles-popup)" }}
          data-prevent-outside-click
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <PresentSoundPicker
            selectedId={sound?.id ?? null}
            onPick={(next) => {
              onSound(next);
              setOpen(false);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

const PresentSoundPicker = ({
  selectedId,
  onPick,
}: {
  selectedId: string | null;
  onPick: (sound: PresentSound | null) => void;
}) => {
  const [folder, setFolder] = useState("");
  const [search, setSearch] = useState("");
  const folders = useQuery(api.soundFolders.tree, isConvexLinked ? {} : "skip");
  const sounds = usePaginatedQuery(
    api.sounds.list,
    isConvexLinked ? { folder, search } : "skip",
    { initialNumItems: 24 },
  );

  const children = useMemo(() => {
    if (!folders) {
      return [];
    }
    return folders
      .filter((row) => row.parent === folder && row.path !== "")
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [folder, folders]);

  if (!isConvexLinked) {
    return (
      <p className="jayrr-present__sound-empty">Link Convex to pick sounds.</p>
    );
  }

  return (
    <>
      <input
        aria-label="Search sounds"
        className="jayrr-present__sound-search"
        onChange={(event) => {
          setSearch(event.target.value);
        }}
        placeholder="Search sounds"
        type="search"
        value={search}
      />
      <nav aria-label="Folder" className="jayrr-present__sound-crumbs">
        <button
          className="jayrr-present__sound-crumb"
          onClick={() => setFolder("")}
          type="button"
        >
          Library
        </button>
        {folder
          .split("/")
          .filter(Boolean)
          .map((name, index, parts) => {
            const path = parts.slice(0, index + 1).join("/");
            return (
              <span key={path}>
                <span aria-hidden="true"> / </span>
                <button
                  className="jayrr-present__sound-crumb"
                  onClick={() => setFolder(path)}
                  type="button"
                >
                  {name}
                </button>
              </span>
            );
          })}
      </nav>
      {children.length > 0 ? (
        <ul className="jayrr-present__sound-folders">
          {children.map((row) => (
            <li key={row.path}>
              <button onClick={() => setFolder(row.path)} type="button">
                <span>{row.name}</span>
                <span>{row.count}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="jayrr-present__sound-list">
        {sounds.results.map((row) => (
          <li key={row._id}>
            <button
              className={
                selectedId === row._id
                  ? "jayrr-present__sound-item is-selected"
                  : "jayrr-present__sound-item"
              }
              onClick={() => {
                onPick({ id: row._id, name: row.name });
              }}
              type="button"
            >
              <span>{row.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {sounds.status === "CanLoadMore" ? (
        <button
          className="jayrr-present__sound-more"
          onClick={() => sounds.loadMore(24)}
          type="button"
        >
          Load more
        </button>
      ) : null}
      {sounds.status === "LoadingFirstPage" ? (
        <p className="jayrr-present__sound-empty">Loading sounds…</p>
      ) : null}
      {sounds.status === "Exhausted" && sounds.results.length === 0 ? (
        <p className="jayrr-present__sound-empty">No sounds in this folder.</p>
      ) : null}
      {selectedId ? (
        <button
          className="jayrr-present__sound-clear"
          onClick={() => onPick(null)}
          type="button"
        >
          Clear
        </button>
      ) : null}
    </>
  );
};
