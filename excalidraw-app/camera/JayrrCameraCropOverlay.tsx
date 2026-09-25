import { isNonDeletedElement, newElementWith } from "@excalidraw/element";
import {
  CaptureUpdateAction,
  sceneCoordsToViewportCoords,
  useExcalidrawAPI,
} from "@excalidraw/excalidraw";
import { useExcalidrawContainer } from "@excalidraw/excalidraw/components/App";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { useAtom } from "../app-jotai";

import {
  FULL_DISPLAY_CROP,
  canLinkJayrrCamera,
  isFullDisplayCrop,
  readDisplayCrop,
  readDisplayFit,
  readJayrrCamera,
  writeJayrrCamera,
  type JayrrDisplayCrop,
  type JayrrObjectFit,
} from "./jayrrCamera";
import { getJayrrCameraVideo } from "./jayrrCameraLive";
import {
  DISPLAY_CROP_HANDLES,
  applyDisplayCropHandle,
  desktopCropElementIdAtom,
  fitRect,
  type DisplayCropHandle,
} from "./jayrrDisplayCrop";

import "./JayrrCameraCropOverlay.scss";

const presenting = () =>
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("jayrr-presenting");

const videoBox = (
  element: NonDeletedExcalidrawElement,
  video: HTMLVideoElement | null,
  fit: JayrrObjectFit,
) => {
  const pad = element.strokeWidth;
  const innerW = Math.max(1, element.width - pad * 2);
  const innerH = Math.max(1, element.height - pad * 2);
  const sourceW = video?.videoWidth || innerW;
  const sourceH = video?.videoHeight || innerH;
  const fitted = fitRect(sourceW, sourceH, innerW, innerH, fit);
  return {
    x: pad + fitted.x,
    y: pad + fitted.y,
    width: fitted.width,
    height: fitted.height,
  };
};

const CropEditor = ({
  element,
  appState,
  crop,
  fit,
  onCrop,
  onDone,
}: {
  element: NonDeletedExcalidrawElement;
  appState: AppState;
  crop: JayrrDisplayCrop;
  fit: JayrrObjectFit;
  onCrop: (next: JayrrDisplayCrop, immediate: boolean) => void;
  onDone: () => void;
}) => {
  const { container } = useExcalidrawContainer();
  const dragRef = useRef<{
    handle: DisplayCropHandle;
    start: JayrrDisplayCrop;
    originX: number;
    originY: number;
  } | null>(null);
  const video = getJayrrCameraVideo(element.id);
  const box = videoBox(element, video, fit);
  const { x, y } = sceneCoordsToViewportCoords(
    { sceneX: element.x, sceneY: element.y },
    appState,
  );
  const origin = container?.getBoundingClientRect();
  const left = origin ? x - origin.left : x - appState.offsetLeft;
  const top = origin ? y - origin.top : y - appState.offsetTop;
  const scale = appState.zoom.value;

  const localPoint = (clientX: number, clientY: number) => {
    const host = container?.getBoundingClientRect();
    const pageX = host ? clientX - host.left : clientX;
    const pageY = host ? clientY - host.top : clientY;
    const rawX = (pageX - left) / scale;
    const rawY = (pageY - top) / scale;
    const cx = element.width / 2;
    const cy = element.height / 2;
    const cos = Math.cos(-element.angle);
    const sin = Math.sin(-element.angle);
    const localX = (rawX - cx) * cos - (rawY - cy) * sin + cx;
    const localY = (rawX - cx) * sin + (rawY - cy) * cos + cy;
    return {
      x: (localX - box.x) / Math.max(box.width, 1),
      y: (localY - box.y) / Math.max(box.height, 1),
    };
  };

  const startDrag = (
    handle: DisplayCropHandle,
    event: React.PointerEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const point = localPoint(event.clientX, event.clientY);
    dragRef.current = {
      handle,
      start: crop,
      originX: point.x,
      originY: point.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const point = localPoint(event.clientX, event.clientY);
    onCrop(
      applyDisplayCropHandle(
        crop,
        drag.handle,
        point.x,
        point.y,
        drag.start,
        drag.originX,
        drag.originY,
      ),
      false,
    );
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = null;
    onCrop(crop, true);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      className="jayrr-desktop-crop-window"
      style={{
        transform: `translate(${left}px, ${top}px) scale(${scale})`,
        width: `${element.width}px`,
        height: `${element.height}px`,
      }}
    >
      <div
        className="jayrr-desktop-crop-window__inner"
        style={{ transform: `rotate(${element.angle}rad)` }}
      >
        <div
          className="jayrr-desktop-crop"
          style={{
            left: `${box.x}px`,
            top: `${box.y}px`,
            width: `${box.width}px`,
            height: `${box.height}px`,
          }}
        >
          <svg
            className="jayrr-desktop-crop__dim"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d={`M0 0H100V100H0Z M${crop.x * 100} ${crop.y * 100}H${
                (crop.x + crop.width) * 100
              }V${(crop.y + crop.height) * 100}H${crop.x * 100}Z`}
            />
          </svg>
          <div
            className="jayrr-desktop-crop__frame"
            style={{
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.width * 100}%`,
              height: `${crop.height * 100}%`,
            }}
            onPointerDown={(event) => startDrag("move", event)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {DISPLAY_CROP_HANDLES.map((handle) => (
              <span
                key={handle}
                className={`jayrr-desktop-crop__handle is-${handle}`}
                onPointerDown={(event) => startDrag(handle, event)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
            ))}
          </div>
          <button
            type="button"
            className="jayrr-desktop-crop__done"
            onClick={onDone}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export const JayrrCameraCropOverlay = () => {
  const api = useExcalidrawAPI();
  const { container } = useExcalidrawContainer();
  const [elementId, setElementId] = useAtom(desktopCropElementIdAtom);
  const [elements, setElements] = useState<
    readonly NonDeletedExcalidrawElement[]
  >([]);
  const [appState, setAppState] = useState<AppState | null>(null);

  useEffect(() => {
    if (!api) {
      return;
    }
    setElements(api.getSceneElements());
    setAppState(api.getAppState());
    const offChange = api.onChange((nextElements, nextState) => {
      setElements(nextElements.filter(isNonDeletedElement));
      setAppState(nextState);
    });
    const offScroll = api.onScrollChange(() => {
      setAppState(api.getAppState());
    });
    return () => {
      offChange();
      offScroll();
    };
  }, [api]);

  useEffect(() => {
    if (!elementId || !api) {
      return;
    }
    api.requestLiveRender();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setElementId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      api.requestLiveRender();
    };
  }, [api, elementId, setElementId]);

  const target = useMemo(() => {
    if (!elementId) {
      return null;
    }
    const element = elements.find((item) => item.id === elementId);
    if (!element || !canLinkJayrrCamera(element)) {
      return null;
    }
    const camera = readJayrrCamera(element);
    if (!camera) {
      return null;
    }
    return {
      element,
      crop: readDisplayCrop(camera) ?? FULL_DISPLAY_CROP,
      fit: readDisplayFit(camera),
    };
  }, [elementId, elements]);

  useEffect(() => {
    if (!elementId || !appState) {
      return;
    }
    if (presenting()) {
      setElementId(null);
      return;
    }
    if (!appState.selectedElementIds[elementId]) {
      setElementId(null);
    }
  }, [appState, elementId, setElementId]);

  if (!api || !container || !appState || !target || presenting()) {
    return null;
  }

  const writeCrop = (next: JayrrDisplayCrop, immediate: boolean) => {
    const camera = readJayrrCamera(target.element);
    if (!camera) {
      return;
    }
    const customData = writeJayrrCamera(target.element, {
      ...camera,
      crop: isFullDisplayCrop(next) ? undefined : next,
    });
    api.updateScene({
      elements: api.getSceneElementsIncludingDeleted().map((element) => {
        if (element.id !== target.element.id) {
          return element;
        }
        return newElementWith(element, { customData }, true);
      }),
      captureUpdate: immediate
        ? CaptureUpdateAction.IMMEDIATELY
        : CaptureUpdateAction.EVENTUALLY,
    });
  };

  return createPortal(
    <div className="jayrr-desktop-crop-overlay">
      <CropEditor
        element={target.element}
        appState={appState}
        crop={target.crop}
        fit={target.fit}
        onCrop={writeCrop}
        onDone={() => setElementId(null)}
      />
    </div>,
    container,
  );
};
