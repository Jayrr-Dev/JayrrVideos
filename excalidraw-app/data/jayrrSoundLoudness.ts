const STORED_BARS = 512;
const DECODE_LIMIT = 2;
const SILENCE_DB = -96;

export type WaveformAnalysis = {
  peaks: Float32Array;
  loudnessDb: number;
};

const analysisCache = new Map<string, WaveformAnalysis>();
const inflight = new Map<string, Promise<WaveformAnalysis | null>>();
const cacheListeners = new Set<() => void>();
let cacheNotifyQueued = false;

const notifyCacheListeners = () => {
  if (cacheNotifyQueued) {
    return;
  }
  cacheNotifyQueued = true;
  queueMicrotask(() => {
    cacheNotifyQueued = false;
    for (const cb of cacheListeners) {
      cb();
    }
  });
};

type Job = {
  src: string;
  resolve: (analysis: WaveformAnalysis | null) => void;
};

const queue: Job[] = [];
let active = 0;
let audioCtx: AudioContext | null = null;

const context = () => {
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audioCtx = new Ctor();
  }
  return audioCtx;
};

const analyzeBuffer = (buffer: AudioBuffer): WaveformAnalysis => {
  const { numberOfChannels, length } = buffer;
  const bucket = Math.max(1, Math.floor(length / STORED_BARS));
  const peaks = new Float32Array(STORED_BARS);
  const channels = Array.from({ length: numberOfChannels }, (_, i) =>
    buffer.getChannelData(i),
  );
  let sumSq = 0;

  for (let i = 0; i < STORED_BARS; i += 1) {
    const start = i * bucket;
    const end = i === STORED_BARS - 1 ? length : Math.min(length, start + bucket);
    let max = 0;
    for (let c = 0; c < channels.length; c += 1) {
      const data = channels[c];
      if (!data) {
        continue;
      }
      for (let s = start; s < end; s += 1) {
        const sample = data[s] ?? 0;
        sumSq += sample * sample;
        const v = Math.abs(sample);
        if (v > max) {
          max = v;
        }
      }
    }
    peaks[i] = max;
  }

  let peak = 0;
  for (let i = 0; i < peaks.length; i += 1) {
    const value = peaks[i] ?? 0;
    if (value > peak) {
      peak = value;
    }
  }
  if (peak > 0) {
    const gain = 1 / peak;
    for (let i = 0; i < peaks.length; i += 1) {
      peaks[i] *= gain;
    }
  }

  const rms = Math.sqrt(sumSq / (length * numberOfChannels));
  const loudnessDb = rms <= 1e-10 ? SILENCE_DB : 20 * Math.log10(rms);
  return { peaks, loudnessDb };
};

const decode = async (src: string): Promise<WaveformAnalysis | null> => {
  const res = await fetch(src);
  if (!res.ok) {
    return null;
  }
  const bytes = await res.arrayBuffer();
  const buffer = await context().decodeAudioData(bytes.slice(0));
  return analyzeBuffer(buffer);
};

const pump = () => {
  while (active < DECODE_LIMIT && queue.length > 0) {
    const job = queue.shift();
    if (!job) {
      break;
    }
    active += 1;
    void decode(job.src)
      .then((analysis) => {
        if (analysis) {
          analysisCache.set(job.src, analysis);
          notifyCacheListeners();
        }
        job.resolve(analysis);
      })
      .catch(() => job.resolve(null))
      .finally(() => {
        active -= 1;
        inflight.delete(job.src);
        pump();
      });
  }
};

export const loadAnalysis = (src: string): Promise<WaveformAnalysis | null> => {
  const cached = analysisCache.get(src);
  if (cached) {
    return Promise.resolve(cached);
  }

  const pending = inflight.get(src);
  if (pending) {
    return pending;
  }

  const request = new Promise<WaveformAnalysis | null>((resolve) => {
    queue.push({ src, resolve });
    pump();
  });
  inflight.set(src, request);
  return request;
};

const uniqueSources = (sources: string[]) => [
  ...new Set(sources.filter(Boolean)),
];

export const loadPeaks = async (
  sources: string[],
): Promise<Float32Array | null> => {
  for (const src of uniqueSources(sources)) {
    const analysis = await loadAnalysis(src);
    if (analysis) {
      return analysis.peaks;
    }
  }
  return null;
};

export const peekLoudnessDb = (sources: string[]) => {
  for (const src of uniqueSources(sources)) {
    const db = analysisCache.get(src)?.loudnessDb;
    if (db != null) {
      return db;
    }
  }
  return null;
};

export const subscribeLoudnessCache = (onChange: () => void) => {
  cacheListeners.add(onChange);
  return () => {
    cacheListeners.delete(onChange);
  };
};

export const subscribeLoudnessDb = (
  sources: string[],
  onDb: (db: number) => void,
) => {
  const unique = uniqueSources(sources);
  for (const src of unique) {
    const cached = analysisCache.get(src);
    if (cached) {
      onDb(cached.loudnessDb);
      return () => undefined;
    }
  }

  let cancelled = false;
  void (async () => {
    for (const src of unique) {
      const analysis = await loadAnalysis(src);
      if (cancelled) {
        return;
      }
      if (analysis) {
        onDb(analysis.loudnessDb);
        return;
      }
    }
  })();

  return () => {
    cancelled = true;
  };
};

export const resamplePeaks = (peaks: Float32Array, count: number) => {
  if (count <= 0) {
    return new Float32Array(0);
  }
  if (count === peaks.length) {
    return peaks;
  }
  const out = new Float32Array(count);
  const ratio = peaks.length / count;
  for (let i = 0; i < count; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.max(start + 1, Math.floor((i + 1) * ratio));
    let max = 0;
    for (let j = start; j < end && j < peaks.length; j += 1) {
      const value = peaks[j] ?? 0;
      if (value > max) {
        max = value;
      }
    }
    out[i] = max;
  }
  return out;
};

export const slicePeaks = (
  peaks: Float32Array,
  start: number,
  end: number,
) => {
  if (peaks.length === 0) {
    return peaks;
  }
  const a = Math.min(1, Math.max(0, start));
  const b = Math.min(1, Math.max(a + 1 / peaks.length, end));
  const i0 = Math.floor(a * peaks.length);
  const i1 = Math.max(i0 + 1, Math.ceil(b * peaks.length));
  return peaks.subarray(i0, i1);
};
