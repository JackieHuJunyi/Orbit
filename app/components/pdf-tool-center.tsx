"use client";

import { Check, Download, FileStack, LoaderCircle, Search, ShieldCheck, Upload, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { executeDirectPdfTool, pdfToolRunsDirectly } from "../lib/pdf-tool-executor";
import {
  PDF_TOOL_CATEGORY_ORDER,
  PDF_TOOL_REGISTRY,
  type PdfToolCategory,
  type PdfToolDefinition,
} from "../lib/pdf-tool-registry";
import { localizeOrbitCopy, localizeOrbitStatus, type OrbitLocale } from "../lib/localization";
import type { PdfCoreToolOptions, PdfToolOutputFile } from "../lib/pdf-core-tools";
import { renderDesktopWebPdf, supportsDesktopWebPdf } from "../lib/desktop-bridge";

const ZH_TITLES: Record<string, string> = {
  merge: "合并 PDF",
  split: "拆分 PDF",
  organize: "整理页面",
  "remove-pages": "删除页面",
  "extract-pages": "提取页面",
  rotate: "旋转页面",
  crop: "裁剪 PDF",
  compress: "压缩 PDF",
  optimize: "优化 PDF",
  repair: "修复 PDF",
  ocr: "OCR 文字识别",
  pdfa: "转换为 PDF/A",
  "images-to-pdf": "图片转 PDF",
  "scan-to-pdf": "扫描件转 PDF",
  "pdf-to-images": "PDF 转图片",
  "extract-images": "提取图片",
  "office-to-pdf": "Office 转 PDF",
  "html-to-pdf": "HTML 转 PDF",
  "web-to-pdf": "网页转 PDF",
  "pdf-to-word": "PDF 转 Word",
  "pdf-to-powerpoint": "PDF 转 PowerPoint",
  "pdf-to-excel": "PDF 转 Excel",
  create: "创建 PDF",
  edit: "编辑 PDF",
  sign: "签署 PDF",
  watermark: "添加水印",
  "page-numbers": "添加页码",
  overlay: "叠加 PDF",
  forms: "PDF 表单",
  protect: "加密保护",
  unlock: "移除密码",
  redact: "永久涂黑",
  compare: "比较 PDF",
  summarize: "AI 总结 PDF",
  translate: "翻译 PDF",
  "pdf-to-markdown": "PDF 转 Markdown",
};

const CATEGORY_LABELS: Record<PdfToolCategory, readonly [string, string]> = {
  organize: ["Organize", "页面整理"],
  optimize: ["Optimize", "优化修复"],
  convert: ["Convert", "格式转换"],
  edit: ["Edit", "编辑标注"],
  security: ["Security", "安全签署"],
  intelligence: ["Intelligence", "智能处理"],
};

export const PDF_TOOL_CENTER_BASE_COPY = {
  "zh-CN": {
    title: "PDF 工具",
    subtitle: "本地处理 · 明确审核 · 按需使用 AI",
    close: "关闭 PDF 工具",
    search: "搜索 PDF 功能",
    chooseAgain: "重新选择",
    chooseFiles: "选择文件",
    pages: "页面",
    pagePlaceholder: "例如 1,3-5；留空表示全部",
    pageOrder: "新页面顺序",
    rotation: "旋转角度",
    signature: "可见签名",
    text: "文字",
    password: "密码",
    fieldType: "字段类型",
    fieldName: "字段名称",
    choices: "选项（每行或逗号分隔）",
    checked: "默认勾选",
    fieldText: "文本",
    fieldCheckbox: "复选框",
    fieldDropdown: "下拉选项",
    fieldList: "列表",
    publicUrl: "公开 HTTPS 网址",
    failed: "PDF 处理失败。",
    results: "处理结果",
    complete: "处理完成，下载前请确认",
    safety: "文件默认留在本机；AI 功能仍遵循先审后写。",
    processing: "正在本机处理…",
    run: "开始处理",
    continue: "在 Orbit 中继续",
  },
  en: {
    title: "PDF tools",
    subtitle: "Local processing · explicit review · AI only when useful",
    close: "Close PDF tools",
    search: "Search PDF tools",
    chooseAgain: "Choose again",
    chooseFiles: "Choose files",
    pages: "Pages",
    pagePlaceholder: "For example 1,3-5; blank means all",
    pageOrder: "New page order",
    rotation: "Rotation",
    signature: "Visible signature",
    text: "Text",
    password: "Password",
    fieldType: "Field type",
    fieldName: "Field name",
    choices: "Choices (one per line or comma-separated)",
    checked: "Checked by default",
    fieldText: "Text",
    fieldCheckbox: "Checkbox",
    fieldDropdown: "Dropdown",
    fieldList: "List",
    publicUrl: "Public HTTPS URL",
    failed: "The PDF operation failed.",
    results: "Results",
    complete: "Complete; review before download",
    safety: "Files stay local by default; AI actions remain review-before-write.",
    processing: "Processing locally…",
    run: "Run tool",
    continue: "Continue in Orbit",
  },
} as const;

function pdfToolCenterCopy(locale: OrbitLocale) {
  return localizeOrbitCopy(locale, PDF_TOOL_CENTER_BASE_COPY.en, PDF_TOOL_CENTER_BASE_COPY["zh-CN"]);
}

function acceptedFiles(tool: PdfToolDefinition) {
  if (!tool.accepts.length) return "";
  return tool.accepts.map((extension) => (extension === "pdf" ? "application/pdf,.pdf" : `.${extension}`)).join(",");
}

function requiresPages(toolId: string) {
  return [
    "split",
    "remove-pages",
    "extract-pages",
    "rotate",
    "crop",
    "watermark",
    "page-numbers",
    "edit",
    "sign",
    "forms",
    "pdf-to-images",
    "redact",
  ].includes(toolId);
}

function requiresText(toolId: string) {
  return ["create", "edit", "sign", "watermark", "forms"].includes(toolId);
}

function toolTitle(tool: PdfToolDefinition, locale: OrbitLocale) {
  return locale.startsWith("zh") ? (ZH_TITLES[tool.id] ?? tool.title) : localizeOrbitStatus(locale, tool.title);
}

function toolDescription(tool: PdfToolDefinition, locale: OrbitLocale) {
  if (!locale.startsWith("zh")) return localizeOrbitStatus(locale, tool.description);
  if (tool.runtime === "agent") return "先在本机提取为可读源内容，再由所选模型生成需要审核的结果。";
  if (tool.runtime === "workspace") return "进入 Orbit 的导入、预览与导出流程，确认完整结果后再写入或下载。";
  if (tool.runtime === "desktop") return "由 Orbit 桌面端在隔离环境中执行，不读取浏览器登录信息。";
  return "选择文件和参数后在本机执行；原文件保持不变，结果确认后再下载。";
}

export function PdfToolCenter({
  locale,
  initialToolId = "merge",
  onClose,
  onContinueInWorkspace,
}: {
  locale: OrbitLocale;
  initialToolId?: string;
  onClose: () => void;
  onContinueInWorkspace: (tool: PdfToolDefinition) => void;
}) {
  const zh = locale.startsWith("zh");
  const text = pdfToolCenterCopy(locale);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(initialToolId);
  const [files, setFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<PdfCoreToolOptions>({});
  const [outputs, setOutputs] = useState<PdfToolOutputFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selected = PDF_TOOL_REGISTRY.find((tool) => tool.id === selectedId) ?? PDF_TOOL_REGISTRY[0];
  const visibleTools = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale);
    return normalized
      ? PDF_TOOL_REGISTRY.filter((tool) =>
          `${toolTitle(tool, locale)} ${tool.title} ${tool.description}`.toLocaleLowerCase(locale).includes(normalized),
        )
      : PDF_TOOL_REGISTRY;
  }, [locale, query]);

  function chooseTool(toolId: string) {
    setSelectedId(toolId);
    setFiles([]);
    setOptions({});
    setOutputs([]);
    setError("");
  }

  async function execute() {
    if (busy) return;
    setBusy(true);
    setError("");
    setOutputs([]);
    try {
      if (selected.id === "web-to-pdf") {
        setOutputs([await renderDesktopWebPdf(options.url ?? "")]);
      } else {
        const inputs = await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            type: file.type,
            bytes: new Uint8Array(await file.arrayBuffer()),
          })),
        );
        setOutputs(await executeDirectPdfTool(selected.id, inputs, options));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.failed);
    } finally {
      setBusy(false);
    }
  }

  function download(output: PdfToolOutputFile) {
    const blob = new Blob([new Uint8Array(output.bytes)], { type: output.type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = output.name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const direct = pdfToolRunsDirectly(selected.id) || (selected.id === "web-to-pdf" && supportsDesktopWebPdf());
  return (
    <div className="pdf-tool-backdrop" role="dialog" aria-modal="true" aria-labelledby="pdf-tool-title">
      <section className="pdf-tool-window">
        <header>
          <div>
            <span className="pdf-tool-mark" aria-hidden="true">
              <FileStack />
            </span>
            <div>
              <strong id="pdf-tool-title">{text.title}</strong>
              <small>{text.subtitle}</small>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label={text.close}>
            <X />
          </button>
        </header>
        <div className="pdf-tool-layout">
          <aside>
            <label className="pdf-tool-search">
              <Search aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search} />
            </label>
            <div className="pdf-tool-list">
              {PDF_TOOL_CATEGORY_ORDER.map((category) => {
                const categoryTools = visibleTools.filter((tool) => tool.category === category);
                if (!categoryTools.length) return null;
                return (
                  <section key={category}>
                    <h2>{CATEGORY_LABELS[category][zh ? 1 : 0]}</h2>
                    {categoryTools.map((tool) => (
                      <button
                        type="button"
                        className={tool.id === selected.id ? "active" : ""}
                        aria-pressed={tool.id === selected.id}
                        onClick={() => chooseTool(tool.id)}
                        key={tool.id}
                      >
                        {toolTitle(tool, locale)}
                      </button>
                    ))}
                  </section>
                );
              })}
            </div>
          </aside>
          <main>
            <div className="pdf-tool-intro">
              <span>{CATEGORY_LABELS[selected.category][zh ? 1 : 0]}</span>
              <h2>{toolTitle(selected, locale)}</h2>
              <p>{toolDescription(selected, locale)}</p>
            </div>

            {selected.accepts.length > 0 && (
              <div className="pdf-tool-files">
                <input
                  ref={fileInputRef}
                  className="visually-hidden"
                  type="file"
                  accept={acceptedFiles(selected)}
                  multiple={selected.multiple}
                  onChange={(event) => {
                    setFiles(Array.from(event.target.files ?? []));
                    setOutputs([]);
                    setError("");
                  }}
                />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                  <Upload />
                  {files.length ? `${text.chooseAgain} (${files.length})` : text.chooseFiles}
                </button>
                {files.length > 0 && <p>{files.map((file) => file.name).join(" · ")}</p>}
              </div>
            )}

            <div className="pdf-tool-options">
              {requiresPages(selected.id) && (
                <label>
                  <span>{text.pages}</span>
                  <input
                    value={options.pages ?? ""}
                    onChange={(event) => setOptions((current) => ({ ...current, pages: event.target.value }))}
                    placeholder={text.pagePlaceholder}
                  />
                </label>
              )}
              {selected.id === "organize" && (
                <label>
                  <span>{text.pageOrder}</span>
                  <input
                    value={options.order ?? ""}
                    onChange={(event) => setOptions((current) => ({ ...current, order: event.target.value }))}
                    placeholder="3,1,2,2"
                  />
                </label>
              )}
              {selected.id === "rotate" && (
                <label>
                  <span>{text.rotation}</span>
                  <select
                    value={options.degrees ?? 90}
                    onChange={(event) =>
                      setOptions((current) => ({ ...current, degrees: Number(event.target.value) as 90 | 180 | 270 }))
                    }
                  >
                    <option value={90}>90°</option>
                    <option value={180}>180°</option>
                    <option value={270}>270°</option>
                  </select>
                </label>
              )}
              {requiresText(selected.id) && selected.id !== "forms" && (
                <label className="wide">
                  <span>{selected.id === "sign" ? text.signature : text.text}</span>
                  <textarea
                    value={options.text ?? ""}
                    onChange={(event) => setOptions((current) => ({ ...current, text: event.target.value }))}
                    rows={selected.id === "create" ? 8 : 3}
                  />
                </label>
              )}
              {selected.id === "forms" && (
                <>
                  <label>
                    <span>{text.fieldType}</span>
                    <select
                      value={options.fieldType ?? "text"}
                      onChange={(event) =>
                        setOptions((current) => ({
                          ...current,
                          fieldType: event.target.value as PdfCoreToolOptions["fieldType"],
                        }))
                      }
                    >
                      <option value="text">{text.fieldText}</option>
                      <option value="checkbox">{text.fieldCheckbox}</option>
                      <option value="dropdown">{text.fieldDropdown}</option>
                      <option value="list">{text.fieldList}</option>
                    </select>
                  </label>
                  <label>
                    <span>{text.fieldName}</span>
                    <input
                      value={options.fieldName ?? ""}
                      onChange={(event) => setOptions((current) => ({ ...current, fieldName: event.target.value }))}
                      placeholder="orbit-field"
                    />
                  </label>
                  {(options.fieldType ?? "text") !== "checkbox" && (
                    <label className="wide">
                      <span>{text.text}</span>
                      <input
                        value={options.text ?? ""}
                        onChange={(event) => setOptions((current) => ({ ...current, text: event.target.value }))}
                      />
                    </label>
                  )}
                  {(options.fieldType === "dropdown" || options.fieldType === "list") && (
                    <label className="wide">
                      <span>{text.choices}</span>
                      <textarea
                        value={options.choices ?? ""}
                        onChange={(event) => setOptions((current) => ({ ...current, choices: event.target.value }))}
                        rows={4}
                      />
                    </label>
                  )}
                  {options.fieldType === "checkbox" && (
                    <label className="pdf-tool-checkbox wide">
                      <input
                        type="checkbox"
                        checked={options.checked !== false}
                        onChange={(event) => setOptions((current) => ({ ...current, checked: event.target.checked }))}
                      />
                      <span>{text.checked}</span>
                    </label>
                  )}
                </>
              )}
              {(selected.id === "protect" || selected.id === "unlock") && (
                <label className="wide">
                  <span>{text.password}</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={options.password ?? ""}
                    onChange={(event) => setOptions((current) => ({ ...current, password: event.target.value }))}
                  />
                </label>
              )}
              {selected.id === "web-to-pdf" && (
                <label className="wide">
                  <span>{text.publicUrl}</span>
                  <input
                    type="url"
                    value={options.url ?? ""}
                    onChange={(event) => setOptions((current) => ({ ...current, url: event.target.value }))}
                    placeholder="https://example.com"
                  />
                </label>
              )}
              {(selected.id === "crop" || selected.id === "redact") &&
                (["x", "y", "width", "height"] as const).map((field) => (
                  <label key={field}>
                    <span>{selected.id === "redact" ? `${field} (%)` : field}</span>
                    <input
                      inputMode="decimal"
                      value={options[field] ?? ""}
                      onChange={(event) =>
                        setOptions((current) => ({ ...current, [field]: Number(event.target.value) }))
                      }
                    />
                  </label>
                ))}
            </div>

            {error && (
              <p className="pdf-tool-error" role="alert">
                {error}
              </p>
            )}
            {outputs.length > 0 && (
              <section className="pdf-tool-results" aria-label={text.results}>
                <header>
                  <Check aria-hidden="true" />
                  <strong>{text.complete}</strong>
                </header>
                {outputs.map((output) => (
                  <button type="button" onClick={() => download(output)} key={output.name}>
                    <Download />
                    <span>{output.name}</span>
                    <small>{(output.bytes.length / 1024).toFixed(1)} KB</small>
                  </button>
                ))}
              </section>
            )}

            <footer>
              <p>
                <ShieldCheck />
                {text.safety}
              </p>
              {direct ? (
                <button className="welcome-primary" type="button" onClick={() => void execute()} disabled={busy}>
                  {busy ? <LoaderCircle className="agent-spinner" /> : <Check />}
                  {busy ? text.processing : text.run}
                </button>
              ) : (
                <button className="welcome-primary" type="button" onClick={() => onContinueInWorkspace(selected)}>
                  <FileStack />
                  {text.continue}
                </button>
              )}
            </footer>
          </main>
        </div>
      </section>
    </div>
  );
}
