import type { ExcalidrawElement } from "@excalidraw/element/types";

export const JAYRR_EDITOR_PREVIEW_KEY = "jayrrEditorPreview";
export const JAYRR_EDITOR_PREVIEW_PROTOCOL = "jayrr-editor:";
export const JAYRR_EDITOR_PREVIEW_KIND = "preview";

export const EDITOR_PREVIEW_WIDTH = 560;
export const EDITOR_PREVIEW_HEIGHT = 315;

export const editorPreviewLink = () =>
  `${JAYRR_EDITOR_PREVIEW_PROTOCOL}${JAYRR_EDITOR_PREVIEW_KIND}`;

export const isJayrrEditorPreviewLink = (link: string | null | undefined) =>
  Boolean(
    link &&
      link.startsWith(JAYRR_EDITOR_PREVIEW_PROTOCOL) &&
      link.slice(JAYRR_EDITOR_PREVIEW_PROTOCOL.length) ===
        JAYRR_EDITOR_PREVIEW_KIND,
  );

export const isJayrrEditorPreviewElement = (
  element: Pick<ExcalidrawElement, "customData" | "link" | "type">,
) => {
  if (element.type !== "embeddable") {
    return false;
  }
  if (isJayrrEditorPreviewLink(element.link)) {
    return true;
  }
  const bag = element.customData?.[JAYRR_EDITOR_PREVIEW_KEY];
  return Boolean(bag && typeof bag === "object");
};

const videos = new Map<string, HTMLVideoElement>();

export const registerEditorPreviewVideo = (
  elementId: string,
  video: HTMLVideoElement,
) => {
  videos.set(elementId, video);
  return () => {
    if (videos.get(elementId) === video) {
      videos.delete(elementId);
    }
  };
};

export const getEditorPreviewVideo = (elementId: string) =>
  videos.get(elementId) ?? null;

/** Resolve the video for a linked canvas object (preview widget or recording embed). */
export const findEditorTargetVideo = (
  elementId: string,
  doc: Document,
): HTMLVideoElement | null => {
  const registered = getEditorPreviewVideo(elementId);
  if (registered) {
    return registered;
  }
  return doc.querySelector<HTMLVideoElement>(
    `video[data-element-id="${CSS.escape(elementId)}"]`,
  );
};
