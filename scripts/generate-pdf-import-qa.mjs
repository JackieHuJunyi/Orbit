import { mkdir, writeFile } from "node:fs/promises";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

import { convertPdfFileWithLibrary } from "../app/lib/pdf-import.ts";

const outputDirectory = new URL("../tmp/pdfs/", import.meta.url);
const pdfPath = new URL("rune-pdf-import-qa.pdf", outputDirectory);
const markdownPath = new URL("rune-pdf-import-qa.md", outputDirectory);
const document = await PDFDocument.create();
document.setTitle("Rune PDF Import QA");
document.setAuthor("Rune deterministic QA fixture");
const regular = await document.embedFont(StandardFonts.Helvetica);
const bold = await document.embedFont(StandardFonts.HelveticaBold);
const accent = rgb(0.86, 0.2, 0.12);

function drawChrome(page, pageNumber) {
  page.drawText("RUNE / PDF IMPORT QA", { x: 72, y: 770, size: 9, font: regular, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(`Page ${pageNumber}`, { x: 285, y: 28, size: 9, font: regular, color: rgb(0.4, 0.4, 0.4) });
}

const first = document.addPage([612, 792]);
drawChrome(first, 1);
first.drawText("Rune PDF Import QA", { x: 72, y: 720, size: 24, font: bold, color: accent });
first.drawText("Operating context", { x: 72, y: 674, size: 18, font: bold });
first.drawText("Revenue grew across all operating regions.", { x: 72, y: 642, size: 12, font: regular });
first.drawText("- APAC led the verified plan", { x: 88, y: 614, size: 12, font: regular });
first.drawText("Region", { x: 72, y: 562, size: 11, font: bold });
first.drawText("Revenue", { x: 300, y: 562, size: 11, font: bold });
first.drawText("APAC", { x: 72, y: 538, size: 11, font: regular });
first.drawText("970000", { x: 300, y: 538, size: 11, font: regular });

const second = document.addPage([612, 792]);
drawChrome(second, 2);
second.drawText("Decision", { x: 72, y: 700, size: 18, font: bold });
second.drawText("Fund the repeatable channel and verify the next checkpoint.", { x: 72, y: 664, size: 12, font: regular });
second.drawText("1. Confirm source ownership", { x: 88, y: 628, size: 12, font: regular });
second.drawText("2. Review the generated Markdown", { x: 88, y: 602, size: 12, font: regular });

const bytes = await document.save({ useObjectStreams: false });
const imported = await convertPdfFileWithLibrary("rune-pdf-import-qa.pdf", bytes, pdfjs);
await mkdir(outputDirectory, { recursive: true });
await writeFile(pdfPath, bytes);
await writeFile(markdownPath, imported.artifacts[0].source, "utf8");

console.log(`PDF\t${pdfPath.pathname}\t${bytes.length} bytes`);
console.log(`Markdown\t${markdownPath.pathname}\t${imported.artifacts[0].source.length} characters`);
for (const warning of imported.warnings) console.log(`Warning\t${warning}`);
