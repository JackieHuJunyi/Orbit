"use client";

import { ChevronDown, LoaderCircle, Play, Sparkles } from "lucide-react";
import { useEffect, useImperativeHandle, useRef, type ChangeEvent, type KeyboardEvent, type Ref } from "react";

export type AgentScope = "selection" | "artifact" | "workspace";

export type AgentModelOption = Readonly<{
  value: string;
  label: string;
}>;

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
  modelSwitching: boolean;
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
  modelSelectLabel: string;
  modelOptions: readonly AgentModelOption[];
  selectedModel: string;
  onModelChange: (value: string) => void;
  planHint: string;
  queryEvidenceText: string;
  quickCommands: readonly string[];
}>;

/**
 * Presentation-only Agent composer. Free text is the primary surface; scope,
 * active model, send, and optional suggestions stay secondary. Every action
 * is forwarded to the Workbench, which remains the sole owner of model
 * activation, planning, review, and persistence.
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
  modelSwitching,
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
  modelSelectLabel,
  modelOptions,
  selectedModel,
  onModelChange,
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
        <div className="agent-composer-body">
          <span className="agent-composer-label">{ariaLabel}</span>
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
            rows={2}
            maxLength={2_000}
            aria-label={ariaLabel}
            data-agent-free-text="true"
          />
        </div>
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
            <label className={`agent-model-picker ${mode}`}>
              <span className="visually-hidden">{modelSelectLabel}</span>
              <select
                value={selectedModel}
                onChange={(event) => onModelChange(event.currentTarget.value)}
                disabled={busy || locked || modelSwitching}
                aria-label={modelSelectLabel}
              >
                {modelOptions.length ? (
                  modelOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))
                ) : (
                  <option value={selectedModel}>{mode === "openai" ? modelConnectedLabel : localFallbackLabel}</option>
                )}
              </select>
              <ChevronDown aria-hidden="true" />
            </label>
            <button
              className="run-button"
              onClick={onRun}
              disabled={sendDisabled || modelSwitching}
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
