import { WebSocket, WebSocketServer } from "ws";

import type { RawData } from "ws";

import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { Plugin } from "vite";

const UPSTREAM = "wss://api.inworld.ai/stt/v1/transcribe:streamBidirectional";

type UpgradeTarget = {
  prependListener(
    event: "upgrade",
    listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void,
  ): void;
};

const readAccessToken = (raw: Buffer | string) => {
  try {
    const parsed: unknown = JSON.parse(String(raw));
    if (
      parsed &&
      typeof parsed === "object" &&
      "accessToken" in parsed &&
      typeof parsed.accessToken === "string" &&
      parsed.accessToken
    ) {
      return parsed.accessToken;
    }
  } catch {
    // not the auth frame
  }
  return "";
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

const sttLog = (stage: string, detail: string) => {
  console.info(`[Jayrr STT] ${stage}: ${detail}`);
};

const pipeClient = (client: WebSocket) => {
  let upstream: WebSocket | null = null;
  const buffered: Array<Buffer | string> = [];
  let audioFrames = 0;

  const closeBoth = () => {
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
    upstream?.close();
  };

  client.on("message", (data: RawData) => {
    if (!upstream) {
      const token = readAccessToken(String(data));
      if (!token) {
        sttLog("auth", "missing access token");
        client.close(4001, "authentication is required");
        return;
      }
      sttLog("auth", `token ${token.length} chars`);
      upstream = new WebSocket(UPSTREAM, {
        headers: { Authorization: `Bearer ${token}` },
      });
      upstream.on("open", () => {
        sttLog("upstream", "open");
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
      upstream.send(data);
      return;
    }
    buffered.push(toFrame(data));
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
