import { newElementWith } from "@excalidraw/element";
import { CaptureUpdateAction, useExcalidrawAPI } from "@excalidraw/excalidraw";
import { setLiveMediaPainter } from "@excalidraw/excalidraw/liveMedia";
import { useEffect } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useAtomValue } from "../app-jotai";
import { isCollaboratingAtom } from "../collab/Collab";
import { getJayrrPhoneClientId } from "../collab/jayrrCollabVideoSession";
import { JayrrBgMediaOverlay } from "../domain/background/JayrrBgMediaOverlay";
import { paintJayrrBgMedia } from "../domain/background/jayrrBgMediaLive";

import { jayrrStreamOwnerId, readJayrrCamera } from "./jayrrCamera";
import { jayrrCameraAction } from "./jayrrCameraAction";
import { JayrrCameraCropOverlay } from "./JayrrCameraCropOverlay";
import { JayrrLockedCameraOwner } from "./JayrrLockedCameraOwner";
import { paintJayrrCameraLive } from "./jayrrCameraLive";
import { JayrrCameraOverlay } from "./JayrrCameraOverlay";

const syncJayrrCameraLocks = (
  api: ExcalidrawImperativeAPI,
  elements: readonly ExcalidrawElement[],
  collaborating: boolean,
) => {
  const clientId = getJayrrPhoneClientId();
  const foreign = new Set<string>();
  const owned = new Set<string>();
  for (const element of elements) {
    if (element.isDeleted) {
      continue;
    }
    const owner = jayrrStreamOwnerId(readJayrrCamera(element));
    if (!owner) {
      continue;
    }
    // Solo: leftover collab owner tags must not keep the box locked.
    const bucket = collaborating && owner !== clientId ? foreign : owned;
    bucket.add(element.id);
    for (const bound of element.boundElements ?? []) {
      if (bound.type === "text") {
        bucket.add(bound.id);
      }
    }
  }
  if (foreign.size === 0 && owned.size === 0) {
    return;
  }
  let changed = false;
  const next = elements.map((element) => {
    const lock = foreign.has(element.id);
    const unlock = owned.has(element.id);
    if (!lock && !unlock) {
      return element;
    }
    if (element.locked === lock) {
      return element;
    }
    changed = true;
    return newElementWith(element, {
      locked: lock,
      version: element.version,
      versionNonce: element.versionNonce,
    });
  });
  const selected = { ...api.getAppState().selectedElementIds };
  let selectionChanged = false;
  for (const id of foreign) {
    if (!selected[id]) {
      continue;
    }
    delete selected[id];
    selectionChanged = true;
  }
  if (!changed && !selectionChanged) {
    return;
  }
  api.updateScene({
    elements: next,
    appState: selectionChanged ? { selectedElementIds: selected } : undefined,
    captureUpdate: CaptureUpdateAction.NEVER,
  });
};

export const JayrrCameraHost = ({
  presenting = false,
}: {
  presenting?: boolean;
}) => {
  const api = useExcalidrawAPI();
  const collaborating = useAtomValue(isCollaboratingAtom);

  useEffect(() => {
    if (!api) {
      return;
    }
    api.registerAction(jayrrCameraAction);
    api.refresh();
  }, [api]);

  useEffect(() => {
    setLiveMediaPainter((element, context, appState, renderState) => {
      paintJayrrBgMedia(element, context, appState, renderState);
      paintJayrrCameraLive(element, context, appState, renderState);
    });
    return () => {
      setLiveMediaPainter(null);
    };
  }, []);

  useEffect(() => {
    if (!api) {
      return;
    }
    syncJayrrCameraLocks(
      api,
      api.getSceneElementsIncludingDeleted(),
      collaborating,
    );
    return api.onChange((elements) => {
      syncJayrrCameraLocks(api, elements, collaborating);
    });
  }, [api, collaborating]);

  return (
    <>
      <JayrrBgMediaOverlay />
      <JayrrCameraOverlay presenting={presenting} />
      <JayrrCameraCropOverlay />
      <JayrrLockedCameraOwner />
    </>
  );
};
