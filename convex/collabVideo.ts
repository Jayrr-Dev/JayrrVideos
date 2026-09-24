import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { action, mutation, query } from "./_generated/server";

import { getCurrentUser } from "./lib/auth";

const ROOM_ID = /^[a-zA-Z0-9_-]{8,64}$/;
const TRACK_NAME = /^[a-zA-Z0-9._:-]{1,64}$/;

const sdpDescription = v.object({
  type: v.union(
    v.literal("offer"),
    v.literal("answer"),
    v.literal("pranswer"),
    v.literal("rollback"),
  ),
  sdp: v.string(),
});

const publishedTrack = v.object({
  kind: v.union(v.literal("audio"), v.literal("video")),
  trackName: v.string(),
});

const publication = v.object({
  userId: v.id("users"),
  clientId: v.string(),
  displayName: v.string(),
  sessionId: v.string(),
  tracks: v.array(publishedTrack),
});

const trackResult = v.object({
  mid: v.optional(v.string()),
  sessionId: v.optional(v.string()),
  trackName: v.optional(v.string()),
  errorCode: v.optional(v.string()),
  errorDescription: v.optional(v.string()),
});

const tracksCallResult = v.object({
  sessionId: v.string(),
  requiresImmediateRenegotiation: v.boolean(),
  sessionDescription: v.optional(sdpDescription),
  tracks: v.array(trackResult),
});

const requireRoomId = (roomId: string) => {
  if (!ROOM_ID.test(roomId)) {
    throw new Error("Invalid collaboration room");
  }
  return roomId;
};

const requireSessionId = (sessionId: string) => {
  const trimmed = sessionId.trim();
  if (trimmed.length < 4 || trimmed.length > 256) {
    throw new Error("Invalid Realtime session");
  }
  return trimmed;
};

const requireTrackName = (trackName: string) => {
  if (!TRACK_NAME.test(trackName)) {
    throw new Error("Invalid track name");
  }
  return trackName;
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

const asSdpText = (value: unknown) =>
  typeof value === "string" && value.includes("v=") ? value : "";

const SDP_TYPES = ["offer", "answer", "pranswer", "rollback"] as const;
type SdpType = typeof SDP_TYPES[number];

const isSdpType = (value: string): value is SdpType =>
  SDP_TYPES.some((type) => type === value);

const readSdp = (value: unknown) => {
  const object = asObject(value);
  if (!object) {
    return null;
  }
  const type = asString(object.type);
  const sdp = asSdpText(object.sdp);
  if (!isSdpType(type) || !sdp) {
    return null;
  }
  return { type, sdp };
};

const sfuErrorMessage = (payload: unknown, fallback: string) => {
  const object = asObject(payload);
  if (!object) {
    return fallback;
  }
  const description = asString(object.errorDescription);
  if (description) {
    return description;
  }
  const code = asString(object.errorCode);
  if (code) {
    return code;
  }
  return fallback;
};

const sfuRequest = async (
  path: string,
  method: "POST" | "PUT",
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const appId = process.env.REALTIME_SFU_APP_ID?.trim();
  const token = process.env.REALTIME_SFU_BEARER_TOKEN?.trim();
  if (!appId || !token) {
    throw new Error("Cloudflare Realtime is not configured on Convex");
  }
  const response = await fetch(
    `https://rtc.live.cloudflare.com/v1/apps/${encodeURIComponent(
      appId,
    )}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      sfuErrorMessage(
        payload,
        `Realtime SFU rejected the request (${response.status})`,
      ),
    );
  }
  const object = asObject(payload);
  if (!object) {
    throw new Error("Realtime SFU returned an unreadable response");
  }
  if (asString(object.errorCode) || asString(object.errorDescription)) {
    throw new Error(
      sfuErrorMessage(object, "Realtime SFU could not complete the operation"),
    );
  }
  return object;
};

const createSfuSession = async () => {
  const payload = await sfuRequest("/sessions/new", "POST");
  return requireSessionId(asString(payload.sessionId));
};

const parseTrackResults = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }
  const tracks: Array<{
    mid?: string;
    sessionId?: string;
    trackName?: string;
    errorCode?: string;
    errorDescription?: string;
  }> = [];
  for (const item of value) {
    const object = asObject(item);
    if (!object) {
      continue;
    }
    const mid = asString(object.mid) || undefined;
    const sessionId = asString(object.sessionId) || undefined;
    const trackName = asString(object.trackName) || undefined;
    const errorCode = asString(object.errorCode) || undefined;
    const errorDescription = asString(object.errorDescription) || undefined;
    tracks.push({ mid, sessionId, trackName, errorCode, errorDescription });
  }
  return tracks;
};

const assertTracksOk = (
  tracks: Array<{ errorCode?: string; errorDescription?: string }>,
  operation: string,
) => {
  for (const track of tracks) {
    if (track.errorCode || track.errorDescription) {
      throw new Error(
        track.errorDescription ||
          track.errorCode ||
          `Realtime SFU ${operation} failed for a track`,
      );
    }
  }
};

export const listRoom = query({
  args: { roomId: v.string() },
  returns: v.array(publication),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const roomId = requireRoomId(args.roomId);
    const rows = await ctx.db
      .query("collabVideoPubs")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    return rows.map((row) => ({
      userId: row.userId,
      clientId: row.clientId,
      displayName: row.displayName,
      sessionId: row.sessionId,
      tracks: row.tracks,
    }));
  },
});

export const recordPublication = mutation({
  args: {
    roomId: v.string(),
    clientId: v.string(),
    sessionId: v.string(),
    tracks: v.array(publishedTrack),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const roomId = requireRoomId(args.roomId);
    const clientId = args.clientId.trim();
    if (clientId.length < 8 || clientId.length > 80) {
      throw new Error("Invalid phone client");
    }
    const existing = await ctx.db
      .query("collabVideoPubs")
      .withIndex("by_room_and_client", (q) =>
        q.eq("roomId", roomId).eq("clientId", clientId),
      )
      .unique();
    const fields = {
      roomId,
      userId: user._id,
      clientId,
      displayName: (user.name ?? user.email ?? "Guest").trim() || "Guest",
      sessionId: requireSessionId(args.sessionId),
      tracks: args.tracks,
      updatedAt: Date.now(),
    };
    if (existing) {
      if (existing.userId !== user._id) {
        throw new Error("Unauthorized");
      }
      await ctx.db.replace(existing._id, fields);
      return null;
    }
    await ctx.db.insert("collabVideoPubs", fields);
    return null;
  },
});

export const leaveRoom = mutation({
  args: { roomId: v.string(), clientId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const roomId = requireRoomId(args.roomId);
    const clientId = args.clientId.trim();
    const existing = await ctx.db
      .query("collabVideoPubs")
      .withIndex("by_room_and_client", (q) =>
        q.eq("roomId", roomId).eq("clientId", clientId),
      )
      .unique();
    if (existing && existing.userId === user._id) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

export const createSession = action({
  args: {},
  returns: v.object({ sessionId: v.string() }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const sessionId = await createSfuSession();
    return { sessionId };
  },
});

export const publishTracks = action({
  args: {
    roomId: v.string(),
    sessionDescription: sdpDescription,
    tracks: v.array(
      v.object({
        kind: v.union(v.literal("audio"), v.literal("video")),
        mid: v.string(),
        trackName: v.string(),
      }),
    ),
  },
  returns: tracksCallResult,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    requireRoomId(args.roomId);
    if (args.tracks.length === 0) {
      throw new Error("No camera tracks to publish");
    }
    const sessionId = await createSfuSession();
    const payload = await sfuRequest(
      `/sessions/${encodeURIComponent(sessionId)}/tracks/new`,
      "POST",
      {
        sessionDescription: args.sessionDescription,
        tracks: args.tracks.map((track) => ({
          location: "local",
          mid: track.mid,
          trackName: requireTrackName(track.trackName),
        })),
      },
    );
    const tracks = parseTrackResults(payload.tracks);
    assertTracksOk(tracks, "publish");
    const sessionDescription = readSdp(payload.sessionDescription);
    if (!sessionDescription) {
      throw new Error("Realtime SFU did not return an answer");
    }
    return {
      sessionId,
      requiresImmediateRenegotiation:
        payload.requiresImmediateRenegotiation === true,
      sessionDescription,
      tracks,
    };
  },
});

export const subscribeTracks = action({
  args: {
    sessionId: v.optional(v.string()),
    tracks: v.array(
      v.object({
        sessionId: v.string(),
        trackName: v.string(),
      }),
    ),
  },
  returns: tracksCallResult,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (args.tracks.length === 0) {
      if (!args.sessionId) {
        throw new Error("Invalid Realtime session");
      }
      return {
        sessionId: requireSessionId(args.sessionId),
        requiresImmediateRenegotiation: false,
        tracks: [],
      };
    }
    const sessionId = args.sessionId
      ? requireSessionId(args.sessionId)
      : await createSfuSession();
    const payload = await sfuRequest(
      `/sessions/${encodeURIComponent(sessionId)}/tracks/new`,
      "POST",
      {
        tracks: args.tracks.map((track) => ({
          location: "remote",
          sessionId: requireSessionId(track.sessionId),
          trackName: requireTrackName(track.trackName),
        })),
      },
    );
    const tracks = parseTrackResults(payload.tracks);
    return {
      sessionId,
      requiresImmediateRenegotiation:
        payload.requiresImmediateRenegotiation === true,
      sessionDescription: readSdp(payload.sessionDescription) ?? undefined,
      tracks,
    };
  },
});

export const renegotiate = action({
  args: {
    sessionId: v.string(),
    sessionDescription: sdpDescription,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const sessionId = requireSessionId(args.sessionId);
    await sfuRequest(
      `/sessions/${encodeURIComponent(sessionId)}/renegotiate`,
      "PUT",
      { sessionDescription: args.sessionDescription },
    );
    return null;
  },
});
