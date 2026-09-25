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

export const JAYRR_OBJECT_FITS = [
  "contain",
  "cover",
  "fill",
  "none",
  "scale-down",
] as const;

export type JayrrObjectFit = typeof JAYRR_OBJECT_FITS[number];

export type JayrrDisplayCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const FULL_DISPLAY_CROP: JayrrDisplayCrop = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

export const MIN_DISPLAY_CROP = 0.04;

export const JAYRR_PHONE_SELF = "self";

export const jayrrPhoneSource = (userId: string) => `phone:${userId}`;

export const readPhoneSource = (value: string) =>
  value.startsWith("phone:") ? value.slice("phone:".length) : null;

export type JayrrCamera =
  | {
      kind?: "camera";
      deviceId: string;
      label?: string;
    }
  | {
      kind: "phone";
      userId: string;
      label?: string;
    }
  | {
      kind: "display";
      nonce?: number;
      label?: string;
      surface?: JayrrDisplaySurface;
      quality?: JayrrDisplayQuality;
      frameRate?: JayrrDisplayRate;
      fit?: JayrrObjectFit;
      crop?: JayrrDisplayCrop;
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

export const jayrrObjectFitLabel = (fit: JayrrObjectFit) => {
  if (fit === "cover") {
    return "Cover";
  }
  if (fit === "fill") {
    return "Fill";
  }
  if (fit === "none") {
    return "None";
  }
  if (fit === "scale-down") {
    return "Scale down";
  }
  return "Contain";
};

const isDisplayQuality = (value: unknown): value is JayrrDisplayQuality =>
  typeof value === "string" &&
  (JAYRR_DISPLAY_QUALITIES as readonly string[]).includes(value);

const isDisplayRate = (value: unknown): value is JayrrDisplayRate =>
  value === 30 || value === 60;

const isDisplaySurface = (value: unknown): value is JayrrDisplaySurface =>
  typeof value === "string" &&
  (JAYRR_DISPLAY_SURFACES as readonly string[]).includes(value);

const isObjectFit = (value: unknown): value is JayrrObjectFit =>
  typeof value === "string" &&
  (JAYRR_OBJECT_FITS as readonly string[]).includes(value);

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const clampDisplayCrop = (crop: JayrrDisplayCrop): JayrrDisplayCrop => {
  const width = Math.min(1, Math.max(MIN_DISPLAY_CROP, crop.width));
  const height = Math.min(1, Math.max(MIN_DISPLAY_CROP, crop.height));
  const x = clamp01(Math.min(crop.x, 1 - width));
  const y = clamp01(Math.min(crop.y, 1 - height));
  return {
    x,
    y,
    width: Math.min(width, 1 - x),
    height: Math.min(height, 1 - y),
  };
};

export const parseDisplayCrop = (
  value: unknown,
): JayrrDisplayCrop | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const bag = value as {
    x?: unknown;
    y?: unknown;
    width?: unknown;
    height?: unknown;
  };
  if (
    typeof bag.x !== "number" ||
    typeof bag.y !== "number" ||
    typeof bag.width !== "number" ||
    typeof bag.height !== "number"
  ) {
    return undefined;
  }
  if (
    ![bag.x, bag.y, bag.width, bag.height].every((item) =>
      Number.isFinite(item),
    )
  ) {
    return undefined;
  }
  return clampDisplayCrop({
    x: bag.x,
    y: bag.y,
    width: bag.width,
    height: bag.height,
  });
};

export const isFullDisplayCrop = (crop?: JayrrDisplayCrop | null) => {
  if (!crop) {
    return true;
  }
  return (
    crop.x <= 0 &&
    crop.y <= 0 &&
    crop.width >= 1 - 1e-6 &&
    crop.height >= 1 - 1e-6
  );
};

export const jayrrCameraLabel = (camera: JayrrCamera | null) => {
  if (!camera) {
    return null;
  }
  if (camera.kind === "display") {
    return camera.label || jayrrDisplaySurfaceLabel(camera.surface);
  }
  if (camera.kind === "phone") {
    return (
      camera.label || (camera.userId === JAYRR_PHONE_SELF ? "You" : "Phone")
    );
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
    userId?: unknown;
    nonce?: unknown;
    label?: unknown;
    surface?: unknown;
    quality?: unknown;
    frameRate?: unknown;
    fit?: unknown;
    crop?: unknown;
  };
  const label = typeof bag.label === "string" ? bag.label : undefined;
  if (bag.kind === "phone") {
    const userId = typeof bag.userId === "string" ? bag.userId : "";
    if (!userId) {
      return null;
    }
    return { kind: "phone", userId, label };
  }
  if (bag.kind === "display") {
    return {
      kind: "display",
      nonce: typeof bag.nonce === "number" ? bag.nonce : undefined,
      surface: isDisplaySurface(bag.surface) ? bag.surface : undefined,
      quality: isDisplayQuality(bag.quality) ? bag.quality : undefined,
      frameRate: isDisplayRate(bag.frameRate) ? bag.frameRate : undefined,
      fit: isObjectFit(bag.fit) ? bag.fit : undefined,
      crop: parseDisplayCrop(bag.crop),
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

export const isJayrrPhone = (
  camera: JayrrCamera | null,
): camera is Extract<JayrrCamera, { kind: "phone" }> =>
  camera?.kind === "phone";

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

export const readDisplayFit = (camera: JayrrCamera | null): JayrrObjectFit => {
  if (!isJayrrDisplay(camera) || !camera.fit) {
    return "contain";
  }
  return camera.fit;
};

export const readDisplayCrop = (
  camera: JayrrCamera | null,
): JayrrDisplayCrop | undefined => {
  if (!isJayrrDisplay(camera)) {
    return undefined;
  }
  return camera.crop;
};
