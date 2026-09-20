import {
  isEmbeddableElement,
  isFrameLikeElement,
  isTextElement,
} from "@excalidraw/element";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { getNormalizedZoom } from "@excalidraw/excalidraw/scene";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type {
  ElementRenderOverride,
  ElementRenderOverrides,
} from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  Zoom,
} from "@excalidraw/excalidraw/types";

import {
  idsForPresentObject,
  isPresentMove,
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
  type PresentTextEffect,
  type PresentTranslation,
} from "./buildPresentDeck";
import {
  pauseOtherPresentMedia,
  pausePresentMedia,
  playPresentMedia,
  resetPresentMediaVisibility,
} from "./playPresentMedia";
import { stopPresentSounds, syncPresentSounds } from "./playPresentSound";
import { getPresentDefaultMotion } from "./presentMotion";
import { publishPresentRenderOverrides } from "./presentRenderOverrides";
import {
  easePresent,
  samplePresentTranslationOffset,
} from "./presentTranslation";

type OverrideValues = {
  opacity: number;
  offset: { x: number; y: number };
  scale?: number;
  textClip?: {
    kind: PresentTextEffect["kind"];
    progress: number;
  };
};

const HIDDEN_FADE: OverrideValues = {
  opacity: 0,
  offset: { x: 0, y: 0 },
};

const hiddenPose = (motion: PresentMotion): OverrideValues => {
  if (motion === "none" || motion === "fade") {
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

const shownPose = (object: PresentObject, settled: boolean): OverrideValues => {
  const translation = object.translation;
  if (!isPresentMove(translation)) {
    return SHOWN;
  }
  if (translation.kind === "showMove" && !settled) {
    return SHOWN;
  }
  return {
    opacity: 100,
    offset: { x: translation.x, y: translation.y },
  };
};

const hiddenPoseAt = (
  motion: PresentMotion,
  translation: PresentTranslation | null,
): OverrideValues => {
  const pose = hiddenPose(motion);
  if (!isPresentMove(translation)) {
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
  const next = new Map<string, ElementRenderOverride>();
  for (const [id, value] of values) {
    const textClip =
      value.textClip && value.textClip.progress < 1
        ? {
            kind: value.textClip.kind,
            progress: value.textClip.progress,
          }
        : undefined;
    const posed =
      value.opacity < 100 ||
      value.offset.x !== 0 ||
      value.offset.y !== 0 ||
      (value.scale !== undefined && value.scale !== 1);
    if (!posed && !textClip && value.scale === undefined) {
      continue;
    }
    const scale =
      value.scale !== undefined && Number.isFinite(value.scale)
        ? value.scale
        : undefined;
    if (posed && textClip) {
      next.set(id, {
        opacity: value.opacity,
        offset: { x: value.offset.x, y: value.offset.y },
        ...(scale !== undefined ? { scale } : {}),
        textClip,
      });
    } else if (posed) {
      next.set(id, {
        opacity: value.opacity,
        offset: { x: value.offset.x, y: value.offset.y },
        ...(scale !== undefined ? { scale } : {}),
      });
    } else if (textClip) {
      next.set(id, {
        textClip,
        ...(scale !== undefined ? { scale } : {}),
      });
    } else if (scale !== undefined) {
      next.set(id, { scale });
    }
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
  const moved = new Set<string>();
  for (let i = 0; i <= stepIndex; i++) {
    const item = deck.steps[i];
    if (!item || !step || item.frameId !== step.frameId) {
      continue;
    }
    if (item.type === "reveal") {
      revealed.add(item.elementId);
      // Exit fade hides on the next click, still inside this frame.
      // Show n Move's own travel click must not count as that exit.
      if (i < stepIndex) {
        exited.add(item.elementId);
      }
    }
    if (item.type === "move") {
      moved.add(item.elementId);
    }
  }
  if (step?.type === "move") {
    exited.delete(step.elementId);
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
        values.set(id, shownPose(object, true));
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
          : shownPose(object, moved.has(object.id));
      for (const id of idsForPresentObject(object, elements)) {
        values.set(id, pose);
      }
    }
  }
  const overlayRevealed = new Set<string>();
  const overlayExited = new Set<string>();
  for (let i = 0; i <= stepIndex; i++) {
    const item = deck.steps[i];
    if (!item || item.type !== "reveal") {
      continue;
    }
    overlayRevealed.add(item.elementId);
    if (i < stepIndex) {
      overlayExited.add(item.elementId);
    }
  }
  for (const frame of deck.frames) {
    for (const object of frame.objects) {
      if (object.camera !== "fixed" || object.hide) {
        continue;
      }
      const pinned = object.skip || overlayRevealed.has(object.id);
      if (!pinned) {
        continue;
      }
      const pose =
        object.exit && overlayExited.has(object.id) && !object.skip
          ? hiddenPoseAt(object.exit, object.translation)
          : shownPose(object, true);
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
      const motion = object.motion ?? fallback;
      const pose = hiddenPose(motion);
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
        from.set(
          id,
          motion === "none" ? { opacity: 100, offset: pose.offset } : pose,
        );
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

type OverlayAnchor = {
  zoom: number;
  screenX: number;
  screenY: number;
};

const overlayMemberIds = (
  deck: PresentDeck,
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  const ids = new Set<string>();
  for (const frame of deck.frames) {
    for (const object of frame.objects) {
      if (object.camera !== "fixed") {
        continue;
      }
      for (const id of idsForPresentObject(object, elements)) {
        ids.add(id);
      }
    }
  }
  return ids;
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

const shiftSceneRect = (
  rect: SceneViewRect,
  offset: { x: number; y: number },
): SceneViewRect => ({
  x: rect.x + offset.x,
  y: rect.y + offset.y,
  width: rect.width,
  height: rect.height,
});

const offsetOfIds = (
  values: Map<string, OverrideValues>,
  objectIds: ReadonlySet<string>,
) => {
  for (const id of objectIds) {
    const pose = values.get(id);
    if (pose) {
      return pose.offset;
    }
  }
  return { x: 0, y: 0 };
};

type PresentCameraFollow = {
  from: SavedView;
  rect: SceneViewRect;
  size: { width: number; height: number };
  destZoom: number;
  objectIds: ReadonlySet<string>;
};

const zoomAt = (from: number, to: number, t: number) => {
  if (from <= 0 || to <= 0) {
    return to;
  }
  return from * (to / from) ** t;
};

const viewForFollow = (
  follow: PresentCameraFollow,
  offset: { x: number; y: number },
  t: number,
) =>
  panToRect(
    shiftSceneRect(follow.rect, offset),
    follow.size,
    zoomAt(follow.from.zoom.value, follow.destZoom, t),
  );

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
  if (!step || (step.type !== "reveal" && step.type !== "move")) {
    return null;
  }
  const frame = deck.frames.find((item) => item.id === step.frameId);
  return frame?.objects.find((item) => item.id === step.elementId) ?? null;
};

const textClipForEnter = (
  step: PresentStep | null | undefined,
  object: PresentObject | null,
  elements: readonly NonDeletedExcalidrawElement[],
): { ids: ReadonlySet<string>; effect: PresentTextEffect } | null => {
  if (step?.type !== "reveal" || !object?.textEffect) {
    return null;
  }
  const ids = new Set<string>();
  for (const id of idsForPresentObject(object, elements)) {
    const element = elements.find((item) => item.id === id);
    if (element && isTextElement(element)) {
      ids.add(id);
    }
  }
  if (ids.size === 0) {
    return null;
  }
  return { ids, effect: object.textEffect };
};

const translationForStep = (
  deck: PresentDeck,
  step: PresentStep | null | undefined,
): PresentTranslation | null => {
  const object = objectForStep(deck, step);
  const translation = object?.translation ?? null;
  if (!isPresentMove(translation)) {
    return null;
  }
  if (step?.type === "reveal" && translation.kind === "move") {
    return translation;
  }
  if (step?.type === "move" && translation.kind === "showMove") {
    return translation;
  }
  return null;
};

const objectEffectForStep = (
  deck: PresentDeck,
  step: PresentStep | null | undefined,
): PresentEffect | null => {
  if (!step || (step.type !== "reveal" && step.type !== "move")) {
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

  if (step.type === "reveal" || step.type === "move") {
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
  private overlayAnchors = new Map<string, OverlayAnchor>();
  private overlayIds = new Set<string>();

  stop(api: ExcalidrawImperativeAPI | null) {
    this.gen += 1;
    this.camGen += 1;
    this.pending = null;
    this.viewBeforeFocus = null;
    this.overlayAnchors = new Map();
    this.overlayIds = new Set();
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
    stopPresentSounds();
    resetPresentMediaVisibility();
    publishPresentRenderOverrides(null);
    api?.setElementRenderOverrides(null);
  }

  private isAnimating() {
    return Boolean(this.raf || this.camRaf);
  }

  private flushPending(gen: number) {
    if (this.gen !== gen || this.isAnimating()) {
      return;
    }
    const queued = this.pending;
    this.pending = null;
    if (queued) {
      this.runGoTo(queued);
    }
  }

  goTo(opts: GoToOpts) {
    if (opts.animate && this.isAnimating()) {
      this.pending = opts;
      return;
    }
    this.runGoTo(opts);
  }

  private pinOverlays(
    api: ExcalidrawImperativeAPI,
    values: Map<string, OverrideValues>,
    capture: boolean,
  ) {
    if (this.overlayIds.size === 0) {
      return values;
    }
    const view = snapshotView(api);
    const zoom = view.zoom.value;
    if (zoom <= 0) {
      return values;
    }
    const byId = new Map(
      api.getSceneElements().map((element) => [element.id, element]),
    );
    const next = new Map(values);
    for (const id of this.overlayIds) {
      const pose = next.get(id) ?? SHOWN;
      if (pose.opacity <= 1) {
        this.overlayAnchors.delete(id);
        continue;
      }
      const element = byId.get(id);
      if (!element) {
        continue;
      }
      const cx = element.x + element.width / 2;
      const cy = element.y + element.height / 2;
      let anchor = this.overlayAnchors.get(id);
      if (!anchor) {
        if (!capture || pose.opacity < 99) {
          continue;
        }
        const ax = cx + pose.offset.x;
        const ay = cy + pose.offset.y;
        anchor = {
          zoom,
          screenX: (ax + view.scrollX) * zoom,
          screenY: (ay + view.scrollY) * zoom,
        };
        this.overlayAnchors.set(id, anchor);
      }
      next.set(id, {
        ...pose,
        offset: {
          x: anchor.screenX / zoom - view.scrollX - cx,
          y: anchor.screenY / zoom - view.scrollY - cy,
        },
        scale: anchor.zoom / zoom,
      });
    }
    return next;
  }

  private paint(
    api: ExcalidrawImperativeAPI,
    values: Map<string, OverrideValues>,
    capture: boolean,
  ) {
    const pinned = this.pinOverlays(api, values, capture);
    const overrides = toOverrides(pinned);
    publishPresentRenderOverrides(overrides);
    api.setElementRenderOverrides(overrides);
  }

  private runGoTo(opts: GoToOpts) {
    const { api, deck, stepIndex, animate } = opts;
    const fromIndex = this.lastStep;
    const liveElements = api.getSceneElements();
    this.overlayIds = overlayMemberIds(deck, liveElements);
    const target = targetForDeck(deck, stepIndex, liveElements);
    const playMedia = () => {
      try {
        this.syncMedia(deck, stepIndex, liveElements);
      } catch {
        // Embed pause/play must not block the reveal.
      }
    };
    if (animate && this.playing.size > 0) {
      pausePresentMedia(this.playing);
      this.playing = new Set();
    }
    const fromStep = fromIndex === null ? null : deck.steps[fromIndex];
    const step = deck.steps[stepIndex];
    const crossedFrame = Boolean(
      fromStep && step && fromStep.frameId !== step.frameId,
    );
    const destObjectEffect = objectEffectForStep(deck, step);
    const destFrameEffect =
      step?.type === "showFrame"
        ? deck.frames.find((item) => item.id === step.frameId)?.effect ?? null
        : null;
    const destActiveEffect = destObjectEffect ?? destFrameEffect;
    const fromObjectEffect = objectEffectForStep(deck, fromStep);
    const objectCamera = Boolean(destActiveEffect);
    const leavingFocus = Boolean(fromObjectEffect) && !objectCamera;
    const camera = cameraForStep(deck, stepIndex, liveElements, crossedFrame);
    const translation = translationForStep(deck, step);
    const enterObject = objectForStep(deck, step);
    const followIds = new Set<string>();
    if (enterObject && isPresentMove(translation)) {
      for (const id of idsForPresentObject(enterObject, liveElements)) {
        followIds.add(id);
      }
    }
    const followMove =
      !leavingFocus &&
      (destActiveEffect === "focus" || destActiveEffect === "zoom") &&
      isPresentMove(translation) &&
      followIds.size > 0 &&
      Boolean(camera?.target && isSceneRect(camera.target));
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

    this.gen += 1;
    const gen = this.gen;
    this.pending = null;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }

    const applyCamera = (onDone?: () => void) => {
      if (!moveCamera) {
        onDone?.();
        return;
      }
      const restore = leavingFocus ? this.viewBeforeFocus : null;
      if (leavingFocus) {
        this.viewBeforeFocus = null;
      }
      const size = editorSize(api);
      let dest: SavedView | null = restore;
      const destEffect = restore ? null : destActiveEffect;
      const cameraRect =
        camera?.target && isSceneRect(camera.target)
          ? destEffect === "focus" || destEffect === "zoom"
            ? isPresentMove(translation)
              ? shiftSceneRect(camera.target, {
                  x: translation.x,
                  y: translation.y,
                })
              : camera.target
            : camera.target
          : null;
      if (!dest && cameraRect) {
        if (destEffect === "focus") {
          dest = panToRect(cameraRect, size, snapshotView(api).zoom.value);
        } else if (destEffect === "zoom" || destEffect === "scale") {
          const fit = containRect(
            cameraRect,
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
            camera?.zoomPercent ?? JAYRR_PRESENT_ZOOM_PERCENT_DEFAULT;
          dest = panToRect(
            cameraRect,
            size,
            Math.min(30, Math.max(0.1, fit.zoom.value * (percent / 100))),
          );
        } else {
          dest = containRect(cameraRect, size, {
            top: JAYRR_PRESENT_NAME_PAD,
            right: JAYRR_PRESENT_EDGE_PAD,
            bottom: JAYRR_PRESENT_EDGE_PAD,
            left: JAYRR_PRESENT_EDGE_PAD,
          });
        }
      }
      if (!dest) {
        onDone?.();
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
      this.easeCamera(api, dest, duration, gen, onDone);
    };

    const settle = () => {
      if (this.gen !== gen) {
        return;
      }
      this.current = target;
      this.paint(api, target, true);
    };

    if (!animate || this.current.size === 0) {
      playMedia();
      applyCamera();
      settle();
      return;
    }

    const from = new Map(this.current);
    stampExitPose(deck, liveElements, from, target);
    primeEnterPoses(deck, liveElements, from, target);
    const enterPathIds = new Set<string>();
    if (
      enterObject &&
      isPresentMove(translation) &&
      translation.pathKind !== "line"
    ) {
      for (const id of idsForPresentObject(enterObject, liveElements)) {
        enterPathIds.add(id);
      }
    }
    const enterMotion = enterObject?.motion ?? getPresentDefaultMotion();
    const enterMs =
      translation?.time ??
      (enterMotion === "none" ? 0 : JAYRR_PRESENT_REVEAL_MS);
    const enterEase = (t: number) =>
      easePresent(translation?.easing ?? "easeOut", t);
    const cameraFollow = (): PresentCameraFollow | null => {
      if (
        !followMove ||
        !camera?.target ||
        !isSceneRect(camera.target) ||
        (destActiveEffect !== "focus" && destActiveEffect !== "zoom")
      ) {
        return null;
      }
      const size = editorSize(api);
      const fromView = snapshotView(api);
      let destZoom: number = fromView.zoom.value;
      if (destActiveEffect === "zoom") {
        const fit = containRect(camera.target, size, ZOOM_INSET);
        const percent =
          camera.zoomPercent ?? JAYRR_PRESENT_ZOOM_PERCENT_DEFAULT;
        destZoom = Math.min(
          30,
          Math.max(0.1, fit.zoom.value * (percent / 100)),
        );
      }
      return {
        from: fromView,
        rect: camera.target,
        size,
        destZoom,
        objectIds: followIds,
      };
    };
    const startEnter = (enterFrom: Map<string, OverrideValues>) => {
      const playEnter = () => {
        if (this.gen !== gen) {
          return;
        }
        playMedia();
        this.animateOverrides(
          api,
          enterFrom,
          target,
          gen,
          settle,
          enterMs,
          enterEase,
          translation,
          enterPathIds,
          cameraFollow(),
          textClipForEnter(step, enterObject, liveElements),
        );
      };
      if (followMove) {
        this.camGen += 1;
        if (this.camRaf) {
          cancelAnimationFrame(this.camRaf);
          this.camRaf = 0;
        }
        playEnter();
        return;
      }
      const waitForZoom =
        leavingFocus ||
        destActiveEffect === "zoom" ||
        destActiveEffect === "scale" ||
        destActiveEffect === "focus";
      if (waitForZoom && animate) {
        applyCamera(playEnter);
        return;
      }
      applyCamera();
      playEnter();
    };
    // Finish leave fades before camera or the next object's enter.
    if (hasFadeOut(from, target) || (moveCamera && crossedFrame)) {
      const mid = fadeOutHold(from, target);
      this.animateOverrides(
        api,
        from,
        mid,
        gen,
        () => startEnter(mid),
        JAYRR_PRESENT_REVEAL_MS,
        easeOutQuad,
      );
      return;
    }

    startEnter(from);
  }

  private easeCamera(
    api: ExcalidrawImperativeAPI,
    dest: SavedView,
    duration: number,
    gen: number,
    onDone?: () => void,
  ) {
    this.camGen += 1;
    const camGen = this.camGen;
    if (this.camRaf) {
      cancelAnimationFrame(this.camRaf);
      this.camRaf = 0;
    }
    const finish = () => {
      onDone?.();
      this.flushPending(gen);
    };
    if (duration <= 0) {
      writeView(api, dest);
      this.paint(api, this.current, false);
      finish();
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
        this.paint(api, this.current, false);
        this.camRaf = requestAnimationFrame(tick);
        return;
      }
      this.camRaf = 0;
      writeView(api, dest);
      this.paint(api, this.current, false);
      finish();
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
    translation: PresentTranslation | null = null,
    pathIds: ReadonlySet<string> = new Set(),
    cameraFollow: PresentCameraFollow | null = null,
    textClip: {
      ids: ReadonlySet<string>;
      effect: PresentTextEffect;
    } | null = null,
  ) {
    const writeFollow = (values: Map<string, OverrideValues>, t: number) => {
      if (!cameraFollow) {
        return;
      }
      writeView(
        api,
        viewForFollow(
          cameraFollow,
          offsetOfIds(values, cameraFollow.objectIds),
          t,
        ),
      );
    };
    const finish = () => {
      this.current = to;
      this.paint(api, to, true);
      writeFollow(to, 1);
      onDone();
      this.flushPending(gen);
    };
    const clipTime =
      textClip && textClip.ids.size > 0 ? textClip.effect.time : 0;
    const total = Math.max(duration, clipTime);
    if (total <= 0) {
      finish();
      return;
    }
    const ids = new Set([...from.keys(), ...to.keys()]);
    const start = performance.now();
    const followPath =
      isPresentMove(translation) &&
      translation.pathKind !== "line" &&
      pathIds.size > 0;
    const tick = (now: number) => {
      if (this.gen !== gen) {
        return;
      }
      const elapsed = now - start;
      const motionT = duration <= 0 ? 1 : ease(Math.min(1, elapsed / duration));
      const mixed = new Map<string, OverrideValues>();
      const along =
        followPath && translation
          ? samplePresentTranslationOffset(translation, motionT)
          : null;
      for (const id of ids) {
        const a = poseOf(from, id, SHOWN);
        const b = poseOf(to, id, SHOWN);
        if (along && pathIds.has(id)) {
          mixed.set(id, {
            opacity: lerp(a.opacity, b.opacity, motionT),
            offset: {
              x: along.x + lerp(a.offset.x, 0, motionT),
              y: along.y + lerp(a.offset.y, 0, motionT),
            },
          });
          continue;
        }
        mixed.set(id, {
          opacity: lerp(a.opacity, b.opacity, motionT),
          offset: {
            x: lerp(a.offset.x, b.offset.x, motionT),
            y: lerp(a.offset.y, b.offset.y, motionT),
          },
        });
      }
      if (textClip && clipTime > 0) {
        const progress = Math.min(1, elapsed / clipTime);
        if (progress < 1) {
          for (const id of textClip.ids) {
            const pose = mixed.get(id) ?? poseOf(to, id, SHOWN);
            mixed.set(id, {
              opacity: pose.opacity,
              offset: pose.offset,
              textClip: { kind: textClip.effect.kind, progress },
            });
          }
        }
      }
      this.current = mixed;
      this.paint(api, mixed, false);
      writeFollow(mixed, motionT);
      if (elapsed < total) {
        this.raf = requestAnimationFrame(tick);
        return;
      }
      this.raf = 0;
      finish();
    };
    writeFollow(from, 0);
    this.raf = requestAnimationFrame(tick);
  }

  private syncMedia(
    deck: PresentDeck,
    stepIndex: number,
    elements: readonly NonDeletedExcalidrawElement[],
  ) {
    const step = deck.steps[stepIndex];
    const nextPlaying =
      step?.type === "reveal" || step?.type === "move"
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
    syncPresentSounds(deck, stepIndex);
  }
}
