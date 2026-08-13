import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { convertLegacyOffice } from "../desktop/legacy-office.mjs";
import { exportOfficeArtifact } from "../app/lib/office-export.ts";
import { convertOfficeFile } from "../app/lib/office-import.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";

const execFileAsync = promisify(execFile);

function modernToLegacyAppleScript(kind, modernPath, legacyPath) {
  const input = JSON.stringify(modernPath);
  const output = JSON.stringify(legacyPath);
  if (kind === "doc") return `
tell application "Microsoft Word"
  set oldSecurity to automation security
  set automation security to msoAutomationSecurityForceDisable
  set qaDocument to missing value
  try
    open file name ${input} read only false add to recent files false
    set qaDocument to active document
    save as qaDocument file name ${output} file format format document97 add to recent files false
    close qaDocument saving no
  on error errorMessage number errorNumber
    try
      if qaDocument is not missing value then close qaDocument saving no
    end try
    set automation security to oldSecurity
    error errorMessage number errorNumber
  end try
  set automation security to oldSecurity
end tell`;
  return `
tell application "Microsoft PowerPoint"
  set oldSecurity to automation security
  set automation security to msoAutomationSecurityForceDisable
  set hadSecurityValue to oldSecurity is not missing value
  set qaPresentation to missing value
  try
    open POSIX file ${input}
    set qaPresentation to active presentation
    save qaPresentation in POSIX file ${output} as save as presentation
    close qaPresentation
  on error errorMessage number errorNumber
    try
      if qaPresentation is not missing value then close qaPresentation
    end try
    if hadSecurityValue then set automation security to oldSecurity
    error errorMessage number errorNumber
  end try
  if hadSecurityValue then set automation security to oldSecurity
end tell`;
}

async function runOfficeScript(source) {
  await execFileAsync("/usr/bin/osascript", ["-e", source], {
    timeout: 60_000,
    maxBuffer: 128 * 1024,
  });
}

async function verifyRoundTrip(directory, kind, artifact) {
  const modernExport = exportOfficeArtifact(artifact, defaultArtifacts);
  const modernPath = path.join(directory, modernExport.fileName);
  const legacyName = kind === "doc" ? "rune-legacy-qa.doc" : "rune-legacy-qa.ppt";
  const legacyPath = path.join(directory, legacyName);
  await writeFile(modernPath, modernExport.bytes, { mode: 0o600 });
  await runOfficeScript(modernToLegacyAppleScript(kind, modernPath, legacyPath));
  const legacyBytes = new Uint8Array(await readFile(legacyPath));
  assert.ok(legacyBytes.length > 0, `${legacyName} must contain an Office binary package`);
  const converted = await convertLegacyOffice(undefined, { fileName: legacyName, bytes: legacyBytes });
  const imported = convertOfficeFile(converted.fileName, converted.bytes);
  assert.equal(imported.artifacts.length, 1);
  assert.match(converted.warning, /locally with Office macros force-disabled/);
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
