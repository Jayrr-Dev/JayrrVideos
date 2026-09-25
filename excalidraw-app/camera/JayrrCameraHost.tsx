import { newElementWith } from "@excalidraw/element";
import { CaptureUpdateAction, useExcalidrawAPI } from "@excalidraw/excalidraw";
import { setLiveMediaPainter } from "@excalidraw/excalidraw/liveMedia";
import { useEffect } from "react";

import { getJayrrPhoneClientId } from "../collab/jayrrCollabVideoSession";

import { jayrrStreamOwnerId, readJayrrCamera } from "./jayrrCamera";
import { jayrrCameraAction } from "./jayrrCameraAction";
import { JayrrCameraCropOverlay } from "./JayrrCameraCropOverlay";
import { paintJayrrCameraLive } from "./jayrrCameraLive";
import { JayrrCameraOverlay } from "./JayrrCameraOverlay";

export const JayrrCameraHost = ({
  presenting = false,
}: {
  presenting?: boolean;
}) => {
  const api = useExcalidrawAPI();

  useEffect(() => {
    if (!api) {
      return;
    }
    api.registerAction(jayrrCameraAction);
    api.refresh();
  }, [api]);

  useEffect(() => {
    setLiveMediaPainter(paintJayrrCameraLive);
    return () => {
      setLiveMediaPainter(null);
    };
  }, []);

  useEffect(() => {
    if (!api) {
      return;
    }
    return api.onChange((elements) => {
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
        const bucket = owner === clientId ? owned : foreign;
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
        appState: selectionChanged
          ? { selectedElementIds: selected }
          : undefined,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    });
  }, [api]);

  return (
    <>
      <JayrrCameraOverlay presenting={presenting} />
      <JayrrCameraCropOverlay />
    </>
  );
};
