import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";

import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { api, convexClient } from "../../../convexClient";
import {
  readTranscript,
  subscribeTranscripts,
  type TranscriptFeedTurn,
} from "../../transcription/publishTranscript";
import { speakerLabel } from "../../transcription/transcriptTurns";
import { readCalledObjectKind } from "../model";

import {
  CLASSIFIER_PRESETS,
  DEFAULT_CLASSIFIER,
  OTHER_CLASS_ID,
  applyClassifierPreset,
  classOptionsForJev,
  nextClassId,
  readClassifierConfig,
  writeClassifierConfig,
  type ClassifierConfig,
} from "./classifierConfig";
import { useRegisterWidgetToolbar } from "../widgetToolbarRegistry";

type TabId = "classes" | "config" | "output";

type ScoreRow = {
  id: string;
  name: string;
  percent: number;
};

type JevResult = {
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
};

/** One scored transcript bubble. */
type TurnScore = {
  turnId: string;
  speaker: number | null;
  text: string;
  result: JevResult;
};

type SpeakerCard = {
  speaker: number | null;
  name: string;
  tag: string;
  tagId: string;
  turns: number;
  rows: ScoreRow[];
};

type Job = { turnId: string; speaker: number | null; text: string };

const TABS: { id: TabId; label: string }[] = [
  { id: "classes", label: "Classes" },
  { id: "config", label: "Config" },
  { id: "output", label: "Output" },
];

const LIVE_TURN_ID = "__live__";
const LIVE_DEBOUNCE_MS = 450;
const MIN_PHRASE_CHARS = 3;
const SNIPPET_CHARS = 140;
const MAX_SCORED_TURNS = 200;

const feedLabel = (
  kind: "transcribe" | "transcription" | "caption",
  index: number,
  id: string,
) => {
  const name =
    kind === "transcription"
      ? "Transcription"
      : kind === "caption"
      ? "Caption"
      : "Live Classifier";
  return `${name} ${index + 1} (${id.slice(0, 4)})`;
};

const listTranscribeSources = (
  elements: readonly ExcalidrawElement[],
): { id: string; label: string }[] => {
  const sources: { id: string; label: string }[] = [];
  let transcribeIndex = 0;
  let captionIndex = 0;
  let overlayIndex = 0;
  for (const element of elements) {
    const kind = readCalledObjectKind(element);
    if (kind === "transcribe") {
      sources.push({
        id: element.id,
        label: feedLabel("transcribe", transcribeIndex, element.id),
      });
      transcribeIndex += 1;
      continue;
    }
    if (kind === "transcription") {
      sources.push({
        id: element.id,
        label: feedLabel("transcription", captionIndex, element.id),
      });
      captionIndex += 1;
      continue;
    }
    if (kind === "caption") {
      sources.push({
        id: element.id,
        label: feedLabel("caption", overlayIndex, element.id),
      });
      overlayIndex += 1;
    }
  }
  return sources;
};

const percentLabel = (value: number) => `${Math.round(value * 100)}%`;

const classifyErrorMessage = (error: unknown) => {
  const raw = error instanceof Error ? error.message : "";
  if (raw.includes("Could not find public function")) {
    return "Classifier is not on the server yet. Restart convex dev.";
  }
  if (raw.includes("TypeSafe is not configured")) {
    return "Missing TYPESAFE_API_KEY on Convex. Set it, then retry.";
  }
  if (raw.includes("Not authenticated")) {
    return "Sign in to classify.";
  }
  const stripped = raw
    .replace(/\[CONVEX[^\]]*\]\s*/g, "")
    .replace(/\[Request ID:[^\]]*\]\s*/g, "")
    .replace(/^(Uncaught\s+)?(Server\s+)?Error:?\s*/i, "")
    .replace(/\s*Called by client\.?$/i, "")
    .trim();
  return stripped || "Could not classify.";
};

const classNames = (config: ClassifierConfig) => {
  const names = new Map(
    config.classes.map((row) => [row.id, row.name.trim() || row.id]),
  );
  if (config.includeOther) {
    names.set(OTHER_CLASS_ID, "Other");
  }
  return names;
};

const toRows = (
  probabilities: Record<string, number>,
  names: Map<string, string>,
): ScoreRow[] =>
  Object.entries(probabilities)
    .map(([id, probability]) => ({
      id,
      name: names.get(id) ?? id,
      percent: probability,
    }))
    .sort((left, right) => right.percent - left.percent);

/**
 * Average each speaker's class probabilities across their scored bubbles.
 * The tag is whichever class they lean toward most overall.
 */
const buildSpeakerCards = (
  scores: TurnScore[],
  speakerNames: Record<number, string>,
  names: Map<string, string>,
): SpeakerCard[] => {
  const totals = new Map<
    string,
    { speaker: number | null; turns: number; sums: Record<string, number> }
  >();
  for (const score of scores) {
    const key = score.speaker === null ? "null" : String(score.speaker);
    const entry = totals.get(key) ?? {
      speaker: score.speaker,
      turns: 0,
      sums: {},
    };
    entry.turns += 1;
    for (const [id, probability] of Object.entries(
      score.result.probabilities,
    )) {
      entry.sums[id] = (entry.sums[id] ?? 0) + probability;
    }
    totals.set(key, entry);
  }
  const cards: SpeakerCard[] = [];
  for (const entry of totals.values()) {
    const averaged: Record<string, number> = {};
    for (const [id, sum] of Object.entries(entry.sums)) {
      averaged[id] = sum / entry.turns;
    }
    const rows = toRows(averaged, names);
    const top = rows[0];
    if (!top) {
      continue;
    }
    cards.push({
      speaker: entry.speaker,
      name: speakerLabel(entry.speaker, speakerNames),
      tag: top.name,
      tagId: top.id,
      turns: entry.turns,
      rows,
    });
  }
  return cards.sort((left, right) => right.turns - left.turns);
};

export const ClassifierWidget = ({ elementId }: { elementId: string }) => {
  const editor = useExcalidrawAPI();
  const [tab, setTab] = useState<TabId>("classes");
  const [config, setConfig] = useState<ClassifierConfig>(DEFAULT_CLASSIFIER);
  const [sources, setSources] = useState<{ id: string; label: string }[]>([]);
  const [turns, setTurns] = useState<TranscriptFeedTurn[]>([]);
  const [speakerNames, setSpeakerNames] = useState<Record<number, string>>({});
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(
    "Add classes, then pick a transcript source.",
  );
  const [scores, setScores] = useState<TurnScore[]>([]);
  const [live, setLive] = useState<TurnScore | null>(null);

  const configRef = useRef(config);
  configRef.current = config;
  const queueRef = useRef<Job[]>([]);
  const liveJobRef = useRef<Job | null>(null);
  const runningRef = useRef(false);
  const generationRef = useRef(0);
  const scoredTextRef = useRef(new Map<string, string>());

  const persist = useCallback(
    (next: ClassifierConfig) => {
      if (!editor) {
        return;
      }
      const all = editor.getSceneElementsIncludingDeleted();
      const mapped = all.map((element) => {
        if (element.id !== elementId) {
          return element;
        }
        return newElementWith(element, {
          customData: writeClassifierConfig(element, next),
        });
      });
      editor.updateScene({
        elements: mapped,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    },
    [editor, elementId],
  );

  const applyConfig = useCallback(
    (next: ClassifierConfig, save: boolean) => {
      setConfig(next);
      if (save) {
        persist(next);
      }
    },
    [persist],
  );

  /** Forget every score so the next phrases are judged with fresh classes. */
  const resetScores = useCallback(() => {
    generationRef.current += 1;
    queueRef.current = [];
    liveJobRef.current = null;
    scoredTextRef.current.clear();
    setScores([]);
    setLive(null);
  }, []);

  useEffect(() => {
    const element = editor
      ?.getSceneElementsIncludingDeleted()
      .find((item) => item.id === elementId);
    if (!element) {
      return;
    }
    setConfig(readClassifierConfig(element));
  }, [editor, elementId]);

  useEffect(() => {
    const refresh = () => {
      const elements = editor?.getSceneElements() ?? [];
      const nextSources = listTranscribeSources(elements);
      setSources(nextSources);
      const sourceId = config.sourceId || nextSources[0]?.id || "";
      if (!config.sourceId && sourceId) {
        applyConfig({ ...configRef.current, sourceId }, true);
      }
      const feed = sourceId ? readTranscript(sourceId) : null;
      setTurns(feed?.turns ?? []);
      setSpeakerNames(feed?.names ?? {});
      setListening(feed?.listening ?? false);
    };
    refresh();
    const interval = window.setInterval(refresh, 1200);
    const unsubscribe = subscribeTranscripts(refresh);
    return () => {
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [applyConfig, config.sourceId, editor]);

  const classifyText = useCallback(async (text: string): Promise<JevResult> => {
    if (!convexClient) {
      throw new Error("Convex is not connected.");
    }
    const current = configRef.current;
    return await convexClient.action(api.canvasAi.jev.classify, {
      state: text,
      instructions: current.instructions,
      classes: current.classes.map((row) => ({
        id: row.id,
        name: row.name,
        hint: row.hint || undefined,
      })),
      includeOther: current.includeOther,
    });
  }, []);

  /** Drain finished bubbles first, then the live one. One Jev call at a time. */
  const pump = useCallback(async () => {
    if (runningRef.current) {
      return;
    }
    runningRef.current = true;
    setBusy(true);
    try {
      for (;;) {
        const generation = generationRef.current;
        const job = queueRef.current.shift() ?? liveJobRef.current;
        if (!job) {
          break;
        }
        if (job.turnId === LIVE_TURN_ID) {
          liveJobRef.current = null;
        }
        try {
          const result = await classifyText(job.text);
          if (generation !== generationRef.current) {
            continue;
          }
          const score: TurnScore = {
            turnId: job.turnId,
            speaker: job.speaker,
            text: job.text,
            result,
          };
          if (job.turnId === LIVE_TURN_ID) {
            setLive(score);
          } else {
            scoredTextRef.current.set(job.turnId, job.text);
            setScores((current) =>
              [
                ...current.filter((item) => item.turnId !== job.turnId),
                score,
              ].slice(-MAX_SCORED_TURNS),
            );
          }
          setStatus("Live from Jev.");
        } catch (error: unknown) {
          if (generation !== generationRef.current) {
            continue;
          }
          setStatus(classifyErrorMessage(error));
          // Stop hammering the server if the call itself is broken.
          queueRef.current = [];
          liveJobRef.current = null;
        }
      }
    } finally {
      runningRef.current = false;
      setBusy(false);
    }
  }, [classifyText]);

  const enqueueFinal = useCallback((turn: TranscriptFeedTurn) => {
    const text = turn.text.trim();
    if (text.length < MIN_PHRASE_CHARS) {
      return false;
    }
    if (scoredTextRef.current.get(turn.id) === text) {
      return false;
    }
    if (queueRef.current.some((job) => job.turnId === turn.id)) {
      return false;
    }
    queueRef.current.push({ turnId: turn.id, speaker: turn.speaker, text });
    return true;
  }, []);

  const classesReady = useMemo(
    () => Object.keys(classOptionsForJev(config)).length >= 2,
    [config],
  );
  const recipeKey = [
    config.instructions,
    config.includeOther ? "1" : "0",
    ...config.classes.map((row) => `${row.id}:${row.name}:${row.hint}`),
  ].join("|");

  // Live mode: every finished bubble gets scored once (re-scored if it grew).
  useEffect(() => {
    if (!config.sourceId || !classesReady) {
      return;
    }
    let added = false;
    for (const turn of turns) {
      if (turn.isFinal && enqueueFinal(turn)) {
        added = true;
      }
    }
    if (added) {
      void pump();
    }
  }, [classesReady, config.sourceId, enqueueFinal, pump, recipeKey, turns]);

  const liveTurn = useMemo(
    () => turns.filter((turn) => !turn.isFinal).at(-1) ?? null,
    [turns],
  );
  const livePhrase = liveTurn?.text.trim() ?? "";

  // The bubble still being spoken is scored as it grows, debounced.
  useEffect(() => {
    if (!config.sourceId || !classesReady || !liveTurn) {
      return;
    }
    if (livePhrase.length < MIN_PHRASE_CHARS) {
      return;
    }
    const handle = window.setTimeout(() => {
      liveJobRef.current = {
        turnId: LIVE_TURN_ID,
        speaker: liveTurn.speaker,
        text: livePhrase,
      };
      void pump();
    }, LIVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [classesReady, config.sourceId, livePhrase, liveTurn, pump]);

  // Once the live bubble lands as final, drop the provisional score.
  useEffect(() => {
    if (!liveTurn) {
      setLive(null);
    }
  }, [liveTurn]);

  const names = useMemo(() => classNames(config), [config]);
  const cards = useMemo(
    () =>
      buildSpeakerCards(live ? [...scores, live] : scores, speakerNames, names),
    [live, names, scores, speakerNames],
  );
  const preview =
    livePhrase.length > SNIPPET_CHARS
      ? livePhrase.slice(-SNIPPET_CHARS)
      : livePhrase;

  const selectedSource = sources.find(
    (source) => source.id === config.sourceId,
  );

  const rescoreAll = () => {
    resetScores();
    for (const turn of turns) {
      if (turn.isFinal) {
        enqueueFinal(turn);
      }
    }
    if (queueRef.current.length === 0) {
      setStatus("Nothing to classify yet. Start a transcript source.");
      return;
    }
    void pump();
  };

  return (
    <div className="jayrr-called-embed jayrr-called-embed--classifier">
      <div className="jayrr-called-embed__tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={
              tab === item.id
                ? "jayrr-called-embed__tab is-on"
                : "jayrr-called-embed__tab"
            }
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "classes" ? (
        <div className="jayrr-called-embed__stack">
          <label className="jayrr-called-embed__field">
            <span>Preset</span>
            <select
              className="jayrr-called-embed__select"
              value=""
              aria-label="Load a preset classifier"
              onChange={(event) => {
                if (!event.target.value) {
                  return;
                }
                resetScores();
                const next = applyClassifierPreset(config, event.target.value);
                applyConfig(
                  {
                    ...next,
                    sourceId: next.sourceId || sources[0]?.id || "",
                  },
                  true,
                );
                setTab("output");
              }}
            >
              <option value="">Pick a ready-made classifier…</option>
              {CLASSIFIER_PRESETS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="jayrr-called-embed__hint">
            Names Jev can pick, like Yes / No or Angry.
          </div>
          <div className="jayrr-called-embed__list">
            {config.classes.map((row, index) => (
              <div key={row.id} className="jayrr-called-embed__class">
                <input
                  type="text"
                  className="jayrr-called-embed__input"
                  value={row.name}
                  aria-label={`Class ${index + 1} name`}
                  placeholder="Angry"
                  onChange={(event) => {
                    const classes = config.classes.map((item) =>
                      item.id === row.id
                        ? { ...item, name: event.target.value }
                        : item,
                    );
                    applyConfig({ ...config, classes }, false);
                  }}
                  onBlur={() => persist(config)}
                />
                <input
                  type="text"
                  className="jayrr-called-embed__input jayrr-called-embed__input--hint"
                  value={row.hint}
                  aria-label={`${row.name || "Class"} meaning`}
                  placeholder="Sounds angry or hostile"
                  onChange={(event) => {
                    const classes = config.classes.map((item) =>
                      item.id === row.id
                        ? { ...item, hint: event.target.value }
                        : item,
                    );
                    applyConfig({ ...config, classes }, false);
                  }}
                  onBlur={() => persist(config)}
                />
                <button
                  type="button"
                  className="jayrr-called-embed__icon-btn"
                  aria-label={`Remove ${row.name || "class"}`}
                  disabled={config.classes.length <= 2}
                  onClick={() => {
                    const classes = config.classes.filter(
                      (item) => item.id !== row.id,
                    );
                    resetScores();
                    applyConfig({ ...config, classes }, true);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="jayrr-called-embed__btn jayrr-called-embed__btn--add"
            onClick={() => {
              applyConfig(
                {
                  ...config,
                  classes: [
                    ...config.classes,
                    { id: nextClassId(), name: "", hint: "" },
                  ],
                },
                true,
              );
            }}
          >
            + Add class
          </button>
        </div>
      ) : null}
      {tab === "config" ? (
        <div className="jayrr-called-embed__stack">
          <label className="jayrr-called-embed__field">
            <span>Source</span>
            <select
              className="jayrr-called-embed__select"
              value={config.sourceId}
              onChange={(event) => {
                resetScores();
                applyConfig({ ...config, sourceId: event.target.value }, true);
              }}
            >
              <option value="">Pick a transcript source</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
          <label className="jayrr-called-embed__field">
            <span>Question</span>
            <input
              type="text"
              className="jayrr-called-embed__input"
              value={config.instructions}
              onChange={(event) =>
                applyConfig(
                  { ...config, instructions: event.target.value },
                  false,
                )
              }
              onBlur={() => persist(config)}
            />
          </label>
          <label className="jayrr-called-embed__check">
            <input
              type="checkbox"
              checked={config.includeOther}
              onChange={(event) => {
                resetScores();
                applyConfig(
                  { ...config, includeOther: event.target.checked },
                  true,
                );
              }}
            />
            Include Other
          </label>
          <div className="jayrr-called-embed__hint">
            {selectedSource
              ? listening
                ? "Linked to that transcript stream."
                : "Linked. Start that widget to classify live speech."
              : sources.length === 0
              ? "Drop a Live Classifier or Transcription widget first."
              : "Pick the widget whose text to classify."}
          </div>
        </div>
      ) : null}
      {tab === "output" ? (
        <div className="jayrr-called-embed__stack jayrr-called-embed__stack--fill">
          <div className="jayrr-called-embed__scores">
            {cards.length === 0 ? (
              <div className="jayrr-called-embed__empty">
                {listening
                  ? "Listening. Tags update as people talk."
                  : selectedSource
                  ? "Start the transcript source to see live tags."
                  : "Pick a transcript source in Config."}
              </div>
            ) : (
              cards.map((card) => {
                const talking = liveTurn?.speaker === card.speaker;
                const top = card.rows[0];
                return (
                  <div
                    key={card.speaker === null ? "null" : card.speaker}
                    className={
                      talking
                        ? "jayrr-called-embed__speaker is-live"
                        : "jayrr-called-embed__speaker"
                    }
                  >
                    <div className="jayrr-called-embed__speaker-head">
                      {talking ? (
                        <span
                          className="jayrr-called-embed__pulse"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span className="jayrr-called-embed__speaker-name">
                        {card.name} [{card.tag}{" "}
                        {percentLabel(top?.percent ?? 0)}]
                      </span>
                    </div>
                    <div className="jayrr-called-embed__chips">
                      {card.rows.map((row) => (
                        <span
                          key={row.id}
                          className={
                            row.id === card.tagId
                              ? "jayrr-called-embed__chip is-on"
                              : "jayrr-called-embed__chip"
                          }
                        >
                          {row.name} {percentLabel(row.percent)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {preview ? (
            <div className="jayrr-called-embed__snippet">
              Hearing: {preview}
            </div>
          ) : null}
          <button
            type="button"
            className="jayrr-called-embed__btn"
            disabled={busy}
            onClick={rescoreAll}
          >
            {busy ? "Classifying…" : "Re-score everything"}
          </button>
          <div className="jayrr-called-embed__hint">{status}</div>
        </div>
      ) : null}
    </div>
  );
};
