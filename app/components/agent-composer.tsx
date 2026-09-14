"use client";

import { ArrowUp, ChevronDown, LoaderCircle, Sparkles, Square } from "lucide-react";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type Ref,
} from "react";
import { AgentModelPicker } from "./agent-model-picker";
import type { AgentModelOption } from "../lib/agent-model-options";

export type AgentScope = "selection" | "artifact" | "workspace";

export type { AgentModelOption } from "../lib/agent-model-options";

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
  modelBusy: boolean;
  stoppable: boolean;
  modelSwitching: boolean;
  locked: boolean;
  selectionUnavailable: boolean;
  placeholder: string;
  ariaLabel: string;
  scopeLabels: Readonly<Record<AgentScope, string>>;
  scopeGroupLabel: string;
  suggestedActionsLabel: string;
  sendLabel: string;
  sendTitle: string;
  stopLabel: string;
  workingLabel: string;
  longWaitLabel: string;
  modelSelectLabel: string;
  modelOptions: readonly AgentModelOption[];
  modelDiscoveryState: "idle" | "scanning" | "complete" | "unavailable" | "error";
  selectedModel: string;
  onModelChange: (value: string) => void;
  onModelPickerOpen: () => void;
  onRefreshModels: () => void;
  onManageModels: () => void;
  modelMenuLabels: Readonly<{
    connected: string;
    available: string;
    local: string;
    scanning: string;
    refresh: string;
    manage: string;
    current: string;
    providers: string;
    models: string;
    reasoning: string;
    connect: string;
    signIn: string;
    useLocal: string;
    efforts: Readonly<Record<string, string>>;
  }>;
  onStop: () => void;
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
  modelBusy,
  stoppable,
  modelSwitching,
  locked,
  selectionUnavailable,
  placeholder,
  ariaLabel,
  scopeLabels,
  scopeGroupLabel,
  suggestedActionsLabel,
  sendLabel,
  sendTitle,
  stopLabel,
  workingLabel,
  longWaitLabel,
  modelSelectLabel,
  modelOptions,
  modelDiscoveryState,
  selectedModel,
  onModelChange,
  onModelPickerOpen,
  onRefreshModels,
  onManageModels,
  modelMenuLabels,
  onStop,
  planHint,
  queryEvidenceText,
  quickCommands,
}: AgentComposerProps) {
  const localTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [waitingSeconds, setWaitingSeconds] = useState(0);

  // Expose the underlying textarea through the React 19 ref-as-prop contract.
  // The node is attached before this handle is materialized, so the non-null
  // assertion matches the runtime lifecycle; parents still observe null before mount.
  useImperativeHandle(ref, () => localTextareaRef.current as HTMLTextAreaElement, []);

  useEffect(() => {
    // Keep the auto-grow height in sync when the draft is cleared externally
    // (for example after a successful plan) or on first mount.
    if (!prompt) resizeComposerTextarea(localTextareaRef.current);
  }, [prompt]);

  useEffect(() => {
    if (!modelBusy) return;
    const startedAt = Date.now();
    const frame = window.requestAnimationFrame(() => setWaitingSeconds(0));
    const timer = window.setInterval(() => setWaitingSeconds(Math.floor((Date.now() - startedAt) / 1_000)), 1_000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [modelBusy]);

  const canScope = (target: AgentScope) => !busy && !locked && !(target === "selection" && selectionUnavailable);

  const sendDisabled = !prompt.trim() || busy || locked || (scope === "selection" && selectionUnavailable);
  const composerState = modelBusy ? "working" : sendDisabled ? "idle" : "ready";

  return (
    <>
      <div className="agent-composer" data-composer-state={composerState}>
        <div className="agent-composer-body">
          <span className="agent-composer-label visually-hidden">{ariaLabel}</span>
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
            maxLength={2_000}
            aria-label={ariaLabel}
            data-agent-free-text="true"
          />
        </div>
        <div className="agent-composer-row">
          <div className="agent-composer-actions">
            <details className="agent-suggestions">
              <summary>
                <Sparkles className="composer-spark" aria-hidden="true" />
                <span>{suggestedActionsLabel}</span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className="agent-suggestions-popover">
                <div className="quick-commands" aria-label={suggestedActionsLabel}>
                  {quickCommands.map((command) => (
                    <button key={command} onClick={() => onQuickCommand(command)} disabled={busy || locked}>
                      {command}
                    </button>
                  ))}
                </div>
                {queryEvidenceText && <p className="agent-evidence-hint">{queryEvidenceText}</p>}
              </div>
            </details>
            <label className="agent-scope-switch">
              <span className="visually-hidden">{scopeGroupLabel}</span>
              <select
                value={scope}
                onChange={(event) => onScopeChange(event.currentTarget.value as AgentScope)}
                disabled={busy || locked}
                aria-label={scopeGroupLabel}
              >
                {AGENT_SCOPE_ORDER.map((candidate) => (
                  <option key={candidate} value={candidate} disabled={!canScope(candidate)}>
                    {scopeLabels[candidate]}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" />
            </label>
          </div>
          <div className="agent-composer-trailing">
            <AgentModelPicker
              options={modelOptions}
              selected={selectedModel}
              busy={busy || locked}
              switching={modelSwitching}
              discoveryState={modelDiscoveryState}
              labels={{ select: modelSelectLabel, ...modelMenuLabels }}
              onChange={onModelChange}
              onOpen={onModelPickerOpen}
              onRefresh={onRefreshModels}
              onManage={onManageModels}
            />
            <button
              className={`run-button ${!sendDisabled ? "ready" : ""} ${modelBusy && stoppable ? "stop" : ""}`.trim()}
              onClick={modelBusy && stoppable ? onStop : onRun}
              disabled={modelBusy ? !stoppable : sendDisabled || modelSwitching}
              aria-label={modelBusy && stoppable ? stopLabel : sendLabel}
              title={modelBusy && stoppable ? stopLabel : sendTitle}
            >
              {modelBusy && stoppable ? <Square /> : busy ? <LoaderCircle className="agent-spinner" /> : <ArrowUp />}
            </button>
          </div>
        </div>
      </div>
      <p className={`agent-hint ${modelBusy ? "is-working" : ""}`.trim()} aria-live="polite">
        {modelBusy && (
          <span className="agent-thinking-pulse" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
        <span>
          {modelBusy
            ? `${waitingSeconds >= 15 ? `${workingLabel} · ${longWaitLabel}` : workingLabel} · ${waitingSeconds}s`
            : planHint}
        </span>
      </p>
    </>
  );
}
