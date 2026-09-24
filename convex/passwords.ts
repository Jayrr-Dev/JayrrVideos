import {
  createAccount,
  modifyAccountCredentials,
} from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internalAction } from "./_generated/server";

const normalizeUsername = (username: string) => {
  const trimmed = username.trim();
  if (!trimmed) {
    throw new Error("Username is required");
  }
  return trimmed;
};

const requirePassword = (password: string) => {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
};

export const createUser = internalAction({
  args: {
    username: v.string(),
    password: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const username = normalizeUsername(args.username);
    requirePassword(args.password);
    const id = username.toLowerCase();
    await createAccount(ctx, {
      provider: "password",
      account: {
        id,
        secret: args.password,
      },
      profile: {
        email: id,
        name: username,
      },
    });
    return null;
  },
});

export const setPassword = internalAction({
  args: {
    username: v.string(),
    password: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const username = normalizeUsername(args.username);
    requirePassword(args.password);
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
