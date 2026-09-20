import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { useEffect, useState, type ReactNode } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { useAtom } from "../../../app-jotai";
import { markdownEditingElementIdAtom } from "../markdownEditingAtom";
import { CALLED_OBJECTS, readCalledObjectKind } from "../model";
import {
  readMarkdownConfig,
  writeMarkdownConfig,
} from "../objects/markdownConfig";
import { readPdfConfig, writePdfConfig } from "../objects/pdfConfig";
import { pdfReplaceRequestAtom } from "../pdfReplaceAtom";
import { useWidgetToolbar } from "../widgetToolbarRegistry";

import "./JayrrCalledHyperlinkPopup.scss";

export const renderJayrrCalledHyperlinkPopup = ({
  element,
}: {
  element: ExcalidrawElement;
  appState: AppState;
}): ReactNode | false => {
  const kind = readCalledObjectKind(element);
  if (!kind) {
    return false;
  }
  return <JayrrCalledHyperlinkPopup elementId={element.id} kind={kind} />;
};

const JayrrCalledHyperlinkPopup = ({
  elementId,
  kind,
}: {
  elementId: string;
  kind: NonNullable<ReturnType<typeof readCalledObjectKind>>;
}) => {
  const api = useExcalidrawAPI();
  const [editingId, setEditingId] = useAtom(markdownEditingElementIdAtom);
  const [, setReplaceId] = useAtom(pdfReplaceRequestAtom);
  const [title, setTitle] = useState("");
  const toolbar = useWidgetToolbar(elementId);
  const isEditing = editingId === elementId;
  const label =
    CALLED_OBJECTS.find((object) => object.kind === kind)?.name ?? kind;
  const isDoc = kind === "markdown" || kind === "pdf";

  useEffect(() => {
    if (!api || !isDoc) {
      return;
    }
    const sync = () => {
      const element = api.getSceneElements().find((el) => el.id === elementId);
      if (!element) {
        return;
      }
      if (kind === "markdown") {
        setTitle(readMarkdownConfig(element).title);
      } else {
        setTitle(readPdfConfig(element).title);
      }
    };
    sync();
    return api.onChange(sync);
  }, [api, elementId, isDoc, kind]);

  const persistTitle = (nextTitle: string) => {
    if (!api || !isDoc) {
      return;
    }
    const element = api.getSceneElements().find((el) => el.id === elementId);
    if (!element) {
      return;
    }
    const trimmed = nextTitle.trim() || label;
    if (kind === "markdown") {
      const config = readMarkdownConfig(element);
      api.updateScene({
        elements: api.getSceneElements().map((el) =>
          el.id === elementId
            ? newElementWith(el, {
                customData: writeMarkdownConfig(element, {
                  ...config,
                  title: trimmed,
                }),
              })
            : el,
        ),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    } else {
      const config = readPdfConfig(element);
      api.updateScene({
        elements: api.getSceneElements().map((el) =>
          el.id === elementId
            ? newElementWith(el, {
                customData: writePdfConfig(element, {
                  ...config,
                  title: trimmed,
                }),
              })
            : el,
        ),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    }
    setTitle(trimmed);
  };

  return (
    <div className="jayrr-called-hyperlink">
      <span className="jayrr-called-hyperlink__kind">{label}</span>
      {isDoc ? (
        <input
          className="jayrr-called-hyperlink__title"
          value={title}
          aria-label={`${label} title`}
          placeholder={label}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => persistTitle(title)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              (event.target as HTMLInputElement).blur();
            }
          }}
          onPointerDown={(event) => event.stopPropagation()}
        />
      ) : null}
      {kind === "markdown" ? (
        <button
          type="button"
          className="jayrr-called-hyperlink__action"
          onClick={(event) => {
            event.stopPropagation();
            setEditingId(isEditing ? null : elementId);
          }}
        >
          {isEditing ? "Done" : "Edit"}
        </button>
      ) : null}
      {kind === "pdf" ? (
        <button
          type="button"
          className="jayrr-called-hyperlink__action"
          onClick={(event) => {
            event.stopPropagation();
            setReplaceId(elementId);
          }}
        >
          Replace
        </button>
      ) : null}
      {toolbar}
    </div>
  );
};
