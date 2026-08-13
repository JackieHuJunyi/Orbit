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
import { isChineseRuneLocale, localizeRuneCopy, type RuneLocale } from "../lib/localization";
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

export const PDF_OCR_BASE_COPY = {
  en: {
    changed: "The detected scan pages changed. Import the file again.",
    reviewPages: "Review the OCR page selection.",
    loadingModel: "Loading and caching language model",
    renderingPage: "Rendering page",
    locally: "locally",
    recognizingPage: "Recognizing page",
    preparing: "Preparing OCR",
    kicker: "Scanned PDF · explicit selection",
    title: "Choose pages for OCR",
    description: "Rune found pages without selectable text. Confirm pages and language; image content is not read until you continue.",
    settings: "OCR settings",
    privacyFooter: "Page images stay on device · results remain reviewable",
    stop: "Stop",
    cancel: "Cancel",
    recognizing: "Recognizing…",
    recognize: "Recognize",
    page: "page",
    pages: "pages",
    onDevice: "On-device recognition",
    privacy: "PDF pages render only in this browser. Rune loads its bundled OCR runtime and language data from this site and the browser caches them; page images and recognized text are never sent.",
    detectedScanPages: "detected scan pages",
    pagesToRecognize: "Pages to recognize",
    ocrPagesFor: "OCR pages for",
    pageExample: "For example 1-3, 5; only detected scan pages can be selected.",
    pageLanguage: "Page language",
    ocrLanguageFor: "OCR language for",
    languageHint: "Choose the language actually used on the page to reduce errors.",
  },
  zh: {
    changed: "扫描页信息已经变化，请重新导入。",
    reviewPages: "请检查 OCR 页码。",
    loadingModel: "正在加载并缓存语言模型",
    renderingPage: "正在本地渲染第",
    locally: "页",
    recognizingPage: "正在识别第",
    preparing: "准备 OCR",
    kicker: "扫描 PDF · 明确选择",
    title: "选择需要 OCR 的页面",
    description: "Rune 发现了没有可选文本的页面。请确认页码和语言；确认前不会读取图像内容。",
    settings: "OCR 设置",
    privacyFooter: "页面图像不上传 · 结果仍需审核",
    stop: "停止",
    cancel: "取消",
    recognizing: "正在识别…",
    recognize: "识别",
    page: "页",
    pages: "页",
    onDevice: "设备内识别",
    privacy: "PDF 页面只在浏览器内渲染。Rune 会从当前站点加载内置 OCR 运行库和语言数据，并由浏览器缓存；不会发送页面图像或识别文本。",
    detectedScanPages: "检测到扫描页",
    pagesToRecognize: "识别页码",
    ocrPagesFor: "OCR 页码：",
    pageExample: "例如 1-3, 5；只能选择上方检测到的扫描页。",
    pageLanguage: "页面语言",
    ocrLanguageFor: "OCR 语言：",
    languageHint: "选择页面实际使用的语言可减少误识别。",
  },
} as const;

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
  const copy = localizeRuneCopy<typeof PDF_OCR_BASE_COPY.en>(locale, PDF_OCR_BASE_COPY.en, PDF_OCR_BASE_COPY.zh);
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
        if (!candidate) throw new Error(copy.changed);
        return {
          fileIndex: draft.fileIndex,
          language: draft.language,
          pageNumbers: parsePdfPageSelection(draft.pages, candidate.analysis.ocrCandidatePageNumbers),
        };
      });
      setValidationError("");
      onRecognize(selections);
    } catch (nextError) {
      setValidationError(nextError instanceof Error ? nextError.message : copy.reviewPages);
    }
  }

  const stageLabel = progress
    ? progress.stage === "loading-model"
      ? copy.loadingModel
      : progress.stage === "rendering-page"
        ? `${copy.renderingPage} ${progress.pageNumber} ${copy.locally}`
        : `${copy.recognizingPage} ${progress.pageNumber}`
    : copy.preparing;
  const progressValue = progress
    ? Math.round(((progress.completedPages + progress.progress) / Math.max(1, progress.totalPages)) * 100)
    : 0;

  return (
    <ReviewDialog
      dialogId="pdf-ocr-setup"
      kicker={<><FileScan aria-hidden="true" /> {copy.kicker}</>}
      title={copy.title}
      description={copy.description}
      detailsLabel={copy.settings}
      locale={locale}
      onCancel={onCancel}
      footer={(
        <>
          <div><ShieldCheck aria-hidden="true" /> {copy.privacyFooter}</div>
          <span>
            <button className="button ghost-button" onClick={onCancel}>{processing ? copy.stop : copy.cancel}</button>
            <button className="button primary-button" onClick={submit} disabled={processing} data-dialog-initial-focus>
              {processing ? <LoaderCircle className="agent-spinner" aria-hidden="true" /> : <ScanText aria-hidden="true" />}
              {processing ? copy.recognizing : `${copy.recognize} ${selectedCount} ${selectedCount === 1 ? copy.page : copy.pages}`}
            </button>
          </span>
        </>
      )}
    >
      <div className="pdf-ocr-setup">
        <section className="pdf-ocr-privacy">
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong>{copy.onDevice}</strong>
            <p>{copy.privacy}</p>
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
                  <small>{candidate.analysis.pageCount} {candidate.analysis.pageCount === 1 ? copy.page : copy.pages} · {copy.detectedScanPages} {candidatePages}</small>
                </div>
              </header>
              <div className="pdf-ocr-fields">
                <label>
                  <span>{copy.pagesToRecognize}</span>
                  <input
                    value={draft.pages}
                    disabled={processing}
                    spellCheck={false}
                    aria-label={`${copy.ocrPagesFor} ${candidate.fileName}`}
                    onChange={(event) => setDrafts((current) => current.map((item) => (
                      item.fileIndex === candidate.fileIndex ? { ...item, pages: event.target.value } : item
                    )))}
                  />
                  <small>{copy.pageExample}</small>
                </label>
                <label>
                  <span>{copy.pageLanguage}</span>
                  <select
                    value={draft.language}
                    disabled={processing}
                    aria-label={`${copy.ocrLanguageFor} ${candidate.fileName}`}
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
                  <small>{copy.languageHint}</small>
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
