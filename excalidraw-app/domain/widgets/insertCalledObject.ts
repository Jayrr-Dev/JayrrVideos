import {
  CaptureUpdateAction,
  newElementWith,
  newEmbeddableElement,
} from "@excalidraw/element";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  CALLED_OBJECTS,
  JAYRR_CALLED_OBJECT_KEY,
  calledObjectLink,
  type CalledObjectDef,
  type CalledObjectKind,
} from "./model";
import {
  DEFAULT_CAPTION,
  newCaptionOverlayElement,
} from "./objects/captionConfig";
import { DEFAULT_CLASSIFIER } from "./objects/classifierConfig";
import { DEFAULT_MARKDOWN } from "./objects/markdownConfig";
import { DEFAULT_PDF } from "./objects/pdfConfig";
import { DEFAULT_TRANSCRIBE } from "./objects/transcribeConfig";
import {
  DEFAULT_TRANSCRIPTION,
  newCaptionTextElement,
} from "./objects/transcriptionConfig";

export const JAYRR_CALLED_OBJECT_DRAG = "application/x-jayrr-called-object";

const payloadFor = (def: CalledObjectDef) => {
  if (def.kind === "classifier") {
    return { kind: def.kind, ...DEFAULT_CLASSIFIER };
  }
  if (def.kind === "transcription") {
    return { kind: def.kind, ...DEFAULT_TRANSCRIPTION };
  }
  if (def.kind === "caption") {
    return { kind: def.kind, ...DEFAULT_CAPTION };
  }
  if (def.kind === "markdown") {
    return { kind: def.kind, ...DEFAULT_MARKDOWN };
  }
  if (def.kind === "pdf") {
    return { kind: def.kind, ...DEFAULT_PDF };
  }
  return { kind: def.kind, ...DEFAULT_TRANSCRIBE };
};

export const parseCalledObjectDrag = (raw: string): CalledObjectKind | null => {
  try {
    const data = JSON.parse(raw) as { kind?: unknown };
    const kind = data.kind;
    if (typeof kind !== "string") {
      return null;
    }
    return CALLED_OBJECTS.some((object) => object.kind === kind)
      ? (kind as CalledObjectKind)
      : null;
  } catch {
    return null;
  }
};

export const defForCalledObjectKind = (
  kind: CalledObjectKind,
): CalledObjectDef | null =>
  CALLED_OBJECTS.find((object) => object.kind === kind) ?? null;

const buildCalledObjectElements = (
  api: ExcalidrawImperativeAPI,
  def: CalledObjectDef,
  originX: number,
  originY: number,
) => {
  const element = newEmbeddableElement({
    type: "embeddable",
    x: originX,
    y: originY,
    width: def.width,
    height: def.height,
    link: calledObjectLink(def.kind),
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    roughness: 0,
    customData: {
      [JAYRR_CALLED_OBJECT_KEY]: payloadFor(def),
    },
  });
  if (def.kind !== "transcription" && def.kind !== "caption") {
    return [element];
  }
  const appState = api.getAppState();
  const caption =
    def.kind === "caption"
      ? newCaptionOverlayElement({
          widgetId: element.id,
          x: originX,
          y: originY + def.height + 28,
          fontSize: appState.currentItemFontSize,
          fontFamily: appState.currentItemFontFamily,
          strokeColor: appState.currentItemStrokeColor,
          opacity: appState.currentItemOpacity,
        })
      : newCaptionTextElement({
          widgetId: element.id,
          x: originX,
          y: originY + def.height + 28,
          fontSize: appState.currentItemFontSize,
          fontFamily: appState.currentItemFontFamily,
          textAlign: appState.currentItemTextAlign,
          strokeColor: appState.currentItemStrokeColor,
          opacity: appState.currentItemOpacity,
        });
  const linked = newElementWith(element, {
    customData: {
      [JAYRR_CALLED_OBJECT_KEY]: {
        kind: def.kind,
        ...(def.kind === "caption" ? DEFAULT_CAPTION : DEFAULT_TRANSCRIPTION),
        textElementId: caption.id,
      },
    },
  });
  return [linked, caption];
};

export const insertCalledObject = (
  api: ExcalidrawImperativeAPI,
  def: CalledObjectDef,
) => {
  const elements = buildCalledObjectElements(api, def, 0, 0);
  api.insertElementsFromLibrary({ elements });
};

export const insertCalledObjectAt = (
  api: ExcalidrawImperativeAPI,
  def: CalledObjectDef,
  sceneX: number,
  sceneY: number,
) => {
  const originX = sceneX - def.width / 2;
  const originY = sceneY - def.height / 2;
  const elements = buildCalledObjectElements(api, def, originX, originY);
  const selectedElementIds: { [id: string]: true } = {};
  for (const element of elements) {
    selectedElementIds[element.id] = true;
  }
  api.updateScene({
    elements: [...api.getSceneElements(), ...elements],
    appState: { selectedElementIds },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
};
