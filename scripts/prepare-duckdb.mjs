// Regenerates the browser SQL runtime under public/duckdb from the exact
// pinned npm package. The generated files are gitignored so local and deployed
// builds stay same-origin without committing the runtime. DuckDB's Wasm is
// split below common 25 MB static-asset limits and reassembled by the client.
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDirectory = resolve(root, "public/duckdb");
const wasmSource = resolve(root, "node_modules/@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm");
const workerSource = resolve(root, "node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js");
const workerDestination = resolve(runtimeDirectory, "duckdb-browser-mvp.worker.js");
const manifestDestination = resolve(runtimeDirectory, "duckdb-mvp.wasm.manifest.json");
const WASM_PART_BYTES = 20 * 1024 * 1024;

await mkdir(runtimeDirectory, { recursive: true });

const existingAssets = await readdir(runtimeDirectory).catch(() => []);
await Promise.all(
  existingAssets
    .filter(
      (name) =>
        name === "duckdb-mvp.wasm" ||
        name === "duckdb-eh.wasm" ||
        name === "duckdb-browser-eh.worker.js" ||
        /^duckdb-mvp\.wasm\.part-\d+$/u.test(name),
    )
    .map((name) => rm(resolve(runtimeDirectory, name), { force: true })),
);

const wasm = await readFile(wasmSource);
const parts = [];
for (let offset = 0, index = 0; offset < wasm.byteLength; offset += WASM_PART_BYTES, index += 1) {
  const name = `duckdb-mvp.wasm.part-${index}`;
  const bytes = wasm.subarray(offset, Math.min(offset + WASM_PART_BYTES, wasm.byteLength));
  await writeFile(resolve(runtimeDirectory, name), bytes);
  parts.push({ name, bytes: bytes.byteLength });
  process.stdout.write(`prepare:duckdb public/duckdb/${name}\n`);
}

await writeFile(
  manifestDestination,
  `${JSON.stringify({ schemaVersion: 1, totalBytes: wasm.byteLength, parts }, null, 2)}\n`,
);
await copyFile(workerSource, workerDestination);
process.stdout.write("prepare:duckdb public/duckdb/duckdb-mvp.wasm.manifest.json\n");
process.stdout.write("prepare:duckdb public/duckdb/duckdb-browser-mvp.worker.js\n");
