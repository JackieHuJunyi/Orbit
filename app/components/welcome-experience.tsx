"use client";

import {
  ArrowRight,
  Check,
  ClipboardList,
  Command,
  FileText,
  Globe2,
  Keyboard,
  Presentation,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { HandwrittenGreeting } from "./handwritten-greeting";
import {
  localeDirection,
  localeDisplayName,
  localeMonogram,
  localizeRuneCopy,
  runeGreetingSequence,
  RUNE_LOCALE_REGISTRY,
  type RuneLocale,
} from "../lib/localization";
import { type RuneModelMode } from "../lib/model-preference";
import { resetFluidSurface, trackFluidSurface } from "../lib/fluid-surface";
import { workspaceViewFromKeyboardShortcut } from "../lib/workspace-layout";

const WelcomeModelStep = lazy(() =>
  import("./welcome-model-step").then((module) => ({ default: module.WelcomeModelStep })),
);

export type WelcomeAction = "guide" | "review" | "briefing" | "sample";
export type WelcomeStep = "welcome" | "model" | "shortcuts" | "ready";
type ShortcutId = "open" | "save" | "agent" | "view";

export const WELCOME_BASE_COPY = {
  "zh-CN": {
    skip: "跳过",
    close: "关闭教程",
    welcomeEyebrow: "欢迎来到 Rune",
    welcomeTitle: "让每一份工作，都有清晰的来处。",
    welcomeBody: "文档、数据、图表和演示共享同一套可读源内容。你专注判断，Rune 负责把变化实时连接起来。",
    begin: "继续设置",
    local: "本地优先",
    reviewFirst: "先审后写",
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
    modelSafety:
      "个人密钥会被加密为 HttpOnly 凭据；浏览器脚本不能读回它，Rune 也不会把它写进工作区、localStorage、Artifact 或 Git。",
    modelUnavailable: "无法读取模型状态；你可以先使用本地模式。",
    shortcutEyebrow: "快速上手",
    shortcutTitle: "亲手试试四个快捷键",
    shortcutBody: "按下对应按键，Rune 会在这里确认。你也可以稍后从本地指南重新学习。",
    openTitle: "打开文件",
    openBody: "选择一个本地文件开始工作",
    saveTitle: "保存恢复点",
    saveBody: "为当前源内容建立可恢复版本",
    agentTitle: "规划 AI 修改",
    agentBody: "让 Agent 提出改动，但暂不写入",
    viewTitle: "切换专注视图",
    viewBody: "在分栏、源内容和成品之间立即切换，不改变源文件",
    tried: "已完成",
    skipTutorial: "稍后学习",
    readyEyebrow: "准备好了",
    readyTitle: "你的工作区，由你掌控。",
    readyBody: "从一份真实经营汇报开始，或者先阅读本地指南、探索完整示例。",
    review: "从数据创建经营汇报",
    reviewBody: "导入真实数据，审核后直接确认字段、口径和交付物",
    briefing: "从文档创建演示",
    briefingBody: "导入 Word、Markdown 或 PDF，审核后生成保留来源关系的演示",
    guide: "打开本地指南",
    guideBody: "从一份可编辑的 Markdown 说明开始",
    sample: "探索示例工作区",
    sampleBody: "查看数据到报告与演示的完整链路",
  },
  en: {
    skip: "Skip",
    close: "Close tutorial",
    welcomeEyebrow: "Welcome to Rune",
    welcomeTitle: "Every piece of work, with a clear source.",
    welcomeBody:
      "Documents, data, charts, and presentations share one readable source system. You make the judgment; Rune keeps every change connected.",
    begin: "Continue setup",
    local: "Local first",
    reviewFirst: "Review before write",
    live: "Live compilation",
    languageEyebrow: "Language",
    languageTitle: "Choose your Rune language",
    languageBody: "Recommended from this device. You can change it whenever you like.",
    recommended: "System recommendation",
    continue: "Continue",
    modelEyebrow: "Model connection",
    modelTitle: "Choose how Rune uses a model",
    modelBody:
      "A model only proposes bounded changes. Source, validation, and the final write remain under Rune and your control.",
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
    modelSafety:
      "A personal key is encrypted into an HttpOnly credential that browser scripts cannot read back; Rune never writes it to the workspace, localStorage, an Artifact, or Git.",
    modelUnavailable: "Rune could not read model status. You can continue in local mode.",
    shortcutEyebrow: "Quick start",
    shortcutTitle: "Try four shortcuts yourself",
    shortcutBody:
      "Press each shortcut and Rune will confirm it here. You can revisit these lessons in the local guide.",
    openTitle: "Open a file",
    openBody: "Choose a local file to begin",
    saveTitle: "Save a checkpoint",
    saveBody: "Capture a recoverable source version",
    agentTitle: "Plan an AI change",
    agentBody: "Ask the Agent to propose, without writing",
    viewTitle: "Enter a focus view",
    viewBody: "Move instantly among Split, Source, and Preview without changing source",
    tried: "Done",
    skipTutorial: "Learn later",
    readyEyebrow: "Ready",
    readyTitle: "Your workspace, under your control.",
    readyBody: "Start with a real operating review, or read the local guide and explore the complete sample first.",
    review: "Create a review from data",
    reviewBody: "Import real data, review it, then map fields, measures, and deliverables",
    briefing: "Create presentation from document",
    briefingBody: "Import Word, Markdown, or PDF, review it, then create a source-linked presentation",
    guide: "Open local guide",
    guideBody: "Start with an editable Markdown reference",
    sample: "Explore sample workspace",
    sampleBody: "See the full data-to-report-and-deck chain",
  },
} as const;

function welcomeCopy(locale: RuneLocale) {
  return localizeRuneCopy(locale, WELCOME_BASE_COPY.en, WELCOME_BASE_COPY["zh-CN"]);
}

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
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [greetingIntroComplete, setGreetingIntroComplete] = useState(false);
  const languageOptionsRef = useRef<HTMLDivElement>(null);
  const selectedLanguageOptionRef = useRef<HTMLButtonElement>(null);
  const [modifier] = useState(() =>
    typeof navigator !== "undefined" && !/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
      ? "Ctrl"
      : "⌘",
  );
  const [optionModifier] = useState(() =>
    typeof navigator !== "undefined" && !/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
      ? "Alt"
      : "⌥",
  );
  const text = welcomeCopy(locale);
  const greetings = useMemo(() => runeGreetingSequence(locale), [locale]);
  const greeting = greetings[greetingIndex] ?? greetings[0] ?? "Hello";
  const greetingLocale = RUNE_LOCALE_REGISTRY.find((entry) => entry.greeting === greeting)?.locale ?? locale;
  const greetingCharacters =
    localeDirection(greetingLocale) === "rtl"
      ? [greeting]
      : (greeting.match(/\P{Mark}\p{Mark}*|\p{Mark}+/gu) ?? Array.from(greeting));
  const greetingCycleDuration = Math.max(5_000, Math.min(7_000, 3_600 + greetingCharacters.length * 200));
  const steps = useMemo<WelcomeStep[]>(() => ["welcome", "model", "shortcuts", "ready"], []);
  const introPhase = step === "welcome" && !greetingIntroComplete ? "writing" : "ready";

  useEffect(() => {
    if (step !== "welcome" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => {
      setGreetingIndex((current) => (current + 1) % greetings.length);
    }, greetingCycleDuration);
    return () => window.clearTimeout(timer);
  }, [greetingCycleDuration, greetingIndex, greetings.length, step]);

  useEffect(() => {
    if (step !== "welcome" || greetingIntroComplete) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fallback = window.setTimeout(() => setGreetingIntroComplete(true), reducedMotion ? 0 : 4_150);
    return () => window.clearTimeout(fallback);
  }, [greetingIntroComplete, step]);

  useEffect(() => {
    if (step !== "welcome") return;
    const frame = window.requestAnimationFrame(() => {
      const options = languageOptionsRef.current;
      const selected = selectedLanguageOptionRef.current;
      if (!options || !selected) return;
      const centeredTop = selected.offsetTop - (options.clientHeight - selected.offsetHeight) / 2;
      const maximumTop = Math.max(0, options.scrollHeight - options.clientHeight);
      options.scrollTop = Math.min(maximumTop, Math.max(0, centeredTop));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [locale, step]);

  useEffect(() => {
    if (step !== "shortcuts") return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const modified = event.metaKey || event.ctrlKey;
      let shortcut: ShortcutId | null = null;
      if (modified && event.key.toLowerCase() === "o") shortcut = "open";
      if (modified && event.key.toLowerCase() === "s") shortcut = "save";
      if (modified && event.key === "Enter") shortcut = "agent";
      if (workspaceViewFromKeyboardShortcut(event)) shortcut = "view";
      if (!shortcut) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setCompletedShortcuts((current) => (current.includes(shortcut) ? current : [...current, shortcut]));
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [step]);

  const shortcutRows = [
    { id: "open" as const, title: text.openTitle, body: text.openBody, keyName: "O", optionKey: "" },
    { id: "save" as const, title: text.saveTitle, body: text.saveBody, keyName: "S", optionKey: "" },
    { id: "agent" as const, title: text.agentTitle, body: text.agentBody, keyName: "↵", optionKey: "" },
    {
      id: "view" as const,
      title: text.viewTitle,
      body: text.viewBody,
      keyName: "1 / 2 / 3",
      optionKey: optionModifier,
    },
  ];
  return (
    <div
      className="welcome-backdrop"
      data-intro-phase={introPhase}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <section
        className="welcome-window"
        data-intro-phase={introPhase}
        data-onboarding-sequence="boot-write-settle-unfold"
        onPointerMove={trackFluidSurface}
        onPointerLeave={resetFluidSurface}
      >
        <header className="welcome-chrome">
          <div className="welcome-chrome-brand" aria-hidden="true">
            <span>R</span>
            <strong>Rune</strong>
          </div>
          <div
            className="welcome-progress"
            role="progressbar"
            aria-label={String(steps.indexOf(step) + 1) + " of " + String(steps.length)}
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={steps.indexOf(step) + 1}
          >
            {steps.map((item) => (
              <span
                className={item === step ? "active" : steps.indexOf(item) < steps.indexOf(step) ? "complete" : ""}
                key={item}
              />
            ))}
          </div>
          {dismissible ? (
            <button type="button" onClick={onDismiss} aria-label={text.close} title={text.close}>
              <X />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onModelModeChange("local");
                setStep("ready");
              }}
            >
              {text.skip}
            </button>
          )}
        </header>

        <div className={"welcome-page welcome-" + step}>
          {step === "welcome" && (
            <>
              <div className="welcome-intro-grid" data-intro-phase={introPhase}>
                <div className="welcome-greeting-stage" aria-hidden="true">
                  <HandwrittenGreeting
                    cycleDuration={greetingCycleDuration}
                    locale={greetingLocale}
                    onWritingComplete={() => setGreetingIntroComplete(true)}
                    value={greeting}
                    key={`${locale}-${greetingIndex}`}
                  />
                </div>
                <div className="welcome-intro-copy">
                  <span className="welcome-eyebrow">{text.welcomeEyebrow}</span>
                  <h1 id="welcome-title">{text.welcomeTitle}</h1>
                  <p>{text.welcomeBody}</p>
                  <p className="welcome-principles">
                    <ShieldCheck aria-hidden="true" />
                    {text.local} · {text.reviewFirst} · {text.live}
                  </p>
                </div>
                <section className="welcome-language-card" aria-labelledby="welcome-language-title">
                  <div className="welcome-language-heading">
                    <span>
                      <Globe2 aria-hidden="true" />
                    </span>
                    <div>
                      <strong id="welcome-language-title">{text.languageTitle}</strong>
                      <small>{text.languageBody}</small>
                    </div>
                  </div>
                  <div
                    className="language-options"
                    role="radiogroup"
                    aria-label={text.languageTitle}
                    ref={languageOptionsRef}
                  >
                    {RUNE_LOCALE_REGISTRY.map(({ locale: option }) => (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={locale === option}
                        className={locale === option ? "selected" : ""}
                        ref={locale === option ? selectedLanguageOptionRef : undefined}
                        onClick={() => onLocaleChange(option)}
                        key={option}
                      >
                        <span className="language-monogram">{localeMonogram(option)}</span>
                        <span>
                          <strong>{localeDisplayName(option)}</strong>
                          <small>{option === detectedLocale ? text.recommended : option}</small>
                        </span>
                        {locale === option && <Check />}
                      </button>
                    ))}
                  </div>
                  <button className="welcome-primary" type="button" onClick={() => setStep("model")}>
                    {text.begin}
                    <ArrowRight />
                  </button>
                </section>
              </div>
            </>
          )}

          {step === "model" && (
            <Suspense
              fallback={
                <>
                  <span className="welcome-eyebrow">{text.modelEyebrow}</span>
                  <h1 id="welcome-title">{text.modelTitle}</h1>
                  <p role="status">{text.checkingModel}</p>
                </>
              }
            >
              <WelcomeModelStep
                copy={text}
                locale={locale}
                modelMode={modelMode}
                onModelModeChange={onModelModeChange}
                onContinue={(configured) => {
                  if (!configured) onModelModeChange("local");
                  setStep("shortcuts");
                }}
              />
            </Suspense>
          )}

          {step === "shortcuts" && (
            <>
              <div className="welcome-icon-disc">
                <Keyboard />
              </div>
              <span className="welcome-eyebrow">{text.shortcutEyebrow}</span>
              <h1 id="welcome-title">{text.shortcutTitle}</h1>
              <p>{text.shortcutBody}</p>
              <div className="shortcut-lessons">
                {shortcutRows.map((item) => {
                  const complete = completedShortcuts.includes(item.id);
                  return (
                    <div className={complete ? "complete" : ""} key={item.id}>
                      <span className="shortcut-status">{complete ? <Check /> : <Command />}</span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{complete ? text.tried : item.body}</small>
                      </span>
                      <span className="shortcut-keys">
                        <ShortcutKey>{modifier}</ShortcutKey>
                        {item.optionKey && <ShortcutKey>{item.optionKey}</ShortcutKey>}
                        <ShortcutKey>{item.keyName}</ShortcutKey>
                      </span>
                    </div>
                  );
                })}
              </div>
              <button className="welcome-primary" type="button" onClick={() => setStep("ready")}>
                {completedShortcuts.length === shortcutRows.length ? text.continue : text.skipTutorial}
                <ArrowRight />
              </button>
            </>
          )}

          {step === "ready" && (
            <>
              <div className="welcome-icon-disc ready">
                <Sparkles />
              </div>
              <span className="welcome-eyebrow">{text.readyEyebrow}</span>
              <h1 id="welcome-title">{text.readyTitle}</h1>
              <p>{text.readyBody}</p>
              <div className="welcome-actions">
                <button type="button" className="featured" onClick={() => onComplete("review")}>
                  <span>
                    <ClipboardList />
                  </span>
                  <span>
                    <strong>{text.review}</strong>
                    <small>{text.reviewBody}</small>
                  </span>
                  <ArrowRight />
                </button>
                <button type="button" onClick={() => onComplete("briefing")}>
                  <span>
                    <Presentation />
                  </span>
                  <span>
                    <strong>{text.briefing}</strong>
                    <small>{text.briefingBody}</small>
                  </span>
                  <ArrowRight />
                </button>
                <button type="button" onClick={() => onComplete("guide")}>
                  <span>
                    <FileText />
                  </span>
                  <span>
                    <strong>{text.guide}</strong>
                    <small>{text.guideBody}</small>
                  </span>
                  <ArrowRight />
                </button>
                <button type="button" onClick={() => onComplete("sample")}>
                  <span>
                    <Sparkles />
                  </span>
                  <span>
                    <strong>{text.sample}</strong>
                    <small>{text.sampleBody}</small>
                  </span>
                  <ArrowRight />
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
