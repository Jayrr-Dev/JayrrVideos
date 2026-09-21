import { httpAction } from "../_generated/server";
import { api, internal } from "../_generated/api";

import { corsHeaders } from "../canvasAi/chatHttp";

type ChatRequestBody = {
  messages?: unknown[];
  editor?: unknown;
};

export const editorAiChatOptions = httpAction(async (_ctx, request) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
});

export const editorAiChat = httpAction(async (ctx, request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return Response.json(
      { error: "Sign in to use editor AI." },
      { status: 401, headers },
    );
  }

  const me = await ctx.runQuery(api.users.viewer, {});
  if (!me) {
    return Response.json(
      { error: "Sign in to use editor AI." },
      { status: 401, headers },
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OpenRouter is not configured on the server." },
      { status: 503, headers },
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers },
    );
  }

  const messages = body.messages ?? [];
  if (messages.length === 0) {
    return Response.json(
      { error: "messages is required." },
      { status: 400, headers },
    );
  }

  const editor = body.editor ?? null;

  let sse: string;
  try {
    sse = await ctx.runAction(internal.editorAi.chatNode.completeEditorChat, {
      messagesJson: JSON.stringify(messages),
      editorJson: JSON.stringify(editor),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Editor AI failed";
    return Response.json({ error: message }, { status: 500, headers });
  }

  return new Response(sse, {
    status: 200,
    headers: {
      ...headers,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "x-vercel-ai-ui-message-stream": "v1",
    },
  });
});
