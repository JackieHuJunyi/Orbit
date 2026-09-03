export const AGENT_CONVERSATION_STORAGE_KEY = "orbit-agent-conversation-v1";
export const MAX_AGENT_CONVERSATION_MESSAGES = 16;
export const MAX_AGENT_CONVERSATION_CONTEXT_MESSAGES = 12;
export const MAX_AGENT_CONVERSATION_MESSAGE_CHARS = 2_000;
export const MAX_AGENT_CONVERSATION_CHARS = 20_000;

export type AgentConversationRole = "user" | "assistant";
export type AgentConversationKind = "prompt" | "answer" | "proposal";

export type AgentConversationMessage = Readonly<{
  id: string;
  role: AgentConversationRole;
  kind: AgentConversationKind;
  content: string;
  createdAt: string;
  model?: string;
}>;

export type AgentConversationContextMessage = Readonly<{
  role: AgentConversationRole;
  content: string;
}>;

function validTimestamp(value: unknown) {
  return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
}

function normalizeMessage(value: unknown): AgentConversationMessage | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AgentConversationMessage>;
  if (
    typeof candidate.id !== "string" ||
    !candidate.id ||
    candidate.id.length > 80 ||
    (candidate.role !== "user" && candidate.role !== "assistant") ||
    !["prompt", "answer", "proposal"].includes(candidate.kind ?? "") ||
    typeof candidate.content !== "string" ||
    !candidate.content.trim() ||
    !validTimestamp(candidate.createdAt)
  ) {
    return null;
  }
  const content = candidate.content.trim().slice(0, MAX_AGENT_CONVERSATION_MESSAGE_CHARS);
  const model =
    typeof candidate.model === "string" && candidate.model.trim() ? candidate.model.trim().slice(0, 160) : undefined;
  return Object.freeze({
    id: candidate.id,
    role: candidate.role,
    kind: candidate.kind as AgentConversationKind,
    content,
    createdAt: candidate.createdAt as string,
    ...(model ? { model } : {}),
  });
}

export function normalizeAgentConversation(value: unknown): AgentConversationMessage[] {
  if (!Array.isArray(value)) return [];
  const deduplicated = new Map<string, AgentConversationMessage>();
  for (const item of value) {
    const message = normalizeMessage(item);
    if (message && !deduplicated.has(message.id)) deduplicated.set(message.id, message);
  }
  const recent = [...deduplicated.values()].slice(-MAX_AGENT_CONVERSATION_MESSAGES);
  const bounded: AgentConversationMessage[] = [];
  let characters = 0;
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const message = recent[index];
    if (characters + message.content.length > MAX_AGENT_CONVERSATION_CHARS) continue;
    bounded.unshift(message);
    characters += message.content.length;
  }
  return bounded;
}

export function appendAgentConversationMessage(
  messages: readonly AgentConversationMessage[],
  message: AgentConversationMessage,
) {
  return normalizeAgentConversation([...messages, message]);
}

export function agentConversationContext(
  messages: readonly AgentConversationMessage[],
): AgentConversationContextMessage[] {
  return normalizeAgentConversation(messages)
    .slice(-MAX_AGENT_CONVERSATION_CONTEXT_MESSAGES)
    .map(({ role, content }) => Object.freeze({ role, content }));
}
