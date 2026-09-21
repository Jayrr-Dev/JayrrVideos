import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { action } from "./_generated/server";

const stockImageValidator = v.object({
  id: v.number(),
  width: v.number(),
  height: v.number(),
  image: v.string(),
  url: v.string(),
  author: v.string(),
});

const finiteNumber = (value: unknown) => {
  if (typeof value !== "number") {
    return 0;
  }
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, value);
};

const readSrcUrl = (src: unknown, key: string) => {
  if (!src || typeof src !== "object") {
    return "";
  }
  const value = Reflect.get(src, key);
  if (typeof value !== "string") {
    return "";
  }
  return value;
};

const readStockImage = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const id = Reflect.get(value, "id");
  const src = Reflect.get(value, "src");
  const url = readSrcUrl(src, "large2x") || readSrcUrl(src, "original");
  const image = readSrcUrl(src, "medium") || url;
  if (typeof id !== "number" || !url) {
    return null;
  }
  const photographer = Reflect.get(value, "photographer");
  let author = "Pexels";
  if (typeof photographer === "string" && photographer.trim()) {
    author = photographer.trim();
  }
  return {
    id,
    width: finiteNumber(Reflect.get(value, "width")),
    height: finiteNumber(Reflect.get(value, "height")),
    image,
    url,
    author,
  };
};

const readStockImages = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const photos = Reflect.get(payload, "photos");
  if (!Array.isArray(photos)) {
    return [];
  }
  const images = [];
  for (const photo of photos) {
    const row = readStockImage(photo);
    if (row) {
      images.push(row);
    }
  }
  return images;
};

export const search = action({
  args: {
    query: v.string(),
  },
  returns: v.array(stockImageValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const query = args.query.trim().slice(0, 80);
    if (!query) {
      return [];
    }
    const apiKey = process.env.PEXELS_API_KEY?.trim() ?? "";
    if (!apiKey) {
      throw new Error("Image search is not configured.");
    }
    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", "12");
    const response = await fetch(url.href, {
      headers: {
        Authorization: apiKey,
      },
    });
    if (!response.ok) {
      throw new Error("Image search failed.");
    }
    return readStockImages(await response.json());
  },
});
