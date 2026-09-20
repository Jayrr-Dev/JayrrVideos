import { modifyAccountCredentials } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internalAction } from "./_generated/server";

export const setPassword = internalAction({
  args: {
    username: v.string(),
    password: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const username = args.username.trim();
    if (!username) {
      throw new Error("Username is required");
    }
    if (args.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: {
        id: username.toLowerCase(),
        secret: args.password,
      },
    });
    return null;
  },
});
