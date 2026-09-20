import { getAuthUserId } from "@convex-dev/auth/server";

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}

export const isJayrrUser = (user: Doc<"users">) => {
  const label = (user.email ?? user.name ?? "").trim().toLowerCase();
  return label === "jayrr";
};
