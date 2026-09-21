import {
  cloneElement,
  isValidElement,
  useEffect,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";

import "./Tooltip.scss";

const OPEN_DELAY_MS = 200;
const WARM_FOR_MS = 300;

let tooltipOpen = false;
let tooltipWarm = false;
let openTimer: number | null = null;
let cooldownTimer: number | null = null;
let timerView: Window | null = null;

const viewOf = (node: Element): Window =>
  node.ownerDocument.defaultView ?? window;

const clearTimer = (handle: number | null) => {
  if (handle == null) {
    return;
  }
  (timerView ?? window).clearTimeout(handle);
};

const clearOpenTimer = () => {
  clearTimer(openTimer);
  openTimer = null;
};

const clearCooldownTimer = () => {
  clearTimer(cooldownTimer);
  cooldownTimer = null;
};

const markOpened = () => {
  tooltipWarm = true;
  clearCooldownTimer();
};

const markClosed = (view: Window) => {
  clearCooldownTimer();
  timerView = view;
  cooldownTimer = view.setTimeout(() => {
    tooltipWarm = false;
    cooldownTimer = null;
  }, WARM_FOR_MS);
};

export const getTooltipDiv = () => {
  const existingDiv = document.querySelector<HTMLDivElement>(
    ".excalidraw-tooltip",
  );
  if (existingDiv) {
    return existingDiv;
  }
  const div = document.createElement("div");
  document.body.appendChild(div);
  div.classList.add("excalidraw-tooltip");
  return div;
};

export const updateTooltipPosition = (
  tooltip: HTMLDivElement,
  item: {
    left: number;
    top: number;
    width: number;
    height: number;
  },
  position: "bottom" | "top" = "bottom",
) => {
  const tooltipRect = tooltip.getBoundingClientRect();

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const margin = 5;

  let left = item.left + item.width / 2 - tooltipRect.width / 2;
  if (left < 0) {
    left = margin;
  } else if (left + tooltipRect.width >= viewportWidth) {
    left = viewportWidth - tooltipRect.width - margin;
  }

  let top: number;

  if (position === "bottom") {
    top = item.top + item.height + margin;
    if (top + tooltipRect.height >= viewportHeight) {
      top = item.top - tooltipRect.height - margin;
    }
  } else {
    top = item.top - tooltipRect.height - margin;
    if (top < 0) {
      top = item.top + item.height + margin;
    }
  }

  Object.assign(tooltip.style, {
    top: `${top}px`,
    left: `${left}px`,
  });
};

const updateTooltip = (
  item: HTMLElement,
  tooltip: HTMLDivElement,
  label: string,
  long: boolean,
  position: "bottom" | "top",
) => {
  tooltip.classList.add("excalidraw-tooltip--visible");
  tooltip.style.minWidth = long ? "50ch" : "10ch";
  tooltip.style.maxWidth = long ? "50ch" : "15ch";

  tooltip.textContent = label;

  const itemRect = item.getBoundingClientRect();
  updateTooltipPosition(tooltip, itemRect, position);
};

const revealTooltip = (
  item: HTMLElement,
  label: string,
  long: boolean,
  position: "bottom" | "top",
) => {
  updateTooltip(item, getTooltipDiv(), label, long, position);
  tooltipOpen = true;
  markOpened();
};

export const scheduleTooltip = (
  item: HTMLElement,
  label: string,
  long: boolean,
  position: "bottom" | "top" = "bottom",
) => {
  if (!label) {
    return;
  }
  const view = viewOf(item);
  clearOpenTimer();
  if (tooltipWarm) {
    revealTooltip(item, label, long, position);
    return;
  }
  timerView = view;
  openTimer = view.setTimeout(() => {
    openTimer = null;
    revealTooltip(item, label, long, position);
  }, OPEN_DELAY_MS);
};

export const hideScheduledTooltip = (view: Window = window) => {
  clearOpenTimer();
  if (!tooltipOpen) {
    return;
  }
  getTooltipDiv().classList.remove("excalidraw-tooltip--visible");
  tooltipOpen = false;
  markClosed(view);
};

type TooltipTriggerProps = {
  onPointerEnter?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
};

type TooltipProps = {
  children: ReactNode;
  label: string;
  long?: boolean;
  style?: CSSProperties;
  disabled?: boolean;
  position?: "bottom" | "top";
  asChild?: boolean;
};

const bindTooltip = (
  label: string,
  long: boolean,
  position: "bottom" | "top",
  existing?: TooltipTriggerProps,
): TooltipTriggerProps => ({
  onPointerEnter: (event) => {
    existing?.onPointerEnter?.(event);
    scheduleTooltip(event.currentTarget, label, long, position);
  },
  onPointerLeave: (event) => {
    existing?.onPointerLeave?.(event);
    hideScheduledTooltip(viewOf(event.currentTarget));
  },
  onPointerDown: (event) => {
    existing?.onPointerDown?.(event);
    hideScheduledTooltip(viewOf(event.currentTarget));
  },
});

export const Tooltip = ({
  children,
  label,
  long = false,
  style,
  disabled,
  position = "bottom",
  asChild = false,
}: TooltipProps) => {
  useEffect(() => {
    return () => hideScheduledTooltip();
  }, []);
  if (disabled) {
    return null;
  }
  if (asChild && isValidElement<TooltipTriggerProps>(children)) {
    return cloneElement(children as ReactElement<TooltipTriggerProps>, {
      ...bindTooltip(label, long, position, children.props),
    });
  }
  return (
    <div
      className="excalidraw-tooltip-wrapper"
      style={style}
      {...bindTooltip(label, long, position)}
    >
      {children}
    </div>
  );
};
