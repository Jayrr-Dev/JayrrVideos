import { mixMicIntoStream } from "../camera/mixMicIntoStream";

import { getPresentMic, PRESENT_MIC_NONE } from "./presentMic";

type Session = {
  pause: () => void;
  resume: () => void;
  stop: () => Promise<{ blob: Blob; width: number; height: number }>;
};

let session: Session | null = null;

const pickMime = () => {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
};

const videoBitrate = (width: number, height: number) => {
  const pixels = Math.max(1, width * height);
  // ~0.22 bits/pixel/frame at 30fps; clamp so 1080p stays sharp and 4K stays sane.
  return Math.min(
    40_000_000,
    Math.max(12_000_000, Math.round(pixels * 30 * 0.22)),
  );
};

const hintDetail = (stream: MediaStream) => {
  for (const track of stream.getVideoTracks()) {
    track.contentHint = "detail";
  }
};

export const startPresentRecording = async (
  container: HTMLElement,
  ownerWindow: Window,
) => {
  if (session) {
    throw new Error("Already recording");
  }
  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser cannot record video");
  }
  const source = container.querySelector(
    "canvas.excalidraw__canvas.static",
  ) as HTMLCanvasElement | null;
  if (!source) {
    throw new Error("Canvas not found");
  }
  const width = source.width;
  const height = source.height;
  if (width < 2 || height < 2) {
    throw new Error("Canvas not ready");
  }

  const raw = source.captureStream(30);
  hintDetail(raw);
  const storedMic = getPresentMic();
  const micId = storedMic === PRESENT_MIC_NONE ? null : storedMic || undefined;
  const mixed = await mixMicIntoStream(raw, ownerWindow, false, micId);
  hintDetail(mixed.stream);
  const mimeType = pickMime();
  const videoBitsPerSecond = videoBitrate(width, height);
  const audioBitsPerSecond = 192_000;
  const recorder = new MediaRecorder(
    mixed.stream,
    mimeType
      ? {
          mimeType,
          videoBitsPerSecond,
          audioBitsPerSecond,
          bitsPerSecond: videoBitsPerSecond + audioBitsPerSecond,
        }
      : {
          videoBitsPerSecond,
          audioBitsPerSecond,
          bitsPerSecond: videoBitsPerSecond + audioBitsPerSecond,
        },
  );
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event: BlobEvent) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };
  recorder.start(1000);
  session = {
    pause: () => {
      if (recorder.state === "recording") {
        recorder.pause();
      }
    },
    resume: () => {
      if (recorder.state === "paused") {
        recorder.resume();
      }
    },
    stop: () =>
      new Promise((resolve, reject) => {
        const finish = () => {
          mixed.stop();
          for (const track of raw.getTracks()) {
            track.stop();
          }
          session = null;
          resolve({
            blob: new Blob(chunks, {
              type: recorder.mimeType || mimeType || "video/webm",
            }),
            width: source.width,
            height: source.height,
          });
        };
        recorder.onerror = () => {
          mixed.stop();
          for (const track of raw.getTracks()) {
            track.stop();
          }
          session = null;
          reject(new Error("Recording failed"));
        };
        recorder.onstop = finish;
        if (recorder.state === "inactive") {
          finish();
          return;
        }
        recorder.stop();
      }),
  };
};

export const pausePresentRecording = () => {
  session?.pause();
};

export const resumePresentRecording = () => {
  session?.resume();
};

export const stopPresentRecording = async () => {
  if (!session) {
    return null;
  }
  return session.stop();
};
