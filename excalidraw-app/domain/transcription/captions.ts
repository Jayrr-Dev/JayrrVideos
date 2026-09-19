import { repaintLiveCanvas } from "@excalidraw/excalidraw/liveMedia";

const captions = new Map<string, string>();

export const readCaption = (elementId: string): string =>
  captions.get(elementId) ?? "";

export const writeCaption = (elementId: string, text: string) => {
  const next = text.trim();
  if (!next) {
    if (!captions.has(elementId)) {
      return;
    }
    captions.delete(elementId);
    repaintLiveCanvas();
    return;
  }
  if (captions.get(elementId) === next) {
    return;
  }
  captions.set(elementId, next);
  repaintLiveCanvas();
};

export const clearCaption = (elementId: string) => {
  writeCaption(elementId, "");
};
