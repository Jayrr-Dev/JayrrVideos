"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { action } from "./_generated/server";

const inworldAuth = (apiKey: string) => {
  const trimmed = apiKey.trim();
  if (trimmed.toLowerCase().startsWith("basic ")) {
    return trimmed;
  }
  return `Basic ${trimmed}`;
};

const wavFromPcm16 = (pcm: Buffer, sampleRate: number) => {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.byteLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.byteLength, 40);
  return Buffer.concat([header, pcm]);
};

const readAccessToken = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const record = payload as {
    accessToken?: unknown;
    access_token?: unknown;
  };
  if (typeof record.accessToken === "string" && record.accessToken) {
    return record.accessToken;
  }
  if (typeof record.access_token === "string" && record.access_token) {
    return record.access_token;
  }
  return "";
};

const inworldMessage = (detail: string) => {
  try {
    const parsed: unknown = JSON.parse(detail);
    if (
      parsed &&
      typeof parsed === "object" &&
      "message" in parsed &&
      typeof parsed.message === "string" &&
      parsed.message
    ) {
      return parsed.message;
    }
  } catch {
    // keep the raw body
  }
  return detail.slice(0, 180);
};

export const mintStreamToken = action({
  args: {},
  returns: v.object({
    accessToken: v.string(),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const apiKey = process.env.INWORLD_API_KEY?.trim() ?? "";
    if (!apiKey) {
      throw new Error("INWORLD_API_KEY is not set on Convex.");
    }
    const response = await fetch("https://api.inworld.ai/auth/v1/tokens", {
      method: "POST",
      headers: {
        Authorization: inworldAuth(apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        single_use: true,
        ttl: "300s",
      }),
    });
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Inworld rejected this API key.");
      }
      const detail = await response.text();
      throw new Error(
        inworldMessage(detail) ||
          `Inworld token mint failed (${response.status})`,
      );
    }
    const payload: unknown = await response.json();
    const accessToken = readAccessToken(payload);
    if (!accessToken) {
      throw new Error("Inworld did not return a stream token.");
    }
    return { accessToken };
  },
});

export const transcribeChunk = action({
  args: {
    audio: v.bytes(),
    sampleRateHertz: v.number(),
  },
  returns: v.object({
    text: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const apiKey = process.env.INWORLD_API_KEY?.trim() ?? "";
    if (!apiKey) {
      throw new Error("INWORLD_API_KEY is not set on Convex.");
    }
    if (args.audio.byteLength < 100) {
      return { text: "" };
    }

    const wav = wavFromPcm16(
      Buffer.from(args.audio),
      Math.round(args.sampleRateHertz),
    );
    const response = await fetch("https://api.inworld.ai/stt/v1/transcribe", {
      method: "POST",
      headers: {
        Authorization: inworldAuth(apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transcribeConfig: {
          modelId: "inworld/inworld-stt-1",
          audioEncoding: "AUTO_DETECT",
          language: "en",
        },
        audioData: { content: wav.toString("base64") },
      }),
    });
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Inworld rejected this API key.");
      }
      const detail = await response.text();
      throw new Error(
        inworldMessage(detail) ||
          `Inworld transcription failed (${response.status})`,
      );
    }
    const payload: unknown = await response.json();
    if (
      !payload ||
      typeof payload !== "object" ||
      !("transcription" in payload)
    ) {
      return { text: "" };
    }
    const transcription = (
      payload as { transcription?: { transcript?: unknown } }
    ).transcription;
    if (!transcription || typeof transcription.transcript !== "string") {
      return { text: "" };
    }
    return { text: transcription.transcript.trim() };
  },
});
