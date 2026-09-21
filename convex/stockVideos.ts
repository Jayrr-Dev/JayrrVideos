import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { action } from "./_generated/server";

const stockClipValidator = v.object({
  id: v.number(),
  durationSec: v.number(),
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

const pickVideoUrl = (value: unknown) => {
  if (!Array.isArray(value)) {
    return "";
  }
  const candidates: Array<{ width: number; link: string; quality: string }> =
    [];
  for (const file of value) {
    if (!file || typeof file !== "object") {
      continue;
    }
    const link = Reflect.get(file, "link");
    const fileType = Reflect.get(file, "file_type");
    const quality = Reflect.get(file, "quality");
    if (typeof link !== "string" || !link) {
      continue;
    }
    if (typeof quality === "string" && quality === "hls") {
      continue;
    }
    if (typeof fileType === "string") {
      if (fileType.includes("hls")) {
        continue;
      }
      if (!fileType.includes("mp4")) {
        continue;
      }
    }
    candidates.push({
      width: finiteNumber(Reflect.get(file, "width")),
      link,
      quality: typeof quality === "string" ? quality : "",
    });
  }
  if (candidates.length === 0) {
    return "";
  }
  const hd1280 = candidates.find((file) => file.width === 1280);
  if (hd1280) {
    return hd1280.link;
  }
  const hd1920 = candidates.find((file) => file.width === 1920);
  if (hd1920) {
    return hd1920.link;
  }
  const labeledHd = candidates.find((file) => file.quality === "hd");
  if (labeledHd) {
    return labeledHd.link;
  }
  return candidates[0]?.link ?? "";
};

const readStockClip = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const id = Reflect.get(value, "id");
  const image = Reflect.get(value, "image");
  const url = pickVideoUrl(Reflect.get(value, "video_files"));
  if (typeof id !== "number" || typeof image !== "string" || !image || !url) {
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
    url,
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
  const clips: Array<{
    id: number;
    durationSec: number;
    width: number;
    height: number;
    image: string;
    url: string;
    author: string;
  }> = [];
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
