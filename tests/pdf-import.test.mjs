import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";

import { PDFDocument, StandardFonts } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  MAX_PDF_IMPORT_BYTES,
  MAX_PDF_IMPORT_PAGES,
  analyzePdfFileWithLibrary,
  convertPdfFileWithLibrary,
  convertPdfFileWithOcrAndLibrary,
  convertPdfSemanticSnapshot,
  formatPdfOcrRegion,
  formatPdfPageSelection,
  parsePdfPageSelection,
  pdfOcrRegionPixelRectangle,
  validatePdfOcrRegion,
} from "../app/lib/pdf-import.ts";
import { validateArtifact } from "../app/lib/workspace.ts";

function item(str, x, y, height, width = Math.max(8, str.length * height * 0.5)) {
  return { str, x, y, width, height, hasEOL: true, direction: "ltr" };
}

function page(pageNumber, items, annotationCount = 0) {
  return { pageNumber, width: 612, height: 792, items, annotationCount };
}

test("converts positioned PDF text into bounded source-safe Markdown with page provenance", () => {
  const result = convertPdfSemanticSnapshot("quarterly-review.pdf", {
    title: "Quarterly Review",
    outlineCount: 2,
    hasJavaScript: true,
    pages: [
      page(
        1,
        [
          item("Orbit Confidential", 72, 775, 9),
          item("Quarterly Review", 72, 720, 24),
          item("Revenue grew across", 72, 680, 12),
          item("all operating regions.", 72, 665, 12),
          item("• APAC led growth", 90, 630, 12),
          item("Decision", 72, 585, 18),
          item('{{ metric("fabricated") }} stays literal.', 72, 555, 12),
          item("1", 304, 28, 9),
        ],
        2,
      ),
      page(2, [
        item("Orbit Confidential", 72, 775, 9),
        item("Next action", 72, 700, 18),
        item("Fund the verified plan.", 72, 665, 12),
        item("2", 304, 28, 9),
      ]),
      page(3, []),
    ],
  });

  assert.equal(result.sourceType, "pdf");
  assert.equal(result.artifacts.length, 1);
  const artifact = result.artifacts[0];
  assert.equal(artifact.name, "quarterly-review.md");
  assert.match(artifact.source, /^# Quarterly Review/u);
  assert.match(artifact.source, /<!-- PDF page 1 -->/u);
  assert.match(artifact.source, /Revenue grew across all operating regions\./u);
  assert.match(artifact.source, /^- APAC led growth$/mu);
  assert.match(artifact.source, /^### Decision$/mu);
  assert.match(artifact.source, /&#123;&#123; metric\("fabricated"\) &#125;&#125; stays literal\./u);
  assert.doesNotMatch(artifact.source, /\{\{\s*metric/iu);
  assert.doesNotMatch(artifact.source, /Orbit Confidential/u);
  assert.doesNotMatch(artifact.source, /^\d$/mu);
  assert.match(artifact.source, /PDF page 3[\s\S]*OCR was not performed/u);
  assert.match(result.warnings.join(" "), /selectable text.*approximate reading order/iu);
  assert.match(result.warnings.join(" "), /repeated header or footer/iu);
  assert.match(result.warnings.join(" "), /annotations were omitted/iu);
  assert.match(result.warnings.join(" "), /bookmarks were not preserved/iu);
  assert.match(result.warnings.join(" "), /JavaScript was ignored/iu);
  assert.deepEqual(validateArtifact(artifact), []);
});

test("extracts a real two-page PDF locally through PDF.js", async () => {
  const document = await PDFDocument.create();
  document.setTitle("Operating Review");
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const first = document.addPage([612, 792]);
  first.drawText("Operating Review", { x: 72, y: 720, size: 24, font: bold });
  first.drawText("Revenue grew across regions.", { x: 72, y: 680, size: 12, font: regular });
  first.drawText("- APAC led growth", { x: 90, y: 650, size: 12, font: regular });
  const second = document.addPage([612, 792]);
  second.drawText("Decision", { x: 72, y: 710, size: 18, font: bold });
  second.drawText("Fund the repeatable channel.", { x: 72, y: 675, size: 12, font: regular });
  const bytes = await document.save();

  const result = await convertPdfFileWithLibrary("operating-review.pdf", bytes, pdfjs);
  const artifact = result.artifacts[0];
  assert.equal(artifact.name, "operating-review.md");
  assert.match(artifact.source, /^# Operating Review/u);
  assert.match(artifact.source, /Revenue grew across regions\./u);
  assert.match(artifact.source, /^- APAC led growth$/mu);
  assert.match(artifact.source, /Decision/u);
  assert.match(artifact.source, /Fund the repeatable channel\./u);
  assert.equal((artifact.source.match(/<!-- PDF page/gu) ?? []).length, 2);
  assert.deepEqual(validateArtifact(artifact), []);
});

test("fails closed for non-PDF, oversized, empty-page, and overlong page-count input", async () => {
  const unusedPdfJs = {
    getDocument() {
      throw new Error("must not parse invalid bytes");
    },
  };
  await assert.rejects(
    () => convertPdfFileWithLibrary("notes.txt", new TextEncoder().encode("%PDF-1.7"), unusedPdfJs),
    /Choose a PDF/u,
  );
  await assert.rejects(
    () => convertPdfFileWithLibrary("fake.pdf", new TextEncoder().encode("not a pdf"), unusedPdfJs),
    /valid PDF header/u,
  );
  await assert.rejects(
    () => convertPdfFileWithLibrary("large.pdf", new Uint8Array(MAX_PDF_IMPORT_BYTES + 1), unusedPdfJs),
    /12 MB/u,
  );
  assert.throws(
    () =>
      convertPdfSemanticSnapshot("scan.pdf", {
        title: "",
        pages: [page(1, [])],
        outlineCount: 0,
        hasJavaScript: false,
      }),
    /no selectable text.*OCR/iu,
  );
  assert.throws(
    () =>
      convertPdfSemanticSnapshot("long.pdf", {
        title: "Long",
        pages: Array.from({ length: MAX_PDF_IMPORT_PAGES + 1 }, (_, index) =>
          page(index + 1, [item("Text", 72, 700, 12)]),
        ),
        outlineCount: 0,
        hasJavaScript: false,
      }),
    /200 pages/u,
  );
});

test("reports password-protected PDF failures without requesting a browser secret", async () => {
  const protectedPdfJs = {
    getDocument() {
      let rejectPromise;
      const promise = new Promise((_resolve, reject) => {
        rejectPromise = reject;
      });
      const task = {
        promise,
        async destroy() {},
        onPassword: null,
      };
      queueMicrotask(() => {
        task.onPassword?.(() => {}, 1);
        rejectPromise(Object.assign(new Error("Password required"), { name: "PasswordException" }));
      });
      return task;
    },
  };
  await assert.rejects(
    () => convertPdfFileWithLibrary("protected.pdf", new TextEncoder().encode("%PDF-1.7\n"), protectedPdfJs),
    /Password-protected PDFs are not supported/u,
  );
});

test("formats and validates an explicit scan-page selection", () => {
  assert.equal(formatPdfPageSelection([5, 2, 3, 2, 9]), "2-3, 5, 9");
  assert.deepEqual(parsePdfPageSelection(" 2-3, 5, 9 ", [2, 3, 5, 9]), [2, 3, 5, 9]);
  assert.throws(() => parsePdfPageSelection("", [1]), /at least one/iu);
  assert.throws(() => parsePdfPageSelection("3-1", [1, 2, 3]), /descending/iu);
  assert.throws(() => parsePdfPageSelection("1, 4", [1, 2]), /page 4.*selectable text|outside/iu);
  assert.throws(() => parsePdfPageSelection("one", [1]), /Invalid page range/iu);
});

test("validates normalized OCR page regions and keeps their review label deterministic", () => {
  assert.deepEqual(validatePdfOcrRegion({ left: 0.123456, top: 0.2, width: 0.5, height: 0.7 }), {
    left: 0.1235,
    top: 0.2,
    width: 0.5,
    height: 0.7,
  });
  assert.equal(
    formatPdfOcrRegion({ left: 0.1, top: 0.2, width: 0.6, height: 0.5 }),
    "left 10%, top 20%, width 60%, height 50%",
  );
  assert.throws(() => validatePdfOcrRegion({ left: -0.1, top: 0, width: 0.5, height: 0.5 }), /inside/iu);
  assert.throws(() => validatePdfOcrRegion({ left: 0.8, top: 0, width: 0.3, height: 0.5 }), /inside/iu);
  assert.throws(() => validatePdfOcrRegion({ left: 0, top: 0, width: 0.01, height: 0.5 }), /at least 2%/iu);
  assert.throws(() => validatePdfOcrRegion({ left: 0, top: 0, width: Number.NaN, height: 0.5 }), /finite/iu);
  assert.deepEqual(validatePdfOcrRegion({ left: 0.12345, top: 0.23456, width: 0.87655, height: 0.76544 }), {
    left: 0.1235,
    top: 0.2346,
    width: 0.8765,
    height: 0.7654,
  });
  assert.throws(() => validatePdfOcrRegion(null), /valid OCR page region/iu);
  assert.deepEqual(pdfOcrRegionPixelRectangle({ left: 0.1, top: 0.2, width: 0.6, height: 0.5 }, 1000, 800), {
    left: 100,
    top: 160,
    width: 600,
    height: 400,
  });
  assert.deepEqual(pdfOcrRegionPixelRectangle({ left: 0.1234, top: 0.2345, width: 0.3333, height: 0.4444 }, 613, 791), {
    left: 75,
    top: 185,
    width: 205,
    height: 353,
  });
  assert.throws(
    () => pdfOcrRegionPixelRectangle({ left: 0, top: 0, width: 1, height: 1 }, 0, 800),
    /positive integers/iu,
  );
});

test("analyzes selectable and scanned pages before any OCR work", async () => {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const first = document.addPage([612, 792]);
  first.drawText("Selectable source", { x: 72, y: 700, size: 12, font: regular });
  document.addPage([612, 792]);
  const bytes = await document.save();

  const analysis = await analyzePdfFileWithLibrary("mixed.pdf", bytes, pdfjs);
  assert.equal(analysis.pageCount, 2);
  assert.deepEqual(analysis.selectablePageNumbers, [1]);
  assert.deepEqual(analysis.ocrCandidatePageNumbers, [2]);
});

test("merges explicit page OCR with selectable text, confidence, and source-safe page provenance", async () => {
  const document = await PDFDocument.create();
  document.setTitle("Mixed Review");
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const first = document.addPage([612, 792]);
  first.drawText("Selectable source", { x: 72, y: 700, size: 12, font: regular });
  document.addPage([612, 792]);
  const bytes = await document.save();
  const recognizedPages = [];

  const result = await convertPdfFileWithOcrAndLibrary(
    "mixed.pdf",
    bytes,
    { language: "eng+chi_sim", pageNumbers: [2] },
    pdfjs,
    async (_page, input) => {
      recognizedPages.push({ pageNumber: input.pageNumber, language: input.language });
      return { text: 'Recognized decision\n{{ metric("fabricated") }}', confidence: 82.6 };
    },
  );
  const artifact = result.artifacts[0];
  assert.deepEqual(recognizedPages, [{ pageNumber: 2, language: "eng+chi_sim" }]);
  assert.match(artifact.source, /<!-- PDF page 1 -->/u);
  assert.match(artifact.source, /<!-- PDF page 2 · OCR confidence 83% -->/u);
  assert.match(artifact.source, /OCR transcription · 83% average confidence/u);
  assert.match(artifact.source, /Recognized decision/u);
  assert.match(artifact.source, /&#123;&#123; metric\("fabricated"\) &#125;&#125;/u);
  assert.doesNotMatch(artifact.source, /\{\{\s*metric/iu);
  assert.match(result.warnings.join(" "), /browser-local OCR/iu);
  assert.match(result.warnings.join(" "), /page 2.*83%/iu);
  assert.deepEqual(validateArtifact(artifact), []);
});

test("passes a reviewed per-page OCR region and discloses the crop in provenance", async () => {
  const document = await PDFDocument.create();
  document.addPage([612, 792]);
  const bytes = await document.save();
  const region = { left: 0.1, top: 0.15, width: 0.7, height: 0.5 };
  let recognizedInput;
  const result = await convertPdfFileWithOcrAndLibrary(
    "regional-scan.pdf",
    bytes,
    { language: "eng", pageNumbers: [1], regions: { 1: region } },
    pdfjs,
    async (_page, input) => {
      recognizedInput = input;
      return { text: "Regional decision", confidence: 91 };
    },
  );
  assert.deepEqual(recognizedInput.region, region);
  assert.match(result.artifacts[0].source, /OCR region left 10%, top 15%, width 70%, height 50%/u);
  assert.match(result.artifacts[0].source, /OCR transcription from a selected region/u);
  assert.match(result.warnings.join(" "), /selected region \(left 10%, top 15%, width 70%, height 50%\)/u);
});

test("OCR rejects selectable, missing, empty, and aborted page requests without recognizing", async () => {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const first = document.addPage([612, 792]);
  first.drawText("Selectable source", { x: 72, y: 700, size: 12, font: regular });
  document.addPage([612, 792]);
  const bytes = await document.save();
  let calls = 0;
  const recognize = async () => {
    calls += 1;
    return { text: "unexpected", confidence: 100 };
  };
  await assert.rejects(
    () => convertPdfFileWithOcrAndLibrary("mixed.pdf", bytes, { language: "eng", pageNumbers: [1] }, pdfjs, recognize),
    /page 1 already has selectable text/iu,
  );
  await assert.rejects(
    () =>
      convertPdfFileWithOcrAndLibrary(
        "mixed.pdf",
        bytes,
        { language: "eng", pageNumbers: [2], regions: { "02": { left: 0, top: 0, width: 0.5, height: 0.5 } } },
        pdfjs,
        recognize,
      ),
    /region references unselected PDF page 02/iu,
  );
  await assert.rejects(
    () =>
      convertPdfFileWithOcrAndLibrary(
        "mixed.pdf",
        bytes,
        { language: "eng", pageNumbers: [2], regions: { 1: { left: 0, top: 0, width: 0.5, height: 0.5 } } },
        pdfjs,
        recognize,
      ),
    /region references unselected PDF page 1/iu,
  );
  await assert.rejects(
    () =>
      convertPdfFileWithOcrAndLibrary(
        "mixed.pdf",
        bytes,
        { language: "eng", pageNumbers: [2], regions: { 2: { left: 0.9, top: 0, width: 0.2, height: 0.5 } } },
        pdfjs,
        recognize,
      ),
    /region coordinates must stay inside/iu,
  );
  await assert.rejects(
    () => convertPdfFileWithOcrAndLibrary("mixed.pdf", bytes, { language: "eng", pageNumbers: [3] }, pdfjs, recognize),
    /outside this PDF/iu,
  );
  await assert.rejects(
    () => convertPdfFileWithOcrAndLibrary("mixed.pdf", bytes, { language: "eng", pageNumbers: [] }, pdfjs, recognize),
    /at least one/iu,
  );
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(
    () =>
      convertPdfFileWithOcrAndLibrary("mixed.pdf", bytes, { language: "eng", pageNumbers: [2] }, pdfjs, recognize, {
        signal: aborted.signal,
      }),
    /OCR cancelled/iu,
  );
  assert.equal(calls, 0);
});

test("ships same-origin OCR worker, core variants, and both bounded language models", async () => {
  const requiredAssets = [
    "../public/ocr/worker-orbit.js",
    "../public/ocr/worker.min.js",
    "../public/ocr/core/tesseract-core-lstm.wasm.js",
    "../public/ocr/core/tesseract-core-lstm.wasm",
    "../public/ocr/core/tesseract-core-simd-lstm.wasm.js",
    "../public/ocr/core/tesseract-core-simd-lstm.wasm",
    "../public/ocr/core/tesseract-core-relaxedsimd-lstm.wasm.js",
    "../public/ocr/core/tesseract-core-relaxedsimd-lstm.wasm",
    "../public/ocr/lang/eng.traineddata.wasm",
    "../public/ocr/lang/chi_sim.traineddata.wasm",
  ];
  await Promise.all(requiredAssets.map((path) => access(new URL(path, import.meta.url))));
  const clientSource = await readFile(new URL("../app/lib/pdf-import-client.ts", import.meta.url), "utf8");
  const workerSource = await readFile(new URL("../scripts/ocr-worker-wrapper.js", import.meta.url), "utf8");
  assert.match(clientSource, /workerPath:\s*`\$\{assetBase\}worker-orbit\.js`/u);
  assert.match(clientSource, /workerBlobURL:\s*false/u);
  assert.match(
    clientSource,
    /corePath:\s*`\$\{assetBase\}core\/tesseract-core-\$\{detectOcrCoreVariant\(\)\}\.wasm\.js`/u,
  );
  assert.match(clientSource, /loadBundledOcrLanguages\(request\.language, assetBase/u);
  assert.match(workerSource, /action\s*!==\s*["']initialize["']/u);
  assert.match(workerSource, /language\.code/u);
  assert.doesNotMatch(clientSource, /cdn\.jsdelivr|unpkg/iu);
});

test("prepares ignored browser runtime assets before the direct unit suite", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const prepareSource = await readFile(new URL("../scripts/prepare-ocr.mjs", import.meta.url), "utf8");
  assert.match(packageJson.scripts["test:unit"], /^npm run prepare:runtime && node /u);
  assert.equal(
    packageJson.scripts["prepare:runtime"],
    "npm run prepare:ocr && npm run prepare:duckdb && npm run prepare:qpdf && npm run prepare:ghostscript",
  );
  assert.match(prepareSource, /createHash\("sha256"\)/u);
  assert.match(prepareSource, /sameContents/u);
  assert.doesNotMatch(prepareSource, /sameSize/u);
});
