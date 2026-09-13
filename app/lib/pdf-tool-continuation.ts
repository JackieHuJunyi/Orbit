import { orbitText, type OrbitLocale } from "./localization.ts";
import type { PdfToolDefinition } from "./pdf-tool-registry.ts";

export function pdfToolSelectionNotice(locale: OrbitLocale, tool: PdfToolDefinition) {
  return orbitText(
    locale,
    `${tool.title} · choose source files for the reviewed Orbit workflow`,
    `${tool.title} · 请选择源文件进入 Orbit 审核流程`,
  );
}

export function pdfToolOpenedNotice(locale: OrbitLocale) {
  return orbitText(
    locale,
    "Opened the matching local PDF workflow · review files and options before running",
    "已打开匹配的本地 PDF 工作流 · 运行前请确认文件和选项",
  );
}

export function pdfToolImportContinuation(locale: OrbitLocale, tool: PdfToolDefinition) {
  if (tool.id === "summarize" || tool.id === "translate") {
    return {
      prompt:
        tool.id === "summarize"
          ? orbitText(
              locale,
              "Summarize this imported PDF with its key claims, evidence, and open questions.",
              "总结这份导入的 PDF，列出核心结论、依据和待确认问题。",
            )
          : orbitText(
              locale,
              "Translate this imported PDF into [target language], preserving headings, tables, lists, and source meaning.",
              "把这份导入的 PDF 翻译为[目标语言]，保留标题、表格、列表和原意。",
            ),
      notice: orbitText(
        locale,
        "PDF imported · review the prepared Agent request before sending",
        "PDF 已导入 · 请先确认准备好的 Agent 请求再发送",
      ),
    } as const;
  }
  return {
    prompt: null,
    notice: orbitText(
      locale,
      `${tool.title} source imported · use Export to choose the reviewed target format`,
      `${tool.title} 源内容已导入 · 请从“导出”选择并审核目标格式`,
    ),
  } as const;
}
