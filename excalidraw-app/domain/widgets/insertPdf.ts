import { MIME_TYPES } from "@excalidraw/common";
import { newEmbeddableElement } from "@excalidraw/element";
import {
  generateIdFromFile,
  getDataURL,
} from "@excalidraw/excalidraw/data/blob";

import type { FileId } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { JAYRR_CALLED_OBJECT_KEY, calledObjectLink } from "./model";
import {
  DEFAULT_PDF,
  PDF_DEFAULT_HEIGHT,
  PDF_DEFAULT_WIDTH,
  titleFromPdfFileName,
} from "./objects/pdfConfig";

export const isPdfFile = (file: File): boolean => {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    return true;
  }
  return (file.type || "").toLowerCase() === "application/pdf";
};

export const insertPdfEmbed = async (
  api: ExcalidrawImperativeAPI,
  file: File,
  opts?: { title?: string; x?: number; y?: number },
) => {
  const normalized =
    file.type === "application/pdf"
      ? file
      : new File([file], file.name || "document.pdf", {
          type: "application/pdf",
        });

  const fileId = (await generateIdFromFile(normalized)) as FileId;
  const dataURL = await getDataURL(normalized);
  const title =
    opts?.title?.trim() ||
    titleFromPdfFileName(normalized.name || "document.pdf");

  api.addFiles([
    {
      id: fileId,
      dataURL,
      mimeType: MIME_TYPES.binary,
      created: Date.now(),
    },
  ]);

  const element = newEmbeddableElement({
    type: "embeddable",
    x: opts?.x ?? 0,
    y: opts?.y ?? 0,
    width: PDF_DEFAULT_WIDTH,
    height: PDF_DEFAULT_HEIGHT,
    link: calledObjectLink("pdf"),
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    roughness: 0,
    customData: {
      [JAYRR_CALLED_OBJECT_KEY]: {
        kind: "pdf",
        fileId,
        title: title || DEFAULT_PDF.title,
      },
    },
  });

  api.insertElementsFromLibrary({ elements: [element] });
  return element;
};
