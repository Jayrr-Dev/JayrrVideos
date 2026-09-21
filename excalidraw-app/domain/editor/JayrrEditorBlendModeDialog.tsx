import { helpIcon } from "@excalidraw/excalidraw/components/icons";
import { useId, useState } from "react";

import { Button } from "../../components/ui/Button";
import { Dialog, Tooltip } from "../../components/ui/editor";

import {
  EDITOR_BLEND_GROUPS,
  type EditorBlendMode,
} from "./buildEditorTimeline";

import "./JayrrEditorBlendModeDialog.scss";

const INFO =
  "How the overlapping clip mixes with the clip under it. Modes match Photoshop groups that the browser can apply.";

type JayrrEditorBlendModeDialogProps = {
  value: EditorBlendMode;
  onClose: () => void;
  onPick: (mode: EditorBlendMode) => void;
};

export const JayrrEditorBlendModeDialog = ({
  value,
  onClose,
  onPick,
}: JayrrEditorBlendModeDialogProps) => {
  const descriptionId = useId();
  const [picked, setPicked] = useState(value);

  return (
    <Dialog
      className="jayrr-editor-blend-mode"
      size="small"
      onCloseRequest={onClose}
      title={
        <span className="jayrr-editor-blend-mode__title-row">
          Blend mode
          <Tooltip label={INFO} long position="top">
            <span
              className="jayrr-editor-blend-mode__info"
              aria-label="More info"
            >
              {helpIcon}
            </span>
          </Tooltip>
        </span>
      }
    >
      <p id={descriptionId} className="visually-hidden">
        {INFO}
      </p>
      <form
        className="jayrr-editor-blend-mode__form"
        aria-describedby={descriptionId}
        onSubmit={(event) => {
          event.preventDefault();
          onPick(picked);
        }}
      >
        <div className="jayrr-editor-blend-mode__body">
          {EDITOR_BLEND_GROUPS.map((group) => (
            <fieldset
              key={group.label}
              className="jayrr-editor-blend-mode__group"
            >
              <legend>{group.label}</legend>
              {group.options.map((option) => (
                <label
                  key={option.id}
                  className={`jayrr-editor-blend-mode__option${
                    picked === option.id ? " is-active" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="jayrr-editor-blend-mode"
                    value={option.id}
                    checked={picked === option.id}
                    onChange={() => setPicked(option.id)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        <div className="jayrr-editor-blend-mode__buttons">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Apply
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
