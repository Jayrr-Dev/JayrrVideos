import { refocusPresentTrap } from "./presentFocus";

const EMBED_SELECTOR = "iframe.excalidraw__embeddable";
const PLAY_RETRY_MS = [0, 250, 700, 1400] as const;

let playTimers: number[] = [];
let restoreTimers: number[] = [];

const clearTimers = (timers: number[]) => {
  for (const id of timers) {
    window.clearTimeout(id);
  }
};

const clearPlayTimers = () => {
  clearTimers(playTimers);
  playTimers = [];
};

const clearRestoreTimers = () => {
  clearTimers(restoreTimers);
  restoreTimers = [];
};

const youtubeCommand = (
  win: Window,
  func: "playVideo" | "pauseVideo" | "stopVideo",
  id: string,
) => {
  win.postMessage(
    JSON.stringify({
      event: "listening",
      id,
    }),
    "*",
  );
  win.postMessage(
    JSON.stringify({
      event: "command",
      func,
      args: "",
    }),
    "*",
  );
};

const isYoutubeSrc = (src: string) => src.includes("youtube");

const isVimeoSrc = (src: string) => src.includes("player.vimeo.com");

const controlIframe = (iframe: HTMLIFrameElement, play: boolean) => {
  const src = iframe.src;
  const id = iframe.dataset.elementId ?? "";
  iframe.tabIndex = -1;
  iframe.inert = true;
  const win = iframe.contentWindow;
  if (!win) {
    return;
  }
  if (isYoutubeSrc(src)) {
    youtubeCommand(win, play ? "playVideo" : "stopVideo", id);
    return;
  }
  if (isVimeoSrc(src)) {
    win.postMessage(
      JSON.stringify({
        method: play ? "play" : "pause",
        value: true,
      }),
      "*",
    );
  }
};

const iframesForIds = (ids: ReadonlySet<string>, doc: Document) => {
  const found: HTMLIFrameElement[] = [];
  for (const id of ids) {
    const iframe = doc.querySelector<HTMLIFrameElement>(
      `${EMBED_SELECTOR}[data-element-id="${CSS.escape(id)}"]`,
    );
    if (iframe) {
      found.push(iframe);
    }
  }
  return found;
};

const allEmbedIframes = (doc: Document) =>
  Array.from(doc.querySelectorAll<HTMLIFrameElement>(EMBED_SELECTOR));

const setEmbedVisible = (iframe: HTMLIFrameElement, show: boolean) => {
  iframe.style.visibility = show ? "visible" : "hidden";
  const box = iframe.closest(".excalidraw__embeddable-container");
  if (box instanceof HTMLElement) {
    box.style.visibility = show ? "visible" : "hidden";
  }
};

export const resetPresentMediaVisibility = (doc: Document = document) => {
  for (const iframe of allEmbedIframes(doc)) {
    iframe.style.visibility = "";
    iframe.inert = false;
    const box = iframe.closest(".excalidraw__embeddable-container");
    if (box instanceof HTMLElement) {
      box.style.visibility = "";
    }
  }
};

export const pausePresentMedia = (
  ids: ReadonlySet<string>,
  doc: Document = document,
) => {
  clearPlayTimers();
  clearRestoreTimers();
  for (const iframe of iframesForIds(ids, doc)) {
    controlIframe(iframe, false);
    setEmbedVisible(iframe, false);
  }
  refocusPresentTrap();
};

export const pauseOtherPresentMedia = (
  keep: ReadonlySet<string>,
  doc: Document = document,
) => {
  clearPlayTimers();
  clearRestoreTimers();
  for (const iframe of allEmbedIframes(doc)) {
    const id = iframe.dataset.elementId ?? "";
    if (keep.has(id)) {
      setEmbedVisible(iframe, true);
      iframe.inert = true;
      continue;
    }
    controlIframe(iframe, false);
    setEmbedVisible(iframe, false);
  }
  refocusPresentTrap();
};

export const playPresentMedia = (
  ids: ReadonlySet<string>,
  doc: Document = document,
) => {
  clearPlayTimers();
  if (ids.size === 0) {
    return;
  }
  const attempt = () => {
    for (const iframe of iframesForIds(ids, doc)) {
      setEmbedVisible(iframe, true);
      iframe.inert = true;
      controlIframe(iframe, true);
    }
    refocusPresentTrap();
  };
  for (const delay of PLAY_RETRY_MS) {
    if (delay === 0) {
      attempt();
      continue;
    }
    playTimers.push(window.setTimeout(() => attempt(), delay));
  }
};
