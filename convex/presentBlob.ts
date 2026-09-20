"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { del } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const MAX_BYTES = 5 * 1024 * 1024 * 1024;

const fileNameOf = (pathname: string) => {
  const base = pathname.split("/").pop() ?? "";
  return base.replace(/[^a-zA-Z0-9._-]/g, "");
};

export const createUploadToken = action({
  args: {
    pathname: v.string(),
  },
  returns: v.object({
    token: v.string(),
    pathname: v.string(),
  }),
  handler: async (ctx, args): Promise<{ token: string; pathname: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      throw new Error(
        "Vercel Blob is not configured. Set BLOB_READ_WRITE_TOKEN on Convex.",
      );
    }
    const fileName = fileNameOf(args.pathname);
    if (!fileName.endsWith(".webm") && !fileName.endsWith(".mp4")) {
      throw new Error("Unsupported recording type");
    }
    const pathname = `present/${userId}/${fileName}`;
    const token = await generateClientTokenFromReadWriteToken({
      pathname,
      token: blobToken,
      allowedContentTypes: [
        "video/webm",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
      ],
      maximumSizeInBytes: MAX_BYTES,
      addRandomSuffix: true,
    });
    return { token, pathname };
  },
});

export const createPosterToken = action({
  args: {
    pathname: v.string(),
  },
  returns: v.object({
    token: v.string(),
    pathname: v.string(),
  }),
  handler: async (ctx, args): Promise<{ token: string; pathname: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      throw new Error(
        "Vercel Blob is not configured. Set BLOB_READ_WRITE_TOKEN on Convex.",
      );
    }
    const fileName = fileNameOf(args.pathname);
    if (!fileName.endsWith(".jpg") && !fileName.endsWith(".jpeg")) {
      throw new Error("Unsupported poster type");
    }
    const pathname = `present/${userId}/${fileName}`;
    const token = await generateClientTokenFromReadWriteToken({
      pathname,
      token: blobToken,
      allowedContentTypes: ["image/jpeg"],
      maximumSizeInBytes: 2 * 1024 * 1024,
      addRandomSuffix: true,
    });
    return { token, pathname };
  },
});

export const removeRecording = action({
  args: {
    recordingId: v.id("presentRecordings"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const row = await ctx.runQuery(internal.presentRecordings.getOwned, {
      recordingId: args.recordingId,
      userId,
    });
    if (!row) {
      throw new Error("Recording not found");
    }
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (blobToken) {
      const urls = row.posterUrl ? [row.url, row.posterUrl] : [row.url];
      try {
        await del(urls, { token: blobToken });
      } catch (error) {
        console.error("Could not delete recording blob", error);
      }
    }
    await ctx.runMutation(internal.presentRecordings.removeOwned, {
      recordingId: args.recordingId,
      userId,
    });
    return null;
  },
});
