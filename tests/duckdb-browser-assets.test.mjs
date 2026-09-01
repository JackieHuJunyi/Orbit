import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("prepares exact same-origin DuckDB worker and deployable Wasm parts from the pinned package", async () => {
  const [sourceWasm, sourceWorker, preparedWorker, manifestSource] = await Promise.all([
    stat(new URL("../node_modules/@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm", import.meta.url)),
    stat(new URL("../node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js", import.meta.url)),
    stat(new URL("../public/duckdb/duckdb-browser-mvp.worker.js", import.meta.url)),
    readFile(new URL("../public/duckdb/duckdb-mvp.wasm.manifest.json", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(manifestSource);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.totalBytes, sourceWasm.size);
  assert.equal(preparedWorker.size, sourceWorker.size);
  assert.ok(manifest.parts.length >= 2);
  let preparedWasmBytes = 0;
  for (const part of manifest.parts) {
    assert.match(part.name, /^duckdb-mvp\.wasm\.part-\d+$/u);
    const prepared = await stat(new URL(`../public/duckdb/${part.name}`, import.meta.url));
    assert.equal(prepared.size, part.bytes);
    assert.ok(prepared.size > 0);
    assert.ok(prepared.size <= 20 * 1024 * 1024);
    preparedWasmBytes += prepared.size;
  }
  assert.equal(preparedWasmBytes, sourceWasm.size);
});

test("the browser SQL runtime uses same-origin assets and a bounded initialization", async () => {
  const [source, previewSource, playwrightConfig] = await Promise.all([
    readFile(new URL("../app/lib/duckdb-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/artifact-previews.tsx", import.meta.url), "utf8"),
    readFile(new URL("../playwright.config.ts", import.meta.url), "utf8"),
  ]);
  assert.match(source, /new URL\(`\/duckdb\/\$\{name\}`,[^)]*window\.location\.origin\)/u);
  assert.match(source, /new Worker\(bundle\.mainWorker\)/u);
  assert.match(source, /duckdb-mvp\.wasm\.manifest\.json/u);
  assert.match(source, /fetchDuckDbWasm/u);
  assert.match(source, /partUrl\.origin !== window\.location\.origin/u);
  assert.match(source, /DUCKDB_MAX_WASM_BYTES = 45 \* 1024 \* 1024/u);
  assert.match(source, /DUCKDB_MAX_WASM_PART_BYTES = 20 \* 1024 \* 1024/u);
  assert.match(source, /part\.name === `duckdb-mvp\.wasm\.part-\$\{index\}`/u);
  assert.match(source, /new Blob\(blobs, \{ type: "application\/wasm" \}\)/u);
  assert.match(source, /signal\?\.throwIfAborted\(\)/u);
  assert.match(source, /DUCKDB_INIT_TIMEOUT_MS = 30_000/u);
  assert.match(source, /worker\.terminate\(\)/u);
  assert.match(source, /URL\.revokeObjectURL\(wasmModuleUrl\)/u);
  assert.doesNotMatch(source, /duckdb-eh|importScripts/iu);
  assert.doesNotMatch(source, /cdn\.jsdelivr|unpkg|https?:\/\//iu);
  assert.match(previewSource, /PREVIEW_QUERY_IDLE_DELAY_MS = 1_200/u);
  assert.match(previewSource, /runWorkspaceQuerySnapshot\(query, resolution\.artifact, abortController\.signal\)/u);
  assert.match(previewSource, /abortController\.abort\(\)/u);
  assert.match(playwrightConfig, /workers: 1/u);
});
