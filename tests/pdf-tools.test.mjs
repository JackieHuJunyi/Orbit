import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";

import { parsePdfPageSequence, runPdfCoreTool } from "../app/lib/pdf-core-tools.ts";
import { matchPdfToolIntent } from "../app/lib/pdf-tool-intent.ts";
import { PDF_TOOL_REGISTRY } from "../app/lib/pdf-tool-registry.ts";

async function samplePdf(pageCount, name = "sample.pdf") {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage([320, 480]);
    page.drawText(`Page ${index + 1}`, { x: 30, y: 430, size: 18, font });
  }
  return { name, type: "application/pdf", bytes: await pdf.save() };
}

test("covers the combined PDF24 and iLovePDF capability families without duplicate tool identity", () => {
  assert.equal(PDF_TOOL_REGISTRY.length, 36);
  assert.equal(new Set(PDF_TOOL_REGISTRY.map((tool) => tool.id)).size, PDF_TOOL_REGISTRY.length);
  for (const id of [
    "merge",
    "split",
    "compress",
    "edit",
    "sign",
    "images-to-pdf",
    "pdf-to-images",
    "extract-images",
    "protect",
    "unlock",
    "rotate",
    "remove-pages",
    "extract-pages",
    "organize",
    "html-to-pdf",
    "web-to-pdf",
    "ocr",
    "watermark",
    "page-numbers",
    "overlay",
    "compare",
    "optimize",
    "redact",
    "create",
    "repair",
    "crop",
    "forms",
    "summarize",
    "translate",
    "pdf-to-markdown",
    "pdfa",
  ]) {
    assert.equal(
      PDF_TOOL_REGISTRY.some((tool) => tool.id === id),
      true,
      id,
    );
  }
  assert.equal(matchPdfToolIntent("请帮我合并这些 PDF"), "merge");
  assert.equal(matchPdfToolIntent("Translate this PDF"), "translate");
  assert.equal(matchPdfToolIntent("Tell me about the report"), null);
});

test("parses reviewed page ranges, reverse ranges, and explicit duplicate page order", () => {
  assert.deepEqual(parsePdfPageSequence(undefined, 4), [0, 1, 2, 3]);
  assert.deepEqual(parsePdfPageSequence("1,3-4", 4), [0, 2, 3]);
  assert.deepEqual(parsePdfPageSequence("4-2", 4), [3, 2, 1]);
  assert.deepEqual(parsePdfPageSequence("3,1,3", 4, true), [2, 0, 2]);
  assert.throws(() => parsePdfPageSequence("0", 4), /between 1 and 4/i);
  assert.throws(() => parsePdfPageSequence("1,1", 4), /only once/i);
});

test("runs page, annotation, form, overlay, and creation operations without mutating the input bytes", async () => {
  const first = await samplePdf(3, "first.pdf");
  const second = await samplePdf(2, "second.pdf");
  const before = Buffer.from(first.bytes);

  const merged = await runPdfCoreTool("merge", [first, second]);
  assert.equal((await PDFDocument.load(merged[0].bytes)).getPageCount(), 5);

  const split = await runPdfCoreTool("split", [first], { pages: "1,3" });
  assert.equal(split.length, 2);
  assert.equal((await PDFDocument.load(split[0].bytes)).getPageCount(), 1);

  const extracted = await runPdfCoreTool("extract-pages", [first], { pages: "3-2" });
  assert.equal((await PDFDocument.load(extracted[0].bytes)).getPageCount(), 2);

  const organized = await runPdfCoreTool("organize", [first], { order: "3,1,1" });
  assert.equal((await PDFDocument.load(organized[0].bytes)).getPageCount(), 3);

  const removed = await runPdfCoreTool("remove-pages", [first], { pages: "2" });
  assert.equal((await PDFDocument.load(removed[0].bytes)).getPageCount(), 2);

  const rotated = await runPdfCoreTool("rotate", [first], { pages: "2", degrees: 90 });
  assert.equal((await PDFDocument.load(rotated[0].bytes)).getPage(1).getRotation().angle, 90);

  const cropped = await runPdfCoreTool("crop", [first], { pages: "1", x: 10, y: 20, width: 200, height: 300 });
  assert.deepEqual((await PDFDocument.load(cropped[0].bytes)).getPage(0).getCropBox(), {
    x: 10,
    y: 20,
    width: 200,
    height: 300,
  });

  for (const [toolId, options] of [
    ["watermark", { text: "CONFIDENTIAL" }],
    ["page-numbers", {}],
    ["edit", { text: "Reviewed", pages: "1", x: 40, y: 40 }],
    ["sign", { text: "Signed by Orbit", pages: "1", x: 40, y: 40 }],
  ]) {
    const [output] = await runPdfCoreTool(toolId, [first], options);
    assert.equal((await PDFDocument.load(output.bytes)).getPageCount(), 3);
  }

  const [formOutput] = await runPdfCoreTool("forms", [first], {
    pages: "1",
    fieldName: "reviewer",
    text: "Ada",
  });
  assert.equal((await PDFDocument.load(formOutput.bytes)).getForm().getTextField("reviewer").getText(), "Ada");

  const [checkboxOutput] = await runPdfCoreTool("forms", [first], {
    pages: "1",
    fieldName: "approved",
    fieldType: "checkbox",
    checked: true,
  });
  assert.equal((await PDFDocument.load(checkboxOutput.bytes)).getForm().getCheckBox("approved").isChecked(), true);

  const [dropdownOutput] = await runPdfCoreTool("forms", [first], {
    pages: "1",
    fieldName: "status",
    fieldType: "dropdown",
    choices: "Draft,Reviewed,Approved",
    text: "Reviewed",
  });
  assert.deepEqual((await PDFDocument.load(dropdownOutput.bytes)).getForm().getDropdown("status").getSelected(), [
    "Reviewed",
  ]);

  const [listOutput] = await runPdfCoreTool("forms", [first], {
    pages: "1",
    fieldName: "owner",
    fieldType: "list",
    choices: "Ada\nLinus",
    text: "Ada",
  });
  assert.deepEqual((await PDFDocument.load(listOutput.bytes)).getForm().getOptionList("owner").getSelected(), ["Ada"]);

  const [overlay] = await runPdfCoreTool("overlay", [first, second]);
  assert.equal((await PDFDocument.load(overlay.bytes)).getPageCount(), 3);

  const [created] = await runPdfCoreTool("create", [], { text: "Orbit PDF\n\nCreated locally." });
  assert.equal((await PDFDocument.load(created.bytes)).getPageCount(), 1);
  assert.deepEqual(Buffer.from(first.bytes), before);
});
