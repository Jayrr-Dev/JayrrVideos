import { describe, expect, it } from "vitest";

import { pruneScoredText, retryStaleScore } from "./scoringQueue";

import type { RetryableScoreJob } from "./scoringQueue";

describe("scoring queue", () => {
  it("terminates when missing context rejects every attempt immediately", async () => {
    const queue: RetryableScoreJob[] = [{ turnId: "a", text: "speech" }];
    let attempts = 0;
    while (queue.length && attempts < 100) {
      const job = queue.shift()!;
      attempts++;
      try {
        await Promise.reject(new Error("Stale conversation result"));
      } catch {
        retryStaleScore(queue, job);
      }
    }
    expect(attempts).toBe(3);
    expect(queue).toEqual([]);
  });

  it("does not replace a queued correction with stale text", () => {
    const queue = [{ turnId: "a", text: "corrected speech" }];
    expect(retryStaleScore(queue, { turnId: "a", text: "old speech" })).toBe(
      false,
    );
    expect(queue).toEqual([{ turnId: "a", text: "corrected speech" }]);
  });

  it("keeps completed metadata bounded during long sessions", () => {
    const cache = new Map<string, string>();
    for (let i = 0; i < 10000; i++) {
      cache.set(String(i), "speech");
      const retained = Array.from({ length: Math.min(i + 1, 80) }, (_, n) => ({
        id: String(i - n),
      }));
      pruneScoredText(cache, retained);
    }
    expect(cache.size).toBe(80);
    expect(cache.has("0")).toBe(false);
    expect(cache.get("9999")).toBe("speech");
  });
});
