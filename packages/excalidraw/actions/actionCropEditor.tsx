import {
  CROP_ASPECT_RATIO_FREE,
  CROP_ASPECT_RATIO_ORIGINAL,
  CROP_ASPECT_RATIO_PRESETS,
  CaptureUpdateAction,
  cropImageToAspectRatio,
  getCropWidthAspectRatio,
  isCropAspectRatioId,
  isImageElement,
  isInitializedImageElement,
  newElementWith,
} from "@excalidraw/element";

import type { ExcalidrawImageElement } from "@excalidraw/element/types";

import { RadioSelection } from "../components/RadioSelection";
import { cropIcon, resizeIcon } from "../components/icons";
import { t } from "../i18n";

import { register } from "./register";

import type { AppClassProperties } from "../types";

const getImageNaturalSize = (
  app: AppClassProperties,
  element: ExcalidrawImageElement,
) => {
  if (!isInitializedImageElement(element)) {
    return null;
  }
  const image = app.imageCache.get(element.fileId)?.image;
  if (!image || image instanceof Promise) {
    return null;
  }
  return {
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
  };
};

export const actionToggleCropEditor = register({
  name: "cropEditor",
  label: (elements, appState) => {
    if (appState.croppingElementId) {
      return "labels.resizeMode";
    }
    return "helpDialog.cropStart";
  },
  icon: cropIcon,
  viewMode: true,
  trackEvent: { category: "menu" },
  keywords: ["image", "crop", "resize"],
  perform(elements, appState, value, app) {
    const selectedElement = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
    })[0];

    if (!selectedElement || !isImageElement(selectedElement)) {
      return false;
    }

    const shouldEnterCrop =
      value === "crop" || (value == null && !appState.croppingElementId);

    if (!shouldEnterCrop) {
      return {
        appState: {
          ...appState,
          isCropping: false,
          croppingElementId: null,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    }

    return {
      appState: {
        ...appState,
        isCropping: false,
        croppingElementId: selectedElement.id,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    if (selectedElements.length !== 1) {
      return false;
    }
    return isImageElement(selectedElements[0]);
  },
  PanelComponent: ({ appState, updateData }) => {
    const isCropping = Boolean(appState.croppingElementId);
    const buttons = (
      <div className="buttonList">
        <RadioSelection
          type="button"
          options={[
            {
              value: "resize" as const,
              text: t("labels.resizeMode"),
              icon: resizeIcon,
              testId: "image-transform-resize",
            },
            {
              value: "crop" as const,
              text: t("labels.cropMode"),
              icon: cropIcon,
              testId: "image-transform-crop",
            },
          ]}
          value={isCropping ? "crop" : "resize"}
          onClick={(nextValue) => updateData(nextValue)}
        />
      </div>
    );

    return (
      <fieldset>
        <legend>{t("labels.imageTransform")}</legend>
        {buttons}
      </fieldset>
    );
  },
});

export const actionChangeCropAspectRatio = register({
  name: "changeCropAspectRatio",
  label: "labels.cropAspectRatio",
  trackEvent: { category: "element" },
  keywords: ["image", "crop", "aspect", "ratio"],
  perform(elements, appState, value, app) {
    if (typeof value !== "string" || !isCropAspectRatioId(value)) {
      return false;
    }

    const croppingElement = appState.croppingElementId
      ? app.scene.getNonDeletedElementsMap().get(appState.croppingElementId)
      : undefined;

    if (!croppingElement || !isImageElement(croppingElement)) {
      return {
        appState: {
          ...appState,
          cropAspectRatio: value,
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    const widthAspectRatio = getCropWidthAspectRatio(value, croppingElement);
    if (value === CROP_ASPECT_RATIO_FREE || widthAspectRatio == null) {
      return {
        appState: {
          ...appState,
          cropAspectRatio: value,
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    const naturalSize = getImageNaturalSize(app, croppingElement);
    if (!naturalSize) {
      return {
        appState: {
          ...appState,
          cropAspectRatio: value,
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    const nextCrop = cropImageToAspectRatio(
      croppingElement,
      widthAspectRatio,
      naturalSize.naturalWidth,
      naturalSize.naturalHeight,
    );

    return {
      elements: elements.map((element) => {
        if (element.id !== croppingElement.id) {
          return element;
        }
        return newElementWith(croppingElement, nextCrop);
      }),
      appState: {
        ...appState,
        cropAspectRatio: value,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState, _, app) => {
    if (!appState.croppingElementId) {
      return false;
    }
    const selectedElements = app.scene.getSelectedElements(appState);
    if (selectedElements.length !== 1) {
      return false;
    }
    return isImageElement(selectedElements[0]);
  },
  PanelComponent: ({ appState, updateData }) => {
    const value = appState.cropAspectRatio ?? CROP_ASPECT_RATIO_FREE;

    return (
      <fieldset>
        <legend>{t("labels.cropAspectRatio")}</legend>
        <select
          className="dropdown-select"
          value={value}
          aria-label={t("labels.cropAspectRatio")}
          data-testid="crop-aspect-ratio"
          onChange={(event) => updateData(event.target.value)}
        >
          <option value={CROP_ASPECT_RATIO_FREE}>
            {t("labels.cropAspectRatioFree")}
          </option>
          <option value={CROP_ASPECT_RATIO_ORIGINAL}>
            {t("labels.cropAspectRatioOriginal")}
          </option>
          {CROP_ASPECT_RATIO_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.id}
            </option>
          ))}
        </select>
      </fieldset>
    );
  },
});
