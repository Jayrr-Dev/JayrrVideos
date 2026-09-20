import { v } from "convex/values";

import { query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";

const folderRow = v.object({
  path: v.string(),
  name: v.string(),
  parent: v.string(),
  count: v.number(),
});

export const tree = query({
  args: {},
  returns: v.array(folderRow),
  handler: async (ctx) => {
    await getCurrentUser(ctx);
    const rows = await ctx.db.query("soundFolders").collect();
    return rows.map((row) => ({
      path: row.path,
      name: row.name,
      parent: row.parent,
      count: row.count,
    }));
  },
});
