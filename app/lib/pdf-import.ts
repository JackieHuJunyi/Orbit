import type { WorkspaceArtifact } from "./workspace.ts";

export const MAX_PDF_IMPORT_BYTES = 12 * 1024 * 1024;
export const MAX_PDF_IMPORT_PAGES = 200;

const MAX_PDF_TEXT_ITEMS = 100_000;
const MAX_PDF_OUTPUT_CHARS = 200_000;

type PdfTextItem = {
  str: string;
  dir?: string;
  transform?: ArrayLike<number>;
  width?: number;
  height?: number;
  hasEOL?: boolean;
};

type PdfTextContent = {
  items: Array<PdfTextItem | { type: string }>;
};

type PdfPageProxy = {
  getViewport(input: { scale: number }): { width: number; height: number };
  getTextContent(input?: { disableNormalization?: boolean; includeMarkedContent?: boolean }): Promise<PdfTextContent>;
  getAnnotations(input?: { intent?: string }): Promise<unknown[]>;
  cleanup?: () => void;
};

type PdfDocumentProxy = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
  getMetadata(): Promise<{ info?: object }>;
  getOutline(): Promise<unknown[] | null>;
  hasJSActions?: () => Promise<boolean>;
};

type PdfLoadingTask = {
  promise: Promise<PdfDocumentProxy>;
  destroy(): Promise<void>;
  onPassword?: ((updatePassword: (password: string) => void, reason: number) => void) | null;
};

export type PdfJsLibrary = {
  getDocument(input: Record<string, unknown>): PdfLoadingTask;
};

export type PdfImportResult = {
  artifacts: WorkspaceArtifact[];
  warnings: string[];
  sourceType: "pdf";
};

export type PdfTextItemSnapshot = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasEOL: boolean;
  direction: string;
};

export type PdfPageSnapshot = {
  pageNumber: number;
  width: number;
  height: number;
  items: PdfTextItemSnapshot[];
  annotationCount: number;
};

export type PdfSemanticSnapshot = {
  title: string;
  pages: PdfPageSnapshot[];
  outlineCount: number;
  hasJavaScript: boolean;
};

type PdfLine = {
  pageNumber: number;
  pageHeight: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  itemCount: number;
  hasLargeGap: boolean;
};

function toBytes(input: ArrayBuffer | Uint8Array) {
  return input instanceof Uint8Array ? new Uint8Array(input) : new Uint8Array(input.slice(0));
}

function extensionOf(name: string) {
  return name.split(".").pop()?.toLocaleLowerCase("en-US") ?? "";
}

function baseName(name: string) {
  const normalized = name.replaceAll("\\", "/").split("/").pop() ?? name;
  return normalized.replace(/\.pdf$/iu, "") || "Imported PDF";
}

function safeFileSegment(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 72) || "imported-pdf";
}

function stableImportId(fileName: string) {
  return `import-${safeFileSegment(baseName(fileName)).toLocaleLowerCase("en-US")}`;
}

function cleanText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "")
    .replace(/[\t ]+/gu, " ")
    .trim();
}

function safeTitle(value: string, fallback: string) {
  const title = cleanText(value).replace(/[\r\n]+/gu, " ").slice(0, 120);
  return title || cleanText(fallback).slice(0, 120) || "Imported PDF";
}

function escapeMarkdown(value: string) {
  return cleanText(value)
    .replace(/\\/gu, "\\\\")
    .replace(/([`*_[\]#>+!|~<>])/gu, "\\$1")
    .replaceAll("{", "&#123;")
    .replaceAll("}", "&#125;");
}

function signature(bytes: Uint8Array) {
  return new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 1_024)));
}

function validatePdfInput(fileName: string, bytes: Uint8Array) {
  if (extensionOf(fileName) !== "pdf") throw new Error("Choose a PDF file for PDF import.");
  if (!bytes.length || bytes.length > MAX_PDF_IMPORT_BYTES) {
    throw new Error("PDF import is limited to 12 MB per file.");
  }
  if (!signature(bytes).includes("%PDF-")) throw new Error("This file does not contain a valid PDF header.");
}

function isCjk(character: string | undefined) {
  return Boolean(character && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(character));
}

function needsSpace(left: PdfTextItemSnapshot, right: PdfTextItemSnapshot, rtl: boolean) {
  const leftText = left.str.trimEnd();
  const rightText = right.str.trimStart();
  if (!leftText || !rightText || /\s$/u.test(left.str) || /^\s/u.test(right.str)) return false;
  const last = leftText.at(-1);
  const first = rightText[0];
  if (isCjk(last) && isCjk(first)) return false;
  if (/^[,.;:!?%\])}、。，；：！？》」』）】]/u.test(first)) return false;
  if (/[\[({《「『（【]$/u.test(last ?? "")) return false;
  const averageCharacterWidth = leftText.length ? left.width / leftText.length : left.height * 0.5;
  const gap = rtl ? left.x - (right.x + right.width) : right.x - (left.x + left.width);
  return gap > Math.max(0.6, averageCharacterWidth * 0.16);
}

function pageLines(page: PdfPageSnapshot): PdfLine[] {
  const items = page.items
    .filter((item) => cleanText(item.str))
    .sort((left, right) => right.y - left.y || left.x - right.x);
  const groups: Array<{ y: number; height: number; items: PdfTextItemSnapshot[] }> = [];
  items.forEach((item) => {
    const prior = groups.at(-1);
    const tolerance = Math.max(2, Math.min(prior?.height ?? item.height, item.height) * 0.3);
    if (prior && Math.abs(prior.y - item.y) <= tolerance) {
      prior.items.push(item);
      prior.y = (prior.y * (prior.items.length - 1) + item.y) / prior.items.length;
      prior.height = Math.max(prior.height, item.height);
      return;
    }
    groups.push({ y: item.y, height: item.height, items: [item] });
  });

  return groups.flatMap((group) => {
    const rtl = group.items.filter((item) => item.direction === "rtl").length > group.items.length / 2;
    group.items.sort((left, right) => rtl ? right.x - left.x : left.x - right.x);
    let text = "";
    let prior: PdfTextItemSnapshot | null = null;
    let hasLargeGap = false;
    group.items.forEach((item) => {
      if (prior) {
        const gap = rtl ? prior.x - (item.x + item.width) : item.x - (prior.x + prior.width);
        if (Math.abs(gap) > page.width * 0.12) hasLargeGap = true;
        if (needsSpace(prior, item, rtl)) text += " ";
      }
      text += item.str;
      prior = item;
    });
    const cleaned = cleanText(text);
    if (!cleaned) return [];
    const left = Math.min(...group.items.map((item) => item.x));
    const right = Math.max(...group.items.map((item) => item.x + item.width));
    return [{
      pageNumber: page.pageNumber,
      pageHeight: page.height,
      text: cleaned,
      x: left,
      y: group.y,
      width: right - left,
      height: group.height,
      itemCount: group.items.length,
      hasLargeGap,
    }];
  });
}

function repeatedEdgeSignatures(linesByPage: PdfLine[][]) {
  const counts = new Map<string, number>();
  linesByPage.forEach((lines) => {
    const signatures = new Set(lines.flatMap((line) => {
      const atEdge = line.y >= line.pageHeight * 0.88 || line.y <= line.pageHeight * 0.12;
      const signature = line.text.toLocaleLowerCase("en-US").replace(/\d+/gu, "#").replace(/\s+/gu, " ").trim();
      return atEdge && signature ? [signature] : [];
    }));
    signatures.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  });
  const threshold = Math.max(2, Math.ceil(linesByPage.length * 0.5));
  return new Set([...counts].flatMap(([value, count]) => count >= threshold ? [value] : []));
}

function edgeSignature(line: PdfLine) {
  const atEdge = line.y >= line.pageHeight * 0.88 || line.y <= line.pageHeight * 0.12;
  return atEdge
    ? line.text.toLocaleLowerCase("en-US").replace(/\d+/gu, "#").replace(/\s+/gu, " ").trim()
    : "";
}

function weightedMedianFont(lines: PdfLine[]) {
  const samples = lines.flatMap((line) => Array.from({ length: Math.min(200, Math.max(1, line.text.length)) }, () => line.height));
  samples.sort((left, right) => left - right);
  return samples[Math.floor(samples.length / 2)] ?? 12;
}

function headingLevel(line: PdfLine, bodyFontSize: number) {
  if (line.text.length > 180) return 0;
  const ratio = line.height / Math.max(1, bodyFontSize);
  if (ratio >= 1.75) return 2;
  if (ratio >= 1.42) return 3;
  if (ratio >= 1.22) return 4;
  return 0;
}

function bulletLine(text: string) {
  const unordered = text.match(/^\s*(?:[•●▪◦‣⁃*]|[-–—](?=\s))\s*(.+)$/u);
  if (unordered?.[1]) return `- ${escapeMarkdown(unordered[1])}`;
  const ordered = text.match(/^\s*(\d{1,3})[.)]\s+(.+)$/u);
  return ordered?.[2] ? `${ordered[1]}. ${escapeMarkdown(ordered[2])}` : null;
}

function joinParagraph(left: string, right: string) {
  if (/[-‐‑]$/u.test(left) && /^\p{Ll}/u.test(right)) return `${left.slice(0, -1)}${right}`;
  if (isCjk(left.at(-1)) && isCjk(right[0])) return `${left}${right}`;
  return `${left} ${right}`;
}

function markdownForLines(lines: PdfLine[], bodyFontSize: number, title: string, isFirstPage: boolean) {
  const blocks: string[] = [];
  let paragraph = "";
  let previous: PdfLine | null = null;
  const flushParagraph = () => {
    if (paragraph) blocks.push(escapeMarkdown(paragraph));
    paragraph = "";
  };

  lines.forEach((line, index) => {
    if (isFirstPage && index === 0 && cleanText(line.text).toLocaleLowerCase("en-US") === cleanText(title).toLocaleLowerCase("en-US")) {
      previous = line;
      return;
    }
    const bullet = bulletLine(line.text);
    const level = headingLevel(line, bodyFontSize);
    if (bullet) {
      flushParagraph();
      blocks.push(bullet);
      previous = line;
      return;
    }
    if (level) {
      flushParagraph();
      blocks.push(`${"#".repeat(level)} ${escapeMarkdown(line.text)}`);
      previous = line;
      return;
    }

    const verticalGap = previous ? previous.y - line.y : 0;
    const startsNewParagraph = Boolean(previous && (
      verticalGap > Math.max(bodyFontSize * 1.7, previous.height * 1.7)
      || Math.abs(previous.x - line.x) > bodyFontSize * 2.5
    ));
    if (startsNewParagraph) flushParagraph();
    paragraph = paragraph ? joinParagraph(paragraph, line.text) : line.text;
    previous = line;
  });
  flushParagraph();
  return blocks.join("\n\n");
}

export function convertPdfSemanticSnapshot(
  fileName: string,
  snapshot: PdfSemanticSnapshot,
): PdfImportResult {
  if (!snapshot.pages.length) throw new Error("The PDF does not contain any pages.");
  if (snapshot.pages.length > MAX_PDF_IMPORT_PAGES) {
    throw new Error(`PDF import is limited to ${MAX_PDF_IMPORT_PAGES} pages per file.`);
  }
  const title = safeTitle(snapshot.title, baseName(fileName));
  const linesByPage = snapshot.pages.map(pageLines);
  const repeated = repeatedEdgeSignatures(linesByPage);
  let repeatedLineCount = 0;
  const filteredByPage = linesByPage.map((lines) => lines.filter((line) => {
    const remove = repeated.has(edgeSignature(line));
    if (remove) repeatedLineCount += 1;
    return !remove;
  }));
  const allLines = filteredByPage.flat();
  if (!allLines.length) {
    throw new Error("This PDF has no selectable text. Rune does not perform OCR on scanned pages yet.");
  }
  const bodyFontSize = weightedMedianFont(allLines);
  const pageSections = filteredByPage.map((lines, index) => {
    const marker = `<!-- PDF page ${index + 1} -->`;
    const content = markdownForLines(lines, bodyFontSize, title, index === 0);
    return content ? `${marker}\n\n${content}` : `${marker}\n\n> This page had no selectable text; OCR was not performed.`;
  });
  const source = `# ${escapeMarkdown(title)}\n\n${pageSections.join("\n\n")}\n`;
  if (source.length > MAX_PDF_OUTPUT_CHARS) {
    throw new Error("The extracted PDF text exceeds Rune's 200,000-character Document limit.");
  }

  const emptyPages = filteredByPage.filter((lines) => !lines.length).length;
  const annotationCount = snapshot.pages.reduce((total, page) => total + page.annotationCount, 0);
  const hasLargeGaps = allLines.some((line) => line.hasLargeGap);
  const warnings = [
    "PDF import recovers selectable text and approximate reading order; images, scans, exact layout, fonts, tables, and columns are not preserved.",
  ];
  if (hasLargeGaps) warnings.push("Large horizontal gaps were flattened; review possible columns or tables in the generated Markdown.");
  if (repeatedLineCount) warnings.push(`${repeatedLineCount} repeated header or footer lines were omitted.`);
  if (emptyPages) warnings.push(`${emptyPages} ${emptyPages === 1 ? "page had" : "pages had"} no selectable text; OCR was not performed.`);
  if (annotationCount) warnings.push(`${annotationCount} PDF ${annotationCount === 1 ? "annotation was" : "annotations were"} omitted, including links, comments, or form controls.`);
  if (snapshot.outlineCount) warnings.push(`${snapshot.outlineCount} PDF ${snapshot.outlineCount === 1 ? "bookmark was" : "bookmarks were"} not preserved as navigation.`);
  if (snapshot.hasJavaScript) warnings.push("Document JavaScript was ignored and never executed.");

  return {
    sourceType: "pdf",
    warnings,
    artifacts: [{
      id: stableImportId(fileName),
      name: `${safeFileSegment(baseName(fileName))}.md`,
      kind: "document",
      language: "Markdown",
      source,
    }],
  };
}

export async function convertPdfFileWithLibrary(
  fileName: string,
  input: ArrayBuffer | Uint8Array,
  pdfjs: PdfJsLibrary,
): Promise<PdfImportResult> {
  const bytes = toBytes(input);
  validatePdfInput(fileName, bytes);
  let passwordRequired = false;
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    disableAutoFetch: true,
    disableRange: true,
    disableStream: true,
    isEvalSupported: false,
    stopAtErrors: true,
    useSystemFonts: true,
  });
  loadingTask.onPassword = () => {
    passwordRequired = true;
    void loadingTask.destroy();
  };

  try {
    const document = await loadingTask.promise;
    if (document.numPages < 1) throw new Error("The PDF does not contain any pages.");
    if (document.numPages > MAX_PDF_IMPORT_PAGES) {
      throw new Error(`PDF import is limited to ${MAX_PDF_IMPORT_PAGES} pages per file.`);
    }
    const metadata = await document.getMetadata().catch(() => ({ info: {} }));
    const metadataTitle = (metadata.info as { Title?: unknown } | undefined)?.Title;
    const rawTitle = typeof metadataTitle === "string" ? metadataTitle : "";
    const outline = await document.getOutline().catch(() => null);
    const hasJavaScript = document.hasJSActions ? await document.hasJSActions().catch(() => false) : false;
    const pages: PdfPageSnapshot[] = [];
    let textItemCount = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent({ disableNormalization: false, includeMarkedContent: false });
      const items = content.items.flatMap((item) => {
        if (!("str" in item) || typeof item.str !== "string") return [];
        textItemCount += 1;
        if (textItemCount > MAX_PDF_TEXT_ITEMS) {
          throw new Error("The PDF contains more than 100,000 text fragments.");
        }
        const transform = item.transform ?? [];
        return [{
          str: item.str,
          x: Number(transform[4] ?? 0),
          y: Number(transform[5] ?? 0),
          width: Math.max(0, Number(item.width ?? 0)),
          height: Math.max(0.1, Number(item.height ?? (Math.abs(Number(transform[3] ?? 0)) || 1))),
          hasEOL: Boolean(item.hasEOL),
          direction: item.dir ?? "ltr",
        }];
      });
      const annotations = await page.getAnnotations({ intent: "display" }).catch(() => []);
      pages.push({
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        items,
        annotationCount: annotations.length,
      });
      page.cleanup?.();
    }
    return convertPdfSemanticSnapshot(fileName, {
      title: rawTitle,
      pages,
      outlineCount: outline?.length ?? 0,
      hasJavaScript,
    });
  } catch (error) {
    if (passwordRequired || (error instanceof Error && /password/i.test(`${error.name} ${error.message}`))) {
      throw new Error("Password-protected PDFs are not supported. Remove the password and import a copy.");
    }
    const detail = error instanceof Error ? error.message : "The PDF could not be parsed.";
    throw new Error(detail.startsWith("PDF import") || detail.startsWith("The PDF") || detail.startsWith("This PDF")
      ? detail
      : `PDF import failed: ${detail}`);
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}
