"use client";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  FileJson2,
  Import,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
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
import {
  MAX_MODEL_PROFILE_IMPORT_BYTES,
  ModelProfileImportError,
  modelProfileImportReview,
  parseModelProfileImport,
  type ModelProfileImportErrorCode,
  type ModelProfileImportResult,
} from "../lib/model-profile-import";
import { localizeOrbitCopy, orbitText, type OrbitLocale } from "../lib/localization";
import type { ModelProviderStatus } from "../lib/model-preference";

export const MODEL_MANAGER_BASE_COPY = {
  "zh-CN": {
    loading: "正在读取模型配置…",
    unavailable: "当前服务没有启用加密凭据库；仍可使用部署模型或本地模式。",
    empty: "还没有个人模型配置。添加后即可在这里一键切换。",
    add: "添加供应商",
    import: "导入配置",
    importTitle: "导入一个模型配置",
    importBody: "支持 Orbit JSON 或 CC Switch 的单供应商导入链接。Orbit 会先检查并预览，不会直接保存。",
    importPaste: "粘贴配置或 CC Switch 链接",
    importPlaceholder: "粘贴一个 JSON 对象，或 ccswitch://v1/import?resource=provider…",
    importFile: "选择 JSON / 文本文件",
    importLimit: "最大 20 KB",
    importReview: "检查配置",
    importReviewTitle: "确认导入内容",
    importSource: "来源",
    importOrbitJson: "Orbit JSON",
    importCcSwitch: "CC Switch 导入链接",
    importCredential: "凭据",
    importCredentialDetected: "已检测到；预览中不显示",
    importCredentialMissing: "未包含；使用配置后请在密码框填写",
    importIgnoredFields: "已忽略不支持的字段",
    importUse: "使用此配置",
    importChooseAnother: "重新选择",
    importSafety:
      "导入内容只在当前页面内存中检查；不会访问远程 config URL，不会写入 localStorage，也不会在你点击“保存并启用”前写入凭据库。",
    importErrorEmpty: "请先粘贴或选择一个模型配置。",
    importErrorLarge: "配置文件过大；请选择小于 20 KB 的单个配置。",
    importErrorJson: "配置不是有效的 JSON，或 CC Switch 内嵌配置无效。",
    importErrorLink: "仅支持 Orbit JSON 或 ccswitch://v1/import 的单供应商链接。",
    importErrorRemote: "为保护凭据，Orbit 不会从远程 config URL 导入配置。",
    importErrorBatch: "当前凭据库容量有限，请一次导入一个模型配置。",
    importErrorAmbiguous: "配置包含重复字段或多个 endpoint；请一次只保留一个。",
    importErrorFields: "配置没有包含可识别的供应商或有效模型 ID。",
    importErrorEndpoint: "自定义 endpoint 必须是公开的 HTTPS API 基础地址。",
    importErrorRead: "Orbit 无法读取这个配置文件。",
    active: "正在使用",
    enable: "启用",
    edit: "编辑",
    remove: "删除",
    confirmRemove: "再次点击删除",
    deployment: "部署模型",
    deploymentBody: "由 Orbit 服务管理员配置，只显示非敏感状态。",
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
    failoverHint: "主模型失败时，Orbit 才可按配置顺序把同一有界内容发送给另一供应商。默认关闭。",
    healthUnknown: "尚未检查",
    healthHealthy: "最近调用正常",
    healthUnhealthy: "暂时避开",
    readError: "Orbit 暂时无法读取模型配置；你可以稍后重试。",
    updateError: "Orbit 暂时无法完成模型配置；你的原配置没有改变。",
    modelsError: "Orbit 暂时无法验证模型目录；配置尚未保存。",
  },
  en: {
    loading: "Reading model profiles…",
    unavailable:
      "This server has not enabled the encrypted credential vault. The deployment model and local mode remain available.",
    empty: "No personal model profiles yet. Add one to switch providers here.",
    add: "Add provider",
    import: "Import config",
    importTitle: "Import one model profile",
    importBody:
      "Use Orbit JSON or a CC Switch single-provider import link. Orbit reviews it first and never saves it immediately.",
    importPaste: "Paste config or CC Switch link",
    importPlaceholder: "Paste one JSON object, or ccswitch://v1/import?resource=provider…",
    importFile: "Choose JSON / text file",
    importLimit: "20 KB maximum",
    importReview: "Review config",
    importReviewTitle: "Confirm imported configuration",
    importSource: "Source",
    importOrbitJson: "Orbit JSON",
    importCcSwitch: "CC Switch import link",
    importCredential: "Credential",
    importCredentialDetected: "Detected; never shown in preview",
    importCredentialMissing: "Not included; enter it in the password field after using this config",
    importIgnoredFields: "Ignored unsupported fields",
    importUse: "Use this configuration",
    importChooseAnother: "Choose another",
    importSafety:
      "Import content is reviewed only in this page's memory. Orbit never follows remote config URLs, writes it to localStorage, or stores a credential before you choose Save & enable.",
    importErrorEmpty: "Paste or choose one model profile first.",
    importErrorLarge: "That file is too large. Choose one configuration smaller than 20 KB.",
    importErrorJson: "The configuration is not valid JSON, or its embedded CC Switch config is invalid.",
    importErrorLink: "Use Orbit JSON or one ccswitch://v1/import provider link.",
    importErrorRemote: "To protect credentials, Orbit does not import from remote config URLs.",
    importErrorBatch: "The credential vault is bounded; import one model profile at a time.",
    importErrorAmbiguous: "The configuration repeats a field or contains multiple endpoints. Keep one endpoint.",
    importErrorFields: "The configuration does not identify a supported provider and valid model ID.",
    importErrorEndpoint: "A custom endpoint must be a public HTTPS API base URL.",
    importErrorRead: "Orbit could not read that configuration file.",
    active: "Active",
    enable: "Enable",
    edit: "Edit",
    remove: "Delete",
    confirmRemove: "Click again to delete",
    deployment: "Deployment model",
    deploymentBody: "Managed by the Orbit server; only non-secret status is shown.",
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
      "Only after the primary model fails may Orbit send the same bounded content to another configured provider. Off by default.",
    healthUnknown: "Not checked yet",
    healthHealthy: "Recent call succeeded",
    healthUnhealthy: "Temporarily avoided",
    readError: "Orbit could not read model configurations. Try again in a moment.",
    updateError: "Orbit could not complete that model change. Your existing configuration is unchanged.",
    modelsError: "Orbit could not verify that model catalog. The configuration was not saved.",
  },
} as const;

function modelManagerCopy(locale: OrbitLocale) {
  return localizeOrbitCopy(locale, MODEL_MANAGER_BASE_COPY.en, MODEL_MANAGER_BASE_COPY["zh-CN"]);
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

function modelImportErrorMessage(code: ModelProfileImportErrorCode, text: ReturnType<typeof modelManagerCopy>) {
  const messages: Record<ModelProfileImportErrorCode, string> = {
    empty: text.importErrorEmpty,
    "too-large": text.importErrorLarge,
    "invalid-json": text.importErrorJson,
    "unsupported-link": text.importErrorLink,
    "remote-config": text.importErrorRemote,
    batch: text.importErrorBatch,
    ambiguous: text.importErrorAmbiguous,
    "invalid-fields": text.importErrorFields,
    "invalid-endpoint": text.importErrorEndpoint,
  };
  return messages[code];
}

export function ModelProfileManager({
  compact = false,
  locale,
  onStatusChange,
}: {
  compact?: boolean;
  locale: OrbitLocale;
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
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<ModelProfileImportResult | null>(null);
  const [importError, setImportError] = useState("");
  const managerRef = useRef<HTMLElement>(null);
  const activeSurfaceRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement>(null);
  const surfaceWasOpenRef = useRef(false);
  const canAdd = Boolean(state?.vaultAvailable && state.profiles.length < MAX_MODEL_PROFILES);
  const preset = useMemo(() => MODEL_PROVIDER_PRESETS.find((item) => item.id === editor?.provider), [editor?.provider]);
  const importReview = useMemo(() => (importResult ? modelProfileImportReview(importResult) : null), [importResult]);
  const editorOpen = Boolean(editor);
  const importReviewOpen = Boolean(importResult);

  useEffect(() => {
    const surfaceOpen = editorOpen || importOpen;
    const frame = window.requestAnimationFrame(() => {
      if (surfaceOpen) {
        managerRef.current?.scrollTo({ top: 0, behavior: "auto" });
        managerRef.current?.closest<HTMLElement>(".welcome-page")?.scrollTo({ top: 0, behavior: "auto" });
        activeSurfaceRef.current?.focus({ preventScroll: true });
      } else if (surfaceWasOpenRef.current) returnFocusRef.current?.focus({ preventScroll: true });
      surfaceWasOpenRef.current = surfaceOpen;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editorOpen, importOpen, importReviewOpen]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/model-profiles", { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as ModelProfilesState & { error?: string };
        if (!response.ok) throw new Error(text.readError);
        setState(payload);
        onStatusChange(statusFromState(payload));
        setError("");
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : text.readError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [onStatusChange, text.readError]);

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
      if (!response.ok) throw new Error(text.updateError);
      setState(payload);
      onStatusChange(statusFromState(payload));
      setEditor(null);
      setModels([]);
      setShowKey(false);
      setPendingDeleteId("");
      setImportOpen(false);
      setImportText("");
      setImportResult(null);
      setImportError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.updateError);
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
      if (!response.ok || !Array.isArray(payload.models)) throw new Error(text.modelsError);
      setModels(payload.models);
      if (!editor.model && payload.models[0]) setEditor({ ...editor, model: payload.models[0] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.modelsError);
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

  function closeImport() {
    setImportOpen(false);
    setImportText("");
    setImportResult(null);
    setImportError("");
  }

  function reviewImportedSource(source: string) {
    try {
      const result = parseModelProfileImport(source);
      setImportResult(result);
      setImportText("");
      setImportError("");
    } catch (cause) {
      setImportResult(null);
      setImportError(
        cause instanceof ModelProfileImportError ? modelImportErrorMessage(cause.code, text) : text.importErrorFields,
      );
    }
  }

  async function chooseImportFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      if (file.size > MAX_MODEL_PROFILE_IMPORT_BYTES) {
        throw new ModelProfileImportError("too-large", "The model profile import is too large.");
      }
      reviewImportedSource(await file.text());
    } catch (cause) {
      setImportResult(null);
      setImportError(
        cause instanceof ModelProfileImportError ? modelImportErrorMessage(cause.code, text) : text.importErrorRead,
      );
    }
  }

  function useImportedProfile() {
    if (!importResult) return;
    setEditor({ ...importResult.draft, budget: { ...importResult.draft.budget } });
    setModels([]);
    setShowKey(false);
    setPendingDeleteId("");
    setError("");
    closeImport();
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
      aria-label={orbitText(locale, "Personal model profiles", "个人模型配置")}
      ref={managerRef}
    >
      {!editor && !importOpen && state?.deployment.configured && (
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
      {!editor &&
        !importOpen &&
        state?.profiles.map((profile) => (
          <div
            className={`model-profile-card ${state.activeProfileId === profile.id ? "active" : ""}`}
            key={profile.id}
          >
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
                onClick={(event) => {
                  returnFocusRef.current = event.currentTarget;
                  closeImport();
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
      {!editor &&
        !importOpen &&
        state &&
        (state.profiles.length > 1 || (state.profiles.length > 0 && state.deployment.configured)) && (
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
      {!editor && !importOpen && !state?.profiles.length && !state?.deployment.configured && (
        <p className="model-manager-empty">{text.empty}</p>
      )}
      {!editor && !importOpen && !state?.vaultAvailable && (
        <p className="model-manager-warning">
          <ShieldCheck />
          {text.unavailable}
        </p>
      )}

      {!editor && canAdd && !importOpen && (
        <div className="model-profile-onramps">
          <button
            className="model-add-provider"
            type="button"
            onClick={(event) => {
              returnFocusRef.current = event.currentTarget;
              closeImport();
              setEditor(blankProfile());
            }}
          >
            <Plus />
            {text.add}
            <span>
              {state?.profiles.length ?? 0}/{MAX_MODEL_PROFILES}
            </span>
          </button>
          <button
            className="model-import-provider"
            type="button"
            onClick={(event) => {
              returnFocusRef.current = event.currentTarget;
              setImportOpen(true);
              setImportText("");
              setImportResult(null);
              setImportError("");
            }}
          >
            <Import />
            {text.import}
          </button>
        </div>
      )}

      {!editor && canAdd && importOpen && (
        <section
          className="model-profile-import"
          aria-label={text.importTitle}
          ref={(node) => {
            activeSurfaceRef.current = node;
          }}
          tabIndex={-1}
        >
          <header>
            <span>
              <FileJson2 aria-hidden="true" />
            </span>
            <div>
              <small>{text.import}</small>
              <strong>{importReview ? text.importReviewTitle : text.importTitle}</strong>
            </div>
            <button type="button" onClick={closeImport} aria-label={text.cancel}>
              <X />
            </button>
          </header>

          {importReview ? (
            <>
              <dl className="model-import-review">
                <div>
                  <dt>{text.importSource}</dt>
                  <dd>{importReview.source === "orbit-json" ? text.importOrbitJson : text.importCcSwitch}</dd>
                </div>
                <div>
                  <dt>{text.preset}</dt>
                  <dd>{MODEL_PROVIDER_PRESETS.find((item) => item.id === importReview.provider)?.label}</dd>
                </div>
                <div>
                  <dt>{text.name}</dt>
                  <dd>{importReview.name}</dd>
                </div>
                <div>
                  <dt>{text.protocol}</dt>
                  <dd>{modelProtocolLabel(importReview.protocol)}</dd>
                </div>
                <div className="wide">
                  <dt>{text.endpoint}</dt>
                  <dd>
                    <code className="canonical-ltr" dir="ltr">
                      {importReview.baseURL}
                    </code>
                  </dd>
                </div>
                <div>
                  <dt>{text.model}</dt>
                  <dd>
                    <code className="canonical-ltr" dir="ltr">
                      {importReview.model}
                    </code>
                  </dd>
                </div>
                <div>
                  <dt>{text.importCredential}</dt>
                  <dd className={importReview.credentialDetected ? "credential-detected" : "credential-missing"}>
                    {importReview.credentialDetected ? text.importCredentialDetected : text.importCredentialMissing}
                  </dd>
                </div>
                <div>
                  <dt>{text.inputBudget}</dt>
                  <dd>
                    {importReview.budget.maxInputTokens.toLocaleString(locale)} {text.tokenUnit}
                  </dd>
                </div>
                <div>
                  <dt>{text.outputBudget}</dt>
                  <dd>
                    {importReview.budget.maxOutputTokens.toLocaleString(locale)} {text.tokenUnit}
                  </dd>
                </div>
              </dl>
              {importReview.warnings.some((warning) => warning.code === "unsupported-fields") && (
                <p className="model-import-warning">
                  {text.importIgnoredFields}:{" "}
                  {importReview.warnings.reduce(
                    (count, warning) => count + (warning.code === "unsupported-fields" ? warning.count : 0),
                    0,
                  )}
                </p>
              )}
              <p className="model-import-safety">
                <ShieldCheck aria-hidden="true" />
                {text.importSafety}
              </p>
              <footer>
                <button
                  type="button"
                  onClick={() => {
                    setImportResult(null);
                    setImportText("");
                    setImportError("");
                  }}
                >
                  <ArrowLeft aria-hidden="true" />
                  {text.importChooseAnother}
                </button>
                <button type="button" className="primary" onClick={useImportedProfile}>
                  <Check aria-hidden="true" />
                  {text.importUse}
                </button>
              </footer>
            </>
          ) : (
            <>
              <p>{text.importBody}</p>
              <label className="model-import-paste">
                <span>{text.importPaste}</span>
                <textarea
                  className="canonical-ltr"
                  dir="ltr"
                  value={importText}
                  maxLength={MAX_MODEL_PROFILE_IMPORT_BYTES}
                  placeholder={text.importPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => {
                    setImportText(event.target.value);
                    setImportError("");
                  }}
                />
              </label>
              <div className="model-import-file-row">
                <label>
                  <Upload aria-hidden="true" />
                  {text.importFile}
                  <input
                    className="visually-hidden"
                    type="file"
                    accept=".json,.txt,application/json,text/plain"
                    aria-label={text.importFile}
                    onChange={(event) => void chooseImportFile(event)}
                  />
                </label>
                <small>{text.importLimit}</small>
              </div>
              {importError && (
                <p className="model-manager-error" role="alert">
                  {importError}
                </p>
              )}
              <p className="model-import-safety">
                <ShieldCheck aria-hidden="true" />
                {text.importSafety}
              </p>
              <footer>
                <button type="button" onClick={closeImport}>
                  {text.cancel}
                </button>
                <button type="button" className="primary" onClick={() => reviewImportedSource(importText)}>
                  <FileJson2 aria-hidden="true" />
                  {text.importReview}
                </button>
              </footer>
            </>
          )}
        </section>
      )}

      {editor && (
        <form
          className="model-profile-editor"
          ref={(node) => {
            activeSurfaceRef.current = node;
          }}
          tabIndex={-1}
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
            {MODEL_PROVIDER_PRESETS.filter((item) => item.locality === "cloud").map((item) => (
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
