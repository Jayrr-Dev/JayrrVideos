import type { ExcalidrawElement } from "@excalidraw/element/types";

import { JAYRR_CALLED_OBJECT_KEY } from "../model";

export type CheckboxConfig = {
  checked: boolean;
};

export const DEFAULT_CHECKBOX: CheckboxConfig = {
  checked: false,
};

export const readCheckboxConfig = (
  element: Pick<ExcalidrawElement, "customData">,
): CheckboxConfig => {
  const bag = element.customData?.[JAYRR_CALLED_OBJECT_KEY];
  if (!bag || typeof bag !== "object") {
    return DEFAULT_CHECKBOX;
  }
  const checked = (bag as { checked?: unknown }).checked;
  return { checked: checked === true };
};

export const writeCheckboxConfig = (
  element: Pick<ExcalidrawElement, "customData">,
  config: CheckboxConfig,
): ExcalidrawElement["customData"] => {
  const previous = element.customData?.[JAYRR_CALLED_OBJECT_KEY];
  const bag: Record<string, unknown> =
    previous && typeof previous === "object"
      ? { ...(previous as Record<string, unknown>) }
      : {};
  bag.kind = "checkbox";
  bag.checked = config.checked;
  delete bag.label;
  return {
    ...(element.customData ?? {}),
    [JAYRR_CALLED_OBJECT_KEY]: bag,
  };
};
