import { MIME_TYPES } from "@excalidraw/common";
import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import {
  generateIdFromFile,
  getDataURL,
} from "@excalidraw/excalidraw/data/blob";
import { useEffect, useRef, useState } from "react";

import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";

import { useAtom } from "../../../app-jotai";
import { isPdfFile } from "../insertPdf";
import { pdfReplaceRequestAtom } from "../pdfReplaceAtom";

import {
  DEFAULT_PDF,
  readPdfConfig,
  titleFromPdfFileName,
  writePdfConfig,
  type PdfConfig,
} from "./pdfConfig";

import "./PdfWidget.scss";

export const PdfWidget = ({ elementId }: { elementId: string }) => {
  const api = useExcalidrawAPI();
  const [replaceId, setReplaceId] = useAtom(pdfReplaceRequestAtom);
  const [config, setConfig] = useState<PdfConfig>(DEFAULT_PDF);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!api) {
      return;
    }
    const sync = (elements: readonly ExcalidrawElement[]) => {
      const element = elements.find((el) => el.id === elementId);
      if (!element) {
        return;
      }
      setConfig(readPdfConfig(element));
    };
    sync(api.getSceneElements());
    return api.onChange((elements) => sync(elements));
  }, [api, elementId]);

  useEffect(() => {
    if (replaceId !== elementId) {
      return;
    }
    inputRef.current?.click();
    setReplaceId(null);
  }, [elementId, replaceId, setReplaceId]);

  useEffect(() => {
    let cancelled = false;

    const clearObjectUrl = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };

    const load = async () => {
      clearObjectUrl();
      setSrc(null);
      setError(null);
      if (!api || !config.fileId) {
        return;
      }
      const file = api.getFiles()[config.fileId];
      if (!file?.dataURL) {
        setError("PDF file is still loading…");
        return;
      }
      try {
        const response = await fetch(file.dataURL);
        const blob = await response.blob();
        const pdfBlob =
          blob.type === "application/pdf"
            ? blob
            : new Blob([blob], { type: "application/pdf" });
        const url = URL.createObjectURL(pdfBlob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrlRef.current = url;
        setSrc(url);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not open this PDF.",
          );
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
      clearObjectUrl();
    };
  }, [api, config.fileId]);

  const attachFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file || !api || !isPdfFile(file)) {
      return;
    }
    const element = api.getSceneElements().find((el) => el.id === elementId);
    if (!element) {
      return;
    }
    const normalized =
      file.type === "application/pdf"
        ? file
        : new File([file], file.name || "document.pdf", {
            type: "application/pdf",
          });
    const fileId = (await generateIdFromFile(normalized)) as FileId;
    const dataURL = await getDataURL(normalized);
    api.addFiles([
      {
        id: fileId,
        dataURL,
        mimeType: MIME_TYPES.binary,
        created: Date.now(),
      },
    ]);
    const next: PdfConfig = {
      fileId,
      title: titleFromPdfFileName(normalized.name || config.title),
    };
    api.updateScene({
      elements: api.getSceneElements().map((el) =>
        el.id === elementId
          ? newElementWith(el, {
              customData: writePdfConfig(element, next),
            })
          : el,
      ),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    setConfig(next);
  };

  return (
    <div
      className="jayrr-called-embed jayrr-pdf-embed"
      data-element-id={elementId}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="jayrr-pdf-embed__file"
        onChange={(event) => {
          void attachFile(event.target.files);
          event.target.value = "";
        }}
      />
      {!config.fileId ? (
        <button
          type="button"
          className="jayrr-pdf-embed__empty"
          onClick={() => inputRef.current?.click()}
        >
          Choose a PDF
        </button>
      ) : error ? (
        <div className="jayrr-pdf-embed__error">{error}</div>
      ) : src ? (
        <iframe
          className="jayrr-pdf-embed__frame"
          title={config.title}
          src={src}
        />
      ) : (
        <div className="jayrr-pdf-embed__error">Loading PDF…</div>
      )}
    </div>
  );
};
