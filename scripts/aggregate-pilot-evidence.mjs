import { link, lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  MAX_RUNE_PILOT_COHORT_PARTICIPANTS,
  compileRunePilotCohort,
  renderRunePilotCohortMarkdown,
} from "../app/lib/pilot-evidence-cohort.ts";
import { MAX_RUNE_PILOT_EVIDENCE_BYTES } from "../app/lib/pilot-evidence.ts";

const args = process.argv.slice(2);
if (args.length < 1 || args.length > 2 || args.includes("--help") || args.includes("-h")) {
  console.error("Usage: npm run pilot:aggregate -- <manifest.json> [output-directory]");
  process.exit(args.includes("--help") || args.includes("-h") ? 0 : 1);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

const manifestPath = path.resolve(args[0]);
let manifest;
try {
  const bytes = await readFile(manifestPath);
  if (bytes.byteLength > 64 * 1_024) throw new Error("too large");
  manifest = JSON.parse(bytes.toString("utf8"));
} catch {
  throw new Error("Pilot manifest must be readable JSON no larger than 64 KB.");
}

if (
  !isRecord(manifest) ||
  !exactKeys(manifest, ["version", "participants"]) ||
  manifest.version !== 1 ||
  !Array.isArray(manifest.participants) ||
  manifest.participants.length < 1 ||
  manifest.participants.length > MAX_RUNE_PILOT_COHORT_PARTICIPANTS
) {
  throw new Error(`Pilot manifest requires version 1 and 1–${MAX_RUNE_PILOT_COHORT_PARTICIPANTS} participants.`);
}

const manifestDirectory = path.dirname(manifestPath);
const resolvedEvidencePaths = new Set();
const participants = [];
for (const entry of manifest.participants) {
  if (
    !isRecord(entry) ||
    !exactKeys(entry, ["participantId", "evidenceFile"]) ||
    typeof entry.participantId !== "string" ||
    typeof entry.evidenceFile !== "string" ||
    !entry.evidenceFile.endsWith(".json") ||
    entry.evidenceFile.length < 1 ||
    entry.evidenceFile.length > 240 ||
    path.isAbsolute(entry.evidenceFile) ||
    /[\u0000-\u001f\u007f]/u.test(entry.evidenceFile)
  ) {
    throw new Error("Each pilot manifest entry needs a participant-NNN alias and one relative JSON evidenceFile.");
  }
  const evidencePath = path.resolve(manifestDirectory, entry.evidenceFile);
  const relativePath = path.relative(manifestDirectory, evidencePath);
  if (
    !relativePath ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath) ||
    resolvedEvidencePaths.has(evidencePath)
  ) {
    throw new Error("Pilot evidence files must be unique files inside the manifest directory.");
  }
  resolvedEvidencePaths.add(evidencePath);
  let evidence;
  try {
    const stats = await lstat(evidencePath);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size > MAX_RUNE_PILOT_EVIDENCE_BYTES)
      throw new Error("invalid file");
    evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  } catch {
    throw new Error(`Evidence for ${entry.participantId} must be a regular JSON file no larger than 128 KB.`);
  }
  participants.push({ participantId: entry.participantId, evidence });
}

const report = compileRunePilotCohort(participants);
const markdown = renderRunePilotCohortMarkdown(report);
if (!args[1]) {
  process.stdout.write(markdown);
} else {
  const outputDirectory = path.resolve(args[1]);
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  const outputStats = await lstat(outputDirectory);
  if (!outputStats.isDirectory() || outputStats.isSymbolicLink())
    throw new Error("Pilot output must be a regular local directory.");
  const baseName = `rune-pilot-cohort-${report.compiledOn}`;
  const jsonPath = path.join(outputDirectory, `${baseName}.json`);
  const markdownPath = path.join(outputDirectory, `${baseName}.md`);
  const jsonTemporary = `${jsonPath}.tmp-${process.pid}`;
  const markdownTemporary = `${markdownPath}.tmp-${process.pid}`;
  const created = [];
  try {
    await writeFile(jsonTemporary, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    created.push(jsonTemporary);
    await writeFile(markdownTemporary, markdown, { flag: "wx", mode: 0o600 });
    created.push(markdownTemporary);
    await link(jsonTemporary, jsonPath);
    created.push(jsonPath);
    await link(markdownTemporary, markdownPath);
    created.push(markdownPath);
    await rm(jsonTemporary);
    await rm(markdownTemporary);
  } catch {
    await Promise.all(created.map((file) => rm(file, { force: true }).catch(() => undefined)));
    throw new Error("Pilot cohort output already exists or could not be written atomically.");
  }
  process.stdout.write(`Wrote ${path.basename(jsonPath)} and ${path.basename(markdownPath)}.\n`);
}
