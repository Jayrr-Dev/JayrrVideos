import {
  getElementsInResizingFrame,
  isFrameLikeElement,
  replaceAllElementsInFrame,
} from "@excalidraw/element";
import {
  CaptureUpdateAction,
  newElementWith,
  useStylesPanelMode,
} from "@excalidraw/excalidraw";
import { useExcalidrawContainer } from "@excalidraw/excalidraw/components/App";
import { getDropdownMenuItemClassName } from "@excalidraw/excalidraw/components/dropdownMenu/common";
import { getSelectedElements } from "@excalidraw/excalidraw/scene";
import { Popover } from "radix-ui";
import { useState } from "react";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";
import type { Action } from "@excalidraw/excalidraw/actions/types";

import { IconButton, Island } from "../components/ui";

import {
  JAYRR_FRAME_ASPECTS,
  JAYRR_FRAME_GRIDS,
  applyJayrrFrameAspect,
  canConfigureJayrrFrame,
  readJayrrFrame,
  writeJayrrFrame,
  type JayrrFrameAspect,
  type JayrrFrameGrid,
  type JayrrFrameSettings,
} from "./jayrrFrame";

import "./JayrrFrameOverlay.scss";

const frameIcon = (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
    <rect
      x="3"
      y="4.5"
      width="14"
      height="11"
      rx="1.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path
      d="M7.7 4.5v11M12.3 4.5v11M3 8.2h14M3 11.8h14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  </svg>
);

const ASPECT_LABELS: Record<JayrrFrameAspect, string> = {
  free: "Free",
  "16:9": "16:9",
  "9:16": "9:16",
  "4:3": "4:3",
  "3:4": "3:4",
  "1:1": "1:1",
  "4:5": "4:5",
  "21:9": "21:9",
};

const GRID_LABELS: Record<JayrrFrameGrid, string> = {
  none: "Off",
  thirds: "Thirds",
  center: "Center",
  grid: "Grid",
  mobile: "Mobile",
  square: "Square",
  widescreen: "Widescreen",
};

const FrameSelect = <T extends string>({
  id,
  label,
  value,
  values,
  labels,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  values: readonly T[];
  labels: Record<T, string>;
  onChange: (next: T) => void;
}) => {
  const { container } = useExcalidrawContainer();
  const layerUi = container?.querySelector<HTMLElement>(".layer-ui__wrapper");
  const [open, setOpen] = useState(false);
  const labelId = `jayrr-frame-${id}-label`;

  return (
    <div className="jayrr-frame-picker__field">
      <span className="jayrr-frame-picker__label" id={labelId}>
        {label}
      </span>
      <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="dropdown-select jayrr-frame-picker__select"
            aria-labelledby={labelId}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            {labels[value]}
          </button>
        </Popover.Trigger>
        <Popover.Portal container={layerUi ?? container}>
          <Popover.Content
            className="jayrr-frame-picker__menu dropdown-menu"
            align="start"
            side="bottom"
            sideOffset={4}
            data-prevent-outside-click
            style={{ zIndex: "var(--zIndex-ui-styles-popup)" }}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <Island className="dropdown-menu-container" padding={2}>
              {values.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={option === value}
                  className={getDropdownMenuItemClassName("", option === value)}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  <span className="dropdown-menu-item__text">
                    {labels[option]}
                  </span>
                </button>
              ))}
            </Island>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};

const FrameFields = ({
  settings,
  onChange,
}: {
  settings: JayrrFrameSettings;
  onChange: (next: Partial<JayrrFrameSettings>) => void;
}) => (
  <div className="jayrr-frame-picker__fields">
    <FrameSelect
      id="aspect"
      label="Aspect ratio"
      value={settings.aspect}
      values={JAYRR_FRAME_ASPECTS}
      labels={ASPECT_LABELS}
      onChange={(aspect) => onChange({ aspect })}
    />
    <FrameSelect
      id="grid"
      label="Grid overlay"
      value={settings.grid}
      values={JAYRR_FRAME_GRIDS}
      labels={GRID_LABELS}
      onChange={(grid) => onChange({ grid })}
    />
  </div>
);

const FramePanel = ({
  settings,
  onChange,
}: {
  settings: JayrrFrameSettings;
  onChange: (next: Partial<JayrrFrameSettings>) => void;
}) => {
  const mode = useStylesPanelMode();
  const { container } = useExcalidrawContainer();
  const layerUi = container?.querySelector<HTMLElement>(".layer-ui__wrapper");
  const [open, setOpen] = useState(false);
  const fields = <FrameFields settings={settings} onChange={onChange} />;
  const active = settings.aspect !== "free" || settings.grid !== "none";

  if (mode === "full") {
    return (
      <fieldset className="jayrr-frame-picker">
        <legend>Frame</legend>
        {fields}
      </fieldset>
    );
  }

  return (
    <div className="compact-action-item">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <IconButton
            type="toggle"
            icon={frameIcon}
            checked={active}
            aria-label="Frame size and grid"
            title="Frame size and grid"
          />
        </Popover.Trigger>
        <Popover.Portal container={layerUi ?? container}>
          <Popover.Content
            className="jayrr-frame-picker__popover"
            align="start"
            side="bottom"
            sideOffset={6}
            style={{ zIndex: "var(--zIndex-ui-styles-popup)" }}
            onPointerDownOutside={(event) => {
              if (
                event.target instanceof Element &&
                event.target.closest(".jayrr-frame-picker__menu")
              ) {
                event.preventDefault();
              }
            }}
          >
            {fields}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};

export const jayrrFrameAction: Action = {
  name: "jayrrFrame",
  label: "Frame size and grid",
  trackEvent: false,
  predicate: (elements, appState) => {
    const selected = getSelectedElements(elements, appState);
    return selected.length === 1 && canConfigureJayrrFrame(selected[0]);
  },
  perform: (elements, appState, value, app) => {
    const selected = getSelectedElements(elements, appState);
    if (selected.length !== 1 || !canConfigureJayrrFrame(selected[0])) {
      return false;
    }
    const targetId = selected[0].id;
    const patch =
      value && typeof value === "object"
        ? (value as Partial<JayrrFrameSettings>)
        : {};
    let nextElements = elements.map((element) => {
      if (element.id !== targetId) {
        return element;
      }
      const current = readJayrrFrame(element);
      const next: JayrrFrameSettings = {
        aspect: patch.aspect ?? current.aspect,
        grid: patch.grid ?? current.grid,
      };
      const customData = writeJayrrFrame(element, next);
      const aspectChanged =
        patch.aspect !== undefined && patch.aspect !== current.aspect;
      const size = aspectChanged
        ? applyJayrrFrameAspect(element, next.aspect)
        : null;
      const clearCustomData = customData == null && size == null;
      if (size) {
        return newElementWith(element, { customData, ...size }, false);
      }
      return newElementWith(element, { customData }, clearCustomData);
    });
    const nextFrame = nextElements.find((element) => element.id === targetId);
    if (nextFrame && isFrameLikeElement(nextFrame)) {
      const resized =
        patch.aspect !== undefined &&
        patch.aspect !== readJayrrFrame(selected[0]).aspect;
      if (resized) {
        nextElements = replaceAllElementsInFrame(
          nextElements,
          getElementsInResizingFrame(
            nextElements,
            nextFrame,
            appState,
            app.scene.getNonDeletedElementsMap(),
          ),
          nextFrame,
        ) as OrderedExcalidrawElement[];
      }
    }
    return {
      elements: nextElements,
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => {
    const selected = getSelectedElements(elements, appState);
    if (selected.length !== 1 || !canConfigureJayrrFrame(selected[0])) {
      return null;
    }
    return (
      <FramePanel
        settings={readJayrrFrame(selected[0])}
        onChange={(next) => updateData(next)}
      />
    );
  },
};
