/**
 * A Score level. Plain text, or `what` plus a few `examples` when the model
 * keeps splitting between neighbouring levels (see TypeSafe "Structured level
 * descriptions").
 */
export type JevScoreLevel = string | { what: string; examples: string[] };

/** Plain text, or named text fields so instructions can point at one by name. */
export type JevState = string | Record<string, string>;

export type JevQuestion =
  | {
      id: string;
      type: "noul";
      instructions: string;
      yes?: string;
      no?: string;
    }
  | {
      id: string;
      type: "choice";
      instructions: string;
      options: Record<string, string | null>;
    }
  | {
      id: string;
      type: "score";
      instructions: string;
      levels: JevScoreLevel[];
    };

export type JevEvaluateArgs = {
  state: JevState;
  questions: JevQuestion[];
};

export type JevAnswer =
  | { id: string; type: "noul"; noul: number }
  | {
      id: string;
      type: "choice";
      choice: string;
      probabilities: Record<string, number>;
      confidence: number;
    }
  | {
      id: string;
      type: "score";
      score: number;
      legend: Record<string, string>;
      probabilities: Record<string, number>;
      confidence: number;
    };

export type JevEvaluateResult = {
  ok: true;
  model: string;
  answers: JevAnswer[];
  usage?: { input_tokens: number; output_tokens: number };
};

type TypeSafeQuestionBody =
  | {
      type: "noul";
      instructions: string;
      criteria?: { true: string; false: string };
    }
  | {
      type: "choice";
      instructions: string;
      criteria: Record<string, string | null>;
    }
  | { type: "score"; instructions: string; criteria: JevScoreLevel[] };

type TypeSafeResponse = {
  model?: string;
  answers?: Record<string, Record<string, unknown>>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const DEFAULT_MODEL = "jev-latest";
const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = 300;
const RETRY_MAX_MS = 4000;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_SCORE_LEVELS = 10;

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Jev returned an invalid ${label}.`);
  }
  return value;
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Jev returned an invalid ${label}.`);
  }
  return value;
}

function requireNumberRecord(value: unknown, label: string) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Jev returned an invalid ${label}.`);
  }
  const record: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    record[key] = requireNumber(entry, `${label}.${key}`);
  }
  return record;
}

/** Legend echoes our levels; structured levels come back as objects. */
function legendText(value: unknown, label: string): string {
  if (typeof value === "string") {
    return value;
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const what = (value as { what?: unknown }).what;
    if (typeof what === "string" && what.length > 0) {
      return what;
    }
  }
  throw new Error(`Jev returned an invalid ${label}.`);
}

function requireLegend(value: unknown, label: string) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Jev returned an invalid ${label}.`);
  }
  const record: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    record[key] = legendText(entry, `${label}.${key}`);
  }
  return record;
}

function levelIsBlank(level: JevScoreLevel) {
  return typeof level === "string"
    ? level.trim().length === 0
    : level.what.trim().length === 0;
}

export function toTypeSafeQuestions(questions: JevQuestion[]) {
  const seen = new Set<string>();
  const body: Record<string, TypeSafeQuestionBody> = {};

  if (questions.length === 0) {
    throw new Error("Ask Jev at least one question.");
  }

  for (const question of questions) {
    const id = question.id.trim();
    if (!id) {
      throw new Error("Each Jev question needs an id.");
    }
    if (seen.has(id)) {
      throw new Error(`Duplicate Jev question id "${id}".`);
    }
    seen.add(id);

    if (question.type === "noul") {
      const criteria =
        question.yes || question.no
          ? {
              true: question.yes ?? "Yes",
              false: question.no ?? "No",
            }
          : undefined;
      body[id] = {
        type: "noul",
        instructions: question.instructions,
        ...(criteria ? { criteria } : {}),
      };
      continue;
    }

    if (question.type === "choice") {
      if (Object.keys(question.options).length < 2) {
        throw new Error(`Choice "${id}" needs at least two options.`);
      }
      body[id] = {
        type: "choice",
        instructions: question.instructions,
        criteria: question.options,
      };
      continue;
    }

    if (question.levels.length < 2) {
      throw new Error(`Score "${id}" needs at least two levels.`);
    }
    if (question.levels.length > MAX_SCORE_LEVELS) {
      throw new Error(
        `Score "${id}" allows at most ${MAX_SCORE_LEVELS} levels.`,
      );
    }
    if (question.levels.some(levelIsBlank)) {
      throw new Error(`Score "${id}" has an empty level.`);
    }
    body[id] = {
      type: "score",
      instructions: question.instructions,
      criteria: question.levels,
    };
  }

  return body;
}

function parseAnswers(
  questions: JevQuestion[],
  answers: Record<string, Record<string, unknown>>,
): JevAnswer[] {
  return questions.map((question) => {
    const answer = answers[question.id];
    if (!answer) {
      throw new Error(`Jev omitted an answer for "${question.id}".`);
    }

    if (question.type === "noul") {
      return {
        id: question.id,
        type: "noul" as const,
        noul: requireNumber(answer.noul, `${question.id}.noul`),
      };
    }

    if (question.type === "choice") {
      return {
        id: question.id,
        type: "choice" as const,
        choice: requireString(answer.choice, `${question.id}.choice`),
        probabilities: requireNumberRecord(
          answer.probabilities,
          `${question.id}.probabilities`,
        ),
        confidence: requireNumber(
          answer.confidence,
          `${question.id}.confidence`,
        ),
      };
    }

    return {
      id: question.id,
      type: "score" as const,
      score: requireNumber(answer.score, `${question.id}.score`),
      legend: requireLegend(answer.legend, `${question.id}.legend`),
      probabilities: requireNumberRecord(
        answer.probabilities,
        `${question.id}.probabilities`,
      ),
      confidence: requireNumber(answer.confidence, `${question.id}.confidence`),
    };
  });
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Honour Retry-After when present, else exponential backoff with jitter. */
function retryDelayMs(response: Response, attempt: number) {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) {
    return Math.min(RETRY_MAX_MS, header * 1000);
  }
  const base = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (attempt - 1));
  return base / 2 + Math.random() * (base / 2);
}

async function postSystemOne(apiKey: string, body: string, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(TYPESAFE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
      signal: controller.signal,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Jev timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function callTypeSafeSystemOne(args: JevEvaluateArgs, live = false) {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("TypeSafe is not configured on the server.");
  }

  const body = JSON.stringify({
    state: args.state,
    model: DEFAULT_MODEL,
    questions: toTypeSafeQuestions(args.questions),
  });

  let lastError = "Jev request failed.";
  for (let attempt = 1; attempt <= (live ? 1 : MAX_ATTEMPTS); attempt += 1) {
    const response = await postSystemOne(apiKey, body, live ? 2000 : REQUEST_TIMEOUT_MS);

    if (response.status === 429 || response.status === 529) {
      lastError = `Jev is busy (${response.status}).`;
      if (live) { throw new Error(lastError); }
      await sleep(retryDelayMs(response, attempt));
      continue;
    }

    const text = await response.text();
    let parsed: TypeSafeResponse = {};
    try {
      parsed = text ? (JSON.parse(text) as TypeSafeResponse) : {};
    } catch {
      throw new Error("Jev returned a non-JSON response.");
    }

    if (!response.ok) {
      const detail =
        typeof parsed === "object" && parsed !== null
          ? JSON.stringify(parsed)
          : text;
      throw new Error(
        `Jev request failed (${response.status})${
          detail ? `: ${detail}` : "."
        }`,
      );
    }

    if (!parsed.answers) {
      throw new Error("Jev returned no answers.");
    }

    const result: JevEvaluateResult = {
      ok: true,
      model: parsed.model ?? DEFAULT_MODEL,
      answers: parseAnswers(args.questions, parsed.answers),
      usage:
        parsed.usage &&
        typeof parsed.usage.input_tokens === "number" &&
        typeof parsed.usage.output_tokens === "number"
          ? {
              input_tokens: parsed.usage.input_tokens,
              output_tokens: parsed.usage.output_tokens,
            }
          : undefined,
    };
    return result;
  }

  throw new Error(lastError);
}
