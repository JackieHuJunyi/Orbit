"use client";

import {
  ArrowRight,
  ClipboardList,
  FilePlus2,
  FileText,
  FolderOpen,
  Presentation,
  Sparkles,
  Upload,
} from "lucide-react";
import { useState, type DragEvent } from "react";
import { localizeRuneCopy, type RuneLocale } from "../lib/localization";

export const EMPTY_WORKSPACE_BASE_COPY = {
  "zh-CN": {
    eyebrow: "从真实结果开始",
    title: "把数据变成可核验的汇报。",
    body: "选择 CSV、JSON、XLSX 或 ODS。Rune 会先让你审核导入结果，再引导你确认字段、口径、图表和交付物。",
    startReview: "创建经营汇报",
    startReviewBody: "导入数据后，直接进入字段映射和成品设置",
    startBriefing: "从文档创建演示",
    startBriefingBody: "导入文档，审核后直接确认受众、重点和页数",
    orOpen: "或者打开其他内容",
    choose: "打开文件",
    create: "新建空白内容",
    sample: "打开示例",
    support: "也可以把任意支持的文件拖到此处。所有兼容格式都会先显示转换审核。",
    drop: "松开即可准备导入",
    guide: "本地指南仍在左侧工作区中",
  },
  en: {
    eyebrow: "Start with a real outcome",
    title: "Turn data into a verifiable review.",
    body: "Choose CSV, JSON, XLSX, or ODS. Rune shows the import first, then guides you through fields, measures, charts, and deliverables.",
    startReview: "Create operating review",
    startReviewBody: "Import data, then continue directly to mapping and output setup",
    startBriefing: "Create presentation from document",
    startBriefingBody: "Import a document, review it, then choose audience, purpose, and length",
    orOpen: "Or open something else",
    choose: "Open files",
    create: "Create blank",
    sample: "Open sample",
    support: "You can also drop any supported file here. Every compatibility conversion is reviewed before writing.",
    drop: "Release to prepare the import",
    guide: "Your local guide remains in the workspace rail",
  },
} as const;

function emptyWorkspaceCopy(locale: RuneLocale) {
  return localizeRuneCopy(locale, EMPTY_WORKSPACE_BASE_COPY.en, EMPTY_WORKSPACE_BASE_COPY["zh-CN"]);
}

export function EmptyWorkspace({
  locale,
  onStartReview,
  onStartBriefing,
  onChooseFiles,
  onCreate,
  onDropFiles,
  onOpenSample,
}: {
  locale: RuneLocale;
  onStartReview: () => void;
  onStartBriefing: () => void;
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
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={acceptDrop}
      >
        <div className="empty-file-stack" aria-hidden="true">
          <span>
            <FileText />
          </span>
          <span>
            <Sparkles />
          </span>
          <span>
            <Upload />
          </span>
        </div>
        <span className="empty-eyebrow">{dragging ? text.drop : text.eyebrow}</span>
        <h1>{text.title}</h1>
        <p>{text.body}</p>
        <div className="empty-task-list">
          <button type="button" className="empty-task-primary" onClick={onStartReview}>
            <span>
              <ClipboardList aria-hidden="true" />
            </span>
            <span>
              <strong>{text.startReview}</strong>
              <small>{text.startReviewBody}</small>
            </span>
            <ArrowRight aria-hidden="true" />
          </button>
          <button type="button" className="empty-task-primary quiet" onClick={onStartBriefing}>
            <span>
              <Presentation aria-hidden="true" />
            </span>
            <span>
              <strong>{text.startBriefing}</strong>
              <small>{text.startBriefingBody}</small>
            </span>
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
        <div className="empty-choice-divider">
          <span>{text.orOpen}</span>
        </div>
        <div className="empty-actions">
          <button type="button" onClick={onChooseFiles}>
            <FolderOpen />
            {text.choose}
          </button>
          <button type="button" onClick={onCreate}>
            <FilePlus2 />
            {text.create}
          </button>
          <button type="button" onClick={onOpenSample}>
            <Sparkles />
            {text.sample}
          </button>
        </div>
        <small>{text.support}</small>
      </div>
      <p className="empty-guide-note">{text.guide}</p>
    </section>
  );
}
