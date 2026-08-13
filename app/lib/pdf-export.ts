import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  StandardFonts,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  rgb,
} from "pdf-lib";
import { compileArtifactSource } from "./bindings.ts";
import { chartLinePoints, resolveChartModel, type ChartModel } from "./charts.ts";
import { parseDeckSource, type DeckSlide } from "./deck.ts";
import { safeExportBaseName, type ArtifactExportResult } from "./export-contract.ts";
import { extractRuneAssetIds, parseRuneMarkdownImage, runeImageAssetMap, type RuneExportImageAsset } from "./local-assets.ts";
import { parseMarkdownBlocks, type MarkdownBlock } from "./office-export.ts";
import type { WorkspaceQuerySnapshot } from "./query-snapshot.ts";
import { parseDataSource, type WorkspaceArtifact } from "./workspace.ts";

export const RUNE_PDF_FONT_PATH = "/fonts/rune-unifont.woff2";
export const MAX_PDF_EXPORT_BYTES = 12 * 1024 * 1024;
export const MAX_PDF_FONT_BYTES = 4 * 1024 * 1024;

export type PdfExportResult = ArtifactExportResult<"pdf">;

const FIXED_PDF_DATE = new Date("2000-01-01T00:00:00.000Z");
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const DECK_WIDTH = 960;
const DECK_HEIGHT = 540;
const CHART_TOKEN = /^\s*\{\{\s*chart\(["']([a-z0-9_.-]+)["']\)\s*\}\}\s*$/i;
const COLORS = {
  ink: rgb(0.094, 0.13, 0.11),
  muted: rgb(0.384, 0.439, 0.408),
  paper: rgb(0.957, 0.945, 0.91),
  white: rgb(1, 1, 1),
  accent: rgb(1, 0.361, 0.208),
  line: rgb(0.847, 0.831, 0.784),
  darkPaper: rgb(0.09, 0.125, 0.106),
  darkInk: rgb(0.961, 0.945, 0.91),
  darkMuted: rgb(0.663, 0.71, 0.678),
};

type PdfTheme = {
  paper: ReturnType<typeof rgb>;
  ink: ReturnType<typeof rgb>;
  muted: ReturnType<typeof rgb>;
  line: ReturnType<typeof rgb>;
};

type TextOptions = {
  size: number;
  maxWidth: number;
  maxLines?: number;
};

type PdfFonts = {
  font: PDFFont;
  unicodeFont: PDFFont;
};

function unique(values: Iterable<string>) {
  return [...new Set(values)];
}

function validateFontBytes(bytes: Uint8Array) {
  if (!bytes.length) throw new Error("Rune's PDF font asset is empty.");
  if (bytes.length > MAX_PDF_FONT_BYTES) throw new Error("Rune's PDF font asset exceeds the 4 MB safety limit.");
  if (String.fromCharCode(...bytes.slice(0, 4)) !== "wOF2") throw new Error("Rune's PDF font asset is not a valid WOFF2 file.");
}

export async function loadRunePdfFont() {
  const response = await fetch(RUNE_PDF_FONT_PATH, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Rune could not load its local PDF font (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  validateFontBytes(bytes);
  return bytes;
}

function plainInline(source: string, warnings: Set<string>) {
  let result = source;
  result = result.replace(/\{\{\s*chart\(["']([a-z0-9_.-]+)["']\)\s*\}\}/gi, (_token, chartId: string) => {
    warnings.add("Inline chart references use a visible marker in PDF export; put the chart on its own line to render its current-data snapshot.");
    return `[Chart: ${chartId}]`;
  });
  result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_token, alt: string) => {
    warnings.add("Markdown images are represented by their alt text in fixed PDF export.");
    return alt ? `[Image: ${alt}]` : "[Image]";
  });
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, (_token, label: string) => {
    warnings.add("Markdown links remain readable text but are not interactive in fixed PDF export.");
    return label;
  });
  return result
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(^|[^\\])<[^>]+>/g, "$1")
    .replace(/\\([\\`*_[\]{}#>+!~<>-])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

async function pdfCompatibleImage(asset: RuneExportImageAsset) {
  if (asset.mimeType === "image/png" || asset.mimeType === "image/jpeg") return { bytes: asset.bytes, mimeType: asset.mimeType } as const;
  if (typeof createImageBitmap !== "function") throw new Error(`PDF export cannot decode ${asset.mimeType} on this device; replace ${asset.name} with PNG or JPEG.`);
  const bitmap = await createImageBitmap(new Blob([asset.bytes.slice().buffer as ArrayBuffer], { type: asset.mimeType }));
  try {
    let blob: Blob;
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Rune could not prepare the image canvas for PDF export.");
      context.drawImage(bitmap, 0, 0);
      blob = await canvas.convertToBlob({ type: "image/png" });
    } else if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Rune could not prepare the image canvas for PDF export.");
      context.drawImage(bitmap, 0, 0);
      blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Rune could not convert the image for PDF export.")), "image/png"));
    } else {
      throw new Error(`PDF export cannot decode ${asset.mimeType} on this device; replace ${asset.name} with PNG or JPEG.`);
    }
    return { bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: "image/png" as const };
  } finally {
    bitmap.close();
  }
}

function safeText(value: string, supported: Set<number>, warnings: Set<string>) {
  let output = "";
  let replaced = false;
  for (const character of value.normalize("NFC").replace(/[\u2010-\u2015]/g, "-")) {
    const code = character.codePointAt(0) ?? 0;
    if (character === "\n" || character === "\t" || supported.has(code)) output += character;
    else {
      output += "?";
      replaced = true;
    }
  }
  if (replaced) warnings.add("Characters unavailable in Rune's embedded Unicode font were replaced with visible question marks.");
  return output;
}

function fontForText(value: string, fonts: PdfFonts) {
  try {
    fonts.font.encodeText(value.replace(/[\t\r\n]/g, " "));
    return fonts.font;
  } catch {
    return fonts.unicodeFont;
  }
}

function splitLongToken(token: string, font: PDFFont, size: number, maxWidth: number) {
  const parts: string[] = [];
  let current = "";
  for (const character of token) {
    if (current && font.widthOfTextAtSize(current + character, size) > maxWidth) {
      parts.push(current);
      current = character;
    } else current += character;
  }
  if (current) parts.push(current);
  return parts;
}

function wrapText(value: string, font: PDFFont, options: TextOptions) {
  const { size, maxWidth, maxLines = Number.POSITIVE_INFINITY } = options;
  const tokens = value.trim().split(/(\s+)/).filter(Boolean).flatMap((token) => (
    font.widthOfTextAtSize(token, size) > maxWidth
      ? splitLongToken(token, font, size, maxWidth)
      : [token]
  ));
  const lines: string[] = [];
  let line = "";
  tokens.forEach((token) => {
    const next = `${line}${token}`;
    if (line.trim() && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(line.trimEnd());
      line = token.trimStart();
    } else line = next;
  });
  if (line.trim() || !lines.length) lines.push(line.trimEnd());
  if (lines.length <= maxLines) return { lines, truncated: false };
  const clipped = lines.slice(0, maxLines);
  let last = clipped[clipped.length - 1].trimEnd();
  while (last && font.widthOfTextAtSize(`${last}...`, size) > maxWidth) last = last.slice(0, -1);
  clipped[clipped.length - 1] = `${last}...`;
  return { lines: clipped, truncated: true };
}

function hexColor(value: string) {
  const match = value.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return match
    ? rgb(Number.parseInt(match[1], 16) / 255, Number.parseInt(match[2], 16) / 255, Number.parseInt(match[3], 16) / 255)
    : COLORS.accent;
}

function assertCompiledSource(
  artifact: WorkspaceArtifact,
  workspace: WorkspaceArtifact[],
  snapshots: WorkspaceQuerySnapshot[],
) {
  const compiled = compileArtifactSource(artifact.source, workspace, snapshots);
  const error = compiled.metricBindingErrors[0]
    ?? compiled.unresolvedQueryMetrics[0]
    ?? compiled.queryMetricRuntimeErrors[0];
  if (error) throw new Error(error);
  if (compiled.unresolved.length) throw new Error(`Resolve missing metric reference before PDF export: ${compiled.unresolved[0]}`);
  if (compiled.pendingQueryMetrics.length) throw new Error(`Run ${compiled.pendingQueryMetrics[0]} before PDF export.`);
  if (compiled.unresolvedCharts.length) throw new Error(`Resolve missing chart reference before PDF export: ${compiled.unresolvedCharts[0]}`);
  return compiled.source;
}

function resolvePdfChart(
  chartId: string,
  workspace: WorkspaceArtifact[],
  snapshots: WorkspaceQuerySnapshot[],
) {
  const chartArtifact = workspace.find((candidate) => candidate.id === chartId && candidate.kind === "chart");
  if (!chartArtifact) throw new Error(`Chart source not found: ${chartId}`);
  const resolution = resolveChartModel(chartArtifact, workspace, parseDataSource, snapshots);
  if (!resolution.model) throw new Error(`Chart ${chartId} could not compile for PDF export: ${resolution.errors[0] ?? "unknown chart error"}`);
  return resolution.model;
}

async function createPdf(title: string, fontBytes: Uint8Array) {
  validateFontBytes(fontBytes);
  const document = await PDFDocument.create({ updateMetadata: false });
  document.registerFontkit(fontkit);
  const [font, unicodeFont] = await Promise.all([
    document.embedFont(StandardFonts.Helvetica),
    document.embedFont(fontBytes, { subset: true }),
  ]);
  document.setTitle(title);
  document.setAuthor("Rune");
  document.setCreator("Rune");
  document.setProducer("Rune browser-local PDF export");
  document.setCreationDate(FIXED_PDF_DATE);
  document.setModificationDate(FIXED_PDF_DATE);
  return { document, font, unicodeFont, supported: new Set(unicodeFont.getCharacterSet()) };
}

function drawLines(
  page: PDFPage,
  lines: string[],
  font: PDFFont,
  x: number,
  y: number,
  size: number,
  lineHeight: number,
  color = COLORS.ink,
) {
  lines.forEach((line, index) => page.drawText(line || " ", {
    x,
    y: y - index * lineHeight,
    size,
    font,
    color,
  }));
  return y - lines.length * lineHeight;
}

type DocumentContext = {
  document: PDFDocument;
  font: PDFFont;
  unicodeFont: PDFFont;
  supported: Set<number>;
  warnings: Set<string>;
  artifactName: string;
  workspace: WorkspaceArtifact[];
  snapshots: WorkspaceQuerySnapshot[];
  page: PDFPage;
  y: number;
  pages: PDFPage[];
  images: Map<string, { asset: RuneExportImageAsset; image: PDFImage }>;
};

function addDocumentPage(context: Omit<DocumentContext, "page" | "y">) {
  const page = context.document.addPage([A4_WIDTH, A4_HEIGHT]);
  page.drawRectangle({ x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT, color: COLORS.white });
  page.drawText("RUNE", { x: 48, y: A4_HEIGHT - 42, size: 8, font: context.font, color: COLORS.accent });
  const title = safeText(context.artifactName, context.supported, context.warnings);
  const titleFont = fontForText(title, context);
  const titleLine = wrapText(title, titleFont, { size: 8, maxWidth: 300, maxLines: 1 }).lines[0];
  page.drawText(titleLine, { x: 90, y: A4_HEIGHT - 42, size: 8, font: titleFont, color: COLORS.muted });
  page.drawLine({
    start: { x: 48, y: A4_HEIGHT - 52 },
    end: { x: A4_WIDTH - 48, y: A4_HEIGHT - 52 },
    thickness: 0.6,
    color: COLORS.line,
  });
  context.pages.push(page);
  return { page, y: A4_HEIGHT - 82 };
}

function documentSpace(context: DocumentContext, height: number) {
  if (context.y - height >= 58) return;
  const next = addDocumentPage(context);
  context.page = next.page;
  context.y = next.y;
}

function drawDocumentImage(context: DocumentContext, reference: { id: string; alt: string }) {
  const embedded = context.images.get(reference.id);
  if (!embedded) throw new Error(`Referenced local image is missing or corrupt: ${reference.id}`);
  const maxWidth = A4_WIDTH - 96;
  const maxHeight = A4_HEIGHT - 170;
  const naturalWidth = embedded.image.width * 0.75;
  const naturalHeight = embedded.image.height * 0.75;
  const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1);
  const width = Math.max(1, naturalWidth * scale);
  const height = Math.max(1, naturalHeight * scale);
  const caption = reference.alt || embedded.asset.name;
  const captionText = safeText(caption, context.supported, context.warnings);
  const captionFont = fontForText(captionText, context);
  const captionLines = captionText ? wrapText(captionText, captionFont, { size: 7.5, maxWidth, maxLines: 2 }).lines : [];
  const totalHeight = height + (captionLines.length ? captionLines.length * 10 + 10 : 8);
  documentSpace(context, totalHeight);
  context.page.drawImage(embedded.image, { x: 48 + (maxWidth - width) / 2, y: context.y - height, width, height });
  context.y -= height + 7;
  if (captionLines.length) context.y = drawLines(context.page, captionLines, captionFont, 48 + (maxWidth - captionFont.widthOfTextAtSize(captionLines[0], 7.5)) / 2, context.y, 7.5, 10, COLORS.muted) - 7;
  context.warnings.add("Rune local images are embedded as portable, static PDF image snapshots; the content-hash source reference remains only in canonical Markdown.");
}

function documentText(
  context: DocumentContext,
  source: string,
  options: { size: number; lineHeight: number; indent?: number; color?: ReturnType<typeof rgb>; gap?: number },
) {
  const indent = options.indent ?? 0;
  const text = safeText(plainInline(source, context.warnings), context.supported, context.warnings);
  const textFont = fontForText(text, context);
  const wrapped = wrapText(text, textFont, {
    size: options.size,
    maxWidth: A4_WIDTH - 96 - indent,
  });
  documentSpace(context, wrapped.lines.length * options.lineHeight + (options.gap ?? 8));
  context.y = drawLines(
    context.page,
    wrapped.lines,
    textFont,
    48 + indent,
    context.y,
    options.size,
    options.lineHeight,
    options.color,
  ) - (options.gap ?? 8);
}

function drawDocumentTable(context: DocumentContext, block: Extract<MarkdownBlock, { type: "table" }>) {
  const originalColumns = Math.max(...block.rows.map((row) => row.length), 0);
  const columnCount = Math.min(originalColumns, 8);
  if (!columnCount) return;
  if (originalColumns > columnCount) context.warnings.add("Wide Markdown tables are limited to eight visible columns in fixed PDF export.");
  const tableWidth = A4_WIDTH - 96;
  const columnWidth = tableWidth / columnCount;
  const size = columnCount > 5 ? 6.5 : 8;
  const lineHeight = size + 2.5;
  const renderRow = (row: string[], rowIndex: number) => {
    const cells = Array.from({ length: columnCount }, (_, index) => {
      const text = safeText(plainInline(row[index] ?? "", context.warnings), context.supported, context.warnings);
      const textFont = fontForText(text, context);
      const wrapped = wrapText(text, textFont, { size, maxWidth: columnWidth - 10, maxLines: 3 });
      if (wrapped.truncated) context.warnings.add("Long table cells were visibly shortened to fit the fixed PDF page.");
      return { lines: wrapped.lines, font: textFont };
    });
    const rowHeight = Math.max(...cells.map((cell) => cell.lines.length), 1) * lineHeight + 10;
    documentSpace(context, rowHeight + 4);
    context.page.drawRectangle({
      x: 48,
      y: context.y - rowHeight + 4,
      width: tableWidth,
      height: rowHeight,
      color: rowIndex === 0 ? COLORS.paper : COLORS.white,
      borderColor: COLORS.line,
      borderWidth: 0.5,
    });
    cells.forEach((cell, columnIndex) => {
      const x = 53 + columnIndex * columnWidth;
      drawLines(context.page, cell.lines, cell.font, x, context.y - 6, size, lineHeight, rowIndex === 0 ? COLORS.ink : COLORS.muted);
      if (columnIndex > 0) context.page.drawLine({
        start: { x: 48 + columnIndex * columnWidth, y: context.y + 4 },
        end: { x: 48 + columnIndex * columnWidth, y: context.y - rowHeight + 4 },
        thickness: 0.35,
        color: COLORS.line,
      });
    });
    context.y -= rowHeight;
  };
  block.rows.forEach(renderRow);
  context.y -= 12;
}

function drawPdfChart(
  page: PDFPage,
  model: ChartModel,
  context: PdfFonts & { supported: Set<number>; warnings: Set<string> },
  box: { x: number; y: number; width: number; height: number },
  theme: PdfTheme,
) {
  page.drawRectangle({
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    color: theme.paper,
    borderColor: theme.line,
    borderWidth: 0.7,
  });
  const title = safeText(model.spec.title, context.supported, context.warnings);
  const titleFont = fontForText(title, context);
  const titleLines = wrapText(title, titleFont, { size: 11, maxWidth: box.width - 24, maxLines: 1 });
  drawLines(page, titleLines.lines, titleFont, box.x + 12, box.y + box.height - 20, 11, 13, theme.ink);
  const description = safeText(model.spec.description || `${model.spec.value} by ${model.spec.category}`, context.supported, context.warnings);
  const descriptionFont = fontForText(description, context);
  const descriptionLines = wrapText(description, descriptionFont, { size: 6.5, maxWidth: box.width - 24, maxLines: 2 });
  drawLines(page, descriptionLines.lines, descriptionFont, box.x + 12, box.y + box.height - 36, 6.5, 8, theme.muted);
  if (model.spec.mark === "line") {
    const plotX = box.x + 20;
    const plotWidth = Math.max(40, box.width - 40);
    const plotBottom = box.y + 35;
    const plotTop = box.y + box.height - 58;
    const plotHeight = Math.max(30, plotTop - plotBottom);
    [0, 0.5, 1].forEach((position) => {
      const y = plotBottom + position * plotHeight;
      page.drawLine({ start: { x: plotX, y }, end: { x: plotX + plotWidth, y }, thickness: 0.5, color: theme.line });
    });
    const points = chartLinePoints(model).map((point) => ({
      point,
      x: plotX + point.x * plotWidth,
      y: plotTop - point.y * plotHeight,
    }));
    points.slice(1).forEach((current, index) => {
      page.drawLine({
        start: { x: points[index].x, y: points[index].y },
        end: { x: current.x, y: current.y },
        thickness: 2.2,
        color: hexColor(model.spec.color),
      });
    });
    const labelStep = Math.max(1, Math.ceil(points.length / 8));
    points.forEach(({ point, x, y }, index) => {
      page.drawCircle({ x, y, size: 3.5, color: theme.paper, borderColor: hexColor(model.spec.color), borderWidth: 1.7 });
      if (index % labelStep !== 0 && index !== points.length - 1) return;
      const label = safeText(point.datum.label, context.supported, context.warnings);
      const value = safeText(point.datum.formatted, context.supported, context.warnings);
      const labelFont = fontForText(label, context);
      const valueFont = fontForText(value, context);
      const columnWidth = Math.min(72, plotWidth / Math.min(points.length, 8));
      const labelLine = wrapText(label, labelFont, { size: 5.5, maxWidth: columnWidth, maxLines: 1 }).lines[0];
      const valueLine = wrapText(value, valueFont, { size: 5.5, maxWidth: columnWidth, maxLines: 1 }).lines[0];
      const labelX = Math.max(box.x + 4, Math.min(box.x + box.width - columnWidth - 4, x - columnWidth / 2));
      page.drawText(labelLine, { x: labelX, y: box.y + 13, size: 5.5, font: labelFont, color: theme.muted });
      page.drawText(valueLine, { x: labelX, y: Math.min(plotTop + 6, y + 7), size: 5.5, font: valueFont, color: theme.ink });
    });
    return;
  }
  const rowsTop = box.y + box.height - 55;
  const rowHeight = Math.min(19, (box.height - 68) / Math.max(model.data.length, 1));
  const labelWidth = Math.min(90, box.width * 0.24);
  const valueWidth = Math.min(68, box.width * 0.2);
  const trackX = box.x + 14 + labelWidth;
  const trackWidth = Math.max(40, box.width - labelWidth - valueWidth - 34);
  model.data.forEach((datum, index) => {
    const y = rowsTop - index * rowHeight;
    const label = safeText(datum.label, context.supported, context.warnings);
    const value = safeText(datum.formatted, context.supported, context.warnings);
    const labelFont = fontForText(label, context);
    const valueFont = fontForText(value, context);
    const labelLine = wrapText(label, labelFont, { size: 6.7, maxWidth: labelWidth - 6, maxLines: 1 }).lines[0];
    const valueLine = wrapText(value, valueFont, { size: 6.7, maxWidth: valueWidth - 4, maxLines: 1 }).lines[0];
    page.drawText(labelLine, { x: box.x + 12, y: y - 5, size: 6.7, font: labelFont, color: theme.muted });
    page.drawRectangle({ x: trackX, y: y - 4, width: trackWidth, height: 5, color: theme.line });
    page.drawRectangle({ x: trackX, y: y - 4, width: Math.max(1.5, trackWidth * datum.ratio), height: 5, color: hexColor(model.spec.color) });
    page.drawText(valueLine, { x: trackX + trackWidth + 8, y: y - 5, size: 6.7, font: valueFont, color: theme.ink });
  });
}

function drawDocumentChart(context: DocumentContext, chartId: string) {
  const model = resolvePdfChart(chartId, context.workspace, context.snapshots);
  const height = Math.min(260, 84 + Math.max(model.data.length, 1) * 22);
  documentSpace(context, height + 18);
  drawPdfChart(
    context.page,
    model,
    context,
    { x: 48, y: context.y - height, width: A4_WIDTH - 96, height },
    { paper: COLORS.paper, ink: COLORS.ink, muted: COLORS.muted, line: COLORS.line },
  );
  context.y -= height + 18;
  context.warnings.add("Charts are frozen as vector snapshots of the exact current workspace data used for this PDF.");
}

async function renderDocumentPdf(
  artifact: WorkspaceArtifact,
  workspace: WorkspaceArtifact[],
  snapshots: WorkspaceQuerySnapshot[],
  fontBytes: Uint8Array,
  imageAssets: readonly RuneExportImageAsset[],
) {
  const warnings = new Set<string>([
    "Document pages use a fixed A4 layout; review page breaks before external handoff.",
    "PDF export preserves semantic text and tables but not editable Markdown structure.",
  ]);
  const source = assertCompiledSource(artifact, workspace, snapshots);
  const { document, font, unicodeFont, supported } = await createPdf(artifact.name, fontBytes);
  const verifiedImages = runeImageAssetMap(imageAssets);
  const referencedImageIds = parseMarkdownBlocks(source).flatMap((block) => block.type === "paragraph" ? [parseRuneMarkdownImage(block.source)?.id].filter((id): id is string => Boolean(id)) : []);
  const inlineImage = extractRuneAssetIds(source).find((id) => !referencedImageIds.includes(id));
  if (inlineImage) throw new Error("Place each Rune local image on its own Markdown line before PDF export.");
  const unexpectedImage = imageAssets.find((asset) => !referencedImageIds.includes(asset.id));
  if (unexpectedImage) throw new Error(`Rune export image is not referenced by this Document: ${unexpectedImage.id}`);
  const images = new Map<string, { asset: RuneExportImageAsset; image: PDFImage }>();
  for (const [id, asset] of verifiedImages) {
    const compatible = await pdfCompatibleImage(asset);
    const image = compatible.mimeType === "image/png" ? await document.embedPng(compatible.bytes) : await document.embedJpg(compatible.bytes);
    images.set(id, { asset, image });
  }
  const pages: PDFPage[] = [];
  const first = addDocumentPage({ document, font, unicodeFont, supported, warnings, artifactName: artifact.name, workspace, snapshots, pages, images });
  const context: DocumentContext = {
    document,
    font,
    unicodeFont,
    supported,
    warnings,
    artifactName: artifact.name,
    workspace,
    snapshots,
    pages,
    images,
    page: first.page,
    y: first.y,
  };
  parseMarkdownBlocks(source).forEach((block) => {
    if (block.type === "paragraph") {
      const imageReference = parseRuneMarkdownImage(block.source);
      if (imageReference) {
        drawDocumentImage(context, imageReference);
        return;
      }
      const chart = block.source.match(CHART_TOKEN);
      if (chart) drawDocumentChart(context, chart[1]);
      else documentText(context, block.source, { size: 10, lineHeight: 15, color: COLORS.ink, gap: 10 });
      return;
    }
    if (block.type === "heading") {
      const size = block.level === 1 ? 25 : block.level === 2 ? 17 : block.level === 3 ? 13 : 11;
      const lineHeight = size * 1.18;
      const text = safeText(plainInline(block.source, warnings), supported, warnings);
      const textFont = fontForText(text, context);
      const wrapped = wrapText(text, textFont, { size, maxWidth: A4_WIDTH - 96 });
      documentSpace(context, wrapped.lines.length * lineHeight + (block.level <= 2 ? 24 : 16));
      context.y -= block.level === 1 ? 4 : 8;
      context.y = drawLines(context.page, wrapped.lines, textFont, 48, context.y, size, lineHeight, COLORS.ink) - 10;
      if (block.level === 1) {
        context.page.drawRectangle({ x: 48, y: context.y + 2, width: 42, height: 2.5, color: COLORS.accent });
        context.y -= 10;
      }
      return;
    }
    if (block.type === "quote") {
      const text = safeText(plainInline(block.source, warnings), supported, warnings);
      const textFont = fontForText(text, context);
      const wrapped = wrapText(text, textFont, { size: 9.5, maxWidth: A4_WIDTH - 124 });
      const height = wrapped.lines.length * 14 + 14;
      documentSpace(context, height + 10);
      context.page.drawRectangle({ x: 48, y: context.y - height + 8, width: 3, height, color: COLORS.accent });
      context.y = drawLines(context.page, wrapped.lines, textFont, 62, context.y - 2, 9.5, 14, COLORS.muted) - 12;
      return;
    }
    if (block.type === "list") {
      const prefix = block.ordered ? "1." : "•";
      documentText(context, `${prefix} ${block.source}`, {
        size: 9.5,
        lineHeight: 14,
        indent: 12 + Math.min(block.level, 4) * 10,
        color: COLORS.ink,
        gap: 4,
      });
      return;
    }
    if (block.type === "code") {
      const codeText = safeText(block.source || " ", supported, warnings);
      const codeFont = fontForText(codeText, context);
      const lines = codeText.split("\n").flatMap((line) => wrapText(line || " ", codeFont, {
        size: 7.2,
        maxWidth: A4_WIDTH - 120,
      }).lines);
      let offset = 0;
      while (offset < lines.length) {
        const capacity = Math.max(1, Math.floor((context.y - 72) / 11));
        const visible = lines.slice(offset, offset + capacity);
        const height = visible.length * 11 + 16;
        documentSpace(context, height + 8);
        context.page.drawRectangle({ x: 48, y: context.y - height + 6, width: A4_WIDTH - 96, height, color: COLORS.paper, borderColor: COLORS.line, borderWidth: 0.5 });
        context.y = drawLines(context.page, visible, codeFont, 58, context.y - 5, 7.2, 11, COLORS.ink) - 10;
        offset += visible.length;
      }
      return;
    }
    if (block.type === "table") drawDocumentTable(context, block);
  });
  pages.forEach((page, index) => {
    const label = `${index + 1} / ${pages.length}`;
    page.drawLine({ start: { x: 48, y: 42 }, end: { x: A4_WIDTH - 48, y: 42 }, thickness: 0.5, color: COLORS.line });
    page.drawText("Generated locally by Rune", { x: 48, y: 27, size: 6.5, font, color: COLORS.muted });
    page.drawText(label, { x: A4_WIDTH - 48 - font.widthOfTextAtSize(label, 6.5), y: 27, size: 6.5, font, color: COLORS.muted });
  });
  const bytes = await document.save({ addDefaultPage: false, updateFieldAppearances: false });
  return { bytes, warnings: unique(warnings) };
}

async function renderDataPdf(
  artifact: WorkspaceArtifact,
  fontBytes: Uint8Array,
) {
  const parsed = parseDataSource(artifact.source);
  if (parsed.errors.length) throw new Error(parsed.errors[0]);
  if (!parsed.columns.length) throw new Error("Add at least one Data column before PDF export.");
  if (parsed.columns.length > 12) throw new Error("Table PDF export supports at most 12 Data columns.");
  if (parsed.rows.length > 5_000) throw new Error("Table PDF export supports at most 5,000 Data rows.");

  const warnings = new Set<string>([
    "Data PDF uses a fixed landscape A4 table; review column widths, wrapping, and page breaks before external handoff.",
    "The PDF is a readable snapshot of canonical Data and does not retain CSV/JSON types, formulas, filters, or live bindings.",
  ]);
  const { document, font, unicodeFont, supported } = await createPdf(artifact.name, fontBytes);
  const width = A4_HEIGHT;
  const height = A4_WIDTH;
  const left = 34;
  const right = 34;
  const top = 58;
  const bottom = 38;
  const tableWidth = width - left - right;
  const columnWidth = tableWidth / parsed.columns.length;
  const rowHeight = 25;
  const headerHeight = 31;
  const pages: PDFPage[] = [];

  function addPage() {
    const page = document.addPage([width, height]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: 0, width, height, color: COLORS.white });
    page.drawText("RUNE", { x: left, y: height - 30, size: 8, font, color: COLORS.accent });
    const title = safeText(artifact.name, supported, warnings);
    const titleFont = fontForText(title, { font, unicodeFont });
    page.drawText(wrapText(title, titleFont, { size: 8, maxWidth: width - 150, maxLines: 1 }).lines[0], {
      x: left + 42,
      y: height - 30,
      size: 8,
      font: titleFont,
      color: COLORS.muted,
    });
    const headerY = height - top - headerHeight;
    parsed.columns.forEach((column, columnIndex) => {
      const x = left + columnIndex * columnWidth;
      page.drawRectangle({ x, y: headerY, width: columnWidth, height: headerHeight, color: COLORS.paper, borderColor: COLORS.line, borderWidth: 0.5 });
      const text = safeText(column, supported, warnings);
      const textFont = fontForText(text, { font, unicodeFont });
      const wrapped = wrapText(text, textFont, { size: 7.5, maxWidth: columnWidth - 10, maxLines: 2 });
      if (wrapped.truncated) warnings.add("Some table headings were visibly shortened to fit the fixed PDF columns.");
      drawLines(page, wrapped.lines, textFont, x + 5, headerY + headerHeight - 11, 7.5, 9, COLORS.ink);
    });
    return { page, y: headerY };
  }

  let current = addPage();
  parsed.rows.forEach((row, rowIndex) => {
    if (current.y - rowHeight < bottom) current = addPage();
    const rowY = current.y - rowHeight;
    parsed.columns.forEach((column, columnIndex) => {
      const x = left + columnIndex * columnWidth;
      current.page.drawRectangle({
        x,
        y: rowY,
        width: columnWidth,
        height: rowHeight,
        color: rowIndex % 2 ? rgb(0.985, 0.982, 0.971) : COLORS.white,
        borderColor: COLORS.line,
        borderWidth: 0.35,
      });
      const value = row[column] == null ? "" : String(row[column]);
      const text = safeText(value, supported, warnings);
      const textFont = fontForText(text, { font, unicodeFont });
      const wrapped = wrapText(text, textFont, { size: 7, maxWidth: columnWidth - 10, maxLines: 2 });
      if (wrapped.truncated) warnings.add("Some long Data cells were visibly shortened to fit the fixed PDF columns.");
      drawLines(current.page, wrapped.lines, textFont, x + 5, rowY + rowHeight - 10, 7, 8.5, COLORS.ink);
    });
    current.y = rowY;
  });
  pages.forEach((page, index) => {
    const label = `${index + 1} / ${pages.length}`;
    page.drawText(`${parsed.rows.length} rows · ${parsed.columns.length} columns`, { x: left, y: 19, size: 6.5, font, color: COLORS.muted });
    page.drawText(label, { x: width - right - font.widthOfTextAtSize(label, 6.5), y: 19, size: 6.5, font, color: COLORS.muted });
  });
  const bytes = await document.save({ addDefaultPage: false, updateFieldAppearances: false });
  return { bytes, warnings: unique(warnings) };
}

type DeckContext = {
  font: PDFFont;
  unicodeFont: PDFFont;
  supported: Set<number>;
  warnings: Set<string>;
  theme: PdfTheme;
};

function deckPlain(source: string, context: DeckContext) {
  return safeText(plainInline(source, context.warnings), context.supported, context.warnings);
}

function drawDeckWrapped(
  page: PDFPage,
  source: string,
  context: DeckContext,
  options: { x: number; y: number; width: number; size: number; lineHeight: number; maxLines: number; color?: ReturnType<typeof rgb> },
) {
  const text = deckPlain(source, context);
  const textFont = fontForText(text, context);
  const wrapped = wrapText(text, textFont, {
    size: options.size,
    maxWidth: options.width,
    maxLines: options.maxLines,
  });
  if (wrapped.truncated) context.warnings.add("Slide text that exceeded the fixed 16:9 frame was visibly shortened with an ellipsis.");
  return drawLines(
    page,
    wrapped.lines,
    textFont,
    options.x,
    options.y,
    options.size,
    options.lineHeight,
    options.color ?? context.theme.ink,
  );
}

function drawDeckTable(
  page: PDFPage,
  rows: string[][],
  context: DeckContext,
  box: { x: number; y: number; width: number; height: number },
) {
  const columnCount = Math.min(Math.max(...rows.map((row) => row.length), 0), 6);
  if (!columnCount || !rows.length) return;
  if (rows.some((row) => row.length > columnCount)) context.warnings.add("Wide slide tables are limited to six visible columns in fixed PDF export.");
  const visibleRows = rows.slice(0, 8);
  if (rows.length > visibleRows.length) context.warnings.add("Long slide tables are limited to eight visible rows in fixed PDF export.");
  const cellWidth = box.width / columnCount;
  const rowHeight = Math.min(34, box.height / visibleRows.length);
  visibleRows.forEach((row, rowIndex) => {
    const y = box.y + box.height - (rowIndex + 1) * rowHeight;
    page.drawRectangle({
      x: box.x,
      y,
      width: box.width,
      height: rowHeight,
      color: rowIndex === 0 ? context.theme.line : context.theme.paper,
      borderColor: context.theme.line,
      borderWidth: 0.6,
    });
    Array.from({ length: columnCount }, (_, columnIndex) => row[columnIndex] ?? "").forEach((cell, columnIndex) => {
      const text = deckPlain(cell, context);
      const textFont = fontForText(text, context);
      const wrapped = wrapText(text, textFont, { size: 8.5, maxWidth: cellWidth - 14, maxLines: 2 });
      if (wrapped.truncated) context.warnings.add("Long slide table cells were visibly shortened to fit the fixed frame.");
      drawLines(page, wrapped.lines, textFont, box.x + columnIndex * cellWidth + 7, y + rowHeight - 13, 8.5, 10, rowIndex === 0 ? context.theme.ink : context.theme.muted);
      if (columnIndex > 0) page.drawLine({
        start: { x: box.x + columnIndex * cellWidth, y },
        end: { x: box.x + columnIndex * cellWidth, y: y + rowHeight },
        thickness: 0.4,
        color: context.theme.line,
      });
    });
  });
}

function drawMetricCards(page: PDFPage, table: Extract<MarkdownBlock, { type: "table" }>, context: DeckContext) {
  const headers = table.rows[0] ?? [];
  const values = table.rows[1] ?? [];
  const count = Math.min(headers.length, values.length, 4);
  if (!count) return;
  if (headers.length > count || values.length > count) context.warnings.add("Metric slides show at most four metric cards in fixed PDF export.");
  const gap = 16;
  const x = 66;
  const width = (DECK_WIDTH - 132 - gap * (count - 1)) / count;
  Array.from({ length: count }, (_, index) => index).forEach((index) => {
    const cardX = x + index * (width + gap);
    page.drawRectangle({
      x: cardX,
      y: 126,
      width,
      height: 142,
      color: context.theme.paper,
      borderColor: context.theme.line,
      borderWidth: 1,
    });
    drawDeckWrapped(page, values[index] ?? "", context, {
      x: cardX + 18,
      y: 224,
      width: width - 36,
      size: count > 3 ? 22 : 28,
      lineHeight: count > 3 ? 26 : 32,
      maxLines: 2,
      color: context.theme.ink,
    });
    drawDeckWrapped(page, headers[index] ?? "", context, {
      x: cardX + 18,
      y: 158,
      width: width - 36,
      size: 9,
      lineHeight: 12,
      maxLines: 2,
      color: context.theme.muted,
    });
  });
}

function chartIdsFromBlocks(blocks: MarkdownBlock[]) {
  return blocks.flatMap((block) => {
    if (block.type !== "paragraph") return [];
    const match = block.source.match(CHART_TOKEN);
    return match ? [match[1]] : [];
  });
}

function drawDeckBody(
  page: PDFPage,
  blocks: MarkdownBlock[],
  context: DeckContext,
  box: { x: number; y: number; width: number; height: number },
) {
  let y = box.y + box.height;
  const bottom = box.y;
  for (const block of blocks) {
    if (block.type === "heading" || (block.type === "paragraph" && CHART_TOKEN.test(block.source))) continue;
    if (y < bottom + 20) {
      context.warnings.add("Slide content that exceeded the fixed 16:9 frame was omitted after a visible layout boundary.");
      break;
    }
    if (block.type === "table") {
      const tableHeight = Math.min(220, y - bottom);
      drawDeckTable(page, block.rows, context, { x: box.x, y: y - tableHeight, width: box.width, height: tableHeight });
      y -= tableHeight + 14;
      continue;
    }
    const prefix = block.type === "list" ? (block.ordered ? "1. " : "• ") : block.type === "quote" ? "| " : "";
    const source = block.type === "code" ? block.source.replace(/\n/g, "  /  ") : `${prefix}${block.source}`;
    const size = block.type === "code" ? 10 : block.type === "list" ? 13 : 14;
    y = drawDeckWrapped(page, source, context, {
      x: box.x + (block.type === "list" ? 8 : 0),
      y,
      width: box.width - (block.type === "list" ? 8 : 0),
      size,
      lineHeight: size * 1.42,
      maxLines: block.type === "paragraph" ? 4 : 3,
      color: context.theme.muted,
    }) - 10;
  }
}

function drawDeckSlide(
  page: PDFPage,
  slide: DeckSlide,
  index: number,
  total: number,
  workspace: WorkspaceArtifact[],
  snapshots: WorkspaceQuerySnapshot[],
  context: DeckContext,
) {
  page.drawRectangle({ x: 0, y: 0, width: DECK_WIDTH, height: DECK_HEIGHT, color: context.theme.paper });
  page.drawRectangle({ x: 0, y: DECK_HEIGHT - 8, width: DECK_WIDTH, height: 8, color: COLORS.accent });
  const blocks = parseMarkdownBlocks(slide.source);
  const heading = blocks.find((block): block is Extract<MarkdownBlock, { type: "heading" }> => block.type === "heading");
  const body = heading ? blocks.filter((block) => block !== heading) : blocks;
  const chartIds = chartIdsFromBlocks(blocks);
  const chartModels = chartIds.map((id) => resolvePdfChart(id, workspace, snapshots));
  const eyebrow = safeText(slide.eyebrow.toLocaleUpperCase("en-US"), context.supported, context.warnings);
  if (eyebrow) page.drawText(eyebrow, { x: 66, y: 474, size: 10, font: fontForText(eyebrow, context), color: COLORS.accent });
  const number = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  page.drawText(number, {
    x: DECK_WIDTH - 66 - context.font.widthOfTextAtSize(number, 8),
    y: 30,
    size: 8,
    font: context.font,
    color: context.theme.muted,
  });
  if (slide.layout === "cover" || slide.layout === "conclusion") {
    if (heading) drawDeckWrapped(page, heading.source, context, {
      x: 66,
      y: 352,
      width: 820,
      size: 50,
      lineHeight: 56,
      maxLines: 3,
    });
    drawDeckBody(page, body, context, { x: 68, y: 90, width: 650, height: 145 });
    page.drawRectangle({ x: 66, y: 256, width: 64, height: 5, color: COLORS.accent });
    return;
  }
  if (heading) drawDeckWrapped(page, heading.source, context, {
    x: 66,
    y: 418,
    width: slide.layout === "split" ? 420 : 828,
    size: slide.layout === "split" ? 31 : 34,
    lineHeight: slide.layout === "split" ? 36 : 40,
    maxLines: 3,
  });
  if (slide.layout === "metrics") {
    const table = body.find((block): block is Extract<MarkdownBlock, { type: "table" }> => block.type === "table");
    if (table) drawMetricCards(page, table, context);
    drawDeckBody(page, body.filter((block) => block !== table), context, { x: 66, y: 286, width: 828, height: 66 });
    return;
  }
  if (slide.layout === "split") {
    drawDeckBody(page, body, context, { x: 66, y: 85, width: 390, height: 215 });
    if (chartModels[0]) {
      drawPdfChart(page, chartModels[0], context, { x: 500, y: 94, width: 394, height: 312 }, context.theme);
      context.warnings.add("Charts are frozen as vector snapshots of the exact current workspace data used for this PDF.");
    }
    return;
  }
  drawDeckBody(page, body, context, { x: 66, y: 76, width: chartModels.length ? 390 : 828, height: 266 });
  if (chartModels[0]) {
    drawPdfChart(page, chartModels[0], context, { x: 500, y: 78, width: 394, height: 264 }, context.theme);
    context.warnings.add("Charts are frozen as vector snapshots of the exact current workspace data used for this PDF.");
  }
}

async function renderDeckPdf(
  artifact: WorkspaceArtifact,
  workspace: WorkspaceArtifact[],
  snapshots: WorkspaceQuerySnapshot[],
  fontBytes: Uint8Array,
) {
  const warnings = new Set<string>([
    "Deck slides use fixed 16:9 pages; animations, speaker notes, and editable slide objects are not included.",
    "PDF export preserves the reviewed visual handoff, not editable Deck Markdown structure.",
  ]);
  const source = assertCompiledSource(artifact, workspace, snapshots);
  const parsed = parseDeckSource(source);
  if (!parsed.deck) throw new Error(parsed.errors[0] ?? "Deck Markdown could not compile for PDF export.");
  const { document, font, unicodeFont, supported } = await createPdf(parsed.deck.frontmatter.title, fontBytes);
  const dark = parsed.deck.frontmatter.theme === "rune-dark";
  const theme: PdfTheme = dark
    ? { paper: COLORS.darkPaper, ink: COLORS.darkInk, muted: COLORS.darkMuted, line: rgb(0.204, 0.255, 0.224) }
    : { paper: COLORS.paper, ink: COLORS.ink, muted: COLORS.muted, line: COLORS.line };
  const context: DeckContext = { font, unicodeFont, supported, warnings, theme };
  parsed.deck.slides.forEach((slide, index) => {
    const page = document.addPage([DECK_WIDTH, DECK_HEIGHT]);
    drawDeckSlide(page, slide, index, parsed.deck?.slides.length ?? 0, workspace, snapshots, context);
  });
  const bytes = await document.save({ addDefaultPage: false, updateFieldAppearances: false });
  return { bytes, warnings: unique(warnings) };
}

export function isPdfExportArtifact(artifact: WorkspaceArtifact) {
  return artifact.kind === "document"
    || artifact.kind === "data"
    || (artifact.kind === "slides" && artifact.language === "Deck Markdown");
}

export async function exportPdfArtifact(
  artifact: WorkspaceArtifact,
  workspace: WorkspaceArtifact[],
  querySnapshots: WorkspaceQuerySnapshot[] = [],
  providedFontBytes?: Uint8Array,
  imageAssets: readonly RuneExportImageAsset[] = [],
): Promise<PdfExportResult> {
  if (!isPdfExportArtifact(artifact)) throw new Error("Direct PDF export supports Markdown Documents, Data, and Deck Markdown artifacts.");
  const sourceLimit = artifact.kind === "data" ? 2_000_000 : 200_000;
  if (artifact.source.length > sourceLimit) throw new Error(`PDF export is limited to ${sourceLimit.toLocaleString("en-US")} source characters for this artifact.`);
  const fontBytes = providedFontBytes ?? await loadRunePdfFont();
  const rendered = artifact.kind === "document"
    ? await renderDocumentPdf(artifact, workspace, querySnapshots, fontBytes, imageAssets)
    : artifact.kind === "data"
      ? await renderDataPdf(artifact, fontBytes)
      : await renderDeckPdf(artifact, workspace, querySnapshots, fontBytes);
  if (rendered.bytes.length > MAX_PDF_EXPORT_BYTES) throw new Error("The generated PDF exceeds Rune's 12 MB export limit.");
  return {
    bytes: rendered.bytes,
    fileName: `${safeExportBaseName(artifact.name)}.pdf`,
    mimeType: "application/pdf",
    targetType: "pdf",
    warnings: rendered.warnings,
  };
}
