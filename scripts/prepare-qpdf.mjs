import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "node_modules", "@jspawn", "qpdf-wasm");
const destination = path.join(root, "public", "qpdf");

await mkdir(destination, { recursive: true });
await Promise.all(
  ["qpdf.js", "qpdf.wasm"].map((fileName) => copyFile(path.join(source, fileName), path.join(destination, fileName))),
);
