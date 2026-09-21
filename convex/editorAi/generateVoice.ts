"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { put } from "@vercel/blob";
import { v } from "convex/values";

import { action } from "../_generated/server";

import type { Id } from "../_generated/dataModel";

const OPENROUTER_MODELS =
  "https://openrouter.ai/api/v1/models?output_modalities=speech";
const OPENROUTER_SPEECH = "https://openrouter.ai/api/v1/audio/speech";
const MAX_PROMPT = 4_000;
const MAX_MODELS = 12;
const MAX_VOICES = 32;
const DEFAULT_MODEL = "x-ai/grok-voice-tts-1.0";
const WORDS_PER_SEC = 2.5;

const PREFERRED_MODELS = [
  "x-ai/grok-voice-tts-1.0",
  "google/gemini-3.1-flash-tts-preview",
  "microsoft/mai-voice-2",
  "mistralai/voxtral-mini-tts-2603",
  "hexgrad/kokoro-82m",
  "deepgram/aura-2",
] as const;

const voiceRow = v.object({
  id: v.string(),
  name: v.string(),
});

const voiceModelRow = v.object({
  id: v.string(),
  name: v.string(),
  voices: v.array(voiceRow),
});

const generatedVoice = v.object({
  id: v.string(),
  name: v.string(),
  path: v.string(),
  durationSec: v.number(),
  url: v.string(),
});

type VoiceModelRow = {
  id: string;
  name: string;
  voices: { id: string; name: string }[];
};

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

const estimateSpeechSec = (text: string) => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) {
    return 1;
  }
  return Math.max(1, Math.round(words / WORDS_PER_SEC));
};

const clipNameFromPrompt = (prompt: string) => {
  const words = prompt
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  if (words.length === 0) {
    return "Voice clip";
  }
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const formatVoiceName = (id: string) => {
  const beforeColon = id.split(":")[0] ?? id;
  const cleaned = beforeColon
    .replace(/^(flux-|aura-2-)/i, "")
    .replace(/^English_/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b(en|gb|fr|de|es|us|mx)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return id;
  }
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
};

const readStringList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }
  const rows: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      rows.push(item.trim());
    }
  }
  return rows;
};

const readModel = (value: unknown): VoiceModelRow | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const id = asString(Reflect.get(value, "id"));
  const name = asString(Reflect.get(value, "name")) || id;
  if (!id) {
    return null;
  }
  const voiceIds = readStringList(
    Reflect.get(value, "supported_voices"),
  ).filter((voice) => voice.toLowerCase() !== "none");
  if (voiceIds.length === 0) {
    return null;
  }
  return {
    id,
    name: name.replace(/^[^:]+:\s*/, ""),
    voices: voiceIds.slice(0, MAX_VOICES).map((voiceId) => ({
      id: voiceId,
      name: formatVoiceName(voiceId),
    })),
  };
};

const fetchVoiceModels = async (apiKey: string): Promise<VoiceModelRow[]> => {
  const response = await fetch(OPENROUTER_MODELS, {
    headers: openRouterHeaders(apiKey),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(readError(payload, "Could not list voice models."));
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const data = Reflect.get(payload, "data");
  if (!Array.isArray(data)) {
    return [];
  }
  const byId = new Map<string, VoiceModelRow>();
  for (const item of data) {
    const model = readModel(item);
    if (!model) {
      continue;
    }
    byId.set(model.id, model);
  }
  const ordered: VoiceModelRow[] = [];
  for (const id of PREFERRED_MODELS) {
    const model = byId.get(id);
    if (!model) {
      continue;
    }
    ordered.push(model);
    byId.delete(id);
  }
  for (const model of byId.values()) {
    if (ordered.length >= MAX_MODELS) {
      break;
    }
    ordered.push(model);
  }
  return ordered.slice(0, MAX_MODELS);
};

const sniffMime = (bytes: Uint8Array, hinted: string) => {
  if (hinted.startsWith("audio/")) {
    return hinted.split(";")[0] ?? hinted;
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

const storeVoice = async (
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
    `present/${userId}/ai-voice.${ext}`,
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

const generateBytes = async (
  apiKey: string,
  modelId: string,
  voice: string,
  input: string,
) => {
  const response = await fetch(OPENROUTER_SPEECH, {
    method: "POST",
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify({
      model: modelId,
      input,
      voice,
      response_format: "mp3",
    }),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || contentType.includes("application/json")) {
    const payload: unknown = await response.json().catch(() => null);
    throw new Error(readError(payload, "Voice generation failed."));
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 32) {
    throw new Error("OpenRouter returned no audio for this line.");
  }
  return { bytes, mimeType: sniffMime(bytes, contentType) };
};

export const listModels = action({
  args: {},
  returns: v.array(voiceModelRow),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const apiKey = process.env.OPENROUTER_API_KEY?.trim() ?? "";
    if (!apiKey) {
      throw new Error("OpenRouter is not configured on the server.");
    }
    const models = await fetchVoiceModels(apiKey);
    if (models.length === 0) {
      throw new Error("No text-to-speech models are available.");
    }
    return models;
  },
});

export const generate = action({
  args: {
    prompt: v.string(),
    modelId: v.optional(v.string()),
    voiceId: v.optional(v.string()),
  },
  returns: generatedVoice,
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
      throw new Error("Write the words to speak.");
    }
    const models = await fetchVoiceModels(apiKey);
    if (models.length === 0) {
      throw new Error("No text-to-speech models are available.");
    }
    const requested =
      args.modelId?.trim() ||
      process.env.OPENROUTER_VOICE_MODEL?.trim() ||
      DEFAULT_MODEL;
    const model = models.find((row) => row.id === requested) ?? models[0]!;
    const voice =
      model.voices.find((row) => row.id === args.voiceId?.trim()) ??
      model.voices[0];
    if (!voice) {
      throw new Error("This model has no voices.");
    }
    const file = await generateBytes(apiKey, model.id, voice.id, prompt);
    const stored = await storeVoice(userId, file.bytes, file.mimeType);
    return {
      id: stored.pathname,
      name: clipNameFromPrompt(prompt),
      path: stored.pathname,
      durationSec: estimateSpeechSec(prompt),
      url: stored.url,
    };
  },
});
