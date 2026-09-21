import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { api, convexClient } from "../../convexClient";

import { conversationFor, shortTopicTitle } from "./conversationContext";
import { debugTranscribe } from "./debugTranscribe";

import type { JevQuestion } from "../../../convex/canvasAi/jevClient";
import type { TopicMemory } from "./conversationContext";

export const useConversationContext = (
  sourceId: string,
  enabled: boolean,
  root: React.RefObject<HTMLElement | null>,
) => {
  const context = conversationFor(sourceId);
  const [, refresh] = useReducer((value) => value + 1, 0);
  const [selectedTopic, selectTopic] = useState<string | null>(null);
  useEffect(() => context.subscribe(refresh), [context]);
  useEffect(() => {
    const ownerWindow = root.current?.ownerDocument.defaultView;
    if (!enabled || !ownerWindow) {
      return;
    }
    const tick = () =>
      void context.summarize(async (input) => {
        if (!convexClient) {
          throw new Error("Convex is not connected.");
        }
        const bounded = {
          ...input,
          turns: input.turns.map((turn) => ({
            ...turn,
            text: turn.text.slice(-2000),
          })),
          topics: input.topics.map((topic) => ({
            ...topic,
            turnIds: [
              ...new Set([
                ...topic.turnIds.slice(-20),
                ...input.turns
                  .filter((turn) => topic.turnIds.includes(turn.id))
                  .map((turn) => turn.id),
              ]),
            ],
          })),
        };
        const result = await convexClient.action(
          api.canvasAi.jev.summarizeConversation,
          { input: JSON.stringify(bounded) },
        );
        return JSON.parse(result) as TopicMemory[];
      });
    const stop = context.subscribe(tick);
    const timer = ownerWindow.setInterval(tick, 1000);
    tick();
    return () => {
      stop();
      ownerWindow.clearInterval(timer);
    };
  }, [context, enabled, root]);

  const evaluate = useCallback(
    async (text: string, turnId: string, questions: JevQuestion[]) => {
      if (!convexClient) {
        throw new Error("Convex is not connected.");
      }
      const request = context.prepare(text, turnId);
      debugTranscribe("context prepare", {
        turnId: request.stamp.turnId,
        requested: turnId,
        revision: request.stamp.revision,
        version: request.stamp.contextVersion,
        ownsTopic: request.ownsTopic,
        text: text.slice(0, 120),
      });
      const started = Date.now();
      if (!questions.length && !request.questions.length) {
        return {
          ok: true as const,
          model: "jev-latest",
          answers: [],
          metadata: context.accept(request.stamp, []),
          latencyMs: 0,
        };
      }
      try {
        const response = await convexClient.action(
          api.canvasAi.jev.contextual,
          {
            state: request.state,
            stamp: request.stamp,
            questions: [...questions, ...request.questions],
          },
        );
        if (
          !context.current(response.stamp) ||
          request.stamp.contextVersion !== context.version
        ) {
          debugTranscribe("context stale", {
            turnId: request.stamp.turnId,
            sentVersion: request.stamp.contextVersion,
            nowVersion: context.version,
            current: context.current(response.stamp),
          });
          throw new Error("Stale conversation result");
        }
        const metadata = context.accept(request.stamp, response.result.answers);
        debugTranscribe("context done", {
          turnId: request.stamp.turnId,
          topicId: metadata.topicId,
          provisional: metadata.provisional,
          latencyMs: Date.now() - started,
        });
        return {
          ...response.result,
          metadata,
          latencyMs: Date.now() - started,
        };
      } catch (error) {
        if (request.ownsTopic) {
          context.release(request.key);
        }
        throw error;
      }
    },
    [context],
  );

  const topicId =
    selectedTopic && context.topics.some((topic) => topic.id === selectedTopic)
      ? selectedTopic
      : context.activeTopic;
  return {
    context,
    evaluate,
    version: enabled ? context.version : 0,
    session: context.session,
    topicId,
    selectTopic,
    selectedTopic,
  };
};

export const ConversationIndicators = ({
  conversation,
}: {
  conversation: ReturnType<typeof useConversationContext>;
}) => {
  const { context, selectedTopic, selectTopic } = conversation;
  const menu = useRef<HTMLDetailsElement>(null);
  const latest = context.turns.at(-1);
  const result = latest ? context.results.get(latest.id) : undefined;
  const active = context.topics.find(
    (topic) => topic.id === context.activeTopic,
  );
  const pinned = context.topics.find((topic) => topic.id === selectedTopic);
  const shown = pinned ?? active;
  const closeMenu = () => {
    if (menu.current) {
      menu.current.open = false;
    }
  };
  const pick = (id: string | null) => {
    selectTopic(id);
    closeMenu();
  };
  return (
    <div
      className="jayrr-called-embed__stack jayrr-called-embed__stack--compact"
      aria-label="Topic tracking"
    >
      <div className="jayrr-called-embed__field">
        <span>Conversation topic</span>
        <details ref={menu} className="jayrr-called-embed__topics">
          <summary className="jayrr-called-embed__select">
            {pinned
              ? shortTopicTitle(pinned.title)
              : `Active: ${
                  shown ? shortTopicTitle(shown.title) : "Detecting…"
                }`}
          </summary>
          <div className="jayrr-called-embed__topics-menu" role="listbox">
            <button
              type="button"
              role="option"
              aria-selected={!pinned}
              className={
                pinned
                  ? "jayrr-called-embed__topics-option"
                  : "jayrr-called-embed__topics-option is-on"
              }
              onClick={() => pick(null)}
            >
              Follow live
              {active ? ` · ${shortTopicTitle(active.title)}` : ""}
            </button>
            {context.topics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                role="option"
                aria-selected={pinned?.id === topic.id}
                className={
                  pinned?.id === topic.id
                    ? "jayrr-called-embed__topics-option is-on"
                    : "jayrr-called-embed__topics-option"
                }
                onClick={() => pick(topic.id)}
              >
                {shortTopicTitle(topic.title)}
                {topic.id === context.activeTopic ? " (active)" : ""}
              </button>
            ))}
          </div>
        </details>
      </div>
      {result && (!result.provisional || result.callbacks.length > 0) ? (
        <div className="jayrr-called-embed__chips">
          {result.provisional ? null : (
            <span className="jayrr-called-embed__chip">
              {result.refined ? "Refined" : "Contextual"}
            </span>
          )}
          {result.callbacks.map((id) => (
            <span className="jayrr-called-embed__chip" key={id}>
              ↩{" "}
              {shortTopicTitle(
                context.topics.find((topic) => topic.id === id)?.title ?? id,
              )}
            </span>
          ))}
        </div>
      ) : null}
      {context.summaryError ? (
        <div className="jayrr-called-embed__hint">{context.summaryError}</div>
      ) : null}
    </div>
  );
};
