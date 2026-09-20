import { CaptureUpdateAction, newEmbeddableElement } from "@excalidraw/element";
import { viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

export const JAYRR_RECORDING_DRAG = "application/x-jayrr-present-recording";

export type PresentRecordingDrag = {
  url: string;
  width: number | null;
  height: number | null;
};

const MAX_EMBED_WIDTH = 560;

export const parsePresentRecordingDrag = (
  raw: string,
): PresentRecordingDrag | null => {
  try {
    const data = JSON.parse(raw) as PresentRecordingDrag;
    if (typeof data.url !== "string" || !data.url) {
      return null;
    }
    return {
      url: data.url,
      width: typeof data.width === "number" ? data.width : null,
      height: typeof data.height === "number" ? data.height : null,
    };
  } catch {
    return null;
  }
};

export const insertPresentRecordingAt = (
  api: ExcalidrawImperativeAPI,
  payload: PresentRecordingDrag,
  sceneX: number,
  sceneY: number,
) => {
  const sourceW = payload.width && payload.width > 0 ? payload.width : 1280;
  const sourceH = payload.height && payload.height > 0 ? payload.height : 720;
  const scale = Math.min(1, MAX_EMBED_WIDTH / sourceW);
  const width = Math.max(160, Math.round(sourceW * scale));
  const height = Math.max(90, Math.round(sourceH * scale));
  const element = newEmbeddableElement({
    type: "embeddable",
    x: sceneX - width / 2,
    y: sceneY - height / 2,
    width,
    height,
    link: payload.url,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    roughness: 0,
  });
  api.updateScene({
    elements: [...api.getSceneElements(), element],
    appState: {
      selectedElementIds: { [element.id]: true },
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
};

export const scenePointFromClient = (
  api: ExcalidrawImperativeAPI,
  clientX: number,
  clientY: number,
) => {
  return viewportCoordsToSceneCoords({ clientX, clientY }, api.getAppState());
};
