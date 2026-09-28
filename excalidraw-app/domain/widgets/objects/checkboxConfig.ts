import type { ExcalidrawElement } from "@excalidraw/element/types";

import { JAYRR_CALLED_OBJECT_KEY } from "../model";

export type CheckboxConfig = {
  checked: boolean;
  /** Hex color; empty string means the theme's primary color. */
  color: string;
};

export const DEFAULT_CHECKBOX: CheckboxConfig = {
  checked: false,
  color: "",
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const readCheckboxConfig = (
  element: Pick<ExcalidrawElement, "customData">,
): CheckboxConfig => {
  const bag = element.customData?.[JAYRR_CALLED_OBJECT_KEY];
  if (!bag || typeof bag !== "object") {
    return DEFAULT_CHECKBOX;
  }
  const { checked, color } = bag as { checked?: unknown; color?: unknown };
  return {
    checked: checked === true,
    color: typeof color === "string" && HEX_COLOR.test(color) ? color : "",
  };
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
  bag.color = config.color;
  delete bag.label;
  return {
    ...(element.customData ?? {}),
    [JAYRR_CALLED_OBJECT_KEY]: bag,
  };
};
