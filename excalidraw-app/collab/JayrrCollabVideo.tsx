import { useConvexAuth, useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { JAYRR_PHONE_SELF } from "../camera/jayrrCamera";
import { api, isConvexLinked } from "../convexClient";
import { getCollaborationLinkData } from "../data";

import {
  createSfuPeerConnection,
  asPeerDescription,
  localDescription,
  requiredMid,
  waitForConnected,
  waitForIce,
} from "./jayrrCollabVideoRtc";
import {
  clearJayrrPhoneRemotes,
  getJayrrPhoneClientId,
  getJayrrPhoneSelfWanted,
  setJayrrPhoneError,
  setJayrrPhoneLocal,
  setJayrrPhonePeople,
  setJayrrPhoneRemote,
  subscribeJayrrPhone,
} from "./jayrrCollabVideoSession";

type TrackMeta = {
  userId: string;
  displayName: string;
  key: string;
};

const readRoomId = () =>
  getCollaborationLinkData(window.location.href)?.roomId ?? null;

const trackError = (error: unknown) =>
  error instanceof Error ? error.message : "Camera sharing failed";

export const JayrrCollabVideo = ({
  isCollaborating,
}: {
  isCollaborating: boolean;
}) => {
  const { isAuthenticated } = useConvexAuth();
  const [roomId, setRoomId] = useState(readRoomId);
  const [sharing, setSharing] = useState(false);
  const [wanted, setWanted] = useState(getJayrrPhoneSelfWanted);
  const [retry, setRetry] = useState(0);
  const producerRef = useRef<RTCPeerConnection | null>(null);
  const consumerRef = useRef<RTCPeerConnection | null>(null);
  const consumerSessionRef = useRef<string | null>(null);
  const subscribedRef = useRef(new Set<string>());
  const midMapRef = useRef(new Map<string, TrackMeta>());
  const streamsRef = useRef(new Map<string, MediaStream>());
  const subscribeQueueRef = useRef(Promise.resolve());
  const localStreamRef = useRef<MediaStream | null>(null);
  const sharingRef = useRef(sharing);
  const shareLockRef = useRef(false);
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  sharingRef.current = sharing;
  const viewer = useQuery(api.users.viewer);
  const publications = useQuery(
    api.collabVideo.listRoom,
    isConvexLinked && isAuthenticated && isCollaborating && roomId
      ? { roomId }
      : "skip",
  );
  const createSession = useAction(api.collabVideo.createSession);
  const publishTracks = useAction(api.collabVideo.publishTracks);
  const recordPublication = useMutation(api.collabVideo.recordPublication);
  const subscribeTracks = useAction(api.collabVideo.subscribeTracks);
  const renegotiate = useAction(api.collabVideo.renegotiate);
  const leaveRoom = useMutation(api.collabVideo.leaveRoom);

  useEffect(() => {
    const onHash = () => setRoomId(readRoomId());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(
    () =>
      subscribeJayrrPhone(() => {
        setWanted(getJayrrPhoneSelfWanted());
      }),
    [],
  );

  const teardownProducer = useCallback(() => {
    producerRef.current?.close();
    producerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setJayrrPhoneLocal(null);
    setSharing(false);
  }, []);

  const teardownConsumer = useCallback(() => {
    consumerRef.current?.close();
    consumerRef.current = null;
    consumerSessionRef.current = null;
    subscribedRef.current.clear();
    midMapRef.current.clear();
    streamsRef.current.clear();
    clearJayrrPhoneRemotes();
  }, []);

  useEffect(() => {
    if (isCollaborating) {
      return;
    }
    teardownProducer();
    teardownConsumer();
    setJayrrPhonePeople([{ userId: JAYRR_PHONE_SELF, label: "You" }]);
  }, [isCollaborating, teardownConsumer, teardownProducer]);

  useEffect(
    () => () => {
      const activeRoomId = roomIdRef.current;
      if (activeRoomId && sharingRef.current) {
        void leaveRoom({
          roomId: activeRoomId,
          clientId: getJayrrPhoneClientId(),
        });
      }
    },
    [leaveRoom],
  );

  const attachRemoteTrack = useCallback((event: RTCTrackEvent) => {
    const mid = event.transceiver.mid;
    const meta = mid ? midMapRef.current.get(mid) : undefined;
    if (!meta) {
      return;
    }
    let stream = streamsRef.current.get(meta.userId);
    if (!stream) {
      stream = new MediaStream();
      streamsRef.current.set(meta.userId, stream);
    }
    if (!stream.getTracks().some((track) => track.id === event.track.id)) {
      stream.addTrack(event.track);
    }
    setJayrrPhoneRemote(meta.userId, stream);
  }, []);

  useEffect(() => {
    const clientId = getJayrrPhoneClientId();
    const others =
      publications
        ?.filter((publication) => publication.clientId !== clientId)
        .map((publication) => ({
          userId: publication.clientId,
          label:
            publication.userId === viewer?._id
              ? "Other device"
              : publication.displayName || "Phone",
        })) ?? [];
    setJayrrPhonePeople([
      { userId: JAYRR_PHONE_SELF, label: "You" },
      ...others,
    ]);
  }, [publications, viewer]);

  useEffect(() => {
    if (!isCollaborating || !roomId || !viewer || !publications) {
      return;
    }
    const clientId = getJayrrPhoneClientId();
    const desired = publications.flatMap((publication) => {
      if (publication.clientId === clientId) {
        return [];
      }
      return publication.tracks.map((track) => ({
        key: `${publication.sessionId}:${track.trackName}`,
        sessionId: publication.sessionId,
        trackName: track.trackName,
        userId: publication.clientId,
        displayName:
          publication.userId === viewer._id
            ? "Other device"
            : publication.displayName,
      }));
    });
    const liveUsers = new Set(desired.map((track) => track.userId));
    for (const userId of [...streamsRef.current.keys()]) {
      if (!liveUsers.has(userId)) {
        streamsRef.current.delete(userId);
        setJayrrPhoneRemote(userId, null);
      }
    }
    const pending = desired.filter(
      (track) => !subscribedRef.current.has(track.key),
    );
    if (pending.length === 0) {
      return;
    }
    subscribeQueueRef.current = subscribeQueueRef.current.then(async () => {
      try {
        let consumer = consumerRef.current;
        let sessionId = consumerSessionRef.current;
        if (!consumer || !sessionId) {
          consumer = createSfuPeerConnection();
          consumer.addEventListener("track", attachRemoteTrack);
          consumerRef.current = consumer;
          sessionId = (await createSession()).sessionId;
          consumerSessionRef.current = sessionId;
        }
        const stillPending = pending.filter(
          (track) => !subscribedRef.current.has(track.key),
        );
        if (stillPending.length === 0) {
          return;
        }
        const result = await subscribeTracks({
          sessionId,
          tracks: stillPending.map((track) => ({
            sessionId: track.sessionId,
            trackName: track.trackName,
          })),
        });
        result.tracks.forEach((track, index) => {
          const requested = stillPending[index];
          if (track.mid && requested) {
            midMapRef.current.set(track.mid, {
              userId: requested.userId,
              displayName: requested.displayName,
              key: requested.key,
            });
          }
        });
        if (
          result.requiresImmediateRenegotiation &&
          result.sessionDescription
        ) {
          await consumer.setRemoteDescription(
            asPeerDescription(result.sessionDescription),
          );
          const answer = await consumer.createAnswer();
          await consumer.setLocalDescription(answer);
          await waitForIce(consumer);
          await renegotiate({
            sessionId,
            sessionDescription: localDescription(consumer),
          });
          await waitForConnected(consumer);
        }
        for (const track of stillPending) {
          subscribedRef.current.add(track.key);
        }
      } catch (caught) {
        consumerRef.current?.close();
        consumerRef.current = null;
        consumerSessionRef.current = null;
        subscribedRef.current.clear();
        setJayrrPhoneError(trackError(caught));
        window.setTimeout(() => {
          setRetry((value) => value + 1);
        }, 1200);
      }
    });
  }, [
    attachRemoteTrack,
    createSession,
    isCollaborating,
    publications,
    renegotiate,
    roomId,
    subscribeTracks,
    viewer,
    retry,
  ]);

  const share = useCallback(async () => {
    if (!roomId || shareLockRef.current || sharingRef.current) {
      return;
    }
    shareLockRef.current = true;
    setJayrrPhoneError(null);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      }
      const producer = createSfuPeerConnection();
      producerRef.current = producer;
      const sessionId = (await createSession()).sessionId;
      const offerTracks = stream.getTracks().map((track) => {
        const transceiver = producer.addTransceiver(track, {
          direction: "sendonly",
        });
        return {
          kind:
            track.kind === "audio" ? ("audio" as const) : ("video" as const),
          trackName: track.kind === "audio" ? "microphone" : "camera",
          transceiver,
        };
      });
      const offer = await producer.createOffer();
      await producer.setLocalDescription(offer);
      const result = await publishTracks({
        roomId,
        sessionId,
        sessionDescription: localDescription(producer),
        tracks: offerTracks.map((track) => ({
          kind: track.kind,
          mid: requiredMid(track.transceiver),
          trackName: track.trackName,
        })),
      });
      if (!result.sessionDescription) {
        throw new Error("Realtime SFU did not return an answer");
      }
      await producer.setRemoteDescription(
        asPeerDescription(result.sessionDescription),
      );
      await waitForConnected(producer);
      await recordPublication({
        roomId,
        clientId: getJayrrPhoneClientId(),
        sessionId,
        tracks: offerTracks.map((track) => ({
          kind: track.kind,
          trackName: track.trackName,
        })),
      });
      localStreamRef.current = stream;
      setJayrrPhoneLocal(stream);
      setSharing(true);
    } catch (caught) {
      teardownProducer();
      setJayrrPhoneError(trackError(caught));
    } finally {
      shareLockRef.current = false;
    }
  }, [
    createSession,
    publishTracks,
    recordPublication,
    roomId,
    teardownProducer,
  ]);

  const stop = useCallback(async () => {
    teardownProducer();
    if (!roomId) {
      return;
    }
    try {
      await leaveRoom({
        roomId,
        clientId: getJayrrPhoneClientId(),
      });
    } catch (caught) {
      setJayrrPhoneError(trackError(caught));
    }
  }, [leaveRoom, roomId, teardownProducer]);

  useEffect(() => {
    if (!isCollaborating || !roomId) {
      return;
    }
    if (wanted && !sharing) {
      void share();
    }
    if (!wanted && sharing) {
      void stop();
    }
  }, [isCollaborating, roomId, share, sharing, stop, wanted]);

  return null;
};
