import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const ASSETS = ["duckdb-mvp.wasm", "duckdb-browser-mvp.worker.js"];

test("prepares exact same-origin DuckDB worker and Wasm assets from the pinned package", async () => {
  for (const name of ASSETS) {
    const [source, prepared] = await Promise.all([
      stat(new URL(`../node_modules/@duckdb/duckdb-wasm/dist/${name}`, import.meta.url)),
      stat(new URL(`../public/duckdb/${name}`, import.meta.url)),
    ]);
    assert.equal(prepared.size, source.size, name);
    assert.ok(prepared.size > 0, name);
  }
});

test("the browser SQL runtime uses same-origin assets and a bounded initialization", async () => {
  const [source, previewSource, playwrightConfig] = await Promise.all([
    readFile(new URL("../app/lib/duckdb-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/artifact-previews.tsx", import.meta.url), "utf8"),
    readFile(new URL("../playwright.config.ts", import.meta.url), "utf8"),
  ]);
  assert.match(source, /new URL\(`\/duckdb\/\$\{name\}`,[^)]*window\.location\.origin\)/u);
  assert.match(source, /new Worker\(bundle\.mainWorker\)/u);
  assert.match(source, /duckdb-mvp\.wasm/u);
  assert.match(source, /DUCKDB_MAX_WASM_BYTES = 45 \* 1024 \* 1024/u);
  assert.match(source, /new Blob\(\[wasmBlob\], \{ type: "application\/wasm" \}\)/u);
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
