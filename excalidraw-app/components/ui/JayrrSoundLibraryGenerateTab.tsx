import { useAction, useConvexAuth } from "convex/react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { api } from "../../convexClient";

import { Button } from "./Button";
import { JayrrSoundWaveform } from "../../sounds/JayrrSoundWaveform";

import type { JayrrSoundPick } from "./JayrrSoundLibraryDialog";

const SUGGESTIONS = [
  { label: "Orchestral sting", prompt: "Short orchestral sting, no vocals" },
  { label: "Rain on tin", prompt: "Soft rain on a tin roof, looping bed" },
  { label: "Analog pulse", prompt: "Warm analog synth pulse for a title card" },
] as const;

type SoundModelRow = {
  id: string;
  name: string;
  durationSec: number;
};

export const JayrrSoundLibraryGenerateTab = ({
  onUse,
}: {
  onUse?: (sound: JayrrSoundPick) => void;
}) => {
  const { isAuthenticated } = useConvexAuth();
  const listModels = useAction(api.editorAi.generateSound.listModels);
  const generate = useAction(api.editorAi.generateSound.generate);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [prompt, setPrompt] = useState("");
  const [models, setModels] = useState<SoundModelRow[]>([]);
  const [modelId, setModelId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JayrrSoundPick | null>(null);

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
            : "Could not load sound models.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, listModels]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const submit = async (text: string) => {
    const value = text.trim();
    if (!value || busy) {
      return;
    }
    if (!isAuthenticated) {
      setError("Sign in to generate sound.");
      return;
    }
    audioRef.current?.pause();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const row = await generate({
        prompt: value,
        modelId: modelId || undefined,
      });
      setResult({
        id: row.id,
        name: row.name,
        path: row.path,
        durationSec: row.durationSec,
        url: row.url,
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Sound generation failed.",
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
    <form className="jayrr-sound-library__generate" onSubmit={onSubmit}>
      <div className="jayrr-sound-library__generate-bar">
        <div className="jayrr-sound-library__suggestions">
          {SUGGESTIONS.map((suggestion) => (
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
        <select
          className="jayrr-sound-library__model"
          value={modelId}
          disabled={busy || models.length === 0}
          aria-label="Sound model"
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
      {error ? <p className="jayrr-sound-library__error">{error}</p> : null}
      <textarea
        className="jayrr-sound-library__prompt"
        value={prompt}
        rows={3}
        disabled={busy}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={busy ? "Generating…" : "Describe the music or atmosphere…"}
        aria-label="Sound prompt"
      />
      <Button
        type="submit"
        variant={result ? "secondary" : "primary"}
        busy={busy}
        disabled={busy || !prompt.trim()}
      >
        {busy ? "Generating…" : result ? "Generate again" : "Generate"}
      </Button>
      {result?.url ? (
        <div className="jayrr-sound-library__preview">
          <p className="jayrr-sound-library__preview-name">{result.name}</p>
          {result.url ? (
            <JayrrSoundWaveform
              sources={[result.url]}
              className="jayrr-sound-library__wave jayrr-sound-library__wave--preview"
            />
          ) : null}
          <audio
            ref={audioRef}
            className="jayrr-sound-library__player"
            controls
            src={result.url}
          />
          {onUse ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                onUse(result);
              }}
            >
              Use sound
            </Button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
};
