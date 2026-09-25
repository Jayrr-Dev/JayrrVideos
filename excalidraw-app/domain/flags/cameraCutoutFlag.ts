import { atom } from "../../app-jotai";

export const CAMERA_CUTOUT_FLAG = "cameraCutout";

export const CAMERA_CUTOUT_OPTIONS = [
  { id: "off", label: "Off" },
  { id: "mediapipe", label: "MediaPipe" },
  { id: "modnet", label: "MODNet" },
  { id: "segmo", label: "Segmo" },
] as const;

export type CameraCutout = typeof CAMERA_CUTOUT_OPTIONS[number]["id"];

export const isCameraCutout = (value: string): value is CameraCutout =>
  CAMERA_CUTOUT_OPTIONS.some((option) => option.id === value);

export const cameraCutoutAtom = atom<CameraCutout>("off");
