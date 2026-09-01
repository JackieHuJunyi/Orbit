"use client";

import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  MAX_MODEL_PROFILES,
  DEFAULT_MODEL_TOKEN_BUDGET,
  MAX_MODEL_INPUT_TOKEN_BUDGET,
  MAX_MODEL_OUTPUT_TOKEN_BUDGET,
  MIN_MODEL_INPUT_TOKEN_BUDGET,
  MIN_MODEL_OUTPUT_TOKEN_BUDGET,
  MODEL_PROVIDER_PRESETS,
  type ModelProfilesState,
  type ModelProtocol,
  type ModelProviderKind,
  type ModelTokenBudget,
  type PublicModelProfile,
} from "../lib/model-profiles";
import { localizeRuneCopy, runeText, type RuneLocale } from "../lib/localization";
import type { ModelProviderStatus } from "../lib/model-preference";

export const MODEL_MANAGER_BASE_COPY = {
  "zh-CN": {
    loading: "正在读取模型配置…",
    unavailable: "当前服务没有启用加密凭据库；仍可使用部署模型或本地模式。",
    empty: "还没有个人模型配置。添加后即可在这里一键切换。",
    add: "添加供应商",
    active: "正在使用",
    enable: "启用",
    edit: "编辑",
    remove: "删除",
    confirmRemove: "再次点击删除",
    deployment: "部署模型",
    deploymentBody: "由 Rune 服务管理员配置，只显示非敏感状态。",
    formAdd: "添加模型供应商",
    formEdit: "编辑模型供应商",
    preset: "供应商",
    name: "配置名称",
    endpoint: "API 基础地址",
    protocol: "调用协议",
    model: "默认模型 ID",
    apiKey: "API Key",
    keepKey: "留空则继续使用已加密保存的密钥",
    keyPlaceholder: "只在保存前短暂存在于当前输入框",
    showKey: "显示 API 密钥",
    hideKey: "隐藏 API 密钥",
    test: "读取模型",
    testing: "正在读取…",
    save: "保存并启用",
    saving: "正在加密保存…",
    cancel: "取消",
    modelHint:
      "读取模型只验证认证与模型目录；首次 Agent 计划仍会验证所选协议的结构化输出。跨供应商重试必须在模型设置中另行明确授权。",
    safety:
      "密钥经同源 HTTPS 发送后加密进入 HttpOnly 凭据，绝不写入 localStorage、工作区、Artifact 或 Git。自定义端点会收到你交给 Agent 的内容，请只使用可信服务。",
    chooseModel: "选择读取到的模型",
    capability: "能力",
    structuredOutput: "结构化输出",
    usageReported: "真实 token usage",
    inputBudget: "单任务输入预算",
    outputBudget: "单任务输出预算",
    tokenUnit: "tokens",
    failover: "允许供应商故障转移",
    failoverHint: "主模型失败时，Rune 才可按配置顺序把同一有界内容发送给另一供应商。默认关闭。",
    healthUnknown: "尚未检查",
    healthHealthy: "最近调用正常",
    healthUnhealthy: "暂时避开",
  },
  en: {
    loading: "Reading model profiles…",
    unavailable:
      "This server has not enabled the encrypted credential vault. The deployment model and local mode remain available.",
    empty: "No personal model profiles yet. Add one to switch providers here.",
    add: "Add provider",
    active: "Active",
    enable: "Enable",
    edit: "Edit",
    remove: "Delete",
    confirmRemove: "Click again to delete",
    deployment: "Deployment model",
    deploymentBody: "Managed by the Rune server; only non-secret status is shown.",
    formAdd: "Add model provider",
    formEdit: "Edit model provider",
    preset: "Provider",
    name: "Profile name",
    endpoint: "API base URL",
    protocol: "API protocol",
    model: "Default model ID",
    apiKey: "API Key",
    keepKey: "Leave empty to keep the encrypted credential",
    keyPlaceholder: "Exists only in this field until you save",
    showKey: "Show API key",
    hideKey: "Hide API key",
    test: "Fetch models",
    testing: "Fetching…",
    save: "Save & enable",
    saving: "Encrypting…",
    cancel: "Cancel",
    modelHint:
      "Fetching models checks authentication and the model catalog only. The first Agent plan still verifies structured output for the selected protocol. Cross-provider retry requires separate permission in Models settings.",
    safety:
      "The key crosses same-origin HTTPS and is encrypted into an HttpOnly credential; it is never written to localStorage, the workspace, an Artifact, or Git. A custom endpoint receives the content you give the Agent, so use only a service you trust.",
    chooseModel: "Choose a fetched model",
    capability: "Capabilities",
    structuredOutput: "Structured output",
    usageReported: "Provider-reported token usage",
    inputBudget: "Input budget per task",
    outputBudget: "Output budget per task",
    tokenUnit: "tokens",
    failover: "Allow provider failover",
    failoverHint:
      "Only after the primary model fails may Rune send the same bounded content to another configured provider. Off by default.",
    healthUnknown: "Not checked yet",
    healthHealthy: "Recent call succeeded",
    healthUnhealthy: "Temporarily avoided",
  },
} as const;

function modelManagerCopy(locale: RuneLocale) {
  return localizeRuneCopy(locale, MODEL_MANAGER_BASE_COPY.en, MODEL_MANAGER_BASE_COPY["zh-CN"]);
}

type EditableProfile = {
  id?: string;
  provider: ModelProviderKind;
  protocol: ModelProtocol;
  name: string;
  baseURL: string;
  model: string;
  budget: ModelTokenBudget;
  apiKey: string;
};

function blankProfile(provider: ModelProviderKind = "openai"): EditableProfile {
  const preset = MODEL_PROVIDER_PRESETS.find((item) => item.id === provider)!;
  return {
    provider,
    protocol: preset.protocol,
    name: preset.label,
    baseURL: preset.baseURL,
    model: preset.defaultModel,
    budget: { ...DEFAULT_MODEL_TOKEN_BUDGET },
    apiKey: "",
  };
}

function editableProfile(profile: PublicModelProfile): EditableProfile {
  return {
    id: profile.id,
    provider: profile.provider,
    protocol: profile.protocol,
    name: profile.name,
    baseURL: profile.baseURL,
    model: profile.model,
    budget: { ...profile.budget },
    apiKey: "",
  };
}

function modelProtocolLabel(protocol: ModelProtocol) {
  if (protocol === "responses") return "OpenAI Responses";
  if (protocol === "chat-completions") return "Chat Completions";
  if (protocol === "anthropic-messages") return "Anthropic Messages";
  return "Gemini generateContent";
}

function statusFromState(state: ModelProfilesState): ModelProviderStatus {
  if (state.activeProfile)
    return {
      configured: true,
      provider: state.activeProfile.provider,
      model: state.activeProfile.model,
      source: "personal",
      profileName: state.activeProfile.name,
      budget: state.activeProfile.budget,
      capabilities: state.activeProfile.capabilities,
      health: state.activeProfile.health,
    };
  return {
    ...state.deployment,
    source: state.deployment.configured ? "deployment" : null,
    profileName: state.deployment.configured ? "Deployment OpenAI" : null,
  };
}

function healthLabel(health: ModelProfilesState["deployment"]["health"], text: ReturnType<typeof modelManagerCopy>) {
  if (health.status === "healthy") return text.healthHealthy;
  if (health.status === "unhealthy") return text.healthUnhealthy;
  return text.healthUnknown;
}

export function ModelProfileManager({
  compact = false,
  locale,
  onStatusChange,
}: {
  compact?: boolean;
  locale: RuneLocale;
  onStatusChange: (status: ModelProviderStatus) => void;
}) {
  const text = modelManagerCopy(locale);
  const [state, setState] = useState<ModelProfilesState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<"save" | "models" | "switch" | "delete" | null>(null);
  const [editor, setEditor] = useState<EditableProfile | null>(null);
  const [error, setError] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState("");
  const canAdd = Boolean(state?.vaultAvailable && state.profiles.length < MAX_MODEL_PROFILES);
  const preset = useMemo(() => MODEL_PROVIDER_PRESETS.find((item) => item.id === editor?.provider), [editor?.provider]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/model-profiles", { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as ModelProfilesState & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Rune could not read model profiles.");
        setState(payload);
        onStatusChange(statusFromState(payload));
        setError("");
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Rune could not read model profiles.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [onStatusChange]);

  async function mutate(
    action: "upsert" | "activate" | "delete" | "deployment" | "failover",
    profileId?: string,
    enabled?: boolean,
  ) {
    setSubmitting(true);
    setSubmittingAction(action === "upsert" ? "save" : action === "delete" ? "delete" : "switch");
    setError("");
    try {
      const body =
        action === "upsert"
          ? { action, profile: editor }
          : action === "failover"
            ? { action, enabled }
            : { action, profileId };
      const response = await fetch("/api/model-profiles", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as ModelProfilesState & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Rune could not update that model profile.");
      setState(payload);
      onStatusChange(statusFromState(payload));
      setEditor(null);
      setModels([]);
      setShowKey(false);
      setPendingDeleteId("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rune could not update that model profile.");
    } finally {
      setSubmitting(false);
      setSubmittingAction(null);
    }
  }

  async function fetchModels() {
    if (!editor) return;
    setSubmitting(true);
    setSubmittingAction("models");
    setError("");
    setModels([]);
    try {
      const response = await fetch("/api/model-profiles", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "models", profile: editor }),
      });
      const payload = (await response.json()) as { models?: string[]; error?: string };
      if (!response.ok || !Array.isArray(payload.models))
        throw new Error(payload.error || "Rune could not read that provider's models.");
      setModels(payload.models);
      if (!editor.model && payload.models[0]) setEditor({ ...editor, model: payload.models[0] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rune could not read that provider's models.");
    } finally {
      setSubmitting(false);
      setSubmittingAction(null);
    }
  }

  function chooseProvider(provider: ModelProviderKind) {
    if (!editor) return;
    const next = blankProfile(provider);
    setEditor({
      ...editor,
      provider,
      protocol: next.protocol,
      name: next.name,
      baseURL: next.baseURL,
      model: next.model,
    });
    setModels([]);
    setError("");
  }

  if (loading)
    return (
      <div className="model-manager-loading">
        <LoaderCircle className="agent-spinner" />
        {text.loading}
      </div>
    );

  return (
    <section
      className={`model-profile-manager ${compact ? "compact" : ""}`.trim()}
      aria-label={runeText(locale, "Personal model profiles", "个人模型配置")}
    >
      {state?.deployment.configured && (
        <div className={`model-profile-card deployment ${state.activeSource === "deployment" ? "active" : ""}`}>
          <span>
            <Server />
          </span>
          <div>
            <strong>{text.deployment}</strong>
            <small>OpenAI · {state.deployment.model}</small>
            <p>OpenAI Responses · {text.deploymentBody}</p>
            {state.deployment.budget && (
              <p>
                {text.capability} · {text.structuredOutput} · {state.deployment.budget.maxInputTokens}/
                {state.deployment.budget.maxOutputTokens} {text.tokenUnit}
              </p>
            )}
            <small className={`model-profile-health ${state.deployment.health.status}`}>
              {healthLabel(state.deployment.health, text)}
            </small>
          </div>
          {state.activeSource === "deployment" ? (
            <em>
              <Check />
              {text.active}
            </em>
          ) : (
            <div className="model-profile-actions">
              <button type="button" disabled={submitting} onClick={() => void mutate("deployment")}>
                <Check />
                {text.enable}
              </button>
            </div>
          )}
        </div>
      )}
      {state?.profiles.map((profile) => (
        <div className={`model-profile-card ${state.activeProfileId === profile.id ? "active" : ""}`} key={profile.id}>
          <span>
            <KeyRound />
          </span>
          <div>
            <strong>{profile.name}</strong>
            <small>
              {MODEL_PROVIDER_PRESETS.find((item) => item.id === profile.provider)?.label} · {profile.model}
            </small>
            <p>
              {modelProtocolLabel(profile.protocol)} · {profile.baseURL}
            </p>
            <small className={`model-profile-health ${profile.health.status}`}>
              {healthLabel(profile.health, text)}
            </small>
            <p>
              {text.capability} · {profile.capabilities.structuredOutput} · {text.usageReported} ·{" "}
              {profile.budget.maxInputTokens}/{profile.budget.maxOutputTokens} {text.tokenUnit}
            </p>
          </div>
          <div className="model-profile-actions">
            {state.activeProfileId === profile.id ? (
              <em>
                <Check />
                {text.active}
              </em>
            ) : (
              <button type="button" disabled={submitting} onClick={() => void mutate("activate", profile.id)}>
                <Check />
                {text.enable}
              </button>
            )}
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setEditor(editableProfile(profile));
                setModels([]);
                setError("");
              }}
            >
              <Pencil />
              {text.edit}
            </button>
            <button
              type="button"
              className={pendingDeleteId === profile.id ? "danger" : ""}
              disabled={submitting}
              onClick={() => {
                if (pendingDeleteId === profile.id) void mutate("delete", profile.id);
                else setPendingDeleteId(profile.id);
              }}
            >
              <Trash2 />
              {pendingDeleteId === profile.id ? text.confirmRemove : text.remove}
            </button>
          </div>
        </div>
      ))}
      {state && (state.profiles.length > 1 || (state.profiles.length > 0 && state.deployment.configured)) && (
        <label className="model-failover-policy">
          <input
            type="checkbox"
            checked={state.failoverEnabled}
            disabled={submitting}
            onChange={(event) => void mutate("failover", undefined, event.target.checked)}
          />
          <span>
            <strong>{text.failover}</strong>
            <small>{text.failoverHint}</small>
          </span>
        </label>
      )}
      {!state?.profiles.length && !state?.deployment.configured && <p className="model-manager-empty">{text.empty}</p>}
      {!state?.vaultAvailable && (
        <p className="model-manager-warning">
          <ShieldCheck />
          {text.unavailable}
        </p>
      )}

      {!editor && canAdd && (
        <button className="model-add-provider" type="button" onClick={() => setEditor(blankProfile())}>
          <Plus />
          {text.add}
          <span>
            {state?.profiles.length ?? 0}/{MAX_MODEL_PROFILES}
          </span>
        </button>
      )}

      {editor && (
        <form
          className="model-profile-editor"
          onSubmit={(event) => {
            event.preventDefault();
            void mutate("upsert");
          }}
        >
          <header>
            <div>
              <span>{editor.id ? text.formEdit : text.formAdd}</span>
              <strong>{editor.name || preset?.label}</strong>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditor(null);
                setModels([]);
                setError("");
              }}
              aria-label={text.cancel}
            >
              <X />
            </button>
          </header>
          <div className="model-provider-tabs" role="radiogroup" aria-label={text.preset}>
            {MODEL_PROVIDER_PRESETS.map((item) => (
              <button
                type="button"
                role="radio"
                aria-checked={editor.provider === item.id}
                className={editor.provider === item.id ? "selected" : ""}
                onClick={() => chooseProvider(item.id)}
                key={item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="model-editor-grid">
            <label>
              <span>{text.name}</span>
              <input
                value={editor.name}
                maxLength={60}
                onChange={(event) => setEditor({ ...editor, name: event.target.value })}
                required
              />
            </label>
            <label>
              <span>{text.model}</span>
              <input
                className="canonical-ltr"
                value={editor.model}
                maxLength={120}
                onChange={(event) => setEditor({ ...editor, model: event.target.value })}
                required
              />
            </label>
            <label>
              <span>{text.inputBudget}</span>
              <input
                type="number"
                min={MIN_MODEL_INPUT_TOKEN_BUDGET}
                max={MAX_MODEL_INPUT_TOKEN_BUDGET}
                step={256}
                value={editor.budget.maxInputTokens}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    budget: { ...editor.budget, maxInputTokens: event.target.valueAsNumber },
                  })
                }
                required
              />
            </label>
            <label>
              <span>{text.outputBudget}</span>
              <input
                type="number"
                min={MIN_MODEL_OUTPUT_TOKEN_BUDGET}
                max={MAX_MODEL_OUTPUT_TOKEN_BUDGET}
                step={256}
                value={editor.budget.maxOutputTokens}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    budget: { ...editor.budget, maxOutputTokens: event.target.valueAsNumber },
                  })
                }
                required
              />
            </label>
            <label className="wide">
              <span>{text.endpoint}</span>
              <input
                className="canonical-ltr"
                dir="ltr"
                value={editor.baseURL}
                maxLength={300}
                disabled={!preset?.editableEndpoint}
                onChange={(event) => setEditor({ ...editor, baseURL: event.target.value })}
                required
              />
            </label>
            {preset?.editableProtocol && (
              <label className="wide">
                <span>{text.protocol}</span>
                <span className="model-protocol-select">
                  <select
                    value={editor.protocol}
                    onChange={(event) => setEditor({ ...editor, protocol: event.target.value as ModelProtocol })}
                  >
                    <option value="responses">OpenAI Responses</option>
                    <option value="chat-completions">OpenAI-compatible Chat Completions</option>
                    <option value="anthropic-messages">Anthropic Messages</option>
                    <option value="gemini-generate-content">Gemini generateContent</option>
                  </select>
                  <ChevronDown />
                </span>
              </label>
            )}
            <label className="wide">
              <span>{text.apiKey}</span>
              <span className="model-key-input">
                <input
                  className="canonical-ltr"
                  dir="ltr"
                  type={showKey ? "text" : "password"}
                  value={editor.apiKey}
                  maxLength={512}
                  placeholder={editor.id ? text.keepKey : text.keyPlaceholder}
                  onChange={(event) => setEditor({ ...editor, apiKey: event.target.value })}
                  required={!editor.id}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((shown) => !shown)}
                  aria-label={showKey ? text.hideKey : text.showKey}
                >
                  {showKey ? <EyeOff /> : <Eye />}
                </button>
              </span>
            </label>
          </div>
          {!!models.length && (
            <label className="model-list-select">
              <span>{text.chooseModel}</span>
              <span>
                <select value={editor.model} onChange={(event) => setEditor({ ...editor, model: event.target.value })}>
                  {!models.includes(editor.model) && <option value={editor.model}>{editor.model}</option>}
                  {models.map((model) => (
                    <option value={model} key={model}>
                      {model}
                    </option>
                  ))}
                </select>
                <ChevronDown />
              </span>
            </label>
          )}
          <p className="model-editor-hint">{text.modelHint}</p>
          {error && (
            <p className="model-manager-error" role="alert">
              {error}
            </p>
          )}
          <footer>
            <button type="button" onClick={() => setEditor(null)} disabled={submitting}>
              {text.cancel}
            </button>
            <button type="button" onClick={() => void fetchModels()} disabled={submitting}>
              {submittingAction === "models" ? <LoaderCircle className="agent-spinner" /> : <RefreshCw />}
              {submittingAction === "models" ? text.testing : text.test}
            </button>
            <button type="submit" className="primary" disabled={submitting}>
              {submittingAction === "save" ? <LoaderCircle className="agent-spinner" /> : <ShieldCheck />}
              {submittingAction === "save" ? text.saving : text.save}
            </button>
          </footer>
        </form>
      )}
      {error && !editor && (
        <p className="model-manager-error" role="alert">
          {error}
        </p>
      )}
      {!compact && (
        <p className="model-manager-safety">
          <ShieldCheck />
          {text.safety}
        </p>
      )}
    </section>
  );
}
