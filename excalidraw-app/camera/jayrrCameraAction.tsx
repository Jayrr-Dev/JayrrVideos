import { isTextElement, newElementWith } from "@excalidraw/element";
import {
  CaptureUpdateAction,
  useStylesPanelMode,
} from "@excalidraw/excalidraw";
import { useExcalidrawContainer } from "@excalidraw/excalidraw/components/App";
import { Range } from "@excalidraw/excalidraw/components/Range";
import { getDropdownMenuItemClassName } from "@excalidraw/excalidraw/components/dropdownMenu/common";
import { getSelectedElements } from "@excalidraw/excalidraw/scene";
import { Popover } from "radix-ui";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";
import type { Action } from "@excalidraw/excalidraw/actions/types";

import { useAtomValue, useSetAtom } from "../app-jotai";
import { isCollaboratingAtom } from "../collab/Collab";
import {
  getJayrrPhoneClientId,
  getJayrrPhoneError,
  listJayrrPhonePeople,
  peekJayrrScreenStream,
  setJayrrScreenLocal,
  subscribeJayrrPhone,
} from "../collab/jayrrCollabVideoSession";
import { IconButton, Island, RadioButton } from "../components/ui";
import {
  cameraCutoutOnAtom,
  setSavedCutoutOn,
} from "../domain/flags/cameraCutoutFlag";

import {
  cameraAccessoryAtom,
  setSavedAccessory,
  cameraFunOffsetsAtom,
  DEFAULT_FUN_OFFSET,
  FUN_SCALE_MAX,
  FUN_SCALE_MIN,
  funOffsetFor,
  funScale,
  cameraFunOnAtom,
  cameraLaserOnAtom,
  cameraEyeLasersOnAtom,
  setSavedFunOffsets,
  setSavedFunOn,
  type CameraFunOffset,
  type CameraFunOffsets,
  type CameraFunTarget,
} from "./jayrrCameraFun";
import {
  CAMERA_ACCESSORIES,
  drawAccessoryPreview,
  type CameraAccessory,
} from "./jayrrCameraAccessories";

import {
  DEFAULT_CAMERA_LOOK,
  JAYRR_CAMERA_LOOK_MAX,
  JAYRR_CAMERA_LOOK_MIN,
  JAYRR_DISPLAY_QUALITIES,
  JAYRR_DISPLAY_RATES,
  JAYRR_DISPLAY_SOURCE,
  JAYRR_DISPLAY_SURFACES,
  JAYRR_OBJECT_FITS,
  JAYRR_PHONE_SELF,
  cameraLookFields,
  canLinkJayrrCamera,
  isDefaultCameraLook,
  isFullDisplayCrop,
  isJayrrDisplay,
  isJayrrPhone,
  isJayrrScreen,
  jayrrCameraLabel,
  jayrrDisplayQualityLabel,
  jayrrDisplaySurfaceLabel,
  jayrrLocalOwnerName,
  jayrrObjectFitLabel,
  jayrrPhoneSource,
  jayrrScreenSource,
  parseCameraLook,
  parseDisplayCrop,
  parseObjectFit,
  readCameraLook,
  readDisplayCrop,
  readDisplayFit,
  readDisplayQuality,
  readDisplayRate,
  readJayrrCamera,
  readJayrrOwnerName,
  readPhoneSource,
  readScreenSource,
  setSavedCameraLook,
  writeJayrrCamera,
  type JayrrCamera,
  type JayrrCameraLook,
  type JayrrDisplayCrop,
  type JayrrDisplayQuality,
  type JayrrDisplayRate,
  type JayrrDisplaySurface,
  type JayrrObjectFit,
} from "./jayrrCamera";
import { stopJayrrDisplay, unlockJayrrCameras } from "./jayrrCameraStreams";
import { desktopCropElementIdAtom } from "./jayrrDisplayCrop";

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

const phoneIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    width="20"
    height="20"
    viewBox="0 0 20 20"
  >
    <path
      d="M6.2 3.6c.5-.5 1.3-.5 1.7.1l1.3 1.9c.4.5.3 1.3-.2 1.7l-.9.7c.8 1.6 2.1 2.9 3.7 3.7l.7-.9c.4-.5 1.2-.6 1.7-.2l1.9 1.3c.6.4.6 1.2.1 1.7l-1.1 1.1c-.5.5-1.3.7-2 .5-2.4-.6-4.6-2-6.3-3.7-1.7-1.7-3.1-3.9-3.7-6.3-.2-.7 0-1.5.5-2Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

const sizeIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    width="20"
    height="20"
    viewBox="0 0 20 20"
  >
    <rect
      x="3.2"
      y="4.2"
      width="13.6"
      height="11.6"
      rx="1.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M7.2 10h5.6M10 7.2v5.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const framesIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    width="20"
    height="20"
    viewBox="0 0 20 20"
  >
    <circle
      cx="10"
      cy="10"
      r="6.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M10 6.4V10l2.6 1.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const fitIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    width="20"
    height="20"
    viewBox="0 0 20 20"
  >
    <rect
      x="2.8"
      y="2.8"
      width="14.4"
      height="14.4"
      rx="1.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="6.2"
      y="5.4"
      width="7.6"
      height="9.2"
      rx="1"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

const cropIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    width="20"
    height="20"
    viewBox="0 0 24 24"
  >
    <path
      d="M8 5v10a1 1 0 0 0 1 1h10M5 8h10a1 1 0 0 1 1 1v10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const adjustIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    width="20"
    height="20"
    viewBox="0 0 20 20"
  >
    <path
      d="M3.4 6.2h13.2M3.4 10h13.2M3.4 13.8h13.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="7.2" cy="6.2" r="1.45" fill="currentColor" />
    <circle cx="12.8" cy="10" r="1.45" fill="currentColor" />
    <circle cx="8.4" cy="13.8" r="1.45" fill="currentColor" />
  </svg>
);

const cutoutIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    width="20"
    height="20"
    viewBox="0 0 20 20"
  >
    <rect
      x="3.2"
      y="3.2"
      width="13.6"
      height="13.6"
      rx="1.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <circle
      cx="10"
      cy="8.1"
      r="2.1"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M6.2 15.2c.5-2.2 1.9-3.4 3.8-3.4s3.3 1.2 3.8 3.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const funIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    width="20"
    height="20"
    viewBox="0 0 20 20"
  >
    <circle
      cx="6.4"
      cy="9.2"
      r="2.55"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <circle
      cx="13.6"
      cy="9.2"
      r="2.55"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M8.9 8.7c.4-.7 1.8-.7 2.2 0M4 9.1 2.7 8.6M16 9.1l1.3-.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const AccessoryPreview = ({
  accessory,
}: {
  accessory: Exclude<CameraAccessory, "glasses">;
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) {
      drawAccessoryPreview(ref.current, accessory);
    }
  }, [accessory]);
  return (
    <canvas
      ref={ref}
      width={96}
      height={64}
      className="jayrr-camera-picker__accessory-preview"
      aria-hidden="true"
    />
  );
};

const glassesPreview = (
  <svg
    className="jayrr-camera-picker__glasses-preview"
    aria-hidden="true"
    focusable="false"
    width="48"
    height="32"
    viewBox="0 0 42 16"
    preserveAspectRatio="xMidYMid meet"
  >
    <g
      stroke="#141a1c"
      strokeWidth="0.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M6.2 7.5H4.5L1.8 4.6Q.8 3.6.6 5.5M35.8 7.5h1.7l2.7-2.9q1-1 1.2.9"
        strokeWidth="1.2"
        fill="none"
      />
      <path d="M18.5 7.2q2.5-2.2 5 0" fill="none" />
      <circle cx="12.2" cy="8" r="6.4" fill="#252d30" />
      <circle cx="29.8" cy="8" r="6.4" fill="#252d30" />
      <path
        d="M7 6a5.6 5.6 0 0 1 10.1-.8M24.6 6a5.6 5.6 0 0 1 10.1-.8"
        stroke="#59615f"
        strokeWidth="0.4"
        fill="none"
      />
    </g>
  </svg>
);

const accessoryOffsetIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    width="20"
    height="20"
    viewBox="0 0 20 20"
  >
    <path
      d="M10 2.5v15M2.5 10h15M6.2 6.2l7.6 7.6M13.8 6.2l-7.6 7.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
    />
    <circle cx="10" cy="10" r="2" fill="currentColor" />
  </svg>
);

const screenIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    width="20"
    height="20"
    viewBox="0 0 20 20"
  >
    <rect
      x="2.5"
      y="3.5"
      width="15"
      height="10"
      rx="1.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M10 13.5V16.2M7.2 16.2h5.6M13.2 8.2l1.6-1.6M14.8 8.2H12.4V5.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
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
  if (isJayrrPhone(camera)) {
    return jayrrPhoneSource(camera.userId);
  }
  if (isJayrrScreen(camera)) {
    return jayrrScreenSource(camera.userId);
  }
  return camera.deviceId;
};

const readCutoutValue = (bag: object) =>
  "cutout" in bag && typeof bag.cutout === "boolean" ? bag.cutout : undefined;

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
  const ownerNameFor = (userId: string, fallback?: string) => {
    if (userId === getJayrrPhoneClientId()) {
      return jayrrLocalOwnerName();
    }
    const fromFallback = readJayrrOwnerName(
      fallback === "Screen" ? undefined : fallback,
    );
    if (fromFallback) {
      return fromFallback;
    }
    const person = listJayrrPhonePeople().find(
      (item) => item.userId === userId,
    );
    return readJayrrOwnerName(person?.label);
  };
  if (typeof value === "object" && value && "kind" in value) {
    const bag = value as JayrrCamera;
    if (bag.kind === "display") {
      const surface =
        "surface" in bag &&
        typeof bag.surface === "string" &&
        (JAYRR_DISPLAY_SURFACES as readonly string[]).includes(bag.surface)
          ? (bag.surface as JayrrDisplaySurface)
          : undefined;
      const quality =
        "quality" in bag &&
        typeof bag.quality === "string" &&
        (JAYRR_DISPLAY_QUALITIES as readonly string[]).includes(bag.quality)
          ? (bag.quality as JayrrDisplayQuality)
          : undefined;
      const frameRate =
        bag.frameRate === 30 || bag.frameRate === 60
          ? bag.frameRate
          : undefined;
      const fit = parseObjectFit("fit" in bag ? bag.fit : undefined);
      const nonce = typeof bag.nonce === "number" ? bag.nonce : Date.now();
      return {
        kind: "display",
        nonce,
        surface,
        quality,
        frameRate,
        fit,
        crop: parseDisplayCrop("crop" in bag ? bag.crop : undefined),
        cutout: readCutoutValue(bag),
        label: jayrrCameraLabel(bag) ?? jayrrDisplaySurfaceLabel(surface),
      };
    }
    const picture = {
      fit: parseObjectFit("fit" in bag ? bag.fit : undefined),
      crop: parseDisplayCrop("crop" in bag ? bag.crop : undefined),
      cutout: readCutoutValue(bag),
    };
    if (bag.kind === "screen" && typeof bag.userId === "string" && bag.userId) {
      const userId =
        bag.userId === JAYRR_PHONE_SELF ? getJayrrPhoneClientId() : bag.userId;
      return {
        kind: "screen",
        userId,
        label: "Screen",
        ownerName: ownerNameFor(userId, bag.label),
        ...picture,
      };
    }
    if (bag.kind === "phone" && typeof bag.userId === "string" && bag.userId) {
      const userId =
        bag.userId === JAYRR_PHONE_SELF ? getJayrrPhoneClientId() : bag.userId;
      return {
        kind: "phone",
        userId,
        label: userId === getJayrrPhoneClientId() ? "On" : bag.label,
        ownerName: ownerNameFor(userId, bag.label),
        ...picture,
      };
    }
    if ("deviceId" in bag && typeof bag.deviceId === "string" && bag.deviceId) {
      const ownerId = getJayrrPhoneClientId();
      return {
        kind: "camera",
        deviceId: bag.deviceId,
        label: bag.label,
        ownerId,
        ownerName: ownerNameFor(ownerId),
        ...picture,
        ...cameraLookFields(parseCameraLook(bag) ?? DEFAULT_CAMERA_LOOK),
      };
    }
  }
  if (typeof value !== "string") {
    return null;
  }
  if (value === JAYRR_DISPLAY_SOURCE) {
    return { kind: "display", nonce: Date.now(), label: "Screen" };
  }
  const screenUserId = readScreenSource(value);
  if (screenUserId) {
    const userId =
      screenUserId === JAYRR_PHONE_SELF
        ? getJayrrPhoneClientId()
        : screenUserId;
    return {
      kind: "screen",
      userId,
      label: "Screen",
      ownerName: ownerNameFor(userId),
    };
  }
  const phoneUserId = readPhoneSource(value);
  if (phoneUserId) {
    const userId =
      phoneUserId === JAYRR_PHONE_SELF ? getJayrrPhoneClientId() : phoneUserId;
    return {
      kind: "phone",
      userId,
      label: userId === getJayrrPhoneClientId() ? "On" : undefined,
      ownerName: ownerNameFor(userId),
    };
  }
  const device = devices.find((item) => item.deviceId === value);
  const ownerId = getJayrrPhoneClientId();
  return {
    kind: "camera",
    deviceId: value,
    label: device?.label || undefined,
    ownerId,
    ownerName: ownerNameFor(ownerId),
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

const LookFields = ({
  look,
  onLook,
}: {
  look: JayrrCameraLook;
  onLook: (next: JayrrCameraLook) => void;
}) => (
  <div className="jayrr-camera-picker__look">
    <Range
      label="Brightness"
      value={look.brightness}
      min={JAYRR_CAMERA_LOOK_MIN}
      max={JAYRR_CAMERA_LOOK_MAX}
      step={1}
      onChange={(brightness) => onLook({ ...look, brightness })}
    />
    <Range
      label="Contrast"
      value={look.contrast}
      min={JAYRR_CAMERA_LOOK_MIN}
      max={JAYRR_CAMERA_LOOK_MAX}
      step={1}
      onChange={(contrast) => onLook({ ...look, contrast })}
    />
    <Range
      label="Saturation"
      value={look.saturation}
      min={JAYRR_CAMERA_LOOK_MIN}
      max={JAYRR_CAMERA_LOOK_MAX}
      step={1}
      onChange={(saturation) => onLook({ ...look, saturation })}
    />
    {isDefaultCameraLook(look) ? null : (
      <MenuItem
        selected={false}
        onSelect={() => {
          onLook(DEFAULT_CAMERA_LOOK);
        }}
      >
        Reset
      </MenuItem>
    )}
  </div>
);

const StreamFields = ({
  compact,
  source,
  sourceLabel,
  displaySurface,
  quality,
  frameRate,
  fit,
  cropActive,
  hasCrop,
  devices,
  disabled,
  error,
  onCameraChange,
  onDesktopChange,
  onChangeSource,
  onQuality,
  onFrameRate,
  onFit,
  onToggleCrop,
  onResetCrop,
  look,
  onLook,
  cutoutOn,
  onToggleCutout,
  funOn,
  accessory,
  onAccessory,
  laserOn,
  onToggleLaser,
  eyeLasersOn,
  onToggleEyeLasers,
  funOffsets,
  onFunOffsets,
  onUnlock,
  phoneSource,
  collaborating,
  people,
  phoneError,
  onPhoneChange,
  screenError,
  onShareScreen,
  onStopScreen,
}: {
  compact: boolean;
  source: string;
  sourceLabel: string | null;
  displaySurface: JayrrDisplaySurface | undefined;
  quality: JayrrDisplayQuality;
  frameRate: JayrrDisplayRate;
  fit: JayrrObjectFit;
  cropActive: boolean;
  hasCrop: boolean;
  devices: MediaDeviceInfo[];
  disabled: boolean;
  error: string | null;
  onCameraChange: (next: string) => void;
  onDesktopChange: (surface: JayrrDisplaySurface | null) => void;
  onChangeSource: () => void;
  onQuality: (next: JayrrDisplayQuality) => void;
  onFrameRate: (next: JayrrDisplayRate) => void;
  onFit: (next: JayrrObjectFit) => void;
  onToggleCrop: () => void;
  onResetCrop: () => void;
  look: JayrrCameraLook;
  onLook: (next: JayrrCameraLook) => void;
  cutoutOn: boolean;
  onToggleCutout: () => void;
  funOn: boolean;
  accessory: CameraAccessory;
  onAccessory: (accessory: CameraAccessory) => void;
  laserOn: boolean;
  onToggleLaser: () => void;
  eyeLasersOn: boolean;
  onToggleEyeLasers: () => void;
  funOffsets: CameraFunOffsets;
  onFunOffsets: (offsets: CameraFunOffsets) => void;
  onUnlock: () => void;
  phoneSource: string;
  collaborating: boolean;
  people: Array<{ userId: string; label: string }>;
  phoneError: string | null;
  onPhoneChange: (userId: string) => void;
  screenError: string | null;
  onShareScreen: () => boolean;
  onStopScreen: () => void;
}) => {
  const namedDevices = devices.filter((device) => device.deviceId);
  const screenSource = readScreenSource(source) ?? "";
  const cameraSource =
    source === JAYRR_DISPLAY_SOURCE || phoneSource || screenSource
      ? ""
      : source;
  const desktopOn = source === JAYRR_DISPLAY_SOURCE;
  const cameraOn = Boolean(cameraSource);
  const [offsetTarget, setOffsetTarget] = useState<CameraFunTarget | null>(
    null,
  );
  const phoneOn = Boolean(phoneSource);
  const screenOn = Boolean(screenSource);
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
  const phoneChoice = (
    <StreamChoice
      title="Phone"
      icon={phoneIcon}
      active={phoneOn}
      compact={compact}
      disabled={false}
    >
      {(close) => (
        <>
          {phoneError ? (
            <span className="jayrr-camera-picker__error">{phoneError}</span>
          ) : null}
          {!collaborating ? (
            <span className="jayrr-camera-picker__error">
              Start live collaboration first
            </span>
          ) : null}
          {phoneOn && people.length < 2 ? (
            <span className="jayrr-camera-picker__note">
              Waiting for the other side.
            </span>
          ) : null}
          <MenuItem
            selected={!phoneOn}
            onSelect={() => {
              if (phoneOn) {
                onPhoneChange("");
              }
              close();
            }}
          >
            Off
          </MenuItem>
          {collaborating
            ? people.map((person) => (
                <MenuItem
                  key={person.userId}
                  selected={phoneSource === person.userId}
                  onSelect={() => {
                    onPhoneChange(person.userId);
                    close();
                  }}
                >
                  {person.label}
                </MenuItem>
              ))
            : null}
        </>
      )}
    </StreamChoice>
  );
  const screenChoice = (
    <StreamChoice
      title="Screen"
      icon={screenIcon}
      active={screenOn}
      compact={compact}
      disabled={false}
    >
      {(close) => (
        <>
          {screenError ? (
            <span className="jayrr-camera-picker__error">{screenError}</span>
          ) : null}
          {!collaborating ? (
            <span className="jayrr-camera-picker__error">
              Start live collaboration first
            </span>
          ) : null}
          <MenuItem
            selected={!screenOn}
            onSelect={() => {
              if (screenOn) {
                onStopScreen();
              }
              close();
            }}
          >
            Off
          </MenuItem>
          {collaborating ? (
            <MenuItem
              selected={screenOn}
              onSelect={() => {
                if (onShareScreen()) {
                  close();
                }
              }}
            >
              {screenOn ? "Change screen" : "Share screen"}
            </MenuItem>
          ) : null}
        </>
      )}
    </StreamChoice>
  );
  const pictureOn = cameraOn || phoneOn || screenOn || desktopOn;
  const sizeChoice = desktopOn ? (
    <StreamChoice
      title="Size"
      icon={sizeIcon}
      active={false}
      compact={compact}
      disabled={false}
    >
      {(close) => (
        <>
          {JAYRR_DISPLAY_QUALITIES.map((option) => (
            <MenuItem
              key={option}
              selected={quality === option}
              onSelect={() => {
                onQuality(option);
                close();
              }}
            >
              {jayrrDisplayQualityLabel(option)}
            </MenuItem>
          ))}
        </>
      )}
    </StreamChoice>
  ) : null;
  const framesChoice = desktopOn ? (
    <StreamChoice
      title="Frames"
      icon={framesIcon}
      active={false}
      compact={compact}
      disabled={false}
    >
      {(close) => (
        <>
          {JAYRR_DISPLAY_RATES.map((option) => (
            <MenuItem
              key={option}
              selected={frameRate === option}
              onSelect={() => {
                onFrameRate(option);
                close();
              }}
            >
              {option} fps
            </MenuItem>
          ))}
        </>
      )}
    </StreamChoice>
  ) : null;
  const fitChoice = pictureOn ? (
    <StreamChoice
      title="Fit"
      icon={fitIcon}
      active={false}
      compact={compact}
      disabled={false}
    >
      {(close) => (
        <>
          {JAYRR_OBJECT_FITS.map((option) => (
            <MenuItem
              key={option}
              selected={fit === option}
              onSelect={() => {
                onFit(option);
                close();
              }}
            >
              {jayrrObjectFitLabel(option)}
            </MenuItem>
          ))}
        </>
      )}
    </StreamChoice>
  ) : null;
  const cropChoice = pictureOn ? (
    <StreamChoice
      title="Crop"
      icon={cropIcon}
      active={cropActive || hasCrop}
      compact={compact}
      disabled={false}
    >
      {(close) => (
        <>
          <MenuItem
            selected={cropActive}
            onSelect={() => {
              onToggleCrop();
              close();
            }}
          >
            {cropActive ? "Done" : "Crop"}
          </MenuItem>
          {hasCrop ? (
            <MenuItem
              selected={false}
              onSelect={() => {
                onResetCrop();
                close();
              }}
            >
              Reset
            </MenuItem>
          ) : null}
        </>
      )}
    </StreamChoice>
  ) : null;
  const lookChoice = cameraOn ? (
    <StreamChoice
      title="Adjust"
      icon={adjustIcon}
      active={!isDefaultCameraLook(look)}
      compact={compact}
      disabled={false}
    >
      {() => <LookFields look={look} onLook={onLook} />}
    </StreamChoice>
  ) : null;
  const cutoutChoice = pictureOn ? (
    compact ? (
      <IconButton
        type="button"
        icon={cutoutIcon}
        className={cutoutOn ? "ToolIcon--checked" : undefined}
        aria-label="Cutout"
        title="Cutout"
        aria-pressed={cutoutOn}
        onClick={onToggleCutout}
      />
    ) : (
      <RadioButton
        icon={<>{cutoutIcon}</>}
        title="Cutout"
        active={cutoutOn}
        onClick={onToggleCutout}
      />
    )
  ) : null;
  const accessoryName =
    accessory === "glasses"
      ? "Glasses"
      : CAMERA_ACCESSORIES.find(({ id }) => id === accessory)?.name ??
        accessory;
  const funTargets: Array<{ id: CameraFunTarget; label: string }> = [
    ...(funOn ? [{ id: accessory, label: accessoryName }] : []),
    ...(laserOn ? [{ id: "laser" as const, label: "Lazer" }] : []),
    ...(eyeLasersOn ? [{ id: "eyeLasers" as const, label: "Eye Lasers" }] : []),
  ];
  const funTarget =
    funTargets.find(({ id }) => id === offsetTarget)?.id ?? funTargets[0]?.id;
  const funOffset = funTarget
    ? funOffsetFor(funOffsets, funTarget)
    : DEFAULT_FUN_OFFSET;
  const onFunOffset = (offset: CameraFunOffset) => {
    if (funTarget) {
      onFunOffsets({ ...funOffsets, [funTarget]: offset });
    }
  };
  const funChoice = cameraOn ? (
    <StreamChoice
      title="Accessories"
      icon={funIcon}
      active={funOn || laserOn || eyeLasersOn}
      compact={compact}
      disabled={false}
    >
      {(close) => (
        <div className="jayrr-camera-picker__accessories">
          <MenuItem
            selected={funOn && accessory === "glasses"}
            onSelect={() => {
              onAccessory("glasses");
              close();
            }}
          >
            <span className="jayrr-camera-picker__accessory">
              Glasses
              {glassesPreview}
            </span>
          </MenuItem>
          {CAMERA_ACCESSORIES.map(({ id, name }) => (
            <MenuItem
              key={id}
              selected={funOn && accessory === id}
              onSelect={() => {
                onAccessory(id);
                close();
              }}
            >
              <span className="jayrr-camera-picker__accessory">
                {name}
                <AccessoryPreview accessory={id} />
              </span>
            </MenuItem>
          ))}
          <MenuItem
            selected={laserOn}
            onSelect={() => {
              onToggleLaser();
              close();
            }}
          >
            Fire Mah Lazer
          </MenuItem>
          <MenuItem
            selected={eyeLasersOn}
            onSelect={() => {
              onToggleEyeLasers();
              close();
            }}
          >
            Eye Lasers
          </MenuItem>
        </div>
      )}
    </StreamChoice>
  ) : null;
  const offsetChoice =
    funOn || laserOn || eyeLasersOn ? (
      <StreamChoice
        title="Accessory position"
        icon={accessoryOffsetIcon}
        active={
          funOffset.x !== 0 || funOffset.y !== 0 || funScale(funOffset) !== 1
        }
        compact={compact}
        disabled={false}
      >
        {(close) => (
          <div className="jayrr-camera-picker__look">
            {funTargets.length > 1 ? (
              <div className="jayrr-camera-picker__offset-targets">
                {funTargets.map(({ id, label }) => (
                  <MenuItem
                    key={id}
                    selected={id === funTarget}
                    onSelect={() => setOffsetTarget(id)}
                  >
                    {label}
                  </MenuItem>
                ))}
              </div>
            ) : null}
            <Range
              label="Horizontal"
              value={funOffset.x}
              min={-160}
              max={160}
              step={1}
              onChange={(x) => onFunOffset({ ...funOffset, x })}
            />
            <Range
              label="Vertical"
              value={funOffset.y}
              min={-160}
              max={160}
              step={1}
              onChange={(y) => onFunOffset({ ...funOffset, y })}
            />
            <Range
              label="Scale"
              value={Math.round(funScale(funOffset) * 100)}
              min={FUN_SCALE_MIN * 100}
              max={FUN_SCALE_MAX * 100}
              step={5}
              onChange={(percent) =>
                onFunOffset({ ...funOffset, scale: percent / 100 })
              }
            />
            <button
              type="button"
              className="jayrr-camera-picker__crop-reset"
              onClick={() => {
                onFunOffset({ ...DEFAULT_FUN_OFFSET });
                close();
              }}
            >
              Reset
            </button>
          </div>
        )}
      </StreamChoice>
    ) : null;
  const choices = compact ? (
    <>
      <div className="compact-action-item">{cameraChoice}</div>
      <div className="compact-action-item">{desktopChoice}</div>
      <div className="compact-action-item">{phoneChoice}</div>
      <div className="compact-action-item">{screenChoice}</div>
      {sizeChoice ? (
        <div className="compact-action-item">{sizeChoice}</div>
      ) : null}
      {framesChoice ? (
        <div className="compact-action-item">{framesChoice}</div>
      ) : null}
      {fitChoice ? (
        <div className="compact-action-item">{fitChoice}</div>
      ) : null}
      {cropChoice ? (
        <div className="compact-action-item">{cropChoice}</div>
      ) : null}
      {lookChoice ? (
        <div className="compact-action-item">{lookChoice}</div>
      ) : null}
      {cutoutChoice ? (
        <div className="compact-action-item">{cutoutChoice}</div>
      ) : null}
      {funChoice ? (
        <div className="compact-action-item">{funChoice}</div>
      ) : null}
      {offsetChoice ? (
        <div className="compact-action-item">{offsetChoice}</div>
      ) : null}
    </>
  ) : (
    <div className="buttonList">
      {cameraChoice}
      {desktopChoice}
      {phoneChoice}
      {screenChoice}
    </div>
  );

  if (compact) {
    return choices;
  }

  return (
    <>
      {choices}
      {pictureOn ? (
        <div className="buttonList jayrr-camera-picker__tune">
          {sizeChoice}
          {framesChoice}
          {fitChoice}
          {cropChoice}
          {lookChoice}
          {cutoutChoice}
          {funChoice}
          {offsetChoice}
        </div>
      ) : null}
      {error ? (
        <span className="jayrr-camera-picker__error">{error}</span>
      ) : null}
    </>
  );
};

const CameraPanel = ({
  elementId,
  source,
  sourceLabel,
  displaySurface,
  displayNonce,
  quality,
  frameRate,
  fit,
  crop,
  cutout,
  look,
  onChange,
}: {
  elementId: string;
  source: string;
  sourceLabel: string | null;
  displaySurface: JayrrDisplaySurface | undefined;
  displayNonce: number | undefined;
  quality: JayrrDisplayQuality;
  frameRate: JayrrDisplayRate;
  fit: JayrrObjectFit;
  crop: JayrrDisplayCrop | undefined;
  /** The box's own cutout setting; unset boxes follow this browser's default. */
  cutout: boolean | undefined;
  look: JayrrCameraLook;
  onChange: (next: unknown) => void;
}) => {
  const { container } = useExcalidrawContainer();
  const mode = useStylesPanelMode();
  const compact = mode !== "full";
  const cropElementId = useAtomValue(desktopCropElementIdAtom);
  const setCropElementId = useSetAtom(desktopCropElementIdAtom);
  const collaborating = useAtomValue(isCollaboratingAtom);
  const defaultCutoutOn = useAtomValue(cameraCutoutOnAtom);
  const setCutoutOn = useSetAtom(cameraCutoutOnAtom);
  const cutoutOn = cutout ?? defaultCutoutOn;
  const funOn = useAtomValue(cameraFunOnAtom);
  const accessory = useAtomValue(cameraAccessoryAtom);
  const setAccessory = useSetAtom(cameraAccessoryAtom);
  const laserOn = useAtomValue(cameraLaserOnAtom);
  const eyeLasersOn = useAtomValue(cameraEyeLasersOnAtom);
  const setLaserOn = useSetAtom(cameraLaserOnAtom);
  const setEyeLasersOn = useSetAtom(cameraEyeLasersOnAtom);
  const setFunOn = useSetAtom(cameraFunOnAtom);
  const funOffsets = useAtomValue(cameraFunOffsetsAtom);
  const setFunOffsets = useSetAtom(cameraFunOffsetsAtom);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [phoneTick, setPhoneTick] = useState(0);
  const cropActive = cropElementId === elementId;
  const hasCrop = !isFullDisplayCrop(crop);
  const phoneSource = readPhoneSource(source) ?? "";
  const people = listJayrrPhonePeople();
  const phoneError = getJayrrPhoneError();
  void phoneTick;

  useEffect(
    () =>
      subscribeJayrrPhone(() => {
        setPhoneTick((value) => value + 1);
      }),
    [],
  );

  useEffect(() => {
    if (
      !source ||
      source === JAYRR_DISPLAY_SOURCE ||
      readPhoneSource(source) ||
      readScreenSource(source)
    ) {
      return;
    }
    setSavedCameraLook(look);
  }, [look, source]);

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

  const pickCamera = (next: string) => {
    setCropElementId(null);
    if (!next) {
      onChange({ off: true });
      return;
    }
    const device = devices.find((item) => item.deviceId === next);
    onChange({
      kind: "camera",
      deviceId: next,
      label: device?.label || sourceLabel || undefined,
      fit,
      crop,
      ...cameraLookFields(look),
    });
  };

  const stopScreen = () => {
    setCropElementId(null);
    peekJayrrScreenStream(getJayrrPhoneClientId())
      ?.getTracks()
      .forEach((track) => track.stop());
    setJayrrScreenLocal(null);
    onChange({ off: true });
  };

  const shareScreen = () => {
    setCropElementId(null);
    setScreenError(null);
    const view = container?.ownerDocument.defaultView;
    const mediaDevices = view?.navigator.mediaDevices;
    if (
      !view ||
      !mediaDevices ||
      typeof mediaDevices.getDisplayMedia !== "function"
    ) {
      setScreenError("This browser can't share the screen.");
      return false;
    }
    void captureSharedScreen(mediaDevices);
    return true;
  };

  const captureSharedScreen = async (mediaDevices: MediaDevices) => {
    try {
      let stream: MediaStream;
      try {
        stream = await mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
      } catch (caught) {
        if (
          caught instanceof DOMException &&
          caught.name === "NotAllowedError"
        ) {
          return;
        }
        stream = await mediaDevices.getDisplayMedia({
          video: true,
        });
      }
      peekJayrrScreenStream(getJayrrPhoneClientId())
        ?.getTracks()
        .forEach((track) => track.stop());
      const video = stream.getVideoTracks()[0];
      video?.addEventListener("ended", () => {
        setJayrrScreenLocal(null);
        onChange({ off: true });
      });
      setJayrrScreenLocal(stream);
      onChange({
        kind: "screen",
        userId: getJayrrPhoneClientId(),
        label: "Screen",
      });
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "NotAllowedError") {
        return;
      }
      setScreenError(
        caught instanceof Error
          ? caught.message
          : "Could not share the screen.",
      );
    }
  };

  const pickPhone = (userId: string) => {
    setCropElementId(null);
    if (!userId) {
      onChange({ off: true });
      return;
    }
    const person = people.find((item) => item.userId === userId);
    onChange({
      kind: "phone",
      userId,
      label:
        userId === JAYRR_PHONE_SELF
          ? "Call"
          : person?.label || sourceLabel || undefined,
    });
  };

  const pickDesktop = (surface: JayrrDisplaySurface | null) => {
    setCropElementId(null);
    if (surface) {
      onChange({
        kind: "display",
        surface,
        quality,
        frameRate,
        fit,
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
      quality,
      frameRate,
      fit,
      label: jayrrDisplaySurfaceLabel(displaySurface),
    });
  };

  const keepDisplay = (
    nextQuality: JayrrDisplayQuality,
    nextRate: JayrrDisplayRate,
    nextFit: JayrrObjectFit = fit,
    nextCrop: JayrrDisplayCrop | undefined = crop,
    nextCutout: boolean | undefined = cutout,
  ) => {
    onChange({
      kind: "display",
      surface: displaySurface ?? "monitor",
      nonce: displayNonce ?? 0,
      quality: nextQuality,
      frameRate: nextRate,
      fit: nextFit,
      crop: nextCrop,
      cutout: nextCutout,
      label: sourceLabel || jayrrDisplaySurfaceLabel(displaySurface),
    });
  };

  const applyPicture = (
    nextFit: JayrrObjectFit,
    nextCrop: JayrrDisplayCrop | undefined,
    nextLook: JayrrCameraLook = look,
    nextCutout: boolean | undefined = cutout,
  ) => {
    if (phoneSource) {
      onChange({
        kind: "phone",
        userId: phoneSource,
        label: sourceLabel ?? undefined,
        fit: nextFit,
        crop: nextCrop,
        cutout: nextCutout,
      });
      return;
    }
    const screenSource = readScreenSource(source);
    if (screenSource) {
      onChange({
        kind: "screen",
        userId: screenSource,
        label: sourceLabel || "Screen",
        fit: nextFit,
        crop: nextCrop,
        cutout: nextCutout,
      });
      return;
    }
    if (source === JAYRR_DISPLAY_SOURCE) {
      keepDisplay(quality, frameRate, nextFit, nextCrop, nextCutout);
      return;
    }
    if (source) {
      onChange({
        kind: "camera",
        deviceId: source,
        label: sourceLabel ?? undefined,
        fit: nextFit,
        crop: nextCrop,
        cutout: nextCutout,
        ...cameraLookFields(nextLook),
      });
    }
  };

  const fields = (
    <StreamFields
      compact={compact}
      source={source}
      sourceLabel={sourceLabel}
      displaySurface={displaySurface}
      quality={quality}
      frameRate={frameRate}
      fit={fit}
      cropActive={cropActive}
      hasCrop={hasCrop}
      devices={devices}
      disabled={loading && devices.length === 0}
      error={error}
      onCameraChange={pickCamera}
      onDesktopChange={pickDesktop}
      onChangeSource={changeSource}
      onQuality={(next) => {
        keepDisplay(next, frameRate);
      }}
      onFrameRate={(next) => {
        keepDisplay(quality, next);
      }}
      onFit={(next) => {
        applyPicture(next, crop);
      }}
      onToggleCrop={() => {
        setCropElementId(cropActive ? null : elementId);
      }}
      onResetCrop={() => {
        applyPicture(fit, undefined);
        setCropElementId(null);
      }}
      look={look}
      onLook={(next) => {
        setSavedCameraLook(next);
        applyPicture(fit, crop, next);
      }}
      cutoutOn={cutoutOn}
      onToggleCutout={() => {
        const next = !cutoutOn;
        // Stored on the box so every collaborator cuts it out too. The local
        // default still follows, so the next new box starts the same way.
        applyPicture(fit, crop, look, next);
        setCutoutOn(next);
        setSavedCutoutOn(next);
      }}
      funOn={funOn}
      laserOn={laserOn}
      eyeLasersOn={eyeLasersOn}
      onToggleEyeLasers={() => setEyeLasersOn(!eyeLasersOn)}
      onToggleLaser={() => setLaserOn(!laserOn)}
      funOffsets={funOffsets}
      onFunOffsets={(next) => {
        setFunOffsets(next);
        setSavedFunOffsets(next);
      }}
      accessory={accessory}
      onAccessory={(id) => {
        const next = !funOn || accessory !== id;
        setAccessory(id);
        setSavedAccessory(id, container?.ownerDocument.defaultView ?? null);
        setFunOn(next);
        setSavedFunOn(next);
      }}
      onUnlock={() => {
        void unlock();
      }}
      phoneSource={phoneSource}
      collaborating={collaborating}
      people={people}
      phoneError={phoneError}
      onPhoneChange={pickPhone}
      screenError={screenError}
      onShareScreen={shareScreen}
      onStopScreen={stopScreen}
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
        elementId={selected[0].id}
        source={sourceValue(camera)}
        sourceLabel={jayrrCameraLabel(camera)}
        displaySurface={isJayrrDisplay(camera) ? camera.surface : undefined}
        displayNonce={isJayrrDisplay(camera) ? camera.nonce : undefined}
        quality={readDisplayQuality(camera)}
        frameRate={readDisplayRate(camera)}
        fit={readDisplayFit(camera)}
        crop={readDisplayCrop(camera)}
        cutout={camera?.cutout}
        look={readCameraLook(camera)}
        onChange={(next) => updateData(next)}
      />
    );
  },
};
