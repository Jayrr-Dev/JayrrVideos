import type { ClipboardData } from "@excalidraw/excalidraw/clipboard";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { insertMarkdownEmbed } from "./insertMarkdown";
import { isLikelyMarkdown, isMarkdownFile } from "./isLikelyMarkdown";
import { titleFromMarkdown } from "./objects/markdownConfig";

const readMarkdownFiles = async (
  files: FileList | File[] | null | undefined,
): Promise<{ markdown: string; title: string } | null> => {
  if (!files || files.length === 0) {
    return null;
  }
  const list = Array.from(files);
  const mdFiles = list.filter(isMarkdownFile);
  if (mdFiles.length === 0) {
    return null;
  }
  const parts: string[] = [];
  let title = "Markdown";
  for (const file of mdFiles) {
    const text = await file.text();
    parts.push(text.replace(/^\uFEFF/, ""));
    if (title === "Markdown") {
      title = file.name.replace(/\.(md|markdown|mdx)$/i, "") || title;
    }
  }
  const markdown = parts.join("\n\n");
  return {
    markdown,
    title: titleFromMarkdown(markdown, title),
  };
};

/**
 * Returns true when paste was handled (caller should cancel default paste).
 * Shift+paste keeps plain-text path.
 */
export const tryPasteMarkdown = async (
  api: ExcalidrawImperativeAPI,
  data: ClipboardData,
  event: ClipboardEvent | null,
): Promise<boolean> => {
  // ClipboardEvent is not typed with modifiers; Shift+paste still carries shiftKey.
  if (
    event != null &&
    "shiftKey" in event &&
    (event as { shiftKey?: boolean }).shiftKey
  ) {
    return false;
  }

  const fromFiles = await readMarkdownFiles(event?.clipboardData?.files);
  if (fromFiles) {
    insertMarkdownEmbed(api, fromFiles.markdown, { title: fromFiles.title });
    return true;
  }

  const text = data.text?.replace(/^\uFEFF/, "") ?? "";
  if (!text || !isLikelyMarkdown(text)) {
    return false;
  }

  insertMarkdownEmbed(api, text);
  return true;
};

export const tryDropMarkdownFiles = async (
  api: ExcalidrawImperativeAPI,
  event: DragEvent,
): Promise<boolean> => {
  const fromFiles = await readMarkdownFiles(event.dataTransfer?.files);
  if (!fromFiles) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  insertMarkdownEmbed(api, fromFiles.markdown, { title: fromFiles.title });
  return true;
};

export const dataTransferHasMarkdownFile = (
  dataTransfer: DataTransfer | null,
): boolean => {
  if (!dataTransfer) {
    return false;
  }
  if (dataTransfer.files?.length) {
    return Array.from(dataTransfer.files).some(isMarkdownFile);
  }
  return Array.from(dataTransfer.items ?? []).some((item) => {
    if (item.kind !== "file") {
      return false;
    }
    const type = (item.type || "").toLowerCase();
    return (
      type === "text/markdown" ||
      type === "text/x-markdown" ||
      type === "text/mdx"
    );
  });
};
