import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  sceneFolders: defineTable({
    ownerKey: v.string(),
    userId: v.optional(v.id("users")),
    name: v.string(),
    sceneCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerKey", ["ownerKey"])
    .index("by_userId", ["userId"]),

  scenes: defineTable({
    ownerKey: v.string(),
    userId: v.optional(v.id("users")),
    folderId: v.optional(v.id("sceneFolders")),
    name: v.string(),
    sceneJson: v.string(),
    previewDataUrl: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_ownerKey", ["ownerKey"])
    .index("by_userId", ["userId"])
    .index("by_folder", ["folderId"]),

  libraries: defineTable({
    ownerKey: v.string(),
    userId: v.optional(v.id("users")),
    name: v.string(),
    assetCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerKey", ["ownerKey"])
    .index("by_userId", ["userId"]),

  libraryAssets: defineTable({
    libraryId: v.id("libraries"),
    ownerKey: v.string(),
    userId: v.optional(v.id("users")),
    name: v.string(),
    itemId: v.string(),
    elementsJson: v.string(),
    filesJson: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_library", ["libraryId"])
    .index("by_userId", ["userId"]),

  sounds: defineTable({
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
    search: v.string(),
    storageId: v.optional(v.id("_storage")),
  })
    .index("by_path", ["path"])
    .index("by_folderPath", ["folderPath"])
    .index("by_category", ["category"])
    .searchIndex("search_sounds", {
      searchField: "search",
      filterFields: ["category"],
    }),

  soundFolders: defineTable({
    path: v.string(),
    name: v.string(),
    parent: v.string(),
    count: v.number(),
  })
    .index("by_path", ["path"])
    .index("by_parent", ["parent"]),

  presentRecordingFolders: defineTable({
    userId: v.id("users"),
    name: v.string(),
    recordingCount: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  presentRecordings: defineTable({
    userId: v.id("users"),
    folderId: v.optional(v.id("presentRecordingFolders")),
    sceneId: v.optional(v.id("scenes")),
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
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_created", ["userId", "createdAt"])
    .index("by_folder_and_created", ["folderId", "createdAt"]),
});
