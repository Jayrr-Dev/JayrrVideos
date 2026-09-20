import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { EmbedIcon, helpIcon } from "@excalidraw/excalidraw/components/icons";
import { useRef } from "react";

import { Tooltip } from "../../../components/ui";

import {
  JAYRR_CALLED_OBJECT_DRAG,
  insertCalledObject,
} from "../insertCalledObject";
import { CALLED_OBJECTS } from "../model";

import "../../../components/ui/JayrrLibraryMenu.scss";

import "./JayrrCalledObjectsPanel.scss";

export const JayrrCalledObjectsPanel = () => {
  const api = useExcalidrawAPI();
  const draggedRef = useRef(false);

  return (
    <div className="layer-ui__library jayrr-library jayrr-called-panel">
      <div className="jayrr-library__header">
        <div className="jayrr-library__title">Widgets</div>
        <Tooltip
          label="Live widgets you drop on the canvas. Drag one on, or click to place."
          long
        >
          <span className="jayrr-called-panel__info">{helpIcon}</span>
        </Tooltip>
        <span className="visually-hidden">
          Widgets you place on the canvas.
        </span>
      </div>
      <div className="jayrr-library__body">
        <ul className="jayrr-scene-grid">
          {CALLED_OBJECTS.map((object) => (
            <li key={object.kind} className="jayrr-scene-card">
              <span className="jayrr-scene-card__name">{object.name}</span>
              <button
                type="button"
                className="jayrr-scene-card__preview jayrr-called-panel__preview"
                aria-label={`Place ${object.name}`}
                draggable
                onDragStart={(event) => {
                  draggedRef.current = true;
                  event.dataTransfer.setData(
                    JAYRR_CALLED_OBJECT_DRAG,
                    JSON.stringify({ kind: object.kind }),
                  );
                  event.dataTransfer.setData("text/plain", object.name);
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onDragEnd={() => {
                  window.setTimeout(() => {
                    draggedRef.current = false;
                  }, 0);
                }}
                onClick={() => {
                  if (draggedRef.current || !api) {
                    return;
                  }
                  insertCalledObject(api, object);
                }}
              >
                <span className="jayrr-called-panel__icon">{EmbedIcon}</span>
                <span className="jayrr-called-panel__hint">{object.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
