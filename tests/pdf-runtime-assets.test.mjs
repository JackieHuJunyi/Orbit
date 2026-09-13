import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("prepares pinned same-origin PDF workers and keeps heavy runtimes out of React", async () => {
  const [packageJson, qpdfPrepare, ghostscriptPrepare, qpdfWorker, ghostscriptWorker, executor, component] =
    await Promise.all([
      readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
      readFile(new URL("../scripts/prepare-qpdf.mjs", import.meta.url), "utf8"),
      readFile(new URL("../scripts/prepare-ghostscript.mjs", import.meta.url), "utf8"),
      readFile(new URL("../public/qpdf/qpdf-worker.js", import.meta.url), "utf8"),
      readFile(new URL("../public/ghostscript/ghostscript-worker.js", import.meta.url), "utf8"),
      readFile(new URL("../app/lib/pdf-tool-executor.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/components/pdf-tool-center.tsx", import.meta.url), "utf8"),
    ]);
  assert.equal(packageJson.dependencies["@jspawn/qpdf-wasm"], "0.0.2");
  assert.equal(packageJson.dependencies["@jspawn/ghostscript-wasm"], "0.0.2");
  assert.match(packageJson.scripts["prepare:runtime"], /prepare:qpdf.*prepare:ghostscript/u);
  assert.match(qpdfPrepare, /node_modules.*qpdf-wasm/su);
  assert.match(ghostscriptPrepare, /node_modules.*ghostscript-wasm/su);
  assert.match(qpdfWorker, /importScripts\("\.\/qpdf\.js"\)/u);
  assert.match(qpdfWorker, /qpdf\.wasm/u);
  assert.match(ghostscriptWorker, /importScripts\("\.\/gs\.js"\)/u);
  assert.match(ghostscriptWorker, /-dPDFA=2/u);
  assert.match(ghostscriptWorker, /-dSAFER/u);
  assert.match(executor, /runQpdfOperation/u);
  assert.match(executor, /convertPdfToPdfA/u);
  assert.doesNotMatch(component, /@jspawn|pdfjs-dist|ghostscript-wasm|qpdf-wasm/u);
  assert.ok((await stat(new URL("../public/qpdf/qpdf.wasm", import.meta.url))).size > 1_000_000);
  assert.ok((await stat(new URL("../public/ghostscript/gs.wasm", import.meta.url))).size > 10_000_000);
});
