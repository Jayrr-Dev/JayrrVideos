import { v } from "convex/values";

import { action } from "./_generated/server";

const PROXY_PROTOCOLS = new Set(["http:", "https:"]);
/** Keep well under the 20MB HTTP action response cap. */
export const MAX_HTML_BYTES = 5 * 1024 * 1024;
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

// Loopback, link-local, RFC1918 and ULA ranges. Blocks SSRF into the
// deployment's own network via the proxy.
const RE_PRIVATE_HOST =
  /^(localhost|127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:|\[?fe80:)/i;
const RE_HEAD_OPEN = /<head[^>]*>/i;
const RE_META_CSP =
  /<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi;
const RE_SCRIPT = /<script\b[^>]*>[\s\S]*?<\/script\s*>|<script\b[^>]*\/>/gi;
const RE_SCRIPT_PRELOAD =
  /<link\b[^>]*rel=["']preload["'][^>]*as=["']script["'][^>]*>/gi;

export const parseProxyableUrl = (raw: string): URL => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid embed URL");
  }
  if (!PROXY_PROTOCOLS.has(url.protocol)) {
    throw new Error("Only http(s) pages can be embedded");
  }
  const host = url.hostname.toLowerCase();
  if (
    RE_PRIVATE_HOST.test(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    !host.includes(".")
  ) {
    throw new Error("Private hosts cannot be embedded");
  }
  return url;
};

export const fetchEmbedPage = async (url: URL): Promise<Response> => {
  return await fetch(url.href, {
    redirect: "follow",
    headers: {
      "user-agent": BROWSER_USER_AGENT,
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    },
  });
};

/** True when the response headers tell browsers to refuse third-party framing. */
export const isFrameBlocked = (headers: Headers): boolean => {
  const xfo = headers.get("x-frame-options")?.trim().toUpperCase();
  if (xfo === "DENY" || xfo === "SAMEORIGIN") {
    return true;
  }
  const csp = headers.get("content-security-policy") ?? "";
  const frameAncestors = csp
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => /^frame-ancestors\b/i.test(directive));
  if (!frameAncestors) {
    return false;
  }
  const sources = frameAncestors.split(/\s+/).slice(1);
  return !sources.some((source) => source === "*" || source === "https:");
};

const escapeAttribute = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

export const embedProxyErrorPage = (
  message: string,
  pageUrl?: string,
): string =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Embed unavailable</title><style>html,body{margin:0;height:100%;font:14px/1.45 system-ui,sans-serif;color:#111;background:#fff}main{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:24px;text-align:center}a{color:#1d4ed8}</style></head><body><main><p>${escapeAttribute(
    message,
  )}</p>${
    pageUrl
      ? `<p><a href="${escapeAttribute(
          pageUrl,
        )}" target="_blank" rel="noreferrer">Open original page</a></p>`
      : ""
  }</main></body></html>`;

/**
 * Turns the page into a static document: re-based on its real URL so
 * stylesheets, images and links resolve against the origin site, with meta
 * CSP removed. Scripts are dropped because SPA runtimes (Next.js etc.) see the
 * proxy path, fail to hydrate and replace the page with an error screen.
 */
export const rewriteEmbedHtml = (
  html: string,
  pageUrl: URL,
  _proxyOrigin = "",
): string => {
  const inject = `<base href="${escapeAttribute(pageUrl.href)}">`;
  const stripped = html
    .replace(RE_META_CSP, "")
    .replace(RE_SCRIPT, "")
    .replace(RE_SCRIPT_PRELOAD, "");
  if (RE_HEAD_OPEN.test(stripped)) {
    return stripped.replace(RE_HEAD_OPEN, (match) => `${match}${inject}`);
  }
  return `${inject}${stripped}`;
};

/** Does the page refuse to be framed? Network failures count as "no". */
export const probe = action({
  args: { url: v.string() },
  returns: v.object({ frameBlocked: v.boolean() }),
  handler: async (_ctx, args) => {
    const target = parseProxyableUrl(args.url);
    try {
      const response = await fetchEmbedPage(target);
      await response.body?.cancel();
      return { frameBlocked: isFrameBlocked(response.headers) };
    } catch {
      return { frameBlocked: false };
    }
  },
});
