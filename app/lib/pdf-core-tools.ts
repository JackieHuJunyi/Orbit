import {
  degrees,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFTextField,
  StandardFonts,
  rgb,
} from "pdf-lib";

export type PdfToolInputFile = Readonly<{ name: string; bytes: Uint8Array; type?: string }>;
export type PdfToolOutputFile = Readonly<{ name: string; bytes: Uint8Array; type: string }>;

export type PdfCoreToolOptions = Readonly<{
  pages?: string;
  order?: string;
  degrees?: 90 | 180 | 270;
  text?: string;
  password?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  opacity?: number;
  fieldName?: string;
  fieldType?: "text" | "checkbox" | "dropdown" | "list";
  choices?: string;
  checked?: boolean;
  url?: string;
}>;

const MAX_PDF_INPUT_BYTES = 80 * 1024 * 1024;
const MAX_PDF_PAGES = 2_000;

function outputName(name: string, suffix: string) {
  const stem = name.replace(/\.pdf$/iu, "") || "document";
  return `${stem}-${suffix}.pdf`;
}

function boundedNumber(value: number | undefined, fallback: number, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
}

export function parsePdfPageSequence(value: string | undefined, pageCount: number, allowDuplicates = false) {
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > MAX_PDF_PAGES) {
    throw new Error("The PDF page count is outside Orbit's supported range.");
  }
  if (!value?.trim()) return Array.from({ length: pageCount }, (_, index) => index);
  const pages: number[] = [];
  for (const token of value.split(",").map((item) => item.trim())) {
    const range = token.match(/^(\d+)(?:-(\d+))?$/u);
    if (!range) throw new Error("Use page numbers such as 1,3-5.");
    const start = Number(range[1]);
    const end = Number(range[2] ?? range[1]);
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      throw new Error(`Choose pages between 1 and ${pageCount}.`);
    }
    const step = start <= end ? 1 : -1;
    for (let page = start; ; page += step) {
      pages.push(page - 1);
      if (page === end) break;
    }
  }
  if (!allowDuplicates && new Set(pages).size !== pages.length)
    throw new Error("Each selected page may appear only once.");
  return pages;
}

async function loadPdf(input: PdfToolInputFile) {
  if (!input.bytes.length || input.bytes.length > MAX_PDF_INPUT_BYTES) {
    throw new Error("Choose a PDF between 1 byte and 80 MB.");
  }
  const pdf = await PDFDocument.load(input.bytes, { updateMetadata: false });
  if (pdf.getPageCount() < 1 || pdf.getPageCount() > MAX_PDF_PAGES) {
    throw new Error("The PDF page count is outside Orbit's supported range.");
  }
  return pdf;
}

async function savePdf(pdf: PDFDocument, sourceName: string, suffix: string): Promise<PdfToolOutputFile> {
  return {
    name: outputName(sourceName, suffix),
    bytes: await pdf.save({ addDefaultPage: false, objectsPerTick: 50, useObjectStreams: true }),
    type: "application/pdf",
  };
}

async function mergePdfs(inputs: readonly PdfToolInputFile[]) {
  if (inputs.length < 2) throw new Error("Choose at least two PDFs to merge.");
  const output = await PDFDocument.create();
  for (const input of inputs) {
    const source = await loadPdf(input);
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach((page) => output.addPage(page));
  }
  return [await savePdf(output, inputs[0].name, "merged")];
}

async function imagePdf(inputs: readonly PdfToolInputFile[]) {
  if (!inputs.length) throw new Error("Choose at least one PNG or JPEG image.");
  const output = await PDFDocument.create();
  for (const input of inputs) {
    const jpeg = /jpe?g/iu.test(input.type ?? "") || /\.jpe?g$/iu.test(input.name);
    const image = jpeg ? await output.embedJpg(input.bytes) : await output.embedPng(input.bytes);
    const page = output.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  return [await savePdf(output, "scanned-pages.pdf", "combined")];
}

async function createTextPdf(options: PdfCoreToolOptions) {
  const text = options.text?.trim() ?? "";
  if (!text || text.length > 100_000) throw new Error("Enter between 1 and 100,000 characters.");
  if (/[^\x09\x0a\x0d\x20-\x7e]/u.test(text)) {
    throw new Error(
      "This local text creator currently supports Latin text. Import Markdown for multilingual PDF export.",
    );
  }
  const output = await PDFDocument.create();
  const font = await output.embedFont(StandardFonts.Helvetica);
  const fontSize = boundedNumber(options.fontSize, 12, 8, 30);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 54;
  const lineHeight = fontSize * 1.45;
  let page = output.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  for (const sourceLine of text.split(/\r?\n/u)) {
    const words = sourceLine.split(/\s+/u);
    let line = "";
    const flush = () => {
      if (y < margin) {
        page = output.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0.12, 0.12, 0.13) });
      y -= lineHeight;
      line = "";
    };
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) > pageWidth - margin * 2 && line) flush();
      line = line ? `${line} ${word}` : word;
    }
    flush();
  }
  return [await savePdf(output, "document.pdf", "created")];
}

export async function runPdfCoreTool(
  toolId: string,
  inputs: readonly PdfToolInputFile[],
  options: PdfCoreToolOptions = {},
): Promise<PdfToolOutputFile[]> {
  if (toolId === "merge") return mergePdfs(inputs);
  if (toolId === "images-to-pdf" || toolId === "scan-to-pdf") return imagePdf(inputs);
  if (toolId === "create") return createTextPdf(options);
  if (toolId === "overlay") {
    if (inputs.length !== 2) throw new Error("Choose one base PDF and one overlay PDF.");
    const base = await loadPdf(inputs[0]);
    const overlay = await loadPdf(inputs[1]);
    const overlayPages = await base.embedPdf(inputs[1].bytes, overlay.getPageIndices());
    base.getPages().forEach((page, index) => {
      const embedded = overlayPages[Math.min(index, overlayPages.length - 1)];
      const scale = Math.min(page.getWidth() / embedded.width, page.getHeight() / embedded.height);
      page.drawPage(embedded, {
        x: (page.getWidth() - embedded.width * scale) / 2,
        y: (page.getHeight() - embedded.height * scale) / 2,
        xScale: scale,
        yScale: scale,
        opacity: boundedNumber(options.opacity, 1, 0.05, 1),
      });
    });
    return [await savePdf(base, inputs[0].name, "overlaid")];
  }
  const input = inputs[0];
  if (!input || inputs.length !== 1) throw new Error("Choose exactly one PDF for this tool.");
  const source = await loadPdf(input);
  const selected = parsePdfPageSequence(options.pages, source.getPageCount());

  if (toolId === "split") {
    return Promise.all(
      selected.map(async (pageIndex) => {
        const output = await PDFDocument.create();
        const [page] = await output.copyPages(source, [pageIndex]);
        output.addPage(page);
        return savePdf(output, input.name, `page-${pageIndex + 1}`);
      }),
    );
  }

  if (toolId === "extract-pages" || toolId === "organize") {
    const sequence =
      toolId === "organize" ? parsePdfPageSequence(options.order, source.getPageCount(), true) : selected;
    const output = await PDFDocument.create();
    const pages = await output.copyPages(source, sequence);
    pages.forEach((page) => output.addPage(page));
    return [await savePdf(output, input.name, toolId === "organize" ? "organized" : "extracted")];
  }

  if (toolId === "remove-pages") {
    if (selected.length >= source.getPageCount()) throw new Error("Keep at least one page in the PDF.");
    [...selected].sort((a, b) => b - a).forEach((pageIndex) => source.removePage(pageIndex));
    return [await savePdf(source, input.name, "pages-removed")];
  }

  if (toolId === "rotate") {
    const rotation = options.degrees ?? 90;
    selected.forEach((pageIndex) => {
      const page = source.getPage(pageIndex);
      page.setRotation(degrees((page.getRotation().angle + rotation) % 360));
    });
    return [await savePdf(source, input.name, "rotated")];
  }

  if (toolId === "crop") {
    for (const pageIndex of selected) {
      const page = source.getPage(pageIndex);
      const size = page.getSize();
      const x = boundedNumber(options.x, 0, 0, size.width - 1);
      const y = boundedNumber(options.y, 0, 0, size.height - 1);
      const width = boundedNumber(options.width, size.width - x, 1, size.width - x);
      const height = boundedNumber(options.height, size.height - y, 1, size.height - y);
      page.setCropBox(x, y, width, height);
    }
    return [await savePdf(source, input.name, "cropped")];
  }

  const font = await source.embedFont(StandardFonts.Helvetica);
  const fontSize = boundedNumber(options.fontSize, toolId === "watermark" ? 34 : 12, 8, 72);
  const text = options.text?.trim() ?? (toolId === "page-numbers" ? "" : "Orbit");
  if (/[^\x20-\x7e]/u.test(text)) throw new Error("This direct PDF stamp currently supports Latin text.");

  if (toolId === "page-numbers") {
    selected.forEach((pageIndex) => {
      const page = source.getPage(pageIndex);
      const label = String(pageIndex + 1);
      page.drawText(label, {
        x: page.getWidth() / 2 - font.widthOfTextAtSize(label, fontSize) / 2,
        y: 24,
        size: fontSize,
        font,
        color: rgb(0.24, 0.24, 0.26),
      });
    });
    return [await savePdf(source, input.name, "numbered")];
  }

  if (toolId === "watermark") {
    if (!text) throw new Error("Enter watermark text.");
    selected.forEach((pageIndex) => {
      const page = source.getPage(pageIndex);
      const width = font.widthOfTextAtSize(text, fontSize);
      page.drawText(text, {
        x: (page.getWidth() - width) / 2,
        y: page.getHeight() / 2,
        size: fontSize,
        font,
        color: rgb(0.35, 0.35, 0.38),
        opacity: boundedNumber(options.opacity, 0.22, 0.05, 0.9),
        rotate: degrees(35),
      });
    });
    return [await savePdf(source, input.name, "watermarked")];
  }

  if (toolId === "edit" || toolId === "sign") {
    if (!text) throw new Error(toolId === "sign" ? "Enter the visible signature text." : "Enter text to place.");
    const page = source.getPage(selected[0]);
    page.drawText(text, {
      x: boundedNumber(options.x, 48, 0, page.getWidth() - 1),
      y: boundedNumber(options.y, 48, 0, page.getHeight() - 1),
      size: fontSize,
      font,
      color: toolId === "sign" ? rgb(0.08, 0.2, 0.44) : rgb(0.12, 0.12, 0.13),
    });
    return [await savePdf(source, input.name, toolId === "sign" ? "signed" : "edited")];
  }

  if (toolId === "forms") {
    const page = source.getPage(selected[0]);
    const fieldName = options.fieldName?.trim().replace(/[^A-Za-z0-9_.-]/gu, "-") || "orbit-field";
    const form = source.getForm();
    const existing = form.getFieldMaybe(fieldName);
    const fieldType = options.fieldType ?? "text";
    const fieldOptions = {
      x: boundedNumber(options.x, 48, 0, page.getWidth() - 1),
      y: boundedNumber(options.y, 48, 0, page.getHeight() - 1),
      width: boundedNumber(options.width, 220, 20, page.getWidth()),
      height: boundedNumber(options.height, 32, 12, page.getHeight()),
      borderWidth: 1,
      textColor: rgb(0.12, 0.12, 0.13),
      borderColor: rgb(0.68, 0.7, 0.74),
      backgroundColor: rgb(1, 1, 1),
    };
    if (fieldType === "checkbox") {
      if (existing && !(existing instanceof PDFCheckBox)) throw new Error("The named form field has another type.");
      const field = existing ?? form.createCheckBox(fieldName);
      if (!(field instanceof PDFCheckBox)) throw new Error("The named form field is not a checkbox.");
      if (options.checked === false) field.uncheck();
      else field.check();
      if (!existing) field.addToPage(page, { ...fieldOptions, width: 24, height: 24 });
    } else if (fieldType === "dropdown" || fieldType === "list") {
      const choices = (options.choices ?? "")
        .split(/[\n,]/u)
        .map((choice) => choice.trim())
        .filter(Boolean);
      if (!choices.length || choices.length > 100 || choices.some((choice) => choice.length > 200)) {
        throw new Error("Enter between 1 and 100 short choices.");
      }
      if (choices.some((choice) => /[^\x20-\x7e]/u.test(choice))) {
        throw new Error("Direct PDF choice fields currently support Latin text.");
      }
      if (fieldType === "dropdown") {
        if (existing && !(existing instanceof PDFDropdown)) throw new Error("The named form field has another type.");
        const field = existing ?? form.createDropdown(fieldName);
        if (!(field instanceof PDFDropdown)) throw new Error("The named form field is not a dropdown.");
        field.setOptions(choices);
        field.select(text && choices.includes(text) ? text : choices[0]);
        if (!existing) field.addToPage(page, fieldOptions);
      } else {
        if (existing && !(existing instanceof PDFOptionList)) throw new Error("The named form field has another type.");
        const field = existing ?? form.createOptionList(fieldName);
        if (!(field instanceof PDFOptionList)) throw new Error("The named form field is not an option list.");
        field.setOptions(choices);
        field.select(text && choices.includes(text) ? text : choices[0]);
        if (!existing) field.addToPage(page, { ...fieldOptions, height: Math.max(fieldOptions.height, 72) });
      }
    } else {
      if (existing && !(existing instanceof PDFTextField)) throw new Error("The named form field has another type.");
      const field = existing ?? form.createTextField(fieldName);
      if (!(field instanceof PDFTextField)) throw new Error("The named form field is not a text field.");
      field.setText(text);
      if (!existing) field.addToPage(page, fieldOptions);
    }
    return [await savePdf(source, input.name, "form")];
  }

  throw new Error("This PDF tool is not a pdf-lib operation.");
}
