import {
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const requireNewPassword = (password: string) => {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
};

export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireNewPassword(args.newPassword);
    if (args.newPassword === args.currentPassword) {
      throw new Error("Choose a different password");
    }
    const account = await ctx.runQuery(internal.users.accountForPassword, {});
    if (!account) {
      throw new Error("Not authenticated");
    }
    try {
      await retrieveAccount(ctx, {
        provider: "password",
        account: {
          id: account.accountId,
          secret: args.currentPassword,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("InvalidSecret")) {
        throw new Error("Wrong current password");
      }
      if (message.includes("TooManyFailedAttempts")) {
        throw new Error("Too many tries. Wait a minute and try again.");
      }
      throw new Error("Could not change password");
    }
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: {
        id: account.accountId,
        secret: args.newPassword,
      },
    });
    return null;
  },
});
