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
import { defaultQuerySnapshot, defaultSummaryQuerySnapshot } from "./query-snapshot-fixture.mjs";

function defaultRuntimeSnapshots() {
  return [defaultQuerySnapshot(), defaultSummaryQuerySnapshot()];
}

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

function assertPptSlideBounds(parts) {
  Object.entries(parts)
    .filter(([path]) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .forEach(([path, bytes]) => {
      const document = new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
      const transforms = [
        ...Array.from(document.getElementsByTagName("a:xfrm")),
        ...Array.from(document.getElementsByTagName("p:xfrm")),
      ];
      transforms.forEach((transform) => {
        const offset = transform.getElementsByTagName("a:off")[0];
        const extent = transform.getElementsByTagName("a:ext")[0];
        if (!offset || !extent) return;
        const x = Number(offset.getAttribute("x"));
        const y = Number(offset.getAttribute("y"));
        const width = Number(extent.getAttribute("cx"));
        const height = Number(extent.getAttribute("cy"));
        assert.ok(x >= 0 && y >= 0 && width >= 0 && height >= 0, `${path} shape geometry must be non-negative`);
        assert.ok(x + width <= 12_192_000, `${path} shape must fit the 16:9 slide width`);
        assert.ok(y + height <= 6_858_000, `${path} shape must fit the 16:9 slide height`);
      });
    });
}

const onePixelPng = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwTtWQAAAABJRU5ErkJggg==", "base64"));
const runeImageId = "a".repeat(64);
const runeImageAsset = { id: runeImageId, name: "proof.png", mimeType: "image/png", size: onePixelPng.length, bytes: onePixelPng };

test("embeds verified Rune local images into portable DOCX media", () => {
  const artifact = {
    id: "image-report",
    name: "image-report.md",
    kind: "document",
    language: "Markdown",
    source: `# Image report\n\n![Portable proof](rune-asset:sha256:${runeImageId})\n`,
  };
  const exported = exportOfficeArtifact(artifact, [artifact], [], [runeImageAsset]);
  const parts = packageParts(exported.bytes);
  assert.deepEqual(parts[`word/media/rune-${runeImageId}.png`], onePixelPng);
  assert.match(strFromU8(parts["word/document.xml"]), /<w:drawing>/u);
  assert.match(strFromU8(parts["word/_rels/document.xml.rels"]), /relationships\/image/u);
  assert.match(strFromU8(parts["[Content_Types].xml"]), /ContentType="image\/png"/u);
  assert.match(exported.warnings.join(" "), /embedded as portable, static DOCX media/iu);
});

test("fails DOCX export closed when a referenced Rune image is missing", () => {
  const artifact = { id: "missing", name: "missing.md", kind: "document", language: "Markdown", source: `![Missing](rune-asset:sha256:${runeImageId})` };
  assert.throws(() => exportOfficeArtifact(artifact), /Referenced local image is missing or corrupt/iu);
});

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
  const snapshots = defaultRuntimeSnapshots();
  const compiled = compileArtifactSource(artifact.source, defaultArtifacts, snapshots);
  const exportArtifact = { ...artifact, source: compiled.source };
  const first = exportOfficeArtifact(exportArtifact, defaultArtifacts, snapshots);
  const second = exportOfficeArtifact(exportArtifact, defaultArtifacts, snapshots);
  assert.equal(first.targetType, "pptx");
  assert.equal(first.fileName, "board-briefing.pptx");
  assert.deepEqual(first.bytes, second.bytes);
  assert.match(first.warnings.join(" "), /editable native PowerPoint text and vector shapes/i);
  const parts = packageParts(first.bytes);
  [
    "[Content_Types].xml",
    "ppt/presentation.xml",
    "ppt/slideMasters/slideMaster1.xml",
    "ppt/slideLayouts/slideLayout1.xml",
    "ppt/theme/theme1.xml",
    "ppt/slides/slide1.xml",
  ].forEach((path) => assert.ok(parts[path], `${path} should exist`));
  assertPptSlideBounds(parts);
  const slideXml = Object.entries(parts)
    .filter(([path]) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .map(([, bytes]) => strFromU8(bytes))
    .join("\n");
  assert.match(slideXml, /Q2 revenue by region/);
  assert.match(slideXml, /Gross margin by region/);
  assert.match(slideXml, /Q2 revenue by region bar 1/);
  assert.match(slideXml, /APAC/);
  assert.match(slideXml, /\$1\.84M/);
  assert.doesNotMatch(slideXml, /Chart omitted/);

  const imported = convertOfficeFile(first.fileName, first.bytes);
  const roundTrip = imported.artifacts[0];
  assert.match(roundTrip.source, /Growth became more durable/);
  assert.match(roundTrip.source, /Momentum with healthier economics/);
  assert.match(roundTrip.source, /\| Q2 revenue \| Quarter over quarter \| Gross margin \|/);
  assert.equal(compileDeckSource(roundTrip.source).slideCount, 4);
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
  const snapshots = defaultRuntimeSnapshots();
  const compiled = compileArtifactSource(document.source, defaultArtifacts, snapshots);
  assert.deepEqual(compiled.unresolved, []);
  assert.doesNotMatch(compiled.source, /\{\{\s*metric/);
  const exported = exportOfficeArtifact({ ...document, source: compiled.source }, defaultArtifacts, snapshots);
  const parts = packageParts(exported.bytes);
  const documentXml = strFromU8(parts["word/document.xml"]);
  assert.doesNotMatch(documentXml, /\{\{\s*metric/);
  assert.match(documentXml, /\$4\.82M/);
  assert.match(documentXml, /Q2 revenue by region/);
  assert.match(documentXml, /APAC/);
  assert.match(documentXml, /\$1\.84M/);
  assert.match(documentXml, /█/);
  assert.doesNotMatch(documentXml, /Chart omitted/);
  assert.match(exported.warnings.join(" "), /semantic bar table/i);

  const compiledDeck = compileArtifactSource(deck.source, defaultArtifacts, snapshots);
  assert.deepEqual(compiledDeck.unresolved, []);
  const pptx = exportOfficeArtifact({ ...deck, source: compiledDeck.source }, defaultArtifacts, snapshots);
  const slideXml = Object.entries(packageParts(pptx.bytes))
    .filter(([path]) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .map(([, bytes]) => strFromU8(bytes))
    .join("\n");
  assert.doesNotMatch(slideXml, /\{\{\s*metric/);
  assert.match(slideXml, /\$4\.82M/);
  assert.match(slideXml, /Q2 revenue by region/);
  assert.match(slideXml, /North America/);
  assert.match(slideXml, /Q2 revenue by region track 1/);
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

test("keeps hostile chart snapshot text inside escaped Office text nodes", () => {
  const data = {
    id: "hostile-data",
    name: "hostile-data.csv",
    kind: "data",
    language: "CSV",
    source: "Region,Revenue\nA&B<region>,42\n",
  };
  const chart = {
    id: "hostile-chart",
    name: "hostile.chart.json",
    kind: "chart",
    language: "Chart JSON",
    source: JSON.stringify({
      version: 1,
      title: "<script>alert & review</script>",
      description: "Current <unsafe> label",
      source: data.id,
      mark: "bar",
      category: "Region",
      value: "Revenue",
      sort: "source",
      format: "number",
      color: "#ff5c35",
      maxItems: 8,
    }),
  };
  const document = {
    id: "hostile-document",
    name: "hostile.md",
    kind: "document",
    language: "Markdown",
    source: '# Chart\n\n{{ chart("hostile-chart") }}\n',
  };
  const deck = {
    id: "hostile-deck",
    name: "hostile.deck.md",
    kind: "slides",
    language: "Deck Markdown",
    source: `---
version: 1
title: Hostile chart proof
theme: rune
ratio: 16:9
lang: en
---

# Safe slide

{{ chart("hostile-chart") }}
`,
  };
  const workspace = [document, data, chart, deck];
  const docxXml = Object.values(packageParts(exportOfficeArtifact(document, workspace).bytes)).map((bytes) => strFromU8(bytes)).join("\n");
  const pptxXml = Object.values(packageParts(exportOfficeArtifact(deck, workspace).bytes)).map((bytes) => strFromU8(bytes)).join("\n");
  assert.doesNotMatch(docxXml, /<script>/i);
  assert.doesNotMatch(pptxXml, /<script>/i);
  assert.match(pptxXml, /&lt;script&gt;alert &amp; review&lt;\/script&gt;/);
  assert.match(pptxXml, /A&amp;B&lt;region&gt;/);
});

test("keeps a 20-mark chart snapshot inside a content slide", () => {
  const rows = Array.from({ length: 20 }, (_, index) => `Region ${index + 1},${20 - index}`).join("\n");
  const data = {
    id: "full-chart-data",
    name: "full-chart-data.csv",
    kind: "data",
    language: "CSV",
    source: `Region,Value\n${rows}\n`,
  };
  const chart = {
    id: "full-chart",
    name: "full-chart.chart.json",
    kind: "chart",
    language: "Chart JSON",
    source: JSON.stringify({ version: 1, title: "Twenty marks", description: "Bounded layout proof", source: data.id, mark: "bar", category: "Region", value: "Value", sort: "source", format: "number", color: "#3676d1", maxItems: 20 }),
  };
  const deck = {
    id: "full-chart-deck",
    name: "full-chart.deck.md",
    kind: "slides",
    language: "Deck Markdown",
    source: `---
version: 1
title: Full chart proof
theme: rune
ratio: 16:9
lang: en
---

<!-- layout: content -->

# Full chart

All twenty marks stay inside the slide canvas.

{{ chart("full-chart") }}
`,
  };
  const parts = packageParts(exportOfficeArtifact(deck, [deck, data, chart]).bytes);
  assertPptSlideBounds(parts);
  const slideXml = strFromU8(parts["ppt/slides/slide1.xml"]);
  assert.match(slideXml, /Region 20/);
  assert.match(slideXml, /Twenty marks bar 20/);
});

test("freezes line charts as semantic DOCX trends and native PPTX vector lines", () => {
  const data = { id: "trend-data", name: "trend.csv", kind: "data", language: "CSV / JSON", source: "Month,Value\nJan,10\nFeb,30\nMar,20\n" };
  const chart = {
    id: "trend-chart",
    name: "trend.chart.json",
    kind: "chart",
    language: "Chart JSON",
    source: JSON.stringify({ version: 1, title: "Monthly trend", description: "Ordered source values", source: data.id, mark: "line", category: "Month", value: "Value", sort: "source", format: "number", color: "#3676d1", maxItems: 8 }),
  };
  const document = { id: "trend-report", name: "trend.md", kind: "document", language: "Markdown", source: '# Trend\n\n{{ chart("trend-chart") }}\n' };
  const deck = {
    id: "trend-deck",
    name: "trend.deck.md",
    kind: "slides",
    language: "Deck Markdown",
    source: `---
version: 1
title: Trend review
theme: rune
ratio: 16:9
lang: en
---

# Monthly trend

{{ chart("trend-chart") }}
`,
  };
  const workspace = [document, data, chart, deck];
  const docx = exportOfficeArtifact(document, workspace);
  const docxXml = strFromU8(packageParts(docx.bytes)["word/document.xml"]);
  assert.match(docxXml, /Trend/);
  assert.match(docxXml, /Increase/);
  assert.match(docxXml, /Decrease/);
  assert.match(docx.warnings.join(" "), /semantic trend table/i);

  const pptx = exportOfficeArtifact(deck, workspace);
  const parts = packageParts(pptx.bytes);
  assertPptSlideBounds(parts);
  const slideXml = strFromU8(parts["ppt/slides/slide1.xml"]);
  assert.match(slideXml, /Monthly trend line segment 1/);
  assert.match(slideXml, /Monthly trend line segment 2/);
  assert.match(slideXml, /Monthly trend point 3/);
  assert.doesNotMatch(slideXml, /Monthly trend bar 1/);
});
