import { useCallback, useEffect, useReducer, useState } from "react";

import { api, convexClient } from "../../convexClient";
import { conversationFor } from "./conversationContext";

import type { JevQuestion } from "../../../../convex/canvasAi/jevClient";
import type { TranscriptFeedTurn } from "./publishTranscript";
import type { TopicMemory } from "./conversationContext";

export const useConversationContext = (
  sourceId: string,
  enabled: boolean,
  turns: TranscriptFeedTurn[],
  root: React.RefObject<HTMLElement | null>,
) => {
  const context = conversationFor(sourceId);
  const [, refresh] = useReducer((value) => value + 1, 0);
  const [selectedTopic, selectTopic] = useState<string | null>(null);
  useEffect(() => context.subscribe(refresh), [context]);
  useEffect(() => { context.ingest(turns); }, [context, turns]);
  useEffect(() => {
    const ownerWindow = root.current?.ownerDocument.defaultView;
    if (!enabled || !ownerWindow) { return; }
    const tick = () => void context.summarize(async (input) => {
      if (!convexClient) { throw new Error("Convex is not connected."); }
      const bounded = { ...input, turns: input.turns.map((turn) => ({ ...turn, text: turn.text.slice(-4000) })) };
      const result = await convexClient.action(api.canvasAi.jev.summarizeConversation, { input: JSON.stringify(bounded) });
      return JSON.parse(result) as TopicMemory[];
    });
    const stop = context.subscribe(tick);
    const timer = ownerWindow.setInterval(tick, 1000);
    tick();
    return () => { stop(); ownerWindow.clearInterval(timer); };
  }, [context, enabled, root]);

  const evaluate = useCallback(async (text: string, turnId: string, questions: JevQuestion[]) => {
    if (!convexClient) { throw new Error("Convex is not connected."); }
    const request = context.prepare(text, turnId);
    const started = performance.now();
    try {
      const response = await convexClient.action(api.canvasAi.jev.contextual, {
        state: request.state, stamp: request.stamp, questions: [...questions, ...request.questions],
      });
      if (!context.current(response.stamp) || request.stamp.contextVersion !== context.version) {
        throw new Error("Stale conversation result");
      }
      const metadata = context.accept(request.stamp, response.result.answers);
      return { ...response.result, metadata, latencyMs: performance.now() - started };
    } catch (error) {
      if (request.ownsTopic) { context.release(request.key); }
      throw error;
    }
  }, [context]);

  const topicId = selectedTopic && context.topics.some((topic) => topic.id === selectedTopic) ? selectedTopic : context.activeTopic;
  return { context, evaluate, version: enabled ? context.version : 0, session: context.session, topicId, selectTopic };
};

export const ConversationIndicators = ({ conversation }: { conversation: ReturnType<typeof useConversationContext> }) => {
  const { context, topicId, selectTopic } = conversation;
  const latest = context.turns.at(-1);
  const result = latest ? context.results.get(latest.id) : undefined;
  return <div className="jayrr-called-embed__stack" aria-label="Conversation context">
    <label className="jayrr-called-embed__field">
      <span>Conversation topic</span>
      <select className="jayrr-called-embed__select" value={topicId ?? ""} onChange={(event) => selectTopic(event.target.value || null)}>
        <option value="">Follow active topic</option>
        {context.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}{topic.id === context.activeTopic ? " (active)" : ""}</option>)}
      </select>
    </label>
    <div className="jayrr-called-embed__chips">
      <span className="jayrr-called-embed__chip">{!result || result.provisional ? "Provisional" : result.contextVersion > 0 ? "Refined" : "Contextual"}</span>
      {result?.callbacks.map((id) => <span className="jayrr-called-embed__chip" key={id}>↩ {context.topics.find((topic) => topic.id === id)?.title ?? id}</span>)}
    </div>
    {context.summaryError ? <div className="jayrr-called-embed__hint">{context.summaryError}</div> : null}
  </div>;
};
