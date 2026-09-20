"use node";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { v } from "convex/values";

import { internalAction } from "../_generated/server";

import { createCanvasTools } from "./createTools";
import { CANVAS_SYSTEM_PROMPT } from "./prompt";

import type { UIMessage } from "ai";

const MAX_STEPS = 30;
const DEFAULT_MODELS = [
  "deepseek/deepseek-v4-flash",
  "google/gemini-3.8-flash",
  "openai/gpt-oss-120b",
] as const;

type CanvasSnapshot = {
  pageId?: string;
  pageName?: string;
  shapeCount?: number;
  shapes?: Array<{ id: string }>;
};

function modelChain() {
  const fromList = process.env.OPENROUTER_MODELS?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const primary = process.env.OPENROUTER_MODEL?.trim();
  const fallbacks = process.env.OPENROUTER_FALLBACK_MODELS?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const chain = [
    ...(fromList ?? []),
    primary,
    ...(fallbacks ?? []),
    ...DEFAULT_MODELS,
  ].filter((value): value is string => Boolean(value));
  return [...new Set(chain)];
}

/**
 * OpenRouter + AI SDK need Node. HTTP actions run in Convex's isolate and
 * drop the UI stream after the first `start` event, so we finish the stream
 * here and hand the SSE body back.
 */
export const completeChat = internalAction({
  args: {
    messagesJson: v.string(),
    canvasJson: v.string(),
  },
  returns: v.string(),
  handler: async (_ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OpenRouter is not configured on the server.");
    }

    const messages = JSON.parse(args.messagesJson) as UIMessage[];
    const canvas = JSON.parse(args.canvasJson) as CanvasSnapshot | null;
    const unique = modelChain();
    const modelId = unique[0] ?? DEFAULT_MODELS[0];
    const modelFallbacks = unique.slice(1, 4);

    const modelMessages = await convertToModelMessages(messages);
    const openrouter = createOpenRouter({
      apiKey,
      compatibility: "strict",
    });

    const system = [
      CANVAS_SYSTEM_PROMPT,
      "",
      "Coordinate space: x increases right, y increases down. Origin is top-left.",
      "",
      "CANVAS SNAPSHOT (JSON):",
      JSON.stringify(canvas),
    ].join("\n");

    const result = streamText({
      model: openrouter(modelId, {
        provider: {
          allow_fallbacks: true,
          require_parameters: false,
        },
        models: modelFallbacks.length > 0 ? modelFallbacks : undefined,
        reasoning: { effort: "low" },
      }),
      system,
      messages: modelMessages,
      tools: createCanvasTools(canvas?.shapes?.map((shape) => shape.id) ?? []),
      stopWhen: stepCountIs(MAX_STEPS),
      temperature: 0.2,
      onError: ({ error }) => {
        console.warn(
          `[canvas-ai] stream error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      },
    });

    const streamResponse = result.toUIMessageStreamResponse({
      onError: (error) =>
        error instanceof Error ? error.message : "Canvas AI failed",
    });
    const sse = await streamResponse.text();
    if (!/"(text-delta|text|tool-|error|finish|reasoning)"/.test(sse)) {
      throw new Error(
        "OpenRouter returned an empty stream. Check OPENROUTER_MODEL and the API key.",
      );
    }
    return sse;
  },
});
