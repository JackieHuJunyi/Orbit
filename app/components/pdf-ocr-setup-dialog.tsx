"use client";

import { FileScan, LoaderCircle, ScanText, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import {
  formatPdfPageSelection,
  parsePdfPageSelection,
  type PdfImportAnalysis,
  type PdfOcrLanguage,
  type PdfOcrProgress,
} from "../lib/pdf-import";
import { isChineseRuneLocale, type RuneLocale } from "../lib/localization";
import { ReviewDialog } from "./review-dialog";

export type PdfOcrCandidate = {
  fileIndex: number;
  fileName: string;
  analysis: PdfImportAnalysis;
};

export type PdfOcrSelection = {
  fileIndex: number;
  language: PdfOcrLanguage;
  pageNumbers: number[];
};

type Draft = {
  fileIndex: number;
  language: PdfOcrLanguage;
  pages: string;
};

function initialDrafts(candidates: PdfOcrCandidate[], locale: RuneLocale): Draft[] {
  return candidates.map((candidate) => ({
    fileIndex: candidate.fileIndex,
    language: isChineseRuneLocale(locale) ? "eng+chi_sim" : "eng",
    pages: formatPdfPageSelection(candidate.analysis.ocrCandidatePageNumbers),
  }));
}

export function PdfOcrSetupDialog({
  candidates,
  locale,
  processing,
  progress,
  activeFileName,
  error,
  onCancel,
  onRecognize,
}: {
  candidates: PdfOcrCandidate[];
  locale: RuneLocale;
  processing: boolean;
  progress: PdfOcrProgress | null;
  activeFileName?: string;
  error?: string;
  onCancel: () => void;
  onRecognize: (selections: PdfOcrSelection[]) => void;
}) {
  const zh = isChineseRuneLocale(locale);
  const [drafts, setDrafts] = useState(() => initialDrafts(candidates, locale));
  const [validationError, setValidationError] = useState("");
  const selectedCount = useMemo(() => drafts.reduce((total, draft) => {
    const candidate = candidates.find((item) => item.fileIndex === draft.fileIndex);
    if (!candidate) return total;
    try {
      return total + parsePdfPageSelection(draft.pages, candidate.analysis.ocrCandidatePageNumbers).length;
    } catch {
      return total;
    }
  }, 0), [candidates, drafts]);

  function submit() {
    try {
      const selections = drafts.map((draft) => {
        const candidate = candidates.find((item) => item.fileIndex === draft.fileIndex);
        if (!candidate) throw new Error(zh ? "扫描页信息已经变化，请重新导入。" : "The detected scan pages changed. Import the file again.");
        return {
          fileIndex: draft.fileIndex,
          language: draft.language,
          pageNumbers: parsePdfPageSelection(draft.pages, candidate.analysis.ocrCandidatePageNumbers),
        };
      });
      setValidationError("");
      onRecognize(selections);
    } catch (nextError) {
      setValidationError(nextError instanceof Error ? nextError.message : (zh ? "请检查 OCR 页码。" : "Review the OCR page selection."));
    }
  }

  const stageLabel = progress
    ? progress.stage === "loading-model"
      ? (zh ? "正在加载并缓存语言模型" : "Loading and caching language model")
      : progress.stage === "rendering-page"
        ? (zh ? `正在本地渲染第 ${progress.pageNumber} 页` : `Rendering page ${progress.pageNumber} locally`)
        : (zh ? `正在识别第 ${progress.pageNumber} 页` : `Recognizing page ${progress.pageNumber}`)
    : (zh ? "准备 OCR" : "Preparing OCR");
  const progressValue = progress
    ? Math.round(((progress.completedPages + progress.progress) / Math.max(1, progress.totalPages)) * 100)
    : 0;

  return (
    <ReviewDialog
      dialogId="pdf-ocr-setup"
      kicker={<><FileScan aria-hidden="true" /> {zh ? "扫描 PDF · 明确选择" : "Scanned PDF · explicit selection"}</>}
      title={zh ? "选择需要 OCR 的页面" : "Choose pages for OCR"}
      description={zh
        ? "Rune 发现了没有可选文本的页面。请确认页码和语言；确认前不会读取图像内容。"
        : "Rune found pages without selectable text. Confirm pages and language; image content is not read until you continue."}
      detailsLabel={zh ? "OCR 设置" : "OCR settings"}
      locale={locale}
      onCancel={onCancel}
      footer={(
        <>
          <div><ShieldCheck aria-hidden="true" /> {zh ? "页面图像不上传 · 结果仍需审核" : "Page images stay on device · results remain reviewable"}</div>
          <span>
            <button className="button ghost-button" onClick={onCancel}>{processing ? (zh ? "停止" : "Stop") : (zh ? "取消" : "Cancel")}</button>
            <button className="button primary-button" onClick={submit} disabled={processing} data-dialog-initial-focus>
              {processing ? <LoaderCircle className="agent-spinner" aria-hidden="true" /> : <ScanText aria-hidden="true" />}
              {processing ? (zh ? "正在识别…" : "Recognizing…") : (zh ? `识别 ${selectedCount} 页` : `Recognize ${selectedCount} ${selectedCount === 1 ? "page" : "pages"}`)}
            </button>
          </span>
        </>
      )}
    >
      <div className="pdf-ocr-setup">
        <section className="pdf-ocr-privacy">
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong>{zh ? "设备内识别" : "On-device recognition"}</strong>
            <p>{zh
              ? "PDF 页面只在浏览器内渲染。Rune 会从当前站点加载内置 OCR 运行库和语言数据，并由浏览器缓存；不会发送页面图像或识别文本。"
              : "PDF pages render only in this browser. Rune loads its bundled OCR runtime and language data from this site and the browser caches them; page images and recognized text are never sent."}</p>
          </div>
        </section>

        {candidates.map((candidate) => {
          const draft = drafts.find((item) => item.fileIndex === candidate.fileIndex);
          if (!draft) return null;
          const candidatePages = formatPdfPageSelection(candidate.analysis.ocrCandidatePageNumbers);
          return (
            <section className="pdf-ocr-file" key={`${candidate.fileIndex}:${candidate.fileName}`}>
              <header>
                <span><FileScan aria-hidden="true" /></span>
                <div>
                  <strong>{candidate.fileName}</strong>
                  <small>{zh
                    ? `${candidate.analysis.pageCount} 页 · 检测到扫描页 ${candidatePages}`
                    : `${candidate.analysis.pageCount} pages · detected scan pages ${candidatePages}`}</small>
                </div>
              </header>
              <div className="pdf-ocr-fields">
                <label>
                  <span>{zh ? "识别页码" : "Pages to recognize"}</span>
                  <input
                    value={draft.pages}
                    disabled={processing}
                    spellCheck={false}
                    aria-label={zh ? `${candidate.fileName} 的 OCR 页码` : `OCR pages for ${candidate.fileName}`}
                    onChange={(event) => setDrafts((current) => current.map((item) => (
                      item.fileIndex === candidate.fileIndex ? { ...item, pages: event.target.value } : item
                    )))}
                  />
                  <small>{zh ? "例如 1-3, 5；只能选择上方检测到的扫描页。" : "For example 1-3, 5; only detected scan pages can be selected."}</small>
                </label>
                <label>
                  <span>{zh ? "页面语言" : "Page language"}</span>
                  <select
                    value={draft.language}
                    disabled={processing}
                    aria-label={zh ? `${candidate.fileName} 的 OCR 语言` : `OCR language for ${candidate.fileName}`}
                    onChange={(event) => setDrafts((current) => current.map((item) => (
                      item.fileIndex === candidate.fileIndex
                        ? { ...item, language: event.target.value as PdfOcrLanguage }
                        : item
                    )))}
                  >
                    <option value="eng">English</option>
                    <option value="chi_sim">简体中文</option>
                    <option value="eng+chi_sim">简体中文 + English</option>
                  </select>
                  <small>{zh ? "选择页面实际使用的语言可减少误识别。" : "Choose the language actually used on the page to reduce errors."}</small>
                </label>
              </div>
            </section>
          );
        })}

        {processing && (
          <section className="pdf-ocr-progress" aria-live="polite">
            <div><strong>{stageLabel}</strong><span>{progressValue}%</span></div>
            <progress max="100" value={progressValue} />
            {activeFileName && <small>{activeFileName}</small>}
          </section>
        )}
        {(validationError || error) && <div className="import-review-error" role="alert">{validationError || error}</div>}
      </div>
    </ReviewDialog>
  );
}
