import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

const MAX_NAME_LENGTH = 80;
const MAX_PAYLOAD_BYTES = 900_000;
const MAX_PREVIEW_BYTES = 180_000;

const sceneSummary = v.object({
  _id: v.id("scenes"),
  name: v.string(),
  previewDataUrl: v.optional(v.string()),
  updatedAt: v.number(),
});

const sceneDoc = v.object({
  _id: v.id("scenes"),
  name: v.string(),
  sceneJson: v.string(),
  updatedAt: v.number(),
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

const requireScenePayload = (sceneJson: string) => {
  if (!sceneJson) {
    throw new Error("Scene is empty");
  }
  if (sceneJson.length > MAX_PAYLOAD_BYTES) {
    throw new Error("Scene is too large to save. Remove images or split it up.");
  }
};

const normalizePreview = (previewDataUrl?: string) => {
  if (!previewDataUrl) {
    return undefined;
  }
  if (previewDataUrl.length > MAX_PREVIEW_BYTES) {
    return undefined;
  }
  return previewDataUrl;
};

const getOwnedScene = async (
  ctx: QueryCtx | MutationCtx,
  sceneId: Id<"scenes">,
  ownerKey: string,
) => {
  const scene = await ctx.db.get(sceneId);
  if (!scene || scene.ownerKey !== ownerKey) {
    throw new Error("Scene not found");
  }
  return scene;
};

export const list = query({
  args: { ownerKey: v.string() },
  returns: v.array(sceneSummary),
  handler: async (ctx, args) => {
    requireOwnerKey(args.ownerKey);
    const rows = await ctx.db
      .query("scenes")
      .withIndex("by_ownerKey", (q) => q.eq("ownerKey", args.ownerKey))
      .collect();
    return rows
      .map((row) => ({
        _id: row._id,
        name: row.name,
        previewDataUrl: row.previewDataUrl,
        updatedAt: row.updatedAt,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const get = query({
  args: {
    ownerKey: v.string(),
    sceneId: v.id("scenes"),
  },
  returns: v.union(sceneDoc, v.null()),
  handler: async (ctx, args) => {
    requireOwnerKey(args.ownerKey);
    const scene = await ctx.db.get(args.sceneId);
    if (!scene || scene.ownerKey !== args.ownerKey) {
      return null;
    }
    return {
      _id: scene._id,
      name: scene.name,
      sceneJson: scene.sceneJson,
      updatedAt: scene.updatedAt,
    };
  },
});

export const create = mutation({
  args: {
    ownerKey: v.string(),
    name: v.string(),
    sceneJson: v.string(),
    previewDataUrl: v.optional(v.string()),
  },
  returns: v.id("scenes"),
  handler: async (ctx, args) => {
    requireOwnerKey(args.ownerKey);
    requireScenePayload(args.sceneJson);
    return await ctx.db.insert("scenes", {
      ownerKey: args.ownerKey,
      name: normalizeName(args.name),
      sceneJson: args.sceneJson,
      previewDataUrl: normalizePreview(args.previewDataUrl),
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    ownerKey: v.string(),
    sceneId: v.id("scenes"),
    sceneJson: v.string(),
    previewDataUrl: v.optional(v.string()),
  },
  returns: v.id("scenes"),
  handler: async (ctx, args) => {
    requireOwnerKey(args.ownerKey);
    requireScenePayload(args.sceneJson);
    const scene = await getOwnedScene(ctx, args.sceneId, args.ownerKey);
    await ctx.db.patch(scene._id, {
      sceneJson: args.sceneJson,
      previewDataUrl: normalizePreview(args.previewDataUrl),
      updatedAt: Date.now(),
    });
    return scene._id;
  },
});

export const rename = mutation({
  args: {
    ownerKey: v.string(),
    sceneId: v.id("scenes"),
    name: v.string(),
  },
  returns: v.id("scenes"),
  handler: async (ctx, args) => {
    requireOwnerKey(args.ownerKey);
    const scene = await getOwnedScene(ctx, args.sceneId, args.ownerKey);
    await ctx.db.patch(scene._id, {
      name: normalizeName(args.name),
      updatedAt: Date.now(),
    });
    return scene._id;
  },
});

export const remove = mutation({
  args: {
    ownerKey: v.string(),
    sceneId: v.id("scenes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireOwnerKey(args.ownerKey);
    const scene = await getOwnedScene(ctx, args.sceneId, args.ownerKey);
    await ctx.db.delete(scene._id);
    return null;
  },
});
