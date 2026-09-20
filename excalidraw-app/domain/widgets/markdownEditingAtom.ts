import { atom } from "../../app-jotai";

/** Element id currently being source-edited in a Markdown embed, or null. */
export const markdownEditingElementIdAtom = atom<string | null>(null);
