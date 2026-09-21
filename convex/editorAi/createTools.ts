import { tool } from "ai";
import { z } from "zod";

export function createEditorTools() {
  return {
    create_clip: tool({
      description:
        "Add a new HyperFrames-style HTML clip to the current editor timeline.",
      inputSchema: z.object({
        label: z
          .string()
          .min(1)
          .max(80)
          .describe("Short name shown on the timeline."),
        durationMs: z
          .number()
          .int()
          .min(250)
          .max(60_000)
          .describe("Clip length in milliseconds."),
        html: z
          .string()
          .min(1)
          .max(80_000)
          .describe(
            "Inner HTML with class=clip nodes, data-start and data-duration in seconds. No script tags.",
          ),
        css: z
          .string()
          .max(20_000)
          .optional()
          .describe("Optional extra CSS for the composition."),
        width: z.number().int().min(320).max(3840).optional(),
        height: z.number().int().min(180).max(2160).optional(),
      }),
      execute: async (args) => ({
        ok: true as const,
        label: args.label,
        durationMs: args.durationMs,
      }),
    }),
  };
}
