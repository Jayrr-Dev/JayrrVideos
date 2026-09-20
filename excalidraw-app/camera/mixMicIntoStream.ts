type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

export type MixedCapture = {
  stream: MediaStream;
  stop: () => void;
};

const MIC_AUDIO: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

const stopTracks = (stream: MediaStream) => {
  for (const track of stream.getTracks()) {
    track.stop();
  }
};

export const openJayrrMic = async (
  ownerWindow: Window,
  deviceId?: string,
): Promise<MediaStream> => {
  const audio: MediaTrackConstraints = {
    ...MIC_AUDIO,
    channelCount: 1,
  };
  if (deviceId) {
    audio.deviceId = { exact: deviceId };
  }
  const stream = await ownerWindow.navigator.mediaDevices.getUserMedia({
    audio,
    video: false,
  });
  const live = stream
    .getAudioTracks()
    .some((track) => track.readyState === "live" && !track.muted);
  if (live) {
    return stream;
  }
  await new Promise<void>((resolve) => {
    const tracks = stream.getAudioTracks();
    const done = () => {
      ownerWindow.clearTimeout(timer);
      for (const track of tracks) {
        track.removeEventListener("unmute", done);
      }
      resolve();
    };
    const timer = ownerWindow.setTimeout(done, 1200);
    for (const track of tracks) {
      track.addEventListener("unmute", done);
    }
  });
  return stream;
};

/**
 * Fold the user's microphone into a display/tab capture.
 * Window shares on Windows usually have no audio; this keeps the speaker in
 * the same stream as any tab/system sound.
 */
export const mixMicIntoStream = async (
  display: MediaStream,
  ownerWindow: Window = window,
  audioOnly = false,
  deviceId?: string | null,
): Promise<MixedCapture> => {
  if (deviceId === null) {
    return { stream: display, stop: () => undefined };
  }
  let mic: MediaStream | null = null;
  try {
    mic = await openJayrrMic(ownerWindow, deviceId || undefined);
  } catch {
    return { stream: display, stop: () => undefined };
  }

  const view = ownerWindow as AudioWindow;
  const Context = view.AudioContext ?? view.webkitAudioContext;
  if (!Context) {
    const combined = new MediaStream([
      ...(audioOnly ? [] : display.getTracks()),
      ...mic.getAudioTracks(),
    ]);
    const held = mic;
    return {
      stream: combined,
      stop: () => stopTracks(held),
    };
  }

  const context = new Context();
  const dest = context.createMediaStreamDestination();
  const displayAudio = display
    .getAudioTracks()
    .filter((track) => track.enabled);
  if (displayAudio.length > 0) {
    context
      .createMediaStreamSource(new MediaStream(displayAudio))
      .connect(dest);
  }
  context.createMediaStreamSource(mic).connect(dest);

  const mixed = new MediaStream([
    ...(audioOnly ? [] : display.getVideoTracks()),
    ...dest.stream.getAudioTracks(),
  ]);
  const heldMic = mic;
  return {
    stream: mixed,
    stop: () => {
      stopTracks(heldMic);
      for (const track of display.getAudioTracks()) {
        if (!mixed.getTracks().includes(track)) {
          track.stop();
        }
      }
      void context.close();
    },
  };
};
