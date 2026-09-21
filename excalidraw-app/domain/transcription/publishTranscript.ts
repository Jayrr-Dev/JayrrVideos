import { conversationFor, resetConversation } from "./conversationContext";

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
  if (!feed.turns.length && feeds.get(feed.sourceId)?.turns.length) {
    resetConversation(feed.sourceId);
  }
  conversationFor(feed.sourceId).ingest(feed.turns);
  feeds.set(feed.sourceId, feed);
  notify();
};

export const clearTranscript = (sourceId: string) => {
  resetConversation(sourceId);
  if (!feeds.has(sourceId)) {
    return;
  }
  feeds.delete(sourceId);
  notify();
};

export const dropTranscriptTurns = (
  sourceId: string,
  turnIds: readonly string[],
) => {
  if (turnIds.length === 0) {
    return;
  }
  conversationFor(sourceId).drop(turnIds);
  const feed = feeds.get(sourceId);
  if (!feed) {
    return;
  }
  const drop = new Set(turnIds);
  const turns = feed.turns.filter((turn) => !drop.has(turn.id));
  if (turns.length === feed.turns.length) {
    return;
  }
  if (turns.length === 0) {
    feeds.delete(sourceId);
    notify();
    return;
  }
  feeds.set(sourceId, {
    ...feed,
    turns,
    text: turns
      .filter((turn) => turn.isFinal)
      .map((turn) => turn.text)
      .join("\n"),
  });
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
