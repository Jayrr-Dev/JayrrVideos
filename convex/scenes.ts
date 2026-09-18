import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const sceneState = v.union(
  v.object({
    _id: v.id("scenes"),
    name: v.string(),
    sceneJson: v.string(),
    updatedAt: v.number(),
  }),
  v.null(),
);

export const getMine = query({
  args: { ownerKey: v.string() },
  returns: sceneState,
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("scenes")
      .withIndex("by_ownerKey", (q) => q.eq("ownerKey", args.ownerKey))
      .unique();
    if (!doc) {
      return null;
    }
    return {
      _id: doc._id,
      name: doc.name,
      sceneJson: doc.sceneJson,
      updatedAt: doc.updatedAt,
    };
  },
});

export const upsertMine = mutation({
  args: {
    ownerKey: v.string(),
    name: v.string(),
    sceneJson: v.string(),
  },
  returns: v.id("scenes"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("scenes")
      .withIndex("by_ownerKey", (q) => q.eq("ownerKey", args.ownerKey))
      .unique();
    const updatedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        sceneJson: args.sceneJson,
        updatedAt,
      });
      return existing._id;
    }
    return await ctx.db.insert("scenes", {
      ownerKey: args.ownerKey,
      name: args.name,
      sceneJson: args.sceneJson,
      updatedAt,
    });
  },
});
