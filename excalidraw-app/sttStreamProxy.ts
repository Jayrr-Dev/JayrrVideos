import { WebSocket, WebSocketServer } from "ws";

import type { RawData } from "ws";

import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { Plugin } from "vite";

const INWORLD_UPSTREAM =
  "wss://api.inworld.ai/stt/v1/transcribe:streamBidirectional";
const DEEPGRAM_LISTEN = "wss://api.deepgram.com/v1/listen";

type SttProvider = "inworld" | "deepgram";

type AuthFrame = {
  accessToken: string;
  provider: SttProvider;
  sampleRateHertz: number;
};

type UpgradeTarget = {
  prependListener(
    event: "upgrade",
    listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void,
  ): void;
};

const listenSampleRate = (value: unknown) => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 8000) {
    return 16000;
  }
  return Math.round(n);
};

const readAuthFrame = (raw: Buffer | string): AuthFrame | null => {
  try {
    const parsed: unknown = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (
      !("accessToken" in parsed) ||
      typeof parsed.accessToken !== "string" ||
      !parsed.accessToken
    ) {
      return null;
    }
    const provider =
      "provider" in parsed && parsed.provider === "deepgram"
        ? "deepgram"
        : "inworld";
    const sampleRateHertz =
      "sampleRateHertz" in parsed
        ? listenSampleRate(parsed.sampleRateHertz)
        : 16000;
    return {
      accessToken: parsed.accessToken,
      provider,
      sampleRateHertz,
    };
  } catch {
    return null;
  }
};

const deepgramUrl = (sampleRateHertz: number) => {
  const params = new URLSearchParams({
    model: "nova-3",
    encoding: "linear16",
    sample_rate: String(sampleRateHertz),
    channels: "1",
    language: "en",
    diarize: "true",
    punctuate: "true",
    smart_format: "true",
    interim_results: "true",
    endpointing: "300",
  });
  return `${DEEPGRAM_LISTEN}?${params.toString()}`;
};

const deepgramAuth = (token: string) => {
  if (token.includes(".")) {
    return `Bearer ${token}`;
  }
  return `Token ${token}`;
};

const toFrame = (data: RawData): Buffer | string => {
  if (typeof data === "string") {
    return data;
  }
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data);
  }
  return Buffer.from(data);
};

const asJsonObject = (frame: Buffer | string) => {
  const text = typeof frame === "string" ? frame : frame.toString("utf8");
  if (!text.startsWith("{") && !text.startsWith("[")) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const deepgramPayload = (data: RawData): Buffer | string | null => {
  const frame = toFrame(data);
  const json = asJsonObject(frame);
  if (!json) {
    return frame;
  }
  if (json.transcribeConfig) {
    return null;
  }
  if (json.closeStream || json.type === "CloseStream") {
    return JSON.stringify({ type: "CloseStream" });
  }
  const chunk = json.audioChunk;
  if (chunk && typeof chunk === "object" && "content" in chunk) {
    const content = chunk.content;
    if (typeof content === "string" && content) {
      return Buffer.from(content, "base64");
    }
  }
  return frame;
};

const sttLog = (stage: string, detail: string) => {
  console.info(`[Jayrr STT] ${stage}: ${detail}`);
};

const pipeClient = (client: WebSocket) => {
  let upstream: WebSocket | null = null;
  const buffered: Array<Buffer | string> = [];
  let audioFrames = 0;
  let provider: SttProvider = "inworld";

  const closeBoth = () => {
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
    upstream?.close();
  };

  const openUpstream = (auth: AuthFrame) => {
    provider = auth.provider;
    const url =
      provider === "deepgram"
        ? deepgramUrl(auth.sampleRateHertz)
        : INWORLD_UPSTREAM;
    const headers =
      provider === "deepgram"
        ? { Authorization: deepgramAuth(auth.accessToken) }
        : { Authorization: `Bearer ${auth.accessToken}` };
    sttLog("auth", `${provider} token ${auth.accessToken.length} chars`);
    upstream = new WebSocket(url, { headers });
    upstream.on("open", () => {
      sttLog("upstream", `open ${provider}`);
      for (const frame of buffered) {
        upstream?.send(frame);
      }
      buffered.length = 0;
    });
    upstream.on("message", (message: RawData, isBinary: boolean) => {
      const frame = toFrame(message);
      let payload: string | Buffer = frame;
      let binary = isBinary;
      if (isBinary && Buffer.isBuffer(frame)) {
        const decoded = frame.toString("utf8");
        if (decoded.startsWith("{") || decoded.startsWith("[")) {
          payload = decoded;
          binary = false;
        }
      }
      const preview =
        typeof payload === "string"
          ? payload.slice(0, 200)
          : `(${payload.length} bytes)`;
      sttLog("upstream", `message ${preview}`);
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload, { binary });
      }
    });
    upstream.on("close", (code, reason) => {
      sttLog("upstream", `close ${code} ${String(reason)}`);
      closeBoth();
    });
    upstream.on("error", (error) => {
      sttLog("upstream", error instanceof Error ? error.message : "error");
      closeBoth();
    });
  };

  client.on("message", (data: RawData) => {
    if (!upstream) {
      const auth = readAuthFrame(toFrame(data));
      if (!auth) {
        sttLog("auth", "missing access token");
        client.close(4001, "authentication is required");
        return;
      }
      openUpstream(auth);
      return;
    }
    const outbound =
      provider === "deepgram" ? deepgramPayload(data) : toFrame(data);
    if (outbound === null) {
      return;
    }
    audioFrames += 1;
    if (audioFrames === 1 || audioFrames % 50 === 0) {
      sttLog(
        "client",
        `audio frames ${audioFrames} upstream ${upstream.readyState}`,
      );
    }
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(outbound);
      return;
    }
    buffered.push(outbound);
  });
  client.on("close", () => {
    sttLog("client", "close");
    closeBoth();
  });
  client.on("error", () => {
    sttLog("client", "error");
    closeBoth();
  });
};

const attachSttUpgrade = (httpServer: UpgradeTarget) => {
  const wss = new WebSocketServer({ noServer: true });
  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const path = req.url?.split("?")[0];
    if (path !== "/stt-stream") {
      return;
    }
    wss.handleUpgrade(req, socket, head, (client: WebSocket) => {
      sttLog("upgrade", path);
      pipeClient(client);
    });
  };
  httpServer.prependListener("upgrade", onUpgrade);
};

export const sttStreamProxy = (): Plugin => ({
  name: "stt-stream-proxy",
  configureServer(server) {
    return () => {
      if (server.httpServer) {
        attachSttUpgrade(server.httpServer);
      }
    };
  },
  configurePreviewServer(server) {
    return () => {
      if (server.httpServer) {
        attachSttUpgrade(server.httpServer);
      }
    };
  },
});
