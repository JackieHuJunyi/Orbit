import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFPageProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { PDFDocument } from "pdf-lib";
import {
  parsePdfPageSequence,
  type PdfCoreToolOptions,
  type PdfToolInputFile,
  type PdfToolOutputFile,
} from "./pdf-core-tools";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_RENDER_PAGES = 100;
const MAX_EXTRACTED_IMAGES = 200;
const MAX_RENDER_EDGE = 2_400;
const textEncoder = new TextEncoder();

function loadingTask(bytes: Uint8Array) {
  return pdfjs.getDocument({
    data: bytes.slice(),
    disableAutoFetch: true,
    disableRange: true,
    disableStream: true,
    isEvalSupported: false,
    stopAtErrors: true,
    useSystemFonts: true,
  } as unknown as Parameters<typeof pdfjs.getDocument>[0]);
}

async function renderPage(page: PDFPageProxy) {
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2, MAX_RENDER_EDGE / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  await page.render({ canvas, viewport, annotationMode: 0, intent: "display" }).promise;
  return { canvas, base };
}

async function canvasPng(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Orbit could not encode this PDF page."))),
      "image/png",
    ),
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  canvas.width = 1;
  canvas.height = 1;
  return bytes;
}

export async function renderPdfPagesToPng(
  input: PdfToolInputFile,
  options: PdfCoreToolOptions,
): Promise<PdfToolOutputFile[]> {
  const task = loadingTask(input.bytes);
  try {
    const pdf = await task.promise;
    const pages = parsePdfPageSequence(options.pages, pdf.numPages);
    if (pages.length > MAX_RENDER_PAGES) throw new Error(`Render at most ${MAX_RENDER_PAGES} pages at once.`);
    const output: PdfToolOutputFile[] = [];
    for (const pageIndex of pages) {
      const page = await pdf.getPage(pageIndex + 1);
      const { canvas } = await renderPage(page);
      output.push({
        name: `${input.name.replace(/\.pdf$/iu, "")}-page-${pageIndex + 1}.png`,
        bytes: await canvasPng(canvas),
        type: "image/png",
      });
      page.cleanup();
    }
    return output;
  } finally {
    await task.destroy();
  }
}

async function pdfTextFacts(input: PdfToolInputFile) {
  const task = loadingTask(input.bytes);
  try {
    const pdf = await task.promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .flatMap((item) => ("str" in item && typeof item.str === "string" ? [item.str] : []))
          .join(" ")
          .replace(/\s+/gu, " ")
          .trim(),
      );
      page.cleanup();
    }
    return { pageCount: pdf.numPages, pages };
  } finally {
    await task.destroy();
  }
}

export async function comparePdfFiles(inputs: readonly PdfToolInputFile[]): Promise<PdfToolOutputFile[]> {
  if (inputs.length !== 2) throw new Error("Choose exactly two PDFs to compare.");
  const [left, right] = await Promise.all(inputs.map(pdfTextFacts));
  const pageCount = Math.max(left.pageCount, right.pageCount);
  const pages = Array.from({ length: pageCount }, (_, index) => {
    const before = left.pages[index] ?? "";
    const after = right.pages[index] ?? "";
    return {
      page: index + 1,
      status: before === after ? "unchanged" : !before ? "added" : !after ? "removed" : "changed",
      beforeCharacters: before.length,
      afterCharacters: after.length,
    };
  });
  return [
    {
      name: `${inputs[0].name.replace(/\.pdf$/iu, "")}-comparison.json`,
      bytes: textEncoder.encode(`${JSON.stringify({ left: inputs[0].name, right: inputs[1].name, pages }, null, 2)}\n`),
      type: "application/json",
    },
  ];
}

function resolvedPageObject(page: PDFPageProxy, name: string) {
  return new Promise<unknown>((resolve, reject) => {
    try {
      const immediate = page.objs.get(name, resolve);
      if (immediate) resolve(immediate);
    } catch (error) {
      reject(error);
    }
  });
}

async function rasterObjectPng(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const image = value as { width?: unknown; height?: unknown; data?: unknown; bitmap?: unknown };
  const width = Number(image.width);
  const height = Number(image.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 20_000_000) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  if (typeof ImageBitmap !== "undefined" && image.bitmap instanceof ImageBitmap) {
    context.drawImage(image.bitmap, 0, 0);
  } else if (image.data instanceof Uint8Array || image.data instanceof Uint8ClampedArray) {
    const source = image.data;
    const rgba = new Uint8ClampedArray(width * height * 4);
    const channels = source.length / (width * height);
    if (![1, 3, 4].includes(channels)) return null;
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      const target = pixel * 4;
      if (channels === 1) {
        rgba[target] = source[pixel];
        rgba[target + 1] = source[pixel];
        rgba[target + 2] = source[pixel];
        rgba[target + 3] = 255;
      } else {
        rgba[target] = source[pixel * channels];
        rgba[target + 1] = source[pixel * channels + 1];
        rgba[target + 2] = source[pixel * channels + 2];
        rgba[target + 3] = channels === 4 ? source[pixel * channels + 3] : 255;
      }
    }
    context.putImageData(new ImageData(rgba, width, height), 0, 0);
  } else {
    return null;
  }
  return canvasPng(canvas);
}

export async function extractPdfImages(input: PdfToolInputFile): Promise<PdfToolOutputFile[]> {
  const task = loadingTask(input.bytes);
  const outputs: PdfToolOutputFile[] = [];
  try {
    const pdf = await task.promise;
    for (let pageNumber = 1; pageNumber <= pdf.numPages && outputs.length < MAX_EXTRACTED_IMAGES; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const operators = await page.getOperatorList();
      for (let index = 0; index < operators.fnArray.length && outputs.length < MAX_EXTRACTED_IMAGES; index += 1) {
        const operator = operators.fnArray[index];
        if (operator !== pdfjs.OPS.paintImageXObject && operator !== pdfjs.OPS.paintInlineImageXObject) {
          continue;
        }
        const argument = operators.argsArray[index]?.[0];
        const value = typeof argument === "string" ? await resolvedPageObject(page, argument) : argument;
        const bytes = await rasterObjectPng(value);
        if (!bytes) continue;
        outputs.push({
          name: `${input.name.replace(/\.pdf$/iu, "")}-page-${pageNumber}-image-${outputs.length + 1}.png`,
          bytes,
          type: "image/png",
        });
      }
      page.cleanup();
    }
    if (!outputs.length) throw new Error("No extractable raster images were found in this PDF.");
    return outputs;
  } finally {
    await task.destroy();
  }
}

export async function redactPdf(input: PdfToolInputFile, options: PdfCoreToolOptions): Promise<PdfToolOutputFile[]> {
  const source = await PDFDocument.load(input.bytes, { updateMetadata: false });
  const selected = new Set(parsePdfPageSequence(options.pages, source.getPageCount()));
  const task = loadingTask(input.bytes);
  try {
    const rendered = await task.promise;
    const output = await PDFDocument.create();
    for (let pageIndex = 0; pageIndex < source.getPageCount(); pageIndex += 1) {
      if (!selected.has(pageIndex)) {
        const [copied] = await output.copyPages(source, [pageIndex]);
        output.addPage(copied);
        continue;
      }
      const page = await rendered.getPage(pageIndex + 1);
      const { canvas, base } = await renderPage(page);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot render a secure redaction.");
      const x = Math.max(0, Math.min(100, options.x ?? 10)) / 100;
      const y = Math.max(0, Math.min(100, options.y ?? 10)) / 100;
      const width = Math.max(1, Math.min(100 - x * 100, options.width ?? 30)) / 100;
      const height = Math.max(1, Math.min(100 - y * 100, options.height ?? 10)) / 100;
      context.fillStyle = "#000";
      context.fillRect(x * canvas.width, y * canvas.height, width * canvas.width, height * canvas.height);
      const png = await output.embedPng(await canvasPng(canvas));
      const newPage = output.addPage([base.width, base.height]);
      newPage.drawImage(png, { x: 0, y: 0, width: base.width, height: base.height });
      page.cleanup();
    }
    return [
      {
        name: `${input.name.replace(/\.pdf$/iu, "")}-redacted.pdf`,
        bytes: await output.save({ addDefaultPage: false, objectsPerTick: 25, useObjectStreams: true }),
        type: "application/pdf",
      },
    ];
  } finally {
    await task.destroy();
  }
}
