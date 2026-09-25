import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModelWorkerClient } from "../../vendor/segmo/src/model-worker";

class TestWorker {
  static latest: TestWorker;
  onmessage?: (event: { data: Record<string, unknown> }) => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    TestWorker.latest = this;
  }
  reply(type: string) {
    this.onmessage?.({ data: { type } });
  }
}

describe("camera worker backpressure", () => {
  let client: ModelWorkerClient;
  let capture: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    vi.stubGlobal("Worker", TestWorker);
    capture = vi.fn().mockResolvedValue({ close: vi.fn() });
    vi.stubGlobal("createImageBitmap", capture);
    client = new ModelWorkerClient({});
    const initialized = client.init();
    TestWorker.latest.reply("ready");
    await initialized;
  });
  afterEach(() => {
    client.destroy();
    vi.unstubAllGlobals();
  });
  const source = {} as ImageBitmap;

  it("drops busy frames and captures the newest frame after completion", async () => {
    for (let timestamp = 1; timestamp <= 100; timestamp++) {
      client.requestSegment(source, timestamp);
    }
    await Promise.resolve();
    expect(capture).toHaveBeenCalledTimes(1);
    TestWorker.latest.reply("done");
    client.requestSegment(source, 101);
    await Promise.resolve();
    expect(capture).toHaveBeenCalledTimes(2);
    expect(TestWorker.latest.postMessage.mock.lastCall?.[0].timestamp).toBe(
      101,
    );
  });

  it("recovers after a failed camera capture", async () => {
    capture.mockRejectedValueOnce(new Error("camera unavailable"));
    client.requestSegment(source, 1);
    await Promise.resolve();
    await Promise.resolve();
    client.requestSegment(source, 2);
    await Promise.resolve();
    expect(capture).toHaveBeenCalledTimes(2);
    expect(TestWorker.latest.postMessage.mock.lastCall?.[0].timestamp).toBe(2);
  });

  it("closes a capture that completes after teardown", async () => {
    client.requestSegment(source, 1);
    client.destroy();
    const captured = await capture.mock.results[0].value;
    expect(captured.close).toHaveBeenCalledOnce();
    expect(TestWorker.latest.postMessage).toHaveBeenCalledTimes(1); // init only
  });
});
