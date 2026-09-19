import { isEmbeddableElement, isFrameLikeElement } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { ElementRenderOverrides } from "@excalidraw/excalidraw";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  idsForPresentObject,
  JAYRR_PRESENT_EDGE_PAD,
  JAYRR_PRESENT_NAME_PAD,
  JAYRR_PRESENT_REVEAL_MS,
  JAYRR_PRESENT_SLIDE_Y,
  JAYRR_PRESENT_ZOOM_MS,
  JAYRR_PRESENT_ZOOM_PERCENT_DEFAULT,
  type PresentDeck,
  type PresentEffect,
  type PresentMotion,
  type PresentObject,
  type PresentStep,
} from "./buildPresentDeck";
import {
  pauseOtherPresentMedia,
  pausePresentMedia,
  playPresentMedia,
  resetPresentMediaVisibility,
} from "./playPresentMedia";
import { getPresentDefaultMotion } from "./presentMotion";

type OverrideValues = {
  opacity: number;
  offset: { x: number; y: number };
};

const HIDDEN_FADE: OverrideValues = {
  opacity: 0,
  offset: { x: 0, y: 0 },
};

const hiddenPose = (motion: PresentMotion): OverrideValues => {
  if (motion === "fade") {
    return HIDDEN_FADE;
  }
  if (motion === "fadeDown") {
    return { opacity: 0, offset: { x: 0, y: -JAYRR_PRESENT_SLIDE_Y } };
  }
  if (motion === "fadeLeft") {
    return { opacity: 0, offset: { x: JAYRR_PRESENT_SLIDE_Y, y: 0 } };
  }
  if (motion === "fadeRight") {
    return { opacity: 0, offset: { x: -JAYRR_PRESENT_SLIDE_Y, y: 0 } };
  }
  return { opacity: 0, offset: { x: 0, y: JAYRR_PRESENT_SLIDE_Y } };
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
  const step = deck.steps[stepIndex];
  const revealed = new Set<string>();
  for (let i = 0; i <= stepIndex; i++) {
    const item = deck.steps[i];
    if (item?.type === "reveal" && step && item.frameId === step.frameId) {
      revealed.add(item.elementId);
    }
  }

  const fallback = getPresentDefaultMotion();
  const values = new Map<string, OverrideValues>();
  for (const frame of deck.frames) {
    for (const object of frame.objects) {
      const shown = revealed.has(object.id);
      const pose = shown ? SHOWN : hiddenPose(object.motion ?? fallback);
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

type SceneViewRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SavedView = {
  scrollX: number;
  scrollY: number;
  zoom: { value: number };
};

const snapshotView = (api: ExcalidrawImperativeAPI): SavedView => {
  const { scrollX, scrollY, zoom } = api.getAppState();
  return { scrollX, scrollY, zoom: { value: zoom.value } };
};

const editorSize = (api: ExcalidrawImperativeAPI) => {
  const { width, height } = api.getAppState();
  return {
    width: width > 32 ? width : window.innerWidth,
    height: height > 32 ? height : window.innerHeight,
  };
};

const isSceneRect = (target: unknown): target is SceneViewRect => {
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    return false;
  }
  const rect = target as Partial<SceneViewRect>;
  return (
    typeof rect.x === "number" &&
    typeof rect.y === "number" &&
    typeof rect.width === "number" &&
    typeof rect.height === "number"
  );
};

type ViewInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const insets = (pad: number | ViewInsets): ViewInsets => {
  if (typeof pad === "number") {
    return { top: pad, right: pad, bottom: pad, left: pad };
  }
  return pad;
};

const containRect = (
  rect: SceneViewRect,
  size: { width: number; height: number },
  pad: number | ViewInsets,
): SavedView => {
  const box = insets(pad);
  const availW = Math.max(1, size.width - box.left - box.right);
  const availH = Math.max(1, size.height - box.top - box.bottom);
  const zoom = Math.min(
    30,
    Math.max(0.1, Math.min(availW / rect.width, availH / rect.height)),
  );
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const midX = (box.left + size.width - box.right) / 2;
  const midY = (box.top + size.height - box.bottom) / 2;
  return {
    scrollX: midX / zoom - cx,
    scrollY: midY / zoom - cy,
    zoom: { value: zoom },
  };
};

const panToRect = (
  rect: SceneViewRect,
  size: { width: number; height: number },
  zoom: number,
): SavedView => {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  return {
    scrollX: size.width / 2 / zoom - cx,
    scrollY: size.height / 2 / zoom - cy,
    zoom: { value: zoom },
  };
};

const mixView = (from: SavedView, to: SavedView, t: number): SavedView => {
  if (t >= 1) {
    return to;
  }
  const z0 = from.zoom.value;
  const z1 = to.zoom.value;
  if (z0 <= 0 || z1 <= 0) {
    return to;
  }
  const zoom = z0 * (z1 / z0) ** t;
  const m = z1 === z0 ? t : (zoom - z0) / (z1 - z0);
  return {
    scrollX: ((1 - m) * from.scrollX * z0 + m * to.scrollX * z1) / zoom,
    scrollY: ((1 - m) * from.scrollY * z0 + m * to.scrollY * z1) / zoom,
    zoom: { value: zoom },
  };
};

const writeView = (api: ExcalidrawImperativeAPI, view: SavedView) => {
  api.updateScene({
    appState: {
      scrollX: view.scrollX,
      scrollY: view.scrollY,
      zoom: view.zoom,
      // Re-rasterize each frame. Stretching the old cache is what blurred Focus Zoom.
      shouldCacheIgnoreZoom: false,
    },
    captureUpdate: CaptureUpdateAction.EVENTUALLY,
  });
};

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

const SLIDE_MS = 560;

const ZOOM_INSET = 40;

const objectSceneRect = (
  object: PresentObject,
  elements: readonly NonDeletedExcalidrawElement[],
): SceneViewRect | null => {
  const ids = new Set(idsForPresentObject(object, elements));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const element of elements) {
    if (!ids.has(element.id)) {
      continue;
    }
    minX = Math.min(minX, element.x);
    minY = Math.min(minY, element.y);
    maxX = Math.max(maxX, element.x + element.width);
    maxY = Math.max(maxY, element.y + element.height);
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) {
    return null;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

/**
 * Slide camera is the destination frame's own rectangle — never a union of
 * children, never a stale element object. Focus/Zoom is the only exception,
 * and only while staying inside the same frame.
 */
const objectEffectForStep = (
  deck: PresentDeck,
  step: PresentStep | null | undefined,
): PresentEffect | null => {
  if (!step || step.type !== "reveal") {
    return null;
  }
  const frame = deck.frames.find((item) => item.id === step.frameId);
  const object = frame?.objects.find((item) => item.id === step.elementId);
  if (object?.effect === "focus" || object?.effect === "zoom") {
    return object.effect;
  }
  return null;
};

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
  zoomPercent: number | null;
} | null => {
  const step = deck.steps[stepIndex];
  if (!step) {
    return null;
  }
  const frameEl = elements.find(
    (element) => element.id === step.frameId && isFrameLikeElement(element),
  );
  const frame = deck.frames.find((item) => item.id === step.frameId);

  if (step.type === "reveal") {
    const objectEffect = objectEffectForStep(deck, step);
    const object = frame?.objects.find((item) => item.id === step.elementId);
    if (object && objectEffect) {
      const rect = objectSceneRect(object, elements);
      if (rect) {
        return {
          target: rect,
          effect: objectEffect,
          zoomPercent: object.zoomPercent,
        };
      }
    }
  }
  if (!frameEl) {
    return null;
  }
  const frameEffect = frame?.effect ?? null;
  return {
    target: frameRect(frameEl),
    effect: crossedFrame ? "zoom" : frameEffect,
    zoomPercent: frame?.zoomPercent ?? null,
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

const poseOf = (
  values: Map<string, OverrideValues>,
  id: string,
  fallback: OverrideValues,
) => values.get(id) ?? fallback;

const hasFadeOut = (
  from: Map<string, OverrideValues>,
  to: Map<string, OverrideValues>,
) => {
  for (const [id, a] of from) {
    const b = poseOf(to, id, SHOWN);
    if (a.opacity > b.opacity) {
      return true;
    }
  }
  return false;
};

/** Keep incoming objects hidden; only drive fade-outs to HIDDEN. */
const fadeOutHold = (
  from: Map<string, OverrideValues>,
  to: Map<string, OverrideValues>,
) => {
  const mid = new Map<string, OverrideValues>();
  const ids = new Set([...from.keys(), ...to.keys()]);
  for (const id of ids) {
    const a = poseOf(from, id, HIDDEN_FADE);
    const b = poseOf(to, id, SHOWN);
    mid.set(id, a.opacity > b.opacity ? b : a);
  }
  return mid;
};

type GoToOpts = {
  api: ExcalidrawImperativeAPI;
  deck: PresentDeck;
  stepIndex: number;
  elements: readonly NonDeletedExcalidrawElement[];
  animate: boolean;
};

export class PresentPlayer {
  private raf = 0;
  private camRaf = 0;
  private camGen = 0;
  private gen = 0;
  private current = new Map<string, OverrideValues>();
  private playing = new Set<string>();
  private lastStep: number | null = null;
  private pending: GoToOpts | null = null;
  /** Viewport as it was before the first Focus/Zoom on this slide. */
  private viewBeforeFocus: SavedView | null = null;

  stop(api: ExcalidrawImperativeAPI | null) {
    this.gen += 1;
    this.camGen += 1;
    this.pending = null;
    this.viewBeforeFocus = null;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    if (this.camRaf) {
      cancelAnimationFrame(this.camRaf);
      this.camRaf = 0;
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

  goTo(opts: GoToOpts) {
    if (this.raf && opts.animate) {
      this.pending = opts;
      return;
    }
    this.runGoTo(opts);
  }

  private runGoTo(opts: GoToOpts) {
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
    const destObjectEffect = objectEffectForStep(deck, step);
    const fromObjectEffect = objectEffectForStep(deck, fromStep);
    const objectCamera = Boolean(destObjectEffect);
    const leavingFocus = Boolean(fromObjectEffect) && !objectCamera;
    const camera = cameraForStep(deck, stepIndex, liveElements, crossedFrame);
    const moveCamera =
      fromIndex === null ||
      crossedFrame ||
      objectCamera ||
      leavingFocus ||
      !animate;

    if (crossedFrame) {
      this.viewBeforeFocus = null;
    } else if (objectCamera && !this.viewBeforeFocus) {
      this.viewBeforeFocus = snapshotView(api);
    }

    const applyCamera = () => {
      if (!moveCamera) {
        return;
      }
      const restore = leavingFocus ? this.viewBeforeFocus : null;
      if (leavingFocus) {
        this.viewBeforeFocus = null;
      }
      const size = editorSize(api);
      let dest: SavedView | null = restore;
      const destEffect = restore ? null : destObjectEffect;
      if (!dest && camera?.target && isSceneRect(camera.target)) {
        if (destEffect === "focus") {
          dest = panToRect(camera.target, size, snapshotView(api).zoom.value);
        } else if (destEffect === "zoom") {
          const fit = containRect(camera.target, size, ZOOM_INSET);
          const percent =
            camera.zoomPercent ?? JAYRR_PRESENT_ZOOM_PERCENT_DEFAULT;
          dest = panToRect(
            camera.target,
            size,
            Math.min(30, Math.max(0.1, fit.zoom.value * (percent / 100))),
          );
        } else {
          dest = containRect(camera.target, size, {
            top: JAYRR_PRESENT_NAME_PAD,
            right: JAYRR_PRESENT_EDGE_PAD,
            bottom: JAYRR_PRESENT_EDGE_PAD,
            left: JAYRR_PRESENT_EDGE_PAD,
          });
        }
      }
      if (!dest) {
        return;
      }
      let duration = 0;
      if (animate) {
        if (destEffect === "zoom" || destEffect === "focus" || leavingFocus) {
          duration = JAYRR_PRESENT_ZOOM_MS;
        } else {
          duration = SLIDE_MS;
        }
      }
      this.easeCamera(api, dest, duration);
    };

    this.gen += 1;
    const gen = this.gen;
    this.pending = null;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }

    const settle = () => {
      if (this.gen !== gen) {
        return;
      }
      this.current = target;
      api.setElementRenderOverrides(toOverrides(target));
    };

    if (!animate || this.current.size === 0) {
      applyCamera();
      settle();
      return;
    }

    const from = new Map(this.current);
    // Camera never moves until outgoing objects have finished fading.
    if (moveCamera && (hasFadeOut(from, target) || crossedFrame)) {
      const mid = fadeOutHold(from, target);
      this.animateOverrides(api, from, mid, gen, () => {
        applyCamera();
        this.animateOverrides(api, mid, target, gen, settle);
      });
      return;
    }

    applyCamera();
    this.animateOverrides(api, from, target, gen, settle);
  }

  private easeCamera(
    api: ExcalidrawImperativeAPI,
    dest: SavedView,
    duration: number,
  ) {
    this.camGen += 1;
    const camGen = this.camGen;
    if (this.camRaf) {
      cancelAnimationFrame(this.camRaf);
      this.camRaf = 0;
    }
    if (duration <= 0) {
      writeView(api, dest);
      return;
    }
    const from = snapshotView(api);
    const start = performance.now();
    const tick = (now: number) => {
      if (this.camGen !== camGen) {
        return;
      }
      const t = easeOutCubic(Math.min(1, (now - start) / duration));
      if (t < 1) {
        writeView(api, mixView(from, dest, t));
        this.camRaf = requestAnimationFrame(tick);
        return;
      }
      this.camRaf = 0;
      writeView(api, dest);
    };
    this.camRaf = requestAnimationFrame(tick);
  }

  private animateOverrides(
    api: ExcalidrawImperativeAPI,
    from: Map<string, OverrideValues>,
    to: Map<string, OverrideValues>,
    gen: number,
    onDone: () => void,
  ) {
    const ids = new Set([...from.keys(), ...to.keys()]);
    const start = performance.now();
    const tick = (now: number) => {
      if (this.gen !== gen) {
        return;
      }
      const t = easeOutQuad(
        Math.min(1, (now - start) / JAYRR_PRESENT_REVEAL_MS),
      );
      const mixed = new Map<string, OverrideValues>();
      for (const id of ids) {
        const a = poseOf(from, id, SHOWN);
        const b = poseOf(to, id, SHOWN);
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
      this.current = to;
      api.setElementRenderOverrides(toOverrides(to));
      onDone();
      const queued = this.pending;
      this.pending = null;
      if (queued && this.gen === gen) {
        this.runGoTo(queued);
      }
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
