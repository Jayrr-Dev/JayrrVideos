/** HyperFrames-inspired HTML composition: timed `class="clip"` nodes + seek. */

export const MAX_COMPOSITION_HTML_CHARS = 80_000;

export type HyperframeTimedNode = {
  startSec: number;
  durationSec: number;
};

const START_RE = /data-start\s*=\s*["']?(-?\d+(?:\.\d+)?)/gi;
const DURATION_RE = /data-duration\s*=\s*["']?(-?\d+(?:\.\d+)?)/i;

export const clampCompositionHtml = (html: string) =>
  html.length > MAX_COMPOSITION_HTML_CHARS
    ? html.slice(0, MAX_COMPOSITION_HTML_CHARS)
    : html;

export const escapeHtmlText = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const sanitizeCompositionHtml = (raw: string) => {
  const trimmed = clampCompositionHtml(raw.trim());
  if (!trimmed) {
    return "";
  }
  return trimmed
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object\b[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
};

export const parseHyperframeClips = (html: string): HyperframeTimedNode[] => {
  const out: HyperframeTimedNode[] = [];
  START_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = START_RE.exec(html))) {
    const startSec = Number(match[1]);
    if (!Number.isFinite(startSec)) {
      continue;
    }
    const slice = html.slice(match.index, match.index + 400);
    const durationMatch = DURATION_RE.exec(slice);
    const durationSec = durationMatch ? Number(durationMatch[1]) : 1;
    out.push({
      startSec: Math.max(0, startSec),
      durationSec:
        Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 1,
    });
  }
  return out;
};

export const compositionDurationMs = (html: string, fallbackMs: number) => {
  let endSec = 0;
  for (const node of parseHyperframeClips(html)) {
    endSec = Math.max(endSec, node.startSec + node.durationSec);
  }
  if (endSec <= 0) {
    return Math.max(1, Math.round(fallbackMs));
  }
  return Math.max(1, Math.round(endSec * 1000));
};

export const defaultTitleCardHtml = (label: string, durationSec: number) => {
  const safe = escapeHtmlText(label.trim() || "Clip");
  const dur = Math.max(0.5, durationSec);
  return `<h1 class="clip" data-start="0" data-duration="${dur}" data-track-index="0">${safe}</h1>`;
};

const SEEK_RUNTIME = `
<script>
(function () {
  function seek(ms) {
    var t = Math.max(0, Number(ms) || 0) / 1000;
    var nodes = document.querySelectorAll("[data-start]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var start = Number(el.getAttribute("data-start"));
      var duration = Number(el.getAttribute("data-duration"));
      if (!isFinite(start)) continue;
      if (!isFinite(duration) || duration <= 0) duration = 1e9;
      var on = t >= start && t < start + duration;
      el.style.visibility = on ? "visible" : "hidden";
      if (!on) continue;
      var local = Math.max(0, t - start);
      el.style.animationDelay = (-local) + "s";
      el.style.animationPlayState = "paused";
    }
    var timelines = window.__timelines;
    if (timelines) {
      var keys = Object.keys(timelines);
      for (var k = 0; k < keys.length; k++) {
        var tl = timelines[keys[k]];
        if (tl && typeof tl.pause === "function") tl.pause();
        if (tl && typeof tl.seek === "function") tl.seek(t);
      }
    }
  }
  window.__jayrrSeek = seek;
  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.type !== "jayrr-hyperframe-seek") return;
    seek(data.ms);
  });
  seek(0);
})();
</script>
`;

export const wrapHyperframeComposition = ({
  html,
  css,
  width,
  height,
  durationMs,
  label,
}: {
  html: string;
  css?: string;
  width?: number;
  height?: number;
  durationMs: number;
  label: string;
}) => {
  const inner =
    sanitizeCompositionHtml(html) ||
    defaultTitleCardHtml(label, durationMs / 1000);
  const w = width && width > 0 ? Math.round(width) : 1920;
  const h = height && height > 0 ? Math.round(height) : 1080;
  const durationSec = Math.max(0.001, durationMs / 1000);
  const extraCss = css ? sanitizeCompositionHtml(css) : "";
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtmlText(label)}</title>
<style>
html, body, #stage {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #0f172a;
  color: #f8fafc;
  font-family: Nunito, system-ui, sans-serif;
}
#stage {
  position: relative;
  aspect-ratio: ${w} / ${h};
  max-width: 100%;
  max-height: 100%;
  margin: auto;
}
.clip, [data-start] {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 8%;
  box-sizing: border-box;
  visibility: hidden;
  animation: jayrr-fade 0.6s ease both paused;
}
h1, h2, p { margin: 0; }
h1 { font-size: clamp(1.4rem, 6vw, 4.5rem); font-weight: 800; }
h2 { font-size: clamp(1rem, 3.5vw, 2.4rem); font-weight: 600; opacity: 0.9; }
@keyframes jayrr-fade {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: none; }
}
${extraCss}
</style>
</head>
<body>
<div id="stage" data-composition-id="jayrr" data-duration="${durationSec}" data-width="${w}" data-height="${h}">
${inner}
</div>
${SEEK_RUNTIME}
</body>
</html>`;
};

export const seekHyperframeFrame = (
  frame: HTMLIFrameElement | null,
  timeMs: number,
) => {
  if (!frame) {
    return;
  }
  const win = frame.contentWindow;
  if (!win) {
    return;
  }
  try {
    const seek = Reflect.get(win, "__jayrrSeek");
    if (typeof seek === "function") {
      seek(timeMs);
      return;
    }
  } catch {
    // Cross-document access can throw; fall through to postMessage.
  }
  win.postMessage({ type: "jayrr-hyperframe-seek", ms: timeMs }, "*");
};
