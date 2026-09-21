"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { put } from "@vercel/blob";
import { v } from "convex/values";

import { internal } from "../_generated/api";
import { action } from "../_generated/server";

import type { Id } from "../_generated/dataModel";

const OPENROUTER_VIDEOS = "https://openrouter.ai/api/v1/videos";
const POLL_MS = 5_000;
const MAX_POLLS = 96;
const MAX_PROMPT = 2_000;
const DEFAULT_MODEL = "bytedance/seedance-1-5-pro";

const aspectValidator = v.union(
  v.literal("16:9"),
  v.literal("9:16"),
  v.literal("1:1"),
);

const videoModelRow = v.object({
  id: v.string(),
  name: v.string(),
  supportedDurations: v.array(v.number()),
  supportedAspectRatios: v.array(v.string()),
});

const generatedClip = v.object({
  _id: v.id("presentRecordings"),
  url: v.string(),
  posterUrl: v.union(v.string(), v.null()),
  durationMs: v.number(),
  name: v.union(v.string(), v.null()),
  createdAt: v.number(),
});

type GeneratedClip = {
  _id: Id<"presentRecordings">;
  url: string;
  posterUrl: string | null;
  durationMs: number;
  name: string | null;
  createdAt: number;
};

type VideoModelRow = {
  id: string;
  name: string;
  supportedDurations: number[];
  supportedAspectRatios: string[];
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

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const isUpscale = (id: string, name: string) => {
  const hay = `${id} ${name}`.toLowerCase();
  return hay.includes("upscale");
};

const readStringList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  const items: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      items.push(item.trim());
    }
  }
  return items;
};

const readNumberList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [] as number[];
  }
  const items: number[] = [];
  for (const item of value) {
    if (typeof item === "number" && Number.isFinite(item) && item > 0) {
      items.push(item);
    }
  }
  return items;
};

const readModel = (value: unknown): VideoModelRow | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const id = asString(Reflect.get(value, "id"));
  if (!id) {
    return null;
  }
  const name = asString(Reflect.get(value, "name")) || id;
  if (isUpscale(id, name)) {
    return null;
  }
  return {
    id,
    name,
    supportedDurations: readNumberList(
      Reflect.get(value, "supported_durations"),
    ),
    supportedAspectRatios: readStringList(
      Reflect.get(value, "supported_aspect_ratios"),
    ),
  };
};

const fetchVideoModels = async (apiKey: string): Promise<VideoModelRow[]> => {
  const response = await fetch(`${OPENROUTER_VIDEOS}/models`, {
    headers: openRouterHeaders(apiKey),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(readError(payload, "Could not list video models."));
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const data = Reflect.get(payload, "data");
  if (!Array.isArray(data)) {
    return [];
  }
  const models: VideoModelRow[] = [];
  for (const item of data) {
    const model = readModel(item);
    if (model) {
      models.push(model);
    }
  }
  return models;
};

const pickModel = (
  models: readonly VideoModelRow[],
  preferred: string,
  duration: number,
  aspectRatio: string,
) => {
  const envMatch = models.find((model) => model.id === preferred);
  if (envMatch) {
    return envMatch;
  }
  const matching = models.find((model) => {
    const durationOk =
      model.supportedDurations.length === 0 ||
      model.supportedDurations.includes(duration);
    const aspectOk =
      model.supportedAspectRatios.length === 0 ||
      model.supportedAspectRatios.includes(aspectRatio);
    return durationOk && aspectOk;
  });
  if (matching) {
    return matching;
  }
  return models[0] ?? null;
};

const nearestDuration = (supported: readonly number[], wanted: number) => {
  if (supported.length === 0) {
    return wanted;
  }
  if (supported.includes(wanted)) {
    return wanted;
  }
  return supported.reduce((best, item) =>
    Math.abs(item - wanted) < Math.abs(best - wanted) ? item : best,
  );
};

const clipNameFromPrompt = (prompt: string) => {
  const compact = prompt.replace(/\s+/g, " ").trim();
  if (compact.length <= 40) {
    return compact || "Generated clip";
  }
  return `${compact.slice(0, 37).trim()}…`;
};

const parseSubmit = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Video job did not start.");
  }
  const id = asString(Reflect.get(payload, "id"));
  if (!id) {
    throw new Error(readError(payload, "Video job did not start."));
  }
  const pollingUrl =
    asString(Reflect.get(payload, "polling_url")) ||
    `${OPENROUTER_VIDEOS}/${id}`;
  if (!pollingUrl.startsWith("https://openrouter.ai/")) {
    throw new Error("Unexpected video poll URL.");
  }
  return { id, pollingUrl };
};

const readUrls = (payload: object) => {
  const unsigned = Reflect.get(payload, "unsigned_urls");
  const signed = Reflect.get(payload, "signed_urls");
  return [...readStringList(unsigned), ...readStringList(signed)];
};

const pollUntilReady = async (pollingUrl: string, apiKey: string) => {
  for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
    const response = await fetch(pollingUrl, {
      headers: openRouterHeaders(apiKey),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(readError(payload, "Video generation poll failed."));
    }
    if (!payload || typeof payload !== "object") {
      throw new Error("Video generation poll failed.");
    }
    const status = asString(Reflect.get(payload, "status")).toLowerCase();
    if (status === "completed") {
      const url = readUrls(payload)[0];
      if (!url) {
        throw new Error("Video finished but no download URL was returned.");
      }
      return url;
    }
    if (status === "failed" || status === "cancelled" || status === "expired") {
      throw new Error(readError(payload, `Video generation ${status}.`));
    }
    await wait(POLL_MS);
  }
  throw new Error("Video generation timed out. Try a shorter clip.");
};

const downloadVideo = async (url: string, apiKey: string) => {
  const withAuth = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const response = withAuth.ok ? withAuth : await fetch(url);
  if (!response.ok) {
    throw new Error("Could not download the generated video.");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 100) {
    throw new Error("Generated video was empty.");
  }
  const contentType = response.headers.get("content-type") ?? "video/mp4";
  return { bytes, contentType };
};

const storeVideo = async (
  userId: Id<"users">,
  bytes: Uint8Array,
  contentType: string,
) => {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    return null;
  }
  const ext = contentType.includes("webm") ? "webm" : "mp4";
  const uploaded = await put(
    `present/${userId}/ai-clip.${ext}`,
    Buffer.from(bytes),
    {
      access: "public",
      token: blobToken,
      contentType: contentType.includes("video/")
        ? contentType
        : `video/${ext}`,
      addRandomSuffix: true,
    },
  );
  return {
    pathname: uploaded.pathname,
    url: uploaded.url,
    downloadUrl: uploaded.downloadUrl,
    mimeType: uploaded.contentType || `video/${ext}`,
    sizeBytes: bytes.byteLength,
  };
};

export const listModels = action({
  args: {},
  returns: v.array(videoModelRow),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const apiKey = process.env.OPENROUTER_API_KEY?.trim() ?? "";
    if (!apiKey) {
      throw new Error("OpenRouter is not configured on the server.");
    }
    return await fetchVideoModels(apiKey);
  },
});

export const generate = action({
  args: {
    prompt: v.string(),
    durationSec: v.number(),
    aspectRatio: aspectValidator,
    modelId: v.optional(v.string()),
  },
  returns: generatedClip,
  handler: async (ctx, args): Promise<GeneratedClip> => {
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
      throw new Error("Write a prompt for the clip.");
    }
    const models = await fetchVideoModels(apiKey);
    const preferred =
      args.modelId?.trim() ||
      process.env.OPENROUTER_VIDEO_MODEL?.trim() ||
      DEFAULT_MODEL;
    const model = pickModel(
      models,
      preferred,
      args.durationSec,
      args.aspectRatio,
    );
    if (!model) {
      throw new Error("No OpenRouter video models are available.");
    }
    const durationSec = nearestDuration(
      model.supportedDurations,
      Math.round(args.durationSec),
    );
    const aspectRatio =
      model.supportedAspectRatios.includes(args.aspectRatio) ||
      model.supportedAspectRatios.length === 0
        ? args.aspectRatio
        : model.supportedAspectRatios[0] ?? args.aspectRatio;

    const submitResponse = await fetch(OPENROUTER_VIDEOS, {
      method: "POST",
      headers: openRouterHeaders(apiKey),
      body: JSON.stringify({
        model: model.id,
        prompt,
        duration: durationSec,
        aspect_ratio: aspectRatio,
        resolution: "720p",
      }),
    });
    const submitPayload: unknown = await submitResponse
      .json()
      .catch(() => null);
    if (!submitResponse.ok) {
      throw new Error(readError(submitPayload, "Video generation failed."));
    }
    const job = parseSubmit(submitPayload);
    const downloadUrl = await pollUntilReady(job.pollingUrl, apiKey);
    const file = await downloadVideo(downloadUrl, apiKey);
    let stored: Awaited<ReturnType<typeof storeVideo>> = null;
    try {
      stored = await storeVideo(userId, file.bytes, file.contentType);
    } catch (error) {
      console.error("Could not store generated video in blob", error);
    }
    const name = clipNameFromPrompt(prompt);
    const durationMs = Math.max(1, Math.round(durationSec * 1000));
    const url = stored?.url ?? downloadUrl;
    const recordingId: Id<"presentRecordings"> = await ctx.runMutation(
      internal.presentRecordings.saveFromUser,
      {
        userId,
        pathname: stored?.pathname ?? `openrouter/${job.id}.mp4`,
        url,
        downloadUrl: stored?.downloadUrl ?? downloadUrl,
        mimeType: stored?.mimeType ?? "video/mp4",
        durationMs,
        sizeBytes: stored?.sizeBytes ?? file.bytes.byteLength,
        name,
      },
    );
    return {
      _id: recordingId,
      url,
      posterUrl: null,
      durationMs,
      name,
      createdAt: Date.now(),
    };
  },
});
