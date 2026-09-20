import { tool } from "ai";
import { z } from "zod";

import { callTypeSafeSystemOne } from "./jevClient";
import { createElementSchema, updateElementSchema } from "./schemas";
import { buildCanvasSkeleton, CANVAS_SKELETON_KINDS } from "./skeletons";

function withWarnings<T extends object>(result: T, warnings: string[]) {
  return warnings.length > 0 ? { ...result, warnings } : result;
}

const jevQuestionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z
      .string()
      .min(1)
      .describe("Your key for this answer, e.g. layout_kind."),
    type: z.literal("noul"),
    instructions: z
      .string()
      .describe(
        "One yes/no gut-check, e.g. Does this board already show a timeline?",
      ),
    yes: z.string().optional().describe("What a yes (near 1) means."),
    no: z.string().optional().describe("What a no (near 0) means."),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("choice"),
    instructions: z
      .string()
      .describe("Pick one option, e.g. Which skeleton fits this request?"),
    options: z
      .record(z.string(), z.string().nullable())
      .describe(
        "Map of option id to a short rubric, or null. At least two options.",
      ),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("score"),
    instructions: z
      .string()
      .describe(
        "Rate the state on ordered levels, e.g. How crowded is this board?",
      ),
    levels: z
      .array(z.string())
      .min(2)
      .max(10)
      .describe("Ordered rubric labels, lowest first."),
  }),
]);

/**
 * Canvas tools for one chat request. The board lives in the browser, so the
 * client applies each call the moment its input arrives; `execute` only
 * acknowledges on the server so the model keeps streaming.
 * `ask_jev` is the exception: it calls TypeSafe on the server and returns answers.
 */
export function createCanvasTools(knownIds: Iterable<string> = []) {
  const known = new Set(knownIds);

  return {
    use_skeleton: tool({
      description:
        "Stamp a ready-made layout skeleton in one call. Then fill labels with update_shapes. Do not redraw the same layout with create_shapes after stamping.",
      inputSchema: z.object({
        kind: z
          .enum(CANVAS_SKELETON_KINDS)
          .describe(
            "bar_chart, cash_flow, steps, comparison, timeline, progress, flowchart, decision, loop, line_chart (trend), waterfall (start / in / out / end), split (needs-wants-save), accounts (cards), table (budget vs actual rows).",
          ),
        originX: z
          .number()
          .optional()
          .describe(
            "Left of the stamp. Default 80. Use empty space from the snapshot.",
          ),
        originY: z
          .number()
          .optional()
          .describe("Top of the stamp. Default 80."),
        slots: z
          .number()
          .min(3)
          .max(8)
          .optional()
          .describe(
            "How many bars, buckets, steps, rows, or dates. Default 5. Ignored for progress.",
          ),
        title: z
          .string()
          .optional()
          .describe("Board title. Placeholder if omitted."),
        prefix: z
          .string()
          .optional()
          .describe(
            'Prepended to every ref (e.g. "sep" → sep_title, sep_bar_1). Use when the board already has a skeleton of this kind.',
          ),
      }),
      execute: async (args) => {
        const built = buildCanvasSkeleton(args);
        const warnings: string[] = [];
        const refs: string[] = [];
        for (const ref of built.refs) {
          if (known.has(ref) || refs.includes(ref)) {
            warnings.push(
              `Ref "${ref}" is already taken; the board gave this element a random id. Pass a fresh prefix next time.`,
            );
            continue;
          }
          refs.push(ref);
          known.add(ref);
        }
        return withWarnings(
          {
            ok: true as const,
            kind: built.kind,
            count: built.elements.length,
            slots: built.slots,
            refs,
          },
          warnings,
        );
      },
    }),
    create_shapes: tool({
      description:
        "Draw ONE idea on the Excalidraw board: a title, one labeled box, one bar with its value, one arrow, one frame. Elements: rectangle/ellipse/diamond containers with labels, standalone text, sticky notes, arrows bound to shapes (from/to), lines (axes, dividers, timelines), frames that group children under a title. Refs become element ids and stay valid in later calls. Put shapes BEFORE the arrows and frames that reference them.",
      inputSchema: z.object({
        elements: z.array(createElementSchema).min(1).max(120),
      }),
      execute: async ({ elements }) => {
        const warnings: string[] = [];
        const refs: string[] = [];
        for (const element of elements) {
          if (!element.ref) {
            continue;
          }
          if (known.has(element.ref) || refs.includes(element.ref)) {
            warnings.push(
              `Ref "${element.ref}" is already taken; the board gave this element a random id. Use a fresh ref next time.`,
            );
            continue;
          }
          refs.push(element.ref);
          known.add(element.ref);
        }
        for (const element of elements) {
          if (element.type === "arrow") {
            for (const [side, target] of [
              ["from", element.from],
              ["to", element.to],
            ] as const) {
              if (target && !known.has(target)) {
                warnings.push(`Arrow "${side}" target "${target}" is unknown.`);
              }
            }
          } else if (element.type === "frame") {
            for (const child of element.children) {
              if (!known.has(child)) {
                warnings.push(
                  `Frame "${element.name}" child "${child}" is unknown.`,
                );
              }
            }
          }
        }
        return withWarnings(
          { ok: true as const, count: elements.length, refs },
          warnings,
        );
      },
    }),
    update_shapes: tool({
      description:
        "Move, resize, restyle, or relabel existing elements by id or ref. Bound arrows follow moved shapes. When you change text, also set w and h so the new letters fit; clipped labels are a bug.",
      inputSchema: z.object({
        elements: z.array(updateElementSchema).min(1).max(80),
      }),
      execute: async ({ elements }) => {
        const missing = elements
          .map((element) => element.id)
          .filter((id) => !known.has(id));
        return withWarnings(
          { ok: true as const, count: elements.length },
          missing.map((id) => `"${id}" is not on the board.`),
        );
      },
    }),
    delete_shapes: tool({
      description: "Delete elements by id or ref from the board.",
      inputSchema: z.object({
        ids: z.array(z.string()).min(1).max(120),
      }),
      execute: async ({ ids }) => {
        const missing = ids.filter((id) => !known.has(id));
        for (const id of ids) {
          known.delete(id);
        }
        return withWarnings(
          { ok: true as const, deleted: ids.length },
          missing.map((id) => `"${id}" is not on the board.`),
        );
      },
    }),
    clear_page: tool({
      description: "Delete every element on the board. Use only when asked.",
      inputSchema: z.object({
        confirm: z.literal(true),
      }),
      execute: async () => {
        known.clear();
        return { ok: true as const };
      },
    }),
    ask_jev: tool({
      description:
        "Ask Jev (TypeSafe System One) for structured judgments: noul (yes/no probability), choice (one option plus probabilities), score (rubric). Use when the next board decision is ambiguous — layout family, whether the request matches the current board, crowding, tone. Each question must be one atomic gut-check. Mix types in one call. Do not use Jev to write copy or draw.",
      inputSchema: z.object({
        state: z
          .string()
          .min(1)
          .describe(
            "Evidence only: the user request plus the relevant labels, ids, and layout facts. Do not dump the whole board.",
          ),
        questions: z
          .array(jevQuestionSchema)
          .min(1)
          .max(16)
          .describe(
            "Named questions evaluated in parallel against the same state.",
          ),
      }),
      execute: async ({ state, questions }) => {
        try {
          return await callTypeSafeSystemOne({
            state,
            questions,
          });
        } catch (error) {
          return {
            ok: false as const,
            error: error instanceof Error ? error.message : "Jev failed.",
          };
        }
      },
    }),
  };
}

export type CanvasTools = ReturnType<typeof createCanvasTools>;
