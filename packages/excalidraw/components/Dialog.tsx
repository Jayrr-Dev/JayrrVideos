import clsx from "clsx";
import React, { useCallback, useEffect, useId, useState } from "react";

import { KEYS, queryFocusableElements } from "@excalidraw/common";

import { useSetAtom } from "../editor-jotai";
import { useCallbackRefState } from "../hooks/useCallbackRefState";
import { t } from "../i18n";

import {
  useEditorInterface,
  useExcalidrawContainer,
  useExcalidrawSetAppState,
} from "./App";
import { useMinimizedDialogsRegistry } from "./DialogMinimizeRegistry";
import { Island } from "./Island";
import { isLibraryMenuOpenAtom } from "./LibraryMenu";
import { Modal } from "./Modal";

import "./Dialog.scss";

export type DialogSize = number | "small" | "regular" | "wide" | undefined;

export interface DialogProps {
  children: React.ReactNode;
  className?: string;
  size?: DialogSize;
  onCloseRequest(): void;
  title: React.ReactNode | false;
  autofocus?: boolean;
  closeOnClickOutside?: boolean;
}

function getDialogSize(size: DialogSize): number {
  if (size && typeof size === "number") {
    return size;
  }

  switch (size) {
    case "small":
      return 550;
    case "wide":
      return 1024;
    case "regular":
    default:
      return 800;
  }
}

const CIRCLE_ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

const MinimizeCircleIcon = (
  <svg {...CIRCLE_ICON_PROPS}>
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12h8" />
  </svg>
);

const MaximizeCircleIcon = (
  <svg {...CIRCLE_ICON_PROPS}>
    <circle cx="12" cy="12" r="10" />
    <rect x="8.5" y="8.5" width="7" height="7" />
  </svg>
);

const CloseCircleIcon = (
  <svg {...CIRCLE_ICON_PROPS}>
    <circle cx="12" cy="12" r="10" />
    <path d="M15 9l-6 6M9 9l6 6" />
  </svg>
);

const contentFocusables = (islandNode: HTMLElement) =>
  queryFocusableElements(islandNode).filter(
    (element) => !element.closest(".Dialog__window"),
  );

const FALLBACK_DIALOG_LABEL = "Dialog";

const titleLabel = (title: React.ReactNode | false) => {
  if (typeof title === "string" && title.trim()) {
    return title.trim();
  }
  return FALLBACK_DIALOG_LABEL;
};

export const Dialog = (props: DialogProps) => {
  const [islandNode, setIslandNode] = useCallbackRefState<HTMLDivElement>();
  const [lastActiveElement] = useState(document.activeElement);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const minimizedDialogId = useId();
  const minimizedDialogsRegistry = useMinimizedDialogsRegistry();
  const { id } = useExcalidrawContainer();
  const isPhone = useEditorInterface().formFactor === "phone";
  const isFullscreen = isPhone || maximized;
  const canMinimize = Boolean(minimizedDialogsRegistry) && !isPhone;
  const isMinimizedActive = minimized && canMinimize;
  const dialogLabel = titleLabel(props.title);

  useEffect(() => {
    if (!islandNode || isMinimizedActive) {
      return;
    }

    const focusableElements = contentFocusables(islandNode);

    setTimeout(() => {
      if (focusableElements.length > 0 && props.autofocus !== false) {
        focusableElements[0].focus();
      }
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === KEYS.TAB) {
        const focusableElements = queryFocusableElements(islandNode);
        const { activeElement } = document;
        const currentIndex = focusableElements.findIndex(
          (element) => element === activeElement,
        );

        if (currentIndex === 0 && event.shiftKey) {
          focusableElements[focusableElements.length - 1].focus();
          event.preventDefault();
        } else if (
          currentIndex === focusableElements.length - 1 &&
          !event.shiftKey
        ) {
          focusableElements[0].focus();
          event.preventDefault();
        }
      }
    };

    islandNode.addEventListener("keydown", handleKeyDown);

    return () => islandNode.removeEventListener("keydown", handleKeyDown);
  }, [islandNode, isMinimizedActive, props.autofocus]);

  const setAppState = useExcalidrawSetAppState();
  const setIsLibraryMenuOpen = useSetAtom(isLibraryMenuOpenAtom);

  const onClose = useCallback(() => {
    setMinimized(false);
    setAppState({ openMenu: null });
    setIsLibraryMenuOpen(false);
    (lastActiveElement as HTMLElement).focus();
    props.onCloseRequest();
  }, [lastActiveElement, props, setAppState, setIsLibraryMenuOpen]);

  const minimizeDialog = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setMinimized(true);
  };

  useEffect(() => {
    if (!isMinimizedActive || !minimizedDialogsRegistry) {
      return;
    }
    const labelledById = islandNode ? `${id}-dialog-title` : null;
    const titleText = labelledById
      ? islandNode?.ownerDocument
          .getElementById(labelledById)
          ?.textContent?.trim()
      : undefined;
    minimizedDialogsRegistry.register({
      id: minimizedDialogId,
      label: titleText || dialogLabel,
      restore: () => {
        setMinimized(false);
      },
      requestClose: onClose,
    });
    return () => {
      minimizedDialogsRegistry.unregister(minimizedDialogId);
    };
  }, [
    dialogLabel,
    id,
    islandNode,
    isMinimizedActive,
    minimizedDialogId,
    minimizedDialogsRegistry,
    onClose,
  ]);

  const windowControls = (
    <div className="Dialog__window">
      {canMinimize ? (
        <button
          className="Dialog__window-btn Dialog__window-btn--min"
          onClick={minimizeDialog}
          title={t("buttons.minimize")}
          aria-label={t("buttons.minimize")}
          type="button"
        >
          {MinimizeCircleIcon}
        </button>
      ) : null}
      <button
        className="Dialog__window-btn Dialog__window-btn--max"
        onClick={() => {
          setMaximized((current) => !current);
        }}
        title={maximized ? t("buttons.restore") : t("buttons.maximize")}
        aria-label={maximized ? t("buttons.restore") : t("buttons.maximize")}
        aria-pressed={maximized}
        type="button"
      >
        {MaximizeCircleIcon}
      </button>
      <button
        className="Dialog__window-btn Dialog__window-btn--close"
        onClick={onClose}
        title={t("buttons.close")}
        aria-label={t("buttons.close")}
        type="button"
      >
        {CloseCircleIcon}
      </button>
    </div>
  );

  return (
    <Modal
      className={clsx("Dialog", props.className, {
        "Dialog--fullscreen": isFullscreen,
        "Dialog--minimized": isMinimizedActive,
      })}
      labelledBy="dialog-title"
      maxWidth={getDialogSize(props.size)}
      onCloseRequest={onClose}
      closeOnClickOutside={
        isMinimizedActive ? false : props.closeOnClickOutside
      }
      closeOnEscape={!isMinimizedActive}
    >
      <Island ref={setIslandNode}>
        <div className="Dialog__chrome">
          {props.title ? (
            <h2 id={`${id}-dialog-title`} className="Dialog__title">
              <span className="Dialog__titleContent">{props.title}</span>
            </h2>
          ) : (
            <span id={`${id}-dialog-title`} className="visually-hidden">
              {dialogLabel}
            </span>
          )}
          {windowControls}
        </div>
        <div className="Dialog__content">{props.children}</div>
      </Island>
    </Modal>
  );
};
