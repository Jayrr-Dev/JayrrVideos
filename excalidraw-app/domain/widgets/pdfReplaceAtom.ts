import { atom } from "../../app-jotai";

/** Element id that should open a PDF file picker, or null. */
export const pdfReplaceRequestAtom = atom<string | null>(null);
