import {
  curve,
  curveLength,
  curvePointAtLength,
  pointFrom,
} from "@excalidraw/math";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { LocalPoint } from "@excalidraw/math";

import {
  idsForPresentObject,
  type PresentEasing,
  type PresentObject,
  type PresentPathKind,
  type PresentPathPoint,
  type PresentTranslation,
} from "./buildPresentDeck";

export const PRESENT_EASINGS: readonly PresentEasing[] = [
  "linear",
  "easeIn",
  "easeOut",
  "easeInOut",
];

export const PRESENT_EASING_LABEL: Record<PresentEasing, string> = {
  linear: "Linear",
  easeIn: "Ease in",
  easeOut: "Ease out",
  easeInOut: "Ease in out",
};

export const PRESENT_PATH_KINDS: readonly PresentPathKind[] = [
  "line",
  "spline",
  "draw",
];

export const PRESENT_PATH_KIND_LABEL: Record<PresentPathKind, string> = {
  line: "Line",
  spline: "Spline",
  draw: "Draw",
};

export const easePresent = (easing: PresentEasing, t: number): number => {
  if (easing === "linear") {
    return t;
  }
  if (easing === "easeIn") {
    return t * t;
  }
  if (easing === "easeInOut") {
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  }
  return 1 - (1 - t) * (1 - t);
};

const toLocal = (point: PresentPathPoint) =>
  pointFrom<LocalPoint>(point.x, point.y);

export const presentTranslationPoints = (
  translation: PresentTranslation,
): PresentPathPoint[] => {
  if (translation.path && translation.path.length >= 2) {
    return translation.path.map((point) => ({ x: point.x, y: point.y }));
  }
  return [
    { x: 0, y: 0 },
    { x: translation.x, y: translation.y },
  ];
};

const splineCurvesFor = (points: readonly PresentPathPoint[]) => {
  if (points.length < 2) {
    return [];
  }
  if (points.length === 2) {
    const start = toLocal(points[0]);
    const end = toLocal(points[1]);
    return [curve(start, start, end, end)];
  }
  const curves = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const prev = points[index === 0 ? 0 : index - 1];
    const current = points[index];
    const next = points[index + 1];
    const after = points[index + 2] ?? next;
    curves.push(
      curve(
        toLocal(current),
        toLocal({
          x: current.x + (next.x - prev.x) / 6,
          y: current.y + (next.y - prev.y) / 6,
        }),
        toLocal({
          x: next.x - (after.x - current.x) / 6,
          y: next.y - (after.y - current.y) / 6,
        }),
        toLocal(next),
      ),
    );
  }
  return curves;
};

const samplePolyline = (
  points: readonly PresentPathPoint[],
  t: number,
): PresentPathPoint => {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }
  if (points.length === 1 || t <= 0) {
    return { x: points[0].x, y: points[0].y };
  }
  const last = points[points.length - 1];
  if (t >= 1) {
    return { x: last.x, y: last.y };
  }
  const lengths = [0];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    total += Math.hypot(to.x - from.x, to.y - from.y);
    lengths.push(total);
  }
  if (total < 1e-6) {
    return { x: last.x, y: last.y };
  }
  const target = total * t;
  for (let index = 1; index < points.length; index += 1) {
    if (lengths[index] < target) {
      continue;
    }
    const from = points[index - 1];
    const to = points[index];
    const span = lengths[index] - lengths[index - 1];
    const local = span < 1e-6 ? 1 : (target - lengths[index - 1]) / span;
    return {
      x: from.x + (to.x - from.x) * local,
      y: from.y + (to.y - from.y) * local,
    };
  }
  return { x: last.x, y: last.y };
};

export const samplePresentTranslationOffset = (
  translation: PresentTranslation,
  t: number,
): PresentPathPoint => {
  const points = presentTranslationPoints(translation);
  if (translation.pathKind !== "spline") {
    return samplePolyline(points, t);
  }
  const curves = splineCurvesFor(points);
  if (curves.length === 0) {
    return { x: translation.x, y: translation.y };
  }
  const lengths = curves.map((item) => curveLength(item));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total < 1e-6) {
    return { x: translation.x, y: translation.y };
  }
  if (t <= 0) {
    return { x: points[0].x, y: points[0].y };
  }
  if (t >= 1) {
    const last = points[points.length - 1];
    return { x: last.x, y: last.y };
  }
  let remain = total * t;
  for (let index = 0; index < curves.length; index += 1) {
    const length = lengths[index];
    if (remain > length && index < curves.length - 1) {
      remain -= length;
      continue;
    }
    const point = curvePointAtLength(
      curves[index],
      length < 1e-6 ? 1 : remain / length,
      length,
    );
    return { x: point[0], y: point[1] };
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y };
};

export const presentSplinePathD = (
  points: readonly PresentPathPoint[],
): string | null => {
  if (points.length < 2) {
    return null;
  }
  const curves = splineCurvesFor(points);
  if (curves.length === 0) {
    return null;
  }
  const start = curves[0][0];
  let d = `M ${start[0]} ${start[1]}`;
  for (const item of curves) {
    d += ` C ${item[1][0]} ${item[1][1]} ${item[2][0]} ${item[2][1]} ${item[3][0]} ${item[3][1]}`;
  }
  return d;
};

export const presentObjectCenter = (
  object: PresentObject,
  elements: readonly ExcalidrawElement[],
): { x: number; y: number } | null => {
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
  return { x: minX + (maxX - minX) / 2, y: minY + (maxY - minY) / 2 };
};

export type PresentTranslationPlace = {
  memberIds: readonly string[];
  pathKind: PresentPathKind;
};

let place: PresentTranslationPlace | null = null;
const listeners = new Set<() => void>();

const emitPlace = () => {
  for (const listener of listeners) {
    listener();
  }
};

export const subscribePresentTranslationPlace = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getPresentTranslationPlace = () => place;

export const startPresentTranslationPlace = (
  memberIds: readonly string[],
  pathKind: PresentPathKind = "line",
) => {
  place = { memberIds: [...memberIds], pathKind };
  emitPlace();
};

export const stopPresentTranslationPlace = () => {
  if (!place) {
    return;
  }
  place = null;
  emitPlace();
};
