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
import { isFrameLikeElement } from "@excalidraw/element";
import {
  CaptureUpdateAction,
  newElementWith,
  useExcalidrawAPI,
} from "@excalidraw/excalidraw";
import { useExcalidrawContainer } from "@excalidraw/excalidraw/components/App";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { Island } from "@excalidraw/excalidraw/components/Island";
import { Switch } from "@excalidraw/excalidraw/components/Switch";
import { Tooltip } from "@excalidraw/excalidraw/components/Tooltip";
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

import {
  JAYRR_PRESENT_ZOOM_PERCENT_DEFAULT,
  JAYRR_PRESENT_ZOOM_PERCENT_MAX,
  JAYRR_PRESENT_ZOOM_PERCENT_MIN,
  reorderPresentIds,
  stepCaption,
  writePresentEffect,
  writePresentLabel,
  writePresentMotion,
  writePresentOrder,
  writePresentZoomPercent,
  type PresentDeck,
  type PresentEffect,
  type PresentFrame,
  type PresentMotion,
} from "./buildPresentDeck";
import {
  getPresentHideFrames,
  setPresentHideFrames,
} from "./presentHideFrames";
import {
  getPresentDefaultMotion,
  PRESENT_MOTION_LABEL,
  PRESENT_MOTIONS,
  setPresentDefaultMotion,
} from "./presentMotion";

import "./JayrrPresentPanel.scss";

type ObjectOrderMap = Record<string, string[]>;

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

const PresentEffectMenu = ({
  className,
  effect,
  motion,
  zoomPercent,
  disabled,
  onEffect,
  onMotion,
  onZoomPercent,
  children,
}: {
  className?: string;
  effect: PresentEffect | null;
  motion?: PresentMotion | null;
  zoomPercent?: number | null;
  disabled: boolean;
  onEffect: (effect: PresentEffect | null) => void;
  onMotion?: (motion: PresentMotion | null) => void;
  onZoomPercent?: (zoomPercent: number) => void;
  children: ReactNode;
}) => {
  const { container } = useExcalidrawContainer();
  const [zoomOpen, setZoomOpen] = useState(false);
  const currentZoom = zoomPercent ?? JAYRR_PRESENT_ZOOM_PERCENT_DEFAULT;
  const [zoomDraft, setZoomDraft] = useState(String(currentZoom));

  useEffect(() => {
    setZoomDraft(String(currentZoom));
  }, [currentZoom]);

  const commitZoomPercent = () => {
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
    onZoomPercent?.(clamped);
    onEffect("zoom");
  };
  const triggerClass = className
    ? `jayrr-present__effect-trigger ${className}`
    : "jayrr-present__effect-trigger";
  const body = (
    <>
      {children}
      {effect === "focus" ? (
        <span className="jayrr-present__focus" role="img" aria-label="Focus">
          {focusTargetIcon}
        </span>
      ) : null}
      {effect === "zoom" ? (
        <span
          className="jayrr-present__focus"
          role="img"
          aria-label="Focus Zoom"
        >
          {focusZoomIcon}
        </span>
      ) : null}
      {effect === "zoom" &&
      zoomPercent !== null &&
      zoomPercent !== undefined &&
      zoomPercent !== JAYRR_PRESENT_ZOOM_PERCENT_DEFAULT ? (
        <span className="jayrr-present__motion-tag">{`${zoomPercent}%`}</span>
      ) : null}
      {motion ? (
        <span
          className="jayrr-present__motion-tag"
          title={PRESENT_MOTION_LABEL[motion]}
        >
          {PRESENT_MOTION_LABEL[motion]}
        </span>
      ) : null}
    </>
  );
  if (disabled) {
    return <div className={triggerClass}>{body}</div>;
  }
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div className={triggerClass}>{body}</div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal container={container}>
        <ContextMenu.Content
          className="jayrr-present__menu"
          collisionPadding={8}
          data-prevent-outside-click
        >
          <ContextMenu.Label className="jayrr-present__menu-label">
            Transition
          </ContextMenu.Label>
          <ContextMenu.Item
            className={
              effect === null
                ? "jayrr-present__menu-item is-active"
                : "jayrr-present__menu-item"
            }
            onSelect={() => onEffect(null)}
          >
            <span className="jayrr-present__menu-check">
              {effect === null ? checkIcon : null}
            </span>
            None
          </ContextMenu.Item>
          <ContextMenu.Item
            className={
              effect === "focus"
                ? "jayrr-present__menu-item is-active"
                : "jayrr-present__menu-item"
            }
            onSelect={() => onEffect("focus")}
          >
            <span className="jayrr-present__menu-check">
              {effect === "focus" ? checkIcon : null}
            </span>
            Focus
          </ContextMenu.Item>
          <div className="jayrr-present__menu-zoom-row">
            <ContextMenu.Item
              className={
                effect === "zoom"
                  ? "jayrr-present__menu-item is-active"
                  : "jayrr-present__menu-item"
              }
              onSelect={() => onEffect("zoom")}
            >
              <span className="jayrr-present__menu-check">
                {effect === "zoom" ? checkIcon : null}
              </span>
              Focus Zoom
            </ContextMenu.Item>
            {onZoomPercent ? (
              <Popover.Root open={zoomOpen} onOpenChange={setZoomOpen}>
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    className="jayrr-present__zoom-gear"
                    aria-label="Focus Zoom percent"
                    title={`${currentZoom}%`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => onEffect("zoom")}
                  >
                    {settingsIcon}
                  </button>
                </Popover.Trigger>
                <Popover.Portal container={container}>
                  <Popover.Content
                    side="right"
                    align="start"
                    sideOffset={8}
                    className="jayrr-present__settings-popover"
                    onOpenAutoFocus={(event) => event.preventDefault()}
                  >
                    <div className="jayrr-present__settings-head">
                      <span className="jayrr-present__settings-title">
                        Zoom
                      </span>
                      <Tooltip
                        label="100% fills the object in the view. Higher is closer, lower shows more around it."
                        long
                      >
                        <span className="jayrr-present__settings-info">
                          {helpIcon}
                        </span>
                      </Tooltip>
                    </div>
                    <label className="jayrr-present__settings-row">
                      <span>Amount</span>
                      <span className="jayrr-present__zoom-field">
                        <input
                          type="number"
                          className="jayrr-present__settings-select jayrr-present__zoom-input"
                          min={JAYRR_PRESENT_ZOOM_PERCENT_MIN}
                          max={JAYRR_PRESENT_ZOOM_PERCENT_MAX}
                          step={10}
                          value={zoomDraft}
                          onChange={(event) => setZoomDraft(event.target.value)}
                          onBlur={commitZoomPercent}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitZoomPercent();
                            }
                          }}
                        />
                        %
                      </span>
                    </label>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            ) : null}
          </div>
          {onMotion ? (
            <>
              <ContextMenu.Label className="jayrr-present__menu-label">
                Motion
              </ContextMenu.Label>
              <ContextMenu.Item
                className={
                  motion === null || motion === undefined
                    ? "jayrr-present__menu-item is-active"
                    : "jayrr-present__menu-item"
                }
                onSelect={() => onMotion(null)}
              >
                <span className="jayrr-present__menu-check">
                  {motion === null || motion === undefined ? checkIcon : null}
                </span>
                Default
              </ContextMenu.Item>
              {PRESENT_MOTIONS.map((item) => (
                <ContextMenu.Item
                  key={item}
                  className={
                    motion === item
                      ? "jayrr-present__menu-item is-active"
                      : "jayrr-present__menu-item"
                  }
                  onSelect={() => onMotion(item)}
                >
                  <span className="jayrr-present__menu-check">
                    {motion === item ? checkIcon : null}
                  </span>
                  {PRESENT_MOTION_LABEL[item]}
                </ContextMenu.Item>
              ))}
            </>
          ) : null}
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
  const [motion, setMotion] = useState(getPresentDefaultMotion);

  useEffect(() => {
    api?.updateFrameRendering({ enabled: true });
  }, [api]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="jayrr-present__settings"
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
                label="Motion is the default enter/leave for every object. Right-click a row to override one. Hide frames removes borders and names in Present."
                long
                position="top"
              >
                <span className="jayrr-present__settings-info">{helpIcon}</span>
              </Tooltip>
            </div>
            <div className="jayrr-present__settings-row">
              <label htmlFor="presentMotion">Motion</label>
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
  index: number;
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
      {`${index}. ${name}`}
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
  onSelect: () => void;
  onToggleCollapse: () => void;
  onStartRename: () => void;
  onDraftChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onEffect: (effect: PresentEffect | null) => void;
  onZoomPercent: (zoomPercent: number) => void;
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
      <PresentEffectMenu
        className="jayrr-present__frame-head"
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
      </PresentEffectMenu>
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
  motion,
  zoomPercent,
  onSelect,
  onStartRename,
  onDraftChange,
  onCommit,
  onCancel,
  onEffect,
  onMotion,
  onZoomPercent,
}: {
  id: string;
  index: number;
  disabled: boolean;
  name: string;
  selected: boolean;
  renaming: boolean;
  draftName: string;
  effect: PresentEffect | null;
  motion: PresentMotion | null;
  zoomPercent: number | null;
  onSelect: () => void;
  onStartRename: () => void;
  onDraftChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onEffect: (effect: PresentEffect | null) => void;
  onMotion: (motion: PresentMotion | null) => void;
  onZoomPercent: (zoomPercent: number) => void;
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
        isDragging ? "jayrr-present__row is-dragging" : "jayrr-present__row"
      }
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <PresentEffectMenu
        effect={effect}
        motion={motion}
        zoomPercent={zoomPercent}
        disabled={renaming}
        onEffect={onEffect}
        onMotion={onMotion}
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
    </li>
  );
};

export const JayrrPresentPanel = ({
  deck,
  presenting,
  stepIndex,
  selectedElementIds,
  startPresent,
  stopPresent,
}: {
  deck: PresentDeck;
  presenting: boolean;
  stepIndex: number;
  selectedElementIds: Record<string, boolean>;
  startPresent: () => void;
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

  return (
    <div className="jayrr-present">
      <div className="jayrr-present__title-row">
        <h2 className="jayrr-present__title">Present</h2>
        <span className="jayrr-present__sr">
          Nested reveal order for frames and the shapes inside them. Drag a
          block to reorder. Right-click a row to set its transition.
        </span>
        <PresentSettingsPopover />
      </div>
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
          <FilledButton
            color="primary"
            label="Present"
            icon={presentationIcon}
            onClick={startPresent}
            fullWidth
            disabled={deck.frames.length === 0}
          >
            Present
          </FilledButton>
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
                          {childIds.map((objectId, objectIndex) => {
                            const object = frame.objects.find(
                              (item) => item.id === objectId,
                            );
                            if (!object) {
                              return null;
                            }
                            return (
                              <SortableObjectBlock
                                key={object.id}
                                id={object.id}
                                index={objectIndex + 1}
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
                                motion={object.motion}
                                zoomPercent={object.zoomPercent}
                                onSelect={() => selectId(object.id)}
                                onStartRename={() =>
                                  startRename(object.id, object.label)
                                }
                                onDraftChange={setDraftName}
                                onCommit={commitRename}
                                onCancel={cancelRename}
                                onEffect={(effect) =>
                                  persistPresentEffect(object.memberIds, effect)
                                }
                                onMotion={(motion) =>
                                  persistPresentMotion(object.memberIds, motion)
                                }
                                onZoomPercent={(zoomPercent) =>
                                  persistPresentZoomPercent(
                                    object.memberIds,
                                    zoomPercent,
                                  )
                                }
                              />
                            );
                          })}
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
    </div>
  );
};

export const JayrrPresentHud = ({
  caption,
  onExit,
}: {
  caption: string;
  onExit: () => void;
}) => {
  return (
    <div
      className="jayrr-present-hud"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <span>{caption}</span>
      <span className="jayrr-present-hud__keys">
        → next · ← back · Esc exit
      </span>
      <button type="button" onClick={onExit}>
        Exit
      </button>
    </div>
  );
};
