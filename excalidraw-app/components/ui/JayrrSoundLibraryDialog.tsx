import { helpIcon } from "@excalidraw/excalidraw/components/icons";
import { usePaginatedQuery, useQuery } from "convex/react";
import { useMemo, useRef, useState } from "react";

import { api, isConvexLinked } from "../../convexClient";

import { Dialog, Tooltip } from "./editor";

import "./JayrrSoundLibraryDialog.scss";

import type { MutableRefObject } from "react";

type JayrrSoundLibraryDialogProps = {
  onClose: () => void;
};

const INFO =
  "Browse the Flatten sound library. Search the whole tree, open a folder, and play OGG previews stored in Convex.";

const formatClock = (durationSec: number) => {
  const total = Math.max(0, Math.ceil(durationSec));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
};

export const JayrrSoundLibraryDialog = ({
  onClose,
}: JayrrSoundLibraryDialogProps) => {
  const [folder, setFolder] = useState("");
  const [search, setSearch] = useState("");
  const [playingPath, setPlayingPath] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!isConvexLinked) {
    return (
      <Dialog
        className="jayrr-sound-library"
        size={820}
        onCloseRequest={onClose}
        title={
          <span className="jayrr-sound-library__title-row">
            Sound Library
            <Tooltip label={INFO} long position="top">
              <span
                className="jayrr-sound-library__info"
                aria-label="More info"
              >
                {helpIcon}
              </span>
            </Tooltip>
          </span>
        }
      >
        <p className="visually-hidden">{INFO}</p>
        <p className="jayrr-sound-library__empty">
          Add VITE_CONVEX_URL, then restart the app.
        </p>
      </Dialog>
    );
  }

  return (
    <JayrrSoundLibraryDialogConnected
      audioRef={audioRef}
      folder={folder}
      onClose={onClose}
      playingPath={playingPath}
      search={search}
      setFolder={setFolder}
      setPlayingPath={setPlayingPath}
      setSearch={setSearch}
    />
  );
};

const JayrrSoundLibraryDialogConnected = ({
  audioRef,
  folder,
  onClose,
  playingPath,
  search,
  setFolder,
  setPlayingPath,
  setSearch,
}: {
  audioRef: MutableRefObject<HTMLAudioElement | null>;
  folder: string;
  onClose: () => void;
  playingPath: string | null;
  search: string;
  setFolder: (folder: string) => void;
  setPlayingPath: (path: string | null) => void;
  setSearch: (search: string) => void;
}) => {
  const folders = useQuery(api.soundFolders.tree, {});
  const sounds = usePaginatedQuery(
    api.sounds.list,
    { folder, search },
    { initialNumItems: 40 },
  );

  const children = useMemo(() => {
    if (!folders) {
      return [];
    }
    return folders
      .filter((row) => row.parent === folder && row.path !== "")
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [folder, folders]);

  const crumbs = folder ? folder.split("/") : [];

  const playSound = (url: string | null, path: string) => {
    if (!url) {
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    if (playingPath === path && !audio.paused) {
      audio.pause();
      setPlayingPath(null);
      return;
    }
    audio.pause();
    audio.src = url;
    void audio.play().then(
      () => {
        setPlayingPath(path);
      },
      (error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setPlayingPath(null);
      },
    );
    audio.onended = () => {
      setPlayingPath(null);
    };
  };

  return (
    <Dialog
      className="jayrr-sound-library"
      size={820}
      onCloseRequest={() => {
        audioRef.current?.pause();
        onClose();
      }}
      title={
        <span className="jayrr-sound-library__title-row">
          Sound Library
          <Tooltip label={INFO} long position="top">
            <span className="jayrr-sound-library__info" aria-label="More info">
              {helpIcon}
            </span>
          </Tooltip>
        </span>
      }
    >
      <p className="visually-hidden">{INFO}</p>
      <div className="jayrr-sound-library__toolbar">
        <input
          aria-label="Search sounds"
          className="jayrr-sound-library__search"
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          placeholder="Search sounds"
          type="search"
          value={search}
        />
      </div>
      <nav aria-label="Folder" className="jayrr-sound-library__crumbs">
        <button
          className="jayrr-sound-library__crumb"
          onClick={() => {
            setFolder("");
          }}
          type="button"
        >
          Library
        </button>
        {crumbs.map((name, index) => {
          const path = crumbs.slice(0, index + 1).join("/");
          return (
            <span key={path} className="jayrr-sound-library__crumb-wrap">
              <span aria-hidden="true">/</span>
              <button
                className="jayrr-sound-library__crumb"
                onClick={() => {
                  setFolder(path);
                }}
                type="button"
              >
                {name}
              </button>
            </span>
          );
        })}
      </nav>
      {children.length > 0 ? (
        <ul className="jayrr-sound-library__folders">
          {children.map((row) => (
            <li key={row.path}>
              <button
                onClick={() => {
                  setFolder(row.path);
                }}
                type="button"
              >
                <span>{row.name}</span>
                <span>{row.count}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="jayrr-sound-library__sounds">
        {sounds.results.map((row) => {
          const playing = playingPath === row.path;
          return (
            <li key={row._id}>
              <button
                className="jayrr-sound-library__play"
                disabled={!row.url}
                onClick={() => {
                  playSound(row.url, row.path);
                }}
                type="button"
              >
                {playing ? "Pause" : "Play"}
              </button>
              <div className="jayrr-sound-library__meta">
                <span className="jayrr-sound-library__name">{row.name}</span>
                <span className="jayrr-sound-library__path">
                  {row.folderPath}
                </span>
              </div>
              <span className="jayrr-sound-library__clock">
                {formatClock(row.durationSec)}
              </span>
            </li>
          );
        })}
      </ul>
      {sounds.status === "CanLoadMore" ? (
        <button
          className="jayrr-sound-library__more"
          onClick={() => {
            sounds.loadMore(40);
          }}
          type="button"
        >
          Load more
        </button>
      ) : null}
      {sounds.status === "LoadingFirstPage" ? (
        <p className="jayrr-sound-library__empty">Loading sounds…</p>
      ) : null}
      {sounds.status === "Exhausted" && sounds.results.length === 0 ? (
        <p className="jayrr-sound-library__empty">
          No sounds yet. Run yarn seed:sounds after Convex is linked.
        </p>
      ) : null}
    </Dialog>
  );
};
