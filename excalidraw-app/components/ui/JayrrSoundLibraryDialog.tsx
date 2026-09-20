import { helpIcon } from "@excalidraw/excalidraw/components/icons";
import { usePaginatedQuery, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { api, convexClient, isConvexLinked } from "../../convexClient";

import { Dialog, Tooltip } from "./editor";

import "./JayrrSoundLibraryDialog.scss";

import type { MutableRefObject } from "react";
import type { Id } from "../../../convex/_generated/dataModel";

import { api, convexClient, isConvexLinked } from "../../convexClient";

import { Dialog, Tooltip } from "./editor";

import "./JayrrSoundLibraryDialog.scss";

import type { MutableRefObject } from "react";
import type { Id } from "../../../convex/_generated/dataModel";

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

const playIcon = (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M4 2.5v11l10-5.5z" fill="currentColor" />
  </svg>
);

const pauseIcon = (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M3.5 2.5h3v11h-3zm6 0h3v11h-3z" fill="currentColor" />
  </svg>
);

const RING_R = 7.25;
const RING_C = 2 * Math.PI * RING_R;

const PlayMark = ({
  playing,
  progress,
}: {
  playing: boolean;
  progress: number;
}) => {
  const offset = RING_C * (1 - Math.min(1, Math.max(0, progress)));
  return (
    <span
      className={
        playing
          ? "jayrr-sound-library__play is-playing"
          : "jayrr-sound-library__play"
      }
      aria-hidden="true"
    >
      <svg className="jayrr-sound-library__ring" viewBox="0 0 20 20">
        <circle className="jayrr-sound-library__ring-track" cx="10" cy="10" r={RING_R} />
        <circle
          className="jayrr-sound-library__ring-fill"
          cx="10"
          cy="10"
          r={RING_R}
          strokeDasharray={RING_C}
          strokeDashoffset={playing || progress > 0 ? offset : RING_C}
        />
      </svg>
      {playing ? pauseIcon : playIcon}
    </span>
  );
};
  onClose,
}: JayrrSoundLibraryDialogProps) => {
  const [folder, setFolder] = useState("");
  const [search, setSearch] = useState("");
  const [playingPath, setPlayingPath] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
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
      isPlaying={isPlaying}
      playingPath={playingPath}
      progress={progress}
      search={search}
      setFolder={setFolder}
      setIsPlaying={setIsPlaying}
      setPlayingPath={setPlayingPath}
      setProgress={setProgress}
      setSearch={setSearch}
    />
  );
};

const JayrrSoundLibraryDialogConnected = ({
  audioRef,
  folder,
  isPlaying,
  onClose,
  playingPath,
  progress,
  search,
  setFolder,
  setIsPlaying,
  setPlayingPath,
  setProgress,
  setSearch,
}: {
  audioRef: MutableRefObject<HTMLAudioElement | null>;
  folder: string;
  isPlaying: boolean;
  onClose: () => void;
  playingPath: string | null;
  progress: number;
  search: string;
  setFolder: (folder: string) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlayingPath: (path: string | null) => void;
  setProgress: (progress: number) => void;
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

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    let frame = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (!audio || audio.paused) {
        return;
      }
      const duration = audio.duration;
      if (Number.isFinite(duration) && duration > 0) {
        setProgress(audio.currentTime / duration);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [audioRef, isPlaying, setProgress]);

  const playSound = async (
    url: string | null,
    path: string,
    soundId: string,
  ) => {
    let nextUrl = url;
    if (!nextUrl && convexClient) {
      try {
        const row = await convexClient.query(api.sounds.get, {
          soundId: soundId as Id<"sounds">,
        });
        nextUrl = row?.url ?? null;
      } catch {
        nextUrl = null;
      }
    }
    if (!nextUrl) {
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    if (playingPath === path && isPlaying && !audio.paused) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    if (playingPath === path && audio.src && audio.paused) {
      void audio.play().then(
        () => {
          setIsPlaying(true);
        },
        (error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setIsPlaying(false);
          setPlayingPath(null);
        },
      );
      return;
    }
    audio.pause();
    audio.src = nextUrl;
    setPlayingPath(path);
    setProgress(0);
    void audio.play().then(
      () => {
        setIsPlaying(true);
      },
      (error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setIsPlaying(false);
        setPlayingPath(null);
      },
    );
    audio.onended = () => {
      setIsPlaying(false);
      setPlayingPath(null);
      setProgress(0);
    };
  };

  return (
    <Dialog
      className="jayrr-sound-library"
      size={820}
      onCloseRequest={() => {
        audioRef.current?.pause();
        setIsPlaying(false);
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
      <div className="jayrr-sound-library__body">
        <div className="jayrr-sound-library__col jayrr-sound-library__col--folders">
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
        </div>
        <div className="jayrr-sound-library__col jayrr-sound-library__col--sounds">
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
          <ul className="jayrr-sound-library__sounds">
            {sounds.results.map((row) => {
              const active = playingPath === row.path;
              const playing = active && isPlaying;
              const remain = active
                ? Math.max(0, row.durationSec * (1 - progress))
                : row.durationSec;
              return (
                <li key={row._id}>
                  <button
                    className={
                      playing
                        ? "jayrr-sound-library__row is-playing"
                        : "jayrr-sound-library__row"
                    }
                    onClick={() => {
                      void playSound(row.url, row.path, row._id);
                    }}
                    type="button"
                    aria-label={
                      playing ? `Pause ${row.name}` : `Play ${row.name}`
                    }
                  >
                    <PlayMark playing={playing} progress={active ? progress : 0} />
                    <span className="jayrr-sound-library__meta">
                      <span className="jayrr-sound-library__name">
                        {row.name}
                      </span>
                      <span className="jayrr-sound-library__path">
                        {row.folderPath}
                      </span>
                    </span>
                    <span className="jayrr-sound-library__clock">
                      {formatClock(remain)}
                    </span>
                  </button>
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
        </div>
      </div>
    </Dialog>
  );
};
