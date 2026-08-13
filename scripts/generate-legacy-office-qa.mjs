import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { convertLegacyOffice, exportLegacyOffice } from "../desktop/legacy-office.mjs";
import { exportOfficeArtifact } from "../app/lib/office-export.ts";
import { convertOfficeFile } from "../app/lib/office-import.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";

async function verifyRoundTrip(directory, kind, artifact) {
  const modernExport = exportOfficeArtifact(artifact, defaultArtifacts);
  const legacyName = `${path.basename(modernExport.fileName, `.${kind}x`)}.${kind}`;
  const legacyPath = path.join(directory, legacyName);
  const legacy = await exportLegacyOffice(undefined, { fileName: modernExport.fileName, bytes: modernExport.bytes });
  assert.equal(legacy.fileName, legacyName);
  await writeFile(legacyPath, legacy.bytes, { mode: 0o600 });
  const legacyBytes = new Uint8Array(await readFile(legacyPath));
  assert.ok(legacyBytes.length > 0, `${legacyName} must contain an Office binary package`);
  const converted = await convertLegacyOffice(undefined, { fileName: legacyName, bytes: legacyBytes });
  const imported = convertOfficeFile(converted.fileName, converted.bytes);
  assert.equal(imported.artifacts.length, 1);
  assert.match(converted.warning, /locally with Office macros force-disabled/);
  assert.match(legacy.warning, /verify it before delivery/i);
  if (kind === "doc") assert.match(imported.artifacts[0].source, /Q2 Business Review/i);
  else assert.match(imported.artifacts[0].source, /Q2 Board Briefing|Growth became more durable/i);
  return {
    convertedBytes: converted.bytes.length,
    importedChars: imported.artifacts[0].source.length,
    kind,
    legacyBytes: legacyBytes.length,
  };
}

const directory = await mkdtemp(path.join(tmpdir(), "rune-legacy-office-qa-"));
try {
  const document = defaultArtifacts.find((artifact) => artifact.kind === "document");
  const slides = defaultArtifacts.find((artifact) => artifact.kind === "slides");
  assert.ok(document && slides);
  const results = [];
  results.push(await verifyRoundTrip(directory, "doc", document));
  results.push(await verifyRoundTrip(directory, "ppt", slides));
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
