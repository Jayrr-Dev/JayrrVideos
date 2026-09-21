import { describe, expect, it } from "vitest";

import {
  compositionDurationMs,
  parseHyperframeClips,
  sanitizeCompositionHtml,
  wrapHyperframeComposition,
} from "./hyperframesClip";

describe("hyperframesClip", () => {
  it("parses timed clip nodes and duration", () => {
    const html = `
      <video class="clip" data-start="0" data-duration="6"></video>
      <h1 class="clip" data-start="1" data-duration="4">Title</h1>
    `;
    expect(parseHyperframeClips(html)).toEqual([
      { startSec: 0, durationSec: 6 },
      { startSec: 1, durationSec: 4 },
    ]);
    expect(compositionDurationMs(html, 1000)).toBe(6000);
  });

  it("strips scripts and wraps a seekable composition", () => {
    const wrapped = wrapHyperframeComposition({
      html: `<h1 class="clip" data-start="0" data-duration="2">Hi</h1><script>alert(1)</script>`,
      durationMs: 2000,
      label: "Hi",
    });
    expect(wrapped).toContain('data-composition-id="jayrr"');
    expect(wrapped).toContain("window.__jayrrSeek");
    expect(wrapped).not.toContain("alert(1)");
    expect(sanitizeCompositionHtml(`<p onclick="x()">ok</p>`)).toBe(
      "<p>ok</p>",
    );
  });
});
