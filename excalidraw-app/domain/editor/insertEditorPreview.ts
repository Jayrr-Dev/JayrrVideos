import { CaptureUpdateAction, newEmbeddableElement } from "@excalidraw/element";
import { viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  EDITOR_PREVIEW_HEIGHT,
  EDITOR_PREVIEW_WIDTH,
  JAYRR_EDITOR_PREVIEW_KEY,
  editorPreviewLink,
} from "./editorPreviewModel";

export const insertEditorPreview = (api: ExcalidrawImperativeAPI) => {
  const appState = api.getAppState();
  const center = viewportCoordsToSceneCoords(
    {
      clientX: appState.offsetLeft + appState.width / 2,
      clientY: appState.offsetTop + appState.height / 2,
    },
    appState,
  );
  const width = EDITOR_PREVIEW_WIDTH;
  const height = EDITOR_PREVIEW_HEIGHT;
  const element = newEmbeddableElement({
    type: "embeddable",
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
    link: editorPreviewLink(),
    strokeColor: "transparent",
    backgroundColor: "#0f172a",
    fillStyle: "solid",
    roughness: 0,
    customData: {
      [JAYRR_EDITOR_PREVIEW_KEY]: { kind: "preview" },
    },
  });
  api.updateScene({
    elements: [...api.getSceneElements(), element],
    appState: {
      selectedElementIds: { [element.id]: true },
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return element.id;
};
