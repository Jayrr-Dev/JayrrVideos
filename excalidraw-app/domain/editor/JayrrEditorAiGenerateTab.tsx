import { useAction, useConvexAuth } from "convex/react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { Button } from "../../components/ui/Button";
import { api } from "../../convexClient";

import { useJayrrEditorSession } from "./JayrrEditorSession";

const GENERATE_SUGGESTIONS = [
  {
    label: "Sunny beach",
    prompt: "A wide shot of waves on a sunny beach",
  },
  {
    label: "Coffee steam",
    prompt: "Close-up of coffee steam over a dark table",
  },
] as const;

const ASPECTS = ["16:9", "9:16", "1:1"] as const;
const DURATIONS = [4, 5, 6, 8] as const;

type AspectRatio = typeof ASPECTS[number];

type VideoModelRow = {
  id: string;
  name: string;
  supportedDurations: number[];
  supportedAspectRatios: string[];
};

const isAspect = (value: string): value is AspectRatio =>
  ASPECTS.some((item) => item === value);

export const JayrrEditorAiGenerateTab = () => {
  const { isAuthenticated } = useConvexAuth();
  const { addRecording, setSelectedClipIds } = useJayrrEditorSession();
  const listModels = useAction(api.editorAi.generateVideo.listModels);
  const generate = useAction(api.editorAi.generateVideo.generate);
  const [prompt, setPrompt] = useState("");
  const [models, setModels] = useState<VideoModelRow[]>([]);
  const [modelId, setModelId] = useState("");
  const [durationSec, setDurationSec] = useState(5);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    let cancelled = false;
    void listModels({})
      .then((rows) => {
        if (cancelled) {
          return;
        }
        setModels(rows);
        setModelId((current) => current || rows[0]?.id || "");
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load video models.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, listModels]);

  const selected = models.find((model) => model.id === modelId) ?? null;
  const durationOptions = useMemo(() => {
    if (selected && selected.supportedDurations.length > 0) {
      return selected.supportedDurations;
    }
    return [...DURATIONS];
  }, [selected]);
  const aspectOptions = useMemo(() => {
    if (selected && selected.supportedAspectRatios.length > 0) {
      return selected.supportedAspectRatios.filter(isAspect);
    }
    return [...ASPECTS];
  }, [selected]);

  useEffect(() => {
    if (durationOptions.includes(durationSec)) {
      return;
    }
    const next = durationOptions[0];
    if (typeof next === "number") {
      setDurationSec(next);
    }
  }, [durationOptions, durationSec]);

  useEffect(() => {
    if (aspectOptions.includes(aspectRatio)) {
      return;
    }
    const next = aspectOptions[0];
    if (next) {
      setAspectRatio(next);
    }
  }, [aspectOptions, aspectRatio]);

  const submit = async (text: string) => {
    const value = text.trim();
    if (!value || busy) {
      return;
    }
    if (!isAuthenticated) {
      setError("Sign in to generate video.");
      return;
    }
    setBusy(true);
    setError(null);
    setAdded(false);
    try {
      const row = await generate({
        prompt: value,
        durationSec,
        aspectRatio,
        modelId: modelId || undefined,
      });
      const clipId = addRecording(row);
      setSelectedClipIds([clipId]);
      setAdded(true);
      setPrompt("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Video generation failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit(prompt);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void submit(prompt);
    }
  };

  return (
    <form className="jayrr-editor-ai__generate" onSubmit={onSubmit}>
      <div className="jayrr-editor-ai__generate-bar">
        <div className="jayrr-editor-ai__suggestions">
          {GENERATE_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.prompt}
              type="button"
              disabled={busy}
              title={suggestion.prompt}
              onClick={() => {
                setPrompt(suggestion.prompt);
              }}
            >
              {suggestion.label}
            </button>
          ))}
        </div>
        <div className="jayrr-editor-ai__generate-opts">
          <select
            className="jayrr-editor-ai__opt"
            value={String(durationSec)}
            disabled={busy}
            aria-label="Clip length"
            onChange={(event) =>
              setDurationSec(Number(event.currentTarget.value))
            }
          >
            {durationOptions.map((item) => (
              <option key={item} value={item}>
                {item}s
              </option>
            ))}
          </select>
          <select
            className="jayrr-editor-ai__opt"
            value={aspectRatio}
            disabled={busy}
            aria-label="Aspect ratio"
            onChange={(event) => {
              const next = event.currentTarget.value;
              if (isAspect(next)) {
                setAspectRatio(next);
              }
            }}
          >
            {aspectOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className="jayrr-editor-ai__model"
            value={modelId}
            disabled={busy || models.length === 0}
            aria-label="Video model"
            onChange={(event) => setModelId(event.currentTarget.value)}
          >
            {models.length === 0 ? (
              <option value="">{error ? "Auto" : "Loading…"}</option>
            ) : (
              models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>
      {error ? <div className="jayrr-editor-ai-error">{error}</div> : null}
      {added ? (
        <p className="jayrr-editor-ai__generate-status">
          Added to the timeline.
        </p>
      ) : null}
      <textarea
        className="jayrr-editor-ai__prompt"
        value={prompt}
        rows={3}
        disabled={busy}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={busy ? "Generating…" : "Describe the clip…"}
        aria-label="Video prompt"
      />
      <Button
        type="submit"
        variant={added ? "secondary" : "primary"}
        busy={busy}
        disabled={busy || !prompt.trim()}
      >
        {busy ? "Generating…" : added ? "Generate again" : "Generate"}
      </Button>
    </form>
  );
};
