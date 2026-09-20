import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

import { getCurrentUser } from "./lib/auth";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const MAX_NAME_LENGTH = 80;
const MAX_PAYLOAD_BYTES = 900_000;
const MAX_PREVIEW_BYTES = 180_000;

const sceneSummary = v.object({
  _id: v.id("scenes"),
  folderId: v.union(v.id("sceneFolders"), v.null()),
  name: v.string(),
  previewDataUrl: v.optional(v.string()),
  updatedAt: v.number(),
});

const sceneDoc = v.object({
  _id: v.id("scenes"),
  folderId: v.union(v.id("sceneFolders"), v.null()),
  name: v.string(),
  sceneJson: v.string(),
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

const requireScenePayload = (sceneJson: string) => {
  if (!sceneJson) {
    throw new Error("Scene is empty");
  }
  if (sceneJson.length > MAX_PAYLOAD_BYTES) {
    throw new Error(
      "Scene is too large to save. Remove images or split it up.",
    );
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
  userId: Id<"users">,
) => {
  const scene = await ctx.db.get(sceneId);
  if (!scene || scene.userId !== userId) {
    throw new Error("Scene not found");
  }
  return scene;
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

const bumpFolderCount = async (
  ctx: MutationCtx,
  folderId: Id<"sceneFolders"> | undefined,
  delta: number,
) => {
  if (!folderId) {
    return;
  }
  const folder = await ctx.db.get(folderId);
  if (!folder) {
    return;
  }
  await ctx.db.patch(folderId, {
    sceneCount: Math.max(0, folder.sceneCount + delta),
    updatedAt: Date.now(),
  });
};

const mapSceneSummary = (row: {
  _id: Id<"scenes">;
  folderId?: Id<"sceneFolders">;
  name: string;
  previewDataUrl?: string;
  updatedAt: number;
}) => ({
  _id: row._id,
  folderId: row.folderId ?? null,
  name: row.name,
  previewDataUrl: row.previewDataUrl,
  updatedAt: row.updatedAt,
});

export const list = query({
  args: {
    folderId: v.optional(v.union(v.id("sceneFolders"), v.null())),
  },
  returns: v.array(sceneSummary),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.userId !== user._id) {
        return [];
      }
      const rows = await ctx.db
        .query("scenes")
        .withIndex("by_folder", (q) => q.eq("folderId", args.folderId!))
        .collect();
      return rows
        .map(mapSceneSummary)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    const rows = await ctx.db
      .query("scenes")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    // null folderId = unfiled only; omitted folderId = all scenes
    const filtered =
      args.folderId === null ? rows.filter((row) => !row.folderId) : rows;

    return filtered
      .map(mapSceneSummary)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const get = query({
  args: {
    sceneId: v.id("scenes"),
  },
  returns: v.union(sceneDoc, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const scene = await ctx.db.get(args.sceneId);
    if (!scene || scene.userId !== user._id) {
      return null;
    }
    return {
      _id: scene._id,
      folderId: scene.folderId ?? null,
      name: scene.name,
      sceneJson: scene.sceneJson,
      updatedAt: scene.updatedAt,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    sceneJson: v.string(),
    previewDataUrl: v.optional(v.string()),
    folderId: v.optional(v.id("sceneFolders")),
  },
  returns: v.id("scenes"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    requireScenePayload(args.sceneJson);
    let folderId: Id<"sceneFolders"> | undefined;
    if (args.folderId) {
      const folder = await getOwnedFolder(ctx, args.folderId, user._id);
      folderId = folder._id;
    }
    const sceneId = await ctx.db.insert("scenes", {
      ownerKey: user._id,
      userId: user._id,
      folderId,
      name: normalizeName(args.name),
      sceneJson: args.sceneJson,
      previewDataUrl: normalizePreview(args.previewDataUrl),
      updatedAt: Date.now(),
    });
    await bumpFolderCount(ctx, folderId, 1);
    return sceneId;
  },
});

export const update = mutation({
  args: {
    sceneId: v.id("scenes"),
    sceneJson: v.string(),
    previewDataUrl: v.optional(v.string()),
  },
  returns: v.id("scenes"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    requireScenePayload(args.sceneJson);
    const scene = await getOwnedScene(ctx, args.sceneId, user._id);
    const previewDataUrl = normalizePreview(args.previewDataUrl);
    const patch: {
      sceneJson: string;
      updatedAt: number;
      previewDataUrl?: string;
    } = {
      sceneJson: args.sceneJson,
      updatedAt: Date.now(),
    };
    if (args.previewDataUrl === "") {
      patch.previewDataUrl = undefined;
    } else if (previewDataUrl) {
      patch.previewDataUrl = previewDataUrl;
    }
    await ctx.db.patch(scene._id, patch);
    if (scene.folderId) {
      await ctx.db.patch(scene.folderId, { updatedAt: Date.now() });
    }
    return scene._id;
  },
});

export const rename = mutation({
  args: {
    sceneId: v.id("scenes"),
    name: v.string(),
  },
  returns: v.id("scenes"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const scene = await getOwnedScene(ctx, args.sceneId, user._id);
    await ctx.db.patch(scene._id, {
      name: normalizeName(args.name),
      updatedAt: Date.now(),
    });
    return scene._id;
  },
});

export const move = mutation({
  args: {
    sceneId: v.id("scenes"),
    folderId: v.union(v.id("sceneFolders"), v.null()),
  },
  returns: v.id("scenes"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const scene = await getOwnedScene(ctx, args.sceneId, user._id);
    let nextFolderId: Id<"sceneFolders"> | undefined;
    if (args.folderId) {
      const folder = await getOwnedFolder(ctx, args.folderId, user._id);
      nextFolderId = folder._id;
    }
    const prevFolderId = scene.folderId;
    if (prevFolderId === nextFolderId) {
      return scene._id;
    }
    await ctx.db.patch(scene._id, {
      folderId: nextFolderId,
      updatedAt: Date.now(),
    });
    await bumpFolderCount(ctx, prevFolderId, -1);
    await bumpFolderCount(ctx, nextFolderId, 1);
    return scene._id;
  },
});

export const remove = mutation({
  args: {
    sceneId: v.id("scenes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const scene = await getOwnedScene(ctx, args.sceneId, user._id);
    await bumpFolderCount(ctx, scene.folderId, -1);
    await ctx.db.delete(scene._id);
    return null;
  },
});
