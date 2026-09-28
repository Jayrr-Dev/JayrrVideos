import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { useEffect, useState } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  DEFAULT_CHECKBOX,
  readCheckboxConfig,
  writeCheckboxConfig,
  type CheckboxConfig,
} from "./checkboxConfig";

import "./CheckboxWidget.scss";

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

  return (
    <div
      className={`jayrr-called-embed jayrr-checkbox-embed${
        config.checked ? " is-checked" : ""
      }`}
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
          persist({ checked: !config.checked });
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12.5 10 17.5 19 7" />
        </svg>
      </button>
    </div>
  );
};
