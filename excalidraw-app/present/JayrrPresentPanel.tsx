import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type DragOverEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { isFrameLikeElement, isTextElement } from "@excalidraw/element";
import {
  CaptureUpdateAction,
  newElementWith,
  useExcalidrawAPI,
} from "@excalidraw/excalidraw";
import { useExcalidrawContainer } from "@excalidraw/excalidraw/components/App";

import {
  checkIcon,
  chevronDownIcon,
  helpIcon,
  presentationIcon,
  settingsIcon,
} from "@excalidraw/excalidraw/components/icons";
import { ContextMenu, Popover } from "radix-ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { listJayrrMics, unlockJayrrMics } from "../camera/jayrrCameraStreams";
import { FilledButton, Island, Switch, Tooltip } from "../components/ui";
import "../components/ui/JayrrLibraryMenu.scss";
import { isConvexLinked } from "../convexClient";

import {
  defaultPresentTranslation,
  isPresentMove,
  JAYRR_PRESENT_TRANSLATION_TIME_DEFAULT,
  JAYRR_PRESENT_TRANSLATION_TIME_MAX,
  JAYRR_PRESENT_TRANSLATION_TIME_MIN,
  JAYRR_PRESENT_TYPE_TIME_DEFAULT,
  JAYRR_PRESENT_TYPE_TIME_MAX,
  JAYRR_PRESENT_TYPE_TIME_MIN,
  JAYRR_PRESENT_ZOOM_PERCENT_DEFAULT,
  JAYRR_PRESENT_ZOOM_PERCENT_MAX,
  JAYRR_PRESENT_ZOOM_PERCENT_MIN,
  reorderPresentIds,
  stepCaption,
  writePresentCamera,
  writePresentEffect,
  writePresentExit,
  writePresentLabel,
  writePresentMotion,
  writePresentOrder,
  writePresentPresence,
  writePresentSound,
  writePresentTextEffect,
  writePresentTranslation,
  writePresentZoomPercent,
  type PresentCamera,
  type PresentDeck,
  type PresentEffect,
  type PresentExit,
  type PresentFrame,
  type PresentMotion,
  type PresentPresence,
  type PresentSound,
  type PresentTextEffect,
  type PresentTextEffectKind,
  type PresentTranslation,
} from "./buildPresentDeck";
import {
  getPresentCustomCursor,
  setPresentCustomCursor,
} from "./presentCursor";
import {
  getPresentHideFrames,
  setPresentHideFrames,
} from "./presentHideFrames";
import { getPresentInteract, setPresentInteract } from "./presentInteract";
import {
  getPresentMic,
  PRESENT_MIC_DEFAULT,
  PRESENT_MIC_NONE,
  setPresentMic,
} from "./presentMic";
import {
  getPresentDefaultMotion,
  PRESENT_MOTION_LABEL,
  PRESENT_MOTIONS,
  setPresentDefaultMotion,
} from "./presentMotion";
import { PresentMoveIcon } from "./presentMoveIcon";
import { PresentSoundCue } from "./PresentSoundCue";
import {
  PRESENT_EASING_LABEL,
  PRESENT_EASINGS,
  PRESENT_PATH_KIND_LABEL,
  PRESENT_PATH_KINDS,
  startPresentTranslationPlace,
} from "./presentTranslation";

import "./JayrrPresentPanel.scss";

type ObjectOrderMap = Record<string, string[]>;

const recordIcon = (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
    <circle
      cx="10"
      cy="10"
      r="7.15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
    />
    <circle cx="10" cy="10" r="3.55" fill="#e10600" />
  </svg>
);

const focusTargetIcon = (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
    <circle
      cx="10"
      cy="10"
      r="7.25"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <circle
      cx="10"
      cy="10"
      r="3.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <circle cx="10" cy="10" r="1.15" fill="currentColor" />
  </svg>
);

const focusZoomIcon = (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
    <circle
      cx="8.6"
      cy="8.6"
      r="4.7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path
      d="M12.2 12.2 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M8.6 6.6v4M6.6 8.6h4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

type PresentMenuPane =
  | "transitions"
  | "camera"
  | "motion"
  | "translation"
  | "exit"
  | "text";

const PresentEffectMenu = ({
  className,
  effect,
  camera,
  motion,
  exit,
  translation,
  zoomPercent,
  skip,
  hide,
  text,
  textEffect,
  disabled,
  placeIds,
  onEffect,
  onCamera,
  onMotion,
  onExit,
  onTranslation,
  onZoomPercent,
  onPresence,
  onTextEffect,
  children,
}: {
  className?: string;
  effect: PresentEffect | null;
  camera?: PresentCamera | null;
  motion?: PresentMotion | null;
  exit?: PresentExit | null;
  translation?: PresentTranslation | null;
  zoomPercent?: number | null;
  skip?: boolean;
  hide?: boolean;
  text?: boolean;
  textEffect?: PresentTextEffect | null;
  disabled: boolean;
  placeIds?: readonly string[];
  onEffect: (effect: PresentEffect | null) => void;
  onCamera?: (camera: PresentCamera | null) => void;
  onMotion?: (motion: PresentMotion | null) => void;
  onExit?: (exit: PresentExit | null) => void;
  onTranslation?: (translation: PresentTranslation | null) => void;
  onZoomPercent?: (zoomPercent: number) => void;
  onPresence?: (presence: PresentPresence) => void;
  onTextEffect?: (textEffect: PresentTextEffect | null) => void;
  children: ReactNode;
}) => {
  const { container } = useExcalidrawContainer();
  const [zoomKind, setZoomKind] = useState<"zoom" | "scale" | null>(null);
  const [typeKind, setTypeKind] = useState<PresentTextEffectKind | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [pane, setPane] = useState<PresentMenuPane>("transitions");
  const inputRef = useRef<HTMLInputElement>(null);
  const typeInputRef = useRef<HTMLInputElement>(null);
  const currentZoom = zoomPercent ?? JAYRR_PRESENT_ZOOM_PERCENT_DEFAULT;
  const [zoomDraft, setZoomDraft] = useState(String(currentZoom));
  const move = isPresentMove(translation) ? translation : null;
  const currentTypeTime = textEffect?.time ?? JAYRR_PRESENT_TYPE_TIME_DEFAULT;
  const [timeDraft, setTimeDraft] = useState(
    String(move?.time ?? JAYRR_PRESENT_TRANSLATION_TIME_DEFAULT),
  );
  const [typeDraft, setTypeDraft] = useState(String(currentTypeTime));

  useEffect(() => {
    setZoomDraft(String(currentZoom));
  }, [currentZoom]);

  useEffect(() => {
    setTimeDraft(String(move?.time ?? JAYRR_PRESENT_TRANSLATION_TIME_DEFAULT));
  }, [move?.time]);

  useEffect(() => {
    if (!typeKind) {
      setTypeDraft(String(currentTypeTime));
      return;
    }
    const time =
      textEffect?.kind === typeKind
        ? textEffect.time
        : JAYRR_PRESENT_TYPE_TIME_DEFAULT;
    setTypeDraft(String(time));
  }, [currentTypeTime, textEffect?.kind, textEffect?.time, typeKind]);

  const commitZoomPercent = (kind: "zoom" | "scale") => {
    const next = Number(zoomDraft);
    if (!Number.isFinite(next)) {
      setZoomDraft(String(currentZoom));
      return;
    }
    const clamped = Math.min(
      JAYRR_PRESENT_ZOOM_PERCENT_MAX,
      Math.max(JAYRR_PRESENT_ZOOM_PERCENT_MIN, Math.round(next)),
    );
    setZoomDraft(String(clamped));
    onPresence?.(null);
    onZoomPercent?.(clamped);
    onEffect(kind);
  };
  const zoomControl = (kind: "zoom" | "scale", label: string) => {
    if (!onZoomPercent) {
      return null;
    }
    return (
      <Popover.Root
        open={zoomKind === kind}
        onOpenChange={(open) => setZoomKind(open ? kind : null)}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className="jayrr-present__zoom-gear"
            aria-label={label}
            title={`${currentZoom}%`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              onPresence?.(null);
              onEffect(kind);
            }}
          >
            {settingsIcon}
          </button>
        </Popover.Trigger>
        <Popover.Portal container={container}>
          <Popover.Content
            side="left"
            align="center"
            sideOffset={1}
            className="jayrr-present__zoom-box"
            data-prevent-outside-click
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              inputRef.current?.focus();
              inputRef.current?.select();
            }}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <label className="jayrr-present__zoom-field">
              <input
                ref={zoomKind === kind ? inputRef : undefined}
                type="number"
                className="jayrr-present__settings-select jayrr-present__zoom-input"
                min={JAYRR_PRESENT_ZOOM_PERCENT_MIN}
                max={JAYRR_PRESENT_ZOOM_PERCENT_MAX}
                step={10}
                value={zoomDraft}
                aria-label={label}
                onChange={(event) => setZoomDraft(event.target.value)}
                onBlur={() => commitZoomPercent(kind)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitZoomPercent(kind);
                  }
                }}
              />
              %
            </label>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  };
  const pickTextEffect = (kind: PresentTextEffectKind) => {
    onTextEffect?.({
      kind,
      time:
        textEffect?.kind === kind
          ? textEffect.time
          : JAYRR_PRESENT_TYPE_TIME_DEFAULT,
    });
  };
  const commitTypeTime = (kind: PresentTextEffectKind) => {
    const fallback =
      textEffect?.kind === kind
        ? textEffect.time
        : JAYRR_PRESENT_TYPE_TIME_DEFAULT;
    const next = Number(typeDraft);
    if (!Number.isFinite(next)) {
      setTypeDraft(String(fallback));
      return;
    }
    const clamped = Math.min(
      JAYRR_PRESENT_TYPE_TIME_MAX,
      Math.max(JAYRR_PRESENT_TYPE_TIME_MIN, Math.round(next)),
    );
    setTypeDraft(String(clamped));
    onTextEffect?.({ kind, time: clamped });
  };
  const typeControl = (kind: PresentTextEffectKind) => {
    if (!onTextEffect) {
      return null;
    }
    const label = kind === "typewriter" ? "Typewriter" : "Words";
    const time =
      textEffect?.kind === kind
        ? textEffect.time
        : JAYRR_PRESENT_TYPE_TIME_DEFAULT;
    return (
      <Popover.Root
        open={typeKind === kind}
        onOpenChange={(open) => setTypeKind(open ? kind : null)}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className="jayrr-present__zoom-gear"
            aria-label={`${label} type time`}
            title={`${time} ms`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => pickTextEffect(kind)}
          >
            {settingsIcon}
          </button>
        </Popover.Trigger>
        <Popover.Portal container={container}>
          <Popover.Content
            side="left"
            align="center"
            sideOffset={1}
            className="jayrr-present__zoom-box jayrr-present__move-box"
            data-prevent-outside-click
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              typeInputRef.current?.focus();
              typeInputRef.current?.select();
            }}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <label className="jayrr-present__move-field">
              Type time
              <span className="jayrr-present__zoom-field">
                <input
                  ref={typeKind === kind ? typeInputRef : undefined}
                  type="number"
                  className="jayrr-present__settings-select jayrr-present__zoom-input"
                  min={JAYRR_PRESENT_TYPE_TIME_MIN}
                  max={JAYRR_PRESENT_TYPE_TIME_MAX}
                  step={50}
                  value={typeDraft}
                  aria-label={`${label} type time`}
                  onChange={(event) => setTypeDraft(event.target.value)}
                  onBlur={() => commitTypeTime(kind)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitTypeTime(kind);
                    }
                  }}
                />
                ms
              </span>
            </label>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  };
  const commitMove = (patch: Partial<PresentTranslation>) => {
    const base = move ?? defaultPresentTranslation();
    const nextTime = patch.time ?? base.time;
    const next: PresentTranslation = {
      ...base,
      ...patch,
      kind: patch.kind ?? base.kind,
      time: Math.min(
        JAYRR_PRESENT_TRANSLATION_TIME_MAX,
        Math.max(JAYRR_PRESENT_TRANSLATION_TIME_MIN, Math.round(nextTime)),
      ),
    };
    if (next.pathKind === "line") {
      delete next.path;
    }
    onTranslation?.(next);
  };
  const moveControl = () => {
    if (!onTranslation) {
      return null;
    }
    return (
      <Popover.Root open={moveOpen} onOpenChange={setMoveOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="jayrr-present__zoom-gear"
            aria-label="Edit move"
            title="Edit move"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              if (!move) {
                onTranslation(defaultPresentTranslation());
              }
            }}
          >
            {settingsIcon}
          </button>
        </Popover.Trigger>
        <Popover.Portal container={container}>
          <Popover.Content
            side="left"
            align="center"
            sideOffset={1}
            className="jayrr-present__zoom-box jayrr-present__move-box"
            data-prevent-outside-click
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <label className="jayrr-present__move-field">
              Time
              <span className="jayrr-present__zoom-field">
                <input
                  type="number"
                  className="jayrr-present__settings-select jayrr-present__zoom-input"
                  min={JAYRR_PRESENT_TRANSLATION_TIME_MIN}
                  max={JAYRR_PRESENT_TRANSLATION_TIME_MAX}
                  step={50}
                  value={timeDraft}
                  aria-label="Move time"
                  onChange={(event) => setTimeDraft(event.target.value)}
                  onBlur={() => {
                    const next = Number(timeDraft);
                    if (!Number.isFinite(next)) {
                      setTimeDraft(
                        String(
                          move?.time ?? JAYRR_PRESENT_TRANSLATION_TIME_DEFAULT,
                        ),
                      );
                      return;
                    }
                    commitMove({ time: next });
                  }}
                />
                ms
              </span>
            </label>
            <label className="jayrr-present__move-field">
              Easing
              <select
                className="jayrr-present__settings-select"
                value={move?.easing ?? "easeOut"}
                aria-label="Move easing"
                onChange={(event) => {
                  const easing = PRESENT_EASINGS.find(
                    (item) => item === event.target.value,
                  );
                  if (easing) {
                    commitMove({ easing });
                  }
                }}
              >
                {PRESENT_EASINGS.map((item) => (
                  <option key={item} value={item}>
                    {PRESENT_EASING_LABEL[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="jayrr-present__move-field">
              Call path
              <select
                className="jayrr-present__settings-select"
                value={move?.pathKind ?? "line"}
                aria-label="Move call path"
                onChange={(event) => {
                  const pathKind = PRESENT_PATH_KINDS.find(
                    (item) => item === event.target.value,
                  );
                  if (!pathKind) {
                    return;
                  }
                  if (pathKind === (move?.pathKind ?? "line")) {
                    return;
                  }
                  commitMove({ pathKind, path: undefined });
                }}
              >
                {PRESENT_PATH_KINDS.map((item) => (
                  <option key={item} value={item}>
                    {PRESENT_PATH_KIND_LABEL[item]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="jayrr-present__move-position"
              onClick={() => {
                const pathKind = move?.pathKind ?? "line";
                if (!move) {
                  onTranslation(defaultPresentTranslation());
                }
                if (placeIds && placeIds.length > 0) {
                  startPresentTranslationPlace(placeIds, pathKind);
                }
                setMoveOpen(false);
              }}
            >
              Position
            </button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  };
  const triggerClass = className
    ? `jayrr-present__effect-trigger ${className}`
    : "jayrr-present__effect-trigger";
  const parked = Boolean(skip || hide);
  const body = (
    <>
      {children}
      {effect === "focus" && !parked ? (
        <span className="jayrr-present__focus" role="img" aria-label="Focus">
          {focusTargetIcon}
        </span>
      ) : null}
      {effect === "zoom" && !parked ? (
        <span
          className="jayrr-present__focus"
          role="img"
          aria-label="Focus Zoom"
        >
          {focusZoomIcon}
        </span>
      ) : null}
      {effect === "scale" && !parked ? (
        <span className="jayrr-present__focus" role="img" aria-label="Zoom">
          {focusZoomIcon}
        </span>
      ) : null}
      {exit && !parked ? (
        <span
          className="jayrr-present__exit-mark"
          role="img"
          aria-label={`Motion-out ${PRESENT_MOTION_LABEL[exit]}`}
          title={`Out ${PRESENT_MOTION_LABEL[exit]}`}
        />
      ) : null}
      {(effect === "zoom" || effect === "scale") &&
      !parked &&
      zoomPercent !== null &&
      zoomPercent !== undefined &&
      zoomPercent !== JAYRR_PRESENT_ZOOM_PERCENT_DEFAULT ? (
        <span className="jayrr-present__motion-tag">{`${zoomPercent}%`}</span>
      ) : null}
      {motion && !parked ? (
        <span
          className="jayrr-present__motion-tag"
          title={`In ${PRESENT_MOTION_LABEL[motion]}`}
        >
          {PRESENT_MOTION_LABEL[motion]}
        </span>
      ) : null}
      {exit && !parked ? (
        <span
          className="jayrr-present__motion-tag"
          title={`Out ${PRESENT_MOTION_LABEL[exit]}`}
        >
          {`Out ${PRESENT_MOTION_LABEL[exit]}`}
        </span>
      ) : null}
      {move && !parked ? (
        <span
          className="jayrr-present__move-mark"
          role="img"
          aria-label={move.kind === "showMove" ? "Show n Move" : "Move"}
          title={move.kind === "showMove" ? "Show n Move" : "Move"}
        >
          <PresentMoveIcon />
        </span>
      ) : null}
      {skip ? (
        <span className="jayrr-present__motion-tag" title="Skip">
          Skip
        </span>
      ) : null}
      {hide ? (
        <span className="jayrr-present__motion-tag" title="Hide">
          Hide
        </span>
      ) : null}
      {camera === "fixed" && !parked ? (
        <span className="jayrr-present__motion-tag" title="Fixed Overlay">
          Overlay
        </span>
      ) : null}
      {textEffect && !parked ? (
        <span
          className="jayrr-present__motion-tag"
          title={textEffect.kind === "typewriter" ? "Typewriter" : "Words"}
        >
          {textEffect.kind === "typewriter" ? "Typewriter" : "Words"}
        </span>
      ) : null}
    </>
  );
  if (disabled) {
    return <div className={triggerClass}>{body}</div>;
  }
  const panes: { id: PresentMenuPane; label: string }[] = [
    { id: "transitions", label: "Transitions" },
  ];
  if (onCamera && !parked) {
    panes.push({ id: "camera", label: "Camera" });
  }
  if (onTranslation && !parked) {
    panes.push({ id: "translation", label: "Translation" });
  }
  if (onMotion && !parked) {
    panes.push({ id: "motion", label: "Motion-in" });
  }
  if (onExit && !parked) {
    panes.push({ id: "exit", label: "Motion-out" });
  }
  if (text && onTextEffect && !parked) {
    panes.push({ id: "text", label: "Text-effect" });
  }
  const activePane = panes.some((item) => item.id === pane)
    ? pane
    : "transitions";
  const option = (
    label: string,
    active: boolean,
    onPick: () => void,
    gear?: ReactNode,
    key?: string,
  ) => (
    <div key={key} className="jayrr-present__menu-option-row">
      <ContextMenu.Item
        className="jayrr-present__menu-option"
        onSelect={onPick}
      >
        <span>{label}</span>
        <span className="jayrr-present__menu-check">
          {active ? checkIcon : null}
        </span>
      </ContextMenu.Item>
      {gear ? gear : null}
    </div>
  );
  return (
    <ContextMenu.Root modal={false}>
      <ContextMenu.Trigger asChild>
        <div className={triggerClass}>{body}</div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal container={container}>
        <ContextMenu.Content
          className="jayrr-present__menu"
          collisionPadding={8}
          data-prevent-outside-click
          onPointerDownOutside={(event) => {
            const target = event.target;
            if (
              target instanceof Element &&
              target.closest(
                ".jayrr-present__zoom-box, .jayrr-present__move-box",
              )
            ) {
              event.preventDefault();
            }
          }}
          onFocusOutside={(event) => {
            const target = event.target;
            if (
              target instanceof Element &&
              target.closest(
                ".jayrr-present__zoom-box, .jayrr-present__move-box",
              )
            ) {
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            const target = event.target;
            if (
              target instanceof Element &&
              target.closest(
                ".jayrr-present__zoom-box, .jayrr-present__move-box",
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <div className="jayrr-present__menu-split">
            <div className="jayrr-present__menu-nav">
              {panes.map((item) => (
                <ContextMenu.Item
                  key={item.id}
                  className={
                    activePane === item.id
                      ? "jayrr-present__menu-nav-item is-active"
                      : "jayrr-present__menu-nav-item"
                  }
                  onSelect={(event) => {
                    event.preventDefault();
                    setPane(item.id);
                  }}
                >
                  {item.label}
                </ContextMenu.Item>
              ))}
            </div>
            <div className="jayrr-present__menu-pane">
              {activePane === "transitions" ? (
                <>
                  {option("None", !parked && effect === null, () => {
                    onPresence?.(null);
                    onEffect(null);
                  })}
                  {option("Focus", !parked && effect === "focus", () => {
                    onPresence?.(null);
                    onEffect("focus");
                  })}
                  {option(
                    "Focus Zoom",
                    !parked && effect === "zoom",
                    () => {
                      onPresence?.(null);
                      onEffect("zoom");
                    },
                    zoomControl("zoom", "Focus Zoom percent"),
                  )}
                  {option(
                    "Zoom",
                    !parked && effect === "scale",
                    () => {
                      onPresence?.(null);
                      onEffect("scale");
                    },
                    zoomControl("scale", "Zoom percent"),
                  )}
                  {onPresence
                    ? option("Skip", Boolean(skip), () => onPresence("skip"))
                    : null}
                  {onPresence
                    ? option("Hide", Boolean(hide), () => onPresence("hide"))
                    : null}
                </>
              ) : null}
              {activePane === "camera" && onCamera ? (
                <>
                  {option("None", camera !== "fixed", () => onCamera(null))}
                  {option("Fixed Overlay", camera === "fixed", () =>
                    onCamera("fixed"),
                  )}
                </>
              ) : null}
              {activePane === "motion" && onMotion ? (
                <>
                  {option(
                    "Default",
                    motion === null || motion === undefined,
                    () => onMotion(null),
                  )}
                  {option("None", motion === "none", () => onMotion("none"))}
                  {PRESENT_MOTIONS.map((item) =>
                    option(
                      PRESENT_MOTION_LABEL[item],
                      motion === item,
                      () => onMotion(item),
                      undefined,
                      item,
                    ),
                  )}
                </>
              ) : null}
              {activePane === "translation" && onTranslation ? (
                <>
                  {option("None", !move, () => onTranslation(null))}
                  {option(
                    "Move",
                    move?.kind === "move",
                    () =>
                      onTranslation({
                        ...(move ?? defaultPresentTranslation()),
                        kind: "move",
                      }),
                    move?.kind === "move" ? moveControl() : undefined,
                  )}
                  {option(
                    "Show n Move",
                    move?.kind === "showMove",
                    () =>
                      onTranslation({
                        ...(move ?? defaultPresentTranslation("showMove")),
                        kind: "showMove",
                      }),
                    move?.kind === "showMove" ? moveControl() : undefined,
                  )}
                </>
              ) : null}
              {activePane === "exit" && onExit ? (
                <>
                  {option("None", !exit, () => onExit(null))}
                  {PRESENT_MOTIONS.map((item: PresentExit) =>
                    option(
                      PRESENT_MOTION_LABEL[item],
                      exit === item,
                      () => onExit(item),
                      undefined,
                      `out-${item}`,
                    ),
                  )}
                </>
              ) : null}
              {activePane === "text" && onTextEffect ? (
                <>
                  {option("None", !textEffect, () => onTextEffect(null))}
                  {option(
                    "Typewriter",
                    textEffect?.kind === "typewriter",
                    () => pickTextEffect("typewriter"),
                    typeControl("typewriter"),
                  )}
                  {option(
                    "Words",
                    textEffect?.kind === "words",
                    () => pickTextEffect("words"),
                    typeControl("words"),
                  )}
                </>
              ) : null}
            </div>
          </div>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

const PresentSettingsPopover = () => {
  const api = useExcalidrawAPI();
  const { container } = useExcalidrawContainer();
  const [open, setOpen] = useState(false);
  const [hideFrames, setHideFrames] = useState(getPresentHideFrames);
  const [customCursor, setCustomCursor] = useState(getPresentCustomCursor);
  const [interact, setInteract] = useState(getPresentInteract);
  const [motion, setMotion] = useState(getPresentDefaultMotion);
  const [micId, setMicId] = useState(getPresentMic);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const savedMicMissing =
    micId !== PRESENT_MIC_DEFAULT &&
    micId !== PRESENT_MIC_NONE &&
    !mics.some((device) => device.deviceId === micId);

  useEffect(() => {
    api?.updateFrameRendering({ enabled: true });
  }, [api]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const ownerWindow = container?.ownerDocument.defaultView ?? window;
    let cancelled = false;
    const load = async () => {
      let devices: MediaDeviceInfo[] = [];
      try {
        devices = await unlockJayrrMics(ownerWindow);
      } catch {
        devices = await listJayrrMics();
      }
      if (!cancelled) {
        setMics(devices);
      }
    };
    void load();
    const media = ownerWindow.navigator.mediaDevices;
    media?.addEventListener("devicechange", load);
    return () => {
      cancelled = true;
      media?.removeEventListener("devicechange", load);
    };
  }, [container, open]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="jayrr-library__icon-button"
          aria-label="Present settings"
          aria-expanded={open}
        >
          {settingsIcon}
        </button>
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={8}
          collisionBoundary={container ?? undefined}
          data-prevent-outside-click
          className="jayrr-present__settings-popover"
        >
          <Island padding={2}>
            <div className="jayrr-present__settings-head">
              <h3 className="jayrr-present__settings-title">Settings</h3>
              <Tooltip
                label="Motion is the default enter for every object. Right-click a row for transition, camera, motion-in, motion-out, or text-effect on text. Hide frames removes borders and names in Present. Big cursor shows an oversized pointer with a click burst. Interact keeps shapes draggable while presenting; a quick tap still advances. Mic is the voice recorded with Present."
                long
                position="top"
              >
                <span className="jayrr-present__settings-info">{helpIcon}</span>
              </Tooltip>
            </div>
            <div className="jayrr-present__settings-row">
              <label htmlFor="presentMotion">Motion-in</label>
              <select
                id="presentMotion"
                className="jayrr-present__settings-select"
                value={motion}
                onChange={(event) => {
                  const next = event.target.value as PresentMotion;
                  setMotion(next);
                  setPresentDefaultMotion(next);
                }}
              >
                <option value="none">{PRESENT_MOTION_LABEL.none}</option>
                {PRESENT_MOTIONS.map((item) => (
                  <option key={item} value={item}>
                    {PRESENT_MOTION_LABEL[item]}
                  </option>
                ))}
              </select>
            </div>
            <div className="jayrr-present__settings-row">
              <label htmlFor="hideFrames">Hide frames</label>
              <Switch
                name="hideFrames"
                checked={hideFrames}
                onChange={(checked) => {
                  setHideFrames(checked);
                  setPresentHideFrames(checked);
                }}
              />
            </div>
            <div className="jayrr-present__settings-row">
              <label htmlFor="presentInteract">Interact</label>
              <Switch
                name="presentInteract"
                checked={interact}
                onChange={(checked) => {
                  setInteract(checked);
                  setPresentInteract(checked);
                }}
              />
            </div>
            <div className="jayrr-present__settings-row">
              <label htmlFor="customCursor">Big cursor</label>
              <Switch
                name="customCursor"
                checked={customCursor}
                onChange={(checked) => {
                  setCustomCursor(checked);
                  setPresentCustomCursor(checked);
                }}
              />
            </div>
            <div className="jayrr-present__settings-row">
              <label htmlFor="presentMic">Mic</label>
              <select
                id="presentMic"
                className="jayrr-present__settings-select"
                value={micId}
                onChange={(event) => {
                  const next = event.target.value;
                  setMicId(next);
                  setPresentMic(next);
                }}
              >
                <option value={PRESENT_MIC_DEFAULT}>Default</option>
                <option value={PRESENT_MIC_NONE}>None</option>
                {savedMicMissing ? (
                  <option value={micId}>Saved microphone</option>
                ) : null}
                {mics.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>
          </Island>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
const listForId = (
  frameIds: readonly string[],
  objectIds: ObjectOrderMap,
  id: UniqueIdentifier,
): { listKey: string; ids: string[] } | null => {
  const sid = String(id);
  if (frameIds.includes(sid)) {
    return { listKey: "frames", ids: [...frameIds] };
  }
  for (const [frameId, ids] of Object.entries(objectIds)) {
    if (ids.includes(sid)) {
      return { listKey: `objects:${frameId}`, ids: [...ids] };
    }
  }
  return null;
};

const resolveOverId = (
  frameIds: readonly string[],
  objectIds: ObjectOrderMap,
  activeListKey: string,
  overId: UniqueIdentifier,
): string | null => {
  const sid = String(overId);
  if (activeListKey === "frames") {
    if (frameIds.includes(sid)) {
      return sid;
    }
    for (const [frameId, ids] of Object.entries(objectIds)) {
      if (ids.includes(sid)) {
        return frameId;
      }
    }
    return null;
  }
  if (!activeListKey.startsWith("objects:")) {
    return null;
  }
  const frameId = activeListKey.slice("objects:".length);
  const ids = objectIds[frameId];
  if (ids?.includes(sid)) {
    return sid;
  }
  return null;
};

const EditablePresentName = ({
  index,
  name,
  selected,
  renaming,
  draftName,
  attributes,
  listeners,
  onSelect,
  onStartRename,
  onDraftChange,
  onCommit,
  onCancel,
}: {
  index: number | null;
  name: string;
  selected: boolean;
  renaming: boolean;
  draftName: string;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  onSelect: () => void;
  onStartRename: () => void;
  onDraftChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!renaming) {
      return;
    }
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [renaming]);

  if (renaming) {
    return (
      <input
        ref={inputRef}
        className="jayrr-present__name-input"
        value={draftName}
        aria-label="Name"
        onChange={(event) => onDraftChange(event.target.value)}
        onBlur={onCommit}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCommit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className={
        selected ? "jayrr-present__name is-selected" : "jayrr-present__name"
      }
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onStartRename();
      }}
      {...attributes}
      {...listeners}
    >
      {index === null ? name : `${index}. ${name}`}
    </button>
  );
};

const SortableFrameBlock = ({
  id,
  index,
  disabled,
  name,
  selected,
  collapsed,
  renaming,
  draftName,
  effect,
  zoomPercent,
  onSelect,
  onToggleCollapse,
  onStartRename,
  onDraftChange,
  onCommit,
  onCancel,
  onEffect,
  onZoomPercent,
  sound,
  onSound,
  children,
}: {
  id: string;
  index: number;
  disabled: boolean;
  name: string;
  selected: boolean;
  collapsed: boolean;
  renaming: boolean;
  draftName: string;
  effect: PresentEffect | null;
  zoomPercent: number | null;
  sound: PresentSound | null;
  onSelect: () => void;
  onToggleCollapse: () => void;
  onStartRename: () => void;
  onDraftChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onEffect: (effect: PresentEffect | null) => void;
  onZoomPercent: (zoomPercent: number) => void;
  onSound: (sound: PresentSound | null) => void;
  children: ReactNode;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: disabled || renaming });

  return (
    <li
      ref={setNodeRef}
      className={
        isDragging ? "jayrr-present__frame is-dragging" : "jayrr-present__frame"
      }
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <div className="jayrr-present__frame-head">
        <PresentEffectMenu
          effect={effect}
          zoomPercent={zoomPercent}
          disabled={renaming}
          onEffect={onEffect}
          onZoomPercent={onZoomPercent}
        >
          <EditablePresentName
            index={index}
            name={name}
            selected={selected}
            renaming={renaming}
            draftName={draftName}
            attributes={attributes}
            listeners={listeners}
            onSelect={onSelect}
            onStartRename={onStartRename}
            onDraftChange={onDraftChange}
            onCommit={onCommit}
            onCancel={onCancel}
          />
        </PresentEffectMenu>
        <button
          type="button"
          className={
            collapsed
              ? "jayrr-present__collapse-hit is-collapsed"
              : "jayrr-present__collapse-hit"
          }
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand frame" : "Collapse frame"}
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapse();
          }}
        >
          <span className="jayrr-present__collapse">{chevronDownIcon}</span>
        </button>
        <PresentSoundCue
          sound={sound}
          label="Frame sound"
          disabled={renaming}
          onSound={onSound}
        />
      </div>
      {collapsed ? null : children}
    </li>
  );
};

const SortableObjectBlock = ({
  id,
  index,
  disabled,
  name,
  selected,
  renaming,
  draftName,
  effect,
  camera,
  motion,
  exit,
  translation,
  zoomPercent,
  skip,
  hide,
  text,
  textEffect,
  placeIds,
  onSelect,
  onStartRename,
  onDraftChange,
  onCommit,
  onCancel,
  onEffect,
  onCamera,
  onMotion,
  onExit,
  onTranslation,
  onZoomPercent,
  onPresence,
  onTextEffect,
  sound,
  onSound,
}: {
  id: string;
  index: number | null;
  disabled: boolean;
  name: string;
  selected: boolean;
  renaming: boolean;
  draftName: string;
  effect: PresentEffect | null;
  camera: PresentCamera | null;
  motion: PresentMotion | null;
  exit: PresentExit | null;
  translation: PresentTranslation | null;
  zoomPercent: number | null;
  skip: boolean;
  hide: boolean;
  text: boolean;
  textEffect: PresentTextEffect | null;
  placeIds: readonly string[];
  onSelect: () => void;
  onStartRename: () => void;
  onDraftChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onEffect: (effect: PresentEffect | null) => void;
  onCamera: (camera: PresentCamera | null) => void;
  onMotion: (motion: PresentMotion | null) => void;
  onExit: (exit: PresentExit | null) => void;
  onTranslation: (translation: PresentTranslation | null) => void;
  onZoomPercent: (zoomPercent: number) => void;
  onPresence: (presence: PresentPresence) => void;
  onTextEffect: (textEffect: PresentTextEffect | null) => void;
  sound: PresentSound | null;
  onSound: (sound: PresentSound | null) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: disabled || renaming });

  return (
    <li
      ref={setNodeRef}
      className={`jayrr-present__row${isDragging ? " is-dragging" : ""}${
        hide ? " is-hidden" : ""
      }`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <PresentEffectMenu
        effect={effect}
        camera={camera}
        motion={motion}
        exit={exit}
        translation={translation}
        zoomPercent={zoomPercent}
        skip={skip}
        hide={hide}
        text={text}
        textEffect={textEffect}
        disabled={renaming}
        placeIds={placeIds}
        onEffect={onEffect}
        onCamera={onCamera}
        onMotion={onMotion}
        onExit={onExit}
        onTranslation={onTranslation}
        onZoomPercent={onZoomPercent}
        onPresence={onPresence}
        onTextEffect={onTextEffect}
      >
        <EditablePresentName
          index={index}
          name={name}
          selected={selected}
          renaming={renaming}
          draftName={draftName}
          attributes={attributes}
          listeners={listeners}
          onSelect={onSelect}
          onStartRename={onStartRename}
          onDraftChange={onDraftChange}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      </PresentEffectMenu>
      <span className="jayrr-present__sound-gutter" aria-hidden="true" />
      <PresentSoundCue
        sound={sound}
        label="Object sound"
        disabled={renaming}
        onSound={onSound}
      />
    </li>
  );
};

export const JayrrPresentPanel = ({
  deck,
  presenting,
  uploading,
  stepIndex,
  selectedElementIds,
  startPresent,
  startRecordPresent,
  stopPresent,
}: {
  deck: PresentDeck;
  presenting: boolean;
  uploading: boolean;
  stepIndex: number;
  selectedElementIds: Record<string, boolean>;
  startPresent: () => void;
  startRecordPresent: () => void;
  stopPresent: () => void;
}) => {
  const api = useExcalidrawAPI();
  const [frameIds, setFrameIds] = useState<string[]>([]);
  const [objectIds, setObjectIds] = useState<ObjectOrderMap>({});
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [collapsedFrameIds, setCollapsedFrameIds] = useState<
    Record<string, boolean>
  >({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const skipClickRef = useRef(false);
  const frameIdsRef = useRef(frameIds);
  const objectIdsRef = useRef(objectIds);

  frameIdsRef.current = frameIds;
  objectIdsRef.current = objectIds;

  useEffect(() => {
    if (activeId !== null) {
      return;
    }
    setFrameIds(deck.frames.map((frame) => frame.id));
    const nextObjects: ObjectOrderMap = {};
    for (const frame of deck.frames) {
      nextObjects[frame.id] = frame.objects.map((object) => object.id);
    }
    setObjectIds(nextObjects);
  }, [activeId, deck]);

  const frameById = useMemo(() => {
    const map = new Map<string, PresentFrame>();
    for (const frame of deck.frames) {
      map.set(frame.id, frame);
    }
    return map;
  }, [deck.frames]);

  const persistOrders = useCallback(
    (nextFrameIds: readonly string[], nextObjectIds: ObjectOrderMap) => {
      if (!api) {
        return;
      }
      const orderById = new Map<string, number>();
      nextFrameIds.forEach((id, index) => {
        orderById.set(id, index + 1);
      });
      for (const ids of Object.values(nextObjectIds)) {
        ids.forEach((id, index) => {
          orderById.set(id, index + 1);
        });
      }
      const all = api.getSceneElementsIncludingDeleted();
      const next = all.map((element) => {
        const order = orderById.get(element.id);
        if (order === undefined) {
          return element;
        }
        return newElementWith(element, {
          customData: writePresentOrder(element, order),
        });
      });
      api.updateScene({
        elements: next,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [api],
  );

  const persistPresentName = useCallback(
    (id: string, name: string) => {
      if (!api) {
        return;
      }
      const trimmed = name.trim();
      const all = api.getSceneElementsIncludingDeleted();
      const next = all.map((element) => {
        if (element.id !== id) {
          return element;
        }
        if (isFrameLikeElement(element)) {
          return newElementWith(element, {
            name: trimmed.length > 0 ? trimmed : null,
          });
        }
        return newElementWith(element, {
          customData: writePresentLabel(
            element,
            trimmed.length > 0 ? trimmed : null,
          ),
        });
      });
      api.updateScene({
        elements: next,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [api],
  );

  const persistPresentMotion = useCallback(
    (ids: readonly string[], motion: PresentMotion | null) => {
      if (!api || ids.length === 0) {
        return;
      }
      const targets = new Set(ids);
      const all = api.getSceneElementsIncludingDeleted();
      const next = all.map((element) => {
        if (!targets.has(element.id)) {
          return element;
        }
        return newElementWith(element, {
          customData: writePresentMotion(element, motion),
        });
      });
      api.updateScene({
        elements: next,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [api],
  );

  const persistPresentExit = useCallback(
    (ids: readonly string[], exit: PresentExit | null) => {
      if (!api || ids.length === 0) {
        return;
      }
      const targets = new Set(ids);
      const all = api.getSceneElementsIncludingDeleted();
      const next = all.map((element) => {
        if (!targets.has(element.id)) {
          return element;
        }
        return newElementWith(element, {
          customData: writePresentExit(element, exit),
        });
      });
      api.updateScene({
        elements: next,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [api],
  );

  const persistPresentTranslation = useCallback(
    (ids: readonly string[], translation: PresentTranslation | null) => {
      if (!api || ids.length === 0) {
        return;
      }
      const targets = new Set(ids);
      const all = api.getSceneElementsIncludingDeleted();
      const next = all.map((element) => {
        if (!targets.has(element.id)) {
          return element;
        }
        return newElementWith(element, {
          customData: writePresentTranslation(element, translation),
        });
      });
      api.updateScene({
        elements: next,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [api],
  );

  const persistPresentZoomPercent = useCallback(
    (ids: readonly string[], zoomPercent: number) => {
      if (!api || ids.length === 0) {
        return;
      }
      const targets = new Set(ids);
      const all = api.getSceneElementsIncludingDeleted();
      const next = all.map((element) => {
        if (!targets.has(element.id)) {
          return element;
        }
        return newElementWith(element, {
          customData: writePresentZoomPercent(element, zoomPercent),
        });
      });
      api.updateScene({
        elements: next,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [api],
  );

  const persistPresentTextEffect = useCallback(
    (ids: readonly string[], textEffect: PresentTextEffect | null) => {
      if (!api || ids.length === 0) {
        return;
      }
      const targets = new Set(ids);
      const all = api.getSceneElementsIncludingDeleted();
      const next = all.map((element) => {
        if (!targets.has(element.id) || !isTextElement(element)) {
          return element;
        }
        return newElementWith(element, {
          customData: writePresentTextEffect(element, textEffect),
        });
      });
      api.updateScene({
        elements: next,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [api],
  );

  const persistPresentPresence = useCallback(
    (ids: readonly string[], presence: PresentPresence) => {
      if (!api || ids.length === 0) {
        return;
      }
      const targets = new Set(ids);
      const all = api.getSceneElementsIncludingDeleted();
      const next = all.map((element) => {
        if (!targets.has(element.id)) {
          return element;
        }
        return newElementWith(element, {
          customData: writePresentPresence(element, presence),
        });
      });
      api.updateScene({
        elements: next,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [api],
  );

  const persistPresentEffect = useCallback(
    (ids: readonly string[], effect: PresentEffect | null) => {
      if (!api || ids.length === 0) {
        return;
      }
      const targets = new Set(ids);
      const all = api.getSceneElementsIncludingDeleted();
      const next = all.map((element) => {
        if (!targets.has(element.id)) {
          return element;
        }
        return newElementWith(element, {
          customData: writePresentEffect(element, effect),
        });
      });
      api.updateScene({
        elements: next,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [api],
  );

  const persistPresentCamera = useCallback(
    (ids: readonly string[], camera: PresentCamera | null) => {
      if (!api || ids.length === 0) {
        return;
      }
      const targets = new Set(ids);
      const all = api.getSceneElementsIncludingDeleted();
      const next = all.map((element) => {
        if (!targets.has(element.id)) {
          return element;
        }
        return newElementWith(element, {
          customData: writePresentCamera(element, camera),
        });
      });
      api.updateScene({
        elements: next,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [api],
  );

  const persistPresentSound = useCallback(
    (ids: readonly string[], sound: PresentSound | null) => {
      if (!api || ids.length === 0) {
        return;
      }
      const targets = new Set(ids);
      const all = api.getSceneElementsIncludingDeleted();
      const next = all.map((element) => {
        if (!targets.has(element.id)) {
          return element;
        }
        return newElementWith(element, {
          customData: writePresentSound(element, sound) ?? {},
        });
      });
      api.updateScene({
        elements: next,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [api],
  );

  const startRename = (id: string, currentName: string) => {
    if (presenting) {
      return;
    }
    setDraftName(currentName);
    setRenamingId(id);
  };

  const commitRename = () => {
    if (!renamingId) {
      return;
    }
    persistPresentName(renamingId, draftName);
    setRenamingId(null);
  };

  const cancelRename = () => {
    setRenamingId(null);
  };

  const moveInList = useCallback(
    (listKey: string, fromId: string, toId: string) => {
      if (fromId === toId) {
        return;
      }
      if (listKey === "frames") {
        setFrameIds((ids) =>
          reorderPresentIds(ids, ids.indexOf(fromId), ids.indexOf(toId)),
        );
        return;
      }
      const frameId = listKey.slice("objects:".length);
      setObjectIds((current) => {
        const ids = current[frameId];
        if (!ids) {
          return current;
        }
        return {
          ...current,
          [frameId]: reorderPresentIds(
            ids,
            ids.indexOf(fromId),
            ids.indexOf(toId),
          ),
        };
      });
    },
    [],
  );

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const collisions = closestCorners(args);
    const currentFrames = frameIdsRef.current;
    const currentObjects = objectIdsRef.current;
    const activeList = listForId(currentFrames, currentObjects, args.active.id);
    if (!activeList) {
      return collisions;
    }
    return collisions.filter((collision) => {
      return (
        resolveOverId(
          currentFrames,
          currentObjects,
          activeList.listKey,
          collision.id,
        ) !== null
      );
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const selectId = (id: string) => {
    if (!api || presenting || skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }
    api.updateScene({
      appState: {
        selectedElementIds: { [id]: true },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    });
  };

  const onDragStart = ({ active }: { active: { id: UniqueIdentifier } }) => {
    setActiveId(active.id);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) {
      return;
    }
    const currentFrames = frameIdsRef.current;
    const currentObjects = objectIdsRef.current;
    const activeList = listForId(currentFrames, currentObjects, active.id);
    if (!activeList) {
      return;
    }
    const overId = resolveOverId(
      currentFrames,
      currentObjects,
      activeList.listKey,
      over.id,
    );
    if (!overId) {
      return;
    }
    moveInList(activeList.listKey, String(active.id), overId);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (over && String(active.id) !== String(over.id)) {
      skipClickRef.current = true;
    }
    persistOrders(frameIdsRef.current, objectIdsRef.current);
  };

  const onDragCancel = () => {
    setActiveId(null);
  };

  const textIds = new Set<string>();
  for (const element of api?.getSceneElements() ?? []) {
    if (isTextElement(element)) {
      textIds.add(element.id);
    }
  }

  return (
    <div className="layer-ui__library jayrr-library jayrr-present">
      <div className="jayrr-library__header">
        <h2 className="jayrr-library__title">Present</h2>
        <span className="jayrr-present__sr">
          Nested reveal order for frames and the shapes inside them. Drag a
          block to reorder. Right-click a row to set its transition. Text rows
          also have text-effect.
        </span>
        <div className="jayrr-library__header-actions">
          <PresentSettingsPopover />
        </div>
      </div>
      <div className="jayrr-present__body">
        <div className="jayrr-present__actions">
          {presenting ? (
            <FilledButton
              color="muted"
              variant="outlined"
              label="Exit"
              onClick={stopPresent}
              fullWidth
            >
              Exit
            </FilledButton>
          ) : (
            <>
              <FilledButton
                color="primary"
                label="Present"
                icon={presentationIcon}
                onClick={startPresent}
                disabled={deck.frames.length === 0}
              >
                Present
              </FilledButton>
              <FilledButton
                color="danger"
                label="Record"
                icon={recordIcon}
                onClick={startRecordPresent}
                disabled={
                  deck.frames.length === 0 || uploading || !isConvexLinked
                }
                status={uploading ? "loading" : null}
              >
                Record
              </FilledButton>
            </>
          )}
        </div>
        {frameIds.length === 0 ? (
          <p className="jayrr-present__empty">
            Draw a frame, drop shapes in it, then set the order here.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
          >
            <SortableContext
              items={frameIds}
              strategy={verticalListSortingStrategy}
            >
              <ol
                className={
                  activeId
                    ? "jayrr-present__frames is-sorting"
                    : "jayrr-present__frames"
                }
              >
                {frameIds.map((frameId, frameIndex) => {
                  const frame = frameById.get(frameId);
                  if (!frame) {
                    return null;
                  }
                  const childIds = objectIds[frame.id] ?? [];
                  return (
                    <SortableFrameBlock
                      key={frame.id}
                      id={frame.id}
                      index={frameIndex + 1}
                      disabled={
                        presenting || renamingId !== null || frameIds.length < 2
                      }
                      name={frame.label}
                      selected={Boolean(selectedElementIds[frame.id])}
                      collapsed={Boolean(collapsedFrameIds[frame.id])}
                      renaming={renamingId === frame.id}
                      draftName={draftName}
                      effect={frame.effect}
                      zoomPercent={frame.zoomPercent}
                      onSelect={() => selectId(frame.id)}
                      onToggleCollapse={() => {
                        setCollapsedFrameIds((current) => ({
                          ...current,
                          [frame.id]: !current[frame.id],
                        }));
                      }}
                      onStartRename={() => startRename(frame.id, frame.label)}
                      onDraftChange={setDraftName}
                      onCommit={commitRename}
                      onCancel={cancelRename}
                      onEffect={(effect) =>
                        persistPresentEffect([frame.id], effect)
                      }
                      onZoomPercent={(zoomPercent) =>
                        persistPresentZoomPercent([frame.id], zoomPercent)
                      }
                      sound={frame.sound}
                      onSound={(sound) =>
                        persistPresentSound([frame.id], sound)
                      }
                    >
                      {childIds.length === 0 ? (
                        <p className="jayrr-present__empty">
                          No shapes in this frame.
                        </p>
                      ) : (
                        <SortableContext
                          items={childIds}
                          strategy={verticalListSortingStrategy}
                        >
                          <ol className="jayrr-present__objects">
                            {(() => {
                              let counted = 0;
                              return childIds.map((objectId) => {
                                const object = frame.objects.find(
                                  (item) => item.id === objectId,
                                );
                                if (!object) {
                                  return null;
                                }
                                const index =
                                  object.skip || object.hide ? null : ++counted;
                                return (
                                  <SortableObjectBlock
                                    key={object.id}
                                    id={object.id}
                                    index={index}
                                    disabled={
                                      presenting ||
                                      renamingId !== null ||
                                      childIds.length < 2
                                    }
                                    name={object.label}
                                    selected={Boolean(
                                      selectedElementIds[object.id],
                                    )}
                                    renaming={renamingId === object.id}
                                    draftName={draftName}
                                    effect={object.effect}
                                    camera={object.camera}
                                    motion={object.motion}
                                    exit={object.exit}
                                    translation={object.translation}
                                    zoomPercent={object.zoomPercent}
                                    skip={object.skip}
                                    hide={object.hide}
                                    text={
                                      object.memberIds.length > 0 &&
                                      object.memberIds.every((id) =>
                                        textIds.has(id),
                                      )
                                    }
                                    textEffect={object.textEffect}
                                    sound={object.sound}
                                    placeIds={object.memberIds}
                                    onSelect={() => selectId(object.id)}
                                    onStartRename={() =>
                                      startRename(object.id, object.label)
                                    }
                                    onDraftChange={setDraftName}
                                    onCommit={commitRename}
                                    onCancel={cancelRename}
                                    onEffect={(effect) =>
                                      persistPresentEffect(
                                        object.memberIds,
                                        effect,
                                      )
                                    }
                                    onCamera={(camera) =>
                                      persistPresentCamera(
                                        object.memberIds,
                                        camera,
                                      )
                                    }
                                    onMotion={(motion) =>
                                      persistPresentMotion(
                                        object.memberIds,
                                        motion,
                                      )
                                    }
                                    onExit={(exit) =>
                                      persistPresentExit(object.memberIds, exit)
                                    }
                                    onTranslation={(translation) =>
                                      persistPresentTranslation(
                                        object.memberIds,
                                        translation,
                                      )
                                    }
                                    onZoomPercent={(zoomPercent) =>
                                      persistPresentZoomPercent(
                                        object.memberIds,
                                        zoomPercent,
                                      )
                                    }
                                    onPresence={(presence) =>
                                      persistPresentPresence(
                                        object.memberIds,
                                        presence,
                                      )
                                    }
                                    onTextEffect={(textEffect) =>
                                      persistPresentTextEffect(
                                        object.memberIds,
                                        textEffect,
                                      )
                                    }
                                    onSound={(sound) =>
                                      persistPresentSound(
                                        object.memberIds,
                                        sound,
                                      )
                                    }
                                  />
                                );
                              });
                            })()}
                          </ol>
                        </SortableContext>
                      )}
                    </SortableFrameBlock>
                  );
                })}
              </ol>
            </SortableContext>
          </DndContext>
        )}
        {presenting ? (
          <p className="jayrr-present__status" aria-live="polite">
            {stepCaption(deck, stepIndex)}
          </p>
        ) : null}
        {uploading ? (
          <p className="jayrr-present__status" aria-live="polite">
            Saving recording…
          </p>
        ) : null}
      </div>
    </div>
  );
};

export const JayrrPresentHud = ({
  caption,
  recording = false,
  paused = false,
  onPause,
  onResume,
  onExit,
}: {
  caption: string;
  recording?: boolean;
  paused?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onExit: () => void;
}) => {
  return (
    <div
      className={
        recording
          ? paused
            ? "jayrr-present-hud is-recording is-paused"
            : "jayrr-present-hud is-recording"
          : "jayrr-present-hud"
      }
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {recording ? (
        <span className="jayrr-present-hud__dot" aria-hidden="true" />
      ) : null}
      <span>{caption}</span>
      {recording ? (
        <button
          type="button"
          onClick={paused ? onResume : onPause}
          aria-label={paused ? "Resume recording" : "Pause recording"}
        >
          {paused ? "Play" : "Pause"}
        </button>
      ) : (
        <span className="jayrr-present-hud__keys">
          → next · ← back · Esc stop
        </span>
      )}
      <button type="button" onClick={onExit}>
        {recording ? "Stop" : "Exit"}
      </button>
    </div>
  );
};
