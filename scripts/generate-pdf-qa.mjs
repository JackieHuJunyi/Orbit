import { mkdir, readFile, writeFile } from "node:fs/promises";
import { exportPdfArtifact, ORBIT_PDF_FONT_PATH } from "../app/lib/pdf-export.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";
import { defaultQuerySnapshot, defaultSummaryQuerySnapshot } from "../tests/query-snapshot-fixture.mjs";

const outputDirectory = new URL("../output/pdf/", import.meta.url);
const fontBytes = new Uint8Array(await readFile(new URL(`../public${ORBIT_PDF_FONT_PATH}`, import.meta.url)));
const snapshots = [defaultQuerySnapshot(), defaultSummaryQuerySnapshot()];
const targets = [
  ["document", "orbit-v025-q2-review.pdf"],
  ["data", "orbit-v052-regional-revenue.pdf"],
  ["slides", "orbit-v025-board-briefing.pdf"],
];

await mkdir(outputDirectory, { recursive: true });
for (const [kind, fileName] of targets) {
  const artifact = defaultArtifacts.find((candidate) => candidate.kind === kind);
  if (!artifact) throw new Error(`Missing default ${kind} artifact.`);
  const result = await exportPdfArtifact(artifact, defaultArtifacts, snapshots, fontBytes);
  await writeFile(new URL(fileName, outputDirectory), result.bytes);
  console.log(`${fileName}\t${result.bytes.length} bytes\t${result.warnings.length} fidelity notes`);
}
