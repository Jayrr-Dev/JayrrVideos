import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { useEffect, useState, type CSSProperties } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { useRegisterWidgetToolbar } from "../widgetToolbarRegistry";

import {
  DEFAULT_CHECKBOX,
  readCheckboxConfig,
  writeCheckboxConfig,
  type CheckboxConfig,
} from "./checkboxConfig";

import "./CheckboxWidget.scss";

const DEFAULT_PICKER_COLOR = "#6965db";

export const CheckboxWidget = ({ elementId }: { elementId: string }) => {
  const api = useExcalidrawAPI();
  const [config, setConfig] = useState<CheckboxConfig>(DEFAULT_CHECKBOX);

  useEffect(() => {
    if (!api) {
      return;
    }
    const sync = (elements: readonly ExcalidrawElement[]) => {
      const element = elements.find((el) => el.id === elementId);
      if (element) {
        setConfig(readCheckboxConfig(element));
      }
    };
    sync(api.getSceneElements());
    return api.onChange((elements) => sync(elements));
  }, [api, elementId]);

  const persist = (next: CheckboxConfig) => {
    if (!api) {
      return;
    }
    api.updateScene({
      elements: api
        .getSceneElements()
        .map((el) =>
          el.id === elementId
            ? newElementWith(el, { customData: writeCheckboxConfig(el, next) })
            : el,
        ),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    setConfig(next);
  };

  useRegisterWidgetToolbar(
    elementId,
    () => (
      <label className="jayrr-checkbox-color" title="Checkbox color">
        <input
          type="color"
          aria-label="Checkbox color"
          value={config.color || DEFAULT_PICKER_COLOR}
          onChange={(event) =>
            persist({ ...config, color: event.target.value })
          }
          onKeyDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        />
      </label>
    ),
    [config],
  );

  return (
    <div
      className={`jayrr-called-embed jayrr-checkbox-embed${
        config.checked ? " is-checked" : ""
      }`}
      style={
        config.color
          ? ({ "--jayrr-checkbox-color": config.color } as CSSProperties)
          : undefined
      }
      data-element-id={elementId}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={config.checked}
        aria-label="Checkbox"
        className="jayrr-checkbox-embed__box"
        onClick={(event) => {
          event.stopPropagation();
          persist({ ...config, checked: !config.checked });
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12.5 10 17.5 19 7" />
        </svg>
      </button>
    </div>
  );
};
