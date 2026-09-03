import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_AGENT_CONVERSATION_CHARS,
  MAX_AGENT_CONVERSATION_CONTEXT_MESSAGES,
  MAX_AGENT_CONVERSATION_MESSAGE_CHARS,
  MAX_AGENT_CONVERSATION_MESSAGES,
  agentConversationContext,
  appendAgentConversationMessage,
  normalizeAgentConversation,
} from "../app/lib/agent-conversation.ts";

function message(index, overrides = {}) {
  return {
    id: `message-${index}`,
    role: index % 2 ? "assistant" : "user",
    kind: index % 2 ? "answer" : "prompt",
    content: `Message ${index}`,
    createdAt: new Date(Date.UTC(2026, 8, 3, 9, index)).toISOString(),
    ...overrides,
  };
}

test("normalizes a bounded device-only Agent conversation", () => {
  const source = Array.from({ length: MAX_AGENT_CONVERSATION_MESSAGES + 4 }, (_, index) => message(index));
  source.push(message(2, { content: "duplicate" }));
  source.push({ nope: true });
  const normalized = normalizeAgentConversation(source);
  assert.equal(normalized.length, MAX_AGENT_CONVERSATION_MESSAGES);
  assert.equal(normalized[0].id, "message-4");
  assert.equal(normalized.at(-1).id, `message-${MAX_AGENT_CONVERSATION_MESSAGES + 3}`);
  assert.throws(() => {
    normalized[0].content = "mutated";
  });
});

test("caps individual and aggregate conversation content without inventing text", () => {
  const normalized = normalizeAgentConversation(
    Array.from({ length: MAX_AGENT_CONVERSATION_MESSAGES }, (_, index) =>
      message(index, { content: `${index}:${"x".repeat(MAX_AGENT_CONVERSATION_MESSAGE_CHARS + 200)}` }),
    ),
  );
  assert.ok(normalized.every((item) => item.content.length <= MAX_AGENT_CONVERSATION_MESSAGE_CHARS));
  assert.ok(normalized.reduce((total, item) => total + item.content.length, 0) <= MAX_AGENT_CONVERSATION_CHARS);
});

test("appends messages and exposes only bounded role/content model context", () => {
  const source = Array.from({ length: MAX_AGENT_CONVERSATION_MESSAGES }, (_, index) => message(index));
  const next = appendAgentConversationMessage(source, message(30, { model: "private-profile-label" }));
  const context = agentConversationContext(next);
  assert.equal(next.at(-1).id, "message-30");
  assert.equal(context.length, MAX_AGENT_CONVERSATION_CONTEXT_MESSAGES);
  assert.deepEqual(Object.keys(context.at(-1)).sort(), ["content", "role"]);
  assert.equal(JSON.stringify(context).includes("private-profile-label"), false);
});
