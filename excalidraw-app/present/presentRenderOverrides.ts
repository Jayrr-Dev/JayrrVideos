import type { ElementRenderOverrides } from "@excalidraw/excalidraw";

let snapshot: ElementRenderOverrides = new Map();
const listeners = new Set<() => void>();

export const publishPresentRenderOverrides = (
  next: ElementRenderOverrides | null,
) => {
  snapshot = next ?? new Map();
  for (const listener of listeners) {
    listener();
  }
};

export const getPresentRenderOverrides = () => snapshot;

export const subscribePresentRenderOverrides = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
