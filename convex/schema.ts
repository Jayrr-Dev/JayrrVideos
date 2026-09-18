import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  scenes: defineTable({
    ownerKey: v.string(),
    name: v.string(),
    sceneJson: v.string(),
    updatedAt: v.number(),
  }).index("by_ownerKey", ["ownerKey"]),

  libraries: defineTable({
    ownerKey: v.string(),
    name: v.string(),
    assetCount: v.number(),
    updatedAt: v.number(),
  }).index("by_ownerKey", ["ownerKey"]),

  libraryAssets: defineTable({
    libraryId: v.id("libraries"),
    ownerKey: v.string(),
    name: v.string(),
    itemId: v.string(),
    elementsJson: v.string(),
    filesJson: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_library", ["libraryId"]),
});
