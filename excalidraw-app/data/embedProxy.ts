import { toValidURL } from "@excalidraw/common";
import { getEmbedLink } from "@excalidraw/element";

import { appJotaiStore, atom } from "../app-jotai";
import { api, convexClient } from "../convexClient";

/** "direct" = site allows framing; "proxied" = must go through /embed-proxy. */
type FrameStatus = "direct" | "proxied";

export const embedFrameStatusAtom = atom<ReadonlyMap<string, FrameStatus>>(
  new Map(),
);

const probing = new Set<string>();

const convexSiteUrl = (): string | null => {
  const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
  return url ? url.replace(/\.convex\.cloud$/, ".convex.site") : null;
};

const setFrameStatus = (link: string, status: FrameStatus) => {
  const next = new Map(appJotaiStore.get(embedFrameStatusAtom));
  next.set(link, status);
  appJotaiStore.set(embedFrameStatusAtom, next);
};

/** Only plain website embeds qualify; video/service links have their own embed URLs. */
const isGenericWebsiteLink = (link: string): boolean => {
  const embed = getEmbedLink(link);
  return embed?.type === "generic" && embed.link === link;
};

const probeFrameStatus = (link: string) => {
  const client = convexClient;
  if (!client || probing.has(link)) {
    return;
  }
  probing.add(link);
  // Deferred so the jotai update never lands mid-render.
  queueMicrotask(() => {
    client
      .action(api.embedProxy.probe, { url: link })
      .then(({ frameBlocked }) =>
        setFrameStatus(link, frameBlocked ? "proxied" : "direct"),
      )
      .catch(() => setFrameStatus(link, "direct"))
      .finally(() => probing.delete(link));
  });
};

/**
 * Proxy URL for an embed whose site blocks framing, or null to let the
 * default iframe load the link directly. Unknown links get probed once.
 */
export const resolveProxiedEmbedSrc = (
  rawLink: string | null | undefined,
  statuses: ReadonlyMap<string, FrameStatus>,
): string | null => {
  const site = convexSiteUrl();
  if (!site || !rawLink) {
    return null;
  }
  const link = toValidURL(rawLink);
  if (link === "about:blank" || !isGenericWebsiteLink(link)) {
    return null;
  }
  const status = statuses.get(link);
  if (status === undefined) {
    probeFrameStatus(link);
    return null;
  }
  if (status === "direct") {
    return null;
  }
  return `${site}/embed-proxy?url=${encodeURIComponent(link)}`;
};
