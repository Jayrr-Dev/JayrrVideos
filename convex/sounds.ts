import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { query } from "./_generated/server";

import { getCurrentUser } from "./lib/auth";

import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

const inFolderRoute = (folderPath: string, folder: string) => {
  return folderPath === folder || folderPath.startsWith(`${folder}/`);
};

const soundRow = v.object({
  _id: v.id("sounds"),
  path: v.string(),
  name: v.string(),
  folders: v.array(v.string()),
  folderPath: v.string(),
  ext: v.string(),
  durationSec: v.number(),
  sampleRate: v.number(),
  centroidHz: v.number(),
  url: v.union(v.string(), v.null()),
});

const toSoundRow = async (ctx: QueryCtx, row: Doc<"sounds">) => {
  const url = row.storageId ? await ctx.storage.getUrl(row.storageId) : null;
  return {
    _id: row._id,
    path: row.path,
    name: row.name,
    folders: row.folders,
    folderPath: row.folderPath,
    ext: row.ext,
    durationSec: row.durationSec,
    sampleRate: row.sampleRate,
    centroidHz: row.centroidHz,
    url,
  };
};

export const get = query({
  args: { soundId: v.id("sounds") },
  returns: v.union(soundRow, v.null()),
  handler: async (ctx, args) => {
    await getCurrentUser(ctx);
    const row = await ctx.db.get(args.soundId);
    if (!row) {
      return null;
    }
    return toSoundRow(ctx, row);
  },
});

export const list = query({
  args: {
    folder: v.string(),
    search: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(soundRow),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await getCurrentUser(ctx);
    const search = args.search.trim();
    const folder = args.folder;

    if (search) {
      const results = await ctx.db
        .query("sounds")
        .withSearchIndex("search_sounds", (idx) => idx.search("search", search))
        .paginate(args.paginationOpts);

      const mapped = await Promise.all(
        results.page.map((row) => toSoundRow(ctx, row)),
      );

      if (!folder) {
        return {
          page: mapped,
          isDone: results.isDone,
          continueCursor: results.continueCursor,
        };
      }

      const firstPage = args.paginationOpts.cursor == null;
      if (!firstPage) {
        return {
          page: mapped.filter((row) => !inFolderRoute(row.folderPath, folder)),
          isDone: results.isDone,
          continueCursor: results.continueCursor,
        };
      }

      const category = folder.split("/")[0] ?? "";
      const routeHits = await ctx.db
        .query("sounds")
        .withSearchIndex("search_sounds", (idx) => {
          const searched = idx.search("search", search);
          if (category) {
            return searched.eq("category", category);
          }
          return searched;
        })
        .take(args.paginationOpts.numItems);
      const prioritized = routeHits.filter((row) =>
        inFolderRoute(row.folderPath, folder),
      );
      const seen = new Set(prioritized.map((row) => row.path));
      const pageRows = [
        ...prioritized,
        ...results.page.filter((row) => !seen.has(row.path)),
      ];
      return {
        page: await Promise.all(pageRows.map((row) => toSoundRow(ctx, row))),
        isDone: results.isDone,
        continueCursor: results.continueCursor,
      };
    }

    const indexed = folder
      ? ctx.db
          .query("sounds")
          .withIndex("by_path", (q) =>
            q.gte("path", `${folder}/`).lt("path", `${folder}/\uffff`),
          )
      : ctx.db.query("sounds").withIndex("by_path");

    const results = await indexed.order("asc").paginate(args.paginationOpts);
    return {
      page: await Promise.all(results.page.map((row) => toSoundRow(ctx, row))),
      isDone: results.isDone,
      continueCursor: results.continueCursor,
    };
  },
});
