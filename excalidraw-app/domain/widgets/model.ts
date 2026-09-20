import type { ExcalidrawElement } from "@excalidraw/element/types";

export const JAYRR_CALLED_OBJECTS_TAB = "jayrrCalled";

export const JAYRR_CALLED_OBJECT_KEY = "jayrrCalledObject";

export const JAYRR_CAPTION_FOR_KEY = "jayrrCaptionFor";

export const JAYRR_CALLED_OBJECT_PROTOCOL = "jayrr-called:";

export const CALLED_OBJECT_KINDS = [
  "transcribe",
  "classifier",
  "transcription",
  "caption",
  "markdown",
  "pdf",
] as const;

export type CalledObjectKind = typeof CALLED_OBJECT_KINDS[number];

export type CalledObjectDef = {
  kind: CalledObjectKind;
  name: string;
  hint: string;
  width: number;
  height: number;
};

export const CALLED_OBJECTS: readonly CalledObjectDef[] = [
  {
    kind: "transcribe",
    name: "Live Classifier",
    hint: "Captions from mic, window, or video",
    width: 340,
    height: 300,
  },
  {
    kind: "classifier",
    name: "Classifier",
    hint: "Jev class scores",
    width: 360,
    height: 420,
  },
  {
    kind: "transcription",
    name: "Transcription",
    hint: "Full transcript as canvas text",
    width: 340,
    height: 132,
  },
  {
    kind: "caption",
    name: "Caption",
    hint: "Live movie-style subtitles",
    width: 340,
    height: 132,
  },
  {
    kind: "markdown",
    name: "Markdown",
    hint: "Paste or drop a .md file",
    width: 520,
    height: 640,
  },
  {
    kind: "pdf",
    name: "PDF",
    hint: "Paste or drop a PDF",
    width: 480,
    height: 640,
  },
];

const kindSet = new Set<string>(CALLED_OBJECT_KINDS);

const isKind = (value: unknown): value is CalledObjectKind =>
  typeof value === "string" && kindSet.has(value);

export const calledObjectLink = (kind: CalledObjectKind) =>
  `${JAYRR_CALLED_OBJECT_PROTOCOL}${kind}`;

export const kindFromCalledObjectLink = (
  link: string | null | undefined,
): CalledObjectKind | null => {
  if (!link || !link.startsWith(JAYRR_CALLED_OBJECT_PROTOCOL)) {
    return null;
  }
  const kind = link.slice(JAYRR_CALLED_OBJECT_PROTOCOL.length);
  return isKind(kind) ? kind : null;
};

export const isJayrrCalledObjectLink = (link: string): boolean =>
  kindFromCalledObjectLink(link) !== null;

export const readCalledObjectKind = (
  element: Pick<ExcalidrawElement, "customData" | "link">,
): CalledObjectKind | null => {
  const data = element.customData?.[JAYRR_CALLED_OBJECT_KEY];
  if (data && typeof data === "object") {
    const kind = (data as { kind?: unknown }).kind;
    if (isKind(kind)) {
      return kind;
    }
  }
  return kindFromCalledObjectLink(element.link);
};
