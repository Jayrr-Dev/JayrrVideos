"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { put } from "@vercel/blob";
import { v } from "convex/values";

import { api } from "../_generated/api";
import { action } from "../_generated/server";

import type { Id } from "../_generated/dataModel";

const OPENROUTER_IMAGES = "https://openrouter.ai/api/v1/images";
const MAX_PROMPT = 2_000;
const DEFAULT_MODEL = "bytedance-seed/seedream-4.5";
const PREFERRED_RESOLUTION = "1K";
const STATIC_DURATION_MS = 3_000;

const MAX_ASPECT = 24;

const aspectLooksValid = (value: string) => {
  if (value === "auto") {
    return true;
  }
  return /^\d+(\.\d+)?:\d+(\.\d+)?$/.test(value) && value.length <= MAX_ASPECT;
};

const aspectValidator = v.string();

const imageModelRow = v.object({
  id: v.string(),
  name: v.string(),
  supportedAspectRatios: v.array(v.string()),
  supportedResolutions: v.array(v.string()),
});

const generatedStill = v.object({
  url: v.string(),
  label: v.string(),
  durationMs: v.number(),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
});

type ImageModelRow = {
  id: string;
  name: string;
  supportedAspectRatios: string[];
  supportedResolutions: string[];
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

const readEnumValues = (params: unknown, key: string) => {
  if (!params || typeof params !== "object") {
    return [] as string[];
  }
  const desc = Reflect.get(params, key);
  if (!desc || typeof desc !== "object") {
    return [] as string[];
  }
  if (asString(Reflect.get(desc, "type")) !== "enum") {
    return [] as string[];
  }
  return readStringList(Reflect.get(desc, "values"));
};

const hasTextInput = (architecture: unknown) => {
  if (!architecture || typeof architecture !== "object") {
    return true;
  }
  const inputs = readStringList(Reflect.get(architecture, "input_modalities"));
  if (inputs.length === 0) {
    return true;
  }
  return inputs.includes("text");
};

const readModel = (value: unknown): ImageModelRow | null => {
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
  if (!hasTextInput(Reflect.get(value, "architecture"))) {
    return null;
  }
  const params = Reflect.get(value, "supported_parameters");
  return {
    id,
    name,
    supportedAspectRatios: readEnumValues(params, "aspect_ratio"),
    supportedResolutions: readEnumValues(params, "resolution"),
  };
};

const fetchImageModels = async (apiKey: string): Promise<ImageModelRow[]> => {
  const response = await fetch(`${OPENROUTER_IMAGES}/models`, {
    headers: openRouterHeaders(apiKey),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(readError(payload, "Could not list image models."));
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const data = Reflect.get(payload, "data");
  if (!Array.isArray(data)) {
    return [];
  }
  const models: ImageModelRow[] = [];
  for (const item of data) {
    const model = readModel(item);
    if (model) {
      models.push(model);
    }
  }
  return models;
};

const pickModel = (
  models: readonly ImageModelRow[],
  preferred: string,
  aspectRatio: string,
) => {
  const envMatch = models.find((model) => model.id === preferred);
  if (envMatch) {
    return envMatch;
  }
  const matching = models.find((model) => {
    return (
      model.supportedAspectRatios.length === 0 ||
      model.supportedAspectRatios.includes(aspectRatio)
    );
  });
  if (matching) {
    return matching;
  }
  return models[0] ?? null;
};

const pickResolution = (supported: readonly string[]) => {
  if (supported.length === 0) {
    return "";
  }
  if (supported.includes(PREFERRED_RESOLUTION)) {
    return PREFERRED_RESOLUTION;
  }
  return supported[0] ?? "";
};

const stillNameFromPrompt = (prompt: string) => {
  const compact = prompt.replace(/\s+/g, " ").trim();
  if (compact.length <= 40) {
    return compact || "Generated image";
  }
  return `${compact.slice(0, 37).trim()}…`;
};

const sniffMime = (bytes: Uint8Array, fallback: string) => {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45
  ) {
    return "image/webp";
  }
  if (fallback.startsWith("image/")) {
    return fallback;
  }
  return "image/png";
};

const extFromMime = (mime: string) => {
  if (mime.includes("jpeg") || mime.includes("jpg")) {
    return "jpg";
  }
  if (mime.includes("webp")) {
    return "webp";
  }
  return "png";
};

const readPngSize = (bytes: Uint8Array) => {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width < 1 || height < 1) {
    return null;
  }
  return { width, height };
};

const readGeneratedBytes = async (payload: unknown, apiKey: string) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Image generation failed.");
  }
  const data = Reflect.get(payload, "data");
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(readError(payload, "Image generation returned no image."));
  }
  const first = data[0];
  if (!first || typeof first !== "object") {
    throw new Error("Image generation returned no image.");
  }
  const b64 = asString(Reflect.get(first, "b64_json")).replace(
    /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
    "",
  );
  let bytes: Uint8Array | null = null;
  if (b64) {
    bytes = new Uint8Array(Buffer.from(b64, "base64"));
  } else {
    const imageUrl = asString(Reflect.get(first, "url"));
    if (imageUrl.startsWith("https://")) {
      const downloaded = await fetch(imageUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const response = downloaded.ok ? downloaded : await fetch(imageUrl);
      if (!response.ok) {
        throw new Error("Could not download the generated image.");
      }
      bytes = new Uint8Array(await response.arrayBuffer());
    }
  }
  if (!bytes || bytes.byteLength < 32) {
    throw new Error("Generated image was empty.");
  }
  const mediaType = asString(Reflect.get(first, "media_type"));
  const mimeType = sniffMime(bytes, mediaType);
  const size = readPngSize(bytes);
  return { bytes, mimeType, width: size?.width, height: size?.height };
};

const storeImage = async (
  userId: Id<"users">,
  bytes: Uint8Array,
  mimeType: string,
) => {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    throw new Error("Image storage is not configured on the server.");
  }
  const ext = extFromMime(mimeType);
  const uploaded = await put(
    `present/${userId}/ai-image.${ext}`,
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
    downloadUrl: uploaded.downloadUrl,
    mimeType: uploaded.contentType || mimeType,
    sizeBytes: bytes.byteLength,
  };
};

export const listModels = action({
  args: {},
  returns: v.array(imageModelRow),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const apiKey = process.env.OPENROUTER_API_KEY?.trim() ?? "";
    if (!apiKey) {
      throw new Error("OpenRouter is not configured on the server.");
    }
    return await fetchImageModels(apiKey);
  },
});

export const generate = action({
  args: {
    prompt: v.string(),
    aspectRatio: aspectValidator,
    modelId: v.optional(v.string()),
  },
  returns: generatedStill,
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
      throw new Error("Write a prompt for the image.");
    }
    const requestedAspect = args.aspectRatio.trim();
    if (!aspectLooksValid(requestedAspect)) {
      throw new Error("Pick a valid aspect ratio.");
    }
    const models = await fetchImageModels(apiKey);
    const preferred =
      args.modelId?.trim() ||
      process.env.OPENROUTER_IMAGE_MODEL?.trim() ||
      DEFAULT_MODEL;
    const model = pickModel(models, preferred, requestedAspect);
    if (!model) {
      throw new Error("No OpenRouter image models are available.");
    }
    const aspectRatio =
      model.supportedAspectRatios.includes(requestedAspect) ||
      model.supportedAspectRatios.length === 0
        ? requestedAspect
        : model.supportedAspectRatios[0] ?? requestedAspect;
    const resolution = pickResolution(model.supportedResolutions);
    const body: Record<string, string> = {
      model: model.id,
      prompt,
      aspect_ratio: aspectRatio,
    };
    if (resolution) {
      body.resolution = resolution;
    }

    const response = await fetch(OPENROUTER_IMAGES, {
      method: "POST",
      headers: openRouterHeaders(apiKey),
      body: JSON.stringify(body),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(readError(payload, "Image generation failed."));
    }
    const file = await readGeneratedBytes(payload, apiKey);
    const stored = await storeImage(userId, file.bytes, file.mimeType);
    const name = stillNameFromPrompt(prompt);
    await ctx.runMutation(api.presentRecordings.save, {
      pathname: stored.pathname,
      url: stored.url,
      downloadUrl: stored.downloadUrl,
      mimeType: stored.mimeType,
      durationMs: STATIC_DURATION_MS,
      sizeBytes: stored.sizeBytes,
      name,
      ...(file.width ? { width: file.width } : {}),
      ...(file.height ? { height: file.height } : {}),
    });
    return {
      url: stored.url,
      label: name,
      durationMs: STATIC_DURATION_MS,
      ...(file.width ? { width: file.width } : {}),
      ...(file.height ? { height: file.height } : {}),
    };
  },
});
