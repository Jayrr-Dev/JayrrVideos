import clsx from "clsx";
import { useCallback, useEffect, useRef } from "react";

import { copyTextToSystemClipboard } from "../clipboard";
import { useCopyStatus } from "../hooks/useCopiedIndicator";
import { t } from "../i18n";

import { CloseIcon, copyIcon, tablerCheckIcon } from "./icons";
import { IconButton } from "./IconButton";

import "./Toast.scss";

import type { CSSProperties, ReactNode } from "react";

const DEFAULT_TOAST_TIMEOUT = 5000;

const ProgressBar = ({ progress }: { progress: number }) => (
  <div className="Toast__progress-bar">
    <div
      className="Toast__progress-bar-fill"
      style={{
        width: `${Math.min(5, Math.round(progress * 100))}%`,
      }}
    />
  </div>
);

const nodeText = (value: ReactNode, node: HTMLElement | null) => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return node?.innerText?.trim() ?? "";
};

const isErrorMessage = (text: string) =>
  /error|failed|could not|convex|uncaught/i.test(text);

const ToastComponent = ({
  message,
  onClose,
  closable = false,
  // To prevent autoclose, pass duration as Infinity
  duration = DEFAULT_TOAST_TIMEOUT,
  style,
}: {
  message: ReactNode;
  onClose: () => void;
  closable?: boolean;
  duration?: number;
  style?: CSSProperties;
}) => {
  const timerRef = useRef<number>(0);
  const messageRef = useRef<HTMLDivElement>(null);
  const { onCopy, copyStatus } = useCopyStatus();
  const shouldAutoClose = duration !== Infinity;
  const scheduleTimeout = useCallback(() => {
    if (!shouldAutoClose) {
      return;
    }
    timerRef.current = window.setTimeout(() => onClose(), duration);
  }, [onClose, duration, shouldAutoClose]);

  useEffect(() => {
    if (!shouldAutoClose) {
      return;
    }
    scheduleTimeout();
    return () => clearTimeout(timerRef.current);
  }, [scheduleTimeout, message, duration, shouldAutoClose]);

  const onMouseEnter = shouldAutoClose
    ? () => clearTimeout(timerRef?.current)
    : undefined;
  const onMouseLeave = shouldAutoClose ? scheduleTimeout : undefined;

  const handleCopy = async () => {
    const text = nodeText(message, messageRef.current);
    if (!text) {
      return;
    }
    await copyTextToSystemClipboard(text);
    onCopy();
  };

  const canCopy = isErrorMessage(nodeText(message, null));

  return (
    <div
      className={clsx("Toast", canCopy && "Toast--interactive")}
      role="status"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={style}
    >
      <div ref={messageRef} className="Toast__message">
        {message}
      </div>
      {canCopy && (
        <button
          type="button"
          className="Toast__copy"
          onClick={() => {
            void handleCopy();
          }}
          aria-label={t("labels.copy")}
        >
          {copyStatus === "success" ? tablerCheckIcon : copyIcon}
          {t("labels.copy")}
        </button>
      )}
      {closable && (
        <IconButton
          icon={CloseIcon}
          aria-label="close"
          type="icon"
          onClick={onClose}
          className="close"
        />
      )}
    </div>
  );
};

export const Toast = Object.assign(ToastComponent, { ProgressBar });
