"use client";

import { FilePlus2, FileText, FolderOpen, Sparkles, Upload } from "lucide-react";
import { useState, type DragEvent } from "react";
import { runeText, type RuneLocale } from "../lib/localization";

const copy = {
  "zh-CN": {
    eyebrow: "打开内容",
    title: "把文件拖到这里",
    body: "或从这台设备选择文件。Rune 会先在本地读取，并在写入工作区前显示转换结果。",
    choose: "选择文件",
    create: "新建空白内容",
    sample: "打开示例",
    support: "支持 Markdown、CSV、JSON、HTML、PDF、DOCX、XLSX、PPTX、ODT、ODS、ODP；兼容格式都会先显示转换审核。",
    drop: "松开即可准备导入",
    guide: "本地指南仍在左侧工作区中",
  },
  en: {
    eyebrow: "Open something",
    title: "Drop files here",
    body: "Or choose files from this device. Rune reads locally first and shows the conversion before writing to your workspace.",
    choose: "Choose files",
    create: "Create blank",
    sample: "Open sample",
    support: "Supports Markdown, CSV, JSON, HTML, PDF, DOCX, XLSX, PPTX, ODT, ODS, and ODP. Compatibility imports are reviewed before writing.",
    drop: "Release to prepare the import",
    guide: "Your local guide remains in the workspace rail",
  },
} as const;

function emptyWorkspaceCopy(locale: RuneLocale) {
  if (locale === "en") return copy.en;
  if (locale === "zh-CN") return copy["zh-CN"];
  return Object.fromEntries(Object.entries(copy["zh-CN"]).map(([key, value]) => (
    [key, runeText(locale, value, value)]
  ))) as typeof copy["zh-CN"];
}

export function EmptyWorkspace({
  locale,
  onChooseFiles,
  onCreate,
  onDropFiles,
  onOpenSample,
}: {
  locale: RuneLocale;
  onChooseFiles: () => void;
  onCreate: () => void;
  onDropFiles: (files: File[]) => void;
  onOpenSample: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const text = emptyWorkspaceCopy(locale);

  function acceptDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const files = [...event.dataTransfer.files];
    if (files.length) onDropFiles(files);
  }

  return (
    <section className="empty-workspace-canvas" aria-label={text.title}>
      <div
        className={"empty-drop-zone " + (dragging ? "dragging" : "")}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragging(true); }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={acceptDrop}
      >
        <div className="empty-file-stack" aria-hidden="true">
          <span><FileText /></span><span><Sparkles /></span><span><Upload /></span>
        </div>
        <span className="empty-eyebrow">{dragging ? text.drop : text.eyebrow}</span>
        <h1>{text.title}</h1>
        <p>{text.body}</p>
        <div className="empty-actions">
          <button type="button" className="welcome-primary" onClick={onChooseFiles}><FolderOpen />{text.choose}</button>
          <button type="button" onClick={onCreate}><FilePlus2 />{text.create}</button>
          <button type="button" onClick={onOpenSample}><Sparkles />{text.sample}</button>
        </div>
        <small>{text.support}</small>
      </div>
      <p className="empty-guide-note">{text.guide}</p>
    </section>
  );
}
