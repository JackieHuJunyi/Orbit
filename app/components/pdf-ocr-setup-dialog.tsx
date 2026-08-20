"use client";

import { Crop, FileScan, LoaderCircle, RotateCcw, ScanText, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  formatPdfPageSelection,
  parsePdfPageSelection,
  type PdfOcrLanguage,
  type PdfOcrProgress,
  type PdfOcrRegion,
} from "../lib/pdf-import";
import type { WorkspacePdfOcrCandidate as PdfOcrCandidate } from "../lib/workspace-file-import";
import { isChineseRuneLocale, localizeRuneCopy, type RuneLocale } from "../lib/localization";
import { ReviewDialog } from "./review-dialog";

export type PdfOcrSelection = {
  fileIndex: number;
  language: PdfOcrLanguage;
  pageNumbers: number[];
  regions?: Record<number, PdfOcrRegion>;
};

type Draft = {
  fileIndex: number;
  language: PdfOcrLanguage;
  pages: string;
  regions: Record<number, PdfOcrRegion>;
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
    description:
      "Rune found pages without selectable text. Confirm pages and language; image content is not read until you open a preview or recognize.",
    settings: "OCR settings",
    privacyFooter: "Page images stay on device · results remain reviewable",
    stop: "Stop",
    cancel: "Cancel",
    recognizing: "Recognizing…",
    recognize: "Recognize",
    page: "page",
    pages: "pages",
    onDevice: "On-device recognition",
    privacy:
      "PDF pages render only in this browser. Rune loads its bundled OCR runtime and language data from this site and the browser caches them; page images and recognized text are never sent.",
    detectedScanPages: "detected scan pages",
    pagesToRecognize: "Pages to recognize",
    ocrPagesFor: "OCR pages for",
    pageExample: "For example 1-3, 5; only detected scan pages can be selected.",
    pageLanguage: "Page language",
    ocrLanguageFor: "OCR language for",
    languageHint: "Choose the language actually used on the page to reduce errors.",
    regionTitle: "Optional page region",
    regionDescription:
      "Choose a page, then drag over the preview to recognize only that area. Whole page remains the default.",
    openPreview: "Preview and choose region",
    previewPage: "Preview page",
    wholePage: "Whole page",
    resetRegion: "Reset to whole page",
    loadingPreview: "Rendering a private on-device preview…",
    previewError: "Rune could not render this page preview.",
    dragRegion: "Drag to select the OCR region",
    regionLeft: "Left",
    regionTop: "Top",
    regionWidth: "Width",
    regionHeight: "Height",
    percent: "%",
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
    description: "Rune 发现了没有可选文本的页面。请确认页码和语言；打开预览或开始识别前不会读取图像内容。",
    settings: "OCR 设置",
    privacyFooter: "页面图像不上传 · 结果仍需审核",
    stop: "停止",
    cancel: "取消",
    recognizing: "正在识别…",
    recognize: "识别",
    page: "页",
    pages: "页",
    onDevice: "设备内识别",
    privacy:
      "PDF 页面只在浏览器内渲染。Rune 会从当前站点加载内置 OCR 运行库和语言数据，并由浏览器缓存；不会发送页面图像或识别文本。",
    detectedScanPages: "检测到扫描页",
    pagesToRecognize: "识别页码",
    ocrPagesFor: "OCR 页码：",
    pageExample: "例如 1-3, 5；只能选择上方检测到的扫描页。",
    pageLanguage: "页面语言",
    ocrLanguageFor: "OCR 语言：",
    languageHint: "选择页面实际使用的语言可减少误识别。",
    regionTitle: "可选页面区域",
    regionDescription: "选择页码后，在预览中拖拽框选；默认仍识别整页，每一页可单独设置。",
    openPreview: "预览并框选区域",
    previewPage: "预览页",
    wholePage: "整页",
    resetRegion: "恢复整页",
    loadingPreview: "正在设备内生成私密预览…",
    previewError: "Rune 无法生成此页面的预览。",
    dragRegion: "拖拽框选 OCR 区域",
    regionLeft: "左",
    regionTop: "上",
    regionWidth: "宽",
    regionHeight: "高",
    percent: "%",
  },
} as const;

function initialDrafts(candidates: PdfOcrCandidate[], locale: RuneLocale): Draft[] {
  return candidates.map((candidate) => ({
    fileIndex: candidate.fileIndex,
    language: isChineseRuneLocale(locale) ? "eng+chi_sim" : "eng",
    pages: formatPdfPageSelection(candidate.analysis.ocrCandidatePageNumbers),
    regions: {},
  }));
}

const WHOLE_PAGE_REGION: PdfOcrRegion = { left: 0, top: 0, width: 1, height: 1 };

function regionPercent(region: PdfOcrRegion | undefined, key: keyof PdfOcrRegion) {
  return Math.round((region ?? WHOLE_PAGE_REGION)[key] * 100);
}

function changedRegion(region: PdfOcrRegion, key: keyof PdfOcrRegion, percent: number): PdfOcrRegion {
  const isEdge = key === "width" || key === "height";
  const value = Math.max(isEdge ? 2 : 0, Math.min(isEdge ? 100 : 98, percent)) / 100;
  const next = { ...region, [key]: value };
  if (key === "left") next.width = Math.max(0.02, Math.min(next.width, 1 - next.left));
  if (key === "top") next.height = Math.max(0.02, Math.min(next.height, 1 - next.top));
  if (key === "width") next.left = Math.min(next.left, 1 - next.width);
  if (key === "height") next.top = Math.min(next.top, 1 - next.height);
  return next;
}

function PdfOcrRegionSelector({
  candidate,
  selectedPages,
  regions,
  disabled,
  copy,
  onChange,
}: {
  candidate: PdfOcrCandidate;
  selectedPages: number[];
  regions: Record<number, PdfOcrRegion>;
  disabled: boolean;
  copy: typeof PDF_OCR_BASE_COPY.en;
  onChange: (regions: Record<number, PdfOcrRegion>) => void;
}) {
  const [pageNumber, setPageNumber] = useState(selectedPages[0] ?? candidate.analysis.ocrCandidatePageNumbers[0] ?? 1);
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [previewDimensions, setPreviewDimensions] = useState({ width: 612, height: 792 });
  const [dragRegion, setDragRegion] = useState<PdfOcrRegion | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const activePageNumber = selectedPages.includes(pageNumber) ? pageNumber : (selectedPages[0] ?? pageNumber);
  const activeRegion = regions[activePageNumber];
  const displayRegion = dragRegion ?? activeRegion;

  useEffect(() => {
    if (!previewEnabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controller = new AbortController();
    setPreviewState("loading");
    void candidate.file
      .arrayBuffer()
      .then(async (input) => {
        const { renderPdfOcrPagePreview } = await import("../lib/pdf-import-client");
        await renderPdfOcrPagePreview(candidate.fileName, input, activePageNumber, canvas, controller.signal);
        if (!controller.signal.aborted) {
          setPreviewDimensions({ width: canvas.width, height: canvas.height });
          setPreviewState("ready");
        }
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setPreviewState("error");
      });
    return () => controller.abort();
  }, [activePageNumber, candidate.file, candidate.fileName, previewEnabled]);

  function pointFromEvent(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width))),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / Math.max(1, bounds.height))),
    };
  }

  function regionFromDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current;
    if (!start) return null;
    const end = pointFromEvent(event);
    return {
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const region = regionFromDrag(event);
    if (!region) return;
    dragStartRef.current = null;
    setDragRegion(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (region.width < 0.02 || region.height < 0.02) return;
    onChange({ ...regions, [activePageNumber]: region });
  }

  function updatePercent(key: keyof PdfOcrRegion, value: string) {
    const percent = Number(value);
    if (!Number.isFinite(percent)) return;
    onChange({
      ...regions,
      [activePageNumber]: changedRegion(activeRegion ?? WHOLE_PAGE_REGION, key, percent),
    });
  }

  return (
    <section className="pdf-ocr-region-editor">
      <header>
        <div>
          <strong>
            <Crop aria-hidden="true" /> {copy.regionTitle}
          </strong>
          <small>{copy.regionDescription}</small>
        </div>
        <label>
          <span>{copy.previewPage}</span>
          <select
            value={activePageNumber}
            disabled={disabled || !selectedPages.length}
            onChange={(event) => setPageNumber(Number(event.target.value))}
          >
            {selectedPages.map((page) => (
              <option key={page} value={page}>
                {page}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="pdf-ocr-region-layout">
        <div className="pdf-ocr-page-preview">
          <div
            className="pdf-ocr-preview-sheet"
            style={{
              aspectRatio: `${previewDimensions.width} / ${previewDimensions.height}`,
              width: `min(100%, ${Math.round((330 * previewDimensions.width) / previewDimensions.height)}px)`,
            }}
          >
            <canvas ref={canvasRef} aria-label={`${copy.previewPage} ${activePageNumber}`} />
            {previewState === "ready" && (
              <div
                className="pdf-ocr-region-surface"
                role="img"
                aria-label={`${copy.dragRegion}, ${copy.previewPage} ${activePageNumber}`}
                onPointerDown={(event) => {
                  if (disabled) return;
                  dragStartRef.current = pointFromEvent(event);
                  setDragRegion(null);
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  const region = regionFromDrag(event);
                  if (region) setDragRegion(region);
                }}
                onPointerUp={finishDrag}
                onPointerCancel={() => {
                  dragStartRef.current = null;
                  setDragRegion(null);
                }}
              >
                {displayRegion && (
                  <span
                    style={{
                      left: `${displayRegion.left * 100}%`,
                      top: `${displayRegion.top * 100}%`,
                      width: `${displayRegion.width * 100}%`,
                      height: `${displayRegion.height * 100}%`,
                    }}
                  />
                )}
              </div>
            )}
          </div>
          {previewState === "idle" && (
            <div className="pdf-ocr-preview-status">
              <button
                className="button ghost-button"
                type="button"
                disabled={disabled}
                onClick={() => setPreviewEnabled(true)}
              >
                <Crop aria-hidden="true" /> {copy.openPreview}
              </button>
            </div>
          )}
          {previewState !== "idle" && previewState !== "ready" && (
            <div className="pdf-ocr-preview-status">
              {previewState === "loading" ? copy.loadingPreview : copy.previewError}
            </div>
          )}
        </div>
        <div className="pdf-ocr-region-controls">
          <strong>{activeRegion ? copy.regionTitle : copy.wholePage}</strong>
          <div>
            {(["left", "top", "width", "height"] as const).map((key) => (
              <label key={key}>
                <span>
                  {
                    { left: copy.regionLeft, top: copy.regionTop, width: copy.regionWidth, height: copy.regionHeight }[
                      key
                    ]
                  }
                </span>
                <span>
                  <input
                    type="number"
                    min={key === "width" || key === "height" ? 2 : 0}
                    max={key === "width" || key === "height" ? 100 : 98}
                    value={regionPercent(activeRegion, key)}
                    disabled={disabled}
                    onChange={(event) => updatePercent(key, event.target.value)}
                  />{" "}
                  {copy.percent}
                </span>
              </label>
            ))}
          </div>
          <button
            className="button ghost-button"
            type="button"
            disabled={disabled || !activeRegion}
            onClick={() => {
              const next = { ...regions };
              delete next[activePageNumber];
              onChange(next);
            }}
          >
            <RotateCcw aria-hidden="true" /> {copy.resetRegion}
          </button>
        </div>
      </div>
    </section>
  );
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
  const selectedCount = useMemo(
    () =>
      drafts.reduce((total, draft) => {
        const candidate = candidates.find((item) => item.fileIndex === draft.fileIndex);
        if (!candidate) return total;
        try {
          return total + parsePdfPageSelection(draft.pages, candidate.analysis.ocrCandidatePageNumbers).length;
        } catch {
          return total;
        }
      }, 0),
    [candidates, drafts],
  );

  function submit() {
    try {
      const selections = drafts.map((draft) => {
        const candidate = candidates.find((item) => item.fileIndex === draft.fileIndex);
        if (!candidate) throw new Error(copy.changed);
        const pageNumbers = parsePdfPageSelection(draft.pages, candidate.analysis.ocrCandidatePageNumbers);
        const regions = Object.fromEntries(
          Object.entries(draft.regions).filter(([pageNumber]) => pageNumbers.includes(Number(pageNumber))),
        );
        return {
          fileIndex: draft.fileIndex,
          language: draft.language,
          pageNumbers,
          ...(Object.keys(regions).length ? { regions } : {}),
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
      kicker={
        <>
          <FileScan aria-hidden="true" /> {copy.kicker}
        </>
      }
      title={copy.title}
      description={copy.description}
      detailsLabel={copy.settings}
      locale={locale}
      onCancel={onCancel}
      footer={
        <>
          <div>
            <ShieldCheck aria-hidden="true" /> {copy.privacyFooter}
          </div>
          <span>
            <button className="button ghost-button" onClick={onCancel}>
              {processing ? copy.stop : copy.cancel}
            </button>
            <button className="button primary-button" onClick={submit} disabled={processing} data-dialog-initial-focus>
              {processing ? (
                <LoaderCircle className="agent-spinner" aria-hidden="true" />
              ) : (
                <ScanText aria-hidden="true" />
              )}
              {processing
                ? copy.recognizing
                : `${copy.recognize} ${selectedCount} ${selectedCount === 1 ? copy.page : copy.pages}`}
            </button>
          </span>
        </>
      }
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
                <span>
                  <FileScan aria-hidden="true" />
                </span>
                <div>
                  <strong>{candidate.fileName}</strong>
                  <small>
                    {candidate.analysis.pageCount} {candidate.analysis.pageCount === 1 ? copy.page : copy.pages} ·{" "}
                    {copy.detectedScanPages} {candidatePages}
                  </small>
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
                    onChange={(event) =>
                      setDrafts((current) =>
                        current.map((item) =>
                          item.fileIndex === candidate.fileIndex ? { ...item, pages: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <small>{copy.pageExample}</small>
                </label>
                <label>
                  <span>{copy.pageLanguage}</span>
                  <select
                    value={draft.language}
                    disabled={processing}
                    aria-label={`${copy.ocrLanguageFor} ${candidate.fileName}`}
                    onChange={(event) =>
                      setDrafts((current) =>
                        current.map((item) =>
                          item.fileIndex === candidate.fileIndex
                            ? { ...item, language: event.target.value as PdfOcrLanguage }
                            : item,
                        ),
                      )
                    }
                  >
                    <option value="eng">English</option>
                    <option value="chi_sim">简体中文</option>
                    <option value="eng+chi_sim">简体中文 + English</option>
                  </select>
                  <small>{copy.languageHint}</small>
                </label>
              </div>
              <PdfOcrRegionSelector
                candidate={candidate}
                selectedPages={(() => {
                  try {
                    return parsePdfPageSelection(draft.pages, candidate.analysis.ocrCandidatePageNumbers);
                  } catch {
                    return [];
                  }
                })()}
                regions={draft.regions}
                disabled={processing}
                copy={copy}
                onChange={(regions) =>
                  setDrafts((current) =>
                    current.map((item) => (item.fileIndex === candidate.fileIndex ? { ...item, regions } : item)),
                  )
                }
              />
            </section>
          );
        })}

        {processing && (
          <section className="pdf-ocr-progress" aria-live="polite">
            <div>
              <strong>{stageLabel}</strong>
              <span>{progressValue}%</span>
            </div>
            <progress max="100" value={progressValue} />
            {activeFileName && <small>{activeFileName}</small>}
          </section>
        )}
        {(validationError || error) && (
          <div className="import-review-error" role="alert">
            {validationError || error}
          </div>
        )}
      </div>
    </ReviewDialog>
  );
}
