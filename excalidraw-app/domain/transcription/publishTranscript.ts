export type TranscriptFeedTurn = {
  id: string;
  speaker: number | null;
  text: string;
  isFinal: boolean;
};

export type TranscriptFeed = {
  sourceId: string;
  text: string;
  listening: boolean;
  turns: TranscriptFeedTurn[];
  names: Record<number, string>;
};

const feeds = new Map<string, TranscriptFeed>();
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) {
    listener();
  }
};

export const publishTranscript = (feed: TranscriptFeed) => {
  feeds.set(feed.sourceId, feed);
  notify();
};

export const clearTranscript = (sourceId: string) => {
  if (!feeds.has(sourceId)) {
    return;
  }
  feeds.delete(sourceId);
  notify();
};

export const readTranscript = (sourceId: string) => feeds.get(sourceId) ?? null;

export const listTranscriptFeeds = () => [...feeds.values()];

export const subscribeTranscripts = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};
