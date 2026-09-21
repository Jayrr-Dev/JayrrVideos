import { appJotaiStore } from "../../app-jotai";
import { api, convexClient } from "../../convexClient";
import {
  isSttProvider,
  sttProviderAtom,
  type SttProvider,
} from "../flags/sttProviderFlag";

import { debugTranscribe } from "./debugTranscribe";
import { turnsFromTranscript } from "./transcriptTurns";

import type { TranscriptTurn } from "./transcriptTurns";

const STREAM_MODEL = "inworld/inworld-stt-1";
const STREAM_SAMPLE_RATE = 16000;
const PENDING_MAX_CHUNKS = 10;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
const RECONNECT_GIVE_UP = 8;
const WATCHDOG_SILENT_MS = 30000;
const WATCHDOG_LOUD_PEAK = 0.02;
const WATCHDOG_LOUD_RECENT_MS = 5000;

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
    AudioWorkletNode?: typeof AudioWorkletNode;
  };

type StreamMessage = {
  type?: unknown;
  event?: unknown;
  transcript?: unknown;
  words?: unknown;
  description?: unknown;
  message?: unknown;
  is_final?: unknown;
  speech_final?: unknown;
  channel?: {
    alternatives?: Array<{
      transcript?: unknown;
      words?: unknown;
    }>;
  };
  error?: { message?: unknown };
  transcription?: {
    transcript?: unknown;
    isFinal?: unknown;
    wordTimestamps?: unknown;
  };
  result?: {
    transcription?: {
      transcript?: unknown;
      isFinal?: unknown;
      wordTimestamps?: unknown;
    };
  };
};

const pcm16FromFloat = (samples: Float32Array): ArrayBuffer => {
  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  const view = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const audio = new ArrayBuffer(view.byteLength);
  new Uint8Array(audio).set(view);
  return audio;
};

const bytesToBase64 = (bytes: ArrayBuffer, view: Window) => {
  const data = new Uint8Array(bytes);
  const chunks: string[] = [];
  const size = 0x8000;
  for (let offset = 0; offset < data.length; offset += size) {
    chunks.push(String.fromCharCode(...data.subarray(offset, offset + size)));
  }
  return view.btoa(chunks.join(""));
};

const readWordStamps = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is { word?: unknown; speaker?: unknown } =>
      Boolean(item) && typeof item === "object",
  );
};

const streamUrl = (ownerView: Window) => {
  const loc = ownerView.location;
  const protocol = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${loc.host}/stt-stream`;
};

const asText = async (data: unknown): Promise<string | null> => {
  if (typeof data === "string") {
    return data;
  }
  if (data instanceof Blob) {
    return data.text();
  }
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    );
  }
  return null;
};

export type TranscriptDebug = {
  stage: string;
  detail: string;
};

export type TranscriptSession = {
  setPaused: (paused: boolean) => void;
  stop: () => void;
};

const SILENT_HINT_MS = 4000;

const relaxCaptureAudio = (tracks: MediaStreamTrack[]) => {
  for (const track of tracks) {
    void track
      .applyConstraints({
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      })
      .catch(() => undefined);
  }
};

const holdStreamPlayback = (stream: MediaStream, view: AudioWindow) => {
  const el = view.document.createElement("audio");
  el.srcObject = stream;
  el.muted = true;
  el.volume = 0;
  el.autoplay = true;
  el.setAttribute("playsinline", "true");
  el.style.position = "fixed";
  el.style.left = "-9999px";
  el.style.width = "1px";
  el.style.height = "1px";
  view.document.documentElement.appendChild(el);
  void el.play().catch(() => undefined);
  return () => {
    el.pause();
    el.srcObject = null;
    el.remove();
  };
};

const trackSummary = (tracks: MediaStreamTrack[]) => {
  if (tracks.length === 0) {
    return "none";
  }
  return tracks
    .map((track) => {
      const muted = track.muted ? "muted" : "live";
      return `${track.label || "audio"} ${track.readyState} ${muted}`;
    })
    .join("; ");
};

const samplePeak = (samples: Float32Array) => {
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.abs(samples[index] ?? 0);
    if (value > peak) {
      peak = value;
    }
  }
  return peak;
};

const isFatalTokenError = (message: string) =>
  /not authenticated|INWORLD_API_KEY|DEEPGRAM_API_KEY|rejected this API key/i.test(
    message,
  );

const readSttProvider = (): SttProvider => {
  const value = appJotaiStore.get(sttProviderAtom);
  if (isSttProvider(value)) {
    return value;
  }
  return "inworld";
};

const novaAlternative = (payload: StreamMessage) => {
  const alternatives = payload.channel?.alternatives;
  if (!Array.isArray(alternatives) || alternatives.length === 0) {
    return null;
  }
  return alternatives[0] ?? null;
};

const payloadKeys = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return typeof payload;
  }
  return Object.keys(payload).join(",") || "(empty object)";
};

export const listenStreamTranscript = (
  stream: MediaStream,
  onTurns: (turns: TranscriptTurn[], isFinal: boolean) => void,
  onError: (message: string) => void,
  ownerWindow?: Window | null,
  onDebug?: (event: TranscriptDebug) => void,
  onStatus?: (message: string) => void,
): TranscriptSession => {
  const debug = (stage: string, detail: string) => {
    debugTranscribe(stage, detail);
    if (!onDebug) {
      return;
    }
    onDebug({ stage, detail });
  };

  const audioTracks = stream.getAudioTracks().filter((track) => track.enabled);
  if (audioTracks.length === 0) {
    debug("source", trackSummary(stream.getAudioTracks()));
    onError("This source has no audio. Allow the mic or share tab audio.");
    return {
      setPaused: () => undefined,
      stop: () => undefined,
    };
  }
  const client = convexClient;
  if (!client) {
    debug("token", "no Convex client");
    onError("Transcription needs Convex.");
    return {
      setPaused: () => undefined,
      stop: () => undefined,
    };
  }

  const view = (ownerWindow ?? window) as AudioWindow;
  const Context = view.AudioContext ?? view.webkitAudioContext;
  if (!Context) {
    debug("audio", "no AudioContext");
    onError("This browser cannot capture live audio.");
    return {
      setPaused: () => undefined,
      stop: () => undefined,
    };
  }

  debug("source", trackSummary(audioTracks));
  relaxCaptureAudio(audioTracks);

  const audioStream = new MediaStream(audioTracks);
  const context = new Context({ sampleRate: STREAM_SAMPLE_RATE });
  const source = context.createMediaStreamSource(audioStream);
  const silent = context.createGain();
  silent.gain.value = 0;
  silent.connect(context.destination);
  const releasePlayback = holdStreamPlayback(audioStream, view);

  let stopped = false;
  let paused = false;
  let reported = false;
  let silentHinted = false;
  let socket: WebSocket | null = null;
  let capture: AudioNode | null = null;
  let chunksSent = 0;
  let lastPeakAt = 0;
  let lastPeak = 0;
  let lastLoudAt = 0;
  let lastMessageAt = 0;
  const startedAt = view.performance.now();
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const pending: ArrayBuffer[] = [];
  const speakerIds = new Map<number, number>();
  let provider: SttProvider = readSttProvider();

  const mapSpeaker = (speaker: number | null) => {
    if (speaker === null) {
      return null;
    }
    const existing = speakerIds.get(speaker);
    if (existing !== undefined) {
      return existing;
    }
    const next = speakerIds.size + 1;
    speakerIds.set(speaker, next);
    return next;
  };

  const report = (message: string) => {
    if (stopped || reported) {
      return;
    }
    reported = true;
    onError(message);
  };

  const sendJson = (payload: unknown) => {
    if (!socket || socket.readyState !== view.WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify(payload));
  };

  const enqueuePcm = (samples: Float32Array) => {
    if (stopped || paused) {
      return;
    }
    const peak = samplePeak(samples);
    lastPeak = Math.max(lastPeak, peak);
    const now = view.performance.now();
    if (peak > WATCHDOG_LOUD_PEAK) {
      lastLoudAt = now;
    }
    if (now - lastPeakAt > 1000) {
      lastPeakAt = now;
      const socketState = socket ? socket.readyState : -1;
      debug(
        "audio",
        `peak ${lastPeak.toFixed(3)} chunks ${chunksSent} pending ${
          pending.length
        } ctx ${context.state} ws ${socketState}`,
      );
      if (
        !silentHinted &&
        lastLoudAt === 0 &&
        now - startedAt > SILENT_HINT_MS
      ) {
        silentHinted = true;
        onStatus?.(
          "No sound yet. Share this tab, turn Share audio on, and keep the video unmuted.",
        );
      }
      lastPeak = 0;
      checkWatchdog(now);
    }
    const pcm = pcm16FromFloat(samples);
    if (!socket || socket.readyState !== view.WebSocket.OPEN) {
      pending.push(pcm);
      if (pending.length > PENDING_MAX_CHUNKS) {
        pending.shift();
      }
      return;
    }
    chunksSent += 1;
    sendPcm(pcm);
  };

  const sendPcm = (pcm: ArrayBuffer) => {
    if (!socket || socket.readyState !== view.WebSocket.OPEN) {
      return;
    }
    if (provider === "deepgram") {
      socket.send(pcm);
      return;
    }
    sendJson({ audioChunk: { content: bytesToBase64(pcm, view) } });
  };

  const flushPending = () => {
    if (!socket || socket.readyState !== view.WebSocket.OPEN) {
      return;
    }
    while (pending.length > 0) {
      const chunk = pending.shift();
      if (!chunk) {
        continue;
      }
      sendPcm(chunk);
    }
  };

  // Audio is clearly flowing but the stream has gone quiet: force a reconnect.
  const checkWatchdog = (now: number) => {
    if (!socket || socket.readyState !== view.WebSocket.OPEN) {
      return;
    }
    const quietFor = now - lastMessageAt;
    const heardRecently = now - lastLoudAt < WATCHDOG_LOUD_RECENT_MS;
    if (
      lastMessageAt === 0 ||
      quietFor < WATCHDOG_SILENT_MS ||
      !heardRecently
    ) {
      return;
    }
    debug("watchdog", `no results for ${Math.round(quietFor / 1000)}s`);
    socket.close();
  };

  const handleMessage = (raw: string) => {
    let payload: StreamMessage;
    try {
      payload = JSON.parse(raw) as StreamMessage;
    } catch {
      debug("stt", `non-json ${raw.slice(0, 80)}`);
      return;
    }
    lastMessageAt = view.performance.now();
    reconnectAttempts = 0;
    debug("stt", payloadKeys(payload));
    if (payload.error || payload.type === "FatalError") {
      const message =
        typeof payload.error?.message === "string"
          ? payload.error.message
          : typeof payload.description === "string"
          ? payload.description
          : typeof payload.message === "string"
          ? payload.message
          : "Transcription failed.";
      debug("stt", `error ${message}`);
      report(message);
      return;
    }
    if (
      payload.type === "Connected" ||
      payload.type === "ConfigureSuccess" ||
      payload.type === "Metadata" ||
      payload.type === "UtteranceEnd" ||
      payload.type === "SpeechStarted"
    ) {
      return;
    }
    if (payload.type === "Results") {
      const alternative = novaAlternative(payload);
      if (!alternative) {
        debug("stt", "no nova alternative");
        return;
      }
      const transcript =
        typeof alternative.transcript === "string"
          ? alternative.transcript
          : "";
      const turns = turnsFromTranscript(
        transcript,
        readWordStamps(alternative.words),
      ).map((turn) => ({
        ...turn,
        speaker: mapSpeaker(turn.speaker),
      }));
      if (turns.length === 0) {
        debug("stt", "empty transcript");
        return;
      }
      const isFinal = payload.is_final === true;
      debug("turns", `${turns.length} ${isFinal ? "final" : "draft"}`);
      onTurns(turns, isFinal);
      return;
    }
    const transcription =
      payload.result?.transcription ?? payload.transcription;
    if (!transcription) {
      debug("stt", "no result.transcription");
      return;
    }
    const transcript =
      typeof transcription.transcript === "string"
        ? transcription.transcript
        : "";
    const turns = turnsFromTranscript(
      transcript,
      readWordStamps(transcription.wordTimestamps),
    ).map((turn) => ({
      ...turn,
      speaker: mapSpeaker(turn.speaker),
    }));
    if (turns.length === 0) {
      debug("stt", "empty transcript");
      return;
    }
    debug(
      "turns",
      `${turns.length} ${transcription.isFinal === true ? "final" : "draft"}`,
    );
    onTurns(turns, transcription.isFinal === true);
  };

  const closeAudio = () => {
    capture?.disconnect();
    source.disconnect();
    silent.disconnect();
    releasePlayback();
    void context.close();
  };

  const attachScriptProcessor = () => {
    debug("capture", "script-processor");
    const processor = context.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => {
      enqueuePcm(event.inputBuffer.getChannelData(0));
    };
    source.connect(processor);
    processor.connect(silent);
    capture = processor;
  };

  const attachCapture = async () => {
    const WorkletNode = view.AudioWorkletNode;
    if (!context.audioWorklet || !WorkletNode) {
      attachScriptProcessor();
      return;
    }
    try {
      await context.audioWorklet.addModule(
        new URL("./pcmCaptureWorklet.js", import.meta.url),
      );
      if (stopped) {
        return;
      }
      const node = new WorkletNode(context, "pcm-capture");
      node.port.onmessage = (event) => {
        if (event.data instanceof Float32Array) {
          enqueuePcm(event.data);
        }
      };
      source.connect(node);
      node.connect(silent);
      capture = node;
      debug("capture", `worklet ${Math.round(context.sampleRate)}Hz`);
    } catch (error: unknown) {
      debug(
        "capture",
        error instanceof Error ? error.message : "worklet failed",
      );
      attachScriptProcessor();
    }
  };

  void context.resume().then(() => {
    debug(
      "audio",
      `context ${context.state} ${Math.round(context.sampleRate)}Hz`,
    );
  });
  void attachCapture();

  // The audio graph stays alive across reconnects; only the socket is rebuilt.
  const scheduleReconnect = (reason: string) => {
    if (stopped || reconnectTimer) {
      return;
    }
    reconnectAttempts += 1;
    if (reconnectAttempts > RECONNECT_GIVE_UP) {
      report(`Transcription kept failing: ${reason}`);
      return;
    }
    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * 2 ** (reconnectAttempts - 1),
    );
    debug(
      "socket",
      `reconnect ${reconnectAttempts}/${RECONNECT_GIVE_UP} in ${delay}ms (${reason})`,
    );
    onStatus?.(`Reconnecting… (${reason})`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const connect = () => {
    if (stopped) {
      return;
    }
    debug("token", "minting");
    provider = readSttProvider();
    void client
      .action(api.transcription.mintStreamToken, { provider })
      .then(({ accessToken, provider: minted }) => {
        if (stopped) {
          return;
        }
        provider = minted;
        debug("token", `ok ${minted} ${accessToken.length} chars`);
        const url = streamUrl(view);
        debug("socket", url);
        const next = new view.WebSocket(url);
        socket = next;
        next.onopen = () => {
          if (stopped) {
            next.close();
            return;
          }
          debug("socket", "open");
          onStatus?.("Listening…");
          const sampleRateHertz =
            Math.round(context.sampleRate) || STREAM_SAMPLE_RATE;
          sendJson({
            accessToken,
            provider: minted,
            sampleRateHertz,
          });
          if (minted === "inworld") {
            sendJson({
              transcribeConfig: {
                modelId: STREAM_MODEL,
                audioEncoding: "LINEAR16",
                language: "en",
                sampleRateHertz,
                numberOfChannels: 1,
                includeWordTimestamps: true,
                enableSpeakerDiarization: true,
              },
            });
          }
          view.setTimeout(() => {
            if (stopped || socket !== next) {
              return;
            }
            flushPending();
          }, 40);
        };
        next.onmessage = (event) => {
          void asText(event.data).then((raw) => {
            if (stopped || !raw) {
              return;
            }
            handleMessage(raw);
          });
        };
        next.onerror = () => {
          debug("socket", "error");
        };
        next.onclose = (event) => {
          if (socket === next) {
            socket = null;
          }
          const why =
            event.reason ||
            (event.wasClean ? "stream ended" : "connection lost");
          debug("socket", `close ${event.code} ${why}`);
          if (event.code === 4001) {
            report("Transcription stream rejected the session token.");
            return;
          }
          scheduleReconnect(why);
        };
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : "Could not start transcription.";
        if (isFatalTokenError(message)) {
          report(message);
          return;
        }
        scheduleReconnect(message);
      });
  };

  connect();

  return {
    setPaused: (next) => {
      paused = next;
    },
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      pending.length = 0;
      if (provider === "deepgram") {
        sendJson({ type: "CloseStream" });
      } else {
        sendJson({ closeStream: {} });
      }
      socket?.close();
      socket = null;
      closeAudio();
    },
  };
};
