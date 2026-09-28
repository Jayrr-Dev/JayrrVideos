import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const fileDoc = v.object({
  fileId: v.string(),
  url: v.union(v.string(), v.null()),
  mimeType: v.string(),
  version: v.number(),
});

const getOwnedScene = async (
  ctx: QueryCtx | MutationCtx,
  sceneId: Id<"scenes">,
  userId: Id<"users">,
) => {
  const scene = await ctx.db.get(sceneId);
  if (!scene || scene.userId !== userId) {
    throw new Error("Scene not found");
  }
  return scene;
};

const MAX_FILE_BATCH = 24;

const fileAttach = v.object({
  fileId: v.string(),
  storageId: v.id("_storage"),
  mimeType: v.string(),
  version: v.number(),
});

export const generateUploadUrls = mutation({
  args: {
    count: v.number(),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    await getCurrentUser(ctx);
    const count = Math.min(MAX_FILE_BATCH, Math.max(0, Math.floor(args.count)));
    const urls: string[] = [];
    for (let index = 0; index < count; index += 1) {
      urls.push(await ctx.storage.generateUploadUrl());
    }
    return urls;
  },
});

export const attachMany = mutation({
  args: {
    sceneId: v.id("scenes"),
    files: v.array(fileAttach),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await getOwnedScene(ctx, args.sceneId, user._id);
    for (const file of args.files.slice(0, MAX_FILE_BATCH)) {
      const existing = await ctx.db
        .query("sceneFiles")
        .withIndex("by_scene_and_file", (q) =>
          q.eq("sceneId", args.sceneId).eq("fileId", file.fileId),
        )
        .unique();
      if (existing) {
        if (existing.storageId !== file.storageId) {
          await ctx.storage.delete(existing.storageId);
        }
        await ctx.db.patch(existing._id, {
          storageId: file.storageId,
          mimeType: file.mimeType,
          version: file.version,
        });
        continue;
      }
      await ctx.db.insert("sceneFiles", {
        userId: user._id,
        sceneId: args.sceneId,
        fileId: file.fileId,
        storageId: file.storageId,
        mimeType: file.mimeType,
        version: file.version,
      });
    }
    return null;
  },
});

export const list = query({
  args: {
    sceneId: v.id("scenes"),
  },
  returns: v.array(fileDoc),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const scene = await ctx.db.get(args.sceneId);
    if (!scene || scene.userId !== user._id) {
      return [];
    }
    const rows = await ctx.db
      .query("sceneFiles")
      .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
      .collect();
    return await Promise.all(
      rows.map(async (row) => ({
        fileId: row.fileId,
        url: await ctx.storage.getUrl(row.storageId),
        mimeType: row.mimeType,
        version: row.version,
      })),
    );
  },
});
