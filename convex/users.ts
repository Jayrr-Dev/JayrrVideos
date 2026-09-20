import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";

import { getCurrentUser, isJayrrUser } from "./lib/auth";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const viewerDoc = v.object({
  _id: v.id("users"),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
});

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
    };
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
