const DECODE_LIMIT = 2;
const SILENCE_DB = -96;

const cache = new Map<string, number>();
const inflight = new Map<string, Promise<number | null>>();
const listeners = new Map<string, Set<(db: number) => void>>();
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
  resolve: (db: number | null) => void;
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

const rmsDb = (buffer: AudioBuffer) => {
  const { numberOfChannels, length } = buffer;
  let sumSq = 0;
  for (let c = 0; c < numberOfChannels; c += 1) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i += 1) {
      const sample = data[i];
      sumSq += sample * sample;
    }
  }
  const rms = Math.sqrt(sumSq / (length * numberOfChannels));
  if (rms <= 1e-10) {
    return SILENCE_DB;
  }
  return 20 * Math.log10(rms);
};

const decode = async (src: string) => {
  const res = await fetch(src);
  if (!res.ok) {
    return null;
  }
  const bytes = await res.arrayBuffer();
  const buffer = await context().decodeAudioData(bytes.slice(0));
  return rmsDb(buffer);
};

const runJob = (job: Job) => {
  active += 1;
  void decode(job.src)
    .then((db) => {
      if (db != null) {
        cache.set(job.src, db);
        notifyCacheListeners();
      }
      job.resolve(db);
    })
    .catch(() => job.resolve(null))
    .finally(() => {
      active -= 1;
      inflight.delete(job.src);
      pump();
    });
};

const pump = () => {
  while (active < DECODE_LIMIT && queue.length > 0) {
    const job = queue.shift();
    if (!job) {
      break;
    }
    runJob(job);
  }
};

const loadDb = (src: string) => {
  const cached = cache.get(src);
  if (cached != null) {
    return Promise.resolve(cached);
  }
  const pending = inflight.get(src);
  if (pending) {
    return pending;
  }
  const request = new Promise<number | null>((resolve) => {
    queue.push({ src, resolve });
    pump();
  });
  inflight.set(src, request);
  return request;
};

export const peekLoudnessDb = (sources: string[]) => {
  for (const src of sources) {
    const db = cache.get(src);
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
  const unique = [...new Set(sources.filter(Boolean))];
  for (const src of unique) {
    const cached = cache.get(src);
    if (cached != null) {
      onDb(cached);
      return () => undefined;
    }
  }

  let cancelled = false;
  const key = unique.join("|");
  let subs = listeners.get(key);
  if (!subs) {
    subs = new Set();
    listeners.set(key, subs);
  }
  subs.add(onDb);

  void (async () => {
    for (const src of unique) {
      const db = await loadDb(src);
      if (cancelled) {
        return;
      }
      if (db != null) {
        onDb(db);
        return;
      }
    }
  })();

  return () => {
    cancelled = true;
    subs.delete(onDb);
    if (subs.size === 0) {
      listeners.delete(key);
    }
  };
};
