import { v } from "convex/values";

import { mutation } from "./_generated/server";

const assertSeed = (secret: string) => {
  const expected = process.env.SEED_SECRET;
  if (!expected || secret !== expected) {
    throw new Error("Unauthorized seed");
  }
};

const soundDoc = v.object({
  path: v.string(),
  name: v.string(),
  source: v.string(),
  owner: v.optional(v.string()),
  credit: v.optional(v.string()),
  license: v.optional(v.string()),
  folders: v.array(v.string()),
  folderPath: v.string(),
  category: v.string(),
  ext: v.string(),
  durationSec: v.number(),
  sampleRate: v.number(),
  centroidHz: v.number(),
  loudnessDb: v.optional(v.number()),
  search: v.string(),
});

const folderDoc = v.object({
  path: v.string(),
  name: v.string(),
  parent: v.string(),
  count: v.number(),
});

export const generateUploadUrl = mutation({
  args: { secret: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    assertSeed(args.secret);
    return await ctx.storage.generateUploadUrl();
  },
});

export const existingPaths = mutation({
  args: {
    secret: v.string(),
    paths: v.array(v.string()),
  },
  returns: v.array(
    v.object({
      path: v.string(),
      hasAudio: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    assertSeed(args.secret);
    const rows = [];
    for (const path of args.paths) {
      const row = await ctx.db
        .query("sounds")
        .withIndex("by_path", (q) => q.eq("path", path))
        .unique();
      if (row) {
        rows.push({ path: row.path, hasAudio: Boolean(row.storageId) });
      }
    }
    return rows;
  },
});

export const insertSounds = mutation({
  args: {
    secret: v.string(),
    files: v.array(soundDoc),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    assertSeed(args.secret);
    for (const file of args.files) {
      const existing = await ctx.db
        .query("sounds")
        .withIndex("by_path", (q) => q.eq("path", file.path))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          ...file,
          storageId: existing.storageId,
        });
      } else {
        await ctx.db.insert("sounds", file);
      }
    }
    return args.files.length;
  },
});

export const attachAudio = mutation({
  args: {
    secret: v.string(),
    path: v.string(),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertSeed(args.secret);
    const row = await ctx.db
      .query("sounds")
      .withIndex("by_path", (q) => q.eq("path", args.path))
      .unique();
    if (!row) {
      throw new Error(`Sound not found: ${args.path}`);
    }
    if (row.storageId && row.storageId !== args.storageId) {
      await ctx.storage.delete(row.storageId);
    }
    await ctx.db.patch(row._id, { storageId: args.storageId });
    return null;
  },
});

export const saveSound = mutation({
  args: {
    secret: v.string(),
    file: soundDoc,
    storageId: v.optional(v.id("_storage")),
  },
  returns: v.id("sounds"),
  handler: async (ctx, args) => {
    assertSeed(args.secret);
    const existing = await ctx.db
      .query("sounds")
      .withIndex("by_path", (q) => q.eq("path", args.file.path))
      .unique();
    if (existing) {
      if (
        args.storageId &&
        existing.storageId &&
        existing.storageId !== args.storageId
      ) {
        await ctx.storage.delete(existing.storageId);
      }
      await ctx.db.patch(existing._id, {
        ...args.file,
        storageId: args.storageId ?? existing.storageId,
      });
      return existing._id;
    }
    return await ctx.db.insert("sounds", {
      ...args.file,
      storageId: args.storageId,
    });
  },
});

export const clearPage = mutation({
  args: { secret: v.string() },
  returns: v.object({
    sounds: v.number(),
    folders: v.number(),
  }),
  handler: async (ctx, args) => {
    assertSeed(args.secret);
    const sounds = await ctx.db.query("sounds").take(256);
    for (const row of sounds) {
      if (row.storageId) {
        await ctx.storage.delete(row.storageId);
      }
      await ctx.db.delete(row._id);
    }
    const folders = await ctx.db.query("soundFolders").take(256);
    for (const row of folders) {
      await ctx.db.delete(row._id);
    }
    return { sounds: sounds.length, folders: folders.length };
  },
});

export const insertFolders = mutation({
  args: { secret: v.string(), folders: v.array(folderDoc) },
  returns: v.number(),
  handler: async (ctx, args) => {
    assertSeed(args.secret);
    for (const folder of args.folders) {
      const existing = await ctx.db
        .query("soundFolders")
        .withIndex("by_path", (q) => q.eq("path", folder.path))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, folder);
      } else {
        await ctx.db.insert("soundFolders", folder);
      }
    }
    return args.folders.length;
  },
});
