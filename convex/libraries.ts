import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

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

const requireOwnerKey = (ownerKey: string) => {
  if (!ownerKey.trim()) {
    throw new Error("Missing owner key");
  }
};

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
  ownerKey: string,
) => {
  const library = await ctx.db.get(libraryId);
  if (!library || library.ownerKey !== ownerKey) {
    throw new Error("Library not found");
  }
  return library;
};

export const list = query({
  args: { ownerKey: v.string() },
  returns: v.array(libraryDoc),
  handler: async (ctx, args) => {
    requireOwnerKey(args.ownerKey);
    const rows = await ctx.db
      .query("libraries")
      .withIndex("by_ownerKey", (q) => q.eq("ownerKey", args.ownerKey))
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
    ownerKey: v.string(),
    libraryId: v.id("libraries"),
  },
  returns: v.union(libraryDoc, v.null()),
  handler: async (ctx, args) => {
    requireOwnerKey(args.ownerKey);
    const library = await ctx.db.get(args.libraryId);
    if (!library || library.ownerKey !== args.ownerKey) {
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
    ownerKey: v.string(),
    name: v.string(),
  },
  returns: v.id("libraries"),
  handler: async (ctx, args) => {
    requireOwnerKey(args.ownerKey);
    const name = normalizeName(args.name);
    return await ctx.db.insert("libraries", {
      ownerKey: args.ownerKey,
      name,
      assetCount: 0,
      updatedAt: Date.now(),
    });
  },
});

export const rename = mutation({
  args: {
    ownerKey: v.string(),
    libraryId: v.id("libraries"),
    name: v.string(),
  },
  returns: v.id("libraries"),
  handler: async (ctx, args) => {
    requireOwnerKey(args.ownerKey);
    const library = await getOwnedLibrary(ctx, args.libraryId, args.ownerKey);
    await ctx.db.patch(library._id, {
      name: normalizeName(args.name),
      updatedAt: Date.now(),
    });
    return library._id;
  },
});

export const remove = mutation({
  args: {
    ownerKey: v.string(),
    libraryId: v.id("libraries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireOwnerKey(args.ownerKey);
    const library = await getOwnedLibrary(ctx, args.libraryId, args.ownerKey);
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
    ownerKey: v.string(),
    libraryId: v.id("libraries"),
  },
  returns: v.array(assetDoc),
  handler: async (ctx, args) => {
    requireOwnerKey(args.ownerKey);
    const library = await ctx.db.get(args.libraryId);
    if (!library || library.ownerKey !== args.ownerKey) {
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
    ownerKey: v.string(),
    libraryId: v.id("libraries"),
    name: v.optional(v.string()),
    elementsJson: v.string(),
    filesJson: v.optional(v.string()),
  },
  returns: v.id("libraryAssets"),
  handler: async (ctx, args) => {
    requireOwnerKey(args.ownerKey);
    const library = await getOwnedLibrary(ctx, args.libraryId, args.ownerKey);
    const payloadSize =
      args.elementsJson.length + (args.filesJson?.length ?? 0);
    if (payloadSize > MAX_PAYLOAD_BYTES) {
      throw new Error("Asset is too large to save. Use a smaller selection.");
    }
    const createdAt = Date.now();
    const assetId = await ctx.db.insert("libraryAssets", {
      libraryId: library._id,
      ownerKey: args.ownerKey,
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
    ownerKey: v.string(),
    assetId: v.id("libraryAssets"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireOwnerKey(args.ownerKey);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.ownerKey !== args.ownerKey) {
      throw new Error("Asset not found");
    }
    const library = await getOwnedLibrary(ctx, asset.libraryId, args.ownerKey);
    await ctx.db.delete(asset._id);
    await ctx.db.patch(library._id, {
      assetCount: Math.max(0, library.assetCount - 1),
      updatedAt: Date.now(),
    });
    return null;
  },
});
