import {
  getCommonBounds,
  getElementsInGroup,
  isBoundToContainer,
  isNonDeletedElement,
} from "@excalidraw/element";
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
  getJayrrPhoneClientId,
  listJayrrPhonePeople,
  subscribeJayrrPhone,
} from "../collab/jayrrCollabVideoSession";

import {
  jayrrStreamOwnerId,
  jayrrStreamOwnerLabel,
  readJayrrCamera,
} from "./jayrrCamera";

import "./JayrrLockedCameraOwner.scss";

const LOCK_CHIP_GAP_PX = 8;
const LOCK_CHIP_SHIFT_PX = 52;

const lockedElementsFor = (
  activeLockedId: string,
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  const direct = elements.find((element) => element.id === activeLockedId);
  if (direct) {
    return [direct];
  }
  return getElementsInGroup<NonDeletedExcalidrawElement>(
    elements,
    activeLockedId,
  );
};

const cameraOnLocked = (
  locked: readonly NonDeletedExcalidrawElement[],
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  const map = new Map(elements.map((element) => [element.id, element]));
  for (const element of locked) {
    const direct = readJayrrCamera(element);
    if (direct) {
      return direct;
    }
    if (!isBoundToContainer(element)) {
      continue;
    }
    const parent = map.get(element.containerId);
    if (!parent) {
      continue;
    }
    const nested = readJayrrCamera(parent);
    if (nested) {
      return nested;
    }
  }
  return null;
};

export const JayrrLockedCameraOwner = () => {
  const api = useExcalidrawAPI();
  const { container } = useExcalidrawContainer();
  const [elements, setElements] = useState<
    readonly NonDeletedExcalidrawElement[]
  >([]);
  const [appState, setAppState] = useState<AppState | null>(null);
  const [peopleTick, setPeopleTick] = useState(0);

  useEffect(() => {
    if (!api) {
      return;
    }
    setElements(api.getSceneElements().filter(isNonDeletedElement));
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

  useEffect(
    () =>
      subscribeJayrrPhone(() => {
        setPeopleTick((value) => value + 1);
      }),
    [],
  );

  const hint = useMemo(() => {
    void peopleTick;
    if (!appState?.activeLockedId) {
      return null;
    }
    const locked = lockedElementsFor(appState.activeLockedId, elements);
    if (locked.length === 0) {
      return null;
    }
    const camera = cameraOnLocked(locked, elements);
    const ownerId = jayrrStreamOwnerId(camera);
    if (!ownerId || ownerId === getJayrrPhoneClientId()) {
      return null;
    }
    const name = jayrrStreamOwnerLabel(camera, listJayrrPhonePeople());
    if (!name) {
      return null;
    }
    const [x, y] = getCommonBounds(locked);
    return { name, x, y };
  }, [appState, elements, peopleTick]);

  if (!api || !container || !appState || !hint) {
    return null;
  }

  const { x: viewX, y: viewY } = sceneCoordsToViewportCoords(
    { sceneX: hint.x, sceneY: hint.y },
    appState,
  );

  return createPortal(
    <div
      className="jayrr-camera-lock-owner"
      style={{
        bottom: `${appState.height + 12 - viewY + appState.offsetTop}px`,
        left: `${
          viewX - appState.offsetLeft + LOCK_CHIP_SHIFT_PX + LOCK_CHIP_GAP_PX
        }px`,
      }}
      title={`${hint.name}'s camera`}
    >
      {hint.name}
    </div>,
    container,
  );
};
