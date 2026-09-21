import { appJotaiStore } from "../../app-jotai";
import { startJayrrCameraCutout } from "../../camera/jayrrCameraCutout";
import { cameraCutoutAtom } from "../flags/cameraCutoutFlag";

const canvases = new WeakMap<HTMLVideoElement, HTMLCanvasElement>();
const stops = new WeakMap<HTMLVideoElement, () => void>();

export const bindEditorPreviewCutout = (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
) => {
  canvases.set(video, canvas);
  return () => {
    stopEditorClipCutout(video);
    if (canvases.get(video) === canvas) {
      canvases.delete(video);
    }
  };
};

export const getEditorPreviewCutoutCanvas = (video: HTMLVideoElement) =>
  canvases.get(video) ?? null;

export const stopEditorClipCutout = (video: HTMLVideoElement) => {
  const stop = stops.get(video);
  if (stop) {
    stop();
    stops.delete(video);
  }
  video.classList.remove("is-cutout");
  canvases.get(video)?.classList.remove("is-on");
};

export const syncEditorClipCutout = (
  video: HTMLVideoElement,
  enabled: boolean,
) => {
  const canvas = canvases.get(video);
  if (!enabled || !canvas) {
    stopEditorClipCutout(video);
    return;
  }
  if (!stops.has(video)) {
    const flag = appJotaiStore.get(cameraCutoutAtom);
    const engine = flag === "off" ? "mediapipe" : flag;
    const layer = video.dataset.editorLayer ?? "base";
    const stack = video.dataset.stackIndex ?? "0";
    const elementId = video.dataset.elementId ?? "preview";
    const stop = startJayrrCameraCutout(
      `editor-cutout:${elementId}:${layer}:${stack}`,
      video,
      canvas,
      engine,
    );
    stops.set(video, stop);
  }
  video.classList.add("is-cutout");
  canvas.classList.add("is-on");
};
