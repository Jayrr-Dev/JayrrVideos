import { useChat } from "@ai-sdk/react";
import { useAuthToken } from "@convex-dev/auth/react";
import {
  DefaultChatTransport,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  type ChatOnToolCallCallback,
  type UIMessage,
} from "ai";
import { useConvexAuth } from "convex/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Button, useExcalidrawAPI } from "@excalidraw/excalidraw";

import {
  EraserIcon,
  aiIcon,
  helpIcon,
} from "@excalidraw/excalidraw/components/icons";

import { Tooltip } from "../components/ui";
import { convexSiteUrl } from "../convexClient";

import {
  applyCanvasTool,
  ensureCanvasFontsLoaded,
  isCanvasToolName,
} from "./applyCanvasTools";
import { getCanvasSnapshot } from "./canvasContext";

import "./JayrrAiChat.scss";

const SendPlaneIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3.4 11.6 21 4 13.4 20.6l-2.3-7.1z" />
    <path d="M21 4 11.1 13.5" />
  </svg>
);

const StopSquareIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="currentColor"
  >
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export const JAYRR_AI_TAB = "jayrrAi";

const HISTORY_KEY = "jayrr-ai-chat-v1";
const SUGGESTIONS = [
  "Storyboard this scene",
  "Lay out the next slides",
  "Turn this into a flowchart",
] as const;

type ChatHistory = {
  messages: UIMessage[];
  draft: string;
  aliases: Array<[string, string]>;
};

function loadHistory(): ChatHistory {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return { messages: [], draft: "", aliases: [] };
    }
    const parsed = JSON.parse(raw) as Partial<ChatHistory>;
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      draft: typeof parsed.draft === "string" ? parsed.draft : "",
      aliases: Array.isArray(parsed.aliases) ? parsed.aliases : [],
    };
  } catch {
    return { messages: [], draft: "", aliases: [] };
  }
}

function messageText(message: UIMessage) {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
}

function hasVisibleParts(message: UIMessage | undefined) {
  if (!message || message.role !== "assistant") {
    return false;
  }
  return message.parts.some(
    (part) =>
      (isTextUIPart(part) && part.text.trim().length > 0) ||
      (isReasoningUIPart(part) && part.text.trim().length > 0) ||
      isToolUIPart(part),
  );
}

function thinkingLabel(status: string, last: UIMessage | undefined) {
  if (status === "submitted") {
    return "Jayrr is thinking…";
  }
  const streamingTool = last?.parts.some(
    (part) => isToolUIPart(part) && part.state === "input-streaming",
  );
  return streamingTool ? "Jayrr is drawing…" : "Jayrr is writing…";
}

function toolLabel(name: string, state: string) {
  const verbs: Record<string, { busy: string; done: string }> = {
    use_skeleton: { busy: "Stamping a layout…", done: "Stamped a layout" },
    create_shapes: { busy: "Drawing shapes…", done: "Drew shapes" },
    update_shapes: { busy: "Updating shapes…", done: "Updated shapes" },
    delete_shapes: { busy: "Erasing shapes…", done: "Erased shapes" },
    clear_page: { busy: "Clearing the board…", done: "Board cleared" },
  };
  const meta = verbs[name] ?? { busy: "Working…", done: "Done" };
  return state === "output-available" ? meta.done : meta.busy;
}

const AI_INFO =
  "Jayrr can see this board and draw on it. Enter sends; Shift+Enter adds a line. Eraser clears chat, not the board.";

function ToolChip({
  name,
  state,
  error,
}: {
  name: string;
  state: string;
  error?: string;
}) {
  const tone = error ? "error" : state === "output-available" ? "done" : "busy";
  return (
    <div className={`jayrr-ai-chip jayrr-ai-chip--${tone}`} title={error}>
      {error ?? toolLabel(name, state)}
    </div>
  );
}

function AssistantMarkdown({ text }: { text: string }) {
  return <div className="jayrr-ai-md">{text}</div>;
}

function AssistantTurn({
  message,
  boardErrors,
  live,
}: {
  message: UIMessage;
  boardErrors: ReadonlyMap<string, string>;
  live?: boolean;
}) {
  const rows: ReactNode[] = [];
  message.parts.forEach((part, index) => {
    if (isTextUIPart(part) && part.text.trim()) {
      rows.push(<AssistantMarkdown key={`t${index}`} text={part.text} />);
      return;
    }
    if (isReasoningUIPart(part) && (part.text.trim() || live)) {
      rows.push(
        <div key={`r${index}`} className="jayrr-ai-reason">
          {live ? "Thinking… " : "Thoughts "}
          {part.text}
        </div>,
      );
      return;
    }
    if (isToolUIPart(part)) {
      const name =
        part.type === "dynamic-tool"
          ? part.toolName
          : part.type.startsWith("tool-")
          ? part.type.slice("tool-".length)
          : part.type;
      rows.push(
        <ToolChip
          key={`p${index}`}
          name={name}
          state={part.state}
          error={boardErrors.get(part.toolCallId)}
        />,
      );
    }
  });
  if (rows.length === 0) {
    return null;
  }
  return <div className="jayrr-ai-assistant">{rows}</div>;
}

export const JayrrAiChat = () => {
  if (!convexSiteUrl) {
    return (
      <div className="layer-ui__library jayrr-ai">
        <div className="jayrr-ai__header">
          <h2 className="jayrr-ai__title">Canvas AI</h2>
        </div>
        <div className="library-menu-items__no-items">
          <div className="library-menu-items__no-items__label">
            AI needs Convex
          </div>
          <div className="library-menu-items__no-items__hint">
            Add VITE_CONVEX_URL, then restart the app.
          </div>
        </div>
      </div>
    );
  }

  return <JayrrAiChatSession />;
};

const JayrrAiChatSession = () => {
  const api = useExcalidrawAPI();
  const token = useAuthToken();
  const { isAuthenticated } = useConvexAuth();
  const [input, setInput] = useState(() => loadHistory().draft);
  const [boardErrors, setBoardErrors] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const [infoError, setInfoError] = useState<string | null>(null);
  const aliases = useRef(new Map(loadHistory().aliases));
  const scroller = useRef<HTMLDivElement>(null);
  const initial = useRef(loadHistory().messages);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${convexSiteUrl}/ai/chat`,
        headers: token
          ? () => ({ Authorization: `Bearer ${token}` })
          : undefined,
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...body,
            messages,
            canvas: api ? getCanvasSnapshot(api) : null,
          },
        }),
      }),
    [api, token],
  );

  const { messages, sendMessage, setMessages, status, error, stop } =
    useChat<UIMessage>({
      messages: initial.current,
      throttle: 250,
      transport,
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
      onError: (err: Error) => {
        setInfoError(err.message || "Chat request failed");
      },
      async onToolCall({
        toolCall,
      }: Parameters<ChatOnToolCallCallback<UIMessage>>[0]) {
        if (toolCall.dynamic) {
          return;
        }
        if (!isCanvasToolName(toolCall.toolName)) {
          return;
        }
        const fail = (reason: string) => {
          setBoardErrors((prev) =>
            new Map(prev).set(toolCall.toolCallId, reason),
          );
          api?.setToast({ message: reason, closable: true });
        };
        if (!api) {
          fail("Canvas is still loading");
          return;
        }
        try {
          await applyCanvasTool(
            api,
            toolCall.toolName,
            toolCall.input,
            aliases.current,
          );
        } catch (err) {
          fail(err instanceof Error ? err.message : "Tool failed");
        }
      },
    });

  const busy = status === "submitted" || status === "streaming";
  const last = messages.at(-1);
  const showThinking = busy && !hasVisibleParts(last);

  useEffect(() => {
    if (api) {
      void ensureCanvasFontsLoaded();
    }
  }, [api]);

  useEffect(() => {
    try {
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify({
          messages,
          draft: input,
          aliases: [...aliases.current],
        } as ChatHistory),
      );
    } catch {
      // ignore quota
    }
  }, [messages, input]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, showThinking]);

  const submit = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value || busy) {
        return;
      }
      if (!isAuthenticated || !token) {
        setInfoError("Sign in to use canvas AI.");
        return;
      }
      if (!convexSiteUrl) {
        setInfoError("Convex is not linked.");
        return;
      }
      setInfoError(null);
      void sendMessage({ text: value });
      setInput("");
    },
    [busy, isAuthenticated, sendMessage, token],
  );

  const clearChat = () => {
    void stop();
    setMessages([]);
    setInput("");
    setBoardErrors(new Map());
    aliases.current = new Map();
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // ignore
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit(input);
    }
  };

  return (
    <div className="layer-ui__library jayrr-ai">
      <div className="jayrr-ai__header">
        <h2 className="jayrr-ai__title">
          Canvas AI
          <Tooltip label={AI_INFO} long>
            <span className="jayrr-ai-info" aria-label="About canvas AI">
              {helpIcon}
            </span>
          </Tooltip>
        </h2>
        <p className="visually-hidden">{AI_INFO}</p>
        <Button
          type="button"
          onSelect={clearChat}
          disabled={messages.length === 0 && !error}
          title="Clear chat"
          aria-label="Clear chat"
          className="jayrr-ai__icon-btn"
        >
          {EraserIcon}
        </Button>
      </div>

      <div
        ref={scroller}
        className="jayrr-ai__transcript"
        role="log"
        aria-label="Canvas AI conversation"
      >
        {messages.length === 0 ? (
          <div className="jayrr-ai__empty">
            <span className="jayrr-ai__empty-icon">{aiIcon}</span>
            <p>Ask Jayrr to draw on this board</p>
            <p className="jayrr-ai__hint">
              Storyboards, slides, and flows land on the canvas.
            </p>
            <div className="jayrr-ai__suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={busy}
                  onClick={() => submit(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message: UIMessage) => {
            if (message.role === "user") {
              const text = messageText(message);
              if (!text) {
                return null;
              }
              return (
                <div key={message.id} className="jayrr-ai-user">
                  {text}
                </div>
              );
            }
            return (
              <AssistantTurn
                key={message.id}
                message={message}
                boardErrors={boardErrors}
                live={busy && message.id === last?.id}
              />
            );
          })
        )}
        {showThinking ? (
          <div className="jayrr-ai-chip jayrr-ai-chip--busy">
            {thinkingLabel(status, last)}
          </div>
        ) : null}
        {error || infoError ? (
          <div className="jayrr-ai-error">{infoError ?? error?.message}</div>
        ) : null}
      </div>

      <form
        className="jayrr-ai__composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit(input);
        }}
      >
        <div className="jayrr-ai__composer-box">
          <textarea
            value={input}
            rows={1}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={busy ? "Jayrr is busy…" : "Ask or draw…"}
            aria-label="Message canvas AI"
          />
          {busy ? (
            <Button
              type="button"
              onSelect={() => void stop()}
              title="Stop"
              aria-label="Stop"
              className="jayrr-ai__send"
            >
              {StopSquareIcon}
            </Button>
          ) : (
            <Button
              type="submit"
              onSelect={() => submit(input)}
              disabled={!input.trim()}
              title="Send"
              aria-label="Send"
              className="jayrr-ai__send"
            >
              {SendPlaneIcon}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};
