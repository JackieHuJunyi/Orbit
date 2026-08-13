"use client";

import {
  ArrowRight,
  Check,
  Command,
  FileText,
  FolderOpen,
  Globe2,
  Keyboard,
  KeyRound,
  Laptop,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ModelProfileManager } from "./model-profile-manager";
import { localeDisplayName, type RuneLocale } from "../lib/localization";
import { type ModelProviderStatus, type RuneModelMode } from "../lib/model-preference";

export type WelcomeAction = "guide" | "import" | "sample";
export type WelcomeStep = "welcome" | "model" | "shortcuts" | "ready";
type ShortcutId = "open" | "save" | "agent";

const GREETINGS = {
  "zh-CN": ["你好", "Hello", "Bonjour", "こんにちは", "안녕하세요", "Hola", "Halo"],
  en: ["Hello", "你好", "Bonjour", "Hola", "こんにちは", "안녕하세요", "Halo"],
} as const;

const copy = {
  "zh-CN": {
    skip: "跳过",
    close: "关闭教程",
    welcomeEyebrow: "欢迎来到 Rune",
    welcomeTitle: "让每一份工作，都有清晰的来处。",
    welcomeBody: "文档、数据、图表和演示共享同一套可读源内容。你专注判断，Rune 负责把变化实时连接起来。",
    begin: "继续设置",
    local: "本地优先",
    review: "先审后写",
    live: "实时编译",
    languageEyebrow: "语言",
    languageTitle: "选择 Rune 使用的语言",
    languageBody: "已根据这台设备做出推荐，之后可随时更改。",
    recommended: "系统推荐",
    continue: "继续",
    modelEyebrow: "模型连接",
    modelTitle: "选择 Rune 如何使用模型",
    modelBody: "模型只负责提出受约束的修改；源文件、验证与是否写入仍由 Rune 和你决定。",
    checkingModel: "正在检查模型连接…",
    connectedModel: "模型已连接",
    connectedModelBody: "Rune 会使用当前启用的安全配置。",
    noModel: "尚未连接模型",
    noModelBody: "当前仍可使用确定性的本地规划器，之后可从帮助重新设置。",
    useConnected: "使用已连接模型",
    useConnectedBody: "通过 Rune 的服务端适配器生成先审后写的修改",
    useLocal: "仅使用本地模式",
    useLocalBody: "不向模型服务发送内容，使用内置确定性规划器",
    recheck: "重新检查",
    modelSafety: "个人密钥会被加密为 HttpOnly 凭据；浏览器脚本不能读回它，Rune 也不会把它写进工作区、localStorage、Artifact 或 Git。",
    modelUnavailable: "无法读取模型状态；你可以先使用本地模式。",
    shortcutEyebrow: "快速上手",
    shortcutTitle: "亲手试试三个快捷键",
    shortcutBody: "按下对应按键，Rune 会在这里确认。你也可以稍后从本地指南重新学习。",
    openTitle: "打开文件",
    openBody: "选择一个本地文件开始工作",
    saveTitle: "保存恢复点",
    saveBody: "为当前源内容建立可恢复版本",
    agentTitle: "规划 AI 修改",
    agentBody: "让 Agent 提出改动，但暂不写入",
    tried: "已完成",
    skipTutorial: "稍后学习",
    readyEyebrow: "准备好了",
    readyTitle: "你的工作区，由你掌控。",
    readyBody: "先阅读保存在工作区里的 Rune 指南、导入自己的文件，或者打开完整示例。",
    guide: "打开本地指南",
    guideBody: "从一份可编辑的 Markdown 说明开始",
    import: "导入我的文件",
    importBody: "文件会先在当前设备上读取",
    sample: "探索示例工作区",
    sampleBody: "查看数据到报告与演示的完整链路",
  },
  en: {
    skip: "Skip",
    close: "Close tutorial",
    welcomeEyebrow: "Welcome to Rune",
    welcomeTitle: "Every piece of work, with a clear source.",
    welcomeBody: "Documents, data, charts, and presentations share one readable source system. You make the judgment; Rune keeps every change connected.",
    begin: "Continue setup",
    local: "Local first",
    review: "Review before write",
    live: "Live compilation",
    languageEyebrow: "Language",
    languageTitle: "Choose your Rune language",
    languageBody: "Recommended from this device. You can change it whenever you like.",
    recommended: "System recommendation",
    continue: "Continue",
    modelEyebrow: "Model connection",
    modelTitle: "Choose how Rune uses a model",
    modelBody: "A model only proposes bounded changes. Source, validation, and the final write remain under Rune and your control.",
    checkingModel: "Checking the model connection…",
    connectedModel: "Model connected",
    connectedModelBody: "Rune will use the currently enabled secure profile.",
    noModel: "No model connected",
    noModelBody: "Rune still works with deterministic local planners. You can revisit this from Help.",
    useConnected: "Use connected model",
    useConnectedBody: "Generate review-before-write changes through Rune's server adapter",
    useLocal: "Use local mode only",
    useLocalBody: "Send nothing to a model service and use built-in deterministic planners",
    recheck: "Check again",
    modelSafety: "A personal key is encrypted into an HttpOnly credential that browser scripts cannot read back; Rune never writes it to the workspace, localStorage, an Artifact, or Git.",
    modelUnavailable: "Rune could not read model status. You can continue in local mode.",
    shortcutEyebrow: "Quick start",
    shortcutTitle: "Try three shortcuts yourself",
    shortcutBody: "Press each shortcut and Rune will confirm it here. You can revisit these lessons in the local guide.",
    openTitle: "Open a file",
    openBody: "Choose a local file to begin",
    saveTitle: "Save a checkpoint",
    saveBody: "Capture a recoverable source version",
    agentTitle: "Plan an AI change",
    agentBody: "Ask the Agent to propose, without writing",
    tried: "Done",
    skipTutorial: "Learn later",
    readyEyebrow: "Ready",
    readyTitle: "Your workspace, under your control.",
    readyBody: "Read the Rune guide stored in your workspace, import your own file, or explore the complete sample.",
    guide: "Open local guide",
    guideBody: "Start with an editable Markdown reference",
    import: "Import my file",
    importBody: "The file is read on this device first",
    sample: "Explore sample workspace",
    sampleBody: "See the full data-to-report-and-deck chain",
  },
} as const;

function ShortcutKey({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}

export function WelcomeExperience({
  detectedLocale,
  locale,
  startAt = "welcome",
  dismissible = false,
  modelMode,
  onLocaleChange,
  onModelModeChange,
  onComplete,
  onDismiss,
}: {
  detectedLocale: RuneLocale;
  locale: RuneLocale;
  startAt?: WelcomeStep;
  dismissible?: boolean;
  modelMode: RuneModelMode;
  onLocaleChange: (locale: RuneLocale) => void;
  onModelModeChange: (mode: RuneModelMode) => void;
  onComplete: (action: WelcomeAction) => void;
  onDismiss?: () => void;
}) {
  const [step, setStep] = useState<WelcomeStep>(startAt);
  const [completedShortcuts, setCompletedShortcuts] = useState<ShortcutId[]>([]);
  const [modelStatus, setModelStatus] = useState<ModelProviderStatus | null>(null);
  const [modelStatusError, setModelStatusError] = useState("");
  const [checkingModel, setCheckingModel] = useState(true);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [modifier] = useState(() => (
    typeof navigator !== "undefined" && !/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
      ? "Ctrl"
      : "⌘"
  ));
  const text = copy[locale];
  const greetings = GREETINGS[locale];
  const steps = useMemo<WelcomeStep[]>(() => ["welcome", "model", "shortcuts", "ready"], []);

  useEffect(() => {
    if (step !== "welcome" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setGreetingIndex((current) => (current + 1) % greetings.length);
    }, 1_850);
    return () => window.clearInterval(timer);
  }, [greetings, step]);

  async function checkModelStatus() {
    setCheckingModel(true);
    setModelStatusError("");
    try {
      const response = await fetch("/api/model-status", { cache: "no-store" });
      if (!response.ok) throw new Error("status unavailable");
      const status = await response.json() as ModelProviderStatus;
      if (typeof status.configured !== "boolean") throw new Error("invalid status");
      setModelStatus(status);
    } catch {
      setModelStatus(null);
      setModelStatusError(text.modelUnavailable);
    } finally {
      setCheckingModel(false);
    }
  }

  useEffect(() => {
    if (step !== "model") return;
    const controller = new AbortController();
    void fetch("/api/model-status", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("status unavailable");
        return response.json() as Promise<ModelProviderStatus>;
      })
      .then((status) => {
        if (typeof status.configured !== "boolean") throw new Error("invalid status");
        setModelStatus(status);
        setModelStatusError("");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setModelStatus(null);
        setModelStatusError(copy[locale].modelUnavailable);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCheckingModel(false);
      });
    return () => controller.abort();
  }, [locale, step]);

  useEffect(() => {
    if (step !== "shortcuts") return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const modified = event.metaKey || event.ctrlKey;
      let shortcut: ShortcutId | null = null;
      if (modified && event.key.toLowerCase() === "o") shortcut = "open";
      if (modified && event.key.toLowerCase() === "s") shortcut = "save";
      if (modified && event.key === "Enter") shortcut = "agent";
      if (!shortcut) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setCompletedShortcuts((current) => current.includes(shortcut) ? current : [...current, shortcut]);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [step]);

  const shortcutRows = [
    { id: "open" as const, title: text.openTitle, body: text.openBody, keyName: "O" },
    { id: "save" as const, title: text.saveTitle, body: text.saveBody, keyName: "S" },
    { id: "agent" as const, title: text.agentTitle, body: text.agentBody, keyName: "↵" },
  ];
  const handleProfileStatus = useCallback((status: ModelProviderStatus) => {
    setModelStatus(status);
    setModelStatusError("");
    onModelModeChange(status.configured ? "auto" : "local");
  }, [onModelModeChange]);

  return (
    <div className="welcome-backdrop" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <section className="welcome-window">
        <header className="welcome-chrome">
          <div className="welcome-chrome-brand" aria-hidden="true"><span>R</span><strong>Rune</strong></div>
          <div className="welcome-progress" aria-label={String(steps.indexOf(step) + 1) + " of " + String(steps.length)}>
            {steps.map((item) => (
              <span
                className={item === step ? "active" : steps.indexOf(item) < steps.indexOf(step) ? "complete" : ""}
                key={item}
              />
            ))}
          </div>
          {dismissible ? (
            <button type="button" onClick={onDismiss} aria-label={text.close} title={text.close}><X /></button>
          ) : (
            <button type="button" onClick={() => { onModelModeChange("local"); setStep("ready"); }}>{text.skip}</button>
          )}
        </header>

        <div className={"welcome-page welcome-" + step}>
          {step === "welcome" && (
            <>
              <div className="welcome-intro-grid">
                <div className="welcome-intro-copy">
                  <div className="welcome-greeting-stage" aria-hidden="true">
                    <span className="welcome-greeting" key={`${locale}-${greetingIndex}`}>{greetings[greetingIndex]}</span>
                    <i>Rune</i>
                  </div>
                  <span className="welcome-eyebrow">{text.welcomeEyebrow}</span>
                  <h1 id="welcome-title">{text.welcomeTitle}</h1>
                  <p>{text.welcomeBody}</p>
                  <div className="welcome-promises" aria-label="Rune principles">
                    <span><ShieldCheck /><b>{text.local}</b></span>
                    <span><Check /><b>{text.review}</b></span>
                    <span><Sparkles /><b>{text.live}</b></span>
                  </div>
                </div>
                <section className="welcome-language-card" aria-labelledby="welcome-language-title">
                  <div className="welcome-language-heading">
                    <span><Globe2 aria-hidden="true" /></span>
                    <div>
                      <strong id="welcome-language-title">{text.languageTitle}</strong>
                      <small>{text.languageBody}</small>
                    </div>
                  </div>
                  <div className="language-options" role="radiogroup" aria-label={text.languageTitle}>
                    {(["zh-CN", "en"] as const).map((option) => (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={locale === option}
                        className={locale === option ? "selected" : ""}
                        onClick={() => onLocaleChange(option)}
                        key={option}
                      >
                        <span className="language-monogram">{option === "zh-CN" ? "文" : "A"}</span>
                        <span>
                          <strong>{localeDisplayName(option)}</strong>
                          <small>{option === detectedLocale ? text.recommended : option === "zh-CN" ? "Chinese (Simplified)" : "英语"}</small>
                        </span>
                        {locale === option && <Check />}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
              <button className="welcome-primary" type="button" onClick={() => { setCheckingModel(true); setStep("model"); }}>{text.begin}<ArrowRight /></button>
            </>
          )}

          {step === "model" && (
            <>
              <div className="welcome-icon-disc"><KeyRound /></div>
              <span className="welcome-eyebrow">{text.modelEyebrow}</span>
              <h1 id="welcome-title">{text.modelTitle}</h1>
              <p>{text.modelBody}</p>
              <div className="model-setup-panel">
                <div className={`model-status-card ${modelStatus?.configured ? "connected" : ""}`} role="status">
                  <span>{modelStatus?.configured ? <Check /> : checkingModel ? <RefreshCw className="agent-spinner" /> : <Server />}</span>
                  <div>
                    <strong>{checkingModel ? text.checkingModel : modelStatus?.configured ? text.connectedModel : text.noModel}</strong>
                    <small>{modelStatusError || (modelStatus?.configured
                      ? `${modelStatus.profileName ?? (modelStatus.provider === "openai" ? "OpenAI" : "Model")} · ${modelStatus.model ?? "Model"} · ${text.connectedModelBody}`
                      : text.noModelBody)}</small>
                  </div>
                  <button type="button" onClick={() => void checkModelStatus()} disabled={checkingModel}><RefreshCw />{text.recheck}</button>
                </div>
                <div className="model-mode-options" role="radiogroup" aria-label={text.modelTitle}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={modelMode === "auto" && Boolean(modelStatus?.configured)}
                    className={modelMode === "auto" && modelStatus?.configured ? "selected" : ""}
                    disabled={!modelStatus?.configured}
                    onClick={() => onModelModeChange("auto")}
                  >
                    <span><Server /></span><span><strong>{text.useConnected}</strong><small>{text.useConnectedBody}</small></span>{modelMode === "auto" && modelStatus?.configured ? <Check /> : null}
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={modelMode === "local"}
                    className={modelMode === "local" ? "selected" : ""}
                    onClick={() => onModelModeChange("local")}
                  >
                    <span><Laptop /></span><span><strong>{text.useLocal}</strong><small>{text.useLocalBody}</small></span>{modelMode === "local" ? <Check /> : null}
                  </button>
                </div>
                {!checkingModel && <ModelProfileManager locale={locale} onStatusChange={handleProfileStatus} />}
                <p className="model-safety-note"><ShieldCheck />{text.modelSafety}</p>
              </div>
              <button className="welcome-primary" type="button" onClick={() => {
                if (!modelStatus?.configured) onModelModeChange("local");
                setStep("shortcuts");
              }}>{text.continue}<ArrowRight /></button>
            </>
          )}

          {step === "shortcuts" && (
            <>
              <div className="welcome-icon-disc"><Keyboard /></div>
              <span className="welcome-eyebrow">{text.shortcutEyebrow}</span>
              <h1 id="welcome-title">{text.shortcutTitle}</h1>
              <p>{text.shortcutBody}</p>
              <div className="shortcut-lessons">
                {shortcutRows.map((item) => {
                  const complete = completedShortcuts.includes(item.id);
                  return (
                    <div className={complete ? "complete" : ""} key={item.id}>
                      <span className="shortcut-status">{complete ? <Check /> : <Command />}</span>
                      <span><strong>{item.title}</strong><small>{complete ? text.tried : item.body}</small></span>
                      <span className="shortcut-keys"><ShortcutKey>{modifier}</ShortcutKey><ShortcutKey>{item.keyName}</ShortcutKey></span>
                    </div>
                  );
                })}
              </div>
              <button className="welcome-primary" type="button" onClick={() => setStep("ready")}>
                {completedShortcuts.length === shortcutRows.length ? text.continue : text.skipTutorial}<ArrowRight />
              </button>
            </>
          )}

          {step === "ready" && (
            <>
              <div className="welcome-icon-disc ready"><Sparkles /></div>
              <span className="welcome-eyebrow">{text.readyEyebrow}</span>
              <h1 id="welcome-title">{text.readyTitle}</h1>
              <p>{text.readyBody}</p>
              <div className="welcome-actions">
                <button type="button" className="featured" onClick={() => onComplete("guide")}><span><FileText /></span><span><strong>{text.guide}</strong><small>{text.guideBody}</small></span><ArrowRight /></button>
                <button type="button" onClick={() => onComplete("import")}><span><FolderOpen /></span><span><strong>{text.import}</strong><small>{text.importBody}</small></span><ArrowRight /></button>
                <button type="button" onClick={() => onComplete("sample")}><span><Sparkles /></span><span><strong>{text.sample}</strong><small>{text.sampleBody}</small></span><ArrowRight /></button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
