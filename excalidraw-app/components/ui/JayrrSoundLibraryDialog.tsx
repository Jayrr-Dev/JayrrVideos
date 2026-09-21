import { helpIcon } from "@excalidraw/excalidraw/components/icons";
import { usePaginatedQuery, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { api, convexClient, isConvexLinked } from "../../convexClient";
import {
  peekLoudnessDb,
  subscribeLoudnessCache,
  subscribeLoudnessDb,
} from "../../data/jayrrSoundLoudness";
import {
  centroidHzColor,
  centroidHzLabel,
  DECIBEL_FILTERS,
  formatLoudnessDb,
  loudnessDbColor,
  loudnessDbLabel,
  matchesDecibelFilter,
  matchesPitchFilter,
  PITCH_FILTERS,
  type MetricFilterOption,
} from "../../data/jayrrSoundMetrics";
import {
  assignAndPlayAudio,
  jayrrSoundPlayUrls,
} from "../../sounds/jayrrSoundPlayback";
import { JayrrSoundWaveform } from "../../sounds/JayrrSoundWaveform";

import { Dialog, Tooltip } from "./editor";
import { JayrrSoundLibraryGenerateTab } from "./JayrrSoundLibraryGenerateTab";
import { JayrrSoundLibraryVoiceTab } from "./JayrrSoundLibraryVoiceTab";

import "./JayrrSoundLibraryDialog.scss";

import type { MutableRefObject } from "react";
import type { Id } from "../../../convex/_generated/dataModel";

export type JayrrSoundPick = {
  id: string;
  name: string;
  path: string;
  durationSec?: number;
  url?: string | null;
};

type JayrrSoundLibraryDialogProps = {
  onClose: () => void;
  selectedId?: string | null;
  onSelect?: (sound: JayrrSoundPick | null) => void;
};

const TABS = [
  { id: "library", label: "Library" },
  { id: "generate", label: "Generate" },
  { id: "voice", label: "Voice" },
] as const;

type SoundLibraryTab = typeof TABS[number]["id"];

const INFO_BROWSE =
  "Browse Flatten sounds stored in Convex. Pitch is spectral centroid in Hz. Loudness is RMS dB from the catalog, or a decode of the preview.";

const INFO_PICK =
  "Pick a sound for this present cue. Preview with play, then click a row. Pitch is spectral centroid. Loudness is RMS dB.";

const INFO_GENERATE =
  "Describe a music cue. Jayrr generates audio with OpenRouter Lyria. Preview it, then add it. This uses credits.";

const INFO_VOICE =
  "Type a line to speak. Jayrr generates a voice clip with OpenRouter TTS. Length is estimated from the script. This uses credits.";

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

const PitchMark = ({ hz }: { hz: number }) => (
  <span
    className="jayrr-sound-library__metric jayrr-sound-library__metric--hz"
    style={{ color: centroidHzColor(hz) }}
    title={centroidHzLabel(hz)}
  >
    {hz} Hz
  </span>
);

const LoudnessMark = ({
  sources,
  stored,
}: {
  sources: string[];
  stored: number | null;
}) => {
  const [db, setDb] = useState<number | null>(stored);

  useEffect(() => {
    if (stored != null) {
      setDb(stored);
      return;
    }
    setDb(null);
    if (sources.length === 0) {
      return;
    }
    return subscribeLoudnessDb(sources, setDb);
  }, [sources, stored]);

  if (db == null) {
    return (
      <span
        className="jayrr-sound-library__metric jayrr-sound-library__metric--db is-empty"
        title="Loudness"
      >
        — dB
      </span>
    );
  }

  return (
    <span
      className="jayrr-sound-library__metric jayrr-sound-library__metric--db"
      style={{ color: loudnessDbColor(db) }}
      title={loudnessDbLabel(db)}
    >
      {formatLoudnessDb(db)}
    </span>
  );
};

const SoundWave = ({
  path,
  url,
  playing,
  progress,
}: {
  path: string;
  url: string | null;
  playing: boolean;
  progress: number;
}) => {
  const sources = useMemo(() => jayrrSoundPlayUrls(url, path), [path, url]);
  return (
    <JayrrSoundWaveform
      sources={sources}
      tone={playing ? "playing" : "idle"}
      progress={playing ? progress : 0}
      className="jayrr-sound-library__wave"
    />
  );
};

const SoundStats = ({
  clock,
  centroidHz,
  loudnessDb,
  path,
  url,
}: {
  clock: string;
  centroidHz: number;
  loudnessDb: number | null;
  path: string;
  url: string | null;
}) => {
  const sources = useMemo(() => jayrrSoundPlayUrls(url, path), [path, url]);
  return (
    <span className="jayrr-sound-library__stats">
      <PitchMark hz={centroidHz} />
      <LoudnessMark sources={sources} stored={loudnessDb} />
      <span className="jayrr-sound-library__clock">{clock}</span>
    </span>
  );
};

const MetricFilter = ({
  unit,
  label,
  value,
  options,
  onChange,
}: {
  unit: string;
  label: string;
  value: number;
  options: readonly MetricFilterOption[];
  onChange: (id: number) => void;
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.id === value) ?? options[0];

  useEffect(() => {
    if (!open) {
      return;
    }
    const node = wrapRef.current;
    const doc = node?.ownerDocument ?? document;
    const onPointer = (event: PointerEvent) => {
      if (!node?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    doc.addEventListener("pointerdown", onPointer);
    return () => {
      doc.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="jayrr-sound-library__filter" ref={wrapRef}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={
          value
            ? "jayrr-sound-library__filter-btn is-on"
            : "jayrr-sound-library__filter-btn"
        }
        style={value && selected?.color ? { color: selected.color } : undefined}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        {unit}
      </button>
      {open ? (
        <ul className="jayrr-sound-library__filter-menu" role="listbox">
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected={option.id === value}
                className={
                  option.id === value
                    ? "jayrr-sound-library__filter-option is-on"
                    : "jayrr-sound-library__filter-option"
                }
                style={option.color ? { color: option.color } : undefined}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
              >
                {option.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

const RING_R = 7.25;
const RING_C = 2 * Math.PI * RING_R;

type SoundSortKey = "name" | "hz" | "db" | "time";

const SortCol = ({
  column,
  label,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  column: SoundSortKey;
  label: string;
  sortKey: SoundSortKey;
  sortDir: "asc" | "desc";
  onSort: (column: SoundSortKey) => void;
  className?: string;
}) => {
  const active = sortKey === column;
  const mark = active ? (sortDir === "asc" ? "↑" : "↓") : "";
  return (
    <button
      type="button"
      className={
        active
          ? `jayrr-sound-library__sort is-on ${className ?? ""}`.trim()
          : `jayrr-sound-library__sort ${className ?? ""}`.trim()
      }
      aria-label={`Sort by ${label}`}
      aria-pressed={active}
      onClick={() => {
        onSort(column);
      }}
    >
      {label}
      {mark ? <span aria-hidden="true">{mark}</span> : null}
    </button>
  );
};

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
        <circle
          className="jayrr-sound-library__ring-track"
          cx="10"
          cy="10"
          r={RING_R}
        />
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

export const JayrrSoundLibraryDialog = ({
  onClose,
  selectedId = null,
  onSelect,
}: JayrrSoundLibraryDialogProps) => {
  const [folder, setFolder] = useState("");
  const [search, setSearch] = useState("");
  const [playingPath, setPlayingPath] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playError, setPlayError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pickMode = Boolean(onSelect);
  const [tab, setTab] = useState<SoundLibraryTab>("library");
  const info =
    tab === "voice"
      ? INFO_VOICE
      : tab === "generate"
      ? INFO_GENERATE
      : pickMode
      ? INFO_PICK
      : INFO_BROWSE;

  if (!isConvexLinked) {
    return (
      <Dialog
        className="jayrr-sound-library"
        size={900}
        onCloseRequest={onClose}
        title={
          <span className="jayrr-sound-library__title-row">
            Sound Library
            <Tooltip label={info} long position="top">
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
        <p className="visually-hidden">{info}</p>
        <SoundLibraryTabs tab={tab} onTab={setTab} />
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
      info={info}
      onClose={onClose}
      onSelect={onSelect}
      isPlaying={isPlaying}
      pickMode={pickMode}
      playError={playError}
      playingPath={playingPath}
      progress={progress}
      search={search}
      selectedId={selectedId}
      setFolder={setFolder}
      setIsPlaying={setIsPlaying}
      setPlayError={setPlayError}
      setPlayingPath={setPlayingPath}
      setProgress={setProgress}
      setSearch={setSearch}
      tab={tab}
      onTab={setTab}
    />
  );
};

const SoundLibraryTabs = ({
  tab,
  onTab,
}: {
  tab: SoundLibraryTab;
  onTab: (tab: SoundLibraryTab) => void;
}) => (
  <div
    className="jayrr-sound-library__tabs"
    role="tablist"
    aria-label="Sound source"
  >
    {TABS.map((item) => (
      <button
        key={item.id}
        type="button"
        role="tab"
        aria-selected={tab === item.id}
        className={
          tab === item.id
            ? "jayrr-sound-library__tab is-on"
            : "jayrr-sound-library__tab"
        }
        onClick={() => {
          onTab(item.id);
        }}
      >
        {item.label}
      </button>
    ))}
  </div>
);

const JayrrSoundLibraryDialogConnected = ({
  audioRef,
  folder,
  info,
  isPlaying,
  onClose,
  onSelect,
  pickMode,
  playError,
  playingPath,
  progress,
  search,
  selectedId,
  setFolder,
  setIsPlaying,
  setPlayError,
  setPlayingPath,
  setProgress,
  setSearch,
  tab,
  onTab,
}: {
  audioRef: MutableRefObject<HTMLAudioElement | null>;
  folder: string;
  info: string;
  isPlaying: boolean;
  onClose: () => void;
  onSelect?: (sound: JayrrSoundPick | null) => void;
  pickMode: boolean;
  playError: string | null;
  playingPath: string | null;
  progress: number;
  search: string;
  selectedId: string | null;
  setFolder: (folder: string) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlayError: (error: string | null) => void;
  setPlayingPath: (path: string | null) => void;
  setProgress: (progress: number) => void;
  setSearch: (search: string) => void;
  tab: SoundLibraryTab;
  onTab: (tab: SoundLibraryTab) => void;
}) => {
  const folders = useQuery(api.soundFolders.tree, {});
  const sounds = usePaginatedQuery(
    api.sounds.list,
    { folder, search },
    { initialNumItems: 40 },
  );
  const [pitchFilter, setPitchFilter] = useState(0);
  const [dbFilter, setDbFilter] = useState(0);
  const [loudnessGen, setLoudnessGen] = useState(0);
  const [sortKey, setSortKey] = useState<SoundSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    if (dbFilter === 0 && sortKey !== "db") {
      return;
    }
    return subscribeLoudnessCache(() => {
      setLoudnessGen((n) => n + 1);
    });
  }, [dbFilter, sortKey]);

  const toggleSort = (column: SoundSortKey) => {
    if (sortKey === column) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(column);
    setSortDir(column === "name" ? "asc" : "desc");
  };

  const visibleSounds = useMemo(() => {
    void loudnessGen;
    const filtered = sounds.results.filter((row) => {
      if (!matchesPitchFilter(row.centroidHz, pitchFilter)) {
        return false;
      }
      const db =
        row.loudnessDb ?? peekLoudnessDb(jayrrSoundPlayUrls(row.url, row.path));
      return matchesDecibelFilter(db, dbFilter);
    });
    const direction = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") {
        return a.name.localeCompare(b.name) * direction;
      }
      if (sortKey === "hz") {
        return (a.centroidHz - b.centroidHz) * direction;
      }
      if (sortKey === "time") {
        return (a.durationSec - b.durationSec) * direction;
      }
      const aDb =
        a.loudnessDb ?? peekLoudnessDb(jayrrSoundPlayUrls(a.url, a.path));
      const bDb =
        b.loudnessDb ?? peekLoudnessDb(jayrrSoundPlayUrls(b.url, b.path));
      if (aDb == null && bDb == null) {
        return a.name.localeCompare(b.name);
      }
      if (aDb == null) {
        return 1;
      }
      if (bDb == null) {
        return -1;
      }
      return (aDb - bDb) * direction;
    });
  }, [dbFilter, loudnessGen, pitchFilter, sortDir, sortKey, sounds.results]);

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

  const closeDialog = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
    onClose();
  };

  const playSound = async (
    url: string | null,
    path: string,
    soundId: string,
  ) => {
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
      setPlayError(null);
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
          setPlayError("Couldn’t resume this sound.");
        },
      );
      return;
    }

    let convexUrl = url;
    const urls = jayrrSoundPlayUrls(convexUrl, path);
    if (urls.length === 0) {
      setPlayError("No audio URL for this sound.");
      return;
    }

    audio.pause();
    setPlayingPath(path);
    setProgress(0);
    setPlayError(null);
    audio.onended = () => {
      setIsPlaying(false);
      setPlayingPath(null);
      setProgress(0);
    };

    for (const src of urls) {
      const ok = await assignAndPlayAudio(audio, src);
      if (ok) {
        setIsPlaying(true);
        return;
      }
    }

    if (!convexUrl && convexClient) {
      try {
        const row = await convexClient.query(api.sounds.get, {
          soundId: soundId as Id<"sounds">,
        });
        convexUrl = row?.url ?? null;
      } catch {
        convexUrl = null;
      }
      if (convexUrl && !urls.includes(convexUrl)) {
        const ok = await assignAndPlayAudio(audio, convexUrl);
        if (ok) {
          setIsPlaying(true);
          return;
        }
      }
    }

    setIsPlaying(false);
    setPlayingPath(null);
    setPlayError("Couldn’t play this sound.");
  };

  const pickSound = (sound: JayrrSoundPick) => {
    onSelect?.(sound);
    closeDialog();
  };

  return (
    <Dialog
      className={
        pickMode
          ? "jayrr-sound-library jayrr-sound-library--pick"
          : "jayrr-sound-library"
      }
      size={900}
      onCloseRequest={closeDialog}
      title={
        <span className="jayrr-sound-library__title-row">
          Sound Library
          <Tooltip label={info} long position="top">
            <span className="jayrr-sound-library__info" aria-label="More info">
              {helpIcon}
            </span>
          </Tooltip>
        </span>
      }
    >
      <p className="visually-hidden">{info}</p>
      <SoundLibraryTabs
        tab={tab}
        onTab={(next) => {
          if (next === "generate" || next === "voice") {
            audioRef.current?.pause();
            setIsPlaying(false);
          }
          onTab(next);
        }}
      />
      {tab === "generate" ? (
        <JayrrSoundLibraryGenerateTab
          onUse={pickMode ? pickSound : undefined}
        />
      ) : null}
      {tab === "voice" ? (
        <JayrrSoundLibraryVoiceTab onUse={pickMode ? pickSound : undefined} />
      ) : null}
      {tab === "library" ? (
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
              <div className="jayrr-sound-library__toolbar-row">
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
                <div className="jayrr-sound-library__filters">
                  <MetricFilter
                    unit="Hz"
                    label="Filter by pitch"
                    value={pitchFilter}
                    options={PITCH_FILTERS}
                    onChange={setPitchFilter}
                  />
                  <MetricFilter
                    unit="dB"
                    label="Filter by loudness"
                    value={dbFilter}
                    options={DECIBEL_FILTERS}
                    onChange={setDbFilter}
                  />
                </div>
              </div>
              {playError ? (
                <p className="jayrr-sound-library__error">{playError}</p>
              ) : null}
            </div>
            <div className="jayrr-sound-library__cols" role="row">
              <span
                className="jayrr-sound-library__cols-play"
                aria-hidden="true"
              />
              <SortCol
                column="name"
                label="Name"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="jayrr-sound-library__sort--name"
              />
              <span className="jayrr-sound-library__wave-col" aria-hidden>
                Wave
              </span>
              <span className="jayrr-sound-library__stats">
                <SortCol
                  column="hz"
                  label="Hz"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="jayrr-sound-library__metric--hz"
                />
                <SortCol
                  column="db"
                  label="dB"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="jayrr-sound-library__metric--db"
                />
                <SortCol
                  column="time"
                  label="Time"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="jayrr-sound-library__clock"
                />
              </span>
            </div>
            <ul className="jayrr-sound-library__sounds">
              {visibleSounds.map((row) => {
                const active = playingPath === row.path;
                const playing = active && isPlaying;
                const selected = selectedId === row._id;
                const remain = active
                  ? Math.max(0, row.durationSec * (1 - progress))
                  : row.durationSec;
                const rowClass = [
                  "jayrr-sound-library__row",
                  playing ? "is-playing" : "",
                  selected ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                if (pickMode) {
                  return (
                    <li key={row._id}>
                      <div className={rowClass}>
                        <button
                          type="button"
                          className="jayrr-sound-library__play-hit"
                          aria-label={
                            playing ? `Pause ${row.name}` : `Play ${row.name}`
                          }
                          onClick={() => {
                            void playSound(row.url, row.path, row._id);
                          }}
                        >
                          <PlayMark
                            playing={playing}
                            progress={active ? progress : 0}
                          />
                        </button>
                        <button
                          type="button"
                          className="jayrr-sound-library__pick"
                          aria-label={`Use ${row.name}`}
                          onClick={() => {
                            pickSound({
                              id: row._id,
                              name: row.name,
                              path: row.path,
                              durationSec: row.durationSec,
                              url: row.url,
                            });
                          }}
                        >
                          <span className="jayrr-sound-library__meta">
                            <span className="jayrr-sound-library__name">
                              {row.name}
                            </span>
                            <span className="jayrr-sound-library__path">
                              {row.folderPath}
                            </span>
                          </span>
                          <SoundWave
                            path={row.path}
                            url={row.url}
                            playing={playing}
                            progress={active ? progress : 0}
                          />
                          <SoundStats
                            clock={formatClock(remain)}
                            centroidHz={row.centroidHz}
                            loudnessDb={row.loudnessDb}
                            path={row.path}
                            url={row.url}
                          />
                        </button>
                      </div>
                    </li>
                  );
                }

                return (
                  <li key={row._id}>
                    <button
                      className={rowClass}
                      onClick={() => {
                        void playSound(row.url, row.path, row._id);
                      }}
                      type="button"
                      aria-label={
                        playing ? `Pause ${row.name}` : `Play ${row.name}`
                      }
                    >
                      <PlayMark
                        playing={playing}
                        progress={active ? progress : 0}
                      />
                      <span className="jayrr-sound-library__meta">
                        <span className="jayrr-sound-library__name">
                          {row.name}
                        </span>
                        <span className="jayrr-sound-library__path">
                          {row.folderPath}
                        </span>
                      </span>
                      <SoundWave
                        path={row.path}
                        url={row.url}
                        playing={playing}
                        progress={active ? progress : 0}
                      />
                      <SoundStats
                        clock={formatClock(remain)}
                        centroidHz={row.centroidHz}
                        loudnessDb={row.loudnessDb}
                        path={row.path}
                        url={row.url}
                      />
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
            {sounds.status !== "LoadingFirstPage" &&
            sounds.results.length > 0 &&
            visibleSounds.length === 0 ? (
              <p className="jayrr-sound-library__empty">
                No sounds match these Hz or dB filters.
              </p>
            ) : null}
            {pickMode && selectedId ? (
              <button
                className="jayrr-sound-library__clear"
                onClick={() => {
                  onSelect?.(null);
                  closeDialog();
                }}
                type="button"
              >
                Clear sound
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
};
