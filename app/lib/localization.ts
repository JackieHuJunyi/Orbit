import type { WorkspaceArtifact } from "./workspace.ts";

export type RuneLocale = "zh-CN" | "en";

export const RUNE_LOCALE_STORAGE_KEY = "rune-locale-v1";
export const RUNE_ONBOARDING_STORAGE_KEY = "rune-onboarding-v1";
export const RUNE_GUIDE_ID = "rune-guide";

export function normalizeRuneLocale(value: unknown): RuneLocale | null {
  if (value === "zh-CN" || value === "en") return value;
  return null;
}

export function detectPreferredLocale(languages: readonly string[] = []): RuneLocale {
  return languages.some((language) => /^zh(?:-|$)/i.test(language)) ? "zh-CN" : "en";
}

export function localeDisplayName(locale: RuneLocale) {
  return locale === "zh-CN" ? "简体中文" : "English";
}

const chineseGuide = [
  "# 欢迎使用 Rune",
  "",
  "> Rune 是一个本地优先、可核验的 AI 工作台。你的源文件是事实，预览是实时编译结果；你批准前，Agent 不会写入文件。",
  "",
  "## 从这里开始",
  "",
  "1. 点击顶部的 **导入**，或关闭当前文件后把文件拖入中央区域。",
  "2. 在左侧修改 Markdown、CSV/JSON、SQL、Chart JSON 或 Deck Markdown。",
  "3. 在右侧立即检查编译结果。",
  "4. 点击右侧文档的标题、段落、单个列表项、表格单元格、粗体、斜体、删除线、行内代码、链接或图片，以及数据单元格、图表数据或演示页，Rune 会定位并高亮对应源内容；在左侧移动光标或选择同一可证明范围时，右侧也会高亮并滚动到对应成品。普通点击链接定位源内容，⌘/Ctrl 点击仍可打开链接。",
  "5. 使用文档 section 或正文块、数据单元格、图表属性或演示页旁的铅笔，在右侧编辑可证明的范围；正文定位按钮按 F2 也可编辑，块左侧还能新增、移动或删除，并先审核精确 source diff；确认后左右两侧同步到同一 source revision。",
  "6. 让 Rune Agent 提出修改；检查差异和影响后，再决定是否应用。",
  "",
  "## 常用快捷键",
  "",
  "| 操作 | macOS | Windows / Linux |",
  "| --- | --- | --- |",
  "| 打开文件 | ⌘ O | Ctrl O |",
  "| 保存恢复点 | ⌘ S | Ctrl S |",
  "| 让 Agent 规划修改 | ⌘ Enter | Ctrl Enter |",
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
  "- **演示：** Deck Markdown 编译为安全的 HTML，并可交付为 PPTX、HTML 或 PDF。",
  "- **兼容：** PDF、DOCX、XLSX、PPTX、ODT、ODS、ODP 会在导入前说明语义转换限制；扫描 PDF 暂不执行 OCR。",
  "",
  "## Rune 的安全边界",
  "",
  "- 文件默认保存在当前设备。",
  "- Agent 只能看到你选择的文件和范围。",
  "- 每次改动先显示具体差异、依赖变化和运行验证。",
  "- 应用前建立恢复点；失败时整笔修改保持零写入。",
  "- 导入和导出会明确说明无法保留的内容，不假装无损转换。",
  "- 个人模型密钥只在未保存表单中短暂存在，保存后由服务端加密进 HttpOnly 凭据；不会进入工作区、localStorage、Artifact 或 Git。",
  "",
  "## 设置模型",
  "",
  "Rune 支持 OpenAI、OpenRouter 和兼容 Responses API 的个人模型配置。密钥保存后会被服务端加密成浏览器脚本不可读的 HttpOnly 凭据，不进入工作区或 localStorage；本地/部署环境必须设置独立的 `RUNE_CREDENTIAL_ENCRYPTION_KEY`。没有配置模型时，确定性本地规划器仍然可用；未来桌面版将把同一安全存储端口接入系统钥匙串。",
  "",
  "## 下一步",
  "",
  "导入一份真实文件，或打开示例工作区，完成第一次“数据 → 分析 → 图表 → 报告 / 演示”。",
  "",
].join("\n");

const englishGuide = [
  "# Welcome to Rune",
  "",
  "> Rune is a local-first, verifiable AI workspace. Your readable source is the truth and the preview is compiled live. The Agent never writes before you approve.",
  "",
  "## Start here",
  "",
  "1. Choose **Import** in the toolbar, or close the current file and drop one into the center.",
  "2. Edit Markdown, CSV/JSON, SQL, Chart JSON, or Deck Markdown on the left.",
  "3. Inspect the compiled result immediately on the right.",
  "4. Choose a Document heading, paragraph, individual list item, table cell, bold/italic/struck text, inline code, link, or image — or a data cell, chart datum, or slide — to locate and highlight its exact source. Moving the source caret or selecting a proven range also highlights and scrolls the matching preview target. A normal link click locates source; Command/Control-click still opens it.",
  "5. Use the pencil beside a Document section or body block, Data cell, Chart properties, or Deck slide to edit a proven range on the right; F2 also edits, while the block's left controls insert, move, or delete only after an exact source-diff review. Confirming synchronizes both sides to one source revision.",
  "6. Ask Rune Agent to propose a change. Review the diff and impact before applying it.",
  "",
  "## Keyboard shortcuts",
  "",
  "| Action | macOS | Windows / Linux |",
  "| --- | --- | --- |",
  "| Open a file | ⌘ O | Ctrl O |",
  "| Save a checkpoint | ⌘ S | Ctrl S |",
  "| Ask the Agent to plan | ⌘ Enter | Ctrl Enter |",
  "| Close the current file | ⌘ W | Ctrl W |",
  "| Bold a Document draft | ⌘ B | Ctrl B |",
  "| Italicize a Document draft | ⌘ I | Ctrl I |",
  "| Add a Document draft link | ⌘ K | Ctrl K |",
  "",
  "## How Rune works",
  "",
  "- **Documents:** readable Markdown compiles into a document.",
  "- **Data:** readable CSV / JSON can be analyzed with local DuckDB SQL.",
  "- **Charts:** Chart JSON binds to Data or Query so reports and decks share one fact.",
  "- **Presentations:** Deck Markdown compiles into safe HTML and can hand off as PPTX, HTML, or PDF.",
  "- **Compatibility:** PDF, DOCX, XLSX, PPTX, ODT, ODS, and ODP imports disclose semantic conversion limits before writing; scanned PDFs do not receive OCR yet.",
  "",
  "## Rune's trust boundary",
  "",
  "- Files stay on this device by default.",
  "- The Agent sees only files and ranges you deliberately select.",
  "- Every proposal shows its concrete diff, dependency change, and runtime checks.",
  "- Apply creates a checkpoint; a failed transaction writes nothing.",
  "- Import and export disclose omissions instead of pretending to be lossless.",
  "- A personal model key exists only in the unsaved form, then becomes a server-encrypted HttpOnly credential; it never enters the workspace, localStorage, an Artifact, or Git.",
  "",
  "## Connect a model",
  "",
  "Rune supports personal OpenAI, OpenRouter, and compatible Responses API profiles. After Save, the server encrypts the key into an HttpOnly credential that browser scripts cannot read; it never enters the workspace or localStorage, and local/deployed servers need a separate `RUNE_CREDENTIAL_ENCRYPTION_KEY`. Deterministic local planners remain available without a model. A future desktop build will connect the same secret-storage port to the system keychain.",
  "",
  "## Next",
  "",
  "Import a real file or open the sample workspace to complete your first Data → analysis → Chart → report / deck loop.",
  "",
].join("\n");

export function createRuneGuideArtifact(locale: RuneLocale): WorkspaceArtifact {
  return {
    id: RUNE_GUIDE_ID,
    name: "rune-guide.md",
    kind: "document",
    language: locale === "zh-CN" ? "Markdown · 简体中文" : "Markdown · English",
    source: locale === "zh-CN" ? chineseGuide : englishGuide,
  };
}
