import type { ExcalidrawElement } from "@excalidraw/element/types";

import { JAYRR_CALLED_OBJECT_KEY } from "../model";

export type MarkdownConfig = {
  markdown: string;
  title: string;
};

export const DEFAULT_MARKDOWN: MarkdownConfig = {
  markdown:
    "# Untitled\n\nPaste markdown here, or drop a `.md` file on the canvas.",
  title: "Markdown",
};

export const MARKDOWN_DEFAULT_WIDTH = 520;
export const MARKDOWN_DEFAULT_HEIGHT = 640;
export const MARKDOWN_MIN_WIDTH = 280;
export const MARKDOWN_MIN_HEIGHT = 200;
export const MARKDOWN_MAX_WIDTH = 900;
export const MARKDOWN_MAX_HEIGHT = 1400;

export const readMarkdownConfig = (
  element: Pick<ExcalidrawElement, "customData">,
): MarkdownConfig => {
  const bag = element.customData?.[JAYRR_CALLED_OBJECT_KEY];
  if (!bag || typeof bag !== "object") {
    return DEFAULT_MARKDOWN;
  }
  const markdown = (bag as { markdown?: unknown }).markdown;
  const title = (bag as { title?: unknown }).title;
  return {
    markdown:
      typeof markdown === "string" ? markdown : DEFAULT_MARKDOWN.markdown,
    title:
      typeof title === "string" && title.trim()
        ? title.trim()
        : DEFAULT_MARKDOWN.title,
  };
};

export const writeMarkdownConfig = (
  element: Pick<ExcalidrawElement, "customData">,
  config: MarkdownConfig,
): ExcalidrawElement["customData"] => {
  const previous = element.customData?.[JAYRR_CALLED_OBJECT_KEY];
  const bag: Record<string, unknown> =
    previous && typeof previous === "object"
      ? { ...(previous as Record<string, unknown>) }
      : {};
  bag.kind = "markdown";
  bag.markdown = config.markdown;
  bag.title = config.title;
  return {
    ...(element.customData ?? {}),
    [JAYRR_CALLED_OBJECT_KEY]: bag,
  };
};

/** Rough canvas size from markdown length / structure. */
export const estimateMarkdownEmbedSize = (
  markdown: string,
): { width: number; height: number } => {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const width = Math.min(
    MARKDOWN_MAX_WIDTH,
    Math.max(
      MARKDOWN_MIN_WIDTH,
      Math.round(Math.min(longest * 7.2, 720) || MARKDOWN_DEFAULT_WIDTH),
    ),
  );
  const height = Math.min(
    MARKDOWN_MAX_HEIGHT,
    Math.max(
      MARKDOWN_MIN_HEIGHT,
      Math.round(
        120 + lines.length * 22 + (markdown.match(/```/g)?.length ?? 0) * 40,
      ),
    ),
  );
  return { width, height };
};

export const titleFromMarkdown = (markdown: string, fallback = "Markdown") => {
  const heading = markdown.match(/^\s*#{1,6}\s+(.+?)\s*$/m);
  if (heading?.[1]) {
    return heading[1].replace(/[#*`_~[\]]/g, "").trim() || fallback;
  }
  const firstLine = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) {
    return fallback;
  }
  return firstLine.slice(0, 48) || fallback;
};
