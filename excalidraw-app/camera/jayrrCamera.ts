import type { ExcalidrawElement } from "@excalidraw/element/types";

export const JAYRR_CAMERA_KEY = "jayrrCamera";

export const JAYRR_DISPLAY_SOURCE = "display";

export const JAYRR_DISPLAY_SURFACES = ["monitor", "window", "browser"] as const;

export type JayrrDisplaySurface = typeof JAYRR_DISPLAY_SURFACES[number];

export const JAYRR_DISPLAY_QUALITIES = [
  "screen",
  "1080",
  "1440",
  "2160",
] as const;

export type JayrrDisplayQuality = typeof JAYRR_DISPLAY_QUALITIES[number];

export const JAYRR_DISPLAY_RATES = [30, 60] as const;

export type JayrrDisplayRate = typeof JAYRR_DISPLAY_RATES[number];

export type JayrrCamera =
  | {
      kind?: "camera";
      deviceId: string;
      label?: string;
    }
  | {
      kind: "display";
      nonce?: number;
      label?: string;
      surface?: JayrrDisplaySurface;
      quality?: JayrrDisplayQuality;
      frameRate?: JayrrDisplayRate;
    };

export const jayrrDisplaySurfaceLabel = (surface?: JayrrDisplaySurface) => {
  if (surface === "window") {
    return "App window";
  }
  if (surface === "browser") {
    return "Tab";
  }
  return "Screen";
};

export const jayrrDisplayQualityLabel = (quality: JayrrDisplayQuality) => {
  if (quality === "1080") {
    return "1080p";
  }
  if (quality === "1440") {
    return "1440p";
  }
  if (quality === "2160") {
    return "4K";
  }
  return "Screen size";
};

const isDisplayQuality = (value: unknown): value is JayrrDisplayQuality =>
  typeof value === "string" &&
  (JAYRR_DISPLAY_QUALITIES as readonly string[]).includes(value);

const isDisplayRate = (value: unknown): value is JayrrDisplayRate =>
  value === 30 || value === 60;

const isDisplaySurface = (value: unknown): value is JayrrDisplaySurface =>
  typeof value === "string" &&
  (JAYRR_DISPLAY_SURFACES as readonly string[]).includes(value);

export const jayrrCameraLabel = (camera: JayrrCamera | null) => {
  if (!camera) {
    return null;
  }
  if (camera.kind === "display") {
    return camera.label || jayrrDisplaySurfaceLabel(camera.surface);
  }
  return camera.label || null;
};

export const canLinkJayrrCamera = (element: ExcalidrawElement) =>
  element.type === "rectangle" ||
  element.type === "ellipse" ||
  element.type === "diamond";

export const readJayrrCamera = (
  element: ExcalidrawElement,
): JayrrCamera | null => {
  const data = element.customData?.[JAYRR_CAMERA_KEY];
  if (!data || typeof data !== "object") {
    return null;
  }
  const bag = data as {
    kind?: unknown;
    deviceId?: unknown;
    nonce?: unknown;
    label?: unknown;
    surface?: unknown;
    quality?: unknown;
    frameRate?: unknown;
  };
  const label = typeof bag.label === "string" ? bag.label : undefined;
  if (bag.kind === "display") {
    return {
      kind: "display",
      nonce: typeof bag.nonce === "number" ? bag.nonce : undefined,
      surface: isDisplaySurface(bag.surface) ? bag.surface : undefined,
      quality: isDisplayQuality(bag.quality) ? bag.quality : undefined,
      frameRate: isDisplayRate(bag.frameRate) ? bag.frameRate : undefined,
      label,
    };
  }
  const deviceId = bag.deviceId;
  if (typeof deviceId !== "string" || !deviceId) {
    return null;
  }
  return { kind: "camera", deviceId, label };
};

export const writeJayrrCamera = (
  element: ExcalidrawElement,
  camera: JayrrCamera | null,
): ExcalidrawElement["customData"] => {
  const customData: Record<string, unknown> = {
    ...(element.customData ?? {}),
  };
  if (!camera) {
    delete customData[JAYRR_CAMERA_KEY];
  } else {
    customData[JAYRR_CAMERA_KEY] = camera;
  }
  return Object.keys(customData).length
    ? (customData as ExcalidrawElement["customData"])
    : undefined;
};

export const isJayrrDisplay = (
  camera: JayrrCamera | null,
): camera is Extract<JayrrCamera, { kind: "display" }> =>
  camera?.kind === "display";

export const readDisplayQuality = (
  camera: JayrrCamera | null,
): JayrrDisplayQuality => {
  if (!isJayrrDisplay(camera) || !camera.quality) {
    return "screen";
  }
  return camera.quality;
};

export const readDisplayRate = (
  camera: JayrrCamera | null,
): JayrrDisplayRate => {
  if (!isJayrrDisplay(camera) || !camera.frameRate) {
    return 30;
  }
  return camera.frameRate;
};
