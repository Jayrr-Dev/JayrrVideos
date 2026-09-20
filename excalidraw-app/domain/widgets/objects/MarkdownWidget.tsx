import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { useAtom } from "../../../app-jotai";
import { markdownEditingElementIdAtom } from "../markdownEditingAtom";

import {
  readMarkdownConfig,
  titleFromMarkdown,
  writeMarkdownConfig,
  type MarkdownConfig,
} from "./markdownConfig";

import "./MarkdownWidget.scss";

marked.setOptions({
  gfm: true,
  breaks: false,
});

const sanitizeHtml = (html: string) =>
  DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel"],
  });

const renderMarkdownHtml = (markdown: string) => {
  const raw = marked.parse(markdown, { async: false });
  const html = typeof raw === "string" ? raw : "";
  return sanitizeHtml(html);
};

const openExternalLinks = (root: HTMLElement) => {
  root.querySelectorAll("a[href]").forEach((node) => {
    const anchor = node as HTMLAnchorElement;
    const href = anchor.getAttribute("href") || "";
    if (/^https?:\/\//i.test(href) || href.startsWith("//")) {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
    }
  });
};

export const MarkdownWidget = ({ elementId }: { elementId: string }) => {
  const api = useExcalidrawAPI();
  const [editingId, setEditingId] = useAtom(markdownEditingElementIdAtom);
  const editing = editingId === elementId;
  const wasEditingRef = useRef(false);
  const [config, setConfig] = useState<MarkdownConfig>(() =>
    readMarkdownConfig({ customData: undefined }),
  );
  const [draft, setDraft] = useState("");
  const draftRef = useRef(draft);
  const configRef = useRef(config);
  draftRef.current = draft;
  configRef.current = config;

  useEffect(() => {
    if (!api) {
      return;
    }
    const sync = (elements: readonly ExcalidrawElement[]) => {
      const element = elements.find((el) => el.id === elementId);
      if (!element) {
        return;
      }
      const next = readMarkdownConfig(element);
      setConfig(next);
      if (!editing) {
        setDraft(next.markdown);
      }
    };
    sync(api.getSceneElements());
    return api.onChange((elements) => sync(elements));
  }, [api, elementId, editing]);

  const persist = (next: MarkdownConfig) => {
    if (!api) {
      return;
    }
    const element = api.getSceneElements().find((el) => el.id === elementId) as
      | ExcalidrawElement
      | undefined;
    if (!element) {
      return;
    }
    const withTitle: MarkdownConfig = {
      ...next,
      title: titleFromMarkdown(next.markdown, next.title || "Markdown"),
    };
    const updated = newElementWith(element, {
      customData: writeMarkdownConfig(element, withTitle),
    });
    api.updateScene({
      elements: api
        .getSceneElements()
        .map((el) => (el.id === elementId ? updated : el)),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    setConfig(withTitle);
  };

  // Selection popover "Done" / deselect clears editingId — save the draft then.
  useEffect(() => {
    if (wasEditingRef.current && !editing) {
      const current = configRef.current;
      const nextMarkdown = draftRef.current;
      if (nextMarkdown !== current.markdown) {
        persist({ ...current, markdown: nextMarkdown });
      }
    }
    wasEditingRef.current = editing;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist on exit only
  }, [editing]);

  // Leave source edit when this embed is no longer selected.
  useEffect(() => {
    if (!api || !editing) {
      return;
    }
    return api.onChange((_elements, appState) => {
      if (!appState.selectedElementIds[elementId]) {
        setEditingId(null);
      }
    });
  }, [api, editing, elementId, setEditingId]);

  const html = useMemo(
    () => renderMarkdownHtml(config.markdown),
    [config.markdown],
  );

  return (
    <div
      className="jayrr-called-embed jayrr-markdown-embed"
      data-element-id={elementId}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.stopPropagation();
        setDraft(config.markdown);
        setEditingId(elementId);
      }}
    >
      {editing ? (
        <textarea
          className="jayrr-markdown-embed__editor"
          value={draft}
          spellCheck={false}
          aria-label="Markdown source"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setDraft(config.markdown);
              setEditingId(null);
            }
          }}
        />
      ) : (
        <div
          className="jayrr-markdown-embed__body markdown-body"
          // Sanitized GFM HTML from marked + DOMPurify
          dangerouslySetInnerHTML={{ __html: html }}
          ref={(node) => {
            if (node) {
              openExternalLinks(node);
            }
          }}
        />
      )}
    </div>
  );
};
