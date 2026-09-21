import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const MAX_NAME_LENGTH = 80;

const folderDoc = v.object({
  _id: v.id("editorProjectFolders"),
  name: v.string(),
  projectCount: v.number(),
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
  folderId: Id<"editorProjectFolders">,
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
      .query("editorProjectFolders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return rows
      .map((row) => ({
        _id: row._id,
        name: row.name,
        projectCount: row.projectCount,
        updatedAt: row.updatedAt,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const get = query({
  args: {
    folderId: v.id("editorProjectFolders"),
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
      projectCount: folder.projectCount,
      updatedAt: folder.updatedAt,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
  },
  returns: v.id("editorProjectFolders"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const name = normalizeName(args.name);
    return await ctx.db.insert("editorProjectFolders", {
      userId: user._id,
      name,
      projectCount: 0,
      updatedAt: Date.now(),
    });
  },
});

export const rename = mutation({
  args: {
    folderId: v.id("editorProjectFolders"),
    name: v.string(),
  },
  returns: v.id("editorProjectFolders"),
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
    folderId: v.id("editorProjectFolders"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const folder = await getOwnedFolder(ctx, args.folderId, user._id);
    const projects = await ctx.db
      .query("editorProjects")
      .withIndex("by_folder_and_updated", (q) => q.eq("folderId", folder._id))
      .collect();
    for (const project of projects) {
      await ctx.db.patch(project._id, { folderId: undefined });
    }
    await ctx.db.delete(folder._id);
    return null;
  },
});
