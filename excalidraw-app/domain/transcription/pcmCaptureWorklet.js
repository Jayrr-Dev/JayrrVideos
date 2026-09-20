/* global sampleRate */
// Inworld/AssemblyAI streaming rejects audio chunks shorter than 20 ms, and
// render quanta are only 128 samples (~2.7 ms at 48 kHz), so batch to ~100 ms.
const CHUNK_SECONDS = 0.1;

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunkSize = Math.max(1, Math.round(sampleRate * CHUNK_SECONDS));
    this.buffer = new Float32Array(this.chunkSize);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel || channel.length === 0) {
      return true;
    }
    let offset = 0;
    while (offset < channel.length) {
      const take = Math.min(
        channel.length - offset,
        this.chunkSize - this.filled,
      );
      this.buffer.set(channel.subarray(offset, offset + take), this.filled);
      this.filled += take;
      offset += take;
      if (this.filled === this.chunkSize) {
        // postMessage structured-clones, so the buffer can be reused.
        this.port.postMessage(this.buffer);
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-capture", PcmCaptureProcessor);
