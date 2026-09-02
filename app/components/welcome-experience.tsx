"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Command,
  FileText,
  Keyboard,
  Presentation,
  Sparkles,
  X,
} from "lucide-react";
import {
  Fragment,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { HandwrittenGreeting } from "./handwritten-greeting";
import { planGreetingPresentation } from "../lib/greeting-presentation";
import {
  localeDisplayName,
  localizeRuneCopy,
  runeGreetingSequence,
  RUNE_LOCALE_REGISTRY,
  type RuneLocale,
} from "../lib/localization";
import { type RuneModelMode } from "../lib/model-preference";
import { workspaceViewFromKeyboardShortcut } from "../lib/workspace-layout";

const WelcomeModelStep = lazy(() =>
  import("./welcome-model-step").then((module) => ({ default: module.WelcomeModelStep })),
);

export type WelcomeAction = "guide" | "review" | "briefing" | "sample";
export type WelcomeStep = "welcome" | "model" | "shortcuts" | "ready";
type ShortcutId = "open" | "save" | "agent" | "view";

export const WELCOME_BASE_COPY = {
  "zh-CN": {
    back: "上一步",
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
    modelEyebrow: "智能设置",
    modelTitle: "让 Rune 找到你已有的模型",
    modelBody: "桌面版会在明确范围内查找已有配置与本地模型；发现阶段不显示、复制或验证任何密钥。",
    checkingModel: "正在检查 Rune 中已有的连接…",
    connectedModel: "已经准备好",
    connectedModelBody: "当前默认连接可用于先审后写的模型辅助。",
    noModel: "还没有选择模型",
    noModelBody: "可以使用发现的连接、手动添加，或不使用模型继续。",
    useConnected: "使用模型辅助",
    useConnectedBody: "使用所选云端或本地模型；每次修改仍由你确认",
    useLocal: "不使用模型继续",
    useLocalBody: "只使用设备端解析、转换和确定性工具，不向模型服务发送内容",
    recheck: "重新扫描",
    discoveryScanning: "正在查找这台设备上的模型…",
    discoveryTitle: "此设备上的可用连接",
    discoveryBody: "仅显示供应商、来源、endpoint 和模型；选择后才读取凭据并验证连接。",
    discoveryEmpty: "未找到可直接复用的模型连接",
    discoveryEmptyBody: "你仍可以手动添加供应商或导入一份配置。",
    discoveryUnavailable: "网页版不能读取电脑上的应用配置；仍可手动连接模型。",
    discoveryError: "Rune 无法完成设备扫描；没有读取或保存任何配置。",
    deviceModel: "在此设备上运行",
    cloudModel: "云端 API",
    sourceLabel: "来源",
    modelLabel: "模型",
    endpointLabel: "端点",
    deploymentConnection: "部署连接",
    credentialDetected: "发现凭据；尚未读取",
    credentialNotRequired: "无需 API Key",
    reviewConnection: "查看",
    reviewTitle: "使用这个模型连接？",
    connectionReviewBody: "Rune 将在你确认后读取这一项凭据，先验证模型目录，成功后才加密保存并设为默认。",
    connectAndVerify: "验证并使用",
    connecting: "正在验证…",
    chooseAnother: "返回连接列表",
    connectionFailed: "这个连接暂时无法验证；Rune 没有保存它。",
    scanPrivacy: "扫描只读取已知配置位置与本机模型端口；不会执行 shell 配置、上传文件或展示密钥。",
    modelSafety:
      "个人密钥会被加密为 HttpOnly 凭据；浏览器脚本不能读回它，Rune 也不会把它写进工作区、localStorage、Artifact 或 Git。",
    modelUnavailable: "无法读取模型状态；你可以选择不使用模型继续。",
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
    back: "Back",
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
    modelEyebrow: "Intelligence",
    modelTitle: "Let Rune find the models you already use",
    modelBody:
      "The desktop app checks a defined set of existing configurations and device model runtimes. Discovery never displays, copies, or verifies a key.",
    checkingModel: "Checking connections already saved in Rune…",
    connectedModel: "Ready",
    connectedModelBody: "The current default can provide review-before-write model assistance.",
    noModel: "No model selected yet",
    noModelBody: "Use a discovered connection, add one yourself, or continue without a model.",
    useConnected: "Continue with model assistance",
    useConnectedBody: "Use the selected cloud or device model; you still confirm every change",
    useLocal: "Continue without a model",
    useLocalBody: "Use only on-device parsing, conversion, and deterministic tools; send nothing to a model service",
    recheck: "Scan again",
    discoveryScanning: "Looking for models on this device…",
    discoveryTitle: "Connections available on this device",
    discoveryBody:
      "Only provider, source, endpoint, and model are shown. Rune reads a credential only after you choose one.",
    discoveryEmpty: "No reusable model connection was found",
    discoveryEmptyBody: "You can still add a provider yourself or import a configuration.",
    discoveryUnavailable:
      "The web app cannot read application settings on your computer. You can still connect a model manually.",
    discoveryError: "Rune could not complete the device scan. No configuration was read or saved.",
    deviceModel: "Runs on this device",
    cloudModel: "Cloud API",
    sourceLabel: "Source",
    modelLabel: "Model",
    endpointLabel: "Endpoint",
    deploymentConnection: "Deployment connection",
    credentialDetected: "Credential found; not read yet",
    credentialNotRequired: "No API key required",
    reviewConnection: "Review",
    reviewTitle: "Use this model connection?",
    connectionReviewBody:
      "After you confirm, Rune reads this one credential, verifies the model catalog, then encrypts and saves it as the default only if verification succeeds.",
    connectAndVerify: "Verify & use",
    connecting: "Verifying…",
    chooseAnother: "Back to connections",
    connectionFailed: "Rune could not verify this connection and did not save it.",
    scanPrivacy:
      "Discovery reads only known configuration locations and local model ports. It never executes shell profiles, uploads files, or displays a key.",
    modelSafety:
      "A personal key is encrypted into an HttpOnly credential that browser scripts cannot read back; Rune never writes it to the workspace, localStorage, an Artifact, or Git.",
    modelUnavailable: "Rune could not read model status. You can continue without a model.",
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

function IsolatedRuneName({ children }: { children: string }) {
  const pieces = children.split("Rune");
  return (
    <>
      {pieces.map((piece, index) => (
        <Fragment key={`${piece}-${index}`}>
          {index > 0 && (
            <bdi className="rune-name" dir="ltr">
              Rune
            </bdi>
          )}
          {piece}
        </Fragment>
      ))}
    </>
  );
}

const subscribeToPlatform = () => () => undefined;

function usesMacPlatformControls() {
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
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
  const [greetingIntroComplete, setGreetingIntroComplete] = useState(false);
  const languageOptionsRef = useRef<HTMLDivElement>(null);
  const selectedLanguageOptionRef = useRef<HTMLButtonElement>(null);
  // Keep the server and first client render identical. The external-store
  // server snapshot owns hydration; the browser snapshot updates afterward.
  const usesMacControls = useSyncExternalStore(subscribeToPlatform, usesMacPlatformControls, () => true);
  const modifier = usesMacControls ? "⌘" : "Ctrl";
  const optionModifier = usesMacControls ? "⌥" : "Alt";
  const text = welcomeCopy(locale);
  const greetings = useMemo(() => runeGreetingSequence(locale), [locale]);
  const greeting = greetings[0] ?? "Hello";
  const greetingLocale = RUNE_LOCALE_REGISTRY.find((entry) => entry.greeting === greeting)?.locale ?? locale;
  const greetingPresentation = useMemo(
    () => planGreetingPresentation({ locale: greetingLocale, value: greeting }),
    [greeting, greetingLocale],
  );
  const steps = useMemo<WelcomeStep[]>(() => ["welcome", "model", "shortcuts", "ready"], []);
  const stepIndex = steps.indexOf(step);
  const introPhase = step === "welcome" && !greetingIntroComplete ? "writing" : "ready";

  function showPreviousStep() {
    const previousStep = steps[stepIndex - 1];
    if (previousStep) setStep(previousStep);
  }

  useEffect(() => {
    if (step !== "welcome" || greetingIntroComplete) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fallback = window.setTimeout(
      () => setGreetingIntroComplete(true),
      reducedMotion ? 0 : greetingPresentation.completeAfterMs + 180,
    );
    return () => window.clearTimeout(fallback);
  }, [greetingIntroComplete, greetingPresentation.completeAfterMs, step]);

  useEffect(() => {
    if (step !== "welcome") return;
    const revealSelectedOption = () => {
      const options = languageOptionsRef.current;
      const selected = selectedLanguageOptionRef.current;
      if (!options || !selected) return;
      const buttons = [...options.querySelectorAll<HTMLButtonElement>("button")];
      const selectedIndex = buttons.indexOf(selected);
      const firstTop = buttons[0]?.offsetTop ?? 0;
      const rowHeight = Math.max(
        selected.offsetHeight,
        buttons.length > 1 ? buttons[1].offsetTop - buttons[0].offsetTop : selected.offsetHeight,
      );
      const visibleRows = Math.max(1, Math.floor((options.clientHeight - firstTop * 2) / rowHeight));
      const firstVisibleIndex = Math.min(
        Math.max(0, buttons.length - visibleRows),
        Math.max(0, selectedIndex - Math.floor(visibleRows / 2)),
      );
      const centeredTop = (buttons[firstVisibleIndex]?.offsetTop ?? selected.offsetTop) - firstTop;
      const maximumTop = Math.max(0, options.scrollHeight - options.clientHeight);
      options.scrollTop = Math.min(maximumTop, Math.max(0, centeredTop));
    };
    const frame = window.requestAnimationFrame(revealSelectedOption);
    const settled = window.setTimeout(revealSelectedOption, 360);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settled);
    };
  }, [introPhase, locale, step]);

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
        data-onboarding-sequence="spectrum-write-settle-setup"
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
          <div className="welcome-chrome-actions">
            {stepIndex > 0 && (
              <button type="button" className="welcome-back" onClick={showPreviousStep}>
                <ArrowLeft aria-hidden="true" />
                {text.back}
              </button>
            )}
            {dismissible ? (
              <button type="button" onClick={onDismiss} aria-label={text.close} title={text.close}>
                <X />
              </button>
            ) : step !== "ready" ? (
              <button
                type="button"
                onClick={() => {
                  onModelModeChange("device-tools-only");
                  setStep("ready");
                }}
              >
                {text.skip}
              </button>
            ) : null}
          </div>
        </header>

        <div className={"welcome-page welcome-" + step} key={step}>
          {step === "welcome" && (
            <>
              <div className="welcome-intro-grid" data-intro-phase={introPhase}>
                <div className="welcome-greeting-stage" aria-hidden="true">
                  <HandwrittenGreeting
                    onWritingComplete={() => setGreetingIntroComplete(true)}
                    presentation={greetingPresentation}
                    key={locale}
                  />
                </div>
                <section className="welcome-language-card" aria-labelledby="welcome-title">
                  <div className="welcome-language-heading">
                    <span className="welcome-eyebrow">{text.welcomeEyebrow}</span>
                    <h1 id="welcome-title">
                      <IsolatedRuneName>{text.languageTitle}</IsolatedRuneName>
                    </h1>
                    <p>{text.languageBody}</p>
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
                        <span>
                          <strong>{localeDisplayName(option)}</strong>
                          <small>{option === detectedLocale ? text.recommended : option}</small>
                        </span>
                        {locale === option && <Check />}
                      </button>
                    ))}
                  </div>
                  <button className="welcome-primary" type="button" onClick={() => setStep("model")}>
                    {text.continue}
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
                onContinue={(mode) => {
                  onModelModeChange(mode);
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
