"use client";

import { ChevronDown, LoaderCircle, Play, Sparkles } from "lucide-react";
import { useEffect, useImperativeHandle, useRef, type ChangeEvent, type KeyboardEvent, type Ref } from "react";

export type AgentScope = "selection" | "artifact" | "workspace";

const AGENT_SCOPE_ORDER = ["selection", "artifact", "workspace"] as const;
const MAX_COMPOSER_TEXT_HEIGHT = 132;

function resizeComposerTextarea(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${Math.min(element.scrollHeight, MAX_COMPOSER_TEXT_HEIGHT)}px`;
}

export type AgentComposerProps = Readonly<{
  ref?: Ref<HTMLTextAreaElement | null>;
  prompt: string;
  onPromptChange: (value: string) => void;
  onPromptKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onRun: () => void;
  onQuickCommand: (command: string) => void;
  scope: AgentScope;
  onScopeChange: (scope: AgentScope) => void;
  busy: boolean;
  locked: boolean;
  selectionUnavailable: boolean;
  mode: "openai" | "local";
  placeholder: string;
  ariaLabel: string;
  scopeLabels: Readonly<Record<AgentScope, string>>;
  scopeGroupLabel: string;
  suggestedActionsLabel: string;
  sendLabel: string;
  sendTitle: string;
  modelConnectedLabel: string;
  localFallbackLabel: string;
  planHint: string;
  queryEvidenceText: string;
  quickCommands: readonly string[];
}>;

/**
 * Presentation-only Agent composer. Renders the DSH-informed floating capsule
 * (auto-growing borderless draft, chip-style scope selector, circular send
 * control, collapsible suggested actions) and forwards every action to the
 * Workbench, which remains the sole owner of scope state, planning, review,
 * and persistence.
 */
export function AgentComposer({
  ref,
  prompt,
  onPromptChange,
  onPromptKeyDown,
  onRun,
  onQuickCommand,
  scope,
  onScopeChange,
  busy,
  locked,
  selectionUnavailable,
  mode,
  placeholder,
  ariaLabel,
  scopeLabels,
  scopeGroupLabel,
  suggestedActionsLabel,
  sendLabel,
  sendTitle,
  modelConnectedLabel,
  localFallbackLabel,
  planHint,
  queryEvidenceText,
  quickCommands,
}: AgentComposerProps) {
  const localTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Expose the underlying textarea through the React 19 ref-as-prop contract.
  // The node is attached before this handle is materialized, so the non-null
  // assertion matches the runtime lifecycle; parents still observe null before mount.
  useImperativeHandle(ref, () => localTextareaRef.current as HTMLTextAreaElement, []);

  useEffect(() => {
    // Keep the auto-grow height in sync when the draft is cleared externally
    // (for example after a successful plan) or on first mount.
    if (!prompt) resizeComposerTextarea(localTextareaRef.current);
  }, [prompt]);

  const canScope = (target: AgentScope) => !busy && !locked && !(target === "selection" && selectionUnavailable);

  const sendDisabled = !prompt.trim() || busy || locked || (scope === "selection" && selectionUnavailable);

  return (
    <>
      <div className="agent-composer">
        <details className="agent-suggestions">
          <summary>
            <Sparkles className="composer-spark" aria-hidden="true" />
            <span>{suggestedActionsLabel}</span>
            <ChevronDown aria-hidden="true" />
          </summary>
          <div className="quick-commands" aria-label={suggestedActionsLabel}>
            {quickCommands.map((command) => (
              <button key={command} onClick={() => onQuickCommand(command)} disabled={busy || locked}>
                {command}
              </button>
            ))}
          </div>
          {queryEvidenceText && <p className="agent-evidence-hint">{queryEvidenceText}</p>}
        </details>
        <div className="agent-composer-body">
          <textarea
            ref={(element) => {
              localTextareaRef.current = element;
            }}
            value={prompt}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
              resizeComposerTextarea(event.currentTarget);
              onPromptChange(event.currentTarget.value);
            }}
            onKeyDown={onPromptKeyDown}
            placeholder={placeholder}
            rows={1}
            aria-label={ariaLabel}
          />
        </div>
        <div className="agent-composer-row">
          <div className="agent-scope-switch" role="group" aria-label={scopeGroupLabel}>
            {AGENT_SCOPE_ORDER.map((candidate) => (
              <button
                key={candidate}
                className={scope === candidate ? "active" : ""}
                onClick={() => onScopeChange(candidate)}
                disabled={!canScope(candidate)}
                aria-pressed={scope === candidate}
              >
                {scopeLabels[candidate]}
              </button>
            ))}
          </div>
          <div className="agent-composer-trailing">
            <span className={`local-planner-badge ${mode}`}>
              {mode === "openai" ? modelConnectedLabel : localFallbackLabel}
            </span>
            <button
              className="run-button"
              onClick={onRun}
              disabled={sendDisabled}
              aria-label={sendLabel}
              title={sendTitle}
            >
              {busy ? <LoaderCircle className="agent-spinner" /> : <Play />}
            </button>
          </div>
        </div>
      </div>
      <p className="agent-hint">{planHint}</p>
    </>
  );
}
