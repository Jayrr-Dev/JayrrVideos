import {
  findEditorPreviewLayers,
  getEditorPreviewAudio,
  getEditorPreviewSounds,
  setEditorPreviewAudio,
  type EditorPreviewLayers,
} from "./editorPreviewModel";

type CaptureMedia = HTMLMediaElement & {
  captureStream?: (frameRate?: number) => MediaStream;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

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
  return Math.min(
    24_000_000,
    Math.max(4_000_000, Math.round(pixels * 30 * 0.18)),
  );
};

const visibleVideo = (video: HTMLVideoElement | null | undefined) => {
  if (!video) {
    return false;
  }
  if (!video.classList.contains("is-on")) {
    return false;
  }
  return video.readyState >= 2 && video.videoWidth > 1;
};

const layerOpacity = (node: HTMLElement) => {
  const raw = node.style.getPropertyValue("--jayrr-layer-opacity");
  const value = Number.parseFloat(raw);
  if (Number.isFinite(value)) {
    return value;
  }
  return 1;
};

const mirrorVideo = (video: HTMLVideoElement) => {
  const capMedia = video as CaptureMedia;
  if (typeof capMedia.captureStream !== "function") {
    return { source: video, stop: () => undefined };
  }
  let cap: MediaStream;
  try {
    cap = capMedia.captureStream();
  } catch {
    return { source: video, stop: () => undefined };
  }
  const mirror = video.ownerDocument.createElement("video");
  mirror.muted = true;
  mirror.playsInline = true;
  mirror.srcObject = cap;
  void mirror.play().catch(() => undefined);
  return {
    source: mirror,
    stop: () => {
      mirror.pause();
      mirror.srcObject = null;
      for (const track of cap.getTracks()) {
        track.stop();
      }
    },
  };
};

const startVisualCapture = (
  layers: EditorPreviewLayers,
  embed: HTMLElement,
  ownerWindow: Window,
) => {
  const canvas = embed.ownerDocument.createElement("canvas");
  const cssW = Math.max(2, embed.clientWidth || 560);
  const cssH = Math.max(2, embed.clientHeight || 315);
  const scale = Math.min(1920 / cssW, 1080 / cssH, 2);
  canvas.width = Math.max(2, Math.round(cssW * scale));
  canvas.height = Math.max(2, Math.round(cssH * scale));
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;opacity:0;pointer-events:none;z-index:12";
  embed.appendChild(canvas);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    canvas.remove();
    throw new Error("Could not start video export");
  }
  const videos = [layers.base, layers.baseAlt, ...layers.stacks].filter(
    (item): item is HTMLVideoElement => Boolean(item),
  );
  const mirrors = videos.map((video) => ({
    video,
    mirror: mirrorVideo(video),
  }));
  const paint = (video: HTMLVideoElement, source: HTMLVideoElement) => {
    if (!visibleVideo(video)) {
      return;
    }
    const frame =
      source.readyState >= 2 && source.videoWidth > 1 ? source : video;
    if (frame.readyState < 2 || frame.videoWidth < 2) {
      return;
    }
    context.save();
    context.globalAlpha = layerOpacity(video);
    const blend = video.style.mixBlendMode;
    if (blend && blend !== "normal") {
      try {
        context.globalCompositeOperation = blend as GlobalCompositeOperation;
      } catch {
        context.globalCompositeOperation = "source-over";
      }
    }
    context.drawImage(frame, 0, 0, canvas.width, canvas.height);
    context.restore();
  };
  const paintStill = (image: HTMLImageElement | null | undefined) => {
    if (!image) {
      return;
    }
    if (!image.classList.contains("is-on")) {
      return;
    }
    if (image.naturalWidth < 2) {
      return;
    }
    context.save();
    context.globalAlpha = layerOpacity(image);
    const blend = image.style.mixBlendMode;
    if (blend && blend !== "normal") {
      try {
        context.globalCompositeOperation = blend as GlobalCompositeOperation;
      } catch {
        context.globalCompositeOperation = "source-over";
      }
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    context.restore();
  };
  const compositionCaption = (html: string) => {
    const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
    if (title) {
      return title;
    }
    return html.match(/<h1\b[^>]*>([^<]*)<\/h1>/i)?.[1]?.trim() ?? "";
  };
  const paintComposition = (frame: HTMLIFrameElement | null | undefined) => {
    if (!frame || !frame.classList.contains("is-on")) {
      return;
    }
    const caption = compositionCaption(frame.srcdoc || "");
    context.save();
    context.fillStyle = "#0f172a";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (caption) {
      const size = Math.max(28, Math.round(canvas.width * 0.08));
      context.fillStyle = "#f8fafc";
      context.font = `800 ${size}px Nunito, system-ui, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(caption, canvas.width / 2, canvas.height / 2);
    }
    context.restore();
  };
  let raf = 0;
  const draw = () => {
    context.fillStyle = "#0f172a";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (const item of mirrors) {
      paint(item.video, item.mirror.source);
    }
    paintStill(layers.staticBase);
    for (const still of layers.staticStacks ?? []) {
      paintStill(still);
    }
    paintComposition(layers.composition);
    raf = ownerWindow.requestAnimationFrame(draw);
  };
  draw();
  const stream = canvas.captureStream(30);
  return {
    stream,
    width: canvas.width,
    height: canvas.height,
    stop: () => {
      ownerWindow.cancelAnimationFrame(raf);
      for (const item of mirrors) {
        item.mirror.stop();
      }
      for (const track of stream.getTracks()) {
        track.stop();
      }
      canvas.remove();
    },
  };
};

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const mixAudioTracks = (
  videos: readonly HTMLVideoElement[],
  sounds: readonly HTMLAudioElement[],
  ownerWindow: Window,
) => {
  const view = ownerWindow as AudioWindow;
  const AudioCtx = view.AudioContext || view.webkitAudioContext;
  if (!AudioCtx) {
    return { stream: new MediaStream(), stop: () => undefined };
  }
  const context = new AudioCtx();
  const dest = context.createMediaStreamDestination();
  const captured: MediaStream[] = [];
  const connect = (media: CaptureMedia) => {
    if (typeof media.captureStream !== "function") {
      return;
    }
    let cap: MediaStream;
    try {
      cap = media.captureStream();
    } catch {
      return;
    }
    const tracks = cap.getAudioTracks();
    if (tracks.length === 0) {
      for (const track of cap.getTracks()) {
        track.stop();
      }
      return;
    }
    const audioOnly = new MediaStream(tracks);
    captured.push(audioOnly);
    context.createMediaStreamSource(audioOnly).connect(dest);
  };
  for (const video of videos) {
    connect(video);
  }
  for (const sound of sounds) {
    connect(sound);
  }
  void context.resume();
  return {
    stream: dest.stream,
    stop: () => {
      for (const stream of captured) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
      void context.close();
    },
  };
};

const waitUntilDone = async (getTimeMs: () => number, totalMs: number) => {
  const deadline = Date.now() + Math.max(8000, totalMs + 8000);
  let last = getTimeMs();
  let movedAt = Date.now();
  while (Date.now() < deadline) {
    const now = getTimeMs();
    if (now >= totalMs - 40) {
      await sleep(180);
      return;
    }
    if (now > last + 15) {
      last = now;
      movedAt = Date.now();
    } else if (Date.now() - movedAt > 7000) {
      throw new Error("Playback did not start. Place a preview and try again.");
    }
    await sleep(80);
  }
  throw new Error("Export timed out");
};

export const waitForEditorPreviewLayers = async (
  previewElementId: string,
  ownerDocument: Document,
) => {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const layers = findEditorPreviewLayers(previewElementId, ownerDocument);
    if (layers?.base) {
      return layers;
    }
    await sleep(50);
  }
  throw new Error("Place an editor preview on the canvas first.");
};

export type ExportEditorTimelineArgs = {
  previewElementId: string;
  ownerDocument: Document;
  durationMs: number;
  getTimeMs: () => number;
  play: () => void;
  stop: () => void;
  seek: (ms: number) => void;
};

export const exportEditorTimeline = async ({
  previewElementId,
  ownerDocument,
  durationMs,
  getTimeMs,
  play,
  stop,
  seek,
}: ExportEditorTimelineArgs): Promise<{
  blob: Blob;
  width: number;
  height: number;
  durationMs: number;
}> => {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser cannot export video");
  }
  if (durationMs < 80) {
    throw new Error("Add clips before exporting");
  }
  const layers = await waitForEditorPreviewLayers(
    previewElementId,
    ownerDocument,
  );
  const embed = layers.base.closest(
    ".jayrr-editor-preview-embed",
  ) as HTMLElement | null;
  if (!embed) {
    throw new Error("Place an editor preview on the canvas first.");
  }
  const ownerWindow = ownerDocument.defaultView ?? window;
  const prevAudio = getEditorPreviewAudio();
  embed.classList.add("is-exporting");
  setEditorPreviewAudio({ volume: 1, muted: false });
  seek(0);
  await sleep(200);
  const visual = startVisualCapture(layers, embed, ownerWindow);
  const videos = [layers.base, layers.baseAlt, ...layers.stacks].filter(
    (item): item is HTMLVideoElement => Boolean(item),
  );
  const audioMix = mixAudioTracks(
    videos,
    getEditorPreviewSounds(),
    ownerWindow,
  );
  const combined = new MediaStream([
    ...visual.stream.getVideoTracks(),
    ...audioMix.stream.getAudioTracks(),
  ]);
  const mimeType = pickMime();
  const videoBitsPerSecond = videoBitrate(visual.width, visual.height);
  const audioBitsPerSecond = 192_000;
  const recorder = new MediaRecorder(
    combined,
    mimeType
      ? {
          mimeType,
          videoBitsPerSecond,
          audioBitsPerSecond,
        }
      : {
          videoBitsPerSecond,
          audioBitsPerSecond,
        },
  );
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event: BlobEvent) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };
  const finish = () =>
    new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error("Export failed"));
      recorder.onstop = () => {
        resolve(
          new Blob(chunks, {
            type: recorder.mimeType || mimeType || "video/webm",
          }),
        );
      };
      if (recorder.state === "inactive") {
        resolve(
          new Blob(chunks, {
            type: recorder.mimeType || mimeType || "video/webm",
          }),
        );
        return;
      }
      recorder.stop();
    });
  try {
    await sleep(120);
    recorder.start(250);
    play();
    await waitUntilDone(getTimeMs, durationMs);
    if (recorder.state === "recording") {
      recorder.requestData();
    }
    const blob = await finish();
    stop();
    if (blob.size < 64) {
      throw new Error("Export produced an empty video");
    }
    return {
      blob,
      width: visual.width,
      height: visual.height,
      durationMs,
    };
  } finally {
    audioMix.stop();
    visual.stop();
    for (const track of combined.getTracks()) {
      track.stop();
    }
    embed.classList.remove("is-exporting");
    setEditorPreviewAudio(prevAudio);
    stop();
  }
};
