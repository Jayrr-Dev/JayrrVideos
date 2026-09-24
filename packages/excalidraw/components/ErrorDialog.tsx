import React, { useRef, useState } from "react";

import { copyTextToSystemClipboard } from "../clipboard";
import { useCopyStatus } from "../hooks/useCopiedIndicator";
import { t } from "../i18n";

import { useExcalidrawContainer } from "./App";
import { Dialog } from "./Dialog";
import { copyIcon, tablerCheckIcon } from "./icons";

import "./ErrorDialog.scss";

const nodeText = (value: React.ReactNode, node: HTMLElement | null) => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return node?.innerText?.trim() ?? "";
};

export const ErrorDialog = ({
  children,
  onClose,
}: {
  children?: React.ReactNode;
  onClose?: () => void;
}) => {
  const [modalIsShown, setModalIsShown] = useState(!!children);
  const { container: excalidrawContainer } = useExcalidrawContainer();
  const messageRef = useRef<HTMLDivElement>(null);
  const { onCopy, copyStatus } = useCopyStatus();

  const handleClose = React.useCallback(() => {
    setModalIsShown(false);

    if (onClose) {
      onClose();
    }
    // TODO: Fix the A11y issues so this is never needed since we should always focus on last active element
    excalidrawContainer?.focus();
  }, [onClose, excalidrawContainer]);

  const handleCopy = async () => {
    const text = nodeText(children, messageRef.current);
    if (!text) {
      return;
    }
    await copyTextToSystemClipboard(text);
    onCopy();
  };

  return (
    <>
      {modalIsShown && (
        <Dialog
          size="small"
          onCloseRequest={handleClose}
          title={
            <span className="ErrorDialog__title">
              {t("errorDialog.title")}
              <button
                type="button"
                className="ErrorDialog__copy"
                onClick={() => {
                  void handleCopy();
                }}
                aria-label={t("labels.copy")}
              >
                {copyStatus === "success" ? tablerCheckIcon : copyIcon}
                {t("labels.copy")}
              </button>
            </span>
          }
        >
          <div ref={messageRef} style={{ whiteSpace: "pre-wrap" }}>
            {children}
          </div>
        </Dialog>
      )}
    </>
  );
};
