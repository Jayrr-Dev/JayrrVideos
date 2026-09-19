import { api, convexClient } from "../../convexClient";

import { turnsFromTranscript } from "./transcriptTurns";

import type { TranscriptTurn } from "./transcriptTurns";

const STREAM_URL = "wss://api.inworld.ai/stt/v1/transcribe:streamBidirectional";
const STREAM_MODEL = "assemblyai/universal-streaming-english";

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

type StreamMessage = {
  error?: { message?: unknown };
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

export type TranscriptSession = {
  setPaused: (paused: boolean) => void;
  stop: () => void;
};

export const listenStreamTranscript = (
  stream: MediaStream,
  onTurns: (turns: TranscriptTurn[], isFinal: boolean) => void,
  onError: (message: string) => void,
  ownerWindow?: Window | null,
): TranscriptSession => {
  const audioTracks = stream.getAudioTracks().filter((track) => track.enabled);
  if (audioTracks.length === 0) {
    onError("This source has no audio. Share tab or system audio.");
    return {
      setPaused: () => undefined,
      stop: () => undefined,
    };
  }
  const client = convexClient;
  if (!client) {
    onError("Transcription needs Convex.");
    return {
      setPaused: () => undefined,
      stop: () => undefined,
    };
  }

  const view = (ownerWindow ?? window) as AudioWindow;
  const Context = view.AudioContext ?? view.webkitAudioContext;
  if (!Context) {
    onError("This browser cannot capture live audio.");
    return {
      setPaused: () => undefined,
      stop: () => undefined,
    };
  }

  const audioStream = new MediaStream(audioTracks);
  const context = new Context();
  const source = context.createMediaStreamSource(audioStream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const silent = context.createGain();
  silent.gain.value = 0;
  source.connect(processor);
  processor.connect(silent);
  silent.connect(context.destination);

  let stopped = false;
  let paused = false;
  let reported = false;
  let socket: WebSocket | null = null;
  const pending: ArrayBuffer[] = [];
  const speakerIds = new Map<number, number>();

  const mapSpeaker = (speaker: number | null) => {
    if (speaker === null) {
      return null;
    }
    const existing = speakerIds.get(speaker);
    if (existing) {
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

  const flushPending = () => {
    if (!socket || socket.readyState !== view.WebSocket.OPEN) {
      return;
    }
    while (pending.length > 0) {
      const chunk = pending.shift();
      if (!chunk) {
        continue;
      }
      sendJson({ audioChunk: { content: bytesToBase64(chunk, view) } });
    }
  };

  const handleMessage = (raw: string) => {
    let payload: StreamMessage;
    try {
      payload = JSON.parse(raw) as StreamMessage;
    } catch {
      return;
    }
    if (payload.error) {
      const message =
        typeof payload.error.message === "string"
          ? payload.error.message
          : "Transcription failed.";
      report(message);
      return;
    }
    const transcription = payload.result?.transcription;
    if (!transcription) {
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
      return;
    }
    onTurns(turns, transcription.isFinal === true);
  };

  const closeAudio = () => {
    processor.disconnect();
    source.disconnect();
    silent.disconnect();
    void context.close();
  };

  processor.onaudioprocess = (event) => {
    if (stopped || paused) {
      return;
    }
    const pcm = pcm16FromFloat(event.inputBuffer.getChannelData(0));
    if (!socket || socket.readyState !== view.WebSocket.OPEN) {
      pending.push(pcm);
      if (pending.length > 24) {
        pending.shift();
      }
      return;
    }
    sendJson({ audioChunk: { content: bytesToBase64(pcm, view) } });
  };

  void context.resume();

  void client
    .action(api.transcription.mintStreamToken, {})
    .then(({ accessToken }) => {
      if (stopped) {
        return;
      }
      const next = new view.WebSocket(STREAM_URL, [`bearer_${accessToken}`]);
      socket = next;
      next.onopen = () => {
        if (stopped) {
          next.close();
          return;
        }
        sendJson({
          transcribeConfig: {
            modelId: STREAM_MODEL,
            audioEncoding: "LINEAR16",
            language: "en",
            sampleRateHertz: Math.round(context.sampleRate),
            numberOfChannels: 1,
            inactivityTimeoutSeconds: 3600,
            includeWordTimestamps: true,
            enableSpeakerDiarization: true,
          },
        });
        flushPending();
      };
      next.onmessage = (event) => {
        if (stopped || typeof event.data !== "string") {
          return;
        }
        handleMessage(event.data);
      };
      next.onerror = () => {
        report("Transcription stream failed.");
      };
      next.onclose = () => {
        report("Transcription stream closed.");
      };
    })
    .catch((error: unknown) => {
      report(
        error instanceof Error
          ? error.message
          : "Could not start transcription.",
      );
    });

  return {
    setPaused: (next) => {
      paused = next;
    },
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      pending.length = 0;
      sendJson({ closeStream: {} });
      socket?.close();
      socket = null;
      closeAudio();
    },
  };
};
