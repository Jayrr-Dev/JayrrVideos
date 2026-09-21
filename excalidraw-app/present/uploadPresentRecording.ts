import { put } from "@vercel/blob/client";

import { appJotaiStore } from "../app-jotai";
import { api, convexClient } from "../convexClient";
import { activeSceneIdAtom } from "../data/jayrrScenes";

import { capturePresentPoster } from "./capturePresentPoster";
import { getOpenRecordingFolderId } from "./openRecordingFolder";

import type { Id } from "../../convex/_generated/dataModel";

export const uploadPresentRecording = async (
  file: Blob,
  durationMs: number,
  width: number,
  height: number,
  opts?: {
    name?: string;
    folderId?: Id<"presentRecordingFolders"> | null;
  },
) => {
  if (!convexClient) {
    throw new Error("Convex is not linked");
  }
  const ext = file.type.includes("mp4") ? "mp4" : "webm";
  const { token, pathname } = await convexClient.action(
    api.presentBlob.createUploadToken,
    { pathname: `recording.${ext}` },
  );
  const blob = await put(pathname, file, {
    access: "public",
    token,
    multipart: true,
    contentType: file.type || "video/webm",
  });
  let posterPathname: string | undefined;
  let posterUrl: string | undefined;
  const poster = await capturePresentPoster(file);
  if (poster) {
    try {
      const posterToken = await convexClient.action(
        api.presentBlob.createPosterToken,
        { pathname: "poster.jpg" },
      );
      const posterBlob = await put(posterToken.pathname, poster, {
        access: "public",
        token: posterToken.token,
        contentType: "image/jpeg",
      });
      posterPathname = posterBlob.pathname;
      posterUrl = posterBlob.url;
    } catch (error) {
      console.error("Could not save recording poster", error);
    }
  }
  const sceneId = appJotaiStore.get(activeSceneIdAtom);
  const folderId =
    opts && "folderId" in opts ? opts.folderId : getOpenRecordingFolderId();
  await convexClient.mutation(api.presentRecordings.save, {
    sceneId: sceneId ?? undefined,
    folderId: folderId ?? undefined,
    name: opts?.name,
    pathname: blob.pathname,
    url: blob.url,
    downloadUrl: blob.downloadUrl,
    mimeType: blob.contentType || file.type || "video/webm",
    durationMs,
    sizeBytes: file.size,
    posterPathname,
    posterUrl,
    width: width > 0 ? width : undefined,
    height: height > 0 ? height : undefined,
  });
  return blob.url;
};
