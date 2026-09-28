import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { chevronLeftIcon } from "@excalidraw/excalidraw/components/icons";
import { usePaginatedQuery, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { api, isConvexLinked } from "../../convexClient";
import { insertLibrarySound } from "../../domain/widgets/insertLibrarySound";
import {
  assignMediaSrcFromList,
  jayrrSoundPlayUrls,
} from "../../sounds/jayrrSoundPlayback";

import { Button } from "./Button";
import { JayrrSoundLibraryDialog } from "./JayrrSoundLibraryDialog";

const formatClock = (durationSec: number) => {
  const total = Math.max(0, Math.ceil(durationSec));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

export const JayrrSoundPanel = () => {
  const excalidrawAPI = useExcalidrawAPI();
  const [folder, setFolder] = useState("");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const folders = useQuery(api.soundFolders.tree, isConvexLinked ? {} : "skip");
  const sounds = usePaginatedQuery(
    api.sounds.list,
    isConvexLinked ? { folder, search } : "skip",
    { initialNumItems: 40 },
  );

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const children = useMemo(
    () =>
      (folders ?? [])
        .filter((row) => row.parent === folder && row.path !== "")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [folder, folders],
  );

  const openFolder = (path: string) => {
    audioRef.current?.pause();
    setPlayingId(null);
    setFolder(path);
  };

  const play = async (row: {
    _id: string;
    url: string | null;
    path: string;
  }) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    if (playingId === row._id && !audio.paused) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    audio.pause();
    audio.onended = () => setPlayingId(null);
    setPlayingId(row._id);
    const src = await assignMediaSrcFromList(
      audio,
      jayrrSoundPlayUrls(row.url, row.path),
    );
    if (!src) {
      setPlayingId(null);
      return;
    }
    try {
      audio.currentTime = 0;
      await audio.play();
    } catch {
      setPlayingId(null);
    }
  };

  if (!isConvexLinked) {
    return (
      <p className="jayrr-editor-add-recording__empty">
        Sign in to load sounds.
      </p>
    );
  }

  const parent = folder.includes("/")
    ? folder.slice(0, folder.lastIndexOf("/"))
    : "";
  const title = folder ? folder.split("/").pop() : "Sounds";

  let empty = null;
  if (sounds.results.length === 0) {
    if (sounds.status === "LoadingFirstPage") {
      empty = (
        <p className="jayrr-editor-add-recording__empty">Loading sounds…</p>
      );
    } else if (children.length === 0 || search) {
      empty = (
        <p className="jayrr-editor-add-recording__empty">No sounds here.</p>
      );
    }
  }

  return (
    <div className="jayrr-sound-panel">
      <div className="jayrr-sound-panel__bar">
        {folder ? (
          <button
            type="button"
            className="jayrr-present__back"
            aria-label="Back"
            onClick={() => openFolder(parent)}
          >
            {chevronLeftIcon}
          </button>
        ) : null}
        <span className="jayrr-sound-panel__title">{title}</span>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setDialogOpen(true)}
        >
          Generate
        </Button>
      </div>
      <input
        className="jayrr-sound-panel__search"
        type="search"
        placeholder="Search sounds"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="jayrr-sound-panel__body">
        {!search && children.length > 0 ? (
          <ul className="jayrr-scene-grid">
            {children.map((row) => (
              <li key={row.path} className="jayrr-scene-card">
                <span className="jayrr-scene-card__name">{row.name}</span>
                <button
                  type="button"
                  className="jayrr-scene-card__preview"
                  aria-label={`Open ${row.name}`}
                  onClick={() => openFolder(row.path)}
                >
                  <span className="jayrr-scene-card__empty">
                    {row.count} sounds
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {sounds.results.length > 0 ? (
          <ul className="jayrr-sound-panel__list">
            {sounds.results.map((row) => (
              <li key={row._id} className="jayrr-sound-panel__row">
                <button
                  type="button"
                  className="jayrr-sound-panel__play"
                  aria-label={`Play ${row.name}`}
                  onClick={() => void play(row)}
                >
                  {playingId === row._id ? "❚❚" : "▶"}
                </button>
                <span className="jayrr-sound-panel__name" title={row.name}>
                  {row.name}
                </span>
                <span className="jayrr-sound-panel__time">
                  {formatClock(row.durationSec)}
                </span>
                <button
                  type="button"
                  className="jayrr-sound-panel__add"
                  aria-label={`Add ${row.name} to canvas`}
                  disabled={!excalidrawAPI}
                  onClick={() => {
                    if (excalidrawAPI) {
                      void insertLibrarySound(excalidrawAPI, {
                        name: row.name,
                        path: row.path,
                        url: row.url,
                      });
                    }
                  }}
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        ) : (
          empty
        )}
        {sounds.status === "CanLoadMore" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => sounds.loadMore(40)}
          >
            Load more
          </Button>
        ) : null}
      </div>
      {dialogOpen ? (
        <JayrrSoundLibraryDialog
          onClose={() => setDialogOpen(false)}
          onAddToCanvas={
            excalidrawAPI
              ? (sound) => insertLibrarySound(excalidrawAPI, sound)
              : undefined
          }
        />
      ) : null}
    </div>
  );
};
