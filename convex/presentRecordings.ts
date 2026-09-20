import { v } from "convex/values";

import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { getCurrentUser } from "./lib/auth";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const recordingRow = v.object({
  _id: v.id("presentRecordings"),
  folderId: v.union(v.id("presentRecordingFolders"), v.null()),
  sceneId: v.union(v.id("scenes"), v.null()),
  url: v.string(),
  downloadUrl: v.string(),
  mimeType: v.string(),
  durationMs: v.number(),
  sizeBytes: v.number(),
  posterUrl: v.union(v.string(), v.null()),
  width: v.union(v.number(), v.null()),
  height: v.union(v.number(), v.null()),
  name: v.union(v.string(), v.null()),
  createdAt: v.number(),
});

const ownedBlob = v.object({
  url: v.string(),
  posterUrl: v.union(v.string(), v.null()),
});

const mapRecording = (row: {
  _id: Id<"presentRecordings">;
  folderId?: Id<"presentRecordingFolders">;
  sceneId?: Id<"scenes">;
  url: string;
  downloadUrl: string;
  mimeType: string;
  durationMs: number;
  sizeBytes: number;
  posterUrl?: string;
  width?: number;
  height?: number;
  name?: string;
  createdAt: number;
}) => ({
  _id: row._id,
  folderId: row.folderId ?? null,
  sceneId: row.sceneId ?? null,
  url: row.url,
  downloadUrl: row.downloadUrl,
  mimeType: row.mimeType,
  durationMs: row.durationMs,
  sizeBytes: row.sizeBytes,
  posterUrl: row.posterUrl ?? null,
  width: row.width ?? null,
  height: row.height ?? null,
  name: row.name?.trim() ? row.name.trim() : null,
  createdAt: row.createdAt,
});

const bumpFolderCount = async (
  ctx: MutationCtx,
  folderId: Id<"presentRecordingFolders"> | undefined,
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
    recordingCount: Math.max(0, folder.recordingCount + delta),
    updatedAt: Date.now(),
  });
};

export const list = query({
  args: {
    folderId: v.optional(v.union(v.id("presentRecordingFolders"), v.null())),
  },
  returns: v.array(recordingRow),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.userId !== user._id) {
        return [];
      }
      const rows = await ctx.db
        .query("presentRecordings")
        .withIndex("by_folder_and_created", (q) =>
          q.eq("folderId", args.folderId!),
        )
        .order("desc")
        .take(40);
      return rows.map(mapRecording);
    }

    const rows = await ctx.db
      .query("presentRecordings")
      .withIndex("by_user_and_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(80);
    return rows
      .filter((row) => !row.folderId)
      .slice(0, 40)
      .map(mapRecording);
  },
});

/** Recent recordings across all folders — for the video editor picker. */
export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(recordingRow),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const limit = Math.min(
      80,
      Math.max(1, Math.floor(args.limit ?? 40)),
    );
    const rows = await ctx.db
      .query("presentRecordings")
      .withIndex("by_user_and_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);
    return rows.map(mapRecording);
  },
});

export const save = mutation({
  args: {
    sceneId: v.optional(v.id("scenes")),
    folderId: v.optional(v.id("presentRecordingFolders")),
    pathname: v.string(),
    url: v.string(),
    downloadUrl: v.string(),
    mimeType: v.string(),
    durationMs: v.number(),
    sizeBytes: v.number(),
    posterPathname: v.optional(v.string()),
    posterUrl: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    name: v.optional(v.string()),
  },
  returns: v.id("presentRecordings"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    let sceneId: Id<"scenes"> | undefined;
    if (args.sceneId) {
      const scene = await ctx.db.get(args.sceneId);
      if (!scene || scene.userId !== user._id) {
        throw new Error("Scene not found");
      }
      sceneId = scene._id;
    }
    let folderId: Id<"presentRecordingFolders"> | undefined;
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.userId !== user._id) {
        throw new Error("Folder not found");
      }
      folderId = folder._id;
    }
    const recordingId = await ctx.db.insert("presentRecordings", {
      userId: user._id,
      folderId,
      sceneId,
      pathname: args.pathname,
      url: args.url,
      downloadUrl: args.downloadUrl,
      mimeType: args.mimeType,
      durationMs: args.durationMs,
      sizeBytes: args.sizeBytes,
      posterPathname: args.posterPathname,
      posterUrl: args.posterUrl,
      width: args.width,
      height: args.height,
      name: args.name?.trim() || undefined,
      createdAt: Date.now(),
    });
    await bumpFolderCount(ctx, folderId, 1);
    return recordingId;
  },
});

export const getOwned = internalQuery({
  args: {
    recordingId: v.id("presentRecordings"),
    userId: v.id("users"),
  },
  returns: v.union(ownedBlob, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.recordingId);
    if (!row || row.userId !== args.userId) {
      return null;
    }
    return {
      url: row.url,
      posterUrl: row.posterUrl ?? null,
    };
  },
});

export const removeOwned = internalMutation({
  args: {
    recordingId: v.id("presentRecordings"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.recordingId);
    if (!row || row.userId !== args.userId) {
      throw new Error("Recording not found");
    }
    await bumpFolderCount(ctx, row.folderId, -1);
    await ctx.db.delete(args.recordingId);
    return null;
  },
});

export const rename = mutation({
  args: {
    recordingId: v.id("presentRecordings"),
    name: v.string(),
  },
  returns: v.id("presentRecordings"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const row = await ctx.db.get(args.recordingId);
    if (!row || row.userId !== user._id) {
      throw new Error("Recording not found");
    }
    const name = args.name.trim();
    if (name.length > 80) {
      throw new Error("Name must be 80 characters or less");
    }
    await ctx.db.patch(args.recordingId, {
      name: name || undefined,
    });
    return args.recordingId;
  },
});

export const move = mutation({
  args: {
    recordingId: v.id("presentRecordings"),
    folderId: v.union(v.id("presentRecordingFolders"), v.null()),
  },
  returns: v.id("presentRecordings"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const row = await ctx.db.get(args.recordingId);
    if (!row || row.userId !== user._id) {
      throw new Error("Recording not found");
    }
    let nextFolderId: Id<"presentRecordingFolders"> | undefined;
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.userId !== user._id) {
        throw new Error("Folder not found");
      }
      nextFolderId = folder._id;
    }
    const prevFolderId = row.folderId;
    if (prevFolderId === nextFolderId) {
      return args.recordingId;
    }
    await ctx.db.patch(args.recordingId, {
      folderId: nextFolderId,
    });
    await bumpFolderCount(ctx, prevFolderId, -1);
    await bumpFolderCount(ctx, nextFolderId, 1);
    return args.recordingId;
  },
});
