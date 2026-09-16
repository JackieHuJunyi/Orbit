// Regenerates the runtime OCR assets under public/ocr from node_modules
// (worker + wasm cores) and the tracked vendor/tessdata language packs.
// These copies are gitignored; this keeps ~24 MB of wasm out of the repository
// while still serving the exact same-origin files the browser OCR worker needs.
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const COPIES = [
  ["scripts/ocr-worker-wrapper.js", "public/ocr/worker-orbit.js"],
  ["node_modules/tesseract.js/dist/worker.min.js", "public/ocr/worker.min.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm", "public/ocr/core/tesseract-core-lstm.wasm"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "public/ocr/core/tesseract-core-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm", "public/ocr/core/tesseract-core-simd-lstm.wasm"],
  [
    "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
    "public/ocr/core/tesseract-core-simd-lstm.wasm.js",
  ],
  [
    "node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm",
    "public/ocr/core/tesseract-core-relaxedsimd-lstm.wasm",
  ],
  [
    "node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js",
    "public/ocr/core/tesseract-core-relaxedsimd-lstm.wasm.js",
  ],
  ["vendor/tessdata/eng.traineddata.gz", "public/ocr/lang/eng.traineddata.wasm"],
  ["vendor/tessdata/chi_sim.traineddata.gz", "public/ocr/lang/chi_sim.traineddata.wasm"],
  ["vendor/tessdata/TESSDATA-LICENSE", "public/ocr/TESSDATA-LICENSE"],
  ["vendor/tessdata/TESSERACT-CORE-LICENSE", "public/ocr/TESSERACT-CORE-LICENSE"],
  ["vendor/tessdata/TESSERACT-JS-LICENSE.md", "public/ocr/TESSERACT-JS-LICENSE.md"],
];

await Promise.all(
  ["public/ocr/lang/eng.traineddata.gz", "public/ocr/lang/chi_sim.traineddata.gz"].map((file) =>
    rm(resolve(root, file), { force: true }),
  ),
);

async function fileHash(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function sameContents(source, dest) {
  try {
    const [a, b] = await Promise.all([stat(source), stat(dest)]);
    if (a.size !== b.size) return false;
    const [sourceHash, destHash] = await Promise.all([fileHash(source), fileHash(dest)]);
    return sourceHash === destHash;
  } catch {
    return false;
  }
}

for (const [from, to] of COPIES) {
  const source = resolve(root, from);
  const dest = resolve(root, to);
  if (await sameContents(source, dest)) continue;
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(source, dest);
  process.stdout.write(`prepare:ocr ${to}\n`);
}
