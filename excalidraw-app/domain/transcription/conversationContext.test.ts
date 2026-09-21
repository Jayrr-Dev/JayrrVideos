import { describe, expect, it, vi } from "vitest";

import { validateTopicSummary } from "../../../convex/canvasAi/topicSummary";

import { ConversationContext, shortTopicTitle } from "./conversationContext";

import type { JevAnswer } from "../../../convex/canvasAi/jevClient";
import type { TopicMemory } from "./conversationContext";

const turn = (
  id: string,
  text = id,
  speaker: number | null = 0,
  isFinal = true,
) => ({ id, text, speaker, isFinal });
const choice = (id: string, probability = 0.95): JevAnswer[] => [
  {
    id: "context_topic",
    type: "choice",
    choice: id,
    probabilities: { [id]: probability },
    confidence: probability,
  },
  { id: "context_sufficient", type: "noul", noul: 0.95 },
];
const decide = (
  context: ConversationContext,
  id: string,
  topic: string,
  probability = 0.95,
  extra: JevAnswer[] = [],
) => {
  const text = context.turns.find((item) => item.id === id)!.text;
  const request = context.prepare(text, id);
  return context.accept(request.stamp, [
    ...choice(topic, probability),
    ...extra,
  ]);
};

describe("conversation topic memory", () => {
  it("shortens provisional titles instead of keeping a long speech slice", () => {
    expect(
      shortTopicTitle(
        "is going to happen when they have quote hip hop charter school",
      ),
    ).toBe("is going to happen when they…");
    expect(
      shortTopicTitle("Motivation for teaching vs industry earnings"),
    ).toBe("Motivation for teaching vs industry earnings");
    const context = new ConversationContext();
    context.ingest([
      turn(
        "a",
        "is going to happen when they have quote hip hop charter school tomorrow",
      ),
    ]);
    decide(context, "a", "new");
    expect(context.topics[0].title).toBe("is going to happen when they…");
  });

  it("distinguishes the same sentence using attributed preceding speech", () => {
    const first = new ConversationContext();
    const second = new ConversationContext();
    first.ingest([
      turn("a", "Did you enjoy the holiday?", 0),
      turn("b", "Great.", 1),
    ]);
    second.ingest([
      turn("a", "Your flight has been cancelled.", 0),
      turn("b", "Great.", 1),
    ]);
    const happy = first.prepare("Great.", "b").state;
    const sarcastic = second.prepare("Great.", "b").state;
    expect(happy.utterance).toBe(sarcastic.utterance);
    expect(happy.previous_text).not.toBe(sarcastic.previous_text);
    expect(sarcastic.recent_turns).toContain("speaker 0");
    expect(sarcastic.speaker).toBe("1");
  });

  it("stores each speaker separately and still shares conversation topics", () => {
    const context = new ConversationContext();
    context.ingest([
      turn("a", "Our holiday to Paris", 0),
      turn("b", "The office budget is tight", 1),
      turn("c", "Paris was worth it", 0),
    ]);
    const holiday = decide(context, "a", "new").topicId!;
    decide(context, "b", "new");
    decide(context, "c", holiday);
    expect(context.speakers.get("0")?.turnIds).toEqual(["a", "c"]);
    expect(context.speakers.get("1")?.turnIds).toEqual(["b"]);
    const state = context.prepare("Paris was worth it", "c").state;
    expect(state.speaker_recent).toContain("Our holiday to Paris");
    expect(state.speaker_recent).not.toContain("office budget");
    expect(state.recent_turns).toContain("office budget");
    expect(state.speaker_topics).toContain(holiday);
    expect(state.active_topic).toContain(holiday);
  });

  it("retains earlier topics when a callback does not switch the main subject", () => {
    const context = new ConversationContext();
    context.ingest([turn("a", "Our holiday to Paris")]);
    const holiday = decide(context, "a", "new").topicId!;
    context.ingest([turn("b", "Now our budget for the office")]);
    const budget = decide(context, "b", "new").topicId!;
    context.ingest([turn("c", "The office costs as much as that Paris trip")]);
    const result = decide(context, "c", budget, 0.95, [
      { id: `callback_${holiday}`, type: "noul", noul: 0.95 },
    ]);
    expect(result.callbacks).toEqual([holiday]);
    expect(context.activeTopic).toBe(budget);
    context.ingest([turn("d", "Back to the Paris holiday")]);
    expect(decide(context, "d", holiday).topicId).toBe(holiday);
    expect(context.topics).toHaveLength(2);
  });

  it("requires two consecutive final turns for a moderate-confidence transition", () => {
    const context = new ConversationContext();
    context.ingest([turn("a")]);
    expect(decide(context, "a", "new", 0.75).topicId).toBeNull();
    // Repeating the same turn is not corroboration.
    expect(decide(context, "a", "new", 0.75).topicId).toBeNull();
    context.ingest([turn("b")]);
    expect(decide(context, "b", "new", 0.75).topicId).not.toBeNull();
  });

  it("does not commit provisional partial speech or ambiguous final speech", () => {
    const context = new ConversationContext();
    context.ingest([turn("a", "Maybe", null, false)]);
    expect(decide(context, "a", "new").provisional).toBe(true);
    expect(context.topics).toHaveLength(0);
    context.ingest([turn("a", "Maybe", null)]);
    expect(decide(context, "a", "uncertain").topicId).toBeNull();
    expect(context.prepare("Maybe", "a").state.speaker).toBe("unknown");
  });

  it("rejects stale caption responses and responses from a previous session", () => {
    const context = new ConversationContext();
    context.ingest([turn("a", "I like it")]);
    const old = context.prepare("I like it", "a");
    context.ingest([turn("a", "I do not like it")]);
    expect(() => context.accept(old.stamp, choice("new"))).toThrow("Stale");
    const next = context.prepare("I do not like it", "a");
    context.reset();
    expect(() => context.accept(next.stamp, choice("new"))).toThrow("Stale");
  });

  it("shares topic work for duplicate consumers and allows a failed claim to retry", () => {
    const context = new ConversationContext();
    context.ingest([turn("a")]);
    const first = context.prepare("a", "a");
    expect(first.ownsTopic).toBe(true);
    expect(context.prepare("a", "a").questions).toEqual([]);
    context.release(first.key);
    expect(context.prepare("a", "a").ownsTopic).toBe(true);
  });

  it("updates live speech in place without notifying or bumping version", () => {
    const context = new ConversationContext();
    const notify = vi.fn();
    context.subscribe(notify);
    context.ingest([turn("live", "Process", 0, false)]);
    context.ingest([turn("live", "Process and the difficulty", 0, false)]);
    expect(context.version).toBe(0);
    expect(context.turns).toHaveLength(1);
    expect(context.turns[0]?.text).toBe("Process and the difficulty");
    expect(notify).not.toHaveBeenCalled();
    context.ingest([
      turn("live", "Process and the difficulty of getting that running", 0),
    ]);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("does not notify when only live speech changes next to existing finals", () => {
    const context = new ConversationContext();
    const notify = vi.fn();
    context.subscribe(notify);
    context.ingest([turn("a", "Done")]);
    expect(notify).toHaveBeenCalledTimes(1);
    context.ingest([turn("a", "Done"), turn("live", "Hello", 0, false)]);
    context.ingest([turn("a", "Done"), turn("live", "Hello there", 0, false)]);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(context.version).toBe(0);
  });

  it("keeps the last topic stamp when a final caption is corrected", () => {
    const context = new ConversationContext();
    context.ingest([turn("a", "Our holiday to Paris")]);
    const topicId = decide(context, "a", "new").topicId!;
    context.ingest([turn("a", "Our holiday to Paris in June")]);
    expect(context.results.get("a")?.topicId).toBe(topicId);
    expect(context.results.get("a")?.provisional).toBe(true);
    expect(context.turnInTopic("a", topicId)).toBe(true);
  });

  it("keeps 200 turns independently of an 80-bubble feed and caps topics at 100", () => {
    const context = new ConversationContext();
    for (let i = 0; i < 220; i++) {
      context.ingest([turn(String(i))]);
      decide(context, String(i), "new");
    }
    expect(context.turns).toHaveLength(200);
    expect(context.topics).toHaveLength(100);
    const state = context.prepare("219", "219").state;
    expect(state.recent_turns.split("\n")).toHaveLength(6);
    expect(state.earlier_topics.split("\n").length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(state).length).toBeLessThan(14000);
  });

  it("retrieves a lexical callback after many intervening topics", () => {
    const context = new ConversationContext();
    context.ingest([turn("paris", "Paris holiday hotel")]);
    const paris = decide(context, "paris", "new").topicId!;
    for (let i = 0; i < 20; i++) {
      context.ingest([turn(`${i}`, `Unrelated subject ${i}`)]);
      decide(context, `${i}`, "new");
    }
    context.ingest([turn("callback", "That Paris hotel again")]);
    expect(
      context.prepare("That Paris hotel again", "callback").state
        .earlier_topics,
    ).toContain(paris);
  });

  it("does not let an older result change the current active topic", () => {
    const context = new ConversationContext();
    context.ingest([turn("a"), turn("b")]);
    const latest = decide(context, "b", "new").topicId;
    decide(context, "a", "new");
    expect(context.activeTopic).toBe(latest);
  });

  it("coalesces summary calls and preserves memory on failure", async () => {
    const context = new ConversationContext();
    context.ingest([turn("a")], 0);
    decide(context, "a", "new");
    let resolve!: (value: TopicMemory[]) => void;
    const run = vi.fn(
      () =>
        new Promise<TopicMemory[]>((done) => {
          resolve = done;
        }),
    );
    const pending = context.summarize(run, 10000);
    await context.summarize(run, 10001);
    expect(run).toHaveBeenCalledTimes(1);
    resolve(
      context.topics.map((topic) => ({
        ...topic,
        summary: "Speaker 0 discussed a.",
      })),
    );
    await pending;
    context.ingest([turn("b")], 11000);
    decide(context, "b", context.activeTopic!);
    await context.summarize(async () => {
      throw new Error("Unavailable");
    }, 22000);
    expect(context.topics[0].summary).toBe("Speaker 0 discussed a.");
    expect(context.summaryError).toContain("unavailable");
  });

  it("discards summaries after a caption correction or session reset", async () => {
    for (const reset of [true, false]) {
      const context = new ConversationContext();
      context.ingest([turn("a")]);
      decide(context, "a", "new");
      let resolve!: (value: TopicMemory[]) => void;
      const pending = context.summarize(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      const snapshot = context.topics.map((topic) => ({
        ...topic,
        summary: "stale",
      }));
      if (reset) {
        context.reset();
      } else {
        context.ingest([turn("a", "Correction")]);
      }
      resolve(snapshot);
      await pending;
      expect(context.topics.some((topic) => topic.summary === "stale")).toBe(
        false,
      );
    }
  });

  it("does not leak later summary evidence into an earlier utterance", async () => {
    const context = new ConversationContext();
    context.ingest([turn("a", "Our plan")]);
    const id = decide(context, "a", "new").topicId!;
    context.ingest([turn("b", "We cancelled the plan")]);
    decide(context, "b", id);
    await context.summarize(async ({ topics }) =>
      topics.map((topic) => ({ ...topic, summary: "The plan was cancelled." })),
    );
    expect(context.prepare("Our plan", "a").state.active_topic).not.toContain(
      "cancelled",
    );
    expect(
      context.prepare("We cancelled the plan", "b").state.active_topic,
    ).toContain("cancelled");
  });

  it("rejects invented, duplicate, and omitted summary topics or source references", () => {
    const topic: TopicMemory = {
      id: "topic-1",
      title: "Holiday",
      summary: "",
      entities: [],
      unresolved: [],
      turnIds: ["a"],
    };
    const input = {
      topics: [topic],
      turns: [{ ...turn("a"), revision: 1, sequence: 1 }],
    };
    expect(validateTopicSummary({ topics: [topic] }, input)).toEqual([topic]);
    expect(() =>
      validateTopicSummary(
        { topics: [{ ...topic, turnIds: ["invented"] }] },
        input,
      ),
    ).toThrow();
    expect(() =>
      validateTopicSummary({ topics: [topic, topic] }, input),
    ).toThrow();
    expect(() => validateTopicSummary({ topics: [] }, input)).toThrow();
    expect(() =>
      validateTopicSummary({ topics: [{ ...topic, id: "invented" }] }, input),
    ).toThrow();
  });
});
