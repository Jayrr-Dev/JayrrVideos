import type { ExcalidrawElement } from "@excalidraw/element/types";

export const JAYRR_CAMERA_KEY = "jayrrCamera";

export const JAYRR_DISPLAY_SOURCE = "display";

export const JAYRR_DISPLAY_SURFACES = ["monitor", "window", "browser"] as const;

export type JayrrDisplaySurface = typeof JAYRR_DISPLAY_SURFACES[number];

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
  };
  const label = typeof bag.label === "string" ? bag.label : undefined;
  if (bag.kind === "display") {
    return {
      kind: "display",
      nonce: typeof bag.nonce === "number" ? bag.nonce : undefined,
      surface: isDisplaySurface(bag.surface) ? bag.surface : undefined,
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
