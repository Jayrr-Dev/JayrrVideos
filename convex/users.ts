import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

import { getCurrentUser, isJayrrUser } from "./lib/auth";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const viewerDoc = v.object({
  _id: v.id("users"),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  image: v.optional(v.string()),
});

const profileName = v.object({
  name: v.string(),
});

const profileImage = v.object({
  image: v.union(v.string(), v.null()),
});

const accountIdDoc = v.object({
  accountId: v.string(),
});

const normalizeDisplayName = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Name is required");
  }
  if (trimmed.length > 40) {
    throw new Error("Name must be 40 characters or less");
  }
  return trimmed;
};

const profileImageUrl = async (
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
) => {
  if (!user.imageStorageId) {
    return user.image;
  }
  return (await ctx.storage.getUrl(user.imageStorageId)) ?? undefined;
};

const claimResult = v.object({
  claimed: v.number(),
});

const assignAllItems = async (
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<number> => {
  let claimed = 0;
  const scenes = await ctx.db.query("scenes").collect();
  for (const row of scenes) {
    if (row.userId !== userId) {
      await ctx.db.patch(row._id, { userId });
      claimed += 1;
    }
  }
  const libraries = await ctx.db.query("libraries").collect();
  for (const row of libraries) {
    if (row.userId !== userId) {
      await ctx.db.patch(row._id, { userId });
      claimed += 1;
    }
  }
  const assets = await ctx.db.query("libraryAssets").collect();
  for (const row of assets) {
    if (row.userId !== userId) {
      await ctx.db.patch(row._id, { userId });
      claimed += 1;
    }
  }
  return claimed;
};

export const viewer = query({
  args: {},
  returns: v.union(viewerDoc, v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      image: await profileImageUrl(ctx, user),
    };
  },
});

export const updateProfile = mutation({
  args: {
    name: v.string(),
  },
  returns: profileName,
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const name = normalizeDisplayName(args.name);
    await ctx.db.patch(user._id, { name });
    return { name };
  },
});

export const generatePhotoUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await getCurrentUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setPhoto = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  returns: profileImage,
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const image = await ctx.storage.getUrl(args.storageId);
    if (!image) {
      throw new Error("Could not save photo");
    }
    if (user.imageStorageId && user.imageStorageId !== args.storageId) {
      await ctx.storage.delete(user.imageStorageId);
    }
    await ctx.db.patch(user._id, {
      image,
      imageStorageId: args.storageId,
    });
    return { image };
  },
});

export const clearPhoto = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user.imageStorageId) {
      await ctx.storage.delete(user.imageStorageId);
    }
    await ctx.db.patch(user._id, {
      image: undefined,
      imageStorageId: undefined,
    });
    return null;
  },
});

export const accountForPassword = internalQuery({
  args: {},
  returns: v.union(accountIdDoc, v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    const accountId = (user?.email ?? "").trim().toLowerCase();
    if (!accountId) {
      return null;
    }
    return { accountId };
  },
});

export const claimLegacyItems = mutation({
  args: {},
  returns: claimResult,
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!isJayrrUser(user)) {
      return { claimed: 0 };
    }
    const claimed = await assignAllItems(ctx, user._id);
    return { claimed };
  },
});

export const resetJayrrAuth = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const jayrrUsers = users.filter((user) => isJayrrUser(user));
    const jayrrIds = new Set(jayrrUsers.map((user) => user._id));
    const sessions = await ctx.db.query("authSessions").collect();
    const jayrrSessions = sessions.filter((session) =>
      jayrrIds.has(session.userId),
    );
    const sessionIds = new Set(jayrrSessions.map((session) => session._id));
    const tokens = await ctx.db.query("authRefreshTokens").collect();
    for (const token of tokens) {
      if (sessionIds.has(token.sessionId)) {
        await ctx.db.delete(token._id);
      }
    }
    for (const session of jayrrSessions) {
      await ctx.db.delete(session._id);
    }
    const accounts = await ctx.db.query("authAccounts").collect();
    for (const account of accounts) {
      if (
        jayrrIds.has(account.userId) ||
        account.providerAccountId.toLowerCase() === "jayrr"
      ) {
        await ctx.db.delete(account._id);
      }
    }
    for (const user of jayrrUsers) {
      await ctx.db.delete(user._id);
    }
    return null;
  },
});

export const attachAllToJayrr = internalMutation({
  args: {},
  returns: claimResult,
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const jayrr = users.find((user) => isJayrrUser(user));
    if (!jayrr) {
      throw new Error("Jayrr user not found");
    }
    const claimed = await assignAllItems(ctx, jayrr._id);
    return { claimed };
  },
});
