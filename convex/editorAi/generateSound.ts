"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { put } from "@vercel/blob";
import { v } from "convex/values";

import { action } from "../_generated/server";

import type { Id } from "../_generated/dataModel";

const OPENROUTER_CHAT = "https://openrouter.ai/api/v1/chat/completions";
const MAX_PROMPT = 2_000;
const DEFAULT_MODEL = "google/lyria-3-clip-preview";

const SOUND_MODELS = [
  {
    id: "google/lyria-3-clip-preview",
    name: "Lyria 3 Clip (30s)",
    durationSec: 30,
  },
  {
    id: "google/lyria-3-pro-preview",
    name: "Lyria 3 Pro (song)",
    durationSec: 180,
  },
] as const;

const soundModelRow = v.object({
  id: v.string(),
  name: v.string(),
  durationSec: v.number(),
});

const generatedSound = v.object({
  id: v.string(),
  name: v.string(),
  path: v.string(),
  durationSec: v.number(),
  url: v.string(),
});

const asString = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
};

const readError = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const error = Reflect.get(payload, "error");
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  if (error && typeof error === "object") {
    const message = Reflect.get(error, "message");
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }
  const message = Reflect.get(payload, "message");
  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }
  return fallback;
};

const openRouterHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
  "HTTP-Referer": "https://jayrr.app",
  "X-Title": "Jayrr Editor",
});

const clipNameFromPrompt = (prompt: string) => {
  const words = prompt
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  if (words.length === 0) {
    return "Generated sound";
  }
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const sniffMime = (bytes: Uint8Array, hinted: string) => {
  if (hinted.startsWith("audio/")) {
    return hinted;
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0x49 &&
    bytes[1] === 0x44 &&
    bytes[2] === 0x33
  ) {
    return "audio/mpeg";
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return "audio/mpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    return "audio/wav";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x4f &&
    bytes[1] === 0x67 &&
    bytes[2] === 0x67 &&
    bytes[3] === 0x53
  ) {
    return "audio/ogg";
  }
  return "audio/mpeg";
};

const extFromMime = (mimeType: string) => {
  if (mimeType.includes("wav")) {
    return "wav";
  }
  if (mimeType.includes("ogg")) {
    return "ogg";
  }
  if (
    mimeType.includes("mp4") ||
    mimeType.includes("m4a") ||
    mimeType.includes("aac")
  ) {
    return "m4a";
  }
  return "mp3";
};

const stripDataUrl = (value: string) =>
  value.replace(/^data:audio\/[a-zA-Z0-9.+-]+;base64,/, "");

const decodeB64 = (value: string) => {
  const raw = stripDataUrl(value).replace(/\s+/g, "");
  if (!raw) {
    return null;
  }
  const bytes = new Uint8Array(Buffer.from(raw, "base64"));
  if (bytes.byteLength < 32) {
    return null;
  }
  return bytes;
};

const collectAudio = (
  value: unknown,
  depth = 0,
): { bytes: Uint8Array; mimeType: string } | null => {
  if (depth > 8 || value == null) {
    return null;
  }
  if (typeof value === "string") {
    if (value.startsWith("https://")) {
      return null;
    }
    const bytes = decodeB64(value);
    if (!bytes) {
      return null;
    }
    return { bytes, mimeType: sniffMime(bytes, "") };
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = collectAudio(item, depth + 1);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const mimeHint =
    asString(record.media_type) ||
    asString(record.mimeType) ||
    asString(record.mime_type) ||
    asString(record.format);
  const b64 =
    asString(record.data) ||
    asString(record.b64_json) ||
    asString(record.base64) ||
    asString(record.inlineData);
  const bytes = decodeB64(b64);
  if (bytes) {
    const mime =
      mimeHint.startsWith("audio/") || mimeHint.includes("/")
        ? mimeHint.startsWith("audio/")
          ? mimeHint
          : `audio/${mimeHint}`
        : sniffMime(bytes, "");
    return { bytes, mimeType: sniffMime(bytes, mime) };
  }
  const nestedKeys = [
    "audio",
    "message",
    "choices",
    "content",
    "parts",
    "inline_data",
    "inlineData",
    "output",
    "delta",
  ];
  for (const key of nestedKeys) {
    if (!(key in record)) {
      continue;
    }
    const found = collectAudio(record[key], depth + 1);
    if (found) {
      return found;
    }
  }
  return null;
};

const collectAudioUrl = (value: unknown, depth = 0): string => {
  if (depth > 8 || value == null) {
    return "";
  }
  if (typeof value === "string" && value.startsWith("https://")) {
    if (
      /\.(mp3|wav|ogg|m4a)(\?|$)/i.test(value) ||
      value.includes("openrouter")
    ) {
      return value;
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = collectAudioUrl(item, depth + 1);
      if (found) {
        return found;
      }
    }
    return "";
  }
  if (typeof value !== "object") {
    return "";
  }
  const record = value as Record<string, unknown>;
  const url = asString(record.url) || asString(record.audio_url);
  if (url.startsWith("https://")) {
    return url;
  }
  for (const key of ["audio", "message", "choices", "content", "delta"]) {
    if (!(key in record)) {
      continue;
    }
    const found = collectAudioUrl(record[key], depth + 1);
    if (found) {
      return found;
    }
  }
  return "";
};

const requestBody = (modelId: string, prompt: string, stream: boolean) => ({
  model: modelId,
  stream,
  modalities: ["text", "audio"],
  audio: { format: "mp3" },
  messages: [{ role: "user", content: prompt }],
});

const parseSseAudio = async (response: Response) => {
  const text = await response.text();
  const chunks: Uint8Array[] = [];
  let mimeType = "audio/mpeg";
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) {
      continue;
    }
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") {
      continue;
    }
    let payload: unknown = null;
    try {
      payload = JSON.parse(data);
    } catch {
      continue;
    }
    const found = collectAudio(payload);
    if (found) {
      chunks.push(found.bytes);
      mimeType = found.mimeType;
    }
  }
  if (chunks.length === 0) {
    return null;
  }
  if (chunks.length === 1) {
    return { bytes: chunks[0]!, mimeType };
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes: merged, mimeType };
};

const generateBytes = async (
  apiKey: string,
  modelId: string,
  prompt: string,
) => {
  const streamed = await fetch(OPENROUTER_CHAT, {
    method: "POST",
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify(requestBody(modelId, prompt, true)),
  });
  if (streamed.ok) {
    const fromStream = await parseSseAudio(streamed);
    if (fromStream) {
      return fromStream;
    }
  } else {
    const payload: unknown = await streamed.json().catch(() => null);
    throw new Error(readError(payload, "Sound generation failed."));
  }

  const response = await fetch(OPENROUTER_CHAT, {
    method: "POST",
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify(requestBody(modelId, prompt, false)),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(readError(payload, "Sound generation failed."));
  }
  const found = collectAudio(payload);
  if (found) {
    return found;
  }
  const audioUrl = collectAudioUrl(payload);
  if (audioUrl) {
    const downloaded = await fetch(audioUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const file = downloaded.ok ? downloaded : await fetch(audioUrl);
    if (!file.ok) {
      throw new Error("Could not download the generated audio.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = file.headers.get("content-type") ?? "";
    return { bytes, mimeType: sniffMime(bytes, contentType) };
  }
  throw new Error("OpenRouter returned no audio for this prompt.");
};

const storeSound = async (
  userId: Id<"users">,
  bytes: Uint8Array,
  mimeType: string,
) => {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    throw new Error("Audio storage is not configured on the server.");
  }
  const ext = extFromMime(mimeType);
  const uploaded = await put(
    `present/${userId}/ai-sound.${ext}`,
    Buffer.from(bytes),
    {
      access: "public",
      token: blobToken,
      contentType: mimeType,
      addRandomSuffix: true,
    },
  );
  return {
    pathname: uploaded.pathname,
    url: uploaded.url,
  };
};

export const listModels = action({
  args: {},
  returns: v.array(soundModelRow),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const apiKey = process.env.OPENROUTER_API_KEY?.trim() ?? "";
    if (!apiKey) {
      throw new Error("OpenRouter is not configured on the server.");
    }
    return SOUND_MODELS.map((model) => ({
      id: model.id,
      name: model.name,
      durationSec: model.durationSec,
    }));
  },
});

export const generate = action({
  args: {
    prompt: v.string(),
    modelId: v.optional(v.string()),
  },
  returns: generatedSound,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const apiKey = process.env.OPENROUTER_API_KEY?.trim() ?? "";
    if (!apiKey) {
      throw new Error("OpenRouter is not configured on the server.");
    }
    const prompt = args.prompt.trim().slice(0, MAX_PROMPT);
    if (!prompt) {
      throw new Error("Write a prompt for the sound.");
    }
    const requested =
      args.modelId?.trim() ||
      process.env.OPENROUTER_SOUND_MODEL?.trim() ||
      DEFAULT_MODEL;
    const model =
      SOUND_MODELS.find((row) => row.id === requested) ?? SOUND_MODELS[0]!;
    const file = await generateBytes(apiKey, model.id, prompt);
    const stored = await storeSound(userId, file.bytes, file.mimeType);
    const name = clipNameFromPrompt(prompt);
    return {
      id: stored.pathname,
      name,
      path: stored.pathname,
      durationSec: model.durationSec,
      url: stored.url,
    };
  },
});
