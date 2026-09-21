import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const MAX_NAME_LENGTH = 80;
const MAX_PAYLOAD_BYTES = 400_000;

const projectSummary = v.object({
  _id: v.id("editorProjects"),
  folderId: v.union(v.id("editorProjectFolders"), v.null()),
  name: v.string(),
  durationMs: v.number(),
  clipCount: v.number(),
  updatedAt: v.number(),
});

const projectDoc = v.object({
  _id: v.id("editorProjects"),
  folderId: v.union(v.id("editorProjectFolders"), v.null()),
  name: v.string(),
  clipsJson: v.string(),
  stackLanesJson: v.string(),
  stateJson: v.union(v.string(), v.null()),
  durationMs: v.number(),
  clipCount: v.number(),
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

const requirePayload = (
  clipsJson: string,
  stackLanesJson: string,
  stateJson?: string,
) => {
  if (!clipsJson) {
    throw new Error("Project is empty");
  }
  const extra = stateJson?.length ?? 0;
  if (clipsJson.length + stackLanesJson.length + extra > MAX_PAYLOAD_BYTES) {
    throw new Error("Project is too large to save.");
  }
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

const getOwnedProject = async (
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"editorProjects">,
  userId: Id<"users">,
) => {
  const project = await ctx.db.get(projectId);
  if (!project || project.userId !== userId) {
    throw new Error("Project not found");
  }
  return project;
};

const bumpFolderCount = async (
  ctx: MutationCtx,
  folderId: Id<"editorProjectFolders"> | undefined,
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
    projectCount: Math.max(0, folder.projectCount + delta),
    updatedAt: Date.now(),
  });
};

const mapSummary = (row: {
  _id: Id<"editorProjects">;
  folderId?: Id<"editorProjectFolders">;
  name: string;
  durationMs: number;
  clipCount: number;
  updatedAt: number;
}) => ({
  _id: row._id,
  folderId: row.folderId ?? null,
  name: row.name,
  durationMs: row.durationMs,
  clipCount: row.clipCount,
  updatedAt: row.updatedAt,
});

export const list = query({
  args: {
    folderId: v.optional(v.union(v.id("editorProjectFolders"), v.null())),
  },
  returns: v.array(projectSummary),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.userId !== user._id) {
        return [];
      }
      const rows = await ctx.db
        .query("editorProjects")
        .withIndex("by_folder_and_updated", (q) =>
          q.eq("folderId", args.folderId!),
        )
        .order("desc")
        .take(40);
      return rows.map(mapSummary);
    }

    const rows = await ctx.db
      .query("editorProjects")
      .withIndex("by_user_and_updated", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(80);
    return rows
      .filter((row) => !row.folderId)
      .slice(0, 40)
      .map(mapSummary);
  },
});

export const get = query({
  args: {
    projectId: v.id("editorProjects"),
  },
  returns: v.union(projectDoc, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return null;
    }
    return {
      _id: project._id,
      folderId: project.folderId ?? null,
      name: project.name,
      clipsJson: project.clipsJson,
      stackLanesJson: project.stackLanesJson,
      stateJson: project.stateJson ?? null,
      durationMs: project.durationMs,
      clipCount: project.clipCount,
      updatedAt: project.updatedAt,
    };
  },
});

export const save = mutation({
  args: {
    name: v.string(),
    folderId: v.optional(v.id("editorProjectFolders")),
    clipsJson: v.string(),
    stackLanesJson: v.string(),
    stateJson: v.optional(v.string()),
    durationMs: v.number(),
    clipCount: v.number(),
  },
  returns: v.id("editorProjects"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    requirePayload(args.clipsJson, args.stackLanesJson, args.stateJson);
    let folderId: Id<"editorProjectFolders"> | undefined;
    if (args.folderId) {
      const folder = await getOwnedFolder(ctx, args.folderId, user._id);
      folderId = folder._id;
    }
    const projectId = await ctx.db.insert("editorProjects", {
      userId: user._id,
      folderId,
      name: normalizeName(args.name),
      clipsJson: args.clipsJson,
      stackLanesJson: args.stackLanesJson,
      ...(args.stateJson ? { stateJson: args.stateJson } : {}),
      durationMs: Math.max(0, Math.round(args.durationMs)),
      clipCount: Math.max(0, Math.round(args.clipCount)),
      updatedAt: Date.now(),
    });
    await bumpFolderCount(ctx, folderId, 1);
    return projectId;
  },
});

export const rename = mutation({
  args: {
    projectId: v.id("editorProjects"),
    name: v.string(),
  },
  returns: v.id("editorProjects"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const project = await getOwnedProject(ctx, args.projectId, user._id);
    await ctx.db.patch(project._id, {
      name: normalizeName(args.name),
      updatedAt: Date.now(),
    });
    return project._id;
  },
});

export const move = mutation({
  args: {
    projectId: v.id("editorProjects"),
    folderId: v.union(v.id("editorProjectFolders"), v.null()),
  },
  returns: v.id("editorProjects"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const project = await getOwnedProject(ctx, args.projectId, user._id);
    let nextFolderId: Id<"editorProjectFolders"> | undefined;
    if (args.folderId) {
      const folder = await getOwnedFolder(ctx, args.folderId, user._id);
      nextFolderId = folder._id;
    }
    const prevFolderId = project.folderId;
    if (prevFolderId === nextFolderId) {
      return project._id;
    }
    await ctx.db.patch(project._id, {
      folderId: nextFolderId,
      updatedAt: Date.now(),
    });
    await bumpFolderCount(ctx, prevFolderId, -1);
    await bumpFolderCount(ctx, nextFolderId, 1);
    return project._id;
  },
});

export const remove = mutation({
  args: {
    projectId: v.id("editorProjects"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const project = await getOwnedProject(ctx, args.projectId, user._id);
    await bumpFolderCount(ctx, project.folderId, -1);
    await ctx.db.delete(project._id);
    return null;
  },
});
