import type { ExcalidrawElement } from "@excalidraw/element/types";

import { STORAGE_KEYS } from "../app_constants";
import { importUsernameFromLocalStorage } from "../data/localStorage";
import { getAccountCollabName } from "../domain/profile/accountCollabIdentity";

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

export const JAYRR_CAMERA_LOOK_MIN = 0;
export const JAYRR_CAMERA_LOOK_MAX = 200;
export const JAYRR_CAMERA_LOOK_DEFAULT = 100;
export const JAYRR_CAMERA_ZOOM_MIN = 25;
export const JAYRR_CAMERA_ZOOM_DEFAULT = 100;
export const JAYRR_CAMERA_ZOOM_MAX = 400;

export type JayrrCameraLook = {
  brightness: number;
  contrast: number;
  saturation: number;
  /** Percent; 100 fits the box, higher crops in, lower shrinks the picture. */
  zoom: number;
};

export const DEFAULT_CAMERA_LOOK: JayrrCameraLook = {
  brightness: JAYRR_CAMERA_LOOK_DEFAULT,
  contrast: JAYRR_CAMERA_LOOK_DEFAULT,
  saturation: JAYRR_CAMERA_LOOK_DEFAULT,
  zoom: JAYRR_CAMERA_ZOOM_DEFAULT,
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

export const jayrrScreenSource = (userId: string) => `screen:${userId}`;

export const readScreenSource = (value: string) =>
  value.startsWith("screen:") ? value.slice("screen:".length) : null;

export type JayrrCamera =
  | {
      kind?: "camera";
      deviceId: string;
      label?: string;
      /** Collaboration client that is streaming into this box. */
      ownerId?: string;
      /** Display name of that client, stamped when the box was linked. */
      ownerName?: string;
      fit?: JayrrObjectFit;
      crop?: JayrrDisplayCrop;
      /** Background removal, shared with everyone viewing this box. */
      cutout?: boolean;
      brightness?: number;
      contrast?: number;
      saturation?: number;
      zoom?: number;
    }
  | {
      kind: "phone";
      userId: string;
      label?: string;
      ownerName?: string;
      fit?: JayrrObjectFit;
      crop?: JayrrDisplayCrop;
      /** Background removal, shared with everyone viewing this box. */
      cutout?: boolean;
    }
  | {
      kind: "screen";
      userId: string;
      label?: string;
      ownerName?: string;
      fit?: JayrrObjectFit;
      crop?: JayrrDisplayCrop;
      /** Background removal, shared with everyone viewing this box. */
      cutout?: boolean;
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
      /** Background removal, shared with everyone viewing this box. */
      cutout?: boolean;
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

export const parseObjectFit = (value: unknown): JayrrObjectFit | undefined =>
  isObjectFit(value) ? value : undefined;

const parseLookValue = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(
    JAYRR_CAMERA_LOOK_MAX,
    Math.max(JAYRR_CAMERA_LOOK_MIN, Math.round(value)),
  );
};

const parseZoomValue = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(
    JAYRR_CAMERA_ZOOM_MAX,
    Math.max(JAYRR_CAMERA_ZOOM_MIN, Math.round(value)),
  );
};

export const parseCameraLook = (
  value: unknown,
): JayrrCameraLook | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const bag = value as {
    brightness?: unknown;
    contrast?: unknown;
    saturation?: unknown;
    zoom?: unknown;
  };
  const zoom = parseZoomValue(bag.zoom);
  const brightness = parseLookValue(bag.brightness);
  const contrast = parseLookValue(bag.contrast);
  const saturation = parseLookValue(bag.saturation);
  if (
    brightness === undefined &&
    contrast === undefined &&
    saturation === undefined &&
    zoom === undefined
  ) {
    return undefined;
  }
  return {
    brightness: brightness ?? JAYRR_CAMERA_LOOK_DEFAULT,
    contrast: contrast ?? JAYRR_CAMERA_LOOK_DEFAULT,
    saturation: saturation ?? JAYRR_CAMERA_LOOK_DEFAULT,
    zoom: zoom ?? JAYRR_CAMERA_ZOOM_DEFAULT,
  };
};

export const getSavedCameraLook = (): JayrrCameraLook => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_CAMERA_LOOK);
    if (!raw) {
      return DEFAULT_CAMERA_LOOK;
    }
    return parseCameraLook(JSON.parse(raw)) ?? DEFAULT_CAMERA_LOOK;
  } catch {
    return DEFAULT_CAMERA_LOOK;
  }
};

export const setSavedCameraLook = (look: JayrrCameraLook) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_CAMERA_LOOK,
      JSON.stringify(look),
    );
  } catch {
    // Private mode or a full quota. The scene copy still holds.
  }
};

export const readCameraLook = (camera: JayrrCamera | null): JayrrCameraLook => {
  if (
    camera &&
    camera.kind !== "display" &&
    camera.kind !== "phone" &&
    camera.kind !== "screen"
  ) {
    const fromCamera = parseCameraLook(camera);
    if (fromCamera) {
      return fromCamera;
    }
  }
  if (
    !camera ||
    (camera.kind !== "display" &&
      camera.kind !== "phone" &&
      camera.kind !== "screen")
  ) {
    return getSavedCameraLook();
  }
  return DEFAULT_CAMERA_LOOK;
};

export const isDefaultCameraLook = (look: JayrrCameraLook) =>
  look.brightness === JAYRR_CAMERA_LOOK_DEFAULT &&
  look.contrast === JAYRR_CAMERA_LOOK_DEFAULT &&
  look.saturation === JAYRR_CAMERA_LOOK_DEFAULT &&
  look.zoom === JAYRR_CAMERA_ZOOM_DEFAULT;

export const cameraLookFields = (look: JayrrCameraLook) => {
  if (isDefaultCameraLook(look)) {
    return {};
  }
  return {
    brightness: look.brightness,
    contrast: look.contrast,
    saturation: look.saturation,
    zoom: look.zoom,
  };
};

export const cameraLookFilter = (look: JayrrCameraLook) => {
  if (
    look.brightness === JAYRR_CAMERA_LOOK_DEFAULT &&
    look.contrast === JAYRR_CAMERA_LOOK_DEFAULT &&
    look.saturation === JAYRR_CAMERA_LOOK_DEFAULT
  ) {
    return "none";
  }
  return `brightness(${look.brightness / 100}) contrast(${
    look.contrast / 100
  }) saturate(${look.saturation / 100})`;
};

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
      camera.label || (camera.userId === JAYRR_PHONE_SELF ? "Call" : "Phone")
    );
  }
  if (camera.kind === "screen") {
    return camera.label || "Screen";
  }
  return camera.label || null;
};

export const canLinkJayrrCamera = (element: ExcalidrawElement) =>
  element.type === "rectangle" ||
  element.type === "ellipse" ||
  element.type === "diamond";

export const readJayrrOwnerName = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }
  const name = value.trim();
  if (!name || name === "On") {
    return undefined;
  }
  return name;
};

export const jayrrLocalOwnerName = () =>
  readJayrrOwnerName(getAccountCollabName()) ??
  readJayrrOwnerName(importUsernameFromLocalStorage());

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
    ownerId?: unknown;
    ownerName?: unknown;
    nonce?: unknown;
    label?: unknown;
    surface?: unknown;
    quality?: unknown;
    frameRate?: unknown;
    fit?: unknown;
    crop?: unknown;
    cutout?: unknown;
    brightness?: unknown;
    contrast?: unknown;
    saturation?: unknown;
    zoom?: unknown;
  };
  const label = typeof bag.label === "string" ? bag.label : undefined;
  const ownerName = readJayrrOwnerName(bag.ownerName);
  const fit = parseObjectFit(bag.fit);
  const crop = parseDisplayCrop(bag.crop);
  const cutout = typeof bag.cutout === "boolean" ? bag.cutout : undefined;
  if (bag.kind === "phone") {
    const userId = typeof bag.userId === "string" ? bag.userId : "";
    if (!userId) {
      return null;
    }
    return { kind: "phone", userId, label, ownerName, fit, crop, cutout };
  }
  if (bag.kind === "screen") {
    const userId = typeof bag.userId === "string" ? bag.userId : "";
    if (!userId) {
      return null;
    }
    return { kind: "screen", userId, label, ownerName, fit, crop, cutout };
  }
  if (bag.kind === "display") {
    return {
      kind: "display",
      nonce: typeof bag.nonce === "number" ? bag.nonce : undefined,
      surface: isDisplaySurface(bag.surface) ? bag.surface : undefined,
      quality: isDisplayQuality(bag.quality) ? bag.quality : undefined,
      frameRate: isDisplayRate(bag.frameRate) ? bag.frameRate : undefined,
      fit,
      crop,
      cutout,
      label,
    };
  }
  const deviceId = bag.deviceId;
  if (typeof deviceId !== "string" || !deviceId) {
    return null;
  }
  const ownerId = typeof bag.ownerId === "string" ? bag.ownerId : undefined;
  return {
    kind: "camera",
    deviceId,
    label,
    ownerId,
    ownerName,
    fit,
    crop,
    cutout,
    ...cameraLookFields(parseCameraLook(bag) ?? DEFAULT_CAMERA_LOOK),
  };
};

/** Account that is streaming into this box, when the box is tied to one. */
export const jayrrStreamOwnerId = (camera: JayrrCamera | null) => {
  if (!camera) {
    return null;
  }
  if (camera.kind === "phone" || camera.kind === "screen") {
    if (!camera.userId || camera.userId === JAYRR_PHONE_SELF) {
      return null;
    }
    return camera.userId;
  }
  if (camera.kind === "display") {
    return null;
  }
  return camera.ownerId || null;
};

export const jayrrStreamOwnerLabel = (
  camera: JayrrCamera | null,
  people: readonly { userId: string; label: string }[] = [],
) => {
  if (!camera || camera.kind === "display") {
    return null;
  }
  const stamped =
    "ownerName" in camera ? readJayrrOwnerName(camera.ownerName) : undefined;
  if (stamped) {
    return stamped;
  }
  if (camera.kind === "phone" || camera.kind === "screen") {
    const fromLabel = readJayrrOwnerName(
      camera.label === "Screen" ? undefined : camera.label,
    );
    if (fromLabel) {
      return fromLabel;
    }
    const person = people.find((item) => item.userId === camera.userId);
    return readJayrrOwnerName(person?.label) ?? "Someone else";
  }
  const person = people.find((item) => item.userId === camera.ownerId);
  return readJayrrOwnerName(person?.label) ?? "Someone else";
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

export const isJayrrScreen = (
  camera: JayrrCamera | null,
): camera is Extract<JayrrCamera, { kind: "screen" }> =>
  camera?.kind === "screen";

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
  if (camera?.fit) {
    return camera.fit;
  }
  if (camera?.kind === "display") {
    return "contain";
  }
  return "cover";
};

export const readDisplayCrop = (
  camera: JayrrCamera | null,
): JayrrDisplayCrop | undefined => camera?.crop;
