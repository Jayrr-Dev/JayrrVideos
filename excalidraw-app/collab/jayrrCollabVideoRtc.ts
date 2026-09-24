export type SessionDescription = {
  type: RTCSdpType;
  sdp: string;
};

export const normalizeSdp = (sdp: string) => {
  const lines = sdp
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  return `${lines.join("\r\n")}\r\n`;
};

const SESSION_DIRECTION = /^(a=sendrecv|a=sendonly|a=recvonly|a=inactive)$/;

export const sdpForPeer = (sdp: string) => {
  const lines = normalizeSdp(sdp).trimEnd().split("\r\n");
  let seenMedia = false;
  const next: string[] = [];
  for (const line of lines) {
    if (line.startsWith("m=")) {
      seenMedia = true;
    }
    if (!seenMedia && SESSION_DIRECTION.test(line)) {
      continue;
    }
    next.push(line);
  }
  return `${next.join("\r\n")}\r\n`;
};

export const asPeerDescription = (value: {
  type: RTCSdpType;
  sdp: string;
}): RTCSessionDescriptionInit => ({
  type: value.type,
  sdp: sdpForPeer(value.sdp),
});

export const createSfuPeerConnection = () =>
  new RTCPeerConnection({
    bundlePolicy: "max-bundle",
    iceServers: [
      { urls: "stun:stun.cloudflare.com:3478" },
      { urls: "stun:stun.l.google.com:19302" },
    ],
  });

const ICE_WAIT_MS = 5000;

export const waitForIce = async (peer: RTCPeerConnection) => {
  if (peer.iceGatheringState === "complete") {
    return;
  }
  await Promise.race([
    new Promise<void>((resolve) => {
      const onChange = () => {
        if (peer.iceGatheringState !== "complete") {
          return;
        }
        peer.removeEventListener("icegatheringstatechange", onChange);
        resolve();
      };
      peer.addEventListener("icegatheringstatechange", onChange);
    }),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, ICE_WAIT_MS);
    }),
  ]);
};

export const localDescription = (
  peer: RTCPeerConnection,
): SessionDescription => {
  const description = peer.localDescription;
  if (!description?.sdp) {
    throw new Error("The browser did not create SDP");
  }
  return { type: description.type, sdp: sdpForPeer(description.sdp) };
};

export const requiredMid = (transceiver: RTCRtpTransceiver) => {
  if (!transceiver.mid) {
    throw new Error("The browser did not assign a media section identifier");
  }
  return transceiver.mid;
};

export const waitForOutgoingPackets = (
  peer: RTCPeerConnection,
  timeoutMs = 4000,
) =>
  new Promise<void>((resolve) => {
    const started = Date.now();
    const tick = async () => {
      try {
        const stats = await peer.getStats();
        for (const report of stats.values()) {
          if (
            report.type === "outbound-rtp" &&
            "bytesSent" in report &&
            typeof report.bytesSent === "number" &&
            report.bytesSent > 0
          ) {
            resolve();
            return;
          }
        }
      } catch {
        resolve();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve();
        return;
      }
      window.setTimeout(() => {
        void tick();
      }, 200);
    };
    void tick();
  });

export const waitForConnected = (peer: RTCPeerConnection, timeoutMs = 12_000) =>
  new Promise<void>((resolve, reject) => {
    if (peer.connectionState === "connected") {
      resolve();
      return;
    }
    const timeout = window.setTimeout(() => {
      peer.removeEventListener("connectionstatechange", onChange);
      reject(new Error("Camera did not connect to Realtime"));
    }, timeoutMs);
    const onChange = () => {
      if (peer.connectionState === "connected") {
        window.clearTimeout(timeout);
        peer.removeEventListener("connectionstatechange", onChange);
        resolve();
        return;
      }
      if (peer.connectionState === "failed") {
        window.clearTimeout(timeout);
        peer.removeEventListener("connectionstatechange", onChange);
        reject(new Error("Camera connection failed"));
      }
    };
    peer.addEventListener("connectionstatechange", onChange);
  });
