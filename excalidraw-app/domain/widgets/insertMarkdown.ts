import { newEmbeddableElement } from "@excalidraw/element";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { JAYRR_CALLED_OBJECT_KEY, calledObjectLink } from "./model";
import {
  DEFAULT_MARKDOWN,
  estimateMarkdownEmbedSize,
  titleFromMarkdown,
} from "./objects/markdownConfig";

export const insertMarkdownEmbed = (
  api: ExcalidrawImperativeAPI,
  markdown: string,
  opts?: { title?: string; x?: number; y?: number },
) => {
  const source = markdown.replace(/^\uFEFF/, "");
  const title = opts?.title?.trim() || titleFromMarkdown(source);
  const { width, height } = estimateMarkdownEmbedSize(source);

  const element = newEmbeddableElement({
    type: "embeddable",
    x: opts?.x ?? 0,
    y: opts?.y ?? 0,
    width,
    height,
    link: calledObjectLink("markdown"),
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    roughness: 0,
    customData: {
      [JAYRR_CALLED_OBJECT_KEY]: {
        kind: "markdown",
        markdown: source || DEFAULT_MARKDOWN.markdown,
        title,
      },
    },
  });

  api.insertElementsFromLibrary({ elements: [element] });
  return element;
};
