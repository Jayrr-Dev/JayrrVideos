import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const MAX_NAME_LENGTH = 80;

const folderDoc = v.object({
  _id: v.id("sceneFolders"),
  name: v.string(),
  sceneCount: v.number(),
  updatedAt: v.number(),
});

const normalizeName = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Name is required");
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(`Name must be ${MAX_NAME_LENGTH} characters or less`);
  }
  return trimmed;
};

const getOwnedFolder = async (
  ctx: QueryCtx | MutationCtx,
  folderId: Id<"sceneFolders">,
  userId: Id<"users">,
) => {
  const folder = await ctx.db.get(folderId);
  if (!folder || folder.userId !== userId) {
    throw new Error("Folder not found");
  }
  return folder;
};

export const list = query({
  args: {},
  returns: v.array(folderDoc),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const rows = await ctx.db
      .query("sceneFolders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    return rows
      .map((row) => ({
        _id: row._id,
        name: row.name,
        sceneCount: row.sceneCount,
        updatedAt: row.updatedAt,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const get = query({
  args: {
    folderId: v.id("sceneFolders"),
  },
  returns: v.union(folderDoc, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== user._id) {
      return null;
    }
    return {
      _id: folder._id,
      name: folder.name,
      sceneCount: folder.sceneCount,
      updatedAt: folder.updatedAt,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
  },
  returns: v.id("sceneFolders"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const name = normalizeName(args.name);
    return await ctx.db.insert("sceneFolders", {
      ownerKey: user._id,
      userId: user._id,
      name,
      sceneCount: 0,
      updatedAt: Date.now(),
    });
  },
});

export const rename = mutation({
  args: {
    folderId: v.id("sceneFolders"),
    name: v.string(),
  },
  returns: v.id("sceneFolders"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const folder = await getOwnedFolder(ctx, args.folderId, user._id);
    await ctx.db.patch(folder._id, {
      name: normalizeName(args.name),
      updatedAt: Date.now(),
    });
    return folder._id;
  },
});

export const remove = mutation({
  args: {
    folderId: v.id("sceneFolders"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const folder = await getOwnedFolder(ctx, args.folderId, user._id);
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_folder", (q) => q.eq("folderId", folder._id))
      .collect();
    for (const scene of scenes) {
      await ctx.db.patch(scene._id, { folderId: undefined });
    }
    await ctx.db.delete(folder._id);
    return null;
  },
});
