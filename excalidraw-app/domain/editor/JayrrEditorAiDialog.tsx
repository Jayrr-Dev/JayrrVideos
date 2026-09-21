import { useChat } from "@ai-sdk/react";
import { useAuthToken } from "@convex-dev/auth/react";
import { helpIcon } from "@excalidraw/excalidraw/components/icons";
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
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Button } from "../../components/ui/Button";
import { Dialog, Tooltip } from "../../components/ui/editor";
import { convexSiteUrl } from "../../convexClient";
import { isCreateEditorClipInput } from "./applyEditorClipTool";
import {
  compositionDurationMs,
  wrapHyperframeComposition,
} from "./hyperframesClip";
import { useJayrrEditorSession } from "./JayrrEditorSession";

import "./JayrrEditorAiDialog.scss";

const INFO =
  "Ask Jayrr to make a timed HTML clip for this timeline. Enter sends; Shift+Enter adds a line.";

const SUGGESTIONS = [
  "Add a 4-second title card that says Launch day",
  "Create a lower-third intro clip",
] as const;

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

function toolLabel(name: string, state: string) {
  if (name === "create_clip") {
    return state === "output-available" ? "Added a clip" : "Creating a clip…";
  }
  return state === "output-available" ? "Done" : "Working…";
}

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
    <div className={`jayrr-editor-ai-chip jayrr-editor-ai-chip--${tone}`}>
      {error ?? toolLabel(name, state)}
    </div>
  );
}

function AssistantTurn({
  message,
  toolErrors,
  live,
}: {
  message: UIMessage;
  toolErrors: ReadonlyMap<string, string>;
  live?: boolean;
}) {
  const rows: ReactNode[] = [];
  message.parts.forEach((part, index) => {
    if (isTextUIPart(part) && part.text.trim()) {
      rows.push(
        <div key={`t${index}`} className="jayrr-editor-ai-md">
          {part.text}
        </div>,
      );
      return;
    }
    if (isReasoningUIPart(part) && (part.text.trim() || live)) {
      rows.push(
        <div key={`r${index}`} className="jayrr-editor-ai-reason">
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
          error={toolErrors.get(part.toolCallId)}
        />,
      );
    }
  });
  if (rows.length === 0) {
    return null;
  }
  return <div className="jayrr-editor-ai-assistant">{rows}</div>;
}

type JayrrEditorAiDialogProps = {
  onClose: () => void;
};

export const JayrrEditorAiDialog = ({ onClose }: JayrrEditorAiDialogProps) => {
  const descriptionId = useId();
  const token = useAuthToken();
  const { isAuthenticated } = useConvexAuth();
  const { clips, timeline, currentTimeMs, addHtmlClip, setSelectedClipIds } =
    useJayrrEditorSession();
  const [input, setInput] = useState("");
  const [infoError, setInfoError] = useState<string | null>(null);
  const [toolErrors, setToolErrors] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const scroller = useRef<HTMLDivElement>(null);

  const editorSnapshot = useMemo(
    () => ({
      currentTimeMs,
      totalMs: timeline.totalMs,
      clipCount: clips.length,
      clips: clips.map((clip) => ({
        id: clip.id,
        type: clip.type,
        label: clip.label,
        durationMs: clip.durationMs,
        laneId: clip.laneId ?? "sequence",
        startMs: clip.laneStartMs ?? 0,
      })),
    }),
    [clips, currentTimeMs, timeline.totalMs],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${convexSiteUrl}/ai/editor-chat`,
        headers: token
          ? () => ({ Authorization: `Bearer ${token}` })
          : undefined,
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...body,
            messages,
            editor: editorSnapshot,
          },
        }),
      }),
    [editorSnapshot, token],
  );

  const { messages, sendMessage, status, error, stop } = useChat<UIMessage>({
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
      if (toolCall.toolName !== "create_clip") {
        return;
      }
      if (!isCreateEditorClipInput(toolCall.input)) {
        setToolErrors((prev) =>
          new Map(prev).set(toolCall.toolCallId, "Clip spec was invalid."),
        );
        return;
      }
      const durationMs = compositionDurationMs(
        toolCall.input.html,
        toolCall.input.durationMs,
      );
      const html = wrapHyperframeComposition({
        html: toolCall.input.html,
        css: toolCall.input.css,
        width: toolCall.input.width,
        height: toolCall.input.height,
        durationMs,
        label: toolCall.input.label,
      });
      const clipId = addHtmlClip({
        label: toolCall.input.label,
        html,
        durationMs,
        width: toolCall.input.width,
        height: toolCall.input.height,
      });
      setSelectedClipIds([clipId]);
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const last = messages.at(-1);
  const showThinking = busy && !hasVisibleParts(last);

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
        setInfoError("Sign in to use editor AI.");
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
    <Dialog
      className="jayrr-editor-ai"
      size={560}
      onCloseRequest={() => {
        if (busy) {
          void stop();
        }
        onClose();
      }}
      title={
        <span className="jayrr-editor-ai__title-row">
          Editor AI
          <Tooltip label={INFO} long position="top">
            <span className="jayrr-editor-ai__info" aria-label="More info">
              {helpIcon}
            </span>
          </Tooltip>
        </span>
      }
    >
      <p id={descriptionId} className="visually-hidden">
        {INFO}
      </p>
      <div
        className="jayrr-editor-ai__body"
        aria-describedby={descriptionId}
      >
        <div
          ref={scroller}
          className="jayrr-editor-ai__transcript"
          role="log"
          aria-label="Editor AI conversation"
        >
          {messages.length === 0 ? (
            <div className="jayrr-editor-ai__empty">
              <p>Ask Jayrr to add a clip</p>
              <div className="jayrr-editor-ai__suggestions">
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
            messages.map((message) => {
              if (message.role === "user") {
                const text = messageText(message);
                if (!text) {
                  return null;
                }
                return (
                  <div key={message.id} className="jayrr-editor-ai-user">
                    {text}
                  </div>
                );
              }
              return (
                <AssistantTurn
                  key={message.id}
                  message={message}
                  toolErrors={toolErrors}
                  live={busy && message.id === last?.id}
                />
              );
            })
          )}
          {showThinking ? (
            <div className="jayrr-editor-ai-chip jayrr-editor-ai-chip--busy">
              Jayrr is thinking…
            </div>
          ) : null}
          {error || infoError ? (
            <div className="jayrr-editor-ai-error">
              {infoError ?? error?.message}
            </div>
          ) : null}
        </div>
        <form
          className="jayrr-editor-ai__composer"
          onSubmit={(event) => {
            event.preventDefault();
            submit(input);
          }}
        >
          <div className="jayrr-editor-ai__composer-box">
            <textarea
              value={input}
              rows={2}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={busy ? "Jayrr is busy…" : "Ask for a new clip…"}
              aria-label="Message editor AI"
            />
            {busy ? (
              <Button
                type="button"
                variant="ghost"
                title="Stop"
                aria-label="Stop"
                className="jayrr-editor-ai__send"
                onClick={() => void stop()}
              >
                {StopSquareIcon}
              </Button>
            ) : (
              <Button
                type="submit"
                variant="ghost"
                disabled={!input.trim()}
                title="Send"
                aria-label="Send"
                className="jayrr-editor-ai__send"
              >
                {SendPlaneIcon}
              </Button>
            )}
          </div>
        </form>
      </div>
    </Dialog>
  );
};
