import { httpRouter } from "convex/server";

import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { canvasAiChat, canvasAiChatOptions } from "./canvasAi/chatHttp";
import {
  MAX_HTML_BYTES,
  embedProxyErrorPage,
  fetchEmbedPage,
  parseProxyableUrl,
  rewriteEmbedHtml,
} from "./embedProxy";

const http = httpRouter();
auth.addHttpRoutes(http);

/**
 * Serves a third-party page without its X-Frame-Options / frame-ancestors
 * headers so the canvas can iframe it. Only HTML documents are proxied; every
 * other asset loads straight from the origin site via the injected <base>.
 */
http.route({
  path: "/embed-proxy",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const raw = new URL(request.url).searchParams.get("url");
    if (!raw) {
      return new Response("Missing url query parameter", { status: 400 });
    }

    let target: URL;
    try {
      target = parseProxyableUrl(raw);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid embed URL";
      return new Response(message, { status: 400 });
    }

    const htmlHeaders = {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-robots-tag": "noindex",
    } as const;

    let upstream: Response;
    try {
      upstream = await fetchEmbedPage(target);
    } catch {
      return new Response(
        embedProxyErrorPage("Couldn't load this page.", target.href),
        // 200 so the iframe shows our page instead of a CDN 502.
        { status: 200, headers: htmlHeaders },
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!upstream.ok || !contentType.includes("text/html")) {
      await upstream.body?.cancel();
      return new Response(
        embedProxyErrorPage(
          "This page isn't HTML, so it can't be embedded.",
          target.href,
        ),
        { status: 200, headers: htmlHeaders },
      );
    }

    const html = await upstream.text();
    if (html.length > MAX_HTML_BYTES) {
      return new Response(
        embedProxyErrorPage("This page is too large to embed.", target.href),
        { status: 200, headers: htmlHeaders },
      );
    }

    const finalUrl = new URL(upstream.url || target.href);
    const proxyOrigin = new URL(request.url).origin;
    return new Response(rewriteEmbedHtml(html, finalUrl, proxyOrigin), {
      status: 200,
      headers: htmlHeaders,
    });
  }),
});

http.route({
  path: "/ai/chat",
  method: "OPTIONS",
  handler: canvasAiChatOptions,
});

http.route({
  path: "/ai/chat",
  method: "POST",
  handler: canvasAiChat,
});

export default http;
