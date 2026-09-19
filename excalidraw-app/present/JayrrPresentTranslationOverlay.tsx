import {
  CaptureUpdateAction,
  newElementWith,
  sceneCoordsToViewportCoords,
  useExcalidrawAPI,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import { useExcalidrawContainer } from "@excalidraw/excalidraw/components/App";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import {
  JAYRR_PRESENT_TRANSLATION_TIME_DEFAULT,
  writePresentTranslation,
  type PresentDeck,
  type PresentTranslation,
} from "./buildPresentDeck";
import {
  getPresentTranslationPlace,
  presentObjectCenter,
  stopPresentTranslationPlace,
  subscribePresentTranslationPlace,
} from "./presentTranslation";

const TranslationArrow = ({
  from,
  to,
  active,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  active?: boolean;
}) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 2) {
    return (
      <circle
        cx={from.x}
        cy={from.y}
        r={active ? 5 : 4}
        className="jayrr-present-translation__dot"
      />
    );
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
    <g className={active ? "is-active" : undefined}>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
      <polygon
        points={`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`}
      />
      <circle cx={from.x} cy={from.y} r={4} />
    </g>
  );
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
    if (!place) {
      setPointer(null);
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        stopPresentTranslationPlace();
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

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!place) {
      return;
    }
    const scenePoint = viewportCoordsToSceneCoords(event, scene.appState);
    setPointer({ x: scenePoint.x, y: scenePoint.y });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!place || !placingObject) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const center = presentObjectCenter(placingObject, scene.elements);
    if (!center) {
      stopPresentTranslationPlace();
      return;
    }
    const scenePoint = viewportCoordsToSceneCoords(event, scene.appState);
    const current = placingObject.translation;
    const base =
      current?.kind === "move"
        ? current
        : {
            kind: "move" as const,
            time: JAYRR_PRESENT_TRANSLATION_TIME_DEFAULT,
            easing: "easeOut" as const,
            x: 0,
            y: 0,
          };
    persist(place.memberIds, {
      ...base,
      x: scenePoint.x - center.x,
      y: scenePoint.y - center.y,
    });
    stopPresentTranslationPlace();
  };

  return createPortal(
    <div
      className={`jayrr-present-translation${place ? " is-placing" : ""}`}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
    >
      <svg className="jayrr-present-translation__svg">
        {deck.frames.flatMap((frame) =>
          frame.objects.map((object) => {
            if (object.translation?.kind !== "move") {
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
            const dest =
              placingThis && pointer
                ? pointer
                : {
                    x: center.x + object.translation.x,
                    y: center.y + object.translation.y,
                  };
            const from = toView(center.x, center.y);
            const to = toView(dest.x, dest.y);
            return (
              <TranslationArrow
                key={object.id}
                from={from}
                to={to}
                active={placingThis}
              />
            );
          }),
        )}
        {place && placingObject && pointer
          ? (() => {
              const center = presentObjectCenter(placingObject, scene.elements);
              if (!center || placingObject.translation?.kind === "move") {
                return null;
              }
              return (
                <TranslationArrow
                  key="draft"
                  from={toView(center.x, center.y)}
                  to={toView(pointer.x, pointer.y)}
                  active
                />
              );
            })()
          : null}
      </svg>
      {place ? (
        <p className="jayrr-present-translation__hint">
          Click where this should move. Esc cancels.
        </p>
      ) : null}
    </div>,
    container,
  );
};
