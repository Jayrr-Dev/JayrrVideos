import { isNonDeletedElement } from "@excalidraw/element";
import {
  sceneCoordsToViewportCoords,
  useExcalidrawAPI,
} from "@excalidraw/excalidraw";
import { useExcalidrawContainer } from "@excalidraw/excalidraw/components/App";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import {
  canConfigureJayrrFrame,
  readJayrrFrame,
  type JayrrFrameGrid,
} from "./jayrrFrame";

import "./JayrrFrameOverlay.scss";

const CROP_RATIOS: Partial<Record<JayrrFrameGrid, readonly [number, number]>> =
  {
    mobile: [9, 16],
    square: [1, 1],
    widescreen: [16, 9],
  };

const centeredCrop = (
  frameWidth: number,
  frameHeight: number,
  ratioWidth: number,
  ratioHeight: number,
) => {
  const frameRatio = frameWidth / Math.max(frameHeight, 1);
  const cropRatio = ratioWidth / ratioHeight;
  if (frameRatio > cropRatio) {
    const width = (cropRatio / frameRatio) * 100;
    return { x: (100 - width) / 2, y: 0, width, height: 100 };
  }
  const height = (frameRatio / cropRatio) * 100;
  return { x: 0, y: (100 - height) / 2, width: 100, height };
};

const CropGuide = ({
  frameWidth,
  frameHeight,
  ratio,
}: {
  frameWidth: number;
  frameHeight: number;
  ratio: readonly [number, number];
}) => {
  const crop = centeredCrop(frameWidth, frameHeight, ratio[0], ratio[1]);
  return (
    <>
      <path
        className="jayrr-frame-grid__dim"
        fillRule="evenodd"
        d={`M0 0H100V100H0Z M${crop.x} ${crop.y}H${crop.x + crop.width}V${
          crop.y + crop.height
        }H${crop.x}Z`}
      />
      <rect
        className="jayrr-frame-grid__crop"
        x={crop.x}
        y={crop.y}
        width={crop.width}
        height={crop.height}
      />
    </>
  );
};

const GridLines = ({
  grid,
  frameWidth,
  frameHeight,
}: {
  grid: JayrrFrameGrid;
  frameWidth: number;
  frameHeight: number;
}) => {
  if (grid === "none") {
    return null;
  }
  const cropRatio = CROP_RATIOS[grid];
  if (cropRatio) {
    return (
      <CropGuide
        frameWidth={frameWidth}
        frameHeight={frameHeight}
        ratio={cropRatio}
      />
    );
  }
  if (grid === "center") {
    return (
      <>
        <line x1="50" y1="0" x2="50" y2="100" />
        <line x1="0" y1="50" x2="100" y2="50" />
      </>
    );
  }
  if (grid === "thirds") {
    return (
      <>
        <line x1="33.333" y1="0" x2="33.333" y2="100" />
        <line x1="66.667" y1="0" x2="66.667" y2="100" />
        <line x1="0" y1="33.333" x2="100" y2="33.333" />
        <line x1="0" y1="66.667" x2="100" y2="66.667" />
      </>
    );
  }
  return (
    <>
      <line x1="25" y1="0" x2="25" y2="100" />
      <line x1="50" y1="0" x2="50" y2="100" />
      <line x1="75" y1="0" x2="75" y2="100" />
      <line x1="0" y1="25" x2="100" y2="25" />
      <line x1="0" y1="50" x2="100" y2="50" />
      <line x1="0" y1="75" x2="100" y2="75" />
    </>
  );
};

const FrameGrid = ({
  element,
  grid,
  appState,
}: {
  element: NonDeletedExcalidrawElement;
  grid: JayrrFrameGrid;
  appState: AppState;
}) => {
  const { container } = useExcalidrawContainer();
  const { x, y } = sceneCoordsToViewportCoords(
    { sceneX: element.x, sceneY: element.y },
    appState,
  );
  const origin = container?.getBoundingClientRect();
  const left = origin ? x - origin.left : x - appState.offsetLeft;
  const top = origin ? y - origin.top : y - appState.offsetTop;
  const scale = appState.zoom.value;

  return (
    <div
      className="jayrr-frame-grid-window"
      style={{
        transform: `translate(${left}px, ${top}px) scale(${scale})`,
        width: `${element.width}px`,
        height: `${element.height}px`,
      }}
    >
      <div
        className="jayrr-frame-grid-window__inner"
        style={{ transform: `rotate(${element.angle}rad)` }}
      >
        <svg
          className={
            appState.theme === "light"
              ? "jayrr-frame-grid is-light"
              : "jayrr-frame-grid"
          }
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <GridLines
            grid={grid}
            frameWidth={element.width}
            frameHeight={element.height}
          />
        </svg>
      </div>
    </div>
  );
};

export const JayrrFrameOverlay = () => {
  const api = useExcalidrawAPI();
  const { container } = useExcalidrawContainer();
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

  const framed = useMemo(() => {
    const next: {
      id: string;
      element: NonDeletedExcalidrawElement;
      grid: JayrrFrameGrid;
    }[] = [];
    for (const element of elements) {
      if (!canConfigureJayrrFrame(element)) {
        continue;
      }
      const settings = readJayrrFrame(element);
      if (settings.grid === "none") {
        continue;
      }
      next.push({ id: element.id, element, grid: settings.grid });
    }
    return next;
  }, [elements]);

  const presenting =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("jayrr-presenting");

  if (
    !container ||
    !appState ||
    framed.length === 0 ||
    presenting ||
    !appState.frameRendering.enabled
  ) {
    return null;
  }

  return createPortal(
    <div className="jayrr-frame-overlay">
      {framed.map((item) => (
        <FrameGrid
          key={item.id}
          element={item.element}
          grid={item.grid}
          appState={appState}
        />
      ))}
    </div>,
    container,
  );
};
