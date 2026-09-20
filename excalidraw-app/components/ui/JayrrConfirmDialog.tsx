import { helpIcon } from "@excalidraw/excalidraw/components/icons";

import { Button } from "./Button";
import { Dialog, Tooltip } from "./editor";

import "./JayrrConfirmDialog.scss";

type JayrrConfirmDialogProps = {
  title: string;
  info: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export const JayrrConfirmDialog = ({
  title,
  info,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}: JayrrConfirmDialogProps) => {
  const descriptionId = "jayrr-confirm-description";

  return (
    <Dialog
      className="jayrr-confirm"
      size={420}
      onCloseRequest={() => {
        if (!busy) {
          onCancel();
        }
      }}
      title={
        <span className="jayrr-confirm__title-row">
          {title}
          <Tooltip label={info} long position="top">
            <span className="jayrr-confirm__info" aria-label="More info">
              {helpIcon}
            </span>
          </Tooltip>
        </span>
      }
    >
      <p id={descriptionId} className="visually-hidden">
        {info}
      </p>
      <div className="jayrr-confirm__buttons">
        <Button disabled={busy} variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button busy={busy} variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
};
