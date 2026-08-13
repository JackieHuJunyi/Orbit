import type { RuneLocale, RuneUICopy } from "./localization";

export type RuneWorkbenchCommandId =
  | "new-artifact"
  | "import-files"
  | "open-folder"
  | "operating-review"
  | "document-briefing"
  | "focus-agent"
  | "show-split"
  | "show-source"
  | "show-preview"
  | "save-checkpoint"
  | "close-file"
  | "toggle-files"
  | "open-guide"
  | "open-models";

export type RuneWorkbenchCommandGroup = "create" | "workspace" | "view" | "help";

export type RuneWorkbenchCommand = {
  id: RuneWorkbenchCommandId;
  group: RuneWorkbenchCommandGroup;
  label: string;
  detail: string;
  keywords: string[];
  shortcut?: string;
  disabled?: boolean;
};

export type RuneWorkbenchCommandContext = {
  ui: RuneUICopy["workbench"];
  locale: RuneLocale;
  artifactCreationDisabled: boolean;
  canCreateBriefing: boolean;
  canUseWorkspace: boolean;
  canCheckpoint: boolean;
  canOpenFolder: boolean;
};

export type RuneCommandMenuCopy = {
  title: string;
  placeholder: string;
  noResults: string;
  unavailable: string;
  close: string;
  groups: Record<RuneWorkbenchCommandGroup, string>;
};

const COMMAND_MENU_COPY: Record<RuneLocale, RuneCommandMenuCopy> = {
  "zh-CN": {
    title: "快速操作",
    placeholder: "搜索操作与视图…",
    noResults: "没有匹配的操作",
    unavailable: "当前不可用",
    close: "关闭快速操作",
    groups: { create: "创建", workspace: "工作区", view: "视图", help: "设置与帮助" },
  },
  "zh-TW": {
    title: "快速操作",
    placeholder: "搜尋操作與檢視…",
    noResults: "沒有符合的操作",
    unavailable: "目前無法使用",
    close: "關閉快速操作",
    groups: { create: "建立", workspace: "工作區", view: "檢視", help: "設定與說明" },
  },
  en: {
    title: "Quick actions",
    placeholder: "Search actions and views…",
    noResults: "No matching actions",
    unavailable: "Unavailable now",
    close: "Close quick actions",
    groups: { create: "Create", workspace: "Workspace", view: "View", help: "Settings & help" },
  },
  fr: {
    title: "Actions rapides",
    placeholder: "Rechercher des actions et des vues…",
    noResults: "Aucune action correspondante",
    unavailable: "Indisponible pour le moment",
    close: "Fermer les actions rapides",
    groups: { create: "Créer", workspace: "Espace de travail", view: "Affichage", help: "Réglages et aide" },
  },
  es: {
    title: "Acciones rápidas",
    placeholder: "Buscar acciones y vistas…",
    noResults: "No hay acciones coincidentes",
    unavailable: "No disponible ahora",
    close: "Cerrar acciones rápidas",
    groups: { create: "Crear", workspace: "Espacio de trabajo", view: "Vista", help: "Ajustes y ayuda" },
  },
  ru: {
    title: "Быстрые действия",
    placeholder: "Поиск действий и режимов…",
    noResults: "Подходящих действий нет",
    unavailable: "Сейчас недоступно",
    close: "Закрыть быстрые действия",
    groups: { create: "Создание", workspace: "Рабочая область", view: "Вид", help: "Настройки и справка" },
  },
  ar: {
    title: "إجراءات سريعة",
    placeholder: "ابحث في الإجراءات وطرق العرض…",
    noResults: "لا توجد إجراءات مطابقة",
    unavailable: "غير متاح الآن",
    close: "إغلاق الإجراءات السريعة",
    groups: { create: "إنشاء", workspace: "مساحة العمل", view: "العرض", help: "الإعدادات والمساعدة" },
  },
  ja: {
    title: "クイックアクション",
    placeholder: "操作と表示を検索…",
    noResults: "一致する操作はありません",
    unavailable: "現在は使用できません",
    close: "クイックアクションを閉じる",
    groups: { create: "作成", workspace: "ワークスペース", view: "表示", help: "設定とヘルプ" },
  },
  ko: {
    title: "빠른 동작",
    placeholder: "동작 및 보기 검색…",
    noResults: "일치하는 동작이 없습니다",
    unavailable: "현재 사용할 수 없음",
    close: "빠른 동작 닫기",
    groups: { create: "생성", workspace: "작업 공간", view: "보기", help: "설정 및 도움말" },
  },
};

export function runeCommandMenuCopy(locale: RuneLocale): RuneCommandMenuCopy {
  return COMMAND_MENU_COPY[locale];
}

export function createRuneWorkbenchCommands({
  ui,
  artifactCreationDisabled,
  canCreateBriefing,
  canUseWorkspace,
  canCheckpoint,
  canOpenFolder,
}: RuneWorkbenchCommandContext): RuneWorkbenchCommand[] {
  return [
    {
      id: "new-artifact",
      group: "create",
      label: ui.newArtifact,
      detail: ui.oneWorkspaceBody,
      keywords: ["new", "document", "data", "slides", "新建", "创建"],
      disabled: artifactCreationDisabled,
    },
    {
      id: "import-files",
      group: "create",
      label: ui.import,
      detail: ui.localFirst,
      keywords: ["open", "upload", "file", "docx", "xlsx", "pptx", "pdf", "导入", "打开"],
      shortcut: "⌘ O",
      disabled: artifactCreationDisabled,
    },
    {
      id: "operating-review",
      group: "create",
      label: ui.createOperatingReview,
      detail: ui.operatingReviewTask,
      keywords: ["review", "report", "data", "chart", "经营", "汇报", "复盘"],
      disabled: artifactCreationDisabled,
    },
    {
      id: "document-briefing",
      group: "create",
      label: ui.documentBriefingTask,
      detail: ui.deliverables,
      keywords: ["presentation", "briefing", "slides", "document", "演示", "文档"],
      disabled: artifactCreationDisabled || !canCreateBriefing,
    },
    {
      id: "open-folder",
      group: "workspace",
      label: ui.openFolder,
      detail: ui.workspace,
      keywords: ["directory", "folder", "workspace", "文件夹", "目录"],
      disabled: !canOpenFolder,
    },
    {
      id: "save-checkpoint",
      group: "workspace",
      label: ui.saveCurrent,
      detail: ui.checkpoints,
      keywords: ["save", "checkpoint", "history", "保存", "恢复点"],
      shortcut: "⌘ S",
      disabled: !canUseWorkspace || !canCheckpoint,
    },
    {
      id: "close-file",
      group: "workspace",
      label: ui.closeFile,
      detail: ui.workspaceFiles,
      keywords: ["close", "empty", "关闭", "文件"],
      shortcut: "⌘ W",
      disabled: !canUseWorkspace,
    },
    {
      id: "toggle-files",
      group: "workspace",
      label: ui.workspaceFiles,
      detail: ui.showFiles,
      keywords: ["sidebar", "rail", "files", "侧栏", "文件"],
    },
    {
      id: "focus-agent",
      group: "workspace",
      label: ui.focusAgent,
      detail: ui.assistantBody,
      keywords: ["agent", "prompt", "edit", "模型", "修改"],
      disabled: !canUseWorkspace,
    },
    {
      id: "show-split",
      group: "view",
      label: ui.showSplitView,
      detail: ui.splitView,
      keywords: ["split", "source", "preview", "左右", "分屏"],
      shortcut: "⌘⌥ 1",
      disabled: !canUseWorkspace,
    },
    {
      id: "show-source",
      group: "view",
      label: ui.showSourceView,
      detail: ui.sourceView,
      keywords: ["source", "code", "editor", "源内容", "编辑器"],
      shortcut: "⌘⌥ 2",
      disabled: !canUseWorkspace,
    },
    {
      id: "show-preview",
      group: "view",
      label: ui.showPreviewView,
      detail: ui.previewView,
      keywords: ["preview", "output", "artifact", "成品", "预览"],
      shortcut: "⌘⌥ 3",
      disabled: !canUseWorkspace,
    },
    {
      id: "open-guide",
      group: "help",
      label: ui.help,
      detail: ui.brandSubtitle,
      keywords: ["guide", "welcome", "tutorial", "help", "教程", "帮助"],
    },
    {
      id: "open-models",
      group: "help",
      label: ui.models,
      detail: ui.modelConnected,
      keywords: ["model", "api", "provider", "key", "模型", "配置"],
    },
  ];
}

function normalizeCommandText(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

function commandRank(command: RuneWorkbenchCommand, normalizedQuery: string) {
  if (!normalizedQuery) return 0;
  const label = normalizeCommandText(command.label);
  const detail = normalizeCommandText(command.detail);
  const keywords = normalizeCommandText(command.keywords.join(" "));
  const id = command.id.replaceAll("-", " ");
  const haystack = `${label} ${detail} ${keywords} ${id}`;
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (!tokens.every((token) => haystack.includes(token))) return null;
  if (label === normalizedQuery) return 0;
  if (label.startsWith(normalizedQuery)) return 10;
  const matchingWord = label.split(/\s+/).findIndex((word) => word.startsWith(normalizedQuery));
  if (matchingWord >= 0) return 20 + matchingWord;
  if (label.includes(normalizedQuery)) return 30;
  if (detail.includes(normalizedQuery)) return 40;
  return 50;
}

export function filterRuneWorkbenchCommands(commands: readonly RuneWorkbenchCommand[], query: string) {
  const normalizedQuery = normalizeCommandText(query);
  return commands
    .map((command, index) => ({ command, index, rank: commandRank(command, normalizedQuery) }))
    .filter((entry): entry is { command: RuneWorkbenchCommand; index: number; rank: number } => entry.rank !== null)
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((entry) => entry.command);
}
