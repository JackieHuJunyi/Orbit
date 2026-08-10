import assert from "node:assert/strict";
import test from "node:test";

import { DOMParser } from "@xmldom/xmldom";
import { strFromU8, unzipSync } from "fflate";
import { compileDeckSource } from "../app/lib/deck.ts";
import { compileArtifactSource } from "../app/lib/bindings.ts";
import {
  MAX_OFFICE_EXPORT_SOURCE_CHARS,
  exportOfficeArtifact,
  isOfficeExportArtifact,
} from "../app/lib/office-export.ts";
import { convertOfficeFile } from "../app/lib/office-import.ts";
import { defaultArtifacts, parseDataSource, validateArtifact } from "../app/lib/workspace.ts";

function packageParts(bytes) {
  const parts = unzipSync(bytes);
  Object.entries(parts).forEach(([path, data]) => {
    if (!/\.(?:xml|rels)$/.test(path)) return;
    const issues = [];
    const document = new DOMParser({ onError(_level, message) { issues.push(message); } })
      .parseFromString(strFromU8(data), "application/xml");
    assert.ok(document.documentElement, `${path} needs an XML root`);
    assert.deepEqual(issues, [], `${path} should be well-formed XML`);
  });
  return parts;
}

test("exports Markdown as deterministic semantic DOCX and imports it back", () => {
  const artifact = {
    id: "export-report",
    name: "export-report.md",
    kind: "document",
    language: "Markdown",
    source: `# Exported report

This has **bold text**, _emphasis_, ~~old copy~~, and a [source](https://example.com/report).

- First action
- Second action

| Owner | Status |
| --- | --- |
| Growth | Ready |

![Pipeline diagram](pipeline.png)
`,
  };
  const first = exportOfficeArtifact(artifact);
  const second = exportOfficeArtifact(artifact);
  assert.equal(first.targetType, "docx");
  assert.equal(first.fileName, "export-report.docx");
  assert.deepEqual(first.bytes, second.bytes);
  assert.match(first.warnings.join(" "), /images are not embedded/i);
  const parts = packageParts(first.bytes);
  ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/numbering.xml"]
    .forEach((path) => assert.ok(parts[path], `${path} should exist`));

  const imported = convertOfficeFile(first.fileName, first.bytes);
  const roundTrip = imported.artifacts[0];
  assert.match(roundTrip.source, /^# Exported report/m);
  assert.match(roundTrip.source, /\*\*bold text\*\*/);
  assert.match(roundTrip.source, /\[source\]\(<https:\/\/example\.com\/report>\)/);
  assert.match(roundTrip.source, /^- First action/m);
  assert.match(roundTrip.source, /\| Owner \| Status \|/);
  assert.match(roundTrip.source, /Image omitted: Pipeline diagram/);
  assert.deepEqual(validateArtifact(roundTrip), []);
});

test("exports CSV values as deterministic formula-safe XLSX and imports them back", () => {
  const artifact = {
    id: "operating-model",
    name: "operating-model.csv",
    kind: "data",
    language: "CSV",
    source: "Region,Revenue,Active,Note\nAPAC,1840000,true,=WEBSERVICE\nEurope,970000,false,Reviewed\n",
  };
  const first = exportOfficeArtifact(artifact);
  const second = exportOfficeArtifact(artifact);
  assert.equal(first.targetType, "xlsx");
  assert.equal(first.fileName, "operating-model.xlsx");
  assert.deepEqual(first.bytes, second.bytes);
  assert.match(first.warnings.join(" "), /typed values only/i);
  const parts = packageParts(first.bytes);
  ["[Content_Types].xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml", "xl/styles.xml"]
    .forEach((path) => assert.ok(parts[path], `${path} should exist`));
  const worksheet = strFromU8(parts["xl/worksheets/sheet1.xml"]);
  assert.doesNotMatch(worksheet, /<f[\s>]/);
  assert.match(worksheet, /t="inlineStr"/);

  const imported = convertOfficeFile(first.fileName, first.bytes);
  const roundTrip = imported.artifacts[0];
  assert.match(roundTrip.source, /Region,Revenue,Active,Note/);
  assert.match(roundTrip.source, /APAC,1840000,true,'=WEBSERVICE/);
  assert.match(imported.warnings.join(" "), /formula-leading text/i);
  const data = parseDataSource(roundTrip.source);
  assert.deepEqual(data.errors, []);
  assert.equal(data.rows[0].Revenue, 1840000);
  assert.equal(data.rows[1].Active, false);
});

test("exports Deck Markdown as deterministic semantic PPTX and imports it back", () => {
  const artifact = defaultArtifacts.find((candidate) => candidate.kind === "slides");
  assert.ok(artifact);
  const first = exportOfficeArtifact(artifact);
  const second = exportOfficeArtifact(artifact);
  assert.equal(first.targetType, "pptx");
  assert.equal(first.fileName, "board-briefing.pptx");
  assert.deepEqual(first.bytes, second.bytes);
  assert.match(first.warnings.join(" "), /live charts/i);
  const parts = packageParts(first.bytes);
  [
    "[Content_Types].xml",
    "ppt/presentation.xml",
    "ppt/slideMasters/slideMaster1.xml",
    "ppt/slideLayouts/slideLayout1.xml",
    "ppt/theme/theme1.xml",
    "ppt/slides/slide1.xml",
  ].forEach((path) => assert.ok(parts[path], `${path} should exist`));

  const imported = convertOfficeFile(first.fileName, first.bytes);
  const roundTrip = imported.artifacts[0];
  assert.match(roundTrip.source, /Growth became more durable/);
  assert.match(roundTrip.source, /Momentum with healthier economics/);
  assert.match(roundTrip.source, /\| Q2 revenue \| Quarter over quarter \| Gross margin \|/);
  assert.equal(compileDeckSource(roundTrip.source).slideCount, 3);
  assert.deepEqual(validateArtifact(roundTrip), []);
});

test("limits semantic Office export to supported bounded artifacts", () => {
  const document = defaultArtifacts.find((artifact) => artifact.kind === "document");
  const data = defaultArtifacts.find((artifact) => artifact.kind === "data");
  const deck = defaultArtifacts.find((artifact) => artifact.kind === "slides");
  const query = defaultArtifacts.find((artifact) => artifact.kind === "query");
  assert.ok(document && data && deck && query);
  assert.equal(isOfficeExportArtifact(document), true);
  assert.equal(isOfficeExportArtifact(data), true);
  assert.equal(isOfficeExportArtifact(deck), true);
  assert.equal(isOfficeExportArtifact(query), false);
  assert.throws(() => exportOfficeArtifact(query), /supports Markdown documents/i);
  assert.throws(
    () => exportOfficeArtifact({ ...document, source: "x".repeat(MAX_OFFICE_EXPORT_SOURCE_CHARS + 1) }),
    /2,000,000 source characters/,
  );
  assert.throws(
    () => exportOfficeArtifact({ ...document, source: "x".repeat(200_001) }),
    /200,000 source characters/,
  );
});

test("exports compiled workspace metrics instead of canonical template tokens", () => {
  const document = defaultArtifacts.find((artifact) => artifact.kind === "document");
  const deck = defaultArtifacts.find((artifact) => artifact.kind === "slides");
  assert.ok(document && deck);
  const compiled = compileArtifactSource(document.source, defaultArtifacts);
  assert.deepEqual(compiled.unresolved, []);
  assert.doesNotMatch(compiled.source, /\{\{\s*metric/);
  const exported = exportOfficeArtifact({ ...document, source: compiled.source });
  const parts = packageParts(exported.bytes);
  const documentXml = strFromU8(parts["word/document.xml"]);
  assert.doesNotMatch(documentXml, /\{\{\s*metric/);
  assert.match(documentXml, /\$4\.82M/);

  const compiledDeck = compileArtifactSource(deck.source, defaultArtifacts);
  assert.deepEqual(compiledDeck.unresolved, []);
  const pptx = exportOfficeArtifact({ ...deck, source: compiledDeck.source });
  const slideXml = Object.entries(packageParts(pptx.bytes))
    .filter(([path]) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .map(([, bytes]) => strFromU8(bytes))
    .join("\n");
  assert.doesNotMatch(slideXml, /\{\{\s*metric/);
  assert.match(slideXml, /\$4\.82M/);
});

test("keeps unsafe Markdown links out of Office relationships", () => {
  const document = {
    id: "unsafe-link",
    name: "unsafe-link.md",
    kind: "document",
    language: "Markdown",
    source: "# Safe export\n\n[Do not run](javascript:alert(1))\n",
  };
  const exported = exportOfficeArtifact(document);
  const parts = packageParts(exported.bytes);
  const relationships = strFromU8(parts["word/_rels/document.xml.rels"]);
  assert.doesNotMatch(relationships, /javascript:/i);
  assert.match(exported.warnings.join(" "), /non-HTTP Markdown link/i);
});

test("sanitizes cross-platform Office filenames", () => {
  const document = {
    id: "reserved-name",
    name: "CON.md",
    kind: "document",
    language: "Markdown",
    source: "# Safe filename\n",
  };
  assert.equal(exportOfficeArtifact(document).fileName, "rune-CON.docx");
  assert.equal(exportOfficeArtifact({ ...document, name: "quarter:review?.md" }).fileName, "quarter-review-.docx");
});
