"use client";

import { ChevronDown, Cpu, LoaderCircle, RefreshCw, Settings2, Sparkles } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { AgentModelOption } from "../lib/agent-model-options";

type ModelPickerPosition = Readonly<{ left: number; top: number; width: number }>;
type ModelConnectionGroup = Readonly<{
  key: string;
  label: string;
  detail: string;
  group: AgentModelOption["group"];
  action: AgentModelOption["action"];
  options: readonly AgentModelOption[];
}>;

export function AgentModelPicker({
  options,
  selected,
  busy,
  switching,
  discoveryState,
  labels,
  onChange,
  onOpen,
  onRefresh,
  onManage,
}: {
  options: readonly AgentModelOption[];
  selected: string;
  busy: boolean;
  switching: boolean;
  discoveryState: "idle" | "scanning" | "complete" | "unavailable" | "error";
  labels: Readonly<{
    select: string;
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
  onChange: (value: string) => void;
  onOpen: () => void;
  onRefresh: () => void;
  onManage: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<ModelPickerPosition | null>(null);
  const [focusedConnectionKey, setFocusedConnectionKey] = useState("");
  const [draftValue, setDraftValue] = useState(selected);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const focusEdgeRef = useRef<"first" | "last">("first");
  const current = options.find((option) => option.value === selected) ?? options.at(-1);
  const draft = options.find((option) => option.value === draftValue) ?? current;
  const connections = useMemo(() => groupModelConnections(options), [options]);
  const focusedConnection =
    connections.find((connection) => connection.key === focusedConnectionKey) ??
    connections.find((connection) => connection.key === draft?.connectionKey) ??
    connections[0];
  const focusedDraft =
    focusedConnection?.options.find((option) => option.value === draft?.value) ?? focusedConnection?.options[0];
  const modelFamilies = uniqueModelFamilies(focusedConnection?.options ?? []);
  const reasoningOptions = focusedDraft?.modelKey
    ? (focusedConnection?.options.filter((option) => option.modelKey === focusedDraft.modelKey && option.effort) ?? [])
    : [];
  const reasoningIndex = Math.max(
    0,
    reasoningOptions.findIndex((option) => option.value === focusedDraft?.value),
  );

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !popoverRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape, true);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const popover = popoverRef.current?.getBoundingClientRect();
      if (!trigger || !popover) return;
      const margin = 12;
      const gap = 8;
      const width = Math.min(390, window.innerWidth - margin * 2);
      const height = Math.min(popover.height, window.innerHeight - margin * 2);
      const left = Math.max(margin, Math.min(window.innerWidth - width - margin, trigger.right - width));
      const top =
        trigger.top >= height + gap + margin
          ? trigger.top - height - gap
          : Math.min(window.innerHeight - height - margin, trigger.bottom + gap);
      setPosition({ left, top: Math.max(margin, top), width });
    };
    const frame = window.requestAnimationFrame(() => {
      place();
      const tabs = providerTabs(popoverRef.current);
      tabs[focusEdgeRef.current === "last" ? tabs.length - 1 : 0]?.focus({ preventScroll: true });
    });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, options]);

  function show(edge: "first" | "last" = "first") {
    if (busy || switching) return;
    focusEdgeRef.current = edge;
    setPosition(null);
    setDraftValue(selected);
    setFocusedConnectionKey(current?.connectionKey ?? connections[0]?.key ?? "");
    setOpen(true);
    onOpen();
  }

  function choose(value: string, close = false) {
    setDraftValue(value);
    onChange(value);
    if (close) setOpen(false);
  }

  function focusConnection(connection: ModelConnectionGroup) {
    setFocusedConnectionKey(connection.key);
    const option = preferredConnectionOption(connection, draft);
    setDraftValue(option.value);
    if ((connection.action === "switch" && connection.options.length === 1) || connection.action === "local") {
      choose(option.value, true);
    }
  }

  function chooseModel(modelKey: string) {
    if (!focusedConnection) return;
    const family = focusedConnection.options.filter((option) => option.modelKey === modelKey);
    const effort = focusedDraft?.effort;
    const option = family.find((candidate) => candidate.effort === effort) ?? preferredEffortOption(family);
    if (!option) return;
    setDraftValue(option.value);
    if (family.filter((candidate) => candidate.effort).length <= 1) choose(option.value, true);
  }

  return (
    <div className="agent-model-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="agent-model-trigger"
        aria-label={labels.select}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={busy || switching}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          show(event.key === "ArrowUp" ? "last" : "first");
        }}
      >
        {switching ? (
          <LoaderCircle className="agent-spinner" aria-hidden="true" />
        ) : current?.group === "local" ? (
          <Cpu aria-hidden="true" />
        ) : (
          <Sparkles aria-hidden="true" />
        )}
        <span>{current?.label ?? labels.local}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={popoverRef}
          className="agent-model-popover"
          role="dialog"
          aria-modal="false"
          aria-label={labels.select}
          style={position ?? { visibility: "hidden" }}
        >
          <header>
            <div>
              <span>{labels.current}</span>
              <strong>{draft?.label ?? labels.local}</strong>
            </div>
            <button type="button" onClick={onRefresh} aria-label={labels.refresh} title={labels.refresh}>
              <RefreshCw className={discoveryState === "scanning" ? "agent-spinner" : ""} aria-hidden="true" />
            </button>
          </header>
          {discoveryState === "scanning" && <p className="agent-model-scanning">{labels.scanning}</p>}
          <section className="agent-model-provider-section" aria-label={labels.providers}>
            <div
              className="agent-model-provider-strip"
              role="tablist"
              aria-label={labels.providers}
              onKeyDown={moveProviderFocus}
            >
              {connections.map((connection) => {
                const active = connection.key === focusedConnection?.key;
                const selectedConnection = connection.key === current?.connectionKey;
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={active ? "active" : ""}
                    onClick={() => focusConnection(connection)}
                    key={connection.key}
                  >
                    <span>{connection.label}</span>
                    <small>
                      {selectedConnection
                        ? labels.current
                        : connection.action === "connect"
                          ? labels.connect
                          : connection.action === "settings"
                            ? labels.signIn
                            : connection.group === "connected"
                              ? labels.connected
                              : labels.local}
                    </small>
                  </button>
                );
              })}
            </div>
          </section>
          <div className="agent-model-configurator">
            {focusedConnection?.action === "connect" || focusedConnection?.action === "settings" ? (
              <section className="agent-model-connect-card">
                <span className="agent-model-option-icon connect" aria-hidden="true">
                  <Sparkles />
                </span>
                <div>
                  <strong>{focusedConnection.label}</strong>
                  <small>{focusedConnection.detail}</small>
                </div>
                <button type="button" onClick={() => choose(focusedConnection.options[0].value, true)}>
                  {focusedConnection.action === "connect" ? labels.connect : labels.signIn}
                </button>
              </section>
            ) : focusedConnection?.action === "local" ? (
              <section className="agent-model-local-card">
                <Cpu aria-hidden="true" />
                <div>
                  <strong>{focusedConnection.label}</strong>
                  <small>{focusedConnection.detail}</small>
                </div>
                {current?.connectionKey !== "local" && (
                  <button type="button" onClick={() => choose("local")}>
                    {labels.useLocal}
                  </button>
                )}
              </section>
            ) : (
              <>
                <section className="agent-model-family-section" aria-label={labels.models}>
                  <h3>{labels.models}</h3>
                  <div role="radiogroup" aria-label={labels.models}>
                    {modelFamilies.map((family) => (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={family.key === focusedDraft?.modelKey}
                        className={family.key === focusedDraft?.modelKey ? "selected" : ""}
                        onClick={() => chooseModel(family.key)}
                        key={family.key}
                      >
                        {family.label}
                      </button>
                    ))}
                  </div>
                </section>
                {reasoningOptions.length > 1 && (
                  <section className="agent-model-reasoning-section">
                    <h3>{labels.reasoning}</h3>
                    <input
                      type="range"
                      min={0}
                      max={reasoningOptions.length - 1}
                      step={1}
                      value={reasoningIndex}
                      aria-label={labels.reasoning}
                      aria-valuetext={effortLabel(reasoningOptions[reasoningIndex]?.effort, labels.efforts)}
                      onChange={(event) => {
                        const option = reasoningOptions[Number(event.currentTarget.value)];
                        if (option) setDraftValue(option.value);
                      }}
                      onPointerUp={(event) => {
                        const option = reasoningOptions[Number(event.currentTarget.value)];
                        if (option) choose(option.value, true);
                      }}
                      onKeyUp={(event) => {
                        if (!new Set(["ArrowLeft", "ArrowRight", "Home", "End"]).has(event.key)) return;
                        const option = reasoningOptions[Number(event.currentTarget.value)];
                        if (option) choose(option.value, true);
                      }}
                    />
                    <div className="agent-model-reasoning-labels" aria-hidden="true">
                      {reasoningOptions.map((option) => (
                        <span className={option.value === focusedDraft?.value ? "active" : ""} key={option.value}>
                          {effortLabel(option.effort, labels.efforts)}
                        </span>
                      ))}
                    </div>
                  </section>
                )}
                {reasoningOptions.length <= 1 && focusedDraft && (
                  <p className="agent-model-fixed-detail">{focusedDraft.detail}</p>
                )}
              </>
            )}
          </div>
          <footer>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onManage();
              }}
            >
              <Settings2 aria-hidden="true" />
              <span>{labels.manage}</span>
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}

function groupModelConnections(options: readonly AgentModelOption[]) {
  const groups = new Map<string, AgentModelOption[]>();
  for (const option of options) groups.set(option.connectionKey, [...(groups.get(option.connectionKey) ?? []), option]);
  return [...groups.entries()].map(([key, choices]) => ({
    key,
    label: choices[0].connectionLabel,
    detail: choices[0].detail,
    group: choices[0].group,
    action: choices[0].action,
    options: choices,
  })) satisfies ModelConnectionGroup[];
}

function uniqueModelFamilies(options: readonly AgentModelOption[]) {
  const families = new Map<string, string>();
  for (const option of options) {
    if (option.modelKey && option.modelLabel && !families.has(option.modelKey)) {
      families.set(option.modelKey, option.modelLabel);
    }
  }
  return [...families].map(([key, label]) => ({ key, label }));
}

function preferredEffortOption(options: readonly AgentModelOption[]) {
  return options.find((option) => option.effort === "medium") ?? options[0];
}

function preferredConnectionOption(connection: ModelConnectionGroup, current: AgentModelOption | undefined) {
  if (current?.connectionKey === connection.key) return current;
  const matchingEffort = current?.effort
    ? connection.options.find((option) => option.effort === current.effort)
    : undefined;
  return matchingEffort ?? preferredEffortOption(connection.options);
}

function effortLabel(value: string | null | undefined, labels: Readonly<Record<string, string>>) {
  if (!value) return "";
  return labels[value] ?? `${value.charAt(0).toLocaleUpperCase()}${value.slice(1)}`;
}

function providerTabs(element: HTMLElement | null) {
  return element ? Array.from(element.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')) : [];
}

function moveProviderFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
  const tabs = providerTabs(event.currentTarget);
  if (!tabs.length) return;
  const currentIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);
  const direction = event.currentTarget.dir === "rtl" ? -1 : 1;
  const nextIndex =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : event.key === "ArrowRight"
          ? (Math.max(0, currentIndex) + direction + tabs.length) % tabs.length
          : (Math.max(0, currentIndex) - direction + tabs.length) % tabs.length;
  event.preventDefault();
  tabs[nextIndex]?.focus({ preventScroll: true });
}
