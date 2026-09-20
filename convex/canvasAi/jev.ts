"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { action, internalAction } from "../_generated/server";

import { callTypeSafeSystemOne } from "./jevClient";

import type { JevState } from "./jevClient";

// Jev loses accuracy on long, unrelated state; keep each field to a tail.
const MAX_STATE_CHARS = 4000;

const scoreLevelValidator = v.union(
  v.string(),
  v.object({ what: v.string(), examples: v.array(v.string()) }),
);

const stateValidator = v.union(v.string(), v.record(v.string(), v.string()));

const noulQuestion = v.object({
  id: v.string(),
  type: v.literal("noul"),
  instructions: v.string(),
  yes: v.optional(v.string()),
  no: v.optional(v.string()),
});

const choiceQuestion = v.object({
  id: v.string(),
  type: v.literal("choice"),
  instructions: v.string(),
  options: v.record(v.string(), v.union(v.string(), v.null())),
});

const scoreQuestion = v.object({
  id: v.string(),
  type: v.literal("score"),
  instructions: v.string(),
  levels: v.array(scoreLevelValidator),
});

const jevQuestionValidator = v.union(
  noulQuestion,
  choiceQuestion,
  scoreQuestion,
);

const noulAnswer = v.object({
  id: v.string(),
  type: v.literal("noul"),
  noul: v.number(),
});

const choiceAnswer = v.object({
  id: v.string(),
  type: v.literal("choice"),
  choice: v.string(),
  probabilities: v.record(v.string(), v.number()),
  confidence: v.number(),
});

const scoreAnswer = v.object({
  id: v.string(),
  type: v.literal("score"),
  score: v.number(),
  legend: v.record(v.string(), v.string()),
  probabilities: v.record(v.string(), v.number()),
  confidence: v.number(),
});

const evaluateResult = v.object({
  ok: v.literal(true),
  model: v.string(),
  answers: v.array(v.union(noulAnswer, choiceAnswer, scoreAnswer)),
  usage: v.optional(
    v.object({
      input_tokens: v.number(),
      output_tokens: v.number(),
    }),
  ),
});

const classifierClass = v.object({
  id: v.string(),
  name: v.string(),
  hint: v.optional(v.string()),
});

/** Trim state to what Jev can use; drop empty fields. Null when nothing is left. */
function trimState(state: JevState): JevState | null {
  if (typeof state === "string") {
    const text = state.trim();
    return text ? text.slice(-MAX_STATE_CHARS) : null;
  }
  const trimmed: Record<string, string> = {};
  for (const [key, value] of Object.entries(state)) {
    const text = value.trim();
    if (text) {
      trimmed[key] = text.slice(-MAX_STATE_CHARS);
    }
  }
  return Object.keys(trimmed).length > 0 ? trimmed : null;
}

/**
 * Server-only TypeSafe / Jev evaluation. Canvas AI calls this from ask_jev.
 */
export const evaluate = internalAction({
  args: {
    state: stateValidator,
    questions: v.array(jevQuestionValidator),
  },
  returns: evaluateResult,
  handler: async (_ctx, args) => {
    const state = trimState(args.state);
    if (!state) {
      throw new Error("Nothing to evaluate yet.");
    }
    return await callTypeSafeSystemOne({ state, questions: args.questions });
  },
});

/**
 * Widget classifier: one Jev choice over the user's class list.
 */
export const classify = action({
  args: {
    state: v.string(),
    instructions: v.string(),
    classes: v.array(classifierClass),
    includeOther: v.optional(v.boolean()),
  },
  returns: v.object({
    choice: v.string(),
    confidence: v.number(),
    probabilities: v.record(v.string(), v.number()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const options: Record<string, string | null> = {};
    for (const row of args.classes) {
      const id = row.id.trim();
      const name = row.name.trim();
      if (!id || !name) {
        continue;
      }
      const hint = row.hint?.trim();
      options[id] = hint || name;
    }
    if (args.includeOther) {
      options.other = "None of the other labels fit.";
    }
    if (Object.keys(options).length < 2) {
      throw new Error("Add at least two classes.");
    }
    const state = args.state.trim();
    if (!state) {
      throw new Error("Nothing to classify yet.");
    }
    const result = await callTypeSafeSystemOne({
      state: state.slice(-4000),
      questions: [
        {
          id: "label",
          type: "choice",
          instructions: args.instructions.trim() || "Which label fits this?",
          options,
        },
      ],
    });
    const answer = result.answers[0];
    if (!answer || answer.type !== "choice") {
      throw new Error("Jev did not return class scores.");
    }
    return {
      choice: answer.choice,
      confidence: answer.confidence,
      probabilities: answer.probabilities,
    };
  },
});

/**
 * Widget evaluation: several atomic questions over one state in a single Jev
 * call. Callers compose the answers in code (composite scoring, Noul gates).
 */
export const ask = action({
  args: {
    state: stateValidator,
    questions: v.array(jevQuestionValidator),
  },
  returns: evaluateResult,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const state = trimState(args.state);
    if (!state) {
      throw new Error("Nothing to evaluate yet.");
    }
    return await callTypeSafeSystemOne({ state, questions: args.questions });
  },
});
