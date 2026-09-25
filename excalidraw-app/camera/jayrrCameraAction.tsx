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
  jayrrCameraLabel,
  jayrrDisplayQualityLabel,
  jayrrDisplaySurfaceLabel,
  jayrrObjectFitLabel,
  jayrrPhoneSource,
  parseDisplayCrop,
  readDisplayCrop,
  readDisplayFit,
  readDisplayQuality,
  readDisplayRate,
  readJayrrCamera,
  readPhoneSource,
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
      const fit =
        "fit" in bag &&
        typeof bag.fit === "string" &&
        (JAYRR_OBJECT_FITS as readonly string[]).includes(bag.fit)
          ? (bag.fit as JayrrObjectFit)
          : undefined;
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
    if (bag.kind === "phone" && typeof bag.userId === "string" && bag.userId) {
      const userId =
        bag.userId === JAYRR_PHONE_SELF ? getJayrrPhoneClientId() : bag.userId;
      return {
        kind: "phone",
        userId,
        label: userId === getJayrrPhoneClientId() ? "On" : bag.label,
      };
    }
    if ("deviceId" in bag && typeof bag.deviceId === "string" && bag.deviceId) {
      return {
        kind: "camera",
        deviceId: bag.deviceId,
        label: bag.label,
        ownerId: getJayrrPhoneClientId(),
      };
    }
  }
  if (typeof value !== "string") {
    return null;
  }
  if (value === JAYRR_DISPLAY_SOURCE) {
    return { kind: "display", nonce: Date.now(), label: "Screen" };
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

const DesktopTune = ({
  quality,
  frameRate,
  fit,
  cropActive,
  hasCrop,
  onQuality,
  onFrameRate,
  onFit,
  onToggleCrop,
  onResetCrop,
}: {
  quality: JayrrDisplayQuality;
  frameRate: JayrrDisplayRate;
  fit: JayrrObjectFit;
  cropActive: boolean;
  hasCrop: boolean;
  onQuality: (next: JayrrDisplayQuality) => void;
  onFrameRate: (next: JayrrDisplayRate) => void;
  onFit: (next: JayrrObjectFit) => void;
  onToggleCrop: () => void;
  onResetCrop: () => void;
}) => (
  <div className="jayrr-camera-picker__tune">
    <label className="control-label">
      Size
      <select
        className="dropdown-select"
        value={quality}
        aria-label="Desktop size"
        onChange={(event) => {
          const next = event.target.value;
          if ((JAYRR_DISPLAY_QUALITIES as readonly string[]).includes(next)) {
            onQuality(next as JayrrDisplayQuality);
          }
        }}
      >
        {JAYRR_DISPLAY_QUALITIES.map((option) => (
          <option key={option} value={option}>
            {jayrrDisplayQualityLabel(option)}
          </option>
        ))}
      </select>
    </label>
    <label className="control-label">
      Frames
      <select
        className="dropdown-select"
        value={frameRate}
        aria-label="Desktop frames"
        onChange={(event) => {
          const next = Number(event.target.value);
          if (next === 30 || next === 60) {
            onFrameRate(next);
          }
        }}
      >
        {JAYRR_DISPLAY_RATES.map((option) => (
          <option key={option} value={option}>
            {option} fps
          </option>
        ))}
      </select>
    </label>
    <label className="control-label">
      Fit
      <select
        className="dropdown-select"
        value={fit}
        aria-label="Desktop fit"
        onChange={(event) => {
          const next = event.target.value;
          if ((JAYRR_OBJECT_FITS as readonly string[]).includes(next)) {
            onFit(next as JayrrObjectFit);
          }
        }}
      >
        {JAYRR_OBJECT_FITS.map((option) => (
          <option key={option} value={option}>
            {jayrrObjectFitLabel(option)}
          </option>
        ))}
      </select>
    </label>
    <div className="jayrr-camera-picker__crop">
      <span className="control-label">Crop</span>
      <div className="buttonList">
        <RadioButton
          icon={<>{cropIcon}</>}
          title="Crop desktop"
          active={cropActive}
          onClick={onToggleCrop}
        />
        {hasCrop ? (
          <button
            type="button"
            className="jayrr-camera-picker__crop-reset"
            onClick={onResetCrop}
          >
            Reset
          </button>
        ) : null}
      </div>
    </div>
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
  onUnlock,
  phoneSource,
  collaborating,
  people,
  phoneError,
  onPhoneChange,
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
}) => {
  const namedDevices = devices.filter((device) => device.deviceId);
  const cameraSource =
    source === JAYRR_DISPLAY_SOURCE || phoneSource ? "" : source;
  const desktopOn = source === JAYRR_DISPLAY_SOURCE;
  const cameraOn = Boolean(cameraSource);
  const phoneOn = Boolean(phoneSource);
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
  const cropChoice = (
    <IconButton
      type="button"
      icon={cropIcon}
      className={cropActive ? "ToolIcon--checked" : undefined}
      aria-label="Crop desktop"
      title="Crop desktop"
      onClick={onToggleCrop}
    />
  );
  const choices = compact ? (
    <>
      <div className="compact-action-item">{cameraChoice}</div>
      <div className="compact-action-item">{desktopChoice}</div>
      <div className="compact-action-item">{phoneChoice}</div>
      {desktopOn ? (
        <div className="compact-action-item">{cropChoice}</div>
      ) : null}
    </>
  ) : (
    <div className="buttonList">
      {cameraChoice}
      {desktopChoice}
      {phoneChoice}
    </div>
  );

  if (compact) {
    return choices;
  }

  return (
    <>
      {choices}
      {desktopOn ? (
        <DesktopTune
          quality={quality}
          frameRate={frameRate}
          fit={fit}
          cropActive={cropActive}
          hasCrop={hasCrop}
          onQuality={onQuality}
          onFrameRate={onFrameRate}
          onFit={onFit}
          onToggleCrop={onToggleCrop}
          onResetCrop={onResetCrop}
        />
      ) : null}
      {cameraOn ? (
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
  const mode = useStylesPanelMode();
  const compact = mode !== "full";
  const cropElementId = useAtomValue(desktopCropElementIdAtom);
  const setCropElementId = useSetAtom(desktopCropElementIdAtom);
  const collaborating = useAtomValue(isCollaboratingAtom);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
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
        keepDisplay(quality, frameRate, next);
      }}
      onToggleCrop={() => {
        setCropElementId(cropActive ? null : elementId);
      }}
      onResetCrop={() => {
        keepDisplay(quality, frameRate, fit, undefined);
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
