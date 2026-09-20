import { getEmbedLink } from "@excalidraw/element";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  jayrrCameraLabel,
  jayrrDisplaySurfaceLabel,
  readJayrrCamera,
} from "../../../camera/jayrrCamera";
import { listJayrrDisplayStreams } from "../../../camera/jayrrCameraStreams";
import { readCalledObjectKind } from "../model";

export const MIC_SOURCE = "mic";
export const MIC_PREFIX = "mic:";
export const EMBED_PREFIX = "embed:";

export const isMicSource = (id: string) =>
  id === MIC_SOURCE || id.startsWith(MIC_PREFIX);

export const micSourceId = (deviceId: string) => `${MIC_PREFIX}${deviceId}`;

export const micDeviceId = (sourceId: string) =>
  sourceId.startsWith(MIC_PREFIX) ? sourceId.slice(MIC_PREFIX.length) : "";

export type AudioSourceOption = {
  id: string;
  label: string;
  hasAudio: boolean;
};

const videoEmbedLabel = (link: string | null | undefined) => {
  const embed = getEmbedLink(link);
  if (!embed || embed.type !== "video") {
    return null;
  }
  const href = link ?? "";
  if (/youtu(\.be|be\.com)/i.test(href)) {
    return "YouTube";
  }
  if (/vimeo/i.test(href)) {
    return "Vimeo";
  }
  return "Video embed";
};

export const listAudioSources = (
  api: ExcalidrawImperativeAPI | null,
  mics: readonly MediaDeviceInfo[] = [],
): AudioSourceOption[] => {
  const options: AudioSourceOption[] = [
    { id: MIC_SOURCE, label: "Microphone (default)", hasAudio: true },
  ];
  for (const [index, device] of mics.entries()) {
    options.push({
      id: micSourceId(device.deviceId),
      label: device.label || `Microphone ${index + 1}`,
      hasAudio: true,
    });
  }
  const elements = api?.getSceneElements() ?? [];
  for (const { id, stream } of listJayrrDisplayStreams()) {
    const element = elements.find((item) => item.id === id);
    const camera = element ? readJayrrCamera(element) : null;
    const named = jayrrCameraLabel(camera);
    const fallback =
      camera && camera.kind === "display"
        ? jayrrDisplaySurfaceLabel(camera.surface)
        : "Shared source";
    const hasAudio = stream.getAudioTracks().some((track) => track.enabled);
    options.push({
      id,
      label: named || fallback,
      hasAudio,
    });
  }
  for (const element of elements) {
    if (element.type !== "embeddable" || readCalledObjectKind(element)) {
      continue;
    }
    const name = videoEmbedLabel(element.link);
    if (!name) {
      continue;
    }
    options.push({
      id: `${EMBED_PREFIX}${element.id}`,
      label: `${name} (${element.id.slice(0, 4)})`,
      hasAudio: true,
    });
  }
  return options;
};
