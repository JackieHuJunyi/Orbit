import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { compilePilotProblemGate, renderPilotProblemGateMarkdown } from "../app/lib/pilot-problem-gate.ts";

const args = process.argv.slice(2);
if (args.length !== 1 || args.includes("--help") || args.includes("-h")) {
  console.error("Usage: npm run pilot:interviews -- <interviews.json>");
  process.exit(args.includes("--help") || args.includes("-h") ? 0 : 1);
}

const inputPath = path.resolve(args[0]);
let input;
try {
  const stats = await lstat(inputPath);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size > 128 * 1_024) throw new Error("invalid file");
  input = JSON.parse(await readFile(inputPath, "utf8"));
} catch {
  throw new Error("P1 interviews must be a regular JSON file no larger than 128 KB.");
}

process.stdout.write(renderPilotProblemGateMarkdown(compilePilotProblemGate(input)));
