import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { action } from "./_generated/server";

const stockClipValidator = v.object({
  id: v.number(),
  durationSec: v.number(),
  width: v.number(),
  height: v.number(),
  image: v.string(),
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

const readStockClip = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const id = Reflect.get(value, "id");
  const image = Reflect.get(value, "image");
  if (typeof id !== "number" || typeof image !== "string" || !image) {
    return null;
  }
  const duration = Reflect.get(value, "duration");
  const width = Reflect.get(value, "width");
  const height = Reflect.get(value, "height");
  const user = Reflect.get(value, "user");
  let author = "Pexels";
  if (typeof user === "object") {
    if (user) {
      const name = Reflect.get(user, "name");
      if (typeof name === "string") {
        if (name.trim()) {
          author = name.trim();
        }
      }
    }
  }
  return {
    id,
    durationSec: finiteNumber(duration),
    width: finiteNumber(width),
    height: finiteNumber(height),
    image,
    author,
  };
};

const readStockClips = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const videos = Reflect.get(payload, "videos");
  if (!Array.isArray(videos)) {
    return [];
  }
  const clips = [];
  for (const video of videos) {
    const clip = readStockClip(video);
    if (clip) {
      clips.push(clip);
    }
  }
  return clips;
};

export const search = action({
  args: {
    query: v.string(),
  },
  returns: v.array(stockClipValidator),
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
      throw new Error("Stock search is not configured.");
    }
    const url = new URL("https://api.pexels.com/videos/search");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", "12");
    const response = await fetch(url.href, {
      headers: {
        Authorization: apiKey,
      },
    });
    if (!response.ok) {
      throw new Error("Stock search failed.");
    }
    return readStockClips(await response.json());
  },
});
