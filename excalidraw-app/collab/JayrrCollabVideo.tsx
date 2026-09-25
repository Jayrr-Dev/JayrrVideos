import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { JAYRR_PHONE_SELF } from "../camera/jayrrCamera";
import { api, isConvexLinked } from "../convexClient";
import { getCollaborationLinkData } from "../data";

import {
  asPeerDescription,
  createSfuPeerConnection,
  localDescription,
  requiredMid,
  waitForConnected,
  waitForIce,
  waitForOutgoingPackets,
} from "./jayrrCollabVideoRtc";
import {
  clearJayrrPhoneRemotes,
  getJayrrPhoneClientId,
  getJayrrPhoneSelfWanted,
  getJayrrScreenGeneration,
  getJayrrScreenSelfWanted,
  jayrrScreenClientId,
  peekJayrrPhoneStream,
  peekJayrrScreenStream,
  readJayrrScreenClientId,
  setJayrrPhoneError,
  setJayrrPhoneLocal,
  setJayrrPhonePeople,
  setJayrrPhoneRemote,
  setJayrrScreenLocal,
  setJayrrScreenRemote,
  subscribeJayrrPhone,
} from "./jayrrCollabVideoSession";

type TrackMeta = {
  userId: string;
  displayName: string;
  key: string;
  channel: "phone" | "screen";
};

const streamKey = (channel: TrackMeta["channel"], userId: string) =>
  `${channel}:${userId}`;

const readRoomId = () =>
  getCollaborationLinkData(window.location.href)?.roomId ?? null;

const trackError = (error: unknown) =>
  error instanceof Error ? error.message : "Camera sharing failed";

export const JayrrCollabVideo = ({
  isCollaborating,
}: {
  isCollaborating: boolean;
}) => {
  const [roomId, setRoomId] = useState(readRoomId);
  const [sharing, setSharing] = useState(false);
  const [wanted, setWanted] = useState(getJayrrPhoneSelfWanted);
  const [retry, setRetry] = useState(0);
  const [shareAttempt, setShareAttempt] = useState(0);
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenWanted, setScreenWanted] = useState(getJayrrScreenSelfWanted);
  const [screenAttempt, setScreenAttempt] = useState(0);
  const [screenGeneration, setScreenGeneration] = useState(
    getJayrrScreenGeneration,
  );
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
  const ownsTracksRef = useRef(false);
  const wantedRef = useRef(wanted);
  const screenProducerRef = useRef<RTCPeerConnection | null>(null);
  const screenSharingRef = useRef(screenSharing);
  const screenWantedRef = useRef(screenWanted);
  const screenLockRef = useRef(false);
  const screenRestartRef = useRef(Promise.resolve());
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  sharingRef.current = sharing;
  wantedRef.current = wanted;
  screenSharingRef.current = screenSharing;
  screenWantedRef.current = screenWanted;
  const viewer = useQuery(api.users.viewer);
  const publications = useQuery(
    api.collabVideo.listRoom,
    isConvexLinked && isCollaborating && roomId ? { roomId } : "skip",
  );
  const publishTracks = useAction(api.collabVideo.publishTracks);
  const recordPublication = useMutation(api.collabVideo.recordPublication);
  const subscribeTracks = useAction(api.collabVideo.subscribeTracks);
  const renegotiate = useAction(api.collabVideo.renegotiate);
  const leaveRoom = useMutation(api.collabVideo.leaveRoom);

  useEffect(() => {
    const syncRoom = () => setRoomId(readRoomId());
    syncRoom();
    window.addEventListener("hashchange", syncRoom);
    window.addEventListener("popstate", syncRoom);
    return () => {
      window.removeEventListener("hashchange", syncRoom);
      window.removeEventListener("popstate", syncRoom);
    };
  }, [isCollaborating]);

  useEffect(
    () =>
      subscribeJayrrPhone(() => {
        setWanted(getJayrrPhoneSelfWanted());
        setScreenWanted(getJayrrScreenSelfWanted());
        setScreenGeneration(getJayrrScreenGeneration());
      }),
    [],
  );

  const teardownProducer = useCallback(() => {
    producerRef.current?.close();
    producerRef.current = null;
    if (ownsTracksRef.current) {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      setJayrrPhoneLocal(null);
    }
    ownsTracksRef.current = false;
    localStreamRef.current = null;
    setSharing(false);
  }, []);

  const closeScreenProducer = useCallback(() => {
    screenProducerRef.current?.close();
    screenProducerRef.current = null;
    setScreenSharing(false);
  }, []);

  const teardownScreen = useCallback(() => {
    closeScreenProducer();
    peekJayrrScreenStream(JAYRR_PHONE_SELF)
      ?.getTracks()
      .forEach((track) => track.stop());
    setJayrrScreenLocal(null);
  }, [closeScreenProducer]);

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
    teardownScreen();
    teardownConsumer();
    setJayrrPhonePeople([{ userId: getJayrrPhoneClientId(), label: "On" }]);
  }, [isCollaborating, teardownConsumer, teardownProducer, teardownScreen]);

  useEffect(
    () => () => {
      const activeRoomId = roomIdRef.current;
      if (activeRoomId && sharingRef.current) {
        void leaveRoom({
          roomId: activeRoomId,
          clientId: getJayrrPhoneClientId(),
        });
      }
      if (activeRoomId && screenSharingRef.current) {
        void leaveRoom({
          roomId: activeRoomId,
          clientId: jayrrScreenClientId(getJayrrPhoneClientId()),
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
    const key = streamKey(meta.channel, meta.userId);
    let stream = streamsRef.current.get(key);
    if (!stream) {
      stream = new MediaStream();
      streamsRef.current.set(key, stream);
    }
    if (!stream.getTracks().some((track) => track.id === event.track.id)) {
      stream.addTrack(event.track);
    }
    if (meta.channel === "screen") {
      setJayrrScreenRemote(meta.userId, stream);
      return;
    }
    setJayrrPhoneRemote(meta.userId, stream);
  }, []);

  useEffect(() => {
    const clientId = getJayrrPhoneClientId();
    const others =
      publications
        ?.filter(
          (publication) =>
            publication.clientId !== clientId &&
            !readJayrrScreenClientId(publication.clientId),
        )
        .map((publication) => ({
          userId: publication.clientId,
          label:
            publication.userId === viewer?._id
              ? "Other device"
              : publication.displayName || "Phone",
        })) ?? [];
    setJayrrPhonePeople([
      { userId: getJayrrPhoneClientId(), label: "On" },
      ...others,
    ]);
  }, [publications, viewer]);

  useEffect(() => {
    if (!isCollaborating || !roomId || !publications) {
      return;
    }
    const clientId = getJayrrPhoneClientId();
    const screenClientId = jayrrScreenClientId(clientId);
    const desired = publications.flatMap((publication) => {
      if (
        publication.clientId === clientId ||
        publication.clientId === screenClientId
      ) {
        return [];
      }
      const screenOwner = readJayrrScreenClientId(publication.clientId);
      const channel = screenOwner ? "screen" : "phone";
      const userId = screenOwner ?? publication.clientId;
      return publication.tracks.map((track) => ({
        key: `${publication.sessionId}:${track.trackName}`,
        sessionId: publication.sessionId,
        trackName: track.trackName,
        userId,
        channel,
        displayName:
          viewer && publication.userId === viewer._id
            ? "Other device"
            : publication.displayName,
      }));
    });
    const liveKeys = new Set(
      desired.map((track) => streamKey(track.channel, track.userId)),
    );
    for (const key of [...streamsRef.current.keys()]) {
      if (liveKeys.has(key)) {
        continue;
      }
      streamsRef.current.delete(key);
      const splitAt = key.indexOf(":");
      const channel = key.slice(0, splitAt);
      const userId = key.slice(splitAt + 1);
      if (channel === "screen") {
        setJayrrScreenRemote(userId, null);
      } else {
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
        if (!consumer) {
          consumer = createSfuPeerConnection();
          consumer.addEventListener("track", attachRemoteTrack);
          consumerRef.current = consumer;
        }
        const stillPending = pending.filter(
          (track) => !subscribedRef.current.has(track.key),
        );
        if (stillPending.length === 0) {
          return;
        }
        const result = await subscribeTracks({
          roomId,
          ...(sessionId ? { sessionId } : {}),
          tracks: stillPending.map((track) => ({
            sessionId: track.sessionId,
            trackName: track.trackName,
          })),
        });
        consumerSessionRef.current = result.sessionId;
        sessionId = result.sessionId;
        const failed: string[] = [];
        result.tracks.forEach((track, index) => {
          const requested = stillPending[index];
          if (!requested) {
            return;
          }
          if (track.errorCode || track.errorDescription) {
            failed.push(track.errorDescription || track.errorCode || "");
            return;
          }
          if (!track.mid) {
            failed.push("Missing media section");
            return;
          }
          midMapRef.current.set(track.mid, {
            userId: requested.userId,
            displayName: requested.displayName,
            key: requested.key,
            channel: requested.channel,
          });
          subscribedRef.current.add(requested.key);
        });
        if (result.sessionDescription) {
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
        if (failed.length > 0) {
          if (
            failed.length === stillPending.length &&
            !result.sessionDescription
          ) {
            consumerSessionRef.current = null;
          }
          window.setTimeout(() => {
            setRetry((value) => value + 1);
          }, 2000);
        }
      } catch (caught) {
        consumerRef.current?.close();
        consumerRef.current = null;
        consumerSessionRef.current = null;
        subscribedRef.current.clear();
        setJayrrPhoneError(trackError(caught));
        window.setTimeout(() => {
          setRetry((value) => value + 1);
        }, 2000);
      }
    });
  }, [
    attachRemoteTrack,
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
    const clientId = getJayrrPhoneClientId();
    try {
      const reusable = peekJayrrPhoneStream(JAYRR_PHONE_SELF);
      const reusableLive = reusable?.getVideoTracks().some((track) => {
        return track.readyState === "live";
      });
      let stream: MediaStream;
      if (reusable && reusableLive) {
        stream = reusable;
        ownsTracksRef.current = false;
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch (caught) {
          if (
            caught instanceof DOMException &&
            (caught.name === "NotAllowedError" ||
              caught.name === "NotFoundError")
          ) {
            throw caught;
          }
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
        }
        ownsTracksRef.current = true;
        setJayrrPhoneLocal(stream);
      }
      localStreamRef.current = stream;
      const producer = createSfuPeerConnection();
      producerRef.current = producer;
      const offerTracks = stream.getTracks().map((track) => {
        const transceiver = producer.addTransceiver(track, {
          direction: "sendonly",
        });
        return {
          kind:
            track.kind === "audio" ? ("audio" as const) : ("video" as const),
          trackName:
            track.kind === "audio"
              ? `${clientId}.microphone`
              : `${clientId}.camera`,
          transceiver,
        };
      });
      const offer = await producer.createOffer();
      await producer.setLocalDescription(offer);
      await waitForIce(producer);
      const result = await publishTracks({
        roomId,
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
      await waitForOutgoingPackets(producer);
      await recordPublication({
        roomId,
        clientId: getJayrrPhoneClientId(),
        sessionId: result.sessionId,
        tracks: offerTracks.map((track) => ({
          kind: track.kind,
          trackName: track.trackName,
        })),
      });
      setSharing(true);
    } catch (caught) {
      teardownProducer();
      setJayrrPhoneError(trackError(caught));
      const denied =
        caught instanceof DOMException &&
        (caught.name === "NotAllowedError" || caught.name === "NotFoundError");
      if (!denied) {
        window.setTimeout(() => {
          if (wantedRef.current) {
            setShareAttempt((value) => value + 1);
          }
        }, 2000);
      }
    } finally {
      shareLockRef.current = false;
    }
  }, [publishTracks, recordPublication, roomId, teardownProducer]);

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
  }, [isCollaborating, roomId, share, shareAttempt, sharing, stop, wanted]);

  const shareScreen = useCallback(async () => {
    if (!roomId || screenLockRef.current || screenSharingRef.current) {
      return;
    }
    const stream = peekJayrrScreenStream(JAYRR_PHONE_SELF);
    const live = stream?.getVideoTracks().some((track) => {
      return track.readyState === "live";
    });
    if (!stream || !live) {
      window.setTimeout(() => {
        if (screenWantedRef.current) {
          setScreenAttempt((value) => value + 1);
        }
      }, 300);
      return;
    }
    await screenRestartRef.current;
    if (!roomId || screenLockRef.current || screenSharingRef.current) {
      return;
    }
    screenLockRef.current = true;
    const clientId = getJayrrPhoneClientId();
    try {
      const producer = createSfuPeerConnection();
      screenProducerRef.current = producer;
      const offerTracks = stream.getTracks().map((track) => {
        const transceiver = producer.addTransceiver(track, {
          direction: "sendonly",
        });
        return {
          kind:
            track.kind === "audio" ? ("audio" as const) : ("video" as const),
          trackName:
            track.kind === "audio"
              ? `${clientId}.screen-audio`
              : `${clientId}.screen`,
          transceiver,
        };
      });
      const offer = await producer.createOffer();
      await producer.setLocalDescription(offer);
      await waitForIce(producer);
      const result = await publishTracks({
        roomId,
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
      await waitForOutgoingPackets(producer);
      await recordPublication({
        roomId,
        clientId: jayrrScreenClientId(clientId),
        sessionId: result.sessionId,
        tracks: offerTracks.map((track) => ({
          kind: track.kind,
          trackName: track.trackName,
        })),
      });
      setScreenSharing(true);
    } catch (caught) {
      screenProducerRef.current?.close();
      screenProducerRef.current = null;
      setScreenSharing(false);
      setJayrrPhoneError(trackError(caught));
      window.setTimeout(() => {
        if (screenWantedRef.current) {
          setScreenAttempt((value) => value + 1);
        }
      }, 2000);
    } finally {
      screenLockRef.current = false;
    }
  }, [publishTracks, recordPublication, roomId]);

  const stopScreen = useCallback(async () => {
    teardownScreen();
    if (!roomId) {
      return;
    }
    try {
      await leaveRoom({
        roomId,
        clientId: jayrrScreenClientId(getJayrrPhoneClientId()),
      });
    } catch (caught) {
      setJayrrPhoneError(trackError(caught));
    }
  }, [leaveRoom, roomId, teardownScreen]);

  useEffect(() => {
    if (!screenSharingRef.current) {
      return;
    }
    closeScreenProducer();
    if (!roomId) {
      screenRestartRef.current = Promise.resolve();
      return;
    }
    screenRestartRef.current = leaveRoom({
      roomId,
      clientId: jayrrScreenClientId(getJayrrPhoneClientId()),
    }).then(
      () => undefined,
      () => undefined,
    );
  }, [closeScreenProducer, leaveRoom, roomId, screenGeneration]);

  useEffect(() => {
    if (!isCollaborating || !roomId) {
      return;
    }
    if (screenWanted && !screenSharing) {
      void shareScreen();
    }
    if (!screenWanted && screenSharing) {
      void stopScreen();
    }
  }, [
    isCollaborating,
    roomId,
    screenAttempt,
    screenSharing,
    screenWanted,
    shareScreen,
    stopScreen,
  ]);

  return null;
};
