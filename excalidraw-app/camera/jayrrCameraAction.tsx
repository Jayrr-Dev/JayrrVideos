import { isTextElement, newElementWith } from "@excalidraw/element";
import {
  CaptureUpdateAction,
  useStylesPanelMode,
} from "@excalidraw/excalidraw";
import { useExcalidrawContainer } from "@excalidraw/excalidraw/components/App";
import { getDropdownMenuItemClassName } from "@excalidraw/excalidraw/components/dropdownMenu/common";
import { getSelectedElements } from "@excalidraw/excalidraw/scene";
import { Popover } from "radix-ui";
import { useEffect, useState, type ReactNode } from "react";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";
import type { Action } from "@excalidraw/excalidraw/actions/types";

import { IconButton, Island, RadioButton } from "../components/ui";

import {
  JAYRR_DISPLAY_SOURCE,
  JAYRR_DISPLAY_SURFACES,
  canLinkJayrrCamera,
  isJayrrDisplay,
  jayrrCameraLabel,
  jayrrDisplaySurfaceLabel,
  readJayrrCamera,
  writeJayrrCamera,
  type JayrrCamera,
  type JayrrDisplaySurface,
} from "./jayrrCamera";
import { stopJayrrDisplay, unlockJayrrCameras } from "./jayrrCameraStreams";

import "./JayrrCameraOverlay.scss";

const cameraIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    width="20"
    height="20"
    viewBox="0 0 20 20"
  >
    <path
      d="M3.4 7.1h1.9l1.15-1.7h7.1l1.15 1.7h1.9A1.5 1.5 0 0 1 18.1 8.6v6.2a1.5 1.5 0 0 1-1.5 1.5H3.4a1.5 1.5 0 0 1-1.5-1.5V8.6a1.5 1.5 0 0 1 1.5-1.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <circle
      cx="10"
      cy="11.5"
      r="2.45"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

const desktopIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    width="20"
    height="20"
    viewBox="0 0 20 20"
  >
    <rect
      x="2.5"
      y="3.8"
      width="15"
      height="9.6"
      rx="1.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M10 13.4v2.6M6.8 16.4h6.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const MenuItem = ({
  selected,
  children,
  onSelect,
}: {
  selected: boolean;
  children: ReactNode;
  onSelect: () => void;
}) => (
  <button
    type="button"
    role="option"
    aria-selected={selected}
    className={getDropdownMenuItemClassName("", selected)}
    onClick={onSelect}
  >
    <span className="dropdown-menu-item__text">{children}</span>
  </button>
);

const StreamChoice = ({
  title,
  icon,
  active,
  compact,
  disabled,
  onOpen,
  children,
}: {
  title: string;
  icon: ReactNode;
  active: boolean;
  compact: boolean;
  disabled: boolean;
  onOpen?: () => void;
  children: (close: () => void) => ReactNode;
}) => {
  const { container } = useExcalidrawContainer();
  const layerUi = container?.querySelector<HTMLElement>(".layer-ui__wrapper");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const trigger = compact ? (
    <IconButton
      type="button"
      icon={icon}
      className={active || open ? "ToolIcon--checked" : undefined}
      disabled={disabled}
      aria-label={title}
      title={title}
    />
  ) : (
    <RadioButton
      icon={<>{icon}</>}
      title={title}
      active={active}
      onClick={() => {}}
    />
  );

  return (
    <Popover.Root
      open={open}
      modal={false}
      onOpenChange={(next) => {
        if (disabled && next) {
          return;
        }
        setOpen(next);
        if (next) {
          onOpen?.();
        }
      }}
    >
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal container={layerUi ?? container}>
        <Popover.Content
          className="jayrr-camera-picker__menu dropdown-menu"
          align="start"
          side="bottom"
          sideOffset={4}
          data-prevent-outside-click
          style={{ zIndex: "var(--zIndex-ui-styles-popup)" }}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <Island className="dropdown-menu-container" padding={2}>
            {children(close)}
          </Island>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

const sourceValue = (camera: JayrrCamera | null) => {
  if (!camera) {
    return "";
  }
  if (isJayrrDisplay(camera)) {
    return JAYRR_DISPLAY_SOURCE;
  }
  return camera.deviceId;
};

const cameraFromValue = (
  value: unknown,
  devices: readonly MediaDeviceInfo[] = [],
): JayrrCamera | null => {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "object" && value && "off" in value) {
    return null;
  }
  if (typeof value === "object" && value && "kind" in value) {
    const bag = value as JayrrCamera;
    if (bag.kind === "display") {
      const surface =
        "surface" in bag &&
        typeof bag.surface === "string" &&
        (JAYRR_DISPLAY_SURFACES as readonly string[]).includes(bag.surface)
          ? (bag.surface as JayrrDisplaySurface)
          : undefined;
      return {
        kind: "display",
        nonce: Date.now(),
        surface,
        label: jayrrCameraLabel(bag) ?? jayrrDisplaySurfaceLabel(surface),
      };
    }
    if ("deviceId" in bag && typeof bag.deviceId === "string" && bag.deviceId) {
      return {
        kind: "camera",
        deviceId: bag.deviceId,
        label: bag.label,
      };
    }
  }
  if (typeof value !== "string") {
    return null;
  }
  if (value === JAYRR_DISPLAY_SOURCE) {
    return { kind: "display", nonce: Date.now(), label: "Screen" };
  }
  const device = devices.find((item) => item.deviceId === value);
  return {
    kind: "camera",
    deviceId: value,
    label: device?.label || undefined,
  };
};

const withBoundName = (
  elements: readonly ExcalidrawElement[],
  targetId: string,
  camera: JayrrCamera | null,
  previous: JayrrCamera | null,
): readonly ExcalidrawElement[] => {
  const name = jayrrCameraLabel(camera);
  if (!name) {
    return elements;
  }
  const target = elements.find((element) => element.id === targetId);
  const boundId = target?.boundElements?.find(
    (bound) => bound.type === "text",
  )?.id;
  if (!boundId) {
    return elements;
  }
  const previousName = jayrrCameraLabel(previous);
  return elements.map((element): ExcalidrawElement => {
    if (element.id !== boundId || !isTextElement(element)) {
      return element;
    }
    const label: ExcalidrawTextElement = element;
    const current = label.originalText || label.text;
    if (current && previousName && current !== previousName) {
      return element;
    }
    if (current && !previousName && current.trim() !== "") {
      return element;
    }
    return newElementWith(label, {
      text: name,
      originalText: name,
    });
  });
};

const StreamFields = ({
  compact,
  source,
  sourceLabel,
  displaySurface,
  devices,
  disabled,
  error,
  onCameraChange,
  onDesktopChange,
  onChangeSource,
  onUnlock,
}: {
  compact: boolean;
  source: string;
  sourceLabel: string | null;
  displaySurface: JayrrDisplaySurface | undefined;
  devices: MediaDeviceInfo[];
  disabled: boolean;
  error: string | null;
  onCameraChange: (next: string) => void;
  onDesktopChange: (surface: JayrrDisplaySurface | null) => void;
  onChangeSource: () => void;
  onUnlock: () => void;
}) => {
  const namedDevices = devices.filter((device) => device.deviceId);
  const cameraSource = source === JAYRR_DISPLAY_SOURCE ? "" : source;
  const desktopOn = source === JAYRR_DISPLAY_SOURCE;
  const cameraOn = Boolean(cameraSource);
  const linkedMissing = Boolean(
    cameraSource &&
      !namedDevices.some((device) => device.deviceId === cameraSource),
  );
  const cameraChoice = (
    <StreamChoice
      title="Camera"
      icon={cameraIcon}
      active={cameraOn}
      compact={compact}
      disabled={disabled}
      onOpen={onUnlock}
    >
      {(close) => (
        <>
          {error ? (
            <span className="jayrr-camera-picker__error">{error}</span>
          ) : null}
          <MenuItem
            selected={!cameraOn}
            onSelect={() => {
              if (cameraOn) {
                onCameraChange("");
              }
              close();
            }}
          >
            Off
          </MenuItem>
          {linkedMissing ? (
            <MenuItem
              selected
              onSelect={() => {
                close();
              }}
            >
              {sourceLabel || "Linked camera"}
            </MenuItem>
          ) : null}
          {namedDevices.map((device, index) => (
            <MenuItem
              key={device.deviceId}
              selected={device.deviceId === cameraSource}
              onSelect={() => {
                onCameraChange(device.deviceId);
                close();
              }}
            >
              {device.label || `Camera ${index + 1}`}
            </MenuItem>
          ))}
        </>
      )}
    </StreamChoice>
  );
  const desktopChoice = (
    <StreamChoice
      title="Desktop"
      icon={desktopIcon}
      active={desktopOn}
      compact={compact}
      disabled={false}
    >
      {(close) => (
        <>
          <MenuItem
            selected={!desktopOn}
            onSelect={() => {
              if (desktopOn) {
                onDesktopChange(null);
              }
              close();
            }}
          >
            Off
          </MenuItem>
          {JAYRR_DISPLAY_SURFACES.map((surface) => (
            <MenuItem
              key={surface}
              selected={desktopOn && displaySurface === surface}
              onSelect={() => {
                onDesktopChange(surface);
                close();
              }}
            >
              {jayrrDisplaySurfaceLabel(surface)}
            </MenuItem>
          ))}
          {desktopOn ? (
            <MenuItem
              selected={false}
              onSelect={() => {
                onChangeSource();
                close();
              }}
            >
              Change source
            </MenuItem>
          ) : null}
        </>
      )}
    </StreamChoice>
  );
  const choices = compact ? (
    <>
      <div className="compact-action-item">{cameraChoice}</div>
      <div className="compact-action-item">{desktopChoice}</div>
    </>
  ) : (
    <div className="buttonList">
      {cameraChoice}
      {desktopChoice}
    </div>
  );

  if (compact) {
    return choices;
  }

  return (
    <>
      {choices}
      {error ? (
        <span className="jayrr-camera-picker__error">{error}</span>
      ) : null}
    </>
  );
};

const CameraPanel = ({
  source,
  sourceLabel,
  displaySurface,
  onChange,
}: {
  source: string;
  sourceLabel: string | null;
  displaySurface: JayrrDisplaySurface | undefined;
  onChange: (next: unknown) => void;
}) => {
  const mode = useStylesPanelMode();
  const compact = mode !== "full";
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const unlock = async () => {
    setLoading(true);
    setError(null);
    try {
      setDevices(await unlockJayrrCameras());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not read cameras. Allow camera access and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void unlock();
  }, []);

  const pickCamera = (next: string) => {
    if (!next) {
      onChange({ off: true });
      return;
    }
    const device = devices.find((item) => item.deviceId === next);
    onChange({
      kind: "camera",
      deviceId: next,
      label: device?.label || sourceLabel || undefined,
    });
  };

  const pickDesktop = (surface: JayrrDisplaySurface | null) => {
    if (surface) {
      onChange({
        kind: "display",
        surface,
        label: jayrrDisplaySurfaceLabel(surface),
      });
      return;
    }
    onChange({ off: true });
  };

  const changeSource = () => {
    onChange({
      kind: "display",
      surface: displaySurface ?? "monitor",
      label: jayrrDisplaySurfaceLabel(displaySurface),
    });
  };

  const fields = (
    <StreamFields
      compact={compact}
      source={source}
      sourceLabel={sourceLabel}
      displaySurface={displaySurface}
      devices={devices}
      disabled={loading && devices.length === 0}
      error={error}
      onCameraChange={pickCamera}
      onDesktopChange={pickDesktop}
      onChangeSource={changeSource}
      onUnlock={() => {
        void unlock();
      }}
    />
  );

  if (compact) {
    return fields;
  }

  return (
    <fieldset className="jayrr-camera-picker">
      <legend>Stream</legend>
      {fields}
    </fieldset>
  );
};

export const jayrrCameraAction: Action = {
  name: "jayrrCamera",
  label: "Stream",
  trackEvent: false,
  predicate: (elements, appState) => {
    const selected = getSelectedElements(elements, appState);
    return selected.length === 1 && canLinkJayrrCamera(selected[0]);
  },
  perform: (elements, appState, value) => {
    const selected = getSelectedElements(elements, appState);
    if (selected.length !== 1 || !canLinkJayrrCamera(selected[0])) {
      return false;
    }
    const targetId = selected[0].id;
    const previous = readJayrrCamera(selected[0]);
    const next = cameraFromValue(value);
    if (isJayrrDisplay(previous) && !isJayrrDisplay(next)) {
      stopJayrrDisplay(targetId);
    }
    const patched = elements.map((element) => {
      if (element.id !== targetId) {
        return element;
      }
      const customData = writeJayrrCamera(element, next);
      return newElementWith(element, { customData }, true);
    });
    return {
      elements: withBoundName(patched, targetId, next, previous),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => {
    const selected = getSelectedElements(elements, appState);
    if (selected.length !== 1 || !canLinkJayrrCamera(selected[0])) {
      return null;
    }
    const camera = readJayrrCamera(selected[0]);
    return (
      <CameraPanel
        source={sourceValue(camera)}
        sourceLabel={jayrrCameraLabel(camera)}
        displaySurface={isJayrrDisplay(camera) ? camera.surface : undefined}
        onChange={(next) => updateData(next)}
      />
    );
  },
};
