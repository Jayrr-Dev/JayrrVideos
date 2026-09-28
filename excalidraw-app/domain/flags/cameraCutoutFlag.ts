import { atom } from "../../app-jotai";
import { STORAGE_KEYS } from "../../app_constants";

export const CAMERA_CUTOUT_FLAG = "cameraCutout";

export const CAMERA_CUTOUT_ENGINES = [
  { id: "segmo", label: "Segmo" },
  { id: "mediapipe", label: "MediaPipe" },
] as const;

export const CAMERA_CUTOUT_OPTIONS = CAMERA_CUTOUT_ENGINES;

export type CameraCutoutEngine = typeof CAMERA_CUTOUT_ENGINES[number]["id"];

export type CameraCutout = "off" | CameraCutoutEngine;

export const DEFAULT_CAMERA_CUTOUT_ENGINE: CameraCutoutEngine = "segmo";

export const isCameraCutoutEngine = (
  value: string,
): value is CameraCutoutEngine =>
  CAMERA_CUTOUT_ENGINES.some((option) => option.id === value);

export const isCameraCutout = (value: string): value is CameraCutout =>
  value === "off" || isCameraCutoutEngine(value);

export const parseCameraCutoutEngine = (value: string): CameraCutoutEngine => {
  if (isCameraCutoutEngine(value)) {
    return value;
  }
  return DEFAULT_CAMERA_CUTOUT_ENGINE;
};

const readStoredCutoutOn = () => {
  try {
    const stored = localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_CAMERA_CUTOUT_ON,
    );
    return stored === "1";
  } catch {
    return false;
  }
};

export const hasStoredCutoutOn = () => {
  try {
    return (
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_CAMERA_CUTOUT_ON) != null
    );
  } catch {
    return false;
  }
};

export const setSavedCutoutOn = (on: boolean) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_CAMERA_CUTOUT_ON,
      on ? "1" : "0",
    );
  } catch {
    // Private mode or a full quota.
  }
};

export const cameraCutoutEngineAtom = atom<CameraCutoutEngine>(
  DEFAULT_CAMERA_CUTOUT_ENGINE,
);

export const cameraCutoutOnAtom = atom(readStoredCutoutOn());

export const cameraCutoutAtom = atom<CameraCutout>((get) =>
  get(cameraCutoutOnAtom) ? get(cameraCutoutEngineAtom) : "off",
);
