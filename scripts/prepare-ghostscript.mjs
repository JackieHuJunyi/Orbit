import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "node_modules", "@jspawn", "ghostscript-wasm");
const destination = path.join(root, "public", "ghostscript");

await mkdir(destination, { recursive: true });
await Promise.all(
  ["gs.js", "gs.wasm"].map((fileName) => copyFile(path.join(source, fileName), path.join(destination, fileName))),
);
