import assert from "node:assert/strict";
import test from "node:test";

import { DOMParser } from "@xmldom/xmldom";
import { strFromU8, unzipSync } from "fflate";

import { compileArtifactSource } from "../app/lib/bindings.ts";
import { compileDeckSource } from "../app/lib/deck.ts";
import { MAX_ODF_EXPORT_SOURCE_CHARS, exportOdfArtifact, isOdfExportArtifact } from "../app/lib/odf-export.ts";
import { convertOdfFile, convertOdfFileWithAssets } from "../app/lib/odf-import.ts";
import { defaultArtifacts, parseDataSource, validateArtifact } from "../app/lib/workspace.ts";
import { defaultQuerySnapshot, defaultSummaryQuerySnapshot } from "./query-snapshot-fixture.mjs";

function snapshots() {
  return [defaultQuerySnapshot(), defaultSummaryQuerySnapshot()];
}

function firstZipEntry(bytes) {
  const compression = bytes[8] | (bytes[9] << 8);
  const nameLength = bytes[26] | (bytes[27] << 8);
  const name = new TextDecoder().decode(bytes.subarray(30, 30 + nameLength));
  return { name, compression };
}

function packageParts(bytes) {
  const first = firstZipEntry(bytes);
  assert.deepEqual(first, { name: "mimetype", compression: 0 });
  const parts = unzipSync(bytes);
  ["content.xml", "styles.xml", "meta.xml", "META-INF/manifest.xml"].forEach((path) => {
    assert.ok(parts[path], `${path} should exist`);
    const issues = [];
    const document = new DOMParser({
      onError(_level, message) {
        issues.push(message);
      },
    }).parseFromString(strFromU8(parts[path]), "application/xml");
    assert.ok(document.documentElement, `${path} needs an XML root`);
    assert.deepEqual(issues, [], `${path} should be well-formed XML`);
  });
  return parts;
}

const onePixelPng = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwTtWQAAAABJRU5ErkJggg==",
    "base64",
  ),
);
const runeImageId = "b".repeat(64);
const runeImageAsset = {
  id: runeImageId,
  name: "proof.png",
  mimeType: "image/png",
  size: onePixelPng.length,
  bytes: onePixelPng,
};

test("embeds and reimports verified Rune local images through portable ODT pictures", async () => {
  const artifact = {
    id: "image",
    name: "image.md",
    kind: "document",
    language: "Markdown",
    source: `# Proof\n\n![Portable proof](rune-asset:sha256:${runeImageId})\n`,
  };
  const exported = exportOdfArtifact(artifact, [artifact], [], [runeImageAsset]);
  const parts = packageParts(exported.bytes);
  assert.deepEqual(parts[`Pictures/rune-${runeImageId}.png`], onePixelPng);
  assert.match(strFromU8(parts["content.xml"]), new RegExp(`Pictures/rune-${runeImageId}\\.png`, "u"));
  assert.match(strFromU8(parts["META-INF/manifest.xml"]), /manifest:media-type="image\/png"/u);
  assert.match(exported.warnings.join(" "), /embedded as portable, static ODT pictures/iu);
  const imported = await convertOdfFileWithAssets(exported.fileName, exported.bytes);
  assert.equal(imported.assets.length, 1);
  assert.deepEqual(imported.assets[0].bytes, onePixelPng);
  assert.match(imported.artifacts[0].source, new RegExp(`rune-asset:sha256:${imported.assets[0].id}`, "u"));
  assert.match(imported.warnings.join(" "), /verified local image.*preserved/iu);
});

test("fails ODT export closed when a referenced Rune image is missing", () => {
  const artifact = {
    id: "missing",
    name: "missing.md",
    kind: "document",
    language: "Markdown",
    source: `![Missing](rune-asset:sha256:${runeImageId})`,
  };
  assert.throws(() => exportOdfArtifact(artifact), /Referenced local image is missing or corrupt/iu);
});

test("embeds and reimports a reviewed Deck image through deterministic ODP pictures", async () => {
  const artifact = {
    id: "image-deck",
    name: "image-deck.deck.md",
    kind: "slides",
    language: "Deck Markdown",
    source: `---
version: 1
title: Image deck
theme: rune
ratio: 16:9
lang: en
---

<!-- layout: split -->
# Visual proof

The source remains readable.

![Portable proof](rune-asset:sha256:${runeImageId})
`,
  };
  const first = exportOdfArtifact(artifact, [artifact], [], [runeImageAsset]);
  const second = exportOdfArtifact(artifact, [artifact], [], [runeImageAsset]);
  assert.deepEqual(first.bytes, second.bytes);
  const parts = packageParts(first.bytes);
  assert.deepEqual(parts[`Pictures/rune-${runeImageId}.png`], onePixelPng);
  const content = strFromU8(parts["content.xml"]);
  assert.match(content, new RegExp(`Pictures/rune-${runeImageId}\\.png`, "u"));
  assert.match(content, /<draw:image/u);
  assert.match(strFromU8(parts["META-INF/manifest.xml"]), /manifest:media-type="image\/png"/u);
  assert.match(first.warnings.join(" "), /portable, static ODP media/iu);
  const imported = await convertOdfFileWithAssets(first.fileName, first.bytes);
  assert.equal(imported.assets.length, 1);
  assert.deepEqual(imported.assets[0].bytes, onePixelPng);
  assert.match(imported.artifacts[0].source, new RegExp(`rune-asset:sha256:${imported.assets[0].id}`, "u"));
  assert.deepEqual(validateArtifact(imported.artifacts[0]), []);
  assert.throws(() => exportOdfArtifact(artifact, [artifact]), /Referenced local image is missing or corrupt/iu);
});

test("exports deterministic ODT with semantic Markdown and imports it back", () => {
  const artifact = {
    id: "report",
    name: "report.md",
    kind: "document",
    language: "Markdown",
    source: `# Operating review

This has **bold text**, _emphasis_, ~~old copy~~, and a [source](https://example.com/report).

- First action
- Second action

| Owner | Status |
| --- | --- |
| Growth | Ready |

![Pipeline diagram](pipeline.png)
`,
  };
  const first = exportOdfArtifact(artifact);
  const second = exportOdfArtifact(artifact);
  assert.equal(first.targetType, "odt");
  assert.equal(first.fileName, "report.odt");
  assert.deepEqual(first.bytes, second.bytes);
  assert.match(first.warnings.join(" "), /images are not embedded/iu);
  const parts = packageParts(first.bytes);
  assert.equal(strFromU8(parts.mimetype), "application/vnd.oasis.opendocument.text");
  assert.doesNotMatch(strFromU8(parts["content.xml"]), /javascript:/iu);

  const imported = convertOdfFile(first.fileName, first.bytes);
  const roundTrip = imported.artifacts[0];
  assert.match(roundTrip.source, /^# Operating review$/mu);
  assert.match(roundTrip.source, /\*\*bold text\*\*/u);
  assert.match(roundTrip.source, /\[source\]\(<https:\/\/example\.com\/report>\)/u);
  assert.match(roundTrip.source, /^- First action$/mu);
  assert.match(roundTrip.source, /\| Owner \| Status \|/u);
  assert.deepEqual(validateArtifact(roundTrip), []);
});

test("exports typed formula-safe ODS values and imports them back", () => {
  const artifact = {
    id: "model",
    name: "model.csv",
    kind: "data",
    language: "CSV",
    source: "Region,Revenue,Active,Note\nAPAC,1840000,true,=WEBSERVICE\nEurope,970000,false,Reviewed\n",
  };
  const first = exportOdfArtifact(artifact);
  const second = exportOdfArtifact(artifact);
  assert.equal(first.targetType, "ods");
  assert.equal(first.fileName, "model.ods");
  assert.deepEqual(first.bytes, second.bytes);
  const parts = packageParts(first.bytes);
  const content = strFromU8(parts["content.xml"]);
  assert.doesNotMatch(content, /table:formula/iu);
  assert.match(content, /office:value-type="float" office:value="1840000"/u);
  assert.match(content, /office:value-type="boolean" office:boolean-value="true"/u);
  assert.match(content, />=WEBSERVICE</u);

  const imported = convertOdfFile(first.fileName, first.bytes);
  const roundTrip = imported.artifacts[0];
  const parsed = parseDataSource(roundTrip.source);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.rows[0].Revenue, 1840000);
  assert.equal(parsed.rows[1].Active, false);
  assert.match(roundTrip.source, /APAC,1840000,true,'=WEBSERVICE/u);
});

test("exports deterministic ODP slides with current chart values and imports them back", () => {
  const artifact = defaultArtifacts.find((candidate) => candidate.kind === "slides");
  assert.ok(artifact);
  const runtime = snapshots();
  const compiled = compileArtifactSource(artifact.source, defaultArtifacts, runtime);
  assert.deepEqual(compiled.unresolved, []);
  const exportArtifact = { ...artifact, source: compiled.source };
  const first = exportOdfArtifact(exportArtifact, defaultArtifacts, runtime);
  const second = exportOdfArtifact(exportArtifact, defaultArtifacts, runtime);
  assert.equal(first.targetType, "odp");
  assert.equal(first.fileName, "board-briefing.odp");
  assert.deepEqual(first.bytes, second.bytes);
  assert.match(first.warnings.join(" "), /current-data tables/iu);
  const parts = packageParts(first.bytes);
  const content = strFromU8(parts["content.xml"]);
  assert.match(content, /Growth became more durable/u);
  assert.match(content, /Q2 revenue by region/u);
  assert.match(content, /APAC/u);
  assert.match(content, /\$1\.84M/u);
  assert.doesNotMatch(content, /\{\{\s*(?:metric|chart)/iu);

  const imported = convertOdfFile(first.fileName, first.bytes);
  const roundTrip = imported.artifacts[0];
  assert.equal(compileDeckSource(roundTrip.source).slideCount, 4);
  assert.match(roundTrip.source, /Growth became more durable/u);
  assert.match(roundTrip.source, /Canonical regional revenue, sorted high to low/u);
  assert.match(roundTrip.source, /APAC.*\$1\.84M/u);
  assert.deepEqual(validateArtifact(roundTrip), []);
});

test("exports semantic HTML slides through an explicit deterministic ODP fidelity boundary", () => {
  const artifact = {
    id: "semantic-html",
    name: "semantic-brief.htm",
    kind: "slides",
    language: "Semantic HTML",
    source: `<main><section><h1>Opening</h1><p>Start here.</p></section><section><h2>Decision</h2><ul><li>Ship now</li></ul></section></main>`,
  };
  const first = exportOdfArtifact(artifact, [artifact]);
  const second = exportOdfArtifact(artifact, [artifact]);

  assert.equal(isOdfExportArtifact(artifact), true);
  assert.equal(first.fileName, "semantic-brief.odp");
  assert.equal(first.targetType, "odp");
  assert.deepEqual(first.bytes, second.bytes);
  assert.match(first.warnings.join(" "), /Semantic HTML is converted to Rune's controlled slide model/iu);
  const content = strFromU8(packageParts(first.bytes)["content.xml"]);
  assert.match(content, /Opening/u);
  assert.match(content, /Start here/u);
  assert.match(content, /Decision/u);
  assert.match(content, /Ship now/u);
  assert.doesNotMatch(content, /&lt;main|&lt;section/iu);
});

test("exports area Charts as semantic OpenDocument trend tables", () => {
  const data = {
    id: "volume-data",
    name: "volume.csv",
    kind: "data",
    language: "CSV / JSON",
    source: "Month,Value\nJan,10\nFeb,30\nMar,20\n",
  };
  const chart = {
    id: "volume-chart",
    name: "volume.chart.json",
    kind: "chart",
    language: "Chart JSON",
    source: JSON.stringify({
      version: 1,
      title: "Monthly volume",
      description: "Ordered source values",
      source: data.id,
      mark: "area",
      category: "Month",
      value: "Value",
      sort: "source",
      format: "number",
      color: "#3676d1",
      maxItems: 8,
    }),
  };
  const deck = {
    id: "volume-deck",
    name: "volume.deck.md",
    kind: "slides",
    language: "Deck Markdown",
    source: `---
version: 1
title: Volume review
theme: rune
ratio: 16:9
lang: en
---

# Monthly volume

{{ chart("volume-chart") }}
`,
  };
  const exported = exportOdfArtifact(deck, [deck, data, chart], []);
  const content = strFromU8(packageParts(exported.bytes)["content.xml"]);
  assert.match(content, /Monthly volume/u);
  assert.match(content, /Trend/u);
  assert.match(content, /Increase/u);
  assert.match(content, /Decrease/u);
  assert.doesNotMatch(content, /Relative bar/u);
});

test("limits OpenDocument export to bounded canonical artifacts", () => {
  const document = defaultArtifacts.find((artifact) => artifact.kind === "document");
  const data = defaultArtifacts.find((artifact) => artifact.kind === "data");
  const deck = defaultArtifacts.find((artifact) => artifact.kind === "slides");
  const query = defaultArtifacts.find((artifact) => artifact.kind === "query");
  assert.ok(document && data && deck && query);
  assert.equal(isOdfExportArtifact(document), true);
  assert.equal(isOdfExportArtifact(data), true);
  assert.equal(isOdfExportArtifact(deck), true);
  assert.equal(isOdfExportArtifact(query), false);
  assert.throws(() => exportOdfArtifact(query), /supports Markdown documents/iu);
  assert.throws(
    () => exportOdfArtifact({ ...document, source: "x".repeat(MAX_ODF_EXPORT_SOURCE_CHARS + 1) }),
    /2,000,000 source characters/u,
  );
  assert.throws(() => exportOdfArtifact({ ...document, source: "x".repeat(200_001) }), /200,000 source characters/u);
});

test("keeps unsafe Markdown links and formula text non-executable in OpenDocument packages", () => {
  const document = {
    id: "unsafe",
    name: "unsafe.md",
    kind: "document",
    language: "Markdown",
    source: "# Safe export\n\n[Do not run](javascript:alert(1))\n",
  };
  const odt = exportOdfArtifact(document);
  assert.doesNotMatch(strFromU8(packageParts(odt.bytes)["content.xml"]), /javascript:/iu);
  assert.match(odt.warnings.join(" "), /non-HTTP Markdown link/iu);

  const data = { id: "formula", name: "formula.csv", kind: "data", language: "CSV", source: "Value,Kind\n=CMD,text\n" };
  const odsContent = strFromU8(packageParts(exportOdfArtifact(data).bytes)["content.xml"]);
  assert.match(odsContent, />=CMD</u);
  assert.doesNotMatch(odsContent, /table:formula/iu);
});
