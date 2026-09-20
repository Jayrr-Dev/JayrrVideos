import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type { InteractiveCanvasAppState, StaticCanvasAppState } from "./types";

export type LiveMediaPainter = (
  element: NonDeletedExcalidrawElement,
  context: CanvasRenderingContext2D,
  appState: StaticCanvasAppState | InteractiveCanvasAppState,
  renderState: {
    opacity: number;
    offset: Readonly<{ x: number; y: number }>;
  },
) => void;

let painter: LiveMediaPainter | null = null;
let canvasRepaint: (() => void) | null = null;

export const setLiveMediaPainter = (next: LiveMediaPainter | null) => {
  painter = next;
};

export const setLiveCanvasRepaint = (next: (() => void) | null) => {
  canvasRepaint = next;
};

export const repaintLiveCanvas = () => {
  canvasRepaint?.();
};

export const paintLiveMedia: LiveMediaPainter = (
  element,
  context,
  appState,
  renderState,
) => {
  painter?.(element, context, appState, renderState);
};
