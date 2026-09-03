"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AGENT_CONVERSATION_STORAGE_KEY,
  agentConversationContext,
  appendAgentConversationMessage,
  normalizeAgentConversation,
  type AgentConversationKind,
  type AgentConversationMessage,
  type AgentConversationRole,
} from "../lib/agent-conversation";

function createMessage(
  role: AgentConversationRole,
  kind: AgentConversationKind,
  content: string,
  model?: string,
): AgentConversationMessage {
  return {
    id: crypto.randomUUID(),
    role,
    kind,
    content,
    createdAt: new Date().toISOString(),
    ...(model ? { model } : {}),
  };
}

/** Device-only persistence and bounded model context for one Agent thread. */
export function useAgentConversation(hydrated: boolean) {
  const [messages, setMessages] = useState<AgentConversationMessage[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!hydrated || !loadedRef.current) return;
    const timer = window.setTimeout(() => {
      try {
        if (messages.length) localStorage.setItem(AGENT_CONVERSATION_STORAGE_KEY, JSON.stringify(messages));
        else localStorage.removeItem(AGENT_CONVERSATION_STORAGE_KEY);
      } catch {
        // Conversation stays available in memory when device storage is unavailable.
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [hydrated, messages]);

  const append = useCallback(
    (role: AgentConversationRole, kind: AgentConversationKind, content: string, model?: string) => {
      setMessages((current) => appendAgentConversationMessage(current, createMessage(role, kind, content, model)));
    },
    [],
  );

  return {
    messages,
    restore: useCallback((value: unknown) => {
      setMessages(normalizeAgentConversation(value));
      loadedRef.current = true;
    }, []),
    context: useMemo(() => agentConversationContext(messages), [messages]),
    appendUser: useCallback((content: string) => append("user", "prompt", content), [append]),
    appendAssistant: useCallback(
      (kind: "answer" | "proposal", content: string, model?: string) => append("assistant", kind, content, model),
      [append],
    ),
    clear: useCallback(() => setMessages([]), []),
  } as const;
}
