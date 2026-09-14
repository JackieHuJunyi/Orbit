import type { ArtifactKind, WorkspaceArtifact } from "./workspace.ts";
import {
  isOrbitLocaleCatalogLoaded,
  loadedInterfaceTranslation,
  loadedTraditionalChineseSegments,
  loadOrbitLocaleCatalog,
} from "./interface-locale-runtime.ts";

let traditionalChinesePattern: RegExp | null = null;
let traditionalChineseBySource: ReadonlyMap<string, string> | null = null;

function requireOrbitLocaleCatalog(locale: OrbitLocale) {
  if (!isOrbitLocaleCatalogLoaded(locale)) {
    throw new Error(`Orbit interface locale “${locale}” must be loaded before synchronous localization.`);
  }
}

function toTaiwanTraditional(value: string) {
  requireOrbitLocaleCatalog("zh-TW");
  const segments = loadedTraditionalChineseSegments()!;
  traditionalChinesePattern ??= new RegExp(
    segments.map(([source]) => source.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|"),
    "gu",
  );
  traditionalChineseBySource ??= new Map<string, string>(segments);
  return value.replace(traditionalChinesePattern, (source) => traditionalChineseBySource!.get(source) ?? source);
}

export const ORBIT_LOCALE_REGISTRY = [
  {
    locale: "zh-CN",
    greeting: "你好",
    monogram: "文",
    nativeName: "简体中文",
    languagePrefixes: ["zh-cn", "zh-hans", "zh-sg", "zh-my", "zh"],
    direction: "ltr",
  },
  {
    locale: "zh-TW",
    greeting: "哈囉",
    monogram: "繁",
    nativeName: "繁體中文",
    languagePrefixes: ["zh-tw", "zh-hant", "zh-hk", "zh-mo"],
    direction: "ltr",
  },
  {
    locale: "en",
    greeting: "Hello",
    monogram: "A",
    nativeName: "English",
    languagePrefixes: ["en"],
    direction: "ltr",
  },
  {
    locale: "fr",
    greeting: "Bonjour",
    monogram: "Fr",
    nativeName: "Français",
    languagePrefixes: ["fr"],
    direction: "ltr",
  },
  {
    locale: "es",
    greeting: "Hola",
    monogram: "Es",
    nativeName: "Español",
    languagePrefixes: ["es"],
    direction: "ltr",
  },
  {
    locale: "ru",
    greeting: "Привет",
    monogram: "Ру",
    nativeName: "Русский",
    languagePrefixes: ["ru"],
    direction: "ltr",
  },
  {
    locale: "ar",
    greeting: "مرحبًا",
    monogram: "ع",
    nativeName: "العربية",
    languagePrefixes: ["ar"],
    direction: "rtl",
  },
  {
    locale: "ja",
    greeting: "こんにちは",
    monogram: "日",
    nativeName: "日本語",
    languagePrefixes: ["ja"],
    direction: "ltr",
  },
  {
    locale: "ko",
    greeting: "안녕하세요",
    monogram: "한",
    nativeName: "한국어",
    languagePrefixes: ["ko"],
    direction: "ltr",
  },
] as const;

export type OrbitLocale = (typeof ORBIT_LOCALE_REGISTRY)[number]["locale"];

export { isOrbitLocaleCatalogLoaded, loadOrbitLocaleCatalog };

export function isChineseOrbitLocale(locale: OrbitLocale) {
  return locale === "zh-CN" || locale === "zh-TW";
}

export function localeDirection(locale: OrbitLocale) {
  return ORBIT_LOCALE_REGISTRY.find((entry) => entry.locale === locale)?.direction ?? "ltr";
}

export function workspaceSplitValueLabel(locale: OrbitLocale, value: number) {
  const labels: Record<OrbitLocale, string> = {
    "zh-CN": `源内容宽度 ${value}%`,
    "zh-TW": `來源內容寬度 ${value}%`,
    en: `Source width ${value}%`,
    fr: `Largeur de la source ${value} %`,
    es: `Ancho de la fuente ${value} %`,
    ru: `Ширина исходника ${value}%`,
    ar: `عرض المصدر ${value}٪`,
    ja: `ソース幅 ${value}%`,
    ko: `소스 너비 ${value}%`,
  };
  return labels[locale];
}

function convertPreservingValues(value: string, preservedValues: readonly string[] = []) {
  const replacements = [...new Set(preservedValues.filter(Boolean))]
    .sort((left, right) => right.length - left.length)
    .map((preserved, index) => ({ preserved, placeholder: `\u{f0000}${index}\u{f0001}` }));
  let protectedValue = value;
  for (const { preserved, placeholder } of replacements)
    protectedValue = protectedValue.replaceAll(preserved, placeholder);
  let converted = toTaiwanTraditional(protectedValue);
  for (const { preserved, placeholder } of replacements) converted = converted.replaceAll(placeholder, preserved);
  return converted;
}

export function orbitText(
  locale: OrbitLocale,
  english: string,
  simplifiedChinese: string,
  preservedValues: readonly string[] = [],
) {
  if (locale === "en") return english;
  if (locale === "zh-CN") return simplifiedChinese;
  if (locale === "zh-TW") return convertPreservingValues(simplifiedChinese, preservedValues);
  requireOrbitLocaleCatalog(locale);
  return loadedInterfaceTranslation(locale, english) ?? english;
}

function localizeChineseCatalog<T>(value: T): T {
  if (typeof value === "string") return toTaiwanTraditional(value) as T;
  if (typeof value === "function") {
    return ((...args: unknown[]) => {
      const result = value(...args);
      return typeof result === "string"
        ? convertPreservingValues(
            result,
            args.filter((item): item is string => typeof item === "string"),
          )
        : localizeChineseCatalog(result);
    }) as T;
  }
  if (Array.isArray(value)) return value.map((item) => localizeChineseCatalog(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localizeChineseCatalog(item)])) as T;
  }
  return value;
}

function localizeGeneratedCatalog<T>(locale: OrbitLocale, value: T): T {
  if (typeof value === "string") return orbitText(locale, value, value) as T;
  if (typeof value === "function") {
    return ((...args: unknown[]) => {
      const result = value(...args);
      return typeof result === "string" ? orbitText(locale, result, result) : localizeGeneratedCatalog(locale, result);
    }) as T;
  }
  if (Array.isArray(value)) return value.map((item) => localizeGeneratedCatalog(locale, item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, localizeGeneratedCatalog(locale, item)]),
    ) as T;
  }
  return value;
}

export function localizeOrbitCopy<T>(locale: OrbitLocale, english: T, simplifiedChinese: unknown = english): T {
  if (locale === "en") return english;
  if (locale === "zh-CN") return simplifiedChinese as T;
  if (locale === "zh-TW") return localizeChineseCatalog(simplifiedChinese as T);
  return localizeGeneratedCatalog(locale, english);
}

function localizeOrbitMultiline(locale: OrbitLocale, english: string, simplifiedChinese: string) {
  const source =
    locale === "en"
      ? english
      : locale === "zh-CN"
        ? simplifiedChinese
        : locale === "zh-TW"
          ? toTaiwanTraditional(simplifiedChinese)
          : english;
  if (locale === "en" || isChineseOrbitLocale(locale)) return source;
  requireOrbitLocaleCatalog(locale);
  return source
    .split("\n")
    .map((line) => loadedInterfaceTranslation(locale, line) ?? line)
    .join("\n");
}

export const ORBIT_LOCALE_STORAGE_KEY = "orbit-locale-v1";
export const ORBIT_ONBOARDING_STORAGE_KEY = "orbit-onboarding-v1";
export const ORBIT_GUIDE_ID = "orbit-guide";

export function normalizeOrbitLocale(value: unknown): OrbitLocale | null {
  return ORBIT_LOCALE_REGISTRY.some((entry) => entry.locale === value) ? (value as OrbitLocale) : null;
}

export function detectPreferredLocale(languages: readonly string[] = []): OrbitLocale {
  for (const language of languages) {
    const normalized = language.toLowerCase();
    const match = ORBIT_LOCALE_REGISTRY.flatMap((entry) => entry.languagePrefixes.map((prefix) => ({ entry, prefix })))
      .filter(({ prefix }) => normalized === prefix || normalized.startsWith(`${prefix}-`))
      .sort((left, right) => right.prefix.length - left.prefix.length)[0]?.entry;
    if (match) return match.locale;
  }
  return "en";
}

export function localeDisplayName(locale: OrbitLocale) {
  return ORBIT_LOCALE_REGISTRY.find((entry) => entry.locale === locale)?.nativeName ?? locale;
}

export function localeMonogram(locale: OrbitLocale) {
  return ORBIT_LOCALE_REGISTRY.find((entry) => entry.locale === locale)?.monogram ?? "A";
}

export function orbitGreetingSequence(preferred: OrbitLocale): string[] {
  const ordered = [
    ...ORBIT_LOCALE_REGISTRY.filter((entry) => entry.locale === preferred),
    ...ORBIT_LOCALE_REGISTRY.filter((entry) => entry.locale !== preferred),
  ];
  return ordered.map((entry) => entry.greeting);
}

function buildOrbitUICopy(locale: "zh-CN" | "en") {
  const zh = locale === "zh-CN";
  const count = (value: number, singular: string, plural: string, chineseUnit: string) =>
    zh ? `${value} ${chineseUnit}` : `${value} ${value === 1 ? singular : plural}`;

  return {
    common: {
      cancel: zh ? "取消" : "Cancel",
      save: zh ? "保存" : "Save",
      edit: zh ? "编辑" : "Edit",
      source: zh ? "源内容" : "Source",
      configure: zh ? "配置" : "Configure",
      optional: zh ? "可选" : "optional",
      ready: zh ? "已就绪" : "Ready",
      title: zh ? "标题" : "Title",
      description: zh ? "描述" : "Description",
      numberFormat: zh ? "数字格式" : "Number format",
      closeDialog: (title: string) => (zh ? `取消“${title}”` : `Cancel ${title.toLowerCase()}`),
    },
    workbench: {
      brandSubtitle: zh ? "内容工作台" : "Content workspace",
      localWorkspace: zh ? "本地工作区" : "Local workspace",
      saved: zh ? "已保存到本机" : "Saved on device",
      saving: zh ? "正在保存" : "Saving",
      storageFull: zh ? "存储空间不足" : "Storage full",
      help: zh ? "欢迎与本地指南" : "Welcome & local guide",
      models: zh ? "模型配置" : "Model settings",
      pdfTools: zh ? "PDF 工具" : "PDF tools",
      pdfToolsBody: zh ? "整理、转换、编辑、安全与智能处理" : "Organize, convert, edit, secure, and understand PDFs",
      appearance: zh ? "外观" : "Appearance",
      moreTools: zh ? "更多工具" : "More tools",
      workspaceTools: zh ? "工作区工具" : "Workspace tools",
      workspaceToolsBody: zh ? "帮助、模型、文件夹与外观" : "Help, models, folder, and appearance",
      version: zh ? "版本" : "Version",
      appearanceBody: zh ? "选择 Orbit 的气质色" : "Choose Orbit's character color",
      activeTheme: zh ? "当前主题" : "Current theme",
      resizeWorkspace: zh ? "调整源内容与预览宽度" : "Resize source and preview",
      resetWorkspaceSplit: zh ? "恢复默认左右宽度" : "Reset source and preview widths",
      workspaceView: zh ? "工作区视图" : "Workspace view",
      splitView: zh ? "左右" : "Split",
      sourceView: zh ? "源内容" : "Source",
      previewView: zh ? "成品" : "Preview",
      previewDetails: zh ? "成品证据" : "Preview evidence",
      previewDetailsBody: zh ? "来源、绑定与验证" : "Source, bindings, and validation",
      showSplitView: zh ? "显示源内容与成品" : "Show source and preview",
      showSourceView: zh ? "只显示源内容" : "Show source only",
      showPreviewView: zh ? "只显示实时成品" : "Show preview only",
      newArtifact: zh ? "新建" : "New",
      import: zh ? "导入" : "Import",
      openFolder: zh ? "打开文件夹" : "Open folder",
      pull: zh ? "读取文件夹变化" : "Pull folder changes",
      push: zh ? "写回工作区文件" : "Push workspace files",
      download: zh ? "下载源文件" : "Download source",
      workspace: zh ? "工作区" : "Workspace",
      artifacts: zh ? "内容" : "Artifacts",
      sources: zh ? "来源" : "Sources",
      analysis: zh ? "分析" : "Analysis",
      deliverables: zh ? "成品" : "Deliverables",
      oneWorkspace: zh ? "一个事实工作区" : "One source workspace",
      oneWorkspaceBody: zh
        ? "每份内容都保持可读，并能被人和模型共同使用。"
        : "Every artifact stays readable to people and models.",
      localFirst: zh ? "本地优先" : "Local first",
      source: zh ? "可读源内容" : "Readable source",
      output: zh ? "实时成品" : "Live output",
      livePreview: zh ? "实时预览" : "Live preview",
      valid: zh ? "有效" : "Valid",
      assistant: "Orbit",
      assistantBody: zh ? "先准备修改，再由你确认写入" : "Prepares a change before you approve the write",
      conversation: zh ? "对话" : "Conversation",
      clearConversation: zh ? "清除对话" : "Clear conversation",
      conversationCleared: zh ? "Agent 对话已清除" : "Agent conversation cleared",
      conversationYou: zh ? "你" : "You",
      conversationAnswer: zh ? "回答" : "Answer",
      conversationProposal: zh ? "修改提案" : "Change proposal",
      conversationPrivacy: zh
        ? "最多保留 16 条消息，仅存储在这台设备上；不会写入文档或导出文件。"
        : "Up to 16 messages stay on this device only; they are never written into documents or exports.",
      selection: zh ? "选区" : "Selection",
      file: zh ? "当前文件" : "File",
      workspaceScope: zh ? "工作区" : "Workspace",
      modelConnected: zh ? "模型已连接" : "Model connected",
      localFallback: zh ? "本地工具" : "Local tools",
      localModelDetail: zh ? "确定性处理，不调用模型" : "Deterministic work with no model call",
      connectedModels: zh ? "已连接" : "Connected",
      availableModels: zh ? "此设备上可用" : "Available on this device",
      localTools: zh ? "无需模型" : "Without a model",
      modelNeedsSignIn: zh ? "需要先登录账号" : "Sign in required",
      scanningModels: zh ? "正在查看这台设备上的模型…" : "Looking for models on this device…",
      refreshModels: zh ? "重新扫描模型" : "Scan models again",
      manageModels: zh ? "管理模型与连接" : "Manage models and connections",
      currentModel: zh ? "本次消息" : "For this message",
      modelProviders: zh ? "模型服务" : "Model providers",
      modelFamilies: zh ? "模型" : "Model",
      modelReasoning: zh ? "思考强度" : "Reasoning",
      connectModel: zh ? "连接" : "Connect",
      signInModel: zh ? "登录" : "Sign in",
      useLocalTools: zh ? "使用本地工具" : "Use local tools",
      reasoningLow: zh ? "低" : "Low",
      reasoningMedium: zh ? "中" : "Medium",
      reasoningHigh: zh ? "高" : "High",
      reasoningMax: zh ? "最大" : "Max",
      agentModel: zh ? "本次使用的模型" : "Model for this message",
      suggestedActions: zh ? "建议操作" : "Suggested actions",
      askWorkspace: zh
        ? "询问工作区内容，或描述需要多份内容共同完成的结果…"
        : "Ask about the workspace or describe an outcome across connected sources…",
      askSelection: zh
        ? "询问当前选区，或描述只针对这里的修改…"
        : "Ask about this selection or describe a change confined to it…",
      askFile: zh ? "询问当前文件，或描述你希望做出的修改…" : "Ask about this file or describe the change you want…",
      planChange: zh ? "发送给 Orbit" : "Send to Orbit",
      stopModel: zh ? "停止模型请求" : "Stop model request",
      modelStarting: zh ? "正在启动所选模型" : "Starting the selected model",
      modelReading: zh ? "模型正在阅读当前上下文" : "The model is reading current context",
      modelWaiting: zh ? "仍在等待，可随时停止" : "Still waiting; you can stop",
      modelQueryEvidence: zh ? "正在本地读取 Query 结果" : "Reading current Query results locally",
      modelValidating: zh ? "正在本地验证模型结果" : "Validating the model result locally",
      modelRepairing: zh ? "正在准备一次受限修复" : "Preparing one bounded repair",
      planHint: zh
        ? "Enter 发送 · Shift Enter 换行 · 所有写入仍需审核"
        : "Enter to send · Shift Enter for a new line · every write still requires review",
      sourceEditor: zh ? "源内容编辑器" : "Source editor",
      preview: zh ? "编译后的成品预览" : "Compiled artifact preview",
      hideFiles: zh ? "隐藏工作区文件" : "Hide workspace files",
      showFiles: zh ? "显示工作区文件" : "Show workspace files",
      workspaceFiles: zh ? "工作区文件" : "Workspace files",
      orbitSections: zh ? "Orbit 功能区" : "Orbit sections",
      createOperatingReview: zh ? "创建经营汇报" : "Create operating review",
      savedReviews: zh ? "已保存任务" : "Saved tasks",
      recentTaskRuns: zh ? "最近任务记录" : "Recent task runs",
      operatingReviewTask: zh ? "经营汇报" : "Operating review",
      documentBriefingTask: zh ? "文档转演示" : "Document to presentation",
      earlierDeviceRecords: zh ? "早期本机记录（只读）" : "Earlier device records (read only)",
      taskTime: zh ? "任务耗时" : "Task time",
      savedReviewCount: (value: number) =>
        zh ? `${value} 条可重复汇报` : `${value} repeatable ${value === 1 ? "review" : "reviews"}`,
      rerunReview: (title: string) => (zh ? `重新运行「${title}」` : `Rerun “${title}”`),
      rerun: zh ? "重新运行" : "Rerun",
      reviewSourceMissing: zh ? "来源或成品已缺失" : "Source or output missing",
      taskRuns: (value: number) => (zh ? `${value} 次本机运行` : `${value} device ${value === 1 ? "run" : "runs"}`),
      lastRun: zh ? "最近运行" : "Last run",
      runApplied: zh ? "已应用" : "Applied",
      runStopped: zh ? "已停止" : "Stopped",
      noTaskRuns: zh ? "首次应用后开始记录" : "Recorded after first Apply",
      localPlanner: zh ? "本地规则" : "Local planner",
      tokenUse: (input: number | null, output: number | null) =>
        input == null || output == null
          ? zh
            ? "未调用模型"
            : "No model call"
          : zh
            ? `${input} 输入 · ${output} 输出 token`
            : `${input} input · ${output} output tokens`,
      successRate: (value: number | null) =>
        value == null ? (zh ? "尚无结果" : "No outcomes yet") : zh ? `${value}% 应用成功` : `${value}% applied`,
      averageReviewTime: (milliseconds: number | null) =>
        milliseconds == null
          ? zh
            ? "尚无确认耗时"
            : "No review time yet"
          : zh
            ? `平均确认 ${Math.max(1, Math.round(milliseconds / 1000))} 秒`
            : `${Math.max(1, Math.round(milliseconds / 1000))}s average review`,
      runHistory: zh ? "运行历史" : "Run history",
      confirmedDeliverables: zh ? "项已确认成品" : "confirmed deliverables",
      usableDeliverables: zh ? "可交付或只需轻改" : "usable or minor edits",
      realTasksReviewed: zh ? "项真实任务已评估" : "real tasks reviewed",
      numberChecksBelowFour: zh ? "项数字正确性低于 4 分" : "number checks below 4",
      detailedEvaluation: zh ? "详细评估" : "Detailed evaluation",
      numberScore: zh ? "数字正确性" : "Number correctness",
      noDeliveryOutcomes: zh ? "交付后可确认真实可用性" : "Confirm real usability after a handoff",
      deliveryOutcomeRecorded: zh ? "交付结果已记录在本机" : "Delivery outcome recorded on this device",
      deliveryOutcomeFailed: zh ? "无法记录这次交付结果" : "Orbit could not record this delivery outcome",
      deliveryRatings: {
        ready: zh ? "可以直接交付" : "Ready to deliver",
        "minor-edits": zh ? "少量修改后可交付" : "Deliverable after minor edits",
        "not-ready": zh ? "目前不能交付" : "Not ready to deliver",
      },
      runImpact: (files: number, queries: number, charts: number) =>
        zh
          ? `${files} 个文件 · ${queries} 个 Query · ${charts} 个 Chart`
          : `${files} files · ${queries} Queries · ${charts} Charts`,
      stopReasons: {
        validation: zh ? "来源或设置未通过验证" : "Source or settings failed validation",
        runtime: zh ? "本地运行验证未通过" : "Local runtime validation failed",
        stale: zh ? "工作区版本已变化" : "Workspace revision changed",
        persistence: zh ? "本机持久化失败" : "Device persistence failed",
        cancelled: zh ? "审核时取消" : "Cancelled during review",
      },
      focusAgent: zh ? "聚焦 Orbit Agent" : "Focus Orbit Agent",
      floatAgent: zh ? "浮动 Agent" : "Float Agent",
      dockAgent: zh ? "停靠 Agent" : "Dock Agent",
      moveAgent: zh ? "移动 Agent" : "Move Agent",
      askOrbitAboutSelection: zh ? "就此内容询问 Orbit" : "Ask Orbit about this",
      dataGraph: zh ? "数据关系图" : "Data graph",
      resetSample: zh ? "恢复示例工作区" : "Restore sample workspace",
      checkpoints: zh ? "恢复点历史" : "Checkpoint history",
      sourceVersions: zh ? "源内容与版本" : "Source and versions",
      closeFile: zh ? "关闭当前文件" : "Close current file",
      describeWorkspaceChange: zh ? "描述工作区修改" : "Describe a workspace change",
      describeSelectionChange: zh ? "描述选区内修改" : "Describe a selected-source change",
      describeArtifactChange: zh ? "描述当前内容修改" : "Describe an artifact change",
      sourceLinked: (label: string) => (zh ? `已链接到规范源内容：${label}` : `Canonical source linked to ${label}`),
      oneSource: zh ? "1 个来源" : "1 source",
      issues: (value: number) => count(value, "issue", "issues", "个问题"),
      diagnostics: {
        heading: zh ? "需要处理" : "Needs attention",
        body: zh
          ? "先看修复方向，需要时再展开编译器原始信息。"
          : "Start with the repair direction, then reveal exact compiler evidence when needed.",
        openSource: zh ? "打开源内容修复" : "Open Source to fix",
        sourceFocused: zh ? "已打开需要处理的源内容" : "Opened the source that needs attention",
        technicalDetail: zh ? "编译器原始信息" : "Exact compiler detail",
        detailTruncated: zh
          ? "原始信息过长，已在界面中截断。"
          : "The original detail was too long and is truncated in this view.",
        reference: zh ? "相关引用" : "Related reference",
        codes: {
          "source-empty": {
            title: zh ? "先添加源内容" : "Add source content",
            action: zh
              ? "在左侧输入内容，实时成品会立即重新编译。"
              : "Write in Source and the live output will recompile immediately.",
          },
          "source-unsafe": {
            title: zh ? "移除不安全内容" : "Remove unsafe content",
            action: zh
              ? "删除脚本或可执行标记；Orbit 的成品预览只接受无脚本内容。"
              : "Remove scripts or executable markup; Orbit previews only script-free content.",
          },
          "document-source-invalid": {
            title: zh ? "修正文档源内容" : "Repair the Document source",
            action: zh
              ? "保持可读 Markdown 结构，并检查未闭合的语法或绑定。"
              : "Keep readable Markdown structure and check unfinished syntax or bindings.",
          },
          "data-source-invalid": {
            title: zh ? "修正表格源内容" : "Repair the Data source",
            action: zh
              ? "使用带表头的矩形 CSV，或只含标量值的扁平 JSON。"
              : "Use rectangular CSV with headers, or flat JSON containing scalar values.",
          },
          "query-source-invalid": {
            title: zh ? "修正只读 Query" : "Repair the read-only Query",
            action: zh
              ? "保留一个 SELECT 或 WITH 语句，并检查明确的 Data 来源。"
              : "Keep one SELECT or WITH statement and verify its explicit Data source.",
          },
          "chart-source-invalid": {
            title: zh ? "修正 Chart 定义" : "Repair the Chart definition",
            action: zh
              ? "使用受支持的图形、字段、格式和一个现有的 Data 或 Query 来源。"
              : "Use a supported mark, fields, format, and one existing Data or Query source.",
          },
          "slides-source-invalid": {
            title: zh ? "修正演示源内容" : "Repair the Presentation source",
            action: zh
              ? "保持有效的 Deck Markdown，或使用不含脚本的语义 HTML。"
              : "Keep valid Deck Markdown or script-free semantic HTML.",
          },
          "live-binding-invalid": {
            title: zh ? "修正实时数值绑定" : "Repair the live value binding",
            action: zh
              ? "检查绑定语法，并选择当前工作区中唯一存在的指标。"
              : "Check the binding syntax and choose one metric that exists in this workspace.",
          },
          "metric-missing": {
            title: zh ? "重新连接缺失指标" : "Reconnect the missing metric",
            action: zh
              ? "选择已有指标键，或把引用改为一个明确的 Query 输出字段。"
              : "Choose an existing metric key or an explicit Query output field.",
          },
          "query-metric-invalid": {
            title: zh ? "修正 SQL 指标绑定" : "Repair the SQL metric binding",
            action: zh
              ? "检查 Query、结果字段和聚合行是否仍与当前版本一致。"
              : "Verify that the Query, result field, and aggregate row still match this revision.",
          },
          "chart-missing": {
            title: zh ? "重新连接缺失 Chart" : "Reconnect the missing Chart",
            action: zh
              ? "选择一个已有 Chart ID，或先创建并验证对应图表。"
              : "Choose an existing Chart id or create and validate that Chart first.",
          },
          "chart-binding-invalid": {
            title: zh ? "修正 Chart 来源" : "Repair the Chart source",
            action: zh
              ? "重新选择现有 Data/Query 和其中唯一存在的分类与数值字段。"
              : "Reconnect existing Data or Query and exact category and value fields.",
          },
          "query-binding-invalid": {
            title: zh ? "重新连接 Query 数据来源" : "Reconnect the Query Data source",
            action: zh
              ? "把 Query 绑定到当前工作区中一份明确存在的 Data。"
              : "Bind the Query to one exact Data artifact in the current workspace.",
          },
        },
      },
      linkedCharts: (value: number) => count(value, "linked chart", "linked charts", "个关联图表"),
      initialNotice: zh ? "本地工作区已就绪" : "Local workspace ready",
      newCancelled: zh ? "已取消新建 — 工作区保持不变" : "New artifact cancelled — the workspace is unchanged",
      structureCancelled: zh
        ? "已取消文档结构修改 — 源内容保持不变"
        : "Document structure change cancelled — source stayed unchanged",
      dependencyGraph: zh ? "工作区依赖关系图" : "Workspace dependency graph",
      liveContext: zh ? "实时上下文" : "Live context",
      dependencyGraphTitle: zh ? "依赖关系图" : "Dependency graph",
      dependencyEdges: (value: number) => (zh ? `${value} 条依赖边` : `${value} dependency edges`),
      agentContextPack: zh ? "工作区 Agent 上下文包" : "Workspace Agent context pack",
      agentContext: zh ? "Agent 上下文" : "Agent context",
      clearPins: zh ? "清除固定" : "Clear pins",
      contextExplanation: zh
        ? "当前绑定和临时固定项共同选择一个有边界、跟随版本更新的上下文包。"
        : "Current bindings and temporary pins choose a bounded, revision-live context pack.",
      artifactsInContext: zh ? "Agent 上下文中的内容" : "Artifacts in Agent context",
      openContextArtifact: (name: string, pinned: boolean) =>
        zh
          ? `打开 ${name}${pinned ? "，已手动固定到 Agent 上下文" : ""}`
          : `Open ${name}${pinned ? ", manually pinned in Agent context" : ""}`,
      sourceToConsumer: zh ? "来源 → 使用方" : "Source → consumer",
      liveDependencies: zh ? "实时内容依赖" : "Live artifact dependencies",
      openDependencySource: (name: string) => (zh ? `打开依赖来源 ${name}` : `Open dependency source ${name}`),
      openDependencyConsumer: (name: string) => (zh ? `打开依赖使用方 ${name}` : `Open dependency consumer ${name}`),
      noDependency: zh
        ? "添加指标、Query 或 Chart 绑定以建立第一条实时关系。"
        : "Add a metric, query, or chart binding to create the first live edge.",
      unresolvedDependencies: zh ? "未解决的依赖" : "Unresolved dependencies",
      needsAttention: (value: number) => (zh ? `需要处理 · ${value}` : `Needs attention · ${value}`),
      unlinkedArtifacts: zh ? "未关联内容" : "Unlinked artifacts",
      unlinked: zh ? "未关联" : "Unlinked",
      noHiddenGraph: zh ? "没有隐藏的关系图状态" : "No hidden graph state",
      graphRecompiles: zh
        ? "关系边由源内容重新编译；固定项仅在当前会话有效。"
        : "Edges recompile from source; pins last only for this session.",
      deviceStorageFull: zh ? "本机存储空间不足" : "Device storage is full",
      lastSaved: (time: string) => (zh ? `上次保存 ${time}` : `Last saved ${time}`),
      justNow: zh ? "刚刚" : "just now",
      createReview: zh ? "创建汇报" : "Create review",
      exportArtifactAs: (name: string, target: string) =>
        zh ? `将 ${name} 导出为 ${target}` : `Export ${name} as ${target}`,
      exportAs: (target: string) => (zh ? `导出为 ${target}` : `Export as ${target}`),
      exportAsOpenDocument: (target: string) =>
        zh ? `导出为 ${target} OpenDocument` : `Export as ${target} OpenDocument`,
      exportStandaloneHtml: zh ? "导出为独立 HTML" : "Export as standalone HTML",
      exportFixedPdf: zh ? "导出为固定版式 PDF" : "Export as fixed PDF",
      exportMenu: zh ? "导出" : "Export",
      exportMenuBody: zh ? "选择交付格式" : "Choose a handoff format",
      canonicalSource: zh ? "规范源" : "Canonical source",
      pinnedCount: (value: number) => (zh ? `${value} 个已固定` : `${value} pinned`),
      liveBindings: (value: number) => (zh ? `${value} 项实时绑定` : `${value} live bindings`),
      pinContext: (name: string, pinned: boolean) =>
        zh
          ? pinned
            ? `从工作区 Agent 上下文移除 ${name}`
            : `将 ${name} 固定到工作区 Agent 上下文`
          : `${pinned ? "Remove" : "Pin"} ${name} ${pinned ? "from" : "in"} Workspace Agent context`,
      removePin: zh ? "移除临时 Agent 上下文固定" : "Remove temporary Agent context pin",
      keepPin: zh ? "在下一次工作区 Agent 上下文中保留此文件" : "Keep this file in the next Workspace Agent context",
      temporaryPins: (value: number) =>
        zh ? `${value} 个临时固定项` : `${value} temporary ${value === 1 ? "pin" : "pins"}`,
      includedUpstream: zh ? "会与所需上游来源一同纳入。" : "Included with required upstream sources.",
      clear: zh ? "清除" : "Clear",
      restoreLatestDifferent: zh ? "恢复最近一个不同的恢复点" : "Restore latest different checkpoint",
      restoreLatest: zh ? "恢复最近恢复点" : "Restore latest checkpoint",
      deviceHistory: zh ? "本机历史" : "Device history",
      checkpointCount: (value: number) =>
        zh ? `${value} 个恢复点` : `${value} ${value === 1 ? "checkpoint" : "checkpoints"}`,
      saveCurrent: zh ? "保存当前版本" : "Save current",
      current: zh ? "当前" : "Current",
      refreshAvailable: zh ? "可以刷新" : "Refresh available",
      reviewRefresh: zh ? "审核刷新" : "Review refresh",
      refreshNoLongerNeeded: zh ? "这份演示已不再需要来源刷新" : "This presentation no longer needs a source refresh",
      restore: zh ? "恢复" : "Restore",
      checkpointEmpty: zh
        ? "应用 Agent 补丁或按 ⌘S，即可保存当前源内容。"
        : "Apply an Agent patch or press ⌘S to capture the current source.",
      checkpointReasons: {
        agent: "Agent",
        manual: zh ? "手动" : "Manual",
        restore: zh ? "恢复保护" : "Restore safety",
      },
      editSource: (name: string) => (zh ? `编辑 ${name} 的源内容` : `Edit ${name} source`),
      syncedDraftSource: (name: string) =>
        zh ? `${name} 尚未保存的同步源草稿` : `Unsaved synchronized source draft for ${name}`,
      unsavedVisualDraft: zh ? "右侧编辑 · 左侧完整源草稿实时同步" : "Visual edit · complete source draft synced live",
      draftNeedsFix: zh ? "尚未保存 · 需要修正" : "Unsaved · needs attention",
      draftUnchanged: zh ? "尚未修改" : "No unsaved change",
      draftReady: zh ? "尚未保存 · 可以保存" : "Unsaved · ready to save",
      proposalPreview: zh ? "提案预览" : "Proposal preview",
      proposalReadOnly: zh ? "AI 提案 · 应用前只读" : "AI proposal · read-only until Apply",
      proposalSource: zh ? "建议的完整源内容" : "Proposed source",
      canonicalUnchanged: zh ? "应用前，规范源内容保持不变" : "Canonical source stays unchanged until Apply",
      proposalPreviewUnavailable: zh ? "无法预览此提案" : "Proposal preview unavailable",
      proposalOutput: zh ? "建议成品 · 尚未写入" : "Proposed output · nothing written",
      proposalSourceUnchanged: zh
        ? "此文件的源内容未修改；实时成品正基于完整建议工作区重新编译。"
        : "This source is unchanged; its live output is rendered against the complete proposed workspace.",
      contextSources: (sources: number, pins: number) =>
        zh
          ? `${sources} 个上下文来源${pins ? ` · ${pins} 个已固定` : ""}`
          : `${sources} context sources${pins ? ` · ${pins} pinned` : ""}`,
      charactersBound: (value: string) =>
        zh ? `${value} 个字符已绑定到当前版本` : `${value} characters bound to this revision`,
      agentScope: zh ? "Agent 修改范围" : "Agent change scope",
      queryEvidence: (value: number) =>
        zh
          ? `配置模型后，可在你提出请求时检查 ${value} 个有边界的本地 Query 结果；证据不会持久保存。`
          : `A configured model can inspect ${value} bounded local Query ${value === 1 ? "result" : "results"} after you ask; evidence is not persisted.`,
      proposedChange: (scope: "workspace" | "selection" | "file") =>
        zh
          ? `建议的${scope === "workspace" ? "工作区修改" : scope === "selection" ? "选区内补丁" : "文件补丁"}`
          : `Proposed ${scope === "workspace" ? "workspace change" : scope === "selection" ? "selection-confined patch" : "file patch"}`,
      typedOperations: (value: number) =>
        zh ? `${value} 个类型化源操作` : `${value} typed source ${value === 1 ? "operation" : "operations"}`,
      modelOutline: zh ? "模型辅助来源提纲" : "Model-assisted source outline",
      modelNarrative: zh ? "模型辅助证据问题" : "Model-assisted evidence questions",
      localPlan: zh ? "本地确定性方案" : "Local deterministic plan",
      repairedOnce: zh ? "已修复一次" : "repaired once",
      repairPassed: zh ? "编译器引导修复已通过" : "Compiler-guided repair passed",
      recovered: zh ? "一次编译器引导修复后已恢复" : "Recovered after one compiler-guided repair",
      firstUnapplied: zh ? "第一版建议未应用" : "First proposal stayed unapplied",
      runtimePassed: zh ? "运行影响预检已通过" : "Runtime impact preflight passed",
      changedFiles: (value: number) => (zh ? `${value} 个文件` : `${value} ${value === 1 ? "file" : "files"}`),
      changedLines: zh ? "变更行" : "changed lines",
      filesInPatch: zh ? "建议补丁中的文件" : "Files in proposed patch",
      reviewArtifact: (name: string) => (zh ? `审核 ${name}` : `Review ${name}`),
      newFile: zh ? "新文件" : "New file",
      typedOps: (value: number) => (zh ? `${value} 个类型化操作` : `${value} typed ${value === 1 ? "op" : "ops"}`),
      sourceDiffFor: (name: string) => (zh ? `${name} 的源内容差异` : `Source diff for ${name}`),
      newSourceDiff: zh ? "新源内容差异" : "New source diff",
      sourceDiff: zh ? "源内容差异" : "Source diff",
      selectChangedFile: zh
        ? "选择一个已修改文件以检查源内容差异。"
        : "Select a changed file to inspect its source diff.",
      apply: zh ? "应用" : "Apply",
      applyAll: zh ? "全部应用" : "Apply all",
      discardPatch: zh ? "丢弃建议补丁" : "Discard proposed patch",
      discard: zh ? "丢弃" : "Discard",
      browserQueryOutput: zh ? "浏览器本地 Query 结果" : "Browser-local query output",
      canonicalDataLive: zh ? "规范数据实时编译" : "Canonical data compiled live",
      explicitDataBinding: zh ? "明确 Data 绑定" : "Explicit Data binding",
      legacyDataBinding: zh ? "旧版首个 Data 绑定" : "Legacy first-Data binding",
      scalarMetricsFromSql: (value: number) =>
        zh
          ? `${value} 个从 SQL 编译的标量指标`
          : `${value} scalar ${value === 1 ? "metric" : "metrics"} compiled from SQL`,
      workspaceData: zh ? "工作区数据" : "workspace data",
      metricsCompiledLive: (value: number) => (zh ? `${value} 个指标实时编译` : `${value} metrics compiled live`),
      chartsCompiledLive: (value: number) =>
        zh ? `${value} 个图表实时编译` : `${value} ${value === 1 ? "chart" : "charts"} compiled live`,
      legacyMetrics: (value: number) => (zh ? `${value} 个旧版指标` : `${value} legacy metrics`),
      sqlMetrics: (value: number) => (zh ? `${value} 个 SQL 指标` : `${value} SQL metrics`),
      sqlMetricBadge: (value: number) =>
        zh ? `${value} 个 SQL 指标` : `${value} SQL ${value === 1 ? "metric" : "metrics"}`,
      chartBadge: (value: number) => (zh ? `${value} 个图表` : `${value} ${value === 1 ? "chart" : "charts"}`),
      liveBadge: (value: number) => (zh ? `${value} 项实时绑定` : `${value} live`),
    },
    documentStructure: {
      kicker: zh ? "文档结构 · 绑定当前版本" : "Document structure · revision-bound",
      actionTitles: {
        "insert-before": zh ? "在前方插入内容块" : "Insert block before",
        "insert-after": zh ? "在后方插入内容块" : "Insert block after",
        "move-up": zh ? "向上移动内容块" : "Move block up",
        "move-down": zh ? "向下移动内容块" : "Move block down",
        delete: zh ? "删除内容块" : "Delete block",
      },
      description: (target: string) =>
        zh
          ? `请审核“${target}”对应规范源内容的精确变化。确认前不会写入。`
          : `Review the exact canonical-source change for ${target}. Nothing is written until you confirm.`,
      details: (name: string) => (zh ? `${name} 的源内容变化` : `Source change for ${name}`),
      atomic: zh ? "一次原子本机写入 · 写入前先创建恢复点" : "One atomic device write · a checkpoint is created first",
      verifying: zh ? "正在核验…" : "Verifying…",
      deleteBlock: zh ? "删除内容块" : "Delete block",
      apply: zh ? "应用结构修改" : "Apply structure change",
      diff: zh ? "规范源内容差异" : "Canonical source diff",
    },
    checkpointRestore: {
      kicker: zh ? "本机历史 · 绑定当前版本" : "Device history · revision-bound",
      title: zh ? "审核版本恢复" : "Review checkpoint restore",
      description: zh
        ? "请审核恢复此版本所产生的精确源内容变化。确认前不会写入。"
        : "Review the exact source change before restoring this checkpoint. Nothing is written until you confirm.",
      details: zh ? "版本恢复详情" : "Checkpoint restore details",
      safety: zh
        ? "Orbit 会保留当前版本作为可恢复保护点，并再次核验完整工作区与本地运行影响。"
        : "Orbit keeps the current version as a recoverable safety point and rechecks the complete workspace and local runtime impact.",
      atomic: zh
        ? "一次原子本机写入 · 失败时所有源内容保持不变"
        : "One atomic device write · every source stays unchanged on failure",
      verifying: zh ? "正在核验…" : "Verifying…",
      restore: zh ? "确认恢复" : "Confirm restore",
      diff: zh ? "恢复前后的规范源差异" : "Canonical source diff after restore",
    },
    workspaceReset: {
      kicker: zh ? "本机工作区 · 可恢复切换" : "Device workspace · recoverable switch",
      sampleTitle: zh ? "恢复示例工作区？" : "Restore the sample workspace?",
      sampleDescription: zh
        ? "Orbit 会用内置示例替换当前本机工作区，并把当前文件、恢复点和任务记录完整保留为上一个工作区。"
        : "Orbit will replace the current device workspace with the built-in sample and preserve its files, checkpoints, and task records as the previous workspace.",
      recoveryTitle: zh ? "恢复上一个工作区？" : "Restore the previous workspace?",
      recoveryDescription: zh
        ? "Orbit 会恢复重置前的完整本机工作区，并把当前工作区保留为下一次可恢复版本。"
        : "Orbit will restore the complete pre-reset device workspace and preserve the current workspace as the next recoverable version.",
      details: zh ? "工作区切换详情" : "Workspace switch details",
      transition: zh ? "当前与目标工作区" : "Current and target workspaces",
      current: zh ? "当前工作区" : "Current workspace",
      previous: zh ? "上一个工作区" : "Previous workspace",
      sample: zh ? "内置示例" : "Built-in sample",
      filesLabel: zh ? "个文件" : "files",
      checkpointsLabel: zh ? "个源内容恢复点" : "source checkpoints",
      savedTasksLabel: zh ? "个已保存任务" : "saved tasks",
      taskRunsLabel: zh ? "次运行记录" : "recorded runs",
      targetFiles: zh ? "切换后可用文件" : "Files available after the switch",
      moreFiles: zh ? "个其他文件" : "more files",
      sampleSafety: zh
        ? "当前工作区会作为一份完整本机恢复版本，与示例工作区在同一次写入中保存。"
        : "The current workspace becomes one complete device recovery version in the same write as the sample workspace.",
      recoverySafety: zh
        ? "当前工作区与上一个工作区会安全互换，因此这次恢复本身仍可撤销。"
        : "The current and previous workspaces swap safely, so this recovery remains reversible.",
      folderSafety: zh
        ? "已连接文件夹不会自动更改；只有之后明确选择“写回工作区文件”才会写入。"
        : "A connected folder stays unchanged; Orbit writes to it only after an explicit Push workspace files action.",
      atomic: zh
        ? "一次原子本机写入 · 存储失败时当前工作区保持不变"
        : "One atomic device write · the current workspace stays unchanged if storage fails",
      restoreSample: zh ? "恢复示例" : "Restore sample",
      restorePrevious: zh ? "恢复上一个工作区" : "Restore previous workspace",
      saving: zh ? "正在安全切换…" : "Switching safely…",
      previousAvailable: zh ? "恢复上一个工作区" : "Restore previous workspace",
      previousAvailableDetail: zh
        ? "完整恢复重置前的文件、版本与任务记录"
        : "Recover files, versions, and task records from before reset",
      sampleDetail: zh
        ? "先审核，再保留当前工作区并打开内置示例"
        : "Review first, preserve the current workspace, then open the sample",
    },
    directorySync: {
      kicker: zh ? "本地文件夹 · 版本绑定审核" : "Local folder · revision-bound review",
      pullTitle: zh ? "从文件夹读取这些变化？" : "Pull these folder changes?",
      pushTitle: zh ? "将这些变化写入文件夹？" : "Push these changes to the folder?",
      initializeTitle: zh ? "用当前工作区初始化文件夹？" : "Initialize the folder with this workspace?",
      pullDescription: zh
        ? "Orbit 会再次读取文件夹；只有文件内容与本机工作区仍和本次审核完全一致时，才会替换本机工作区。"
        : "Orbit will read the folder again and replace the device workspace only if both sides still exactly match this review.",
      pushDescription: zh
        ? "Orbit 会再次读取文件夹；只有文件夹与本机工作区都没有变化时，才会写入同名文件和工作区清单。"
        : "Orbit will read the folder again and write same-name files plus the workspace manifest only if both sides are unchanged.",
      initializeDescription: zh
        ? "Orbit 会确认文件夹仍为空，再写入当前可读源文件、已引用图片与工作区清单。"
        : "Orbit will confirm the folder is still empty, then write the current readable sources, referenced images, and workspace manifest.",
      details: zh ? "文件夹同步详情" : "Folder sync details",
      device: zh ? "本机工作区" : "Device workspace",
      folder: zh ? "连接文件夹" : "Connected folder",
      afterSync: zh ? "同步后" : "After sync",
      filesLabel: zh ? "个源文件" : "source files",
      assetsLabel: zh ? "个本地图片" : "local images",
      changes: zh ? "本次同步的文件结果" : "File outcomes in this sync",
      fileEntry: zh ? "源" : "Source",
      imageEntry: zh ? "图片" : "Image",
      add: zh ? "新增" : "Add",
      update: zh ? "更新" : "Update",
      remove: zh ? "移出工作区" : "Remove from workspace",
      retain: zh ? "保留在文件夹" : "Keep in folder",
      unchanged: zh ? "不变" : "Unchanged",
      retainedNote: zh
        ? "仅存在于文件夹的文件会原样保留，但不会进入新的 Orbit 工作区清单。"
        : "Folder-only files stay untouched but will not belong to the new Orbit workspace manifest.",
      pullSafety: zh
        ? "当前完整本机工作区会保存为一个可恢复版本；读取失败不会改变任何源内容。"
        : "The complete current device workspace becomes a recoverable version; a failed pull changes no source.",
      pushSafety: zh
        ? "同名文件可能被覆盖；审核后任何一侧发生变化都会阻止写入。"
        : "Same-name files may be overwritten; any change on either side after review blocks the write.",
      initializeSafety: zh
        ? "无关文件保持不变；只有审核中列出的源文件、图片和 Orbit 清单会写入。"
        : "Unrelated files stay untouched; only the reviewed sources, images, and Orbit manifest are written.",
      exactRecheck: zh
        ? "确认时再次逐字节读取 · 漂移时保持零写入"
        : "Exact reread on confirm · zero writes when either side drifts",
      pull: zh ? "确认读取" : "Confirm pull",
      push: zh ? "确认写入" : "Confirm push",
      initialize: zh ? "初始化文件夹" : "Initialize folder",
      syncing: zh ? "正在安全同步…" : "Syncing safely…",
    },
    importReview: {
      kicker: zh ? "本地转换 · 不上传" : "Local conversion · no upload",
      title: zh ? "审核导入后的可读源" : "Review imported sources",
      description: (name: string, value: number) =>
        zh
          ? `${name} 已生成 ${value} 份可读内容。确认前不会写入。`
          : `${name} produced ${value} readable ${value === 1 ? "artifact" : "artifacts"}. Nothing is written until you confirm.`,
      details: zh ? "导入详情" : "Import details",
      atomic: zh ? "确认后执行一次原子本机写入" : "One atomic device write after confirmation",
      importSources: (value: number) =>
        zh ? `导入 ${value} 份源内容` : `Import ${value} ${value === 1 ? "source" : "sources"}`,
      fidelityNotes: zh ? "保真说明" : "Fidelity notes",
      noOmissions: zh ? "转换器未报告语义缺失。" : "The adapter reported no semantic omissions.",
      generatedPreviews: zh ? "生成的源内容预览" : "Generated source previews",
      sourceStats: (lines: string, chars: string) =>
        zh ? `${lines} 行 · ${chars} 个字符` : `${lines} lines · ${chars} chars`,
      previewCapped: zh
        ? "预览已截断 · 将导入完整且通过校验的源内容。"
        : "Preview capped · the complete validated source will be imported.",
    },
    exportReview: {
      kicker: zh ? "浏览器本地导出 · 不上传" : "Browser-local export · no upload",
      title: (kind: "office" | "odf" | "pdf" | "html" | "data" | "source") =>
        zh
          ? {
              office: "审核 Office 导出",
              odf: "审核 OpenDocument 导出",
              pdf: "审核 PDF 导出",
              html: "审核 HTML 导出",
              data: "审核数据导出",
              source: "审核规范源内容",
            }[kind]
          : {
              office: "Review Office export",
              odf: "Review OpenDocument export",
              pdf: "Review PDF export",
              html: "Review HTML export",
              data: "Review Data export",
              source: "Review canonical source",
            }[kind],
      description: (name: string, outputKind: string, target: string) =>
        zh
          ? `确认下载后，${name} 将生成一份${outputKind} ${target} 文件。`
          : `${name} will become a ${outputKind} ${target} file after you confirm the download.`,
      outputKinds: {
        semantic: zh ? "语义化" : "semantic",
        fixed: zh ? "固定版式" : "fixed-layout",
        standalone: zh ? "独立" : "standalone",
        portable: zh ? "便携数据" : "portable data",
        source: zh ? "可读源内容" : "readable source",
      },
      details: (target: string) => (zh ? `${target} 导出详情` : `${target} export details`),
      noChanges: zh ? "不会修改工作区或本机草稿" : "No workspace or device draft changes",
      download: (target: string) => (zh ? `下载 ${target}` : `Download ${target}`),
      route: (target: string) => (zh ? `${target} 导出路径` : `${target} export route`),
      generatedFile: (target: string) => (zh ? `已生成的 ${target} 文件` : `Generated ${target} file`),
      descriptors: {
        office: zh ? "确定性 OOXML ZIP" : "deterministic OOXML ZIP",
        odf: zh ? "确定性 ODF ZIP" : "deterministic ODF ZIP",
        pdf: zh ? "固定版式 PDF" : "fixed-layout PDF",
        html: zh ? "自包含无脚本文件" : "self-contained scriptless file",
        data: zh ? "确定性 UTF-8 数据" : "deterministic UTF-8 data",
        source: zh ? "原样 UTF-8 源内容" : "exact UTF-8 source",
      },
      fidelityNotes: zh ? "保真说明" : "Fidelity notes",
      canonicalTitle: zh ? "规范源内容" : "Canonical source",
      canonicalBody: zh
        ? "Orbit 导出已校验的源内容，以及当前工作区中被引用的数据。"
        : "Orbit exports the validated source and any referenced current workspace data.",
      sourceCanonicalBody: zh
        ? "Orbit 保留这份已校验源内容的每一个字节；不会编译或改写其中的实时引用。"
        : "Orbit preserves this exact validated source; it does not compile or rewrite its live references.",
      packageTitle: (packaged: boolean) =>
        packaged ? (zh ? "标准文件包" : "Standard package") : zh ? "便携成品" : "Portable output",
      sourceFileTitle: zh ? "可读文件" : "Readable file",
      packageBody: (kind: "office" | "odf" | "pdf" | "html" | "data" | "source") =>
        zh
          ? {
              office: "下载使用标准 Office Open XML 部件及关系。",
              odf: "下载使用标准 OpenDocument 内容、样式、MIME 与清单部件。",
              pdf: "下载在标准 PDF 中嵌入版式、Unicode 字体和当前数据快照。",
              html: "下载包含版式、主题、指标和图表，不依赖外部资源。",
              data: "下载使用确定性的 UTF-8 CSV 或 JSON，不携带隐藏公式或脚本。",
              source: "下载保留精确的可读源内容；Orbit 绑定与本地资源引用仍是源表达式。",
            }[kind]
          : {
              office: "The download uses standard Office Open XML parts and relationships.",
              odf: "The download uses standard OpenDocument content, styles, MIME, and manifest parts.",
              pdf: "The download embeds its layout, Unicode font, and current data snapshots in a standard PDF.",
              html: "The download contains its layout, theme, metrics, and charts without external assets.",
              data: "The download uses deterministic UTF-8 CSV or JSON without hidden formulas or scripts.",
              source:
                "The download preserves the exact readable source. Orbit bindings and local asset references stay source expressions.",
            }[kind],
      handoffTitle: zh ? "明确交付" : "Explicit handoff",
      handoffBody: zh
        ? "只有确认后，浏览器才会启动一次本地下载。"
        : "The browser starts one local download only after your confirmation.",
    },
    newArtifact: {
      kicker: zh ? "从可读源开始" : "Start from readable source",
      title: zh ? "新建内容" : "Create a new artifact",
      description: zh
        ? "选择规范源格式。Query 和 Chart 从第一个版本起就绑定到精确的上游内容与字段。"
        : "Choose a canonical source. Query and Chart files bind to exact upstream artifacts and fields from their first revision.",
      details: zh ? "新建内容详情" : "New artifact details",
      atomic: zh ? "一次原子本机写入 · 不上传" : "One atomic device write · no upload",
      verifying: zh ? "正在核验实时源内容…" : "Verifying live source…",
      create: zh ? "创建源内容" : "Create source",
      type: zh ? "内容类型" : "Artifact type",
      titleLabel: zh ? "标题" : "Title",
      titleHelp: zh
        ? "Orbit 会生成便携文件名和稳定工作区 ID；创建后可立即编辑源内容。"
        : "Orbit derives a portable filename and stable workspace id. You can edit the source immediately.",
      sourceBinding: zh ? "来源绑定" : "Source binding",
      dataSource: zh ? "数据来源" : "Data source",
      dataOrQuerySource: zh ? "Data 或 Query 来源" : "Data or Query source",
      noCompatibleSource: zh ? "没有兼容来源" : "No compatible source",
      categoryField: zh ? "分类字段" : "Category field",
      valueField: zh ? "数值字段" : "Value field",
      numeric: zh ? "数值" : "numeric",
      mark: zh ? "图形" : "Mark",
      barCompare: zh ? "柱形 · 对比" : "Bar · compare",
      lineSequence: zh ? "折线 · 序列" : "Line · sequence",
      areaVolume: zh ? "面积 · 体量序列" : "Area · volume sequence",
      format: zh ? "数字格式" : "Number format",
      number: zh ? "数字" : "Number",
      currency: zh ? "货币 · USD" : "Currency · USD",
      percent: zh ? "百分比" : "Percent",
      embedOptional: zh ? "嵌入到 · 可选" : "Embed in · optional",
      reusableOnly: zh ? "只创建可复用 Chart" : "Create reusable Chart only",
      document: zh ? "文档" : "Document",
      presentation: zh ? "演示" : "Presentation",
      queryBindingHelp: zh
        ? "Orbit 会写入明确的 -- orbit:data 指令，因此文件排序变化不会改变 workspace_data。"
        : "Orbit writes an explicit -- orbit:data directive, so workspace_data never changes when files are reordered.",
      chartBindingHelp: zh
        ? "Chart JSON 保存精确来源 ID 与字段名；报告和演示可通过同一图表绑定复用。"
        : "The Chart JSON stores the exact source id and field names; reports and decks can reuse it with one chart binding.",
      preview: zh ? "新源内容预览" : "New source preview",
      readyToEdit: zh ? "可以编辑" : "ready to edit",
      addDataForQuery: zh
        ? "请先添加有效的 Data 表，再创建 Query。"
        : "Add a valid Data table before creating a Query.",
      addSourceForChart: zh
        ? "请先添加有效的 Data 表或 Query，再创建 Chart。"
        : "Add a valid Data table or Query before creating a Chart.",
      typeNames: {
        document: zh ? "文档" : "Document",
        data: zh ? "数据" : "Data",
        query: zh ? "查询" : "Query",
        chart: zh ? "图表" : "Chart",
        slides: zh ? "演示" : "Presentation",
      },
      typeDescriptions: {
        document: zh ? "以 Markdown 编写的长文档" : "Long-form writing in Markdown",
        data: zh ? "可读、可分析的数据表" : "Readable, analyzable table data",
        query: zh ? "绑定 Data 的本地 SQL" : "Local SQL bound to Data",
        chart: zh ? "绑定 Data 或 Query 的图表" : "Chart bound to Data or Query",
        slides: zh ? "以语义 HTML 编写的演示" : "Presentation authored in semantic HTML",
      },
      placeholders: {
        document: zh ? "项目简报" : "Project brief",
        data: zh ? "经营指标" : "Operating metrics",
        query: zh ? "收入分析" : "Revenue analysis",
        chart: zh ? "各区域收入" : "Revenue by region",
        slides: zh ? "董事会叙事" : "Board narrative",
      },
    },
    transaction: {
      statuses: {
        created: zh ? "新建" : "New",
        edited: zh ? "已编辑" : "Edited",
        validated: zh ? "已校验" : "Validated",
        input: zh ? "输入" : "Input",
      },
      title: zh ? "事务关系图" : "Transaction map",
      summary: (changes: number, nodes: number, bindings: number) =>
        zh
          ? `${changes} 项修改 · ${nodes} 个源节点 · ${bindings} 项绑定变化`
          : `${changes} ${changes === 1 ? "change" : "changes"} · ${nodes} source ${nodes === 1 ? "node" : "nodes"} · ${bindings} binding ${bindings === 1 ? "change" : "changes"}`,
      dependencyEdges: (value: number) => (zh ? `${value} 条依赖边` : `${value} dependency edges`),
      sources: zh ? "建议事务中的源内容" : "Sources in proposed transaction",
      dependencies: zh ? "建议的源内容依赖变化" : "Proposed source dependency changes",
      noBindings: zh ? "此事务不会改变跨文件绑定。" : "No cross-file bindings change in this transaction.",
      note: zh
        ? "可审核新建与编辑节点的差异。输入和已校验节点保持不变；Orbit 会编译完整建议工作区以证明结果。"
        : "New and edited nodes are reviewable diffs. Input and validated nodes remain unchanged; Orbit compiled them to prove the complete proposed workspace.",
      reviewNode: (name: string, status: string) =>
        zh ? `审核 ${name}，${status}` : `Review ${name}, ${status.toLowerCase()}`,
      nodeLabel: (name: string, status: string) => (zh ? `${name}，${status}` : `${name}, ${status.toLowerCase()}`),
    },
    preview: {
      numberLocale: zh ? "zh-CN" : "en-US",
      cancel: zh ? "取消" : "Cancel",
      source: zh ? "源内容" : "Source",
      configure: zh ? "配置" : "Configure",
      title: zh ? "标题" : "Title",
      description: zh ? "描述" : "Description",
      optional: zh ? "可选" : "optional",
      numberFormat: zh ? "数字格式" : "Number format",
      liveChart: zh ? "实时图表" : "Live chart",
      queryOutput: zh ? "Query 结果" : "Query output",
      marks: (value: number) => (zh ? `${value} 个图形` : `${value} marks`),
      clickExactDatum: (mark: "line" | "bar" | "area") =>
        zh
          ? `点击标签或${mark === "bar" ? "柱" : "点"}可打开精确源单元格`
          : `Click a label or ${mark === "bar" ? "bar" : "point"} to open its exact source cell`,
      categoryDatum: (title: string, label: string) =>
        zh ? `${title} · 分类 ${label}` : `${title} · category ${label}`,
      valueDatum: (title: string, value: string) => (zh ? `${title} · 数值 ${value}` : `${title} · value ${value}`),
      openCellForAgent: (label: string, artifact: string) =>
        zh ? `在 ${artifact} 中打开 ${label}，供 Agent 使用` : `Open ${label} in ${artifact} as Agent context`,
      openExactCell: (column: string, artifact: string) =>
        zh ? `打开 ${artifact} 中精确的 ${column} 源单元格` : `Open exact ${column} source cell in ${artifact}`,
      chartNotFound: (id: string) => (zh ? `找不到图表 · ${id}` : `Chart not found · ${id}`),
      chartUnavailable: (error: string) => (zh ? `图表不可用 · ${error}` : `Chart unavailable · ${error}`),
      selectExact: (label: string) => (zh ? `选择“${label}”的精确源内容` : `Select exact ${label} source`),
      selectLinkExact: (label: string) =>
        zh
          ? `选择“${label}”的精确源内容；按住 Command 或 Control 点击可打开链接`
          : `Select exact ${label} source; Command-click or Control-click opens the link`,
      sourceActions: (label: string) => (zh ? `${label} 的源内容操作` : `${label} source actions`),
      selectForAgent: (label: string) =>
        zh ? `在规范源内容中选择 ${label}，供 Agent 使用` : `Select ${label} in canonical source for Agent context`,
      editTarget: (label: string) => (zh ? `编辑 ${label}` : `Edit ${label}`),
      editBlockTarget: (label: string, type: string) =>
        zh ? `编辑 ${label} 的${type}内容块` : `Edit ${label} ${type}`,
      editExactBlock: (type: string) => (zh ? `编辑精确${type}内容块` : `Edit exact ${type} block`),
      structureActions: (label: string) => (zh ? `${label} 的结构操作` : `${label} structure actions`),
      openStructureActions: (label: string) =>
        zh ? `打开 ${label} 的结构操作` : `Open structure actions for ${label}`,
      blockStructure: zh ? "内容块结构" : "Block structure",
      insertBefore: zh ? "在前方插入内容块" : "Insert a block before",
      insertAfter: zh ? "在后方插入内容块" : "Insert a block after",
      moveUp: zh ? "向上移动内容块" : "Move block up",
      moveDown: zh ? "向下移动内容块" : "Move block down",
      deleteBlock: zh ? "删除内容块" : "Delete block",
      unsupportedBoundary: zh ? "不支持此结构边界" : "Unsupported structure boundary",
      alreadyFirst: zh ? "已经是第一个" : "Already first",
      alreadyLast: zh ? "已经是最后一个" : "Already last",
      lastCannotDelete: zh ? "不能删除最后一个内容块" : "The last block cannot be deleted",
      orbitDocument: zh ? "Orbit 文档" : "Orbit document",
      documentMode: (mode: "block" | "section" | "select" | "live") =>
        zh
          ? {
              block: "选择或编辑一个精确内容块",
              section: "选择或编辑一个精确章节",
              select: "点击章节交给 Agent",
              live: "实时编译",
            }[mode]
          : {
              block: "Select or edit one exact block",
              section: "Select or edit one exact section",
              select: "Click a section for Agent",
              live: "Live compilation",
            }[mode],
      selectDocumentSection: zh ? "选择或编辑文档章节" : "Select or edit a document section",
      editingSection: zh ? "正在编辑精确章节" : "Editing exact section",
      editingBlock: (type: string) => (zh ? `正在编辑精确${type}内容块` : `Editing exact ${type}`),
      sectionLimit: (value: string) =>
        zh ? `可视化文档章节最多 ${value} 个字符。` : `Visual Document sections are limited to ${value} characters.`,
      blockLimit: (value: string) =>
        zh ? `可视化文档内容块最多 ${value} 个字符。` : `Visual Document blocks are limited to ${value} characters.`,
      sourceDraft: zh ? "源内容草稿" : "Source draft",
      blockSource: zh ? "内容块源内容" : "Block source",
      syncedLive: zh ? "实时同步" : "Synced live",
      formatSection: zh ? "设置文档章节格式" : "Format Document section",
      formatBlock: (type: string) => (zh ? `设置文档${type}内容块格式` : `Format Document ${type}`),
      editMarkdownSection: (label: string) =>
        zh ? `编辑 ${label} 的 Markdown 章节` : `Edit ${label} Markdown section`,
      editMarkdownBlock: (label: string, type: string) =>
        zh ? `编辑 ${label} 的 Markdown ${type} 内容块` : `Edit ${label} Markdown ${type} block`,
      draftPreview: zh ? "草稿预览" : "Draft preview",
      blockPreview: zh ? "内容块预览" : "Block preview",
      sectionEmpty: zh ? "章节不能为空。" : "This section cannot be empty.",
      blockEmpty: zh ? "内容块不能为空。" : "This block cannot be empty.",
      sectionContract: zh
        ? "一个绑定当前版本的章节 · 实时绑定保持固定 · 保存会写入规范源内容"
        : "One revision-bound section · live bindings stay fixed · save writes canonical source",
      blockContract: (type: string) =>
        zh
          ? `一个已证明的${type}内容块 · 类型和实时绑定保持固定 · 保存会写入规范源内容`
          : `One proven ${type} · type and live bindings stay fixed · save writes canonical source`,
      saveSection: zh ? "保存章节" : "Save section",
      saveBlock: zh ? "保存内容块" : "Save block",
      newBefore: zh ? "在前方新建内容块" : "New block before",
      newAfter: zh ? "在后方新建内容块" : "New block after",
      oneMarkdownBlock: zh ? "一个 Markdown 内容块" : "One Markdown block",
      blockPlaceholder: zh
        ? "段落、标题、列表、引用、代码块、表格或分隔线…"
        : "A paragraph, heading, list, quote, code block, table, or divider…",
      insertionContract: zh
        ? "一个新内容块 · 不包含实时绑定 · 写入前审核精确源差异"
        : "One new block · no live bindings · review the exact source diff before writing",
      reviewInsertion: zh ? "审核插入" : "Review insertion",
      resultSummary: zh ? "结果摘要" : "Result summary",
      rows: (value: number, more = false) => (zh ? `${value}${more ? "+" : ""} 行` : `${value}${more ? "+" : ""} rows`),
      columns: (value: number) => (zh ? `${value} 列` : `${value} columns`),
      valueType: (label: string) => (zh ? `${label} 的值类型` : `Value type for ${label}`),
      auto: zh ? "自动" : "Auto",
      text: zh ? "文本" : "Text",
      number: zh ? "数字" : "Number",
      boolean: zh ? "布尔值" : "Boolean",
      empty: zh ? "空值" : "Empty",
      saveCell: (label: string) => (zh ? `保存 ${label}` : `Save ${label}`),
      saveCanonical: zh ? "保存到规范源内容" : "Save to canonical source",
      cancelCell: zh ? "取消单元格编辑" : "Cancel cell edit",
      exactRow: zh ? "选择完整规范源数据行" : "Select the complete canonical row",
      editCell: zh ? "编辑此规范源单元格" : "Edit this canonical source cell",
      selectCellTitle: (label: string, editable: boolean) =>
        zh
          ? `${editable ? "按 Enter 编辑 · " : ""}选择精确规范源单元格 · ${label}`
          : `${editable ? "Press Enter to edit · " : ""}Select the exact canonical source cell · ${label}`,
      noRows: zh ? "Query 已完成，但没有返回数据行。" : "Query completed with no rows.",
      dataFootnote: (mode: "edit" | "cell" | "row" | "none") =>
        zh
          ? {
              edit: "已在本地解析 — 点击选择精确源内容；按 Enter 或点击铅笔可编辑已证明的标量单元格。",
              cell: "已在本地解析 — 点击单元格提供精确 Agent 上下文，或点击行号提供完整记录。",
              row: "已在本地解析 — 点击行号将完整记录绑定为 Agent 上下文。",
              none: "已在本地解析 — 没有可定位数据离开此设备。",
            }[mode]
          : {
              edit: "Parsed locally — click selects exact source; press Enter or use the pencil to edit a proven scalar cell.",
              cell: "Parsed locally — click a cell for exact Agent context, or a row number for the full record.",
              row: "Parsed locally — click a row number to bind the full record as Agent context.",
              none: "Parsed locally — no targetable rows left this device.",
            }[mode],
      runningLocally: zh ? "正在本地运行" : "Running locally",
      loadingDuckDB: zh
        ? "正在把绑定的 Data 内容加载到 DuckDB-Wasm…"
        : "Loading the bound Data artifact into DuckDB-Wasm…",
      queryResultVia: (name: string) => (zh ? `Query 结果 · ${name}` : `Query result · ${name}`),
      queryFootnote: (engine: string, dataName: string, direct: boolean, truncated: boolean) =>
        zh
          ? `${engine} · ${dataName} 始终留在此浏览器${direct ? " · 可证明时，结果行号与直接字段可打开规范源内容；派生单元格保持只读" : " · 此 Query 形状无法证明一一对应关系，因此保持只读"}${truncated ? " · 预览最多显示 500 行" : ""}。`
          : `${engine} · ${dataName} stayed in this browser${direct ? " · result row numbers and direct fields, when present, open canonical source; derived cells stay read-only" : " · this query shape stays read-only because no one-to-one lineage was proven"}${truncated ? " · preview limited to 500 rows" : ""}.`,
      boundChartSource: zh ? "已绑定图表来源" : "Bound chart source",
      unknownSource: zh ? "未知来源" : "Unknown source",
      chartInvalid: zh ? "当前 Chart JSON 无效。" : "The current Chart JSON is invalid.",
      chartCouldNotCompile: zh ? "图表无法编译。" : "The chart could not compile.",
      completeChartSource: zh ? "选择完整规范 Chart JSON" : "Select the complete canonical Chart JSON",
      editingChart: zh ? "正在编辑完整 Chart 规范" : "Editing complete Chart spec",
      untitledChart: zh ? "未命名图表" : "Untitled chart",
      chartLocked: zh ? "严格 Chart JSON · 来源身份已锁定" : "Strict Chart JSON · source identity locked",
      editChartTitle: zh ? "编辑 Chart 标题" : "Edit Chart title",
      editChartDescription: zh ? "编辑 Chart 描述" : "Edit Chart description",
      mark: zh ? "图形" : "Mark",
      bar: zh ? "柱形" : "Bar",
      line: zh ? "折线" : "Line",
      area: zh ? "面积" : "Area",
      sort: zh ? "排序" : "Sort",
      sourceOrder: zh ? "源顺序" : "Source order",
      ascending: zh ? "升序" : "Ascending",
      descending: zh ? "降序" : "Descending",
      categoryField: zh ? "分类字段" : "Category field",
      valueField: zh ? "数值字段" : "Value field",
      currency: zh ? "货币" : "Currency",
      percent: zh ? "百分比" : "Percent",
      visibleMarks: zh ? "可见图形" : "Visible marks",
      chooseVisibleMarks: zh ? "选择 Chart 最多显示的图形数" : "Choose maximum visible Chart marks",
      accentColor: zh ? "主题色" : "Accent color",
      chooseAccentColor: zh ? "选择 Chart 主题色" : "Choose Chart accent color",
      editAccentHex: zh ? "编辑 Chart 主题色十六进制值" : "Edit Chart accent hex color",
      chartSourceLock: (name: string) =>
        zh
          ? `来源 · ${name} · 如需改变身份，请编辑规范源内容或使用已审核的 Agent 流程`
          : `Source · ${name} · change identity in canonical source or reviewed Agent flow`,
      chartDraft: zh ? "Chart 草稿预览" : "Draft Chart preview",
      runtimeDraft: zh ? "已通过运行时校验的草稿" : "Runtime-validated draft",
      chooseChartProperties: zh ? "请选择有效的 Chart 属性。" : "Choose valid Chart properties.",
      chartContract: zh
        ? "一个严格规范 · 已核验运行影响 · 保存会重写规范 Chart JSON"
        : "One strict spec · runtime impact verified · save rewrites canonical Chart JSON",
      saveChart: zh ? "保存 Chart" : "Save Chart",
      slides: (value: number) => (zh ? `${value} 页演示` : `${value} slides`),
      deckMode: (mode: "edit" | "sandbox" | "legacy") =>
        zh
          ? {
              edit: "Deck Markdown → 选择或编辑一页精确演示",
              sandbox: "Deck Markdown → 沙盒 HTML",
              legacy: "旧版沙盒 HTML",
            }[mode]
          : {
              edit: "Deck Markdown → select or edit one exact slide",
              sandbox: "Deck Markdown → sandboxed HTML",
              legacy: "Legacy sandboxed HTML",
            }[mode],
      semanticHtmlEditMode: zh
        ? "语义 HTML → 选择或编辑一页精确演示"
        : "Semantic HTML → select or edit one exact slide",
      selectDeckSlide: zh ? "选择或编辑 Deck 演示页" : "Select or edit a Deck slide",
      editingSlide: (index: number) => (zh ? `正在编辑第 ${index} 页精确演示` : `Editing exact slide ${index}`),
      chooseLayout: (label: string) => (zh ? `选择 ${label} 的版式` : `Choose layout for ${label}`),
      editEyebrow: (label: string) => (zh ? `编辑 ${label} 的眉题` : `Edit eyebrow for ${label}`),
      editSlideMarkdown: (label: string) => (zh ? `编辑 ${label} 的演示页 Markdown` : `Edit ${label} slide Markdown`),
      slideDraft: (label: string) => (zh ? `${label} 的草稿预览` : `Draft preview for ${label}`),
      layout: zh ? "版式" : "Layout",
      eyebrow: zh ? "眉题" : "Eyebrow",
      slideMarkdown: zh ? "演示页 Markdown" : "Slide Markdown",
      slideHtml: zh ? "演示页 HTML" : "Slide HTML",
      sandboxedSlide: zh ? "单页沙盒预览" : "Sandboxed one-slide preview",
      validSlideHeading: zh ? "请添加有效的 # 或 ## 演示页标题。" : "Add a valid # or ## slide heading.",
      validHtmlSlide: zh ? "请保留一个有效的外层 <section> 演示页。" : "Keep one valid outer <section> slide.",
      slideContract: zh
        ? "一页绑定当前版本的演示 · 绑定保持固定 · 保存会写入规范源内容"
        : "One revision-bound slide · bindings stay fixed · save writes canonical source",
      saveSlide: zh ? "保存演示页" : "Save slide",
      htmlSlideContract: zh
        ? "一页绑定当前版本的语义 HTML · 实时镜像左侧源内容 · 保存前核验完整演示"
        : "One revision-bound semantic HTML slide · mirrored live to Source · complete presentation verified before save",
      saveHtmlSlide: zh ? "保存 HTML 演示页" : "Save HTML slide",
      createEditableDeck: zh ? "创建可编辑的 Deck Markdown 演示" : "Create an editable Deck Markdown presentation",
      renderedPresentation: zh ? "已渲染演示预览" : "Rendered presentation preview",
      startWriting: zh ? "开始输入即可编译预览。" : "Start writing to compile a preview.",
      largeDocument: zh ? "大文档快速预览" : "Large document quick preview",
      largeDocumentBody: zh
        ? "为保持切换和输入流畅，这里先显示文档开头；完整内容始终保留在左侧源编辑器中。"
        : "To keep switching and typing responsive, this view shows the beginning first. The complete content remains in the Source editor.",
      formattingLabels: {
        bold: zh ? "粗体" : "Bold",
        italic: zh ? "斜体" : "Italic",
        strikethrough: zh ? "删除线" : "Strikethrough",
        code: zh ? "行内代码" : "Inline code",
        link: zh ? "链接" : "Link",
        "bullet-list": zh ? "无序列表" : "Bulleted list",
        "numbered-list": zh ? "有序列表" : "Numbered list",
        quote: zh ? "引用" : "Quote",
      },
    },
  };
}

export type OrbitUICopy = ReturnType<typeof buildOrbitUICopy>;

const ORBIT_UI_COPY: Partial<Record<OrbitLocale, OrbitUICopy>> = {
  en: buildOrbitUICopy("en"),
  "zh-CN": buildOrbitUICopy("zh-CN"),
};

export function orbitUICopy(locale: OrbitLocale): OrbitUICopy {
  const cached = ORBIT_UI_COPY[locale];
  if (cached) return cached;
  requireOrbitLocaleCatalog(locale);
  const localized =
    locale === "zh-TW"
      ? localizeChineseCatalog(buildOrbitUICopy("zh-CN"))
      : localizeGeneratedCatalog(locale, buildOrbitUICopy("en"));
  ORBIT_UI_COPY[locale] = localized;
  return localized;
}

const chineseArtifactCommands: Record<ArtifactKind, string[]> = {
  document: ["把摘要压缩成三条要点", "补充下一步行动"],
  data: ["按收入从高到低排序", "增加利润率列"],
  query: ["计算利润率并排序", "汇总季度收入"],
  chart: ["保持数据源顺序", "改成紫色强调"],
  slides: ["把主题改成深色", "新增一页结论"],
};

const englishArtifactCommands: Record<ArtifactKind, string[]> = {
  document: ["Condense the summary into three points", "Add next actions"],
  data: ["Sort revenue high to low", "Add a margin column"],
  query: ["Calculate margin and sort", "Summarize quarterly revenue"],
  chart: ["Keep source order", "Change the accent to purple"],
  slides: ["Switch to the dark theme", "Add a conclusion slide"],
};

const chineseWorkspaceCommands = [
  "根据收入数据创建分析、图表和报告",
  "根据当前报告新建一份演示",
  "同步季度结论到报告和演示",
  "让分析、报告和演示保持一致",
];

const englishWorkspaceCommands = [
  "Create an analysis, chart, and report from revenue data",
  "Create a presentation from the current report",
  "Synchronize the quarterly conclusions across the report and presentation",
  "Keep the analysis, report, and presentation aligned",
];

const chineseSelectionCommands: Record<ArtifactKind, string[]> = {
  document: ["把选中内容压缩成一句话", "把选中内容改成三条要点"],
  data: ["把选中数值乘以 1.1", "把选中内容转成大写"],
  query: ["把选中内容转成大写", "去掉选中内容两端空格"],
  chart: ["把选中内容转成大写", "去掉选中内容两端空格"],
  slides: ["把选中内容压缩成一句话", "把选中内容改成三条要点"],
};

const englishSelectionCommands: Record<ArtifactKind, string[]> = {
  document: ["Condense the selection into one sentence", "Turn the selection into three points"],
  data: ["Multiply the selected number by 1.1", "Uppercase the selection"],
  query: ["Uppercase the selection", "Trim the selection"],
  chart: ["Uppercase the selection", "Trim the selection"],
  slides: ["Condense the selection into one sentence", "Turn the selection into three points"],
};

export function orbitQuickCommands(
  locale: OrbitLocale,
  scope: "selection" | "artifact" | "workspace",
  kind: ArtifactKind,
) {
  if (locale === "en") {
    if (scope === "workspace") return englishWorkspaceCommands;
    if (scope === "selection") return englishSelectionCommands[kind];
    return englishArtifactCommands[kind];
  }
  if (!isChineseOrbitLocale(locale)) {
    const commands =
      scope === "workspace"
        ? englishWorkspaceCommands
        : scope === "selection"
          ? englishSelectionCommands[kind]
          : englishArtifactCommands[kind];
    return commands.map((command) => orbitText(locale, command, command));
  }
  const commands =
    scope === "workspace"
      ? chineseWorkspaceCommands
      : scope === "selection"
        ? chineseSelectionCommands[kind]
        : chineseArtifactCommands[kind];
  return locale === "zh-TW" ? commands.map(toTaiwanTraditional) : commands;
}

const chineseStatusMessages: Record<string, string> = {
  "Local workspace ready": "本地工作区已就绪",
  "Restored the latest device draft": "已恢复最近的本机草稿",
  "Started a fresh local workspace": "已创建新的本地工作区",
  "Device storage is full — download the source before leaving": "本机存储空间不足 — 离开前请下载源文件",
  "Closed the current file — every source remains in the workspace": "已关闭当前文件 — 所有源内容仍保留在工作区",
  "Closed the current file — every source remains safely in the workspace":
    "已关闭当前文件 — 所有源内容仍安全保留在工作区",
  "This source is too large for device checkpoint history": "此源内容过大，无法写入本机恢复点历史",
  "Current source is already checkpointed": "当前源内容已保存为恢复点",
  "Manual checkpoint saved on this device": "已在此设备保存手动恢复点",
  "Device storage is full — checkpoint was not saved": "本机存储空间不足 — 未保存恢复点",
  "Switched artifact context": "已切换内容上下文",
  "Opened the editable Orbit guide stored in this workspace": "已打开工作区中的可编辑 Orbit 指南",
  "Choose one or more files — Orbit reads them locally before review":
    "请选择一个或多个文件 — Orbit 会先在本地读取，再交给你审核",
  "Sample workspace ready · every result stays linked to readable source":
    "示例工作区已就绪 · 每个结果都保持链接到可读源内容",
  "Temporary Workspace Agent context pins cleared": "已清除临时工作区 Agent 上下文固定项",
  "Visual edit rejected — every source stayed unchanged": "可视化编辑被拒绝 — 所有源内容保持不变",
  "Visual edit held — the workspace changed during verification": "可视化编辑已暂停 — 核验期间工作区发生了变化",
  "Visual edit rejected — device persistence failed": "可视化编辑被拒绝 — 本机持久化失败",
  "Document structure change ready for exact source review": "文档结构修改已就绪，可审核精确源差异",
  "Preview target is too large or no longer matches the current source": "预览目标过大，或已不再匹配当前源内容",
  "Folder pull cancelled — the device draft is unchanged": "已取消读取文件夹 — 本机草稿保持不变",
  "Folder workspaces require a browser with the File System Access API":
    "文件夹工作区需要支持 File System Access API 的浏览器",
  "Folder connection cancelled": "已取消连接文件夹",
  "Folder sync ready for exact review — nothing has been written": "文件夹同步已可精确审核 — 尚未写入任何内容",
  "Folder sync cancelled — nothing changed": "已取消文件夹同步 — 所有内容保持不变",
  "Folder picker cancelled": "已取消选择文件夹",
  "Orbit could not connect that folder": "Orbit 无法连接该文件夹",
  "Orbit could not pull that folder": "Orbit 无法读取该文件夹",
  "Folder push cancelled": "已取消写回文件夹",
  "Orbit could not push that folder": "Orbit 无法写回该文件夹",
  "That checkpoint already matches the current source": "该恢复点已与当前源内容一致",
  "Download this large source before restoring an older checkpoint": "恢复旧版本前，请先下载此大型源文件",
  "Selection Agent needs a current non-empty source selection": "选区 Agent 需要当前且非空的源内容选区",
  "Nothing proposed — one automatic repair attempt stopped; every source stayed unchanged":
    "未生成建议 — 一次自动修复尝试后已停止；所有源内容保持不变",
  "Agent is using the local compiler failure to prepare one replacement plan":
    "Agent 正使用本地编译失败信息准备一份替代方案",
  "Patch held for review — workspace source revision changed": "补丁已暂停审核 — 工作区源版本发生变化",
  "Patch held for review — workspace context changed": "补丁已暂停审核 — 工作区上下文发生变化",
  "Nothing applied — selection boundary verification failed": "未应用任何修改 — 选区边界核验失败",
  "Patch held for review — every changed file needs a safety checkpoint":
    "补丁已暂停审核 — 每个修改文件都需要安全恢复点",
  "Nothing applied — the complete workspace did not pass validation": "未应用任何修改 — 完整工作区未通过校验",
  "Nothing applied — atomic persistence failed": "未应用任何修改 — 原子持久化失败",
  "Sample workspace restored": "已恢复示例工作区",
  "Nothing created — live source verification failed": "未创建任何内容 — 实时源内容核验失败",
  "Nothing created — atomic device persistence failed": "未创建任何内容 — 本机原子持久化失败",
  "Import up to 20 files in one review transaction": "一次审核事务最多导入 20 个文件",
  "Orbit could not import those files": "Orbit 无法导入这些文件",
  "Import held for review — workspace context changed": "导入已暂停审核 — 工作区上下文发生变化",
  "Nothing imported — atomic persistence failed": "未导入任何内容 — 原子持久化失败",
  "Export held for review — workspace context changed": "导出已暂停审核 — 工作区上下文发生变化",
  "Orbit could not prepare that export": "Orbit 无法准备该导出",
  "Agent composer focused": "已聚焦 Agent 输入框",
};

export function localizeOrbitStatus(locale: OrbitLocale, message: string) {
  if (locale === "en") return message;
  if (!isChineseOrbitLocale(locale)) {
    requireOrbitLocaleCatalog(locale);
    return loadedInterfaceTranslation(locale, message) ?? message;
  }
  const exact = chineseStatusMessages[message];
  if (exact) return locale === "zh-TW" ? toTaiwanTraditional(exact) : exact;
  const patterns: Array<[RegExp, (...parts: string[]) => string]> = [
    [/^(.+) removed from temporary Agent context pins$/, (name) => `已从临时 Agent 上下文固定项移除 ${name}`],
    [/^(.+) pinned for the next Workspace Agent plan$/, (name) => `已将 ${name} 固定到下一次工作区 Agent 方案`],
    [
      /^(.+) updated in canonical source(.*)$/,
      (name, suffix) => `${name} 已更新到规范源内容${suffix.replace(" · Push when ready", " · 可随时写回文件夹")}`,
    ],
    [/^(.+) linked from canonical source$/, (label) => `${label} 已从规范源内容建立链接`],
    [/^(.+) selected from preview · Selection Agent ready$/, (label) => `已从预览选择 ${label} · 选区 Agent 已就绪`],
    [/^Restored checkpoint · (.+)$/, (label) => `已恢复恢复点 · ${label}`],
    [
      /^Connected (.+) · wrote (\d+) readable source files$/,
      (folder, value) => `已连接 ${folder} · 写入 ${value} 个可读源文件`,
    ],
    [
      /^Pulled (\d+) source files from (.+) · (.+)$/,
      (value, folder, source) => `已从 ${folder} 读取 ${value} 个源文件 · ${source}`,
    ],
    [
      /^Pushed (\d+) source files and orbit\.workspace\.json to (.+)$/,
      (value, folder) => `已将 ${value} 个源文件和 orbit.workspace.json 写回 ${folder}`,
    ],
    [/^Reading (.+) locally…$/, (target) => `正在本地读取 ${target}…`],
    [/^Import cancelled — (.+) did not change the workspace$/, (name) => `已取消导入 — ${name} 未修改工作区`],
    [/^Export cancelled — (.+) was not downloaded$/, (name) => `已取消导出 — 未下载 ${name}`],
    [/^Preparing (.+) locally from (.+)…$/, (target, name) => `正在从 ${name} 本地准备 ${target}…`],
    [/^Downloaded (.+) · (.+) export$/, (name, kind) => `已下载 ${name} · ${kind} 导出`],
    [/^Verifying (.+) against its live sources…$/, (name) => `正在对照实时来源核验 ${name}…`],
    [
      /^Created (.+) on this device(.*)$/,
      (name, suffix) => `已在此设备创建 ${name}${suffix.replace(" · Push when ready", " · 可随时写回文件夹")}`,
    ],
    [
      /^(\d+) file changes? applied atomically(.*)$/,
      (value, suffix) => `已原子应用 ${value} 项文件修改${suffix.replace(" · Push when ready", " · 可随时写回文件夹")}`,
    ],
  ];
  for (const [pattern, format] of patterns) {
    const match = message.match(pattern);
    if (match) {
      const localized = format(...match.slice(1));
      return locale === "zh-TW" ? convertPreservingValues(localized, match.slice(1)) : localized;
    }
  }
  return message;
}

export const CHINESE_ORBIT_GUIDE = [
  "# 欢迎使用 Orbit",
  "",
  "> Orbit 是一个本地优先、可核验的 AI 工作台。你的源文件是事实，预览是实时编译结果；你批准前，Agent 不会写入文件。",
  "",
  "## 从这里开始",
  "",
  "1. 点击顶部的 **导入**，或关闭当前文件后把文件拖入中央区域。",
  "2. 在左侧修改 Markdown、CSV/JSON、SQL、Chart JSON 或语义 HTML；已有 Deck Markdown 仍可继续编辑。",
  "3. 在右侧立即检查编译结果。",
  "4. 点击右侧文档的标题、段落、单个列表项、表格单元格、粗体、斜体、删除线、行内代码、链接或图片，以及数据单元格、图表数据或演示页，Orbit 会定位并高亮对应源内容；在左侧移动光标或选择同一可证明范围时，右侧也会高亮并滚动到对应成品。普通点击链接定位源内容，⌘/Ctrl 点击仍可打开链接。",
  "5. 使用文档 section 或正文块、数据单元格、图表属性或演示页旁的铅笔，在右侧编辑可证明的范围；输入时左侧会实时显示并高亮完整 source 草稿，取消不写入，保存才经过核验并同步到同一 revision；正文定位按钮按 F2 也可编辑，块左侧还能新增、移动或删除，并先审核精确 source diff。",
  "6. 让 Orbit Agent 提出修改；检查差异和影响后，再决定是否应用。",
  "",
  "## 常用快捷键",
  "",
  "| 操作 | macOS | Windows / Linux |",
  "| --- | --- | --- |",
  "| 打开文件 | ⌘ O | Ctrl O |",
  "| 保存恢复点 | ⌘ S | Ctrl S |",
  "| 让 Agent 规划修改 | ⌘ Enter | Ctrl Enter |",
  "| 切换分栏 / 源内容 / 成品视图 | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |",
  "| 关闭当前文件 | ⌘ W | Ctrl W |",
  "| 文档草稿加粗 | ⌘ B | Ctrl B |",
  "| 文档草稿斜体 | ⌘ I | Ctrl I |",
  "| 文档草稿链接 | ⌘ K | Ctrl K |",
  "",
  "## 支持的工作方式",
  "",
  "- **文档：** Markdown 是可读源，右侧编译为文档。",
  "- **数据：** CSV / JSON 是可读源，可用本地 DuckDB SQL 分析。",
  "- **图表：** Chart JSON 绑定数据或 Query，报告和演示共享同一份事实。",
  "- **演示：** 语义 HTML 是默认可读源内容，可交付为 PPTX、ODP、HTML 或 PDF；已有 Deck Markdown 继续兼容。",
  "- **兼容：** PDF、DOCX、XLSX、PPTX、ODT、ODS、ODP 会在导入前说明语义转换限制；Orbit Desktop 还可通过本机 Word/PowerPoint 将旧 DOC/PPT 转换后进入同一审核；扫描 PDF 会先让你明确选择页码和英文/简中 OCR，再显示逐页置信度。",
  "",
  "## Orbit 的安全边界",
  "",
  "- 文件默认保存在当前设备。",
  "- Agent 只能看到你选择的文件和范围。",
  "- 每次改动先显示具体差异、依赖变化和运行验证。",
  "- 恢复历史版本前会先显示精确差异；确认时再次核验完整工作区，并把当前版本保留为保护恢复点。",
  "- 应用前建立恢复点；失败时整笔修改保持零写入。",
  "- 导入和导出会明确说明无法保留的内容，不假装无损转换。",
  "- 个人模型密钥只在未保存表单中短暂存在，保存后由服务端加密进 HttpOnly 凭据；不会进入工作区、localStorage、Artifact 或 Git。",
  "",
  "## 设置模型",
  "",
  "Orbit 支持 OpenAI Responses、OpenRouter/兼容 Chat Completions、Anthropic Messages、Gemini generateContent 和自定义协议的个人模型配置。密钥保存后会被服务端加密成浏览器脚本不可读的 HttpOnly 凭据，不进入工作区或 localStorage；Web 本地/部署环境必须设置独立的 `ORBIT_CREDENTIAL_ENCRYPTION_KEY`，Orbit Desktop 则用 macOS 钥匙串保护该主密钥。Orbit 不会把失败请求自动转给另一家供应商；没有配置模型时，确定性本地规划器仍然可用。",
  "",
  "## 下一步",
  "",
  "导入一份真实文件，或打开示例工作区，完成第一次“数据 → 分析 → 图表 → 报告 / 演示”。",
  "",
].join("\n");

export const ENGLISH_ORBIT_GUIDE = [
  "# Welcome to Orbit",
  "",
  "> Orbit is a local-first, verifiable AI workspace. Your readable source is the truth and the preview is compiled live. The Agent never writes before you approve.",
  "",
  "## Start here",
  "",
  "1. Choose **Import** in the toolbar, or close the current file and drop one into the center.",
  "2. Edit Markdown, CSV/JSON, SQL, Chart JSON, or semantic HTML on the left. Existing Deck Markdown remains editable.",
  "3. Inspect the compiled result immediately on the right.",
  "4. Choose a Document heading, paragraph, individual list item, table cell, bold/italic/struck text, inline code, link, or image — or a data cell, chart datum, or slide — to locate and highlight its exact source. Moving the source caret or selecting a proven range also highlights and scrolls the matching preview target. A normal link click locates source; Command/Control-click still opens it.",
  "5. Use the pencil beside a Document section or body block, Data cell, Chart properties, or Deck slide to edit a proven range on the right. The left side mirrors and highlights the complete source draft live; Cancel writes nothing and Save verifies before synchronizing one revision. F2 also edits, while the block's left controls insert, move, or delete only after an exact source-diff review.",
  "6. Ask Orbit Agent to propose a change. Review the diff and impact before applying it.",
  "",
  "## Keyboard shortcuts",
  "",
  "| Action | macOS | Windows / Linux |",
  "| --- | --- | --- |",
  "| Open a file | ⌘ O | Ctrl O |",
  "| Save a checkpoint | ⌘ S | Ctrl S |",
  "| Ask the Agent to plan | ⌘ Enter | Ctrl Enter |",
  "| Switch Split / Source / Preview view | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |",
  "| Close the current file | ⌘ W | Ctrl W |",
  "| Bold a Document draft | ⌘ B | Ctrl B |",
  "| Italicize a Document draft | ⌘ I | Ctrl I |",
  "| Add a Document draft link | ⌘ K | Ctrl K |",
  "",
  "## How Orbit works",
  "",
  "- **Documents:** readable Markdown compiles into a document.",
  "- **Data:** readable CSV / JSON can be analyzed with local DuckDB SQL.",
  "- **Charts:** Chart JSON binds to Data or Query so reports and decks share one fact.",
  "- **Presentations:** Semantic HTML is the readable default source and can hand off as PPTX, ODP, HTML, or PDF. Existing Deck Markdown remains supported.",
  "- **Compatibility:** PDF, DOCX, XLSX, PPTX, ODT, ODS, and ODP imports disclose semantic conversion limits before writing; Orbit Desktop can also convert legacy DOC/PPT through local Word/PowerPoint into the same review; scanned PDFs require explicit page and English/Simplified-Chinese OCR choices, then expose page-level confidence.",
  "",
  "## Orbit's trust boundary",
  "",
  "- Files stay on this device by default.",
  "- The Agent sees only files and ranges you deliberately select.",
  "- Every proposal shows its concrete diff, dependency change, and runtime checks.",
  "- Restoring history first shows the exact diff; confirmation rechecks the complete workspace and keeps the current version as a safety checkpoint.",
  "- Apply creates a checkpoint; a failed transaction writes nothing.",
  "- Import and export disclose omissions instead of pretending to be lossless.",
  "- A personal model key exists only in the unsaved form, then becomes a server-encrypted HttpOnly credential; it never enters the workspace, localStorage, an Artifact, or Git.",
  "",
  "## Connect a model",
  "",
  "Orbit supports personal OpenAI Responses, OpenRouter/compatible Chat Completions, Anthropic Messages, Gemini generateContent, and custom protocol profiles. After Save, the server encrypts the key into an HttpOnly credential that browser scripts cannot read; it never enters the workspace or localStorage. Local/deployed web servers need a separate `ORBIT_CREDENTIAL_ENCRYPTION_KEY`; Orbit Desktop protects that master key with the macOS Keychain. Cross-provider failover is off by default and runs only after you explicitly allow it in Models settings; deterministic local planners remain available without a model.",
  "",
  "## Next",
  "",
  "Import a real file or open the sample workspace to complete your first Data → analysis → Chart → report / deck loop.",
  "",
].join("\n");

export function createOrbitGuideArtifact(locale: OrbitLocale): WorkspaceArtifact {
  const source = localizeOrbitMultiline(locale, ENGLISH_ORBIT_GUIDE, CHINESE_ORBIT_GUIDE);
  return {
    id: ORBIT_GUIDE_ID,
    name: "orbit-guide.md",
    kind: "document",
    language: `Markdown · ${localeDisplayName(locale)}`,
    source,
  };
}
