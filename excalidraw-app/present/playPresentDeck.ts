import { isEmbeddableElement, isFrameLikeElement } from "@excalidraw/element";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { getNormalizedZoom } from "@excalidraw/excalidraw/scene";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { ElementRenderOverrides } from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  Zoom,
} from "@excalidraw/excalidraw/types";

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
  type PresentTranslation,
} from "./buildPresentDeck";
import {
  pauseOtherPresentMedia,
  pausePresentMedia,
  playPresentMedia,
  resetPresentMediaVisibility,
} from "./playPresentMedia";
import { getPresentDefaultMotion } from "./presentMotion";
import { easePresent } from "./presentTranslation";

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

const shownPose = (object: PresentObject): OverrideValues => {
  if (object.translation?.kind !== "move") {
    return SHOWN;
  }
  return {
    opacity: 100,
    offset: { x: object.translation.x, y: object.translation.y },
  };
};

const hiddenPoseAt = (
  motion: PresentMotion,
  translation: PresentTranslation | null,
): OverrideValues => {
  const pose = hiddenPose(motion);
  if (translation?.kind !== "move") {
    return pose;
  }
  return {
    opacity: pose.opacity,
    offset: {
      x: pose.offset.x + translation.x,
      y: pose.offset.y + translation.y,
    },
  };
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
  const exited = new Set<string>();
  for (let i = 0; i <= stepIndex; i++) {
    const item = deck.steps[i];
    if (item?.type === "reveal" && step && item.frameId === step.frameId) {
      revealed.add(item.elementId);
      // Exit fade hides on the next click, still inside this frame.
      if (i < stepIndex) {
        exited.add(item.elementId);
      }
    }
  }

  const fallback = getPresentDefaultMotion();
  const values = new Map<string, OverrideValues>();
  // Hide first. A later object can share an id (bad binding); that must not
  // keep an earlier shape hidden after its own reveal step.
  for (const frame of deck.frames) {
    for (const object of frame.objects) {
      if (object.skip) {
        continue;
      }
      const pose = object.hide
        ? HIDDEN_FADE
        : hiddenPose(object.motion ?? fallback);
      for (const id of idsForPresentObject(object, elements)) {
        if (!values.has(id)) {
          values.set(id, pose);
        }
      }
    }
  }
  for (const frame of deck.frames) {
    for (const object of frame.objects) {
      if (!object.skip || object.hide) {
        continue;
      }
      for (const id of idsForPresentObject(object, elements)) {
        values.set(id, shownPose(object));
      }
    }
  }
  for (const frame of deck.frames) {
    for (const object of frame.objects) {
      if (!revealed.has(object.id)) {
        continue;
      }
      const pose =
        object.exit && exited.has(object.id)
          ? hiddenPoseAt(object.exit, object.translation)
          : shownPose(object);
      for (const id of idsForPresentObject(object, elements)) {
        values.set(id, pose);
      }
    }
  }
  return values;
};

/** Leave animation uses motion-out, not the enter pose. */
const stampExitPose = (
  deck: PresentDeck,
  elements: readonly NonDeletedExcalidrawElement[],
  from: Map<string, OverrideValues>,
  target: Map<string, OverrideValues>,
) => {
  for (const frame of deck.frames) {
    for (const object of frame.objects) {
      if (!object.exit) {
        continue;
      }
      const ids = idsForPresentObject(object, elements);
      let leaving = false;
      for (const id of ids) {
        const start = from.get(id);
        const end = target.get(id);
        if (start && end && start.opacity > end.opacity) {
          leaving = true;
          break;
        }
      }
      if (!leaving) {
        continue;
      }
      const pose = hiddenPoseAt(object.exit, object.translation);
      for (const id of ids) {
        if (target.has(id)) {
          target.set(id, pose);
        }
      }
    }
  }
};

/** Enter still starts from the motion pose, even after a fade exit. */
const primeEnterPoses = (
  deck: PresentDeck,
  elements: readonly NonDeletedExcalidrawElement[],
  from: Map<string, OverrideValues>,
  target: Map<string, OverrideValues>,
) => {
  const fallback = getPresentDefaultMotion();
  for (const frame of deck.frames) {
    for (const object of frame.objects) {
      if (object.skip || object.hide) {
        continue;
      }
      const pose = hiddenPose(object.motion ?? fallback);
      for (const id of idsForPresentObject(object, elements)) {
        const start = from.get(id);
        const end = target.get(id);
        if (!end || end.opacity < 100) {
          continue;
        }
        const startOpacity = start ? start.opacity : 0;
        if (startOpacity > 1) {
          continue;
        }
        from.set(id, pose);
      }
    }
  }
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
  zoom: Zoom;
};

const savedZoom = (zoom: number): Zoom => ({
  value: getNormalizedZoom(zoom),
});

const snapshotView = (api: ExcalidrawImperativeAPI): SavedView => {
  const { scrollX, scrollY, zoom } = api.getAppState();
  return { scrollX, scrollY, zoom: savedZoom(zoom.value) };
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
    zoom: savedZoom(zoom),
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
    zoom: savedZoom(zoom),
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
    zoom: savedZoom(zoom),
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
const objectForStep = (
  deck: PresentDeck,
  step: PresentStep | null | undefined,
): PresentObject | null => {
  if (!step || step.type !== "reveal") {
    return null;
  }
  const frame = deck.frames.find((item) => item.id === step.frameId);
  return frame?.objects.find((item) => item.id === step.elementId) ?? null;
};

const translationForStep = (
  deck: PresentDeck,
  step: PresentStep | null | undefined,
): PresentTranslation | null => {
  const object = objectForStep(deck, step);
  return object?.translation?.kind === "move" ? object.translation : null;
};

const objectEffectForStep = (
  deck: PresentDeck,
  step: PresentStep | null | undefined,
): PresentEffect | null => {
  if (!step || step.type !== "reveal") {
    return null;
  }
  const object = objectForStep(deck, step);
  if (
    object?.effect === "focus" ||
    object?.effect === "zoom" ||
    object?.effect === "scale"
  ) {
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
      if (objectEffect === "scale" && frameEl) {
        return {
          target: frameRect(frameEl),
          effect: objectEffect,
          zoomPercent: object.zoomPercent,
        };
      }
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
    const destFrameEffect =
      step?.type === "showFrame"
        ? (deck.frames.find((item) => item.id === step.frameId)?.effect ?? null)
        : null;
    const destActiveEffect = destObjectEffect ?? destFrameEffect;
    const fromObjectEffect = objectEffectForStep(deck, fromStep);
    const objectCamera = Boolean(destActiveEffect);
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
      const destEffect = restore ? null : destActiveEffect;
      if (!dest && camera?.target && isSceneRect(camera.target)) {
        if (destEffect === "focus") {
          dest = panToRect(camera.target, size, snapshotView(api).zoom.value);
        } else if (destEffect === "zoom" || destEffect === "scale") {
          const fit = containRect(
            camera.target,
            size,
            destEffect === "scale"
              ? {
                  top: JAYRR_PRESENT_NAME_PAD,
                  right: JAYRR_PRESENT_EDGE_PAD,
                  bottom: JAYRR_PRESENT_EDGE_PAD,
                  left: JAYRR_PRESENT_EDGE_PAD,
                }
              : ZOOM_INSET,
          );
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
        if (
          destEffect === "zoom" ||
          destEffect === "scale" ||
          destEffect === "focus" ||
          leavingFocus
        ) {
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
    stampExitPose(deck, liveElements, from, target);
    primeEnterPoses(deck, liveElements, from, target);
    const translation = translationForStep(deck, step);
    const enterMs = translation?.time ?? JAYRR_PRESENT_REVEAL_MS;
    const enterEase = (t: number) =>
      easePresent(translation?.easing ?? "easeOut", t);
    // Finish leave fades before camera or the next object's enter.
    if (hasFadeOut(from, target) || (moveCamera && crossedFrame)) {
      const mid = fadeOutHold(from, target);
      this.animateOverrides(
        api,
        from,
        mid,
        gen,
        () => {
          applyCamera();
          this.animateOverrides(
            api,
            mid,
            target,
            gen,
            settle,
            enterMs,
            enterEase,
          );
        },
        JAYRR_PRESENT_REVEAL_MS,
        easeOutQuad,
      );
      return;
    }

    applyCamera();
    this.animateOverrides(api, from, target, gen, settle, enterMs, enterEase);
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
    duration = JAYRR_PRESENT_REVEAL_MS,
    ease: (t: number) => number = easeOutQuad,
  ) {
    const ids = new Set([...from.keys(), ...to.keys()]);
    const start = performance.now();
    const tick = (now: number) => {
      if (this.gen !== gen) {
        return;
      }
      const t = ease(Math.min(1, (now - start) / Math.max(1, duration)));
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
