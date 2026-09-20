import type { JevAnswer, JevQuestion } from "../../../../convex/canvasAi/jevClient";
import type { TranscriptFeedTurn } from "./publishTranscript";

export type TopicMemory = {
  id: string;
  title: string;
  summary: string;
  entities: string[];
  unresolved: string[];
  turnIds: string[];
};
type ContextTurn = TranscriptFeedTurn & { revision: number; sequence: number };
export type ContextStamp = {
  session: string;
  turnId: string;
  revision: number;
  contextVersion: number;
};
export type ContextResult = ContextStamp & {
  topicId: string | null;
  callbacks: string[];
  provisional: boolean;
};
export type SummaryInput = { turns: ContextTurn[]; topics: TopicMemory[] };
const words = (text: string) => new Set(text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
let sessionCounter = 0;

/** Session-only evidence. No labels or inferred personality enter model context. */
export class ConversationContext {
  session = `conversation-${++sessionCounter}`;
  version = 0;
  turns: ContextTurn[] = [];
  topics: TopicMemory[] = [];
  activeTopic: string | null = null;
  results = new Map<string, ContextResult>();
  listeners = new Set<() => void>();
  summaryError = "";
  private sequence = 0;
  private topicCounter = 0;
  private claims = new Set<string>();
  private pendingSwitch: { id: string; sequence: number; turnId: string } | null = null;
  private dirty = new Set<string>();
  private dirtySince = 0;
  private summaryRunning = false;
  private summaryUrgent = false;
  private retryAfter = 0;
  private lastDecisionSequence = -1;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private emit() { this.listeners.forEach((listener) => listener()); }

  reset() {
    this.session = `conversation-${++sessionCounter}`;
    this.turns = [];
    this.topics = [];
    this.results.clear();
    this.claims.clear();
    this.dirty.clear();
    this.activeTopic = null;
    this.pendingSwitch = null;
    this.lastDecisionSequence = -1;
    this.summaryError = "";
    this.summaryUrgent = false;
    this.retryAfter = 0;
    this.version++;
    this.emit();
  }

  ingest(incoming: TranscriptFeedTurn[], now = Date.now()) {
    let changed = false;
    for (const turn of incoming) {
      const old = this.turns.find((item) => item.id === turn.id);
      if (old && old.text === turn.text && old.speaker === turn.speaker && old.isFinal === turn.isFinal) { continue; }
      const next = { ...turn, revision: (old?.revision ?? 0) + 1, sequence: old?.sequence ?? ++this.sequence };
      if (old) {
        this.turns[this.turns.indexOf(old)] = next;
        this.results.delete(old.id);
        // A corrected source invalidates memories that incorporated its old text.
        for (const topic of this.topics) {
          if (topic.turnIds.includes(old.id)) { topic.summary = ""; topic.entities = []; topic.unresolved = []; }
        }
      } else { this.turns.push(next); }
      if (next.isFinal) {
        if (!this.dirty.size) { this.dirtySince = now; }
        this.dirty.add(next.id);
      }
      changed = true;
    }
    // Partial IDs may change on every ASR event. Retain only currently published partials.
    const ids = new Set(incoming.map((turn) => turn.id));
    this.turns = this.turns.filter((turn) => turn.isFinal || ids.has(turn.id));
    const finals = this.turns.filter((turn) => turn.isFinal).slice(-200);
    this.turns = [...finals, ...this.turns.filter((turn) => !turn.isFinal)].sort((a, b) => a.sequence - b.sequence);
    const retained = new Set(this.turns.map((turn) => turn.id));
    for (const id of this.results.keys()) { if (!retained.has(id)) { this.results.delete(id); } }
    for (const id of this.dirty) { if (!retained.has(id)) { this.dirty.delete(id); } }
    if (changed) { this.emit(); }
  }

  find(text: string, turnId: string) {
    return this.turns.find((turn) => turn.id === turnId && turn.text.trim() === text.trim()) ??
      (turnId === "__live__" ? this.turns.filter((turn) => !turn.isFinal && turn.text.trim() === text.trim()).at(-1) : undefined);
  }

  prepare(text: string, turnId: string) {
    const turn = this.find(text, turnId);
    if (!turn) { throw new Error("Stale conversation result"); }
    const tokens = words(text);
    const eligible = this.topics.filter((topic) => topic.turnIds.some((id) => {
      const evidence = this.turns.find((item) => item.id === id);
      return !evidence || evidence.sequence <= turn.sequence;
    }));
    const candidates = eligible.filter((topic) => topic.id !== this.activeTopic).map((topic, index) => ({
      topic,
      rank: [...words(`${topic.title} ${topic.entities.join(" ")} ${topic.summary}`)].filter((word) => tokens.has(word)).length * 100 + index / 100,
    })).sort((a, b) => b.rank - a.rank).slice(0, 3).map(({ topic }) => topic);
    const active = eligible.find((topic) => topic.id === this.activeTopic);
    const recent = this.turns.filter((item) => item.sequence < turn.sequence && item.isFinal).slice(-6);
    const state: Record<string, string> = {
      utterance: text.slice(-4000),
      speaker: turn.speaker === null ? "unknown" : String(turn.speaker),
      previous_text: recent.at(-1)?.text.slice(-1000) ?? "",
      recent_turns: recent.map((item) => `[${item.id}; speaker ${item.speaker ?? "unknown"}] ${item.text.slice(-450)}`).join("\n"),
      active_topic: active ? JSON.stringify(active).slice(0, 1000) : "No confirmed active topic",
      earlier_topics: candidates.map((topic) => JSON.stringify(topic).slice(0, 650)).join("\n"),
    };
    const stamp: ContextStamp = { session: this.session, turnId: turn.id, revision: turn.revision, contextVersion: this.version };
    const key = `${turn.id}:${turn.revision}`;
    const ownsTopic = !this.claims.has(key);
    if (ownsTopic) { this.claims.add(key); }
    const options: Record<string, string> = { new: "A new topic not represented by the listed topics", uncertain: "Insufficient evidence to assign a topic" };
    for (const topic of [active, ...candidates]) { if (topic) { options[topic.id] = `${topic.title}: ${topic.summary}`.slice(0, 650); } }
    const questions: JevQuestion[] = ownsTopic ? [
      { id: "context_topic", type: "choice", instructions: "Which topic is the main subject of `utterance`? Use recent_turns to resolve fragments. A passing reference does not make that earlier topic the main subject.", options },
      { id: "context_continues", type: "noul", instructions: "Does `utterance` continue the active_topic, rather than start or resume a different main subject?" },
      { id: "context_sufficient", type: "noul", instructions: "Does the provided evidence resolve what `utterance` refers to sufficiently to classify it?" },
      ...candidates.map((topic): JevQuestion => ({ id: `callback_${topic.id}`, type: "noul", instructions: `Does utterance refer back to earlier topic ${topic.id} (${topic.title}), even if it is not the main subject?` })),
    ] : [];
    return { state, stamp, questions, ownsTopic, key };
  }

  current(stamp: ContextStamp) {
    return stamp.session === this.session && this.turns.some((turn) => turn.id === stamp.turnId && turn.revision === stamp.revision);
  }
  release(key: string) { this.claims.delete(key); }

  accept(stamp: ContextStamp, answers: JevAnswer[]): ContextResult {
    if (!this.current(stamp)) { throw new Error("Stale conversation result"); }
    const existing = this.results.get(stamp.turnId);
    const answer = answers.find((item) => item.id === "context_topic");
    if (!answer || answer.type !== "choice") {
      return existing ?? { ...stamp, topicId: null, callbacks: [], provisional: true };
    }
    const turn = this.turns.find((item) => item.id === stamp.turnId)!;
    const probability = answer.probabilities[answer.choice] ?? 0;
    const sufficient = answers.find((item) => item.id === "context_sufficient");
    const callbacks = answers.filter((item) => item.type === "noul" && item.id.startsWith("callback_") && item.noul >= 0.8).map((item) => item.id.slice(9));
    let topicId: string | null = null;
    if (answer.choice !== "uncertain" && probability >= 0.7) {
      const consecutive = this.pendingSwitch?.id === answer.choice && this.pendingSwitch.turnId !== turn.id &&
        !this.turns.some((item) => item.isFinal && item.sequence > this.pendingSwitch!.sequence && item.sequence < turn.sequence);
      if (turn.isFinal && (probability >= 0.85 || consecutive || answer.choice === this.activeTopic)) {
        topicId = answer.choice;
        if (topicId === "new") {
          topicId = `topic-${++this.topicCounter}`;
          this.topics.push({ id: topicId, title: turn.text.slice(0, 60), summary: "", entities: [], unresolved: [], turnIds: [turn.id] });
          if (this.topics.length > 100) { this.topics.shift(); }
        }
        if (!this.topics.some((topic) => topic.id === topicId)) { topicId = null; }
        if (topicId && turn.sequence >= this.lastDecisionSequence) {
          if (this.activeTopic !== topicId) { this.summaryUrgent = true; this.version++; }
          this.activeTopic = topicId;
          this.lastDecisionSequence = turn.sequence;
          this.pendingSwitch = null;
        }
      } else if (turn.isFinal && turn.sequence >= this.lastDecisionSequence) {
        this.pendingSwitch = { id: answer.choice, sequence: turn.sequence, turnId: turn.id };
      }
    } else if (turn.isFinal) { this.pendingSwitch = null; }
    const topic = this.topics.find((item) => item.id === topicId);
    if (topic && !topic.turnIds.includes(turn.id)) { topic.turnIds = [...topic.turnIds, turn.id].slice(-200); }
    const result = { ...stamp, topicId, callbacks, provisional: !turn.isFinal || !topicId || (sufficient?.type === "noul" && sufficient.noul < 0.7) };
    this.results.set(turn.id, result);
    this.emit();
    return result;
  }

  async summarize(run: (input: SummaryInput) => Promise<TopicMemory[]>, now = Date.now()) {
    if (this.summaryRunning || !this.dirty.size || now < this.retryAfter ||
      (!this.summaryUrgent && this.dirty.size < 5 && now - this.dirtySince < 10000)) { return; }
    this.summaryRunning = true;
    this.summaryUrgent = false;
    const session = this.session;
    const turns = this.turns.filter((turn) => turn.isFinal && this.dirty.has(turn.id)).slice(0, 30);
    const topics = this.topics.filter((topic) => topic.turnIds.some((id) => turns.some((turn) => turn.id === id)));
    if (!topics.length) { this.summaryRunning = false; return; }
    try {
      const updates = await run({ turns, topics });
      if (session !== this.session || turns.some((turn) => !this.current({ session, turnId: turn.id, revision: turn.revision, contextVersion: 0 }))) { return; }
      for (const update of updates) {
        const index = this.topics.findIndex((topic) => topic.id === update.id);
        if (index >= 0) { this.topics[index] = { ...update, turnIds: this.topics[index].turnIds }; }
      }
      turns.forEach((turn) => this.dirty.delete(turn.id));
      this.summaryError = "";
      this.version++;
      this.emit();
    } catch {
      if (session === this.session) {
        this.summaryError = "Topic summaries unavailable; using recent speech.";
        this.retryAfter = now + 10000;
        this.emit();
      }
    } finally { this.summaryRunning = false; }
  }
}

const contexts = new Map<string, ConversationContext>();
export const conversationFor = (sourceId: string) => {
  let context = contexts.get(sourceId);
  if (!context) { context = new ConversationContext(); contexts.set(sourceId, context); }
  return context;
};
export const resetConversation = (sourceId: string) => contexts.get(sourceId)?.reset();
