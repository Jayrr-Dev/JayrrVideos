import { isEmbeddableElement, isFrameLikeElement } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { ElementRenderOverrides } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  idsForPresentObject,
  JAYRR_PRESENT_EDGE_PAD,
  JAYRR_PRESENT_FOCUS_PAD,
  JAYRR_PRESENT_NAME_PAD,
  JAYRR_PRESENT_REVEAL_MS,
  JAYRR_PRESENT_SLIDE_Y,
  JAYRR_PRESENT_ZOOM_MS,
  type PresentDeck,
  type PresentEffect,
} from "./buildPresentDeck";
import {
  pauseOtherPresentMedia,
  pausePresentMedia,
  playPresentMedia,
  resetPresentMediaVisibility,
} from "./playPresentMedia";

type OverrideValues = {
  opacity: number;
  offset: { x: number; y: number };
};

const HIDDEN: OverrideValues = {
  opacity: 0,
  offset: { x: 0, y: JAYRR_PRESENT_SLIDE_Y },
};

const SHOWN: OverrideValues = {
  opacity: 100,
  offset: { x: 0, y: 0 },
};

const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const toOverrides = (
  values: Map<string, OverrideValues>,
): ElementRenderOverrides => {
  const next = new Map<
    string,
    { opacity: number; offset: { x: number; y: number } }
  >();
  for (const [id, value] of values) {
    if (value.opacity >= 100 && value.offset.x === 0 && value.offset.y === 0) {
      continue;
    }
    next.set(id, {
      opacity: value.opacity,
      offset: { x: value.offset.x, y: value.offset.y },
    });
  }
  return next;
};

const targetForDeck = (
  deck: PresentDeck,
  stepIndex: number,
  elements: readonly NonDeletedExcalidrawElement[],
): Map<string, OverrideValues> => {
  const revealed = new Set<string>();
  for (let i = 0; i <= stepIndex; i++) {
    const step = deck.steps[i];
    if (step?.type === "reveal") {
      revealed.add(step.elementId);
    }
  }

  const values = new Map<string, OverrideValues>();
  for (const frame of deck.frames) {
    for (const object of frame.objects) {
      const shown = revealed.has(object.id);
      const pose = shown ? SHOWN : HIDDEN;
      for (const id of idsForPresentObject(object, elements)) {
        values.set(id, pose);
      }
    }
  }
  return values;
};

const frameRect = (element: NonDeletedExcalidrawElement) => ({
  x: element.x,
  y: element.y,
  width: element.width,
  height: element.height,
});

/**
 * Slide camera is the destination frame's own rectangle — never a union of
 * children, never a stale element object. Focus/Zoom is the only exception,
 * and only while staying inside the same frame.
 */
const cameraForStep = (
  deck: PresentDeck,
  stepIndex: number,
  elements: readonly NonDeletedExcalidrawElement[],
  crossedFrame: boolean,
): {
  target:
    | { x: number; y: number; width: number; height: number }
    | readonly NonDeletedExcalidrawElement[];
  effect: PresentEffect | null;
} | null => {
  const step = deck.steps[stepIndex];
  if (!step) {
    return null;
  }
  const frameEl = elements.find(
    (element) => element.id === step.frameId && isFrameLikeElement(element),
  );
  const frame = deck.frames.find((item) => item.id === step.frameId);

  if (!crossedFrame && step.type === "reveal") {
    const object = frame?.objects.find((item) => item.id === step.elementId);
    if (object?.effect === "focus" || object?.effect === "zoom") {
      const ids = new Set(idsForPresentObject(object, elements));
      const focused = elements.filter((element) => ids.has(element.id));
      if (focused.length > 0) {
        return { target: focused, effect: object.effect };
      }
    }
  }
  if (!frameEl) {
    return null;
  }
  return {
    target: frameRect(frameEl),
    effect: crossedFrame ? "zoom" : (frame?.effect ?? null),
  };
};

const embedIdsForObject = (
  deck: PresentDeck,
  objectId: string,
  frameId: string,
  elements: readonly NonDeletedExcalidrawElement[],
): Set<string> => {
  const ids = new Set<string>();
  const frame = deck.frames.find((item) => item.id === frameId);
  const object = frame?.objects.find((item) => item.id === objectId);
  if (!object) {
    return ids;
  }
  const byId = new Set(idsForPresentObject(object, elements));
  for (const element of elements) {
    if (byId.has(element.id) && isEmbeddableElement(element)) {
      ids.add(element.id);
    }
  }
  return ids;
};

export class PresentPlayer {
  private raf = 0;
  private current = new Map<string, OverrideValues>();
  private playing = new Set<string>();
  private lastStep: number | null = null;

  stop(api: ExcalidrawImperativeAPI | null) {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    this.current = new Map();
    if (this.playing.size > 0) {
      pausePresentMedia(this.playing);
      this.playing = new Set();
    }
    this.lastStep = null;
    resetPresentMediaVisibility();
    api?.setElementRenderOverrides(null);
  }

  goTo(opts: {
    api: ExcalidrawImperativeAPI;
    deck: PresentDeck;
    stepIndex: number;
    elements: readonly NonDeletedExcalidrawElement[];
    animate: boolean;
  }) {
    const { api, deck, stepIndex, animate } = opts;
    const fromIndex = this.lastStep;
    const liveElements = api.getSceneElements();
    const target = targetForDeck(deck, stepIndex, liveElements);
    try {
      this.syncMedia(deck, stepIndex, liveElements);
    } catch {
      // Embed pause/play must not block the reveal.
    }
    const fromStep = fromIndex === null ? null : deck.steps[fromIndex];
    const step = deck.steps[stepIndex];
    const crossedFrame = Boolean(
      fromStep && step && fromStep.frameId !== step.frameId,
    );
    const camera = cameraForStep(deck, stepIndex, liveElements, crossedFrame);
    if (camera) {
      const focused = camera.effect === "focus" || camera.effect === "zoom";
      const pad = focused ? JAYRR_PRESENT_FOCUS_PAD : JAYRR_PRESENT_EDGE_PAD;
      // Frame changes must land now. An in-flight zoom (or a thrown prime)
      // was leaving Back on the previous slide.
      const shouldSnap = !animate || crossedFrame;
      api.setViewport({
        target: camera.target,
        fit: camera.effect === "focus" ? "none" : "contain",
        animation: shouldSnap
          ? false
          : camera.effect === "zoom"
            ? { duration: JAYRR_PRESENT_ZOOM_MS }
            : true,
        offsets: focused
          ? {
              top: pad,
              bottom: pad,
              left: pad,
              right: pad,
            }
          : {
              top: JAYRR_PRESENT_NAME_PAD,
              bottom: pad,
              left: pad,
              right: pad,
            },
      });
    }

    if (!animate || this.current.size === 0) {
      this.current = target;
      api.setElementRenderOverrides(toOverrides(target));
      return;
    }

    const from = new Map(this.current);
    const ids = new Set([...from.keys(), ...target.keys()]);
    const start = performance.now();

    if (this.raf) {
      cancelAnimationFrame(this.raf);
    }

    const tick = (now: number) => {
      const t = easeOutQuad(
        Math.min(1, (now - start) / JAYRR_PRESENT_REVEAL_MS),
      );
      const mixed = new Map<string, OverrideValues>();
      for (const id of ids) {
        const a = from.get(id) ?? SHOWN;
        const b = target.get(id) ?? SHOWN;
        mixed.set(id, {
          opacity: lerp(a.opacity, b.opacity, t),
          offset: {
            x: lerp(a.offset.x, b.offset.x, t),
            y: lerp(a.offset.y, b.offset.y, t),
          },
        });
      }
      this.current = mixed;
      api.setElementRenderOverrides(toOverrides(mixed));
      if (t < 1) {
        this.raf = requestAnimationFrame(tick);
        return;
      }
      this.raf = 0;
      this.current = target;
      api.setElementRenderOverrides(toOverrides(target));
    };

    this.raf = requestAnimationFrame(tick);
  }

  private syncMedia(
    deck: PresentDeck,
    stepIndex: number,
    elements: readonly NonDeletedExcalidrawElement[],
  ) {
    const step = deck.steps[stepIndex];
    const nextPlaying =
      step?.type === "reveal"
        ? embedIdsForObject(deck, step.elementId, step.frameId, elements)
        : new Set<string>();
    const sameStep =
      this.lastStep === stepIndex &&
      this.playing.size === nextPlaying.size &&
      [...nextPlaying].every((id) => this.playing.has(id));
    if (sameStep) {
      return;
    }
    pauseOtherPresentMedia(nextPlaying);
    this.playing = nextPlaying;
    this.lastStep = stepIndex;
    playPresentMedia(nextPlaying);
  }
}
