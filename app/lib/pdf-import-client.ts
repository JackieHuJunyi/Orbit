import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { analyzePdfFileWithLibrary, convertPdfFileWithLibrary, convertPdfFileWithOcrAndLibrary } from "./pdf-import";
import type { PdfJsLibrary, PdfOcrProgress, PdfOcrRequest, PdfPageOcrRecognizer } from "./pdf-import";
import { detectOcrCoreVariant } from "./ocr-core";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function convertPdfFile(fileName: string, input: ArrayBuffer | Uint8Array) {
  return convertPdfFileWithLibrary(fileName, input, pdfjs as unknown as PdfJsLibrary);
}

export async function analyzePdfFile(fileName: string, input: ArrayBuffer | Uint8Array) {
  return analyzePdfFileWithLibrary(fileName, input, pdfjs as unknown as PdfJsLibrary);
}

const MAX_OCR_LONG_EDGE = 2_400;
const MIN_OCR_SCALE = 1.5;
const MAX_OCR_PIXELS = 8_000_000;

export async function convertPdfFileWithOcr(
  fileName: string,
  input: ArrayBuffer | Uint8Array,
  request: PdfOcrRequest,
  options: { signal?: AbortSignal; onProgress?: (progress: PdfOcrProgress) => void } = {},
) {
  const { createWorker } = await import("tesseract.js");
  const assetBase = new URL("ocr/", `${window.location.origin}/`).href;
  options.onProgress?.({
    stage: "loading-model",
    completedPages: 0,
    totalPages: request.pageNumbers.length,
    progress: 0,
  });
  let activePageNumber: number | undefined;
  let activeCompletedPages = 0;
  const worker = await createWorker(request.language, undefined, {
    workerPath: `${assetBase}worker.min.js`,
    // Resolve one core variant up front so the worker fetches a single wasm
    // loader instead of probing the whole directory.
    corePath: `${assetBase}core/tesseract-core-${detectOcrCoreVariant()}.wasm.js`,
    langPath: `${assetBase}lang/`,
    logger(message) {
      if (!message.status.includes("recogniz")) return;
      options.onProgress?.({
        stage: "recognizing-page",
        pageNumber: activePageNumber,
        completedPages: activeCompletedPages,
        totalPages: request.pageNumbers.length,
        progress: message.progress,
      });
    },
  });
  const terminateOnAbort = () => {
    void worker.terminate();
  };
  options.signal?.addEventListener("abort", terminateOnAbort, { once: true });
  const recognizePage: PdfPageOcrRecognizer = async (page, pageInput) => {
    if (pageInput.signal?.aborted) throw new DOMException("OCR cancelled", "AbortError");
    if (!page.render) throw new Error("This browser cannot render PDF pages for OCR.");
    activePageNumber = pageInput.pageNumber;
    activeCompletedPages = pageInput.completedPages;
    pageInput.onProgress?.({
      stage: "rendering-page",
      pageNumber: pageInput.pageNumber,
      completedPages: pageInput.completedPages,
      totalPages: pageInput.totalPages,
      progress: 0,
    });
    const baseViewport = page.getViewport({ scale: 1 });
    const longEdge = Math.max(baseViewport.width, baseViewport.height);
    let scale = Math.max(MIN_OCR_SCALE, Math.min(3, MAX_OCR_LONG_EDGE / Math.max(1, longEdge)));
    let viewport = page.getViewport({ scale });
    const pixelCount = viewport.width * viewport.height;
    if (pixelCount > MAX_OCR_PIXELS) {
      scale *= Math.sqrt(MAX_OCR_PIXELS / pixelCount);
      viewport = page.getViewport({ scale });
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const renderTask = page.render({ canvas, viewport, annotationMode: 0, intent: "display" });
    const cancelRender = () => renderTask.cancel?.();
    pageInput.signal?.addEventListener("abort", cancelRender, { once: true });
    try {
      await renderTask.promise;
      pageInput.onProgress?.({
        stage: "recognizing-page",
        pageNumber: pageInput.pageNumber,
        completedPages: pageInput.completedPages,
        totalPages: pageInput.totalPages,
        progress: 0,
      });
      const result = await worker.recognize(canvas, { rotateAuto: true });
      return { text: result.data.text, confidence: result.data.confidence };
    } finally {
      pageInput.signal?.removeEventListener("abort", cancelRender);
      canvas.width = 1;
      canvas.height = 1;
    }
  };

  try {
    return await convertPdfFileWithOcrAndLibrary(
      fileName,
      input,
      request,
      pdfjs as unknown as PdfJsLibrary,
      recognizePage,
      options,
    );
  } finally {
    options.signal?.removeEventListener("abort", terminateOnAbort);
    await worker.terminate().catch(() => undefined);
  }
}
