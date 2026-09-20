import { v } from "convex/values";

import { query } from "./_generated/server";

export const ping = query({
  args: {},
  returns: v.object({
    ok: v.literal(true),
    app: v.literal("jayrr-videos"),
  }),
  handler: async () => {
    return { ok: true as const, app: "jayrr-videos" as const };
  },
});
