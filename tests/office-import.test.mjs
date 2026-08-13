import assert from "node:assert/strict";
import test from "node:test";

import { strToU8, zipSync } from "fflate";
import { compileDeckSource, parseDeckSource } from "../app/lib/deck.ts";
import {
  MAX_OFFICE_IMPORT_BYTES,
  convertOfficeFile,
  convertOfficeFileWithAssets,
  isOfficeFileName,
} from "../app/lib/office-import.ts";
import { parseDataSource, validateArtifact } from "../app/lib/workspace.ts";

function officePackage(parts) {
  return zipSync(Object.fromEntries(Object.entries(parts).map(([path, source]) => [path, strToU8(source)])));
}

function docxFixture({ unsafe = false } = {}) {
  return officePackage({
    "word/document.xml": unsafe ? `<!DOCTYPE x><w:document xmlns:w="w"><w:body /></w:document>` : `
      <w:document xmlns:w="word" xmlns:r="relationships">
        <w:body>
          <w:p><w:pPr><w:pStyle w:val="Heading1" /></w:pPr><w:r><w:t>Imported report</w:t></w:r></w:p>
          <w:p><w:pPr><w:pStyle w:val="Normal" /></w:pPr>
            <w:r><w:rPr><w:b /></w:rPr><w:t>Bold signal</w:t></w:r>
            <w:r><w:t xml:space="preserve"> and </w:t></w:r>
            <w:hyperlink r:id="rIdLink"><w:r><w:t>source</w:t></w:r></w:hyperlink>
          </w:p>
          <w:p><w:pPr><w:numPr><w:ilvl w:val="0" /><w:numId w:val="1" /></w:numPr></w:pPr><w:r><w:t>First action</w:t></w:r></w:p>
          <w:tbl>
            <w:tr><w:tc><w:p><w:r><w:t>Owner</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Status</w:t></w:r></w:p></w:tc></w:tr>
            <w:tr><w:tc><w:p><w:r><w:t>Growth</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Ready</w:t></w:r></w:p></w:tc></w:tr>
          </w:tbl>
          <w:p><w:r><w:drawing /></w:r></w:p>
        </w:body>
      </w:document>`,
    "word/styles.xml": `
      <w:styles xmlns:w="word">
        <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1" /></w:style>
        <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal" /></w:style>
      </w:styles>`,
    "word/numbering.xml": `
      <w:numbering xmlns:w="word">
        <w:abstractNum w:abstractNumId="8"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet" /></w:lvl></w:abstractNum>
        <w:num w:numId="1"><w:abstractNumId w:val="8" /></w:num>
      </w:numbering>`,
    "word/_rels/document.xml.rels": `
      <Relationships xmlns="relationships">
        <Relationship Id="rIdLink" Type="hyperlink" Target="https://example.com/source" TargetMode="External" />
      </Relationships>`,
  });
}

function xlsxFixture() {
  return officePackage({
    "xl/workbook.xml": `
      <workbook xmlns="spreadsheet" xmlns:r="relationships">
        <workbookPr date1904="0" />
        <sheets>
          <sheet name="Revenue" sheetId="1" r:id="rId1" />
          <sheet name="Forecast" sheetId="2" r:id="rId2" />
          <sheet name="Hidden" state="hidden" sheetId="3" r:id="rId3" />
        </sheets>
      </workbook>`,
    "xl/_rels/workbook.xml.rels": `
      <Relationships xmlns="relationships">
        <Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml" />
        <Relationship Id="rId2" Type="worksheet" Target="worksheets/sheet2.xml" />
        <Relationship Id="rId3" Type="worksheet" Target="worksheets/sheet3.xml" />
      </Relationships>`,
    "xl/sharedStrings.xml": `
      <sst xmlns="spreadsheet">
        <si><t>Region</t></si><si><t>Revenue</t></si><si><t>APAC</t></si><si><t>Note</t></si><si><t>=WEBSERVICE</t></si>
      </sst>`,
    "xl/styles.xml": `
      <styleSheet xmlns="spreadsheet">
        <cellXfs count="2"><xf numFmtId="0" /><xf numFmtId="14" /></cellXfs>
      </styleSheet>`,
    "xl/worksheets/sheet1.xml": `
      <worksheet xmlns="spreadsheet"><sheetData>
        <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>3</v></c></row>
        <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>1840000</v></c><c r="C2" t="s"><v>4</v></c></row>
      </sheetData></worksheet>`,
    "xl/worksheets/sheet2.xml": `
      <worksheet xmlns="spreadsheet"><sheetData>
        <row r="1"><c r="A1" t="inlineStr"><is><t>Date</t></is></c><c r="B1" t="inlineStr"><is><t>Forecast</t></is></c></row>
        <row r="2"><c r="A2" s="1"><v>45292</v></c><c r="B2"><f>SUM(1,2)</f><v>3</v></c></row>
      </sheetData></worksheet>`,
    "xl/worksheets/sheet3.xml": `<worksheet xmlns="spreadsheet"><sheetData /></worksheet>`,
  });
}

function slideXml(title, body, { image = false, table = false } = {}) {
  return `
    <p:sld xmlns:p="presentation" xmlns:a="drawing">
      <p:cSld><p:spTree>
        <p:sp>
          <p:nvSpPr><p:nvPr><p:ph type="title" /></p:nvPr></p:nvSpPr>
          <p:txBody><a:p><a:r><a:t>${title}</a:t></a:r></a:p></p:txBody>
        </p:sp>
        <p:sp>
          <p:nvSpPr><p:nvPr><p:ph type="body" /></p:nvPr></p:nvSpPr>
          <p:txBody>${body.map((line) => `<a:p><a:pPr><a:buChar char="•" /></a:pPr><a:r><a:t>${line}</a:t></a:r></a:p>`).join("")}</p:txBody>
        </p:sp>
        ${table ? `<p:graphicFrame><a:graphic><a:graphicData><a:tbl>
          <a:tr><a:tc><a:txBody><a:p><a:r><a:t>Owner</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>Decision</a:t></a:r></a:p></a:txBody></a:tc></a:tr>
          <a:tr><a:tc><a:txBody><a:p><a:r><a:t>Growth</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>Scale</a:t></a:r></a:p></a:txBody></a:tc></a:tr>
        </a:tbl></a:graphicData></a:graphic></p:graphicFrame>` : ""}
        ${image ? `<p:pic />` : ""}
      </p:spTree></p:cSld>
    </p:sld>`;
}

function pptxFixture() {
  return officePackage({
    "docProps/core.xml": `<cp:coreProperties xmlns:cp="core" xmlns:dc="dc"><dc:title>Imported deck</dc:title></cp:coreProperties>`,
    "ppt/presentation.xml": `
      <p:presentation xmlns:p="presentation" xmlns:r="relationships"><p:sldIdLst>
        <p:sldId id="256" r:id="rId1" /><p:sldId id="257" r:id="rId2" />
      </p:sldIdLst></p:presentation>`,
    "ppt/_rels/presentation.xml.rels": `
      <Relationships xmlns="relationships">
        <Relationship Id="rId1" Type="slide" Target="slides/slide1.xml" />
        <Relationship Id="rId2" Type="slide" Target="slides/slide2.xml" />
      </Relationships>`,
    "ppt/slides/slide1.xml": slideXml("Launch plan", ["A readable source for every team"]),
    "ppt/slides/slide2.xml": slideXml("Decision", ["Scale APAC", "Treat &lt;tag&gt; as text"], { image: true, table: true }),
  });
}

test("recognizes only supported Office Open XML filenames", () => {
  assert.equal(isOfficeFileName("report.docx"), true);
  assert.equal(isOfficeFileName("book.XLSX"), true);
  assert.equal(isOfficeFileName("legacy.doc"), false);
});

test("converts DOCX paragraphs, formatting, lists, links, and tables to Markdown", () => {
  const result = convertOfficeFile("report.docx", docxFixture());
  assert.equal(result.sourceType, "docx");
  assert.equal(result.artifacts.length, 1);
  const artifact = result.artifacts[0];
  assert.equal(artifact.name, "report.md");
  assert.match(artifact.source, /^# Imported report/m);
  assert.match(artifact.source, /\*\*Bold signal\*\*/);
  assert.doesNotMatch(artifact.source, /^# \*\*Bold signal/m);
  assert.match(artifact.source, /\[source\]\(<https:\/\/example\.com\/source>\)/);
  assert.match(artifact.source, /^- First action/m);
  assert.match(artifact.source, /\| Owner \| Status \|/);
  assert.match(result.warnings.join(" "), /image.*omitted/i);
  assert.deepEqual(validateArtifact(artifact), []);
});

test("converts every visible XLSX worksheet to bounded CSV", () => {
  const result = convertOfficeFile("operating-model.xlsx", xlsxFixture());
  assert.equal(result.sourceType, "xlsx");
  assert.deepEqual(result.artifacts.map((artifact) => artifact.name), [
    "operating-model--Revenue.csv",
    "operating-model--Forecast.csv",
  ]);
  assert.match(result.artifacts[0].source, /Region,Revenue,Note\nAPAC,1840000,'=WEBSERVICE/);
  assert.match(result.artifacts[1].source, /Date,Forecast\n2024-01-01,3/);
  assert.equal(new Set(result.artifacts.map((artifact) => artifact.id)).size, 2);
  result.artifacts.forEach((artifact) => assert.deepEqual(parseDataSource(artifact.source).errors, []));
  assert.match(result.warnings.join(" "), /hidden worksheet/i);
  assert.match(result.warnings.join(" "), /formula cell.*cached/i);
  assert.match(result.warnings.join(" "), /formula-leading text cell.*apostrophe/i);
});

test("converts PPTX text and tables to valid, safely compiled Deck Markdown", () => {
  const result = convertOfficeFile("board.pptx", pptxFixture());
  assert.equal(result.sourceType, "pptx");
  const artifact = result.artifacts[0];
  assert.equal(artifact.name, "board.deck.md");
  assert.match(artifact.source, /^version: 1$/m);
  assert.match(artifact.source, /layout: cover/);
  assert.match(artifact.source, /# Launch plan/);
  assert.match(artifact.source, /\\<tag\\>/);
  assert.match(artifact.source, /\| Owner \| Decision \|/);
  assert.deepEqual(parseDeckSource(artifact.source).errors, []);
  const compiled = compileDeckSource(artifact.source);
  assert.equal(compiled.slideCount, 2);
  assert.match(compiled.html ?? "", /&lt;tag&gt;/);
  assert.doesNotMatch(compiled.html ?? "", /<tag>/);
  assert.match(result.warnings.join(" "), /slide image.*omitted/i);
});

test("rejects oversized, malformed, or declaration-bearing Office packages", () => {
  assert.throws(
    () => convertOfficeFile("large.docx", new Uint8Array(MAX_OFFICE_IMPORT_BYTES + 1)),
    /12 MB/,
  );
  assert.throws(() => convertOfficeFile("broken.xlsx", new Uint8Array([0x50, 0x4b, 0, 0])), /Office import failed/);
  assert.throws(() => convertOfficeFile("unsafe.docx", docxFixture({ unsafe: true })), /blocked XML declaration/);
});

test("asset-aware Office import removes unresolved visuals without leaking converter placeholders", async () => {
  const docx = await convertOfficeFileWithAssets("report.docx", docxFixture());
  assert.deepEqual(docx.assets, []);
  assert.match(docx.warnings.join(" "), /no supported image reference/iu);
  assert.doesNotMatch(docx.artifacts[0].source, /RUNEIMPORTIMAGEPLACEHOLDER/u);

  const pptx = await convertOfficeFileWithAssets("board.pptx", pptxFixture());
  assert.deepEqual(pptx.assets, []);
  assert.match(pptx.warnings.join(" "), /no readable package relationship/iu);
  assert.deepEqual(parseDeckSource(pptx.artifacts[0].source).errors, []);
});
