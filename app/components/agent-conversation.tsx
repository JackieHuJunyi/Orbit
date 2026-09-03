"use client";

import { MessageCircle, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import type { AgentConversationMessage } from "../lib/agent-conversation";

export type AgentConversationProps = Readonly<{
  messages: readonly AgentConversationMessage[];
  conversationLabel: string;
  clearLabel: string;
  userLabel: string;
  assistantLabel: string;
  answerLabel: string;
  proposalLabel: string;
  privacyLabel: string;
  onClear: () => void;
}>;

export function AgentConversation({
  messages,
  conversationLabel,
  clearLabel,
  userLabel,
  assistantLabel,
  answerLabel,
  proposalLabel,
  privacyLabel,
  onClear,
}: AgentConversationProps) {
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  if (!messages.length) return null;

  return (
    <section className="agent-conversation" aria-label={conversationLabel}>
      <header>
        <span>
          <MessageCircle aria-hidden="true" />
          <strong>{conversationLabel}</strong>
        </span>
        <button type="button" onClick={onClear} aria-label={clearLabel} title={clearLabel}>
          <Trash2 aria-hidden="true" />
          <span>{clearLabel}</span>
        </button>
      </header>
      <ol role="log" aria-live="polite" aria-relevant="additions text">
        {messages.map((message, index) => (
          <li
            className={`${message.role} ${message.kind}`}
            key={message.id}
            ref={index === messages.length - 1 ? endRef : undefined}
          >
            <div>
              <strong>{message.role === "user" ? userLabel : assistantLabel}</strong>
              {message.role === "assistant" && (
                <small>{message.kind === "proposal" ? proposalLabel : answerLabel}</small>
              )}
            </div>
            <p>{message.content}</p>
            {message.model && <small className="agent-conversation-model">{message.model}</small>}
          </li>
        ))}
      </ol>
      <p className="agent-conversation-privacy">{privacyLabel}</p>
    </section>
  );
}
