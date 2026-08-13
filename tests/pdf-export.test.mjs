import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  MAX_PDF_EXPORT_BYTES,
  RUNE_PDF_FONT_PATH,
  exportPdfArtifact,
  isPdfExportArtifact,
} from "../app/lib/pdf-export.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";
import { defaultQuerySnapshot, defaultSummaryQuerySnapshot } from "./query-snapshot-fixture.mjs";

const fontBytes = new Uint8Array(await readFile(new URL(`../public${RUNE_PDF_FONT_PATH}`, import.meta.url)));

function runtimeSnapshots() {
  return [defaultQuerySnapshot(), defaultSummaryQuerySnapshot()];
}

test("exports a deterministic A4 PDF from the default Markdown Document", async () => {
  const artifact = defaultArtifacts.find((candidate) => candidate.kind === "document");
  const first = await exportPdfArtifact(artifact, defaultArtifacts, runtimeSnapshots(), fontBytes);
  const second = await exportPdfArtifact(artifact, defaultArtifacts, runtimeSnapshots(), fontBytes);

  assert.equal(first.targetType, "pdf");
  assert.equal(first.fileName, "q2-review.pdf");
  assert.equal(first.mimeType, "application/pdf");
  assert.equal(Buffer.from(first.bytes.slice(0, 5)).toString(), "%PDF-");
  assert.deepEqual(first.bytes, second.bytes);
  assert.ok(first.bytes.length < MAX_PDF_EXPORT_BYTES);
  assert.match(first.warnings.join(" "), /fixed A4 layout/i);
  assert.match(first.warnings.join(" "), /vector snapshots/i);

  const document = await PDFDocument.load(first.bytes);
  assert.ok(document.getPageCount() >= 1);
  document.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    assert.ok(Math.abs(width - 595.28) < 0.1);
    assert.ok(Math.abs(height - 841.89) < 0.1);
  });
});

test("exports one deterministic 16:9 PDF page per Deck Markdown slide", async () => {
  const artifact = defaultArtifacts.find((candidate) => candidate.kind === "slides");
  const first = await exportPdfArtifact(artifact, defaultArtifacts, runtimeSnapshots(), fontBytes);
  const second = await exportPdfArtifact(artifact, defaultArtifacts, runtimeSnapshots(), fontBytes);

  assert.deepEqual(first.bytes, second.bytes);
  assert.equal(first.fileName, "board-briefing.pdf");
  assert.match(first.warnings.join(" "), /fixed 16:9 pages/i);
  assert.match(first.warnings.join(" "), /vector snapshots/i);

  const document = await PDFDocument.load(first.bytes);
  assert.equal(document.getPageCount(), 4);
  document.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    assert.equal(width, 960);
    assert.equal(height, 540);
  });
});

test("embeds Unicode text without a network font dependency", async () => {
  const base = defaultArtifacts.find((candidate) => candidate.kind === "document");
  const artifact = {
    ...base,
    name: "中文报告.md",
    source: "# 中文报告\n\n这是浏览器本地生成的 PDF。\n\n- 收入增长\n- 数据留在设备上",
  };
  const exported = await exportPdfArtifact(artifact, defaultArtifacts, [], fontBytes);
  assert.equal(exported.fileName, "中文报告.pdf");
  assert.ok(exported.bytes.length < MAX_PDF_EXPORT_BYTES);
  assert.equal((await PDFDocument.load(exported.bytes)).getPageCount(), 1);
  assert.doesNotMatch(exported.warnings.join(" "), /replaced with visible question marks/i);
});

test("exports Data as a deterministic landscape A4 table PDF", async () => {
  const data = defaultArtifacts.find((candidate) => candidate.kind === "data");
  const first = await exportPdfArtifact(data, defaultArtifacts, [], fontBytes);
  const second = await exportPdfArtifact(data, defaultArtifacts, [], fontBytes);
  assert.deepEqual(first.bytes, second.bytes);
  assert.equal(first.fileName, "regional-revenue.pdf");
  assert.match(first.warnings.join(" "), /landscape A4 table/i);
  const document = await PDFDocument.load(first.bytes);
  assert.equal(document.getPageCount(), 1);
  const { width, height } = document.getPages()[0].getSize();
  assert.ok(Math.abs(width - 841.89) < 0.1);
  assert.ok(Math.abs(height - 595.28) < 0.1);
});

test("fails closed for unsupported artifacts, pending Query bindings, and invalid font assets", async () => {
  const document = defaultArtifacts.find((candidate) => candidate.kind === "document");
  const data = defaultArtifacts.find((candidate) => candidate.kind === "data");

  assert.equal(isPdfExportArtifact(document), true);
  assert.equal(isPdfExportArtifact(data), true);
  await assert.rejects(() => exportPdfArtifact(document, defaultArtifacts, [], fontBytes), /before PDF export/i);
  await assert.rejects(
    () => exportPdfArtifact({ ...document, source: "# Small" }, defaultArtifacts, [], new Uint8Array([1, 2, 3, 4])),
    /valid WOFF2/i,
  );
  await assert.rejects(
    () => exportPdfArtifact({ ...document, source: "x".repeat(200_001) }, defaultArtifacts, [], fontBytes),
    /200,000 source characters/i,
  );
});

test("freezes line charts into deterministic vector Document and Deck PDFs", async () => {
  const data = { id: "trend-data", name: "trend.csv", kind: "data", language: "CSV / JSON", source: "Month,Value\nJan,10\nFeb,30\nMar,20\n" };
  const chart = {
    id: "trend-chart",
    name: "trend.chart.json",
    kind: "chart",
    language: "Chart JSON",
    source: JSON.stringify({ version: 1, title: "Monthly trend", description: "Ordered source values", source: data.id, mark: "line", category: "Month", value: "Value", sort: "source", format: "number", color: "#3676d1", maxItems: 8 }),
  };
  const document = { id: "trend-report", name: "trend.md", kind: "document", language: "Markdown", source: '# Trend\n\n{{ chart("trend-chart") }}\n' };
  const deck = {
    id: "trend-deck",
    name: "trend.deck.md",
    kind: "slides",
    language: "Deck Markdown",
    source: `---
version: 1
title: Trend PDF
theme: rune
ratio: 16:9
lang: en
---

# Monthly trend

{{ chart("trend-chart") }}
`,
  };
  const workspace = [document, data, chart, deck];
  const firstDocument = await exportPdfArtifact(document, workspace, [], fontBytes);
  const secondDocument = await exportPdfArtifact(document, workspace, [], fontBytes);
  assert.deepEqual(firstDocument.bytes, secondDocument.bytes);
  assert.equal((await PDFDocument.load(firstDocument.bytes)).getPageCount(), 1);
  assert.match(firstDocument.warnings.join(" "), /vector snapshots/i);

  const firstDeck = await exportPdfArtifact(deck, workspace, [], fontBytes);
  const secondDeck = await exportPdfArtifact(deck, workspace, [], fontBytes);
  assert.deepEqual(firstDeck.bytes, secondDeck.bytes);
  assert.equal((await PDFDocument.load(firstDeck.bytes)).getPageCount(), 1);
});
