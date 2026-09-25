import { isTextElement, newElementWith } from "@excalidraw/element";
import {
  CaptureUpdateAction,
  useStylesPanelMode,
} from "@excalidraw/excalidraw";
import { useExcalidrawContainer } from "@excalidraw/excalidraw/components/App";
import { getDropdownMenuItemClassName } from "@excalidraw/excalidraw/components/dropdownMenu/common";
import { getSelectedElements } from "@excalidraw/excalidraw/scene";
import { useConvexAuth, useMutation } from "convex/react";
import { Popover } from "radix-ui";
import { useEffect, useState, type ReactNode } from "react";

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
import { api, isConvexLinked } from "../convexClient";
import {
  CAMERA_CUTOUT_FLAG,
  CAMERA_CUTOUT_OPTIONS,
  cameraCutoutAtom,
  isCameraCutout,
  type CameraCutout,
} from "../domain/flags/cameraCutoutFlag";

import {
  JAYRR_DISPLAY_QUALITIES,
  JAYRR_DISPLAY_RATES,
  JAYRR_DISPLAY_SOURCE,
  JAYRR_DISPLAY_SURFACES,
  JAYRR_OBJECT_FITS,
  JAYRR_PHONE_SELF,
  canLinkJayrrCamera,
  isFullDisplayCrop,
  isJayrrDisplay,
  isJayrrPhone,
  isJayrrScreen,
  jayrrCameraLabel,
  jayrrDisplayQualityLabel,
  jayrrDisplaySurfaceLabel,
  jayrrObjectFitLabel,
  jayrrPhoneSource,
  jayrrScreenSource,
  parseDisplayCrop,
  parseObjectFit,
  readDisplayCrop,
  readDisplayFit,
  readDisplayQuality,
  readDisplayRate,
  readJayrrCamera,
  readPhoneSource,
  readScreenSource,
  writeJayrrCamera,
  type JayrrCamera,
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
        label: jayrrCameraLabel(bag) ?? jayrrDisplaySurfaceLabel(surface),
      };
    }
    const picture = {
      fit: parseObjectFit("fit" in bag ? bag.fit : undefined),
      crop: parseDisplayCrop("crop" in bag ? bag.crop : undefined),
    };
    if (bag.kind === "screen" && typeof bag.userId === "string" && bag.userId) {
      const userId =
        bag.userId === JAYRR_PHONE_SELF ? getJayrrPhoneClientId() : bag.userId;
      return { kind: "screen", userId, label: "Screen", ...picture };
    }
    if (bag.kind === "phone" && typeof bag.userId === "string" && bag.userId) {
      const userId =
        bag.userId === JAYRR_PHONE_SELF ? getJayrrPhoneClientId() : bag.userId;
      return {
        kind: "phone",
        userId,
        label: userId === getJayrrPhoneClientId() ? "On" : bag.label,
        ...picture,
      };
    }
    if ("deviceId" in bag && typeof bag.deviceId === "string" && bag.deviceId) {
      return {
        kind: "camera",
        deviceId: bag.deviceId,
        label: bag.label,
        ownerId: getJayrrPhoneClientId(),
        ...picture,
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
    return { kind: "screen", userId, label: "Screen" };
  }
  const phoneUserId = readPhoneSource(value);
  if (phoneUserId) {
    const userId =
      phoneUserId === JAYRR_PHONE_SELF ? getJayrrPhoneClientId() : phoneUserId;
    return {
      kind: "phone",
      userId,
      label: userId === getJayrrPhoneClientId() ? "On" : undefined,
    };
  }
  const device = devices.find((item) => item.deviceId === value);
  return {
    kind: "camera",
    deviceId: value,
    label: device?.label || undefined,
    ownerId: getJayrrPhoneClientId(),
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

const CutoutSetting = ({
  value,
  onChange,
}: {
  value: CameraCutout;
  onChange: (next: CameraCutout) => void;
}) => (
  <label className="control-label jayrr-camera-picker__cutout">
    Cutout
    <select
      className="dropdown-select"
      value={value}
      aria-label="Cutout"
      onChange={(event) => {
        const next = event.target.value;
        if (isCameraCutout(next)) {
          onChange(next);
        }
      }}
    >
      {CAMERA_CUTOUT_OPTIONS.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const LinkedCutoutSetting = () => {
  const { isAuthenticated } = useConvexAuth();
  const cutout = useAtomValue(cameraCutoutAtom);
  const setCutout = useSetAtom(cameraCutoutAtom);
  const setFlag = useMutation(api.featureFlags.set);

  return (
    <CutoutSetting
      value={cutout}
      onChange={(next) => {
        setCutout(next);
        if (isAuthenticated) {
          void setFlag({ key: CAMERA_CUTOUT_FLAG, value: next });
        }
      }}
    />
  );
};

const LocalCutoutSetting = () => {
  const cutout = useAtomValue(cameraCutoutAtom);
  const setCutout = useSetAtom(cameraCutoutAtom);
  return <CutoutSetting value={cutout} onChange={setCutout} />;
};

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
        </div>
      ) : null}
      {pictureOn ? (
        isConvexLinked ? (
          <LinkedCutoutSetting />
        ) : (
          <LocalCutoutSetting />
        )
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
  onChange: (next: unknown) => void;
}) => {
  const { container } = useExcalidrawContainer();
  const mode = useStylesPanelMode();
  const compact = mode !== "full";
  const cropElementId = useAtomValue(desktopCropElementIdAtom);
  const setCropElementId = useSetAtom(desktopCropElementIdAtom);
  const collaborating = useAtomValue(isCollaboratingAtom);
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
  ) => {
    onChange({
      kind: "display",
      surface: displaySurface ?? "monitor",
      nonce: displayNonce ?? 0,
      quality: nextQuality,
      frameRate: nextRate,
      fit: nextFit,
      crop: nextCrop,
      label: sourceLabel || jayrrDisplaySurfaceLabel(displaySurface),
    });
  };

  const applyPicture = (
    nextFit: JayrrObjectFit,
    nextCrop: JayrrDisplayCrop | undefined,
  ) => {
    if (phoneSource) {
      onChange({
        kind: "phone",
        userId: phoneSource,
        label: sourceLabel ?? undefined,
        fit: nextFit,
        crop: nextCrop,
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
      });
      return;
    }
    if (source === JAYRR_DISPLAY_SOURCE) {
      keepDisplay(quality, frameRate, nextFit, nextCrop);
      return;
    }
    if (source) {
      onChange({
        kind: "camera",
        deviceId: source,
        label: sourceLabel ?? undefined,
        fit: nextFit,
        crop: nextCrop,
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
        onChange={(next) => updateData(next)}
      />
    );
  },
};
