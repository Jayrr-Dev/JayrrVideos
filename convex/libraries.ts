import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

import { getCurrentUser } from "./lib/auth";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const MAX_NAME_LENGTH = 80;
const MAX_PAYLOAD_BYTES = 900_000;

const libraryDoc = v.object({
  _id: v.id("libraries"),
  name: v.string(),
  assetCount: v.number(),
  updatedAt: v.number(),
});

const assetDoc = v.object({
  _id: v.id("libraryAssets"),
  libraryId: v.id("libraries"),
  name: v.string(),
  itemId: v.string(),
  elementsJson: v.string(),
  filesJson: v.optional(v.string()),
  createdAt: v.number(),
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

const getOwnedLibrary = async (
  ctx: QueryCtx | MutationCtx,
  libraryId: Id<"libraries">,
  userId: Id<"users">,
) => {
  const library = await ctx.db.get(libraryId);
  if (!library || library.userId !== userId) {
    throw new Error("Library not found");
  }
  return library;
};

export const list = query({
  args: {},
  returns: v.array(libraryDoc),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const rows = await ctx.db
      .query("libraries")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    return rows
      .map((row) => ({
        _id: row._id,
        name: row.name,
        assetCount: row.assetCount,
        updatedAt: row.updatedAt,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const get = query({
  args: {
    libraryId: v.id("libraries"),
  },
  returns: v.union(libraryDoc, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const library = await ctx.db.get(args.libraryId);
    if (!library || library.userId !== user._id) {
      return null;
    }
    return {
      _id: library._id,
      name: library.name,
      assetCount: library.assetCount,
      updatedAt: library.updatedAt,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
  },
  returns: v.id("libraries"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const name = normalizeName(args.name);
    return await ctx.db.insert("libraries", {
      ownerKey: user._id,
      userId: user._id,
      name,
      assetCount: 0,
      updatedAt: Date.now(),
    });
  },
});

export const rename = mutation({
  args: {
    libraryId: v.id("libraries"),
    name: v.string(),
  },
  returns: v.id("libraries"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const library = await getOwnedLibrary(ctx, args.libraryId, user._id);
    await ctx.db.patch(library._id, {
      name: normalizeName(args.name),
      updatedAt: Date.now(),
    });
    return library._id;
  },
});

export const remove = mutation({
  args: {
    libraryId: v.id("libraries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const library = await getOwnedLibrary(ctx, args.libraryId, user._id);
    const assets = await ctx.db
      .query("libraryAssets")
      .withIndex("by_library", (q) => q.eq("libraryId", library._id))
      .collect();
    for (const asset of assets) {
      await ctx.db.delete(asset._id);
    }
    await ctx.db.delete(library._id);
    return null;
  },
});

export const listAssets = query({
  args: {
    libraryId: v.id("libraries"),
  },
  returns: v.array(assetDoc),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const library = await ctx.db.get(args.libraryId);
    if (!library || library.userId !== user._id) {
      return [];
    }
    const rows = await ctx.db
      .query("libraryAssets")
      .withIndex("by_library", (q) => q.eq("libraryId", args.libraryId))
      .collect();
    return rows
      .map((row) => ({
        _id: row._id,
        libraryId: row.libraryId,
        name: row.name,
        itemId: row.itemId,
        elementsJson: row.elementsJson,
        filesJson: row.filesJson,
        createdAt: row.createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const addAsset = mutation({
  args: {
    libraryId: v.id("libraries"),
    name: v.optional(v.string()),
    elementsJson: v.string(),
    filesJson: v.optional(v.string()),
  },
  returns: v.id("libraryAssets"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const library = await getOwnedLibrary(ctx, args.libraryId, user._id);
    const payloadSize =
      args.elementsJson.length + (args.filesJson?.length ?? 0);
    if (payloadSize > MAX_PAYLOAD_BYTES) {
      throw new Error("Asset is too large to save. Use a smaller selection.");
    }
    const createdAt = Date.now();
    const assetId = await ctx.db.insert("libraryAssets", {
      libraryId: library._id,
      ownerKey: user._id,
      userId: user._id,
      name: args.name?.trim() ?? "",
      itemId: crypto.randomUUID(),
      elementsJson: args.elementsJson,
      filesJson: args.filesJson,
      createdAt,
    });
    await ctx.db.patch(library._id, {
      assetCount: library.assetCount + 1,
      updatedAt: createdAt,
    });
    return assetId;
  },
});

export const removeAsset = mutation({
  args: {
    assetId: v.id("libraryAssets"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.userId !== user._id) {
      throw new Error("Asset not found");
    }
    const library = await getOwnedLibrary(ctx, asset.libraryId, user._id);
    await ctx.db.delete(asset._id);
    await ctx.db.patch(library._id, {
      assetCount: Math.max(0, library.assetCount - 1),
      updatedAt: Date.now(),
    });
    return null;
  },
});
