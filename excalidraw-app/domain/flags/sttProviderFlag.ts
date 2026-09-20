import { atom } from "../../app-jotai";

export const STT_PROVIDER_FLAG = "sttProvider";

export const STT_PROVIDER_OPTIONS = [
  { id: "inworld", label: "Inworld" },
  { id: "deepgram", label: "Deepgram" },
] as const;

export type SttProvider = typeof STT_PROVIDER_OPTIONS[number]["id"];

export const isSttProvider = (value: string): value is SttProvider =>
  STT_PROVIDER_OPTIONS.some((option) => option.id === value);

export const sttProviderAtom = atom<SttProvider>("inworld");
