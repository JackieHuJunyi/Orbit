// Regenerates the browser SQL runtime under public/duckdb from the exact
// pinned npm package. The copies are gitignored so local and deployed builds
// stay same-origin without committing the generated ~39 MB worker/Wasm pair.
import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const COPIES = [
  ["node_modules/@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm", "public/duckdb/duckdb-mvp.wasm"],
  ["node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js", "public/duckdb/duckdb-browser-mvp.worker.js"],
];

const OBSOLETE_ASSETS = ["public/duckdb/duckdb-eh.wasm", "public/duckdb/duckdb-browser-eh.worker.js"];

await Promise.all(OBSOLETE_ASSETS.map((path) => rm(resolve(root, path), { force: true })));

for (const [from, to] of COPIES) {
  const source = resolve(root, from);
  const dest = resolve(root, to);
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(source, dest);
  process.stdout.write(`prepare:duckdb ${to}\n`);
}
