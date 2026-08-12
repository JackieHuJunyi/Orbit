import assert from "node:assert/strict";
import test from "node:test";

import { strToU8, zipSync } from "fflate";

import { compileDeckSource, parseDeckSource } from "../app/lib/deck.ts";
import {
  MAX_ODF_IMPORT_BYTES,
  convertOdfFile,
  isOdfFileName,
} from "../app/lib/odf-import.ts";
import { parseDataSource, validateArtifact } from "../app/lib/workspace.ts";

const MIME = {
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
};
const timestamp = new Date(Date.UTC(1980, 0, 1));

function manifest(kind, encrypted = false) {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
      <manifest:file-entry manifest:full-path="/" manifest:media-type="${MIME[kind]}" />
      <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml">${encrypted ? "<manifest:encryption-data />" : ""}</manifest:file-entry>
      <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml" />
    </manifest:manifest>`;
}

function odfPackage(kind, content, { styles = "<office:document-styles xmlns:office=\"office\" />", extra = {}, encrypted = false, compressedMimetype = false, mime = MIME[kind] } = {}) {
  return zipSync({
    mimetype: [strToU8(mime), { level: compressedMimetype ? 6 : 0, mtime: timestamp }],
    "content.xml": [strToU8(content), { level: 6, mtime: timestamp }],
    "styles.xml": [strToU8(styles), { level: 6, mtime: timestamp }],
    "META-INF/manifest.xml": [strToU8(manifest(kind, encrypted)), { level: 6, mtime: timestamp }],
    ...Object.fromEntries(Object.entries(extra).map(([path, value]) => [path, [strToU8(value), { level: 6, mtime: timestamp }]])),
  }, { level: 6, mtime: timestamp });
}

function odtFixture(options = {}) {
  const styles = `<?xml version="1.0" encoding="UTF-8"?>
    <office:document-styles xmlns:office="office" xmlns:style="style" xmlns:fo="fo">
      <office:styles>
        <style:style style:name="Strong" style:family="text"><style:text-properties fo:font-weight="bold" /></style:style>
        <style:style style:name="Emphasis" style:family="text"><style:text-properties fo:font-style="italic" /></style:style>
        <text:list-style xmlns:text="text" style:name="Numbered"><text:list-level-style-number text:level="1" style:num-format="1" /></text:list-style>
      </office:styles>
    </office:document-styles>`;
  const content = `<?xml version="1.0" encoding="UTF-8"?>
    <office:document-content xmlns:office="office" xmlns:text="text" xmlns:table="table" xmlns:xlink="xlink">
      <office:body><office:text>
        <text:h text:outline-level="1">Imported report</text:h>
        <text:p>A <text:span text:style-name="Strong">bold signal</text:span> and <text:span text:style-name="Emphasis">emphasis</text:span> with <text:a xlink:href="https://example.com/source">source</text:a>.</text:p>
        <text:list text:style-name="Numbered"><text:list-item><text:p>First action</text:p></text:list-item><text:list-item><text:p>Second action</text:p></text:list-item></text:list>
        <table:table table:name="Decision"><table:table-row><table:table-cell><text:p>Owner</text:p></table:table-cell><table:table-cell><text:p>Status</text:p></table:table-cell></table:table-row><table:table-row><table:table-cell><text:p>Growth</text:p></table:table-cell><table:table-cell><text:p>Ready</text:p></table:table-cell></table:table-row></table:table>
        <text:p>{{ metric("fabricated") }} stays literal.</text:p>
        <office:annotation><text:p>Hidden comment</text:p></office:annotation>
      </office:text></office:body>
    </office:document-content>`;
  return odfPackage("odt", options.unsafe ? `<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>${content}` : content, {
    styles,
    encrypted: options.encrypted,
    compressedMimetype: options.compressedMimetype,
    mime: options.mime,
    extra: { "Pictures/photo.png": "not-an-image", "Basic/Standard/script.xml": "<script />", "META-INF/documentsignatures.xml": "<signatures />" },
  });
}

function odsFixture() {
  const content = `<?xml version="1.0" encoding="UTF-8"?>
    <office:document-content xmlns:office="office" xmlns:table="table" xmlns:text="text">
      <office:body><office:spreadsheet>
        <table:table table:name="Revenue">
          <table:table-row><table:table-cell office:value-type="string"><text:p>Region</text:p></table:table-cell><table:table-cell office:value-type="string"><text:p>Revenue</text:p></table:table-cell><table:table-cell office:value-type="string"><text:p>Note</text:p></table:table-cell><table:table-cell table:number-columns-repeated="1021" /></table:table-row>
          <table:table-row><table:table-cell office:value-type="string"><text:p>APAC</text:p></table:table-cell><table:table-cell office:value-type="float" office:value="1840000"><text:p>1,840,000</text:p></table:table-cell><table:table-cell office:value-type="string"><text:p>=WEBSERVICE</text:p></table:table-cell></table:table-row>
          <table:table-row table:number-rows-repeated="1048574"><table:table-cell table:number-columns-repeated="1024" /></table:table-row>
        </table:table>
        <table:table table:name="Forecast">
          <table:table-row><table:table-cell office:value-type="string"><text:p>Date</text:p></table:table-cell><table:table-cell office:value-type="string"><text:p>Forecast</text:p></table:table-cell></table:table-row>
          <table:table-row><table:table-cell office:value-type="date" office:date-value="2026-08-12"><text:p>08/12/26</text:p></table:table-cell><table:table-cell office:value-type="float" office:value="3" table:formula="of:=SUM([.A1:.A2])"><text:p>3</text:p></table:table-cell></table:table-row>
        </table:table>
        <table:table table:name="Hidden" table:display="false"><table:table-row><table:table-cell office:value-type="string"><text:p>secret</text:p></table:table-cell></table:table-row></table:table>
      </office:spreadsheet></office:body>
    </office:document-content>`;
  return odfPackage("ods", content);
}

function collidingOdsFixture() {
  const content = `<?xml version="1.0" encoding="UTF-8"?>
    <office:document-content xmlns:office="office" xmlns:table="table" xmlns:text="text">
      <office:body><office:spreadsheet>
        <table:table table:name="North West"><table:table-row><table:table-cell office:value-type="string"><text:p>Value</text:p></table:table-cell></table:table-row></table:table>
        <table:table table:name="North-West"><table:table-row><table:table-cell office:value-type="string"><text:p>Value</text:p></table:table-cell></table:table-row></table:table>
      </office:spreadsheet></office:body>
    </office:document-content>`;
  return odfPackage("ods", content);
}

function odpFixture({ title = "" } = {}) {
  const content = `<?xml version="1.0" encoding="UTF-8"?>
    <office:document-content xmlns:office="office" xmlns:draw="draw" xmlns:presentation="presentation" xmlns:text="text" xmlns:table="table" xmlns:xlink="xlink">
      <office:body><office:presentation>
        <draw:page draw:name="Launch plan">
          <draw:frame presentation:class="title"><draw:text-box><text:p>Launch plan</text:p></draw:text-box></draw:frame>
          <draw:frame presentation:class="outline"><draw:text-box><text:list><text:list-item><text:p>A readable source for every team</text:p></text:list-item></text:list></draw:text-box></draw:frame>
        </draw:page>
        <draw:page draw:name="Decision">
          <draw:frame presentation:class="title"><draw:text-box><text:p>Decision</text:p></draw:text-box></draw:frame>
          <draw:frame presentation:class="outline"><draw:text-box><text:p>Scale &lt;APAC&gt;</text:p><table:table><table:table-row><table:table-cell><text:p>Owner</text:p></table:table-cell><table:table-cell><text:p>Decision</text:p></table:table-cell></table:table-row><table:table-row><table:table-cell><text:p>Growth</text:p></table:table-cell><table:table-cell><text:p>Scale</text:p></table:table-cell></table:table-row></table:table></draw:text-box></draw:frame>
          <draw:frame><draw:image xlink:href="Pictures/photo.png" /></draw:frame>
          <presentation:notes><draw:frame><draw:text-box><text:p>Speaker secret</text:p></draw:text-box></draw:frame></presentation:notes>
        </draw:page>
      </office:presentation></office:body>
    </office:document-content>`;
  const meta = title ? `<?xml version="1.0" encoding="UTF-8"?><office:document-meta xmlns:office="office" xmlns:dc="dc"><office:meta><dc:title>${title}</dc:title></office:meta></office:document-meta>` : "";
  return odfPackage("odp", content, { extra: { "Pictures/photo.png": "not-an-image", ...(meta ? { "meta.xml": meta } : {}) } });
}

test("recognizes the three concrete OpenDocument package extensions", () => {
  assert.equal(isOdfFileName("report.odt"), true);
  assert.equal(isOdfFileName("model.ODS"), true);
  assert.equal(isOdfFileName("slides.odp"), true);
  assert.equal(isOdfFileName("generic.odf"), false);
});

test("converts independent ODT text, styles, links, lists, and tables into source-safe Markdown", () => {
  const result = convertOdfFile("report.odt", odtFixture());
  assert.equal(result.sourceType, "odt");
  const artifact = result.artifacts[0];
  assert.equal(artifact.name, "report.md");
  assert.match(artifact.source, /^# Imported report$/mu);
  assert.match(artifact.source, /\*\*bold signal\*\*/u);
  assert.match(artifact.source, /_emphasis_/u);
  assert.match(artifact.source, /\[source\]\(<https:\/\/example\.com\/source>\)/u);
  assert.match(artifact.source, /^1\. First action$/mu);
  assert.match(artifact.source, /\| Owner \| Status \|/u);
  assert.match(artifact.source, /&#123;&#123; metric\("fabricated"\) &#125;&#125; stays literal/u);
  assert.doesNotMatch(artifact.source, /Hidden comment/u);
  assert.match(result.warnings.join(" "), /ODT images were omitted/iu);
  assert.match(result.warnings.join(" "), /macros or scripts.*never executed/iu);
  assert.match(result.warnings.join(" "), /Digital signatures/iu);
  assert.deepEqual(validateArtifact(artifact), []);
});

test("converts visible ODS sheets, typed values, cached formulas, and standard empty repeats to CSV", () => {
  const result = convertOdfFile("operating-model.ods", odsFixture());
  assert.equal(result.sourceType, "ods");
  assert.deepEqual(result.artifacts.map((artifact) => artifact.name), ["operating-model--Revenue.csv", "operating-model--Forecast.csv"]);
  assert.match(result.artifacts[0].source, /Region,Revenue,Note\nAPAC,1840000,'=WEBSERVICE/u);
  assert.match(result.artifacts[1].source, /Date,Forecast\n2026-08-12,3/u);
  result.artifacts.forEach((artifact) => assert.deepEqual(parseDataSource(artifact.source).errors, []));
  assert.match(result.warnings.join(" "), /hidden ODS sheet/iu);
  assert.match(result.warnings.join(" "), /formula cell.*cached displayed value/iu);
  assert.match(result.warnings.join(" "), /formula-leading text.*apostrophe/iu);
});

test("keeps sanitized ODS sheet names and ids unique inside one import batch", () => {
  const result = convertOdfFile("model.ods", collidingOdsFixture());
  assert.deepEqual(result.artifacts.map((artifact) => artifact.name), ["model--North-West.csv", "model--North-West-2.csv"]);
  assert.deepEqual(result.artifacts.map((artifact) => artifact.id), ["import-model-north-west", "import-model-north-west-2"]);
});

test("converts independent ODP slides and tables into safe Deck Markdown", () => {
  const result = convertOdfFile("board.odp", odpFixture({ title: "Board {{ metric(&quot;fabricated&quot;) }}" }));
  assert.equal(result.sourceType, "odp");
  const artifact = result.artifacts[0];
  assert.equal(artifact.name, "board.deck.md");
  assert.match(artifact.source, /^# Launch plan$/mu);
  assert.match(artifact.source, /^title: Board &#123;&#123; metric\("fabricated"\) &#125;&#125;$/mu);
  assert.match(artifact.source, /^- A readable source for every team$/mu);
  assert.match(artifact.source, /Scale \\<APAC\\>/u);
  assert.match(artifact.source, /\| Owner \| Decision \|/u);
  assert.doesNotMatch(artifact.source, /Speaker secret/u);
  assert.deepEqual(parseDeckSource(artifact.source).errors, []);
  assert.equal(compileDeckSource(artifact.source).slideCount, 2);
  assert.match(result.warnings.join(" "), /ODP image.*omitted/iu);
  assert.match(result.warnings.join(" "), /speaker notes/iu);
  assert.deepEqual(validateArtifact(artifact), []);
});

test("rejects oversized, malformed, compressed-MIME, mismatched, encrypted, and entity-bearing ODF packages", () => {
  assert.throws(() => convertOdfFile("large.odt", new Uint8Array(MAX_ODF_IMPORT_BYTES + 1)), /12 MB/u);
  assert.throws(() => convertOdfFile("broken.ods", new Uint8Array([0x50, 0x4b, 0, 0])), /valid OpenDocument ZIP/u);
  assert.throws(() => convertOdfFile("compressed.odt", odtFixture({ compressedMimetype: true })), /uncompressed mimetype entry first/u);
  assert.throws(() => convertOdfFile("wrong.odt", odtFixture({ mime: MIME.ods })), /mimetype does not match/u);
  assert.throws(() => convertOdfFile("padded.odt", odtFixture({ mime: `${MIME.odt}\n` })), /mimetype does not match/u);
  assert.throws(() => convertOdfFile("encrypted.odt", odtFixture({ encrypted: true })), /Encrypted OpenDocument/u);
  assert.throws(() => convertOdfFile("unsafe.odt", odtFixture({ unsafe: true })), /blocked XML declaration/u);
  assert.throws(() => convertOdfFile("traversal.odt", odfPackage("odt", "<office:document-content xmlns:office=\"office\" />", { extra: { "../outside.xml": "unsafe" } })), /unsafe part path/u);
  assert.throws(() => convertOdfFile("absolute.odt", odfPackage("odt", "<office:document-content xmlns:office=\"office\" />", { extra: { "C:/outside.xml": "unsafe" } })), /unsafe part path/u);
});
