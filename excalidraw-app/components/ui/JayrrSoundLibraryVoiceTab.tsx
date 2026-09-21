import { useAction, useConvexAuth } from "convex/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { api } from "../../convexClient";
import { JayrrSoundWaveform } from "../../sounds/JayrrSoundWaveform";

import { Button } from "./Button";

import type { JayrrSoundPick } from "./JayrrSoundLibraryDialog";

const SUGGESTIONS = [
  { label: "Welcome back", prompt: "Welcome back." },
  { label: "Next up", prompt: "Next up, here's what you need to know." },
  { label: "That's a wrap", prompt: "That's a wrap. Thanks for watching." },
] as const;

const WORDS_PER_SEC = 2.5;

type VoiceModelRow = {
  id: string;
  name: string;
  voices: { id: string; name: string }[];
};

const estimateSpeechSec = (text: string) => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) {
    return 0;
  }
  return Math.max(1, Math.round(words / WORDS_PER_SEC));
};

const estimateWaitSec = (text: string) => {
  const chars = text.trim().length;
  if (chars === 0) {
    return 0;
  }
  return Math.max(4, Math.min(20, 4 + Math.ceil(chars / 80)));
};

const formatDuration = (sec: number) => {
  if (sec < 60) {
    return `${sec}s`;
  }
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  if (seconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
};

export const JayrrSoundLibraryVoiceTab = ({
  onUse,
}: {
  onUse?: (sound: JayrrSoundPick) => void;
}) => {
  const { isAuthenticated } = useConvexAuth();
  const listModels = useAction(api.editorAi.generateVoice.listModels);
  const generate = useAction(api.editorAi.generateVoice.generate);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [prompt, setPrompt] = useState("");
  const [models, setModels] = useState<VoiceModelRow[]>([]);
  const [modelId, setModelId] = useState("");
  const [voiceId, setVoiceId] = useState("");
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
            : "Could not load voice models.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, listModels]);

  const selected = models.find((model) => model.id === modelId) ?? null;
  const voices = useMemo(() => selected?.voices ?? [], [selected]);

  useEffect(() => {
    if (voices.some((voice) => voice.id === voiceId)) {
      return;
    }
    setVoiceId(voices[0]?.id ?? "");
  }, [voiceId, voices]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
    };
  }, [result?.url]);

  const clipEstSec = useMemo(() => estimateSpeechSec(prompt), [prompt]);
  const waitEstSec = useMemo(() => estimateWaitSec(prompt), [prompt]);

  const submit = async (text: string) => {
    const value = text.trim();
    if (!value || busy) {
      return;
    }
    if (!isAuthenticated) {
      setError("Sign in to generate voice.");
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
        voiceId: voiceId || undefined,
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
        caught instanceof Error ? caught.message : "Voice generation failed.",
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
        <div className="jayrr-sound-library__generate-opts">
          <select
            className="jayrr-sound-library__model"
            value={voiceId}
            disabled={busy || voices.length === 0}
            aria-label="Voice"
            onChange={(event) => setVoiceId(event.currentTarget.value)}
          >
            {voices.length === 0 ? (
              <option value="">{error ? "Voice" : "Loading…"}</option>
            ) : (
              voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))
            )}
          </select>
          <select
            className="jayrr-sound-library__model"
            value={modelId}
            disabled={busy || models.length === 0}
            aria-label="Voice model"
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
      {error ? <p className="jayrr-sound-library__error">{error}</p> : null}
      <textarea
        className="jayrr-sound-library__prompt"
        value={prompt}
        rows={3}
        disabled={busy}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={busy ? "Generating…" : "Type the words to speak…"}
        aria-label="Voice script"
      />
      {clipEstSec > 0 ? (
        <p className="jayrr-sound-library__est">
          {busy
            ? `Est. ~${formatDuration(
                clipEstSec,
              )} clip · about ${formatDuration(waitEstSec)} to generate`
            : `Est. ~${formatDuration(clipEstSec)} clip`}
        </p>
      ) : null}
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
          <JayrrSoundWaveform
            sources={[result.url]}
            className="jayrr-sound-library__wave jayrr-sound-library__wave--preview"
          />
          <audio
            ref={audioRef}
            className="jayrr-sound-library__player"
            controls
            src={result.url}
            onLoadedMetadata={(event) => {
              const duration = event.currentTarget.duration;
              if (!Number.isFinite(duration) || duration <= 0) {
                return;
              }
              setResult((current) =>
                current
                  ? { ...current, durationSec: Math.round(duration) }
                  : current,
              );
            }}
          />
          {typeof result.durationSec === "number" ? (
            <p className="jayrr-sound-library__est">
              {result.durationSec}s clip
            </p>
          ) : null}
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
