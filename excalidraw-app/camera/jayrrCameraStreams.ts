import { mixMicIntoStream } from "./mixMicIntoStream";

import type { JayrrDisplayQuality, JayrrDisplayRate } from "./jayrrCamera";

export type DisplayTune = {
  quality?: JayrrDisplayQuality;
  frameRate?: JayrrDisplayRate;
};

const QUALITY_SIZE: Record<
  Exclude<JayrrDisplayQuality, "screen">,
  { width: number; height: number }
> = {
  "1080": { width: 1920, height: 1080 },
  "1440": { width: 2560, height: 1440 },
  "2160": { width: 3840, height: 2160 },
};

const streamListeners = new Set<() => void>();
const disposers = new WeakMap<MediaStream, () => void>();

const notifyStreams = () => {
  for (const listener of streamListeners) {
    listener();
  }
};

export const subscribeJayrrStreams = (listener: () => void) => {
  streamListeners.add(listener);
  return () => {
    streamListeners.delete(listener);
  };
};

type StreamEntry = {
  stream: MediaStream;
  count: number;
};

const cameras = new Map<string, StreamEntry>();
const displays = new Map<string, StreamEntry>();
const cameraPending = new Map<string, Promise<MediaStream>>();
const displayPending = new Map<string, Promise<MediaStream>>();

const stopStream = (stream: MediaStream) => {
  const dispose = disposers.get(stream);
  disposers.delete(stream);
  dispose?.();
  for (const track of stream.getTracks()) {
    track.stop();
  }
};

const withMic = async (display: MediaStream): Promise<MediaStream> => {
  const mixed = await mixMicIntoStream(display);
  if (mixed.stream !== display) {
    disposers.set(mixed.stream, mixed.stop);
    return mixed.stream;
  }
  mixed.stop();
  return display;
};

const limitRate = (wanted: number, max: number | undefined) => {
  if (!max || max <= 0) {
    return wanted;
  }
  return Math.min(wanted, max);
};

export const displayWantedSize = (
  tune: DisplayTune | undefined,
  view?: Window,
  caps?: MediaTrackCapabilities,
) => {
  const quality = tune?.quality ?? "screen";
  const frameRate = limitRate(tune?.frameRate ?? 30, caps?.frameRate?.max);
  if (quality !== "screen") {
    const preset = QUALITY_SIZE[quality];
    return { width: preset.width, height: preset.height, frameRate };
  }
  const win = view ?? globalThis.window;
  const dpr = win?.devicePixelRatio || 1;
  const physicalW = win ? Math.round(win.screen.width * dpr) : 0;
  const physicalH = win ? Math.round(win.screen.height * dpr) : 0;
  const capW = caps?.width?.max ?? 0;
  const capH = caps?.height?.max ?? 0;
  return {
    width: Math.max(physicalW, capW, 1920),
    height: Math.max(physicalH, capH, 1080),
    frameRate,
  };
};

const withResize = (
  resizeMode: "none" | "crop-and-scale",
  video: MediaTrackConstraints,
): MediaTrackConstraints => ({ ...video, resizeMode } as MediaTrackConstraints);

/**
 * Screen capture cannot grow past the real surface, and it must keep that
 * surface's shape. `resizeMode: "none"` keeps every device pixel. A width
 * cap downscales without forcing a 16:9 box the window may not have.
 * https://www.w3.org/TR/screen-capture/#downscaling-and-frame-decimation
 */
const displayVideoConstraints = (
  tune: DisplayTune | undefined,
  caps?: MediaTrackCapabilities,
): MediaTrackConstraints => {
  const quality = tune?.quality ?? "screen";
  const frameRate = limitRate(tune?.frameRate ?? 30, caps?.frameRate?.max);
  const rate = { ideal: frameRate, max: frameRate };
  if (quality === "screen") {
    return withResize("none", { frameRate: rate });
  }
  const preset = QUALITY_SIZE[quality];
  return withResize("crop-and-scale", {
    width: { ideal: preset.width, max: preset.width },
    frameRate: rate,
  });
};

const sharpenDisplayTrack = async (stream: MediaStream, tune?: DisplayTune) => {
  const track = stream.getVideoTracks()[0];
  if (!track) {
    return;
  }
  track.contentHint = "detail";
  const video = displayVideoConstraints(tune, track.getCapabilities?.());
  const size: MediaTrackConstraints = { ...video };
  delete size.frameRate;
  const attempts = [video, size];
  for (const next of attempts) {
    try {
      await track.applyConstraints(next);
      return;
    } catch {
      // The screen rejected this cap. Try without the frame rate.
    }
  }
};

const acquire = async (
  store: Map<string, StreamEntry>,
  pending: Map<string, Promise<MediaStream>>,
  key: string,
  create: () => Promise<MediaStream>,
): Promise<MediaStream> => {
  const existing = store.get(key);
  if (existing) {
    existing.count += 1;
    return existing.stream;
  }

  let wait = pending.get(key);
  if (!wait) {
    wait = create()
      .then((stream) => {
        const current = store.get(key);
        if (current) {
          stopStream(stream);
          return current.stream;
        }
        const entry: StreamEntry = { stream, count: 0 };
        const drop = () => {
          const live = store.get(key);
          if (!live || live.stream !== stream) {
            return;
          }
          store.delete(key);
          notifyStreams();
          stopStream(stream);
        };
        for (const track of stream.getTracks()) {
          track.addEventListener("ended", drop);
        }
        store.set(key, entry);
        notifyStreams();
        return stream;
      })
      .finally(() => {
        if (pending.get(key) === wait) {
          pending.delete(key);
        }
      });
    pending.set(key, wait);
  }

  const stream = await wait;
  const entry = store.get(key);
  if (!entry || entry.stream !== stream) {
    throw new Error("Camera stream was interrupted.");
  }
  entry.count += 1;
  return stream;
};

const release = (
  store: Map<string, StreamEntry>,
  key: string,
  stream: MediaStream,
) => {
  const existing = store.get(key);
  if (!existing || existing.stream !== stream) {
    return;
  }
  existing.count -= 1;
  if (existing.count > 0) {
    return;
  }
  store.delete(key);
  notifyStreams();
  stopStream(existing.stream);
};

export const acquireJayrrCamera = (deviceId: string): Promise<MediaStream> =>
  acquire(cameras, cameraPending, deviceId, () =>
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video:
        !deviceId || deviceId === "default"
          ? true
          : { deviceId: { exact: deviceId } },
    }),
  );

export const releaseJayrrCamera = (deviceId: string, stream: MediaStream) => {
  release(cameras, deviceId, stream);
};

type DisplaySurface = "monitor" | "window" | "browser";

type DisplayMediaOptions = DisplayMediaStreamOptions & {
  surfaceSwitching?: "include" | "exclude";
  systemAudio?: "include" | "exclude";
  monitorTypeSurfaces?: "include" | "exclude";
  selfBrowserSurface?: "include" | "exclude";
  preferCurrentTab?: boolean;
};

export const acquireJayrrDisplay = (
  elementId: string,
  surface?: DisplaySurface,
  tune?: DisplayTune,
): Promise<MediaStream> => {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    return Promise.reject(
      new Error("Desktop sharing is not available in this browser."),
    );
  }
  return acquire(displays, displayPending, elementId, () => {
    const video = displayVideoConstraints(tune);
    if (surface) {
      video.displaySurface = surface;
    }
    const options: DisplayMediaOptions = {
      audio: true,
      video,
      surfaceSwitching: "include",
      systemAudio: "include",
      monitorTypeSurfaces: "include",
      selfBrowserSurface: "exclude",
    };
    return navigator.mediaDevices
      .getDisplayMedia(options)
      .then(async (stream) => {
        await sharpenDisplayTrack(stream, tune);
        return withMic(stream);
      });
  });
};

const tabs = new Map<string, StreamEntry>();
const tabPending = new Map<string, Promise<MediaStream>>();

export const acquireJayrrTabAudio = (
  elementId: string,
): Promise<MediaStream> => {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    return Promise.reject(
      new Error("Desktop sharing is not available in this browser."),
    );
  }
  return acquire(tabs, tabPending, elementId, () => {
    const options: DisplayMediaOptions = {
      // Keep YouTube/tab sound intact. Mixing a mic through Web Audio, or
      // leaving echo cancellation on, makes Chrome capture silence.
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        suppressLocalAudioPlayback: false,
      } as MediaTrackConstraints,
      video: true,
      preferCurrentTab: true,
      systemAudio: "include",
      selfBrowserSurface: "include",
      surfaceSwitching: "exclude",
    };
    return navigator.mediaDevices.getDisplayMedia(options);
  });
};

export const releaseJayrrTabAudio = (
  elementId: string,
  stream: MediaStream,
) => {
  release(tabs, elementId, stream);
};

export const peekJayrrDisplayStream = (elementId: string): MediaStream | null =>
  displays.get(elementId)?.stream ?? null;

export const tuneJayrrDisplay = async (
  elementId: string,
  tune: DisplayTune,
) => {
  const stream = displays.get(elementId)?.stream;
  if (!stream) {
    return;
  }
  await sharpenDisplayTrack(stream, tune);
};

export const listJayrrDisplayStreams = (): ReadonlyArray<{
  id: string;
  stream: MediaStream;
}> =>
  [...displays.entries()].map(([id, entry]) => ({
    id,
    stream: entry.stream,
  }));

export const releaseJayrrDisplay = (elementId: string, stream: MediaStream) => {
  release(displays, elementId, stream);
};

export const stopJayrrDisplay = (elementId: string) => {
  const existing = displays.get(elementId);
  if (!existing) {
    return;
  }
  displays.delete(elementId);
  notifyStreams();
  stopStream(existing.stream);
};

const listDevicesOfKind = async (
  kind: MediaDeviceKind,
): Promise<MediaDeviceInfo[]> => {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === kind && device.deviceId);
};

export const listJayrrCameras = async (): Promise<MediaDeviceInfo[]> =>
  listDevicesOfKind("videoinput");

export const listJayrrMics = async (): Promise<MediaDeviceInfo[]> =>
  listDevicesOfKind("audioinput");

const namedCameras = (devices: MediaDeviceInfo[]) =>
  devices.filter((device) => device.label);

export const unlockJayrrCameras = async (): Promise<MediaDeviceInfo[]> => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera is not available in this browser.");
  }
  const listed = await listJayrrCameras();
  if (namedCameras(listed).length > 0 || cameras.size > 0) {
    return listed;
  }
  const probe = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: true,
  });
  stopStream(probe);
  return listJayrrCameras();
};

const namedMics = (devices: MediaDeviceInfo[]) =>
  devices.filter((device) => device.label);

export const unlockJayrrMics = async (
  ownerWindow: Window = window,
): Promise<MediaDeviceInfo[]> => {
  const media = ownerWindow.navigator.mediaDevices;
  if (!media?.getUserMedia) {
    throw new Error("Microphone is not available in this browser.");
  }
  const listed = await listJayrrMics();
  if (namedMics(listed).length > 0) {
    return listed;
  }
  const probe = await media.getUserMedia({
    audio: true,
    video: false,
  });
  stopStream(probe);
  return listJayrrMics();
};
