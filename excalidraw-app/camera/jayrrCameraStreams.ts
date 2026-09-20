import { mixMicIntoStream } from "./mixMicIntoStream";

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
): Promise<MediaStream> => {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    return Promise.reject(
      new Error("Desktop sharing is not available in this browser."),
    );
  }
  return acquire(displays, displayPending, elementId, () => {
    const options: DisplayMediaOptions = {
      audio: true,
      video: surface ? { displaySurface: surface } : true,
      surfaceSwitching: "include",
      systemAudio: "include",
      monitorTypeSurfaces: "include",
      selfBrowserSurface: "exclude",
    };
    return navigator.mediaDevices.getDisplayMedia(options).then(withMic);
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
