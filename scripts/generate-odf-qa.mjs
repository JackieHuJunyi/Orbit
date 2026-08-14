import { mkdir, writeFile } from "node:fs/promises";

import { compileArtifactSource } from "../app/lib/bindings.ts";
import { exportOdfArtifact } from "../app/lib/odf-export.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";
import { defaultQuerySnapshot, defaultSummaryQuerySnapshot } from "../tests/query-snapshot-fixture.mjs";

const outputDirectory = new URL("../tmp/odf/", import.meta.url);
const snapshots = [defaultQuerySnapshot(), defaultSummaryQuerySnapshot()];
const targets = [
  defaultArtifacts.find((artifact) => artifact.kind === "document"),
  defaultArtifacts.find((artifact) => artifact.kind === "data"),
  defaultArtifacts.find((artifact) => artifact.kind === "slides"),
];

await mkdir(outputDirectory, { recursive: true });
for (const artifact of targets) {
  if (!artifact) throw new Error("A default ODF QA artifact is missing.");
  const compiled =
    artifact.kind === "document" || artifact.kind === "slides"
      ? compileArtifactSource(artifact.source, defaultArtifacts, snapshots)
      : null;
  if (compiled?.metricBindingErrors.length || compiled?.unresolved.length || compiled?.unresolvedCharts.length) {
    throw new Error(`Default ${artifact.name} did not compile for ODF QA.`);
  }
  const result = exportOdfArtifact(
    compiled ? { ...artifact, source: compiled.source } : artifact,
    defaultArtifacts,
    snapshots,
  );
  await writeFile(new URL(result.fileName, outputDirectory), result.bytes);
  console.log(`${result.fileName}\t${result.bytes.length} bytes\t${result.warnings.length} fidelity notes`);
}
