import { useAction, useConvexAuth } from "convex/react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { api } from "../../convexClient";

import { useJayrrEditorSession } from "./JayrrEditorSession";

const GENERATE_SUGGESTIONS = [
  "A wide shot of waves on a sunny beach",
  "Close-up of coffee steam over a dark table",
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
  const [status, setStatus] = useState<string | null>(null);

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
    setStatus("Generating video… this can take a minute.");
    try {
      const row = await generate({
        prompt: value,
        durationSec,
        aspectRatio,
        modelId: modelId || undefined,
      });
      const clipId = addRecording(row);
      setSelectedClipIds([clipId]);
      setStatus("Added to the timeline.");
      setPrompt("");
    } catch (caught) {
      setStatus(null);
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
      <div className="jayrr-editor-ai__empty">
        <p>Generate a video clip</p>
        <div className="jayrr-editor-ai__suggestions">
          {GENERATE_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={busy}
              onClick={() => {
                setPrompt(suggestion);
                void submit(suggestion);
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
      <div className="jayrr-editor-ai__generate-row">
        <Field label="Model">
          <select
            className="jayrr-ui-input"
            value={modelId}
            disabled={busy || models.length === 0}
            aria-label="Video model"
            onChange={(event) => setModelId(event.currentTarget.value)}
          >
            {models.length === 0 ? (
              <option value="">{error ? "Auto" : "Loading models…"}</option>
            ) : (
              models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))
            )}
          </select>
        </Field>
      </div>
      <div className="jayrr-editor-ai__generate-row jayrr-editor-ai__generate-row--split">
        <Field label="Length">
          <select
            className="jayrr-ui-input"
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
        </Field>
        <Field label="Aspect">
          <select
            className="jayrr-ui-input"
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
        </Field>
      </div>
      {status ? (
        <div className="jayrr-editor-ai-chip jayrr-editor-ai-chip--busy">
          {status}
        </div>
      ) : null}
      {error ? <div className="jayrr-editor-ai-error">{error}</div> : null}
      <div className="jayrr-editor-ai__composer-box">
        <textarea
          value={prompt}
          rows={3}
          disabled={busy}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={busy ? "Generating…" : "Describe the clip to generate…"}
          aria-label="Video prompt"
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        busy={busy}
        disabled={busy || !prompt.trim()}
      >
        Generate
      </Button>
    </form>
  );
};
