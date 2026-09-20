import {
  CaptureUpdateAction,
  isTextElement,
  newElementWith,
  refreshTextDimensions,
} from "@excalidraw/element";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  acquireJayrrTabAudio,
  listJayrrDisplayStreams,
  listJayrrMics,
  releaseJayrrTabAudio,
  subscribeJayrrStreams,
  unlockJayrrMics,
} from "../../../camera/jayrrCameraStreams";
import {
  mixMicIntoStream,
  openJayrrMic,
} from "../../../camera/mixMicIntoStream";
import {
  listenStreamTranscript,
  type TranscriptSession,
} from "../../transcription/listenStreamTranscript";
import {
  clearTranscript,
  publishTranscript,
} from "../../transcription/publishTranscript";
import {
  ensureSpeakerNames,
  formatLiveCaption,
  formatVideoTranscript,
  type TranscriptTurn,
} from "../../transcription/transcriptTurns";

import {
  PRESENT_MIC_DEFAULT,
  PRESENT_MIC_NONE,
  getPresentMic,
  presentMicDeviceId,
  setPresentMic,
} from "../../../present/presentMic";
import { JAYRR_CAPTION_FOR_KEY } from "../model";

import {
  CAPTION_PLACEHOLDER,
  newCaptionOverlayElement,
  readCaptionConfig,
  writeCaptionConfig,
} from "./captionConfig";
import {
  EMBED_PREFIX,
  MIC_SOURCE,
  isMicSource,
  listAudioSources,
  micDeviceId,
  micSourceId,
  type AudioSourceOption,
} from "./listAudioSources";
import {
  DEFAULT_TRANSCRIPTION,
  TRANSCRIPTION_PLACEHOLDER,
  newCaptionTextElement,
  readTranscriptionConfig,
  writeTranscriptionConfig,
  type TranscriptionConfig,
} from "./transcriptionConfig";
import { LiveWidgetToolbar } from "../ui/LiveWidgetToolbar";
import { useRegisterWidgetToolbar } from "../widgetToolbarRegistry";

type ChatTurn = TranscriptTurn & {
  id: string;
  isFinal: boolean;
};

const nextTurnId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const persistConfig = (
  editor: ExcalidrawImperativeAPI,
  elementId: string,
  next: TranscriptionConfig,
  write: typeof writeTranscriptionConfig,
) => {
  const mapped = editor.getSceneElementsIncludingDeleted().map((element) => {
    if (element.id !== elementId) {
      return element;
    }
    return newElementWith(element, {
      customData: write(element, next),
    });
  });
  editor.updateScene({
    elements: mapped,
    captureUpdate: CaptureUpdateAction.EVENTUALLY,
  });
};

const writeCaptionText = (
  editor: ExcalidrawImperativeAPI,
  textElementId: string,
  nextText: string,
) => {
  const editingId = editor.getAppState().editingTextElement?.id;
  if (editingId === textElementId) {
    return;
  }
  const map = editor.getSceneElementsMapIncludingDeleted();
  const element = map.get(textElementId);
  if (!element || element.isDeleted || !isTextElement(element)) {
    return;
  }
  if (element.text === nextText && element.originalText === nextText) {
    return;
  }
  const dims = refreshTextDimensions(element, null, map, nextText);
  if (!dims) {
    return;
  }
  editor.updateScene({
    elements: editor.getSceneElementsIncludingDeleted().map((item) => {
      if (item.id !== textElementId) {
        return item;
      }
      return newElementWith(element, {
        text: dims.text,
        originalText: nextText,
        x: dims.x,
        y: dims.y,
        width: dims.width,
        height: dims.height,
      });
    }),
    captureUpdate: CaptureUpdateAction.EVENTUALLY,
  });
};

const findCaptionText = (
  elements: readonly ExcalidrawElement[],
  widgetId: string,
  textElementId: string,
) => {
  const byId = elements.find(
    (element) =>
      element.id === textElementId &&
      !element.isDeleted &&
      isTextElement(element),
  );
  if (byId) {
    return byId;
  }
  return elements.find((element) => {
    if (element.isDeleted || !isTextElement(element)) {
      return false;
    }
    return element.customData?.[JAYRR_CAPTION_FOR_KEY] === widgetId;
  });
};

export const SpeechCanvasWidget = ({
  elementId,
  kind,
}: {
  elementId: string;
  kind: "transcription" | "caption";
}) => {
  const editor = useExcalidrawAPI();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<TranscriptSession | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const tabRef = useRef<{ id: string; stream: MediaStream } | null>(null);
  const mixStopRef = useRef<(() => void) | null>(null);
  const startedAtRef = useRef(0);
  const isCaption = kind === "caption";
  const placeholder = isCaption
    ? CAPTION_PLACEHOLDER
    : TRANSCRIPTION_PLACEHOLDER;
  const writeConfig = isCaption ? writeCaptionConfig : writeTranscriptionConfig;
  const formatText = useCallback(
    (nextTurns: ChatTurn[], nextNames: Record<number, string>) =>
      isCaption
        ? formatLiveCaption(nextTurns, nextNames, { clock: false })
        : formatVideoTranscript(nextTurns, nextNames),
    [isCaption],
  );
  const [sources, setSources] = useState<AudioSourceOption[]>(() =>
    listAudioSources(null),
  );
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [sourceId, setSourceId] = useState(DEFAULT_TRANSCRIPTION.sourceId);
  const [textElementId, setTextElementId] = useState(
    DEFAULT_TRANSCRIPTION.textElementId,
  );
  const [listening, setListening] = useState(false);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [names, setNames] = useState<Record<number, string>>({});
  const [status, setStatus] = useState("Pick a source, then Start.");

  const applyConfig = useCallback(
    (next: TranscriptionConfig) => {
      setSourceId(next.sourceId);
      setTextElementId(next.textElementId);
      if (!editor) {
        return;
      }
      persistConfig(editor, elementId, next, writeConfig);
    },
    [editor, elementId, writeConfig],
  );

  const ensureCaptionText = useCallback((): string | null => {
    if (!editor) {
      return null;
    }
    const elements = editor.getSceneElements();
    const existing = findCaptionText(elements, elementId, textElementId);
    if (existing) {
      if (existing.id !== textElementId) {
        applyConfig({ sourceId, textElementId: existing.id });
      }
      return existing.id;
    }
    const widget = elements.find((item) => item.id === elementId);
    const appState = editor.getAppState();
    const text = isCaption
      ? newCaptionOverlayElement({
          widgetId: elementId,
          x: widget?.x ?? 0,
          y: (widget?.y ?? 0) + (widget?.height ?? 0) + 28,
          fontSize: appState.currentItemFontSize,
          fontFamily: appState.currentItemFontFamily,
          strokeColor: appState.currentItemStrokeColor,
          opacity: appState.currentItemOpacity,
        })
      : newCaptionTextElement({
          widgetId: elementId,
          x: widget?.x ?? 0,
          y: (widget?.y ?? 0) + (widget?.height ?? 0) + 28,
          fontSize: appState.currentItemFontSize,
          fontFamily: appState.currentItemFontFamily,
          textAlign: appState.currentItemTextAlign,
          strokeColor: appState.currentItemStrokeColor,
          opacity: appState.currentItemOpacity,
        });
    editor.updateScene({
      elements: [...editor.getSceneElementsIncludingDeleted(), text],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    applyConfig({ sourceId, textElementId: text.id });
    return text.id;
  }, [applyConfig, editor, elementId, isCaption, sourceId, textElementId]);

  useEffect(() => {
    const element = editor
      ?.getSceneElementsIncludingDeleted()
      .find((item) => item.id === elementId);
    if (!element) {
      return;
    }
    const next = isCaption
      ? readCaptionConfig(element)
      : readTranscriptionConfig(element);
    setSourceId(next.sourceId);
    setTextElementId(next.textElementId);
  }, [editor, elementId, isCaption]);

  useEffect(() => {
    const ownerWindow = rootRef.current?.ownerDocument.defaultView ?? window;
    let cancelled = false;
    const load = async () => {
      let devices: MediaDeviceInfo[] = [];
      try {
        devices = await unlockJayrrMics(ownerWindow);
      } catch {
        devices = await listJayrrMics();
      }
      if (!cancelled) {
        setMics(devices);
      }
    };
    void load();
    const media = ownerWindow.navigator.mediaDevices;
    media?.addEventListener("devicechange", load);
    return () => {
      cancelled = true;
      media?.removeEventListener("devicechange", load);
    };
  }, []);

  useEffect(() => {
    const refresh = () => setSources(listAudioSources(editor, mics));
    refresh();
    const offStreams = subscribeJayrrStreams(refresh);
    const offChange = editor?.onChange(() => refresh());
    return () => {
      offStreams();
      offChange?.();
    };
  }, [editor, mics]);

  useEffect(() => {
    if (isMicSource(sourceId) || sourceId.startsWith(EMBED_PREFIX)) {
      return;
    }
    if (sources.some((source) => source.id === sourceId)) {
      return;
    }
    setSourceId(MIC_SOURCE);
  }, [sourceId, sources]);

  useEffect(() => {
    const stored = getPresentMic();
    if (!stored || stored === PRESENT_MIC_NONE) {
      return;
    }
    const id = micSourceId(stored);
    if (sourceId !== MIC_SOURCE) {
      return;
    }
    if (!sources.some((source) => source.id === id)) {
      return;
    }
    setSourceId(id);
  }, [mics, sourceId, sources]);

  useEffect(
    () => () => {
      sessionRef.current?.stop();
      sessionRef.current = null;
      const mic = micRef.current;
      micRef.current = null;
      if (mic) {
        for (const track of mic.getTracks()) {
          track.stop();
        }
      }
      const tab = tabRef.current;
      tabRef.current = null;
      if (tab) {
        releaseJayrrTabAudio(tab.id, tab.stream);
      }
      mixStopRef.current?.();
      mixStopRef.current = null;
      clearTranscript(elementId);
    },
    [elementId],
  );

  useEffect(() => {
    publishTranscript({
      sourceId: elementId,
      text: formatText(turns, names),
      listening,
      turns: turns.map((turn) => ({
        id: turn.id,
        speaker: turn.speaker,
        text: turn.text,
        isFinal: turn.isFinal,
      })),
      names,
    });
  }, [elementId, formatText, listening, names, turns]);

  useEffect(() => {
    if (!editor || !textElementId) {
      return;
    }
    if (turns.length === 0) {
      return;
    }
    writeCaptionText(editor, textElementId, formatText(turns, names));
  }, [editor, formatText, names, textElementId, turns]);

  const stopMic = () => {
    const mic = micRef.current;
    micRef.current = null;
    if (!mic) {
      return;
    }
    for (const track of mic.getTracks()) {
      track.stop();
    }
  };

  const stopTab = () => {
    const tab = tabRef.current;
    tabRef.current = null;
    if (!tab) {
      return;
    }
    releaseJayrrTabAudio(tab.id, tab.stream);
  };

  const stopMix = () => {
    mixStopRef.current?.();
    mixStopRef.current = null;
  };

  const stopSession = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    stopMic();
    stopTab();
    stopMix();
    setListening(false);
    setPaused(false);
  };

  const applyTurns = (next: TranscriptTurn[], isFinal: boolean) => {
    setNames((current) =>
      ensureSpeakerNames(
        current,
        next.map((turn) => turn.speaker),
      ),
    );
    setTurns((current) => {
      const origin = startedAtRef.current || Date.now();
      const kept = current.filter((turn) => turn.isFinal);
      const merged = [...kept];
      for (const turn of next) {
        const incoming: ChatTurn = {
          ...turn,
          startMs: turn.startMs ?? Date.now() - origin,
          id: nextTurnId(),
          isFinal,
        };
        const last = merged[merged.length - 1];
        const prev = last?.text.trim() ?? "";
        const body = incoming.text.trim();
        const sameSpeaker = last && last.speaker === incoming.speaker;
        const grows = sameSpeaker && body.startsWith(prev);
        const shrinks = sameSpeaker && prev.startsWith(body);
        if (last && (grows || shrinks)) {
          merged[merged.length - 1] = {
            ...last,
            text: grows ? incoming.text : last.text,
            isFinal: last.isFinal || incoming.isFinal,
          };
          continue;
        }
        merged.push(incoming);
      }
      return merged.slice(-40);
    });
    setStatus("");
  };

  const start = async () => {
    if (busy) {
      return;
    }
    if (listening && paused && sessionRef.current) {
      sessionRef.current.setPaused(false);
      setPaused(false);
      setStatus("");
      return;
    }
    stopSession();
    setNames({});
    setTurns([]);
    ensureCaptionText();
    setBusy(true);
    setStatus("Starting…");
    const ownerWindow = rootRef.current?.ownerDocument.defaultView ?? window;
    try {
      let stream: MediaStream | null = null;
      if (isMicSource(sourceId)) {
        const picked = micDeviceId(sourceId);
        const stored = presentMicDeviceId();
        if (!picked && stored === null) {
          setStatus("No microphone selected.");
          return;
        }
        stream = await openJayrrMic(ownerWindow, picked || stored || undefined);
        micRef.current = stream;
      } else if (sourceId.startsWith(EMBED_PREFIX)) {
        setStatus("Share this tab with audio…");
        const embedId = sourceId.slice(EMBED_PREFIX.length);
        stream = await acquireJayrrTabAudio(embedId);
        tabRef.current = { id: embedId, stream };
      } else {
        const display =
          listJayrrDisplayStreams().find((item) => item.id === sourceId)
            ?.stream ?? null;
        if (
          display &&
          !display.getAudioTracks().some((track) => track.enabled)
        ) {
          const mixed = await mixMicIntoStream(
            display,
            ownerWindow,
            true,
            presentMicDeviceId(),
          );
          mixStopRef.current = mixed.stop;
          stream = mixed.stream;
        } else {
          stream = display;
        }
      }
      if (!stream) {
        setStatus(
          sourceId.startsWith(EMBED_PREFIX)
            ? "Could not tap that video. Share this tab with audio."
            : "That source is no longer live. Start a Stream first.",
        );
        return;
      }
      startedAtRef.current = Date.now();
      const session = listenStreamTranscript(
        stream,
        applyTurns,
        (message) => {
          sessionRef.current?.stop();
          sessionRef.current = null;
          stopMic();
          stopTab();
          stopMix();
          setListening(false);
          setPaused(false);
          setStatus(message);
        },
        ownerWindow,
        undefined,
        setStatus,
      );
      sessionRef.current = session;
      setListening(true);
      setPaused(false);
      setStatus("");
    } catch (error: unknown) {
      stopMic();
      stopTab();
      stopMix();
      setStatus(
        error instanceof Error
          ? error.message
          : isCaption
          ? "Could not start captions."
          : "Could not start transcription.",
      );
    } finally {
      setBusy(false);
    }
  };

  const pause = () => {
    sessionRef.current?.setPaused(true);
    setPaused(true);
    setStatus("");
  };

  const clearChat = () => {
    setTurns([]);
    setNames({});
    if (editor && textElementId) {
      writeCaptionText(editor, textElementId, placeholder);
    }
    setStatus(listening ? "" : "Pick a source, then Start.");
  };

  const selectCaption = () => {
    const captionId = ensureCaptionText();
    if (!editor || !captionId) {
      return;
    }
    editor.updateScene({
      appState: {
        selectedElementIds: { [captionId]: true },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    });
  };

  const selected = sources.find((source) => source.id === sourceId);
  const startLabel = listening && !paused ? "Pause" : "Start";
  const hint =
    selected && !selected.hasAudio
      ? "Allow the microphone. Window share has no system audio on its own."
      : status;

  useRegisterWidgetToolbar(
    elementId,
    () => (
      <LiveWidgetToolbar
        listening={listening}
        paused={paused}
        busy={busy}
        startLabel={startLabel}
        sourceId={sourceId}
        sources={sources}
        clearDisabled={turns.length === 0}
        onClear={clearChat}
        onSelectText={selectCaption}
        onStart={() => {
          if (listening && !paused) {
            pause();
            return;
          }
          void start();
        }}
        onSourceChange={(nextId) => {
          applyConfig({ sourceId: nextId, textElementId });
          if (isMicSource(nextId)) {
            setPresentMic(micDeviceId(nextId) || PRESENT_MIC_DEFAULT);
          }
          if (listening) {
            stopSession();
            setStatus("Pick a source, then Start.");
          }
        }}
      />
    ),
    [
      listening,
      paused,
      busy,
      startLabel,
      sourceId,
      sources,
      turns.length,
      textElementId,
    ],
  );

  return (
    <div
      ref={rootRef}
      className={
        isCaption
          ? "jayrr-called-embed jayrr-called-embed--transcription jayrr-called-embed--caption"
          : "jayrr-called-embed jayrr-called-embed--transcription"
      }
    >
      {hint ? <div className="jayrr-called-embed__hint">{hint}</div> : null}
    </div>
  );
};

export const TranscriptionWidget = ({ elementId }: { elementId: string }) => (
  <SpeechCanvasWidget elementId={elementId} kind="transcription" />
);
