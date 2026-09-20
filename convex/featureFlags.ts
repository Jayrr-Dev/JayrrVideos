import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";

const FLAG_VALUES: Record<string, readonly string[]> = {
  cameraCutout: ["off", "mediapipe", "segmo"],
};

const flagDoc = v.object({
  key: v.string(),
  value: v.string(),
});

export const list = query({
  args: {},
  returns: v.array(flagDoc),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const rows = await ctx.db
      .query("featureFlags")
      .withIndex("by_user_and_key", (q) => q.eq("userId", userId))
      .collect();
    return rows.map((row) => ({
      key: row.key,
      value: row.value,
    }));
  },
});

export const set = mutation({
  args: {
    key: v.string(),
    value: v.string(),
  },
  returns: flagDoc,
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const allowed = FLAG_VALUES[args.key];
    if (!allowed) {
      throw new Error("Unknown feature flag");
    }
    if (!allowed.includes(args.value)) {
      throw new Error("Invalid feature flag value");
    }
    const existing = await ctx.db
      .query("featureFlags")
      .withIndex("by_user_and_key", (q) =>
        q.eq("userId", user._id).eq("key", args.key),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("featureFlags", {
        userId: user._id,
        key: args.key,
        value: args.value,
        updatedAt: Date.now(),
      });
    }
    return { key: args.key, value: args.value };
  },
});
