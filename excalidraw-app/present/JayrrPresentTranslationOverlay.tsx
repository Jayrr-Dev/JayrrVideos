import {
  CaptureUpdateAction,
  newElementWith,
  sceneCoordsToViewportCoords,
  useExcalidrawAPI,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import { useExcalidrawContainer } from "@excalidraw/excalidraw/components/App";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import {
  isPresentMove,
  JAYRR_PRESENT_TRANSLATION_TIME_DEFAULT,
  writePresentTranslation,
  type PresentDeck,
  type PresentPathKind,
  type PresentPathPoint,
  type PresentTranslation,
} from "./buildPresentDeck";
import { PresentMoveHandle } from "./presentMoveIcon";
import {
  getPresentTranslationPlace,
  presentObjectCenter,
  presentSplinePathD,
  presentTranslationPoints,
  stopPresentTranslationPlace,
  subscribePresentTranslationPlace,
} from "./presentTranslation";

const DRAW_STEP = 8;

const arrowHead = (
  from: { x: number; y: number },
  to: { x: number; y: number },
) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 2) {
    return null;
  }
  const nx = dx / length;
  const ny = dy / length;
  const head = 12;
  const tipX = to.x;
  const tipY = to.y;
  const leftX = tipX - nx * head + ny * head * 0.45;
  const leftY = tipY - ny * head - nx * head * 0.45;
  const rightX = tipX - nx * head - ny * head * 0.45;
  const rightY = tipY - ny * head + nx * head * 0.45;
  return (
    <polygon points={`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`} />
  );
};

const TranslationArrow = ({
  from,
  to,
  active,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  active?: boolean;
}) => {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length < 2) {
    return <PresentMoveHandle x={from.x} y={from.y} size={active ? 20 : 18} />;
  }
  return (
    <g className={active ? "is-active" : undefined}>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
      {arrowHead(from, to)}
      <PresentMoveHandle x={from.x} y={from.y} />
    </g>
  );
};

const TranslationTrail = ({
  points,
  kind,
  active,
  showHandles,
}: {
  points: readonly PresentPathPoint[];
  kind: PresentPathKind;
  active?: boolean;
  showHandles?: boolean;
}) => {
  if (points.length === 0) {
    return null;
  }
  const start = points[0];
  const end = points[points.length - 1];
  if (kind === "line" || points.length < 2) {
    return <TranslationArrow from={start} to={end} active={active} />;
  }
  const spline = kind === "spline" ? presentSplinePathD(points) : null;
  const poly = points.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <g className={active ? "is-active" : undefined}>
      {spline ? <path d={spline} /> : <polyline points={poly} />}
      {arrowHead(points[Math.max(0, points.length - 2)], end)}
      <PresentMoveHandle x={start.x} y={start.y} size={active ? 20 : 18} />
      {showHandles
        ? points
            .slice(1)
            .map((point, index) => (
              <circle
                key={`${point.x}:${point.y}:${index}`}
                className="jayrr-present-translation__dot"
                cx={point.x}
                cy={point.y}
                r={4}
              />
            ))
        : null}
    </g>
  );
};

const moveBase = (current: PresentTranslation | null): PresentTranslation => {
  if (isPresentMove(current)) {
    return current;
  }
  return {
    kind: "move",
    time: JAYRR_PRESENT_TRANSLATION_TIME_DEFAULT,
    easing: "easeOut",
    pathKind: "line",
    x: 0,
    y: 0,
  };
};

const offsetsFromCenter = (
  center: PresentPathPoint,
  points: readonly PresentPathPoint[],
): PresentPathPoint[] => {
  const offsets = points.map((point) => ({
    x: point.x - center.x,
    y: point.y - center.y,
  }));
  if (offsets.length === 0 || Math.hypot(offsets[0].x, offsets[0].y) > 0.5) {
    offsets.unshift({ x: 0, y: 0 });
  } else {
    offsets[0] = { x: 0, y: 0 };
  }
  return offsets;
};

const dropNearDuplicate = (points: PresentPathPoint[]) => {
  if (points.length < 2) {
    return points;
  }
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  if (Math.hypot(last.x - prev.x, last.y - prev.y) < 4) {
    return points.slice(0, -1);
  }
  return points;
};

export const JayrrPresentTranslationOverlay = ({
  deck,
}: {
  deck: PresentDeck;
}) => {
  const api = useExcalidrawAPI();
  const { container } = useExcalidrawContainer();
  const place = useSyncExternalStore(
    subscribePresentTranslationPlace,
    getPresentTranslationPlace,
    getPresentTranslationPlace,
  );
  const [tick, setTick] = useState(0);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<PresentPathPoint[]>([]);
  const drawingRef = useRef(false);
  const draftRef = useRef<PresentPathPoint[]>([]);
  const finishRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!api) {
      return;
    }
    return api.onChange(() => {
      setTick((value) => value + 1);
    });
  }, [api]);

  const scene = useMemo(() => {
    if (!api) {
      return null;
    }
    return {
      elements:
        api.getSceneElements() as readonly NonDeletedExcalidrawElement[],
      appState: api.getAppState(),
    };
    // tick refreshes after zoom/scroll/scene edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, tick]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!place) {
      setPointer(null);
      setDraft([]);
      drawingRef.current = false;
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        stopPresentTranslationPlace();
        return;
      }
      if (event.key === "Enter" && place.pathKind === "spline") {
        event.preventDefault();
        finishRef.current();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [place]);

  if (!api || !container || !scene) {
    return null;
  }

  const toView = (sceneX: number, sceneY: number) => {
    const point = sceneCoordsToViewportCoords(
      { sceneX, sceneY },
      scene.appState,
    );
    const box = container.getBoundingClientRect();
    return { x: point.x - box.left, y: point.y - box.top };
  };

  const persist = (memberIds: readonly string[], next: PresentTranslation) => {
    const targets = new Set(memberIds);
    const all = api.getSceneElementsIncludingDeleted();
    api.updateScene({
      elements: all.map((element) => {
        if (!targets.has(element.id)) {
          return element;
        }
        return newElementWith(element, {
          customData: writePresentTranslation(element, next),
        });
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };

  const placingObject = place
    ? deck.frames
        .flatMap((frame) => frame.objects)
        .find((object) =>
          object.memberIds.some((id) => place.memberIds.includes(id)),
        )
    : null;

  const commitPath = (scenePoints: readonly PresentPathPoint[]) => {
    if (!place || !placingObject) {
      stopPresentTranslationPlace();
      return;
    }
    const center = presentObjectCenter(placingObject, scene.elements);
    if (!center || scenePoints.length === 0) {
      stopPresentTranslationPlace();
      return;
    }
    const path = offsetsFromCenter(center, scenePoints);
    const last = path[path.length - 1];
    const base = moveBase(placingObject.translation);
    const next: PresentTranslation = {
      ...base,
      pathKind: place.pathKind,
      x: last.x,
      y: last.y,
    };
    if (place.pathKind === "line") {
      delete next.path;
    } else {
      next.path = path;
    }
    persist(place.memberIds, next);
    stopPresentTranslationPlace();
  };

  finishRef.current = () => {
    commitPath(dropNearDuplicate([...draftRef.current]));
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!place) {
      return;
    }
    const scenePoint = viewportCoordsToSceneCoords(event, scene.appState);
    setPointer({ x: scenePoint.x, y: scenePoint.y });
    if (!drawingRef.current || place.pathKind !== "draw") {
      return;
    }
    setDraft((current) => {
      const last = current[current.length - 1];
      if (
        last &&
        Math.hypot(scenePoint.x - last.x, scenePoint.y - last.y) < DRAW_STEP
      ) {
        return current;
      }
      return [...current, { x: scenePoint.x, y: scenePoint.y }];
    });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!place || !placingObject) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const scenePoint = viewportCoordsToSceneCoords(event, scene.appState);
    if (place.pathKind === "draw") {
      drawingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDraft([{ x: scenePoint.x, y: scenePoint.y }]);
      return;
    }
    if (place.pathKind === "spline") {
      setDraft((current) => [...current, { x: scenePoint.x, y: scenePoint.y }]);
      return;
    }
    const center = presentObjectCenter(placingObject, scene.elements);
    if (!center) {
      stopPresentTranslationPlace();
      return;
    }
    commitPath([{ x: scenePoint.x, y: scenePoint.y }]);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!place || place.pathKind !== "draw" || !drawingRef.current) {
      return;
    }
    drawingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    commitPath(draftRef.current);
  };

  const onDoubleClick = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!place || place.pathKind !== "spline") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    finishRef.current();
  };

  const viewPoints = (scenePoints: readonly PresentPathPoint[]) =>
    scenePoints.map((point) => toView(point.x, point.y));

  const placeHint =
    place?.pathKind === "spline"
      ? "Click to add points. Enter or double-click finishes. Esc cancels."
      : place?.pathKind === "draw"
      ? "Drag to draw the path. Esc cancels."
      : "Click where this should move. Esc cancels.";

  return createPortal(
    <div
      className={`jayrr-present-translation${place ? " is-placing" : ""}`}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <svg className="jayrr-present-translation__svg">
        {deck.frames.flatMap((frame) =>
          frame.objects.map((object) => {
            if (!isPresentMove(object.translation)) {
              return null;
            }
            const center = presentObjectCenter(object, scene.elements);
            if (!center) {
              return null;
            }
            const placingThis = Boolean(
              place &&
                object.memberIds.some((id) => place.memberIds.includes(id)),
            );
            if (placingThis) {
              return null;
            }
            const points = presentTranslationPoints(object.translation).map(
              (point) => ({
                x: center.x + point.x,
                y: center.y + point.y,
              }),
            );
            return (
              <TranslationTrail
                key={object.id}
                points={viewPoints(points)}
                kind={object.translation.pathKind ?? "line"}
                showHandles={object.translation.pathKind === "spline"}
              />
            );
          }),
        )}
        {place && placingObject
          ? (() => {
              const center = presentObjectCenter(placingObject, scene.elements);
              if (!center) {
                return null;
              }
              const kind = place.pathKind;
              const scenePoints: PresentPathPoint[] = [
                { x: center.x, y: center.y },
                ...draft,
              ];
              if (pointer && kind !== "draw") {
                scenePoints.push(pointer);
              }
              if (kind === "draw" && pointer && drawingRef.current) {
                const last = draft[draft.length - 1];
                if (
                  !last ||
                  Math.hypot(pointer.x - last.x, pointer.y - last.y) >= 1
                ) {
                  scenePoints.push(pointer);
                }
              }
              return (
                <TranslationTrail
                  key="draft"
                  points={viewPoints(scenePoints)}
                  kind={kind}
                  active
                  showHandles={kind === "spline"}
                />
              );
            })()
          : null}
      </svg>
      {place ? (
        <p className="jayrr-present-translation__hint">{placeHint}</p>
      ) : null}
    </div>,
    container,
  );
};
