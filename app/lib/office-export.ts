import { strToU8, zipSync } from "fflate";
import { parseDeckSource, type DeckSlide } from "./deck.ts";
import { parseDataSource, type DataCell, type WorkspaceArtifact } from "./workspace.ts";

export const MAX_OFFICE_EXPORT_SOURCE_CHARS = 2_000_000;
export const MAX_OFFICE_EXPORT_BYTES = 12 * 1024 * 1024;

const MAX_DOCX_EXPORT_SOURCE_CHARS = 200_000;
const MAX_DOCX_EXPORT_BLOCKS = 10_000;

type OfficeExportKind = "docx" | "xlsx" | "pptx";

export type OfficeExportResult = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  warnings: string[];
  targetType: OfficeExportKind;
};

type MarkdownBlock =
  | { type: "heading"; level: number; source: string }
  | { type: "paragraph" | "quote"; source: string }
  | { type: "list"; ordered: boolean; level: number; source: string }
  | { type: "table"; rows: string[][] }
  | { type: "code"; source: string };

type InlineSegment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: string;
};

type DocxContext = {
  relationships: Array<{ id: string; target: string }>;
  warnings: Set<string>;
};

type PptParagraph = { text: string; bullet: boolean; level: number };
type PptSlideModel = { title: string; eyebrow: string; paragraphs: PptParagraph[]; tables: string[][][]; layout: DeckSlide["layout"] };

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const PACKAGE_RELATIONSHIPS = "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE_RELATIONSHIPS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const CONTENT_TYPES = "http://schemas.openxmlformats.org/package/2006/content-types";
const MARKDOWN_TOKEN = /(!?\[[^\]\n]*\]\([^)\n]+\)|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
const CHART_TOKEN = /\{\{\s*chart\(["']([a-z0-9_.-]+)["']\)\s*\}\}/gi;

function cleanXmlCharacters(value: string) {
  let result = "";
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    const valid = code === 0x9 || code === 0xa || code === 0xd
      || (code >= 0x20 && code <= 0xd7ff)
      || (code >= 0xe000 && code <= 0xfffd)
      || (code >= 0x10000 && code <= 0x10ffff);
    result += valid ? character : "�";
  }
  return result;
}

function xmlText(value: string) {
  return cleanXmlCharacters(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function xmlAttribute(value: string) {
  return xmlText(value).replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function packageBaseName(name: string) {
  const cleaned = name
    .replace(/\.(?:deck\.md|markdown|md|csv|json)$/i, "")
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/^\.+|\.+$/g, "")
    .trim()
    .slice(0, 96) || "rune-export";
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(cleaned) ? `rune-${cleaned}` : cleaned;
}

function zipPackage(parts: Record<string, string>) {
  const encoded = Object.fromEntries(Object.entries(parts).map(([path, source]) => [path, strToU8(source)]));
  const bytes = zipSync(encoded, {
    level: 6,
    mtime: new Date(Date.UTC(1980, 0, 1)),
  });
  if (bytes.length > MAX_OFFICE_EXPORT_BYTES) throw new Error("The generated Office package exceeds Rune's 12 MB export limit.");
  return bytes;
}

function coreProperties(title: string) {
  return `${XML_DECLARATION}
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlText(title)}</dc:title><dc:creator>Rune</dc:creator><cp:lastModifiedBy>Rune</cp:lastModifiedBy><cp:revision>1</cp:revision></cp:coreProperties>`;
}

function appProperties(kind: string, count = 1) {
  return `${XML_DECLARATION}
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Rune</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><Company>Rune</Company><AppVersion>1.0</AppVersion><${kind}>${count}</${kind}></Properties>`;
}

function rootRelationships(target: string) {
  return `${XML_DECLARATION}
<Relationships xmlns="${PACKAGE_RELATIONSHIPS}"><Relationship Id="rId1" Type="${OFFICE_RELATIONSHIPS}/officeDocument" Target="${target}"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${OFFICE_RELATIONSHIPS}/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function unescapeMarkdown(value: string) {
  return value.replace(/\\([\\`*_[\]{}#>+!~<>-])/g, "$1");
}

function sanitizeInlineSource(source: string, warnings: Set<string>) {
  let result = source.replace(CHART_TOKEN, (_token, id: string) => {
    warnings.add("Live Rune charts are represented by an omission marker in DOCX export and omitted from PPTX export.");
    return `[Chart omitted: ${id}]`;
  });
  result = result.replace(/(^|[^\\])<[^>]+>/g, (_token, prefix: string) => {
    warnings.add("Raw HTML tags were removed from semantic Office export.");
    return prefix;
  });
  return result;
}

function inlineSegments(source: string, warnings: Set<string>): InlineSegment[] {
  const sanitized = sanitizeInlineSource(source, warnings);
  const segments: InlineSegment[] = [];
  let offset = 0;
  for (const match of sanitized.matchAll(MARKDOWN_TOKEN)) {
    const index = match.index ?? 0;
    if (index > offset) segments.push({ text: unescapeMarkdown(sanitized.slice(offset, index)) });
    const token = match[0];
    const image = token.match(/^!\[([^\]]*)\]\([^)]+\)$/);
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (image) {
      warnings.add("Markdown images are not embedded in semantic Office export.");
      segments.push({ text: `[Image omitted${image[1] ? `: ${image[1]}` : ""}]` });
    } else if (link) {
      const target = link[2].trim().replace(/^<|>$/g, "").split(/\s+["']/)[0];
      if (isSafeOfficeLink(target)) segments.push({ text: unescapeMarkdown(link[1]), link: target });
      else {
        warnings.add("A non-HTTP Markdown link was exported as plain text.");
        segments.push({ text: unescapeMarkdown(link[1]) });
      }
    } else if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
      segments.push({ text: unescapeMarkdown(token.slice(2, -2)), bold: true });
    } else if (token.startsWith("~~") && token.endsWith("~~")) {
      segments.push({ text: unescapeMarkdown(token.slice(2, -2)), strike: true });
    } else if (token.startsWith("`") && token.endsWith("`")) {
      segments.push({ text: token.slice(1, -1), code: true });
    } else {
      segments.push({ text: unescapeMarkdown(token.slice(1, -1)), italic: true });
    }
    offset = index + token.length;
  }
  if (offset < sanitized.length) segments.push({ text: unescapeMarkdown(sanitized.slice(offset)) });
  return segments.filter((segment) => segment.text);
}

function isSafeOfficeLink(target: string) {
  if (/[\u0000-\u001f\u007f<>"']/.test(target)) return false;
  try {
    const url = new URL(target);
    if (url.protocol === "http:" || url.protocol === "https:") return Boolean(url.hostname);
    return url.protocol === "mailto:" && Boolean(url.pathname);
  } catch {
    return false;
  }
}

function plainMarkdownInline(source: string, warnings: Set<string>) {
  return inlineSegments(source, warnings).map((segment) => segment.text).join("").replace(/\s+/g, " ").trim();
}

function tableCells(line: string) {
  const source = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  let escaped = false;
  for (const character of source) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
      current += character;
    } else if (character === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells.map(unescapeMarkdown);
}

function isTableDivider(line: string) {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function startsMarkdownBlock(lines: string[], index: number) {
  const line = lines[index] ?? "";
  const next = lines[index + 1] ?? "";
  return /^\s*(?:#{1,6}\s+|>|[-*+]\s+|\d+\.\s+|```)/.test(line)
    || (line.includes("|") && isTableDivider(next));
}

function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const fence = line.match(/^\s*```/);
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", source: code.join("\n") });
      continue;
    }
    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, source: heading[2].trim() });
      index += 1;
      continue;
    }
    if (line.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const rows = [tableCells(line)];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      blocks.push({ type: "table", rows });
      continue;
    }
    const list = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (list) {
      blocks.push({
        type: "list",
        ordered: /\d/.test(list[2]),
        level: Math.max(0, Math.min(6, Math.floor(list[1].replace(/\t/g, "  ").length / 2))),
        source: list[3],
      });
      index += 1;
      continue;
    }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      const quoted = [quote[1]];
      index += 1;
      while (index < lines.length) {
        const continuation = lines[index].match(/^\s*>\s?(.*)$/);
        if (!continuation) break;
        quoted.push(continuation[1]);
        index += 1;
      }
      blocks.push({ type: "quote", source: quoted.join(" ") });
      continue;
    }
    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !startsMarkdownBlock(lines, index)) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", source: paragraph.join(" ") });
  }
  return blocks;
}

function docxRun(segment: InlineSegment) {
  const properties = [
    segment.bold ? "<w:b/>" : "",
    segment.italic ? "<w:i/>" : "",
    segment.strike ? "<w:strike/>" : "",
    segment.code ? '<w:rStyle w:val="Code"/>' : "",
    segment.link ? '<w:rStyle w:val="Hyperlink"/>' : "",
  ].join("");
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ""}<w:t xml:space="preserve">${xmlText(segment.text)}</w:t></w:r>`;
}

function docxInline(source: string, context: DocxContext) {
  return inlineSegments(source, context.warnings).map((segment) => {
    if (!segment.link) return docxRun(segment);
    const id = `rId${context.relationships.length + 3}`;
    context.relationships.push({ id, target: segment.link });
    return `<w:hyperlink r:id="${id}" w:history="1">${docxRun(segment)}</w:hyperlink>`;
  }).join("") || '<w:r><w:t xml:space="preserve"> </w:t></w:r>';
}

function docxParagraph(source: string, context: DocxContext, options: { style?: string; ordered?: boolean; level?: number } = {}) {
  const properties = [
    options.style ? `<w:pStyle w:val="${options.style}"/>` : "",
    options.ordered != null ? `<w:numPr><w:ilvl w:val="${options.level ?? 0}"/><w:numId w:val="${options.ordered ? 2 : 1}"/></w:numPr>` : "",
  ].join("");
  return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ""}${docxInline(source, context)}</w:p>`;
}

function docxTable(rows: string[][], context: DocxContext) {
  const width = Math.max(1, ...rows.map((row) => row.length));
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid>${Array.from({ length: width }, () => '<w:gridCol w:w="2400"/>').join("")}</w:tblGrid>${rows.map((row) => `<w:tr>${Array.from({ length: width }, (_, index) => `<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>${docxParagraph(row[index] ?? "", context)}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
}

function docxStyles() {
  const headings = Array.from({ length: 6 }, (_, index) => {
    const level = index + 1;
    const size = Math.max(24, 38 - index * 3) * 2;
    return `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="Heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${Math.max(120, 300 - index * 25)}" w:after="120"/><w:outlineLvl w:val="${index}"/></w:pPr><w:rPr><w:b/><w:color w:val="17211B"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`;
  }).join("");
  return `${XML_DECLARATION}
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="PingFang SC"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:color w:val="17211B"/><w:sz w:val="52"/><w:szCs w:val="52"/></w:rPr></w:style>${headings}<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="720"/><w:spacing w:before="120" w:after="120"/></w:pPr><w:rPr><w:i/><w:color w:val="5E6A62"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="Code Block"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="360"/><w:shd w:fill="F1F3EF"/></w:pPr><w:rPr><w:rFonts w:ascii="Menlo" w:hAnsi="Menlo"/><w:sz w:val="19"/></w:rPr></w:style><w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="2A8C69"/><w:u w:val="single"/></w:rPr></w:style><w:style w:type="character" w:styleId="Code"><w:name w:val="Code"/><w:rPr><w:rFonts w:ascii="Menlo" w:hAnsi="Menlo"/><w:shd w:fill="F1F3EF"/></w:rPr></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9D7CF"/><w:left w:val="single" w:sz="4" w:color="D9D7CF"/><w:bottom w:val="single" w:sz="4" w:color="D9D7CF"/><w:right w:val="single" w:sz="4" w:color="D9D7CF"/><w:insideH w:val="single" w:sz="4" w:color="D9D7CF"/><w:insideV w:val="single" w:sz="4" w:color="D9D7CF"/></w:tblBorders></w:tblPr></w:style></w:styles>`;
}

function docxNumbering() {
  const bulletLevels = Array.from({ length: 7 }, (_, level) => `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="${720 + level * 360}"/></w:tabs><w:ind w:left="${720 + level * 360}" w:hanging="360"/></w:pPr></w:lvl>`).join("");
  const decimalLevels = Array.from({ length: 7 }, (_, level) => `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%${level + 1}."/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="${720 + level * 360}"/></w:tabs><w:ind w:left="${720 + level * 360}" w:hanging="360"/></w:pPr></w:lvl>`).join("");
  return `${XML_DECLARATION}
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${bulletLevels}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="multilevel"/>${decimalLevels}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;
}

function exportDocx(artifact: WorkspaceArtifact): OfficeExportResult {
  if (artifact.source.length > MAX_DOCX_EXPORT_SOURCE_CHARS) throw new Error("DOCX export is limited to 200,000 source characters.");
  const warnings = new Set<string>();
  const context: DocxContext = { relationships: [], warnings };
  const blocks = parseMarkdownBlocks(artifact.source);
  if (blocks.length > MAX_DOCX_EXPORT_BLOCKS) throw new Error("DOCX export is limited to 10,000 semantic blocks.");
  const body = blocks.map((block) => {
    if (block.type === "heading") return docxParagraph(block.source, context, { style: block.level === 1 ? "Title" : `Heading${Math.min(6, block.level)}` });
    if (block.type === "quote") return docxParagraph(block.source, context, { style: "Quote" });
    if (block.type === "list") return docxParagraph(block.source, context, { ordered: block.ordered, level: block.level });
    if (block.type === "table") return docxTable(block.rows, context);
    if (block.type === "code") {
      warnings.add("Fenced Markdown code was exported as preformatted Word text.");
      const lines = block.source.split("\n");
      const runs = lines.map((line, index) => `${index ? "<w:r><w:br/></w:r>" : ""}<w:r><w:rPr><w:rStyle w:val="Code"/></w:rPr><w:t xml:space="preserve">${xmlText(line || " ")}</w:t></w:r>`).join("");
      return `<w:p><w:pPr><w:pStyle w:val="CodeBlock"/></w:pPr>${runs}</w:p>`;
    }
    return docxParagraph(block.source, context);
  }).join("") || "<w:p/>";
  warnings.add("DOCX export preserves semantic structure; page layout, comments, and advanced Word styling are not generated.");
  const hyperlinkRelationships = context.relationships.map((relationship) => `<Relationship Id="${relationship.id}" Type="${OFFICE_RELATIONSHIPS}/hyperlink" Target="${xmlAttribute(relationship.target)}" TargetMode="External"/>`).join("");
  const title = packageBaseName(artifact.name);
  const parts = {
    "[Content_Types].xml": `${XML_DECLARATION}<Types xmlns="${CONTENT_TYPES}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
    "_rels/.rels": rootRelationships("word/document.xml"),
    "docProps/core.xml": coreProperties(title),
    "docProps/app.xml": appProperties("Pages"),
    "word/document.xml": `${XML_DECLARATION}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="${OFFICE_RELATIONSHIPS}"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`,
    "word/styles.xml": docxStyles(),
    "word/numbering.xml": docxNumbering(),
    "word/_rels/document.xml.rels": `${XML_DECLARATION}<Relationships xmlns="${PACKAGE_RELATIONSHIPS}"><Relationship Id="rId1" Type="${OFFICE_RELATIONSHIPS}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="${OFFICE_RELATIONSHIPS}/numbering" Target="numbering.xml"/>${hyperlinkRelationships}</Relationships>`,
  };
  return {
    bytes: zipPackage(parts),
    fileName: `${title}.docx`,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    warnings: [...warnings],
    targetType: "docx",
  };
}

function columnName(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function xlsxCell(reference: string, value: DataCell, style = 0) {
  const styleAttribute = style ? ` s="${style}"` : "";
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${reference}"${styleAttribute}><v>${value}</v></c>`;
  if (typeof value === "boolean") return `<c r="${reference}" t="b"${styleAttribute}><v>${value ? 1 : 0}</v></c>`;
  return `<c r="${reference}" t="inlineStr"${styleAttribute}><is><t xml:space="preserve">${xmlText(value == null ? "" : String(value))}</t></is></c>`;
}

function xlsxStyles() {
  return `${XML_DECLARATION}
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><color theme="1"/><name val="Aptos"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/><family val="2"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2A8C69"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD9D7CF"/></left><right style="thin"><color rgb="FFD9D7CF"/></right><top style="thin"><color rgb="FFD9D7CF"/></top><bottom style="thin"><color rgb="FFD9D7CF"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`;
}

function exportXlsx(artifact: WorkspaceArtifact): OfficeExportResult {
  const parsed = parseDataSource(artifact.source);
  if (parsed.errors.length) throw new Error(parsed.errors[0]);
  if (!parsed.columns.length) throw new Error("The data artifact does not contain any columns to export.");
  if (parsed.columns.length > 256) throw new Error("XLSX export is limited to 256 columns.");
  if (parsed.rows.length > 10_000) throw new Error("XLSX export is limited to 10,000 data rows.");
  if ((parsed.rows.length + 1) * parsed.columns.length > 50_000) throw new Error("XLSX export is limited to 50,000 cells.");
  const title = packageBaseName(artifact.name);
  const sheetName = (title.replace(/[:\\/?*\[\]]/g, "-").replace(/^'+|'+$/g, "").slice(0, 31) || "Rune data");
  const allRows: DataCell[][] = [
    parsed.columns,
    ...parsed.rows.map((row) => parsed.columns.map((column) => row[column] ?? null)),
  ];
  const rowsXml = allRows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => xlsxCell(`${columnName(columnIndex)}${rowIndex + 1}`, value, rowIndex === 0 ? 1 : 2)).join("")}</row>`).join("");
  const columnsXml = parsed.columns.map((column, index) => {
    const widest = Math.max(column.length, ...parsed.rows.slice(0, 200).map((row) => String(row[column] ?? "").length));
    return `<col min="${index + 1}" max="${index + 1}" width="${Math.max(10, Math.min(42, widest + 2))}" customWidth="1"/>`;
  }).join("");
  const range = `A1:${columnName(parsed.columns.length - 1)}${Math.max(1, allRows.length)}`;
  const parts = {
    "[Content_Types].xml": `${XML_DECLARATION}<Types xmlns="${CONTENT_TYPES}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
    "_rels/.rels": rootRelationships("xl/workbook.xml"),
    "docProps/core.xml": coreProperties(title),
    "docProps/app.xml": appProperties("Worksheets"),
    "xl/workbook.xml": `${XML_DECLARATION}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${OFFICE_RELATIONSHIPS}"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews><sheets><sheet name="${xmlAttribute(sheetName)}" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="0" fullCalcOnLoad="1"/></workbook>`,
    "xl/_rels/workbook.xml.rels": `${XML_DECLARATION}<Relationships xmlns="${PACKAGE_RELATIONSHIPS}"><Relationship Id="rId1" Type="${OFFICE_RELATIONSHIPS}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${OFFICE_RELATIONSHIPS}/styles" Target="styles.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": `${XML_DECLARATION}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${columnsXml}</cols><sheetData>${rowsXml}</sheetData><autoFilter ref="${range}"/><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`,
    "xl/styles.xml": xlsxStyles(),
  };
  return {
    bytes: zipPackage(parts),
    fileName: `${title}.xlsx`,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    warnings: ["XLSX export writes typed values only; formulas, charts, and source-specific spreadsheet formatting are not inferred from CSV or JSON."],
    targetType: "xlsx",
  };
}

function deckSlideModel(slide: DeckSlide, warnings: Set<string>): PptSlideModel {
  const blocks = parseMarkdownBlocks(slide.source);
  const headingIndex = blocks.findIndex((block) => block.type === "heading");
  const heading = headingIndex >= 0 ? blocks[headingIndex] : null;
  const title = heading?.type === "heading" ? plainMarkdownInline(heading.source, warnings) : "Untitled slide";
  const paragraphs: PptParagraph[] = [];
  const tables: string[][][] = [];
  blocks.forEach((block, index) => {
    if (index === headingIndex) return;
    if (block.type === "table") {
      tables.push(block.rows.map((row) => row.map((cell) => plainMarkdownInline(cell, warnings))));
      return;
    }
    if (block.type === "code") warnings.add("Fenced code in Deck Markdown was exported as plain presentation text.");
    const source = block.type === "code" ? block.source.replace(/\n/g, " · ") : block.source;
    if (/^\s*\{\{\s*chart\(/i.test(source)) {
      sanitizeInlineSource(source, warnings);
      return;
    }
    const text = plainMarkdownInline(source, warnings);
    if (!text) return;
    paragraphs.push({
      text,
      bullet: block.type === "list" || block.type === "quote",
      level: block.type === "list" ? block.level : 0,
    });
  });
  return { title, eyebrow: plainMarkdownInline(slide.eyebrow, warnings), paragraphs, tables, layout: slide.layout };
}

function pptRun(text: string, options: { size?: number; bold?: boolean; color?: string } = {}) {
  return `<a:r><a:rPr lang="en-US" sz="${options.size ?? 1800}"${options.bold ? ' b="1"' : ""} dirty="0"><a:solidFill><a:srgbClr val="${options.color ?? "17211B"}"/></a:solidFill><a:latin typeface="Aptos"/><a:ea typeface="PingFang SC"/></a:rPr><a:t>${xmlText(text)}</a:t></a:r>`;
}

function pptParagraph(paragraph: PptParagraph, options: { size?: number; bold?: boolean; color?: string } = {}) {
  const bullet = paragraph.bullet ? '<a:buChar char="•"/>' : "<a:buNone/>";
  const level = Math.max(0, Math.min(6, paragraph.level));
  const margin = 342900 + level * 342900;
  return `<a:p><a:pPr lvl="${level}" marL="${margin}" indent="-${paragraph.bullet ? 285750 : 0}">${bullet}</a:pPr>${pptRun(paragraph.text, options)}<a:endParaRPr lang="en-US" sz="${options.size ?? 1800}"/></a:p>`;
}

function pptShape(id: number, name: string, paragraphs: PptParagraph[], geometry: { x: number; y: number; cx: number; cy: number }, options: { placeholder?: "title" | "body"; size?: number; bold?: boolean; color?: string } = {}) {
  const placeholder = options.placeholder ? `<p:ph type="${options.placeholder}"/>` : "";
  const content = paragraphs.length
    ? paragraphs.map((paragraph) => pptParagraph(paragraph, options)).join("")
    : '<a:p><a:endParaRPr lang="en-US"/></a:p>';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xmlAttribute(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr>${placeholder}</p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="${geometry.x}" y="${geometry.y}"/><a:ext cx="${geometry.cx}" cy="${geometry.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="t"/><a:lstStyle/>${content}</p:txBody></p:sp>`;
}

function pptTable(id: number, rows: string[][], y: number) {
  const width = Math.max(1, ...rows.map((row) => row.length));
  const normalized = rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""));
  const totalWidth = 10_400_000;
  const columnWidth = Math.floor(totalWidth / width);
  const rowHeight = Math.max(360_000, Math.min(620_000, Math.floor(2_300_000 / Math.max(1, normalized.length))));
  const grid = Array.from({ length: width }, () => `<a:gridCol w="${columnWidth}"/>`).join("");
  const rowXml = normalized.map((row, rowIndex) => `<a:tr h="${rowHeight}">${row.map((cell) => `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p>${pptRun(cell, { size: 1300, bold: rowIndex === 0, color: rowIndex === 0 ? "FFFFFF" : "17211B" })}<a:endParaRPr lang="en-US" sz="1300"/></a:p></a:txBody><a:tcPr marL="70000" marR="70000" marT="50000" marB="50000">${rowIndex === 0 ? '<a:solidFill><a:srgbClr val="2A8C69"/></a:solidFill>' : '<a:solidFill><a:srgbClr val="FBFAF6"/></a:solidFill>'}<a:lnL w="6350"><a:solidFill><a:srgbClr val="D9D7CF"/></a:solidFill></a:lnL><a:lnR w="6350"><a:solidFill><a:srgbClr val="D9D7CF"/></a:solidFill></a:lnR><a:lnT w="6350"><a:solidFill><a:srgbClr val="D9D7CF"/></a:solidFill></a:lnT><a:lnB w="6350"><a:solidFill><a:srgbClr val="D9D7CF"/></a:solidFill></a:lnB></a:tcPr></a:tc>`).join("")}</a:tr>`).join("");
  const height = rowHeight * normalized.length;
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Table ${id}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="900000" y="${y}"/><a:ext cx="${totalWidth}" cy="${height}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid>${grid}</a:tblGrid>${rowXml}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}

function pptSlideXml(model: PptSlideModel) {
  const cover = model.layout === "cover";
  const background = cover ? "17231C" : "FBFAF6";
  const titleColor = cover ? "FFF8EC" : "17211B";
  const bodyColor = cover ? "D7DED8" : "455149";
  const titleY = cover ? 1_350_000 : 800_000;
  const bodyY = cover ? 3_100_000 : 1_850_000;
  const tableY = model.paragraphs.length ? 3_850_000 : 2_250_000;
  let nextId = 2;
  const shapes: string[] = [];
  if (model.eyebrow) shapes.push(pptShape(nextId++, "Eyebrow", [{ text: model.eyebrow.toUpperCase(), bullet: false, level: 0 }], { x: 900_000, y: 520_000, cx: 10_300_000, cy: 420_000 }, { size: 1100, bold: true, color: cover ? "FF8A6D" : "2A8C69" }));
  shapes.push(pptShape(nextId++, "Title", [{ text: model.title, bullet: false, level: 0 }], { x: 900_000, y: titleY, cx: 10_400_000, cy: cover ? 1_500_000 : 900_000 }, { placeholder: "title", size: cover ? 3400 : 2700, bold: true, color: titleColor }));
  if (model.paragraphs.length) shapes.push(pptShape(nextId++, "Content", model.paragraphs, { x: 900_000, y: bodyY, cx: 10_400_000, cy: model.tables.length ? 1_650_000 : 3_600_000 }, { placeholder: "body", size: cover ? 1700 : 1600, color: bodyColor }));
  model.tables.slice(0, 2).forEach((table, index) => shapes.push(pptTable(nextId++, table, tableY + index * 1_450_000)));
  return `${XML_DECLARATION}<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${OFFICE_RELATIONSHIPS}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${background}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes.join("")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function pptTheme() {
  const line = (width: number) => `<a:ln w="${width}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>`;
  return `${XML_DECLARATION}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Rune"><a:themeElements><a:clrScheme name="Rune"><a:dk1><a:srgbClr val="17211B"/></a:dk1><a:lt1><a:srgbClr val="FBFAF6"/></a:lt1><a:dk2><a:srgbClr val="233128"/></a:dk2><a:lt2><a:srgbClr val="E9E7DF"/></a:lt2><a:accent1><a:srgbClr val="FF5C35"/></a:accent1><a:accent2><a:srgbClr val="2A8C69"/></a:accent2><a:accent3><a:srgbClr val="3676D1"/></a:accent3><a:accent4><a:srgbClr val="8267CE"/></a:accent4><a:accent5><a:srgbClr val="C77B2C"/></a:accent5><a:accent6><a:srgbClr val="6E776F"/></a:accent6><a:hlink><a:srgbClr val="3676D1"/></a:hlink><a:folHlink><a:srgbClr val="8267CE"/></a:folHlink></a:clrScheme><a:fontScheme name="Rune"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface="PingFang SC"/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface="PingFang SC"/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="Rune"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></a:fillStyleLst><a:lnStyleLst>${line(6350)}${line(12700)}${line(19050)}</a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:solidFill><a:schemeClr val="lt2"/></a:solidFill><a:solidFill><a:schemeClr val="dk1"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}

function pptSlideMaster() {
  return `${XML_DECLARATION}<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${OFFICE_RELATIONSHIPS}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="Rune"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`;
}

function pptSlideLayout() {
  return `${XML_DECLARATION}<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${OFFICE_RELATIONSHIPS}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Rune Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
}

function exportPptx(artifact: WorkspaceArtifact): OfficeExportResult {
  const parsed = parseDeckSource(artifact.source);
  if (!parsed.deck) throw new Error(parsed.errors[0] ?? "The Deck Markdown source is not valid.");
  const warnings = new Set<string>();
  const models = parsed.deck.slides.map((slide) => deckSlideModel(slide, warnings));
  if (models.some((model) => model.tables.length > 2)) warnings.add("Only the first two tables on each slide are included in semantic PPTX export.");
  warnings.add("PPTX export preserves slide order, text, bullets, and tables; animation, speaker notes, live charts, and exact master styling are not generated.");
  const title = packageBaseName(artifact.name);
  const slideOverrides = models.map((_model, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  const slideRelationships = models.map((_model, index) => `<Relationship Id="rId${index + 2}" Type="${OFFICE_RELATIONSHIPS}/slide" Target="slides/slide${index + 1}.xml"/>`).join("");
  const slideIds = models.map((_model, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("");
  const parts: Record<string, string> = {
    "[Content_Types].xml": `${XML_DECLARATION}<Types xmlns="${CONTENT_TYPES}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slideOverrides}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
    "_rels/.rels": rootRelationships("ppt/presentation.xml"),
    "docProps/core.xml": coreProperties(parsed.deck.frontmatter.title || title),
    "docProps/app.xml": appProperties("Slides", models.length),
    "ppt/presentation.xml": `${XML_DECLARATION}<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${OFFICE_RELATIONSHIPS}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle/></p:presentation>`,
    "ppt/_rels/presentation.xml.rels": `${XML_DECLARATION}<Relationships xmlns="${PACKAGE_RELATIONSHIPS}"><Relationship Id="rId1" Type="${OFFICE_RELATIONSHIPS}/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slideRelationships}<Relationship Id="rId${models.length + 2}" Type="${OFFICE_RELATIONSHIPS}/presProps" Target="presProps.xml"/><Relationship Id="rId${models.length + 3}" Type="${OFFICE_RELATIONSHIPS}/theme" Target="theme/theme1.xml"/></Relationships>`,
    "ppt/presProps.xml": `${XML_DECLARATION}<p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${OFFICE_RELATIONSHIPS}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`,
    "ppt/slideMasters/slideMaster1.xml": pptSlideMaster(),
    "ppt/slideMasters/_rels/slideMaster1.xml.rels": `${XML_DECLARATION}<Relationships xmlns="${PACKAGE_RELATIONSHIPS}"><Relationship Id="rId1" Type="${OFFICE_RELATIONSHIPS}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="${OFFICE_RELATIONSHIPS}/theme" Target="../theme/theme1.xml"/></Relationships>`,
    "ppt/slideLayouts/slideLayout1.xml": pptSlideLayout(),
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels": `${XML_DECLARATION}<Relationships xmlns="${PACKAGE_RELATIONSHIPS}"><Relationship Id="rId1" Type="${OFFICE_RELATIONSHIPS}/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`,
    "ppt/theme/theme1.xml": pptTheme(),
  };
  models.forEach((model, index) => {
    parts[`ppt/slides/slide${index + 1}.xml`] = pptSlideXml(model);
    parts[`ppt/slides/_rels/slide${index + 1}.xml.rels`] = `${XML_DECLARATION}<Relationships xmlns="${PACKAGE_RELATIONSHIPS}"><Relationship Id="rId1" Type="${OFFICE_RELATIONSHIPS}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`;
  });
  return {
    bytes: zipPackage(parts),
    fileName: `${title}.pptx`,
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    warnings: [...warnings],
    targetType: "pptx",
  };
}

export function isOfficeExportArtifact(artifact: WorkspaceArtifact) {
  return artifact.kind === "document"
    || artifact.kind === "data"
    || (artifact.kind === "slides" && artifact.name.toLowerCase().endsWith(".deck.md"));
}

export function exportOfficeArtifact(artifact: WorkspaceArtifact): OfficeExportResult {
  if (!artifact.source.trim()) throw new Error("The source is empty.");
  if (artifact.source.length > MAX_OFFICE_EXPORT_SOURCE_CHARS) throw new Error("Office export is limited to 2,000,000 source characters.");
  if (artifact.kind === "document") return exportDocx(artifact);
  if (artifact.kind === "data") return exportXlsx(artifact);
  if (artifact.kind === "slides" && artifact.name.toLowerCase().endsWith(".deck.md")) return exportPptx(artifact);
  throw new Error("Office export supports Markdown documents, CSV/JSON data, and Deck Markdown presentations.");
}
