import {
  DOMParser,
  type Document as XmlDocument,
  type Element as XmlElement,
  type Node as XmlNode,
} from "@xmldom/xmldom";
import { strFromU8, unzipSync, type Unzipped } from "fflate";
import type { DataCell, WorkspaceArtifact } from "./workspace.ts";

export const MAX_OFFICE_IMPORT_BYTES = 12 * 1024 * 1024;

const MAX_PACKAGE_ENTRIES = 2_000;
const MAX_XML_PART_BYTES = 6 * 1024 * 1024;
const MAX_XML_TOTAL_BYTES = 24 * 1024 * 1024;
const MAX_OUTPUT_CHARS = 200_000;
const MAX_TOTAL_OUTPUT_CHARS = 500_000;
const MAX_WORD_BLOCKS = 10_000;
const MAX_WORKBOOK_SHEETS = 10;
const MAX_WORKBOOK_ROWS = 10_000;
const MAX_WORKBOOK_COLUMNS = 256;
const MAX_WORKBOOK_CELLS = 50_000;
const MAX_PRESENTATION_SLIDES = 40;

type OfficeKind = "docx" | "xlsx" | "pptx";

export type OfficeImportResult = {
  artifacts: WorkspaceArtifact[];
  warnings: string[];
  sourceType: OfficeKind;
};

type Relationship = {
  id: string;
  target: string;
  targetMode: string;
  type: string;
};

type PackageContext = {
  files: Unzipped;
  warnings: string[];
};

function extensionOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function isOfficeFileName(name: string): boolean {
  return ["docx", "xlsx", "pptx"].includes(extensionOf(name));
}

function officeKind(name: string): OfficeKind {
  const extension = extensionOf(name);
  if (extension === "docx" || extension === "xlsx" || extension === "pptx") return extension;
  throw new Error("Choose a DOCX, XLSX, or PPTX file for Office import.");
}

function toBytes(input: ArrayBuffer | Uint8Array) {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

function openPackage(input: ArrayBuffer | Uint8Array): PackageContext {
  const bytes = toBytes(input);
  if (!bytes.length || bytes.length > MAX_OFFICE_IMPORT_BYTES) {
    throw new Error("Office import is limited to 12 MB per file.");
  }
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error("This file is not a valid Open XML package.");
  let entryCount = 0;
  let expandedXmlBytes = 0;
  const seenPaths = new Set<string>();
  try {
    const files = unzipSync(bytes, {
      filter(file) {
        entryCount += 1;
        if (entryCount > MAX_PACKAGE_ENTRIES) throw new Error("The Office package contains too many entries.");
        const path = file.name.replaceAll("\\", "/");
        if (path.split("/").includes("..") || path.includes("\0")) {
          throw new Error("The Office package contains an unsafe part path.");
        }
        if (seenPaths.has(path)) throw new Error(`The Office package repeats part ${path}.`);
        seenPaths.add(path);
        const relevant = path.endsWith(".xml") || path.endsWith(".rels");
        if (!relevant) return false;
        if (file.originalSize > MAX_XML_PART_BYTES) throw new Error(`${path} exceeds Rune's 6 MB XML-part limit.`);
        expandedXmlBytes += file.originalSize;
        if (expandedXmlBytes > MAX_XML_TOTAL_BYTES) throw new Error("The Office package expands beyond Rune's 24 MB XML limit.");
        return true;
      },
    });
    const extractedEntries = Object.entries(files);
    const actualXmlBytes = extractedEntries.reduce((total, [path, data]) => {
      if (data.length > MAX_XML_PART_BYTES) throw new Error(`${path} exceeds Rune's 6 MB XML-part limit.`);
      return total + data.length;
    }, 0);
    if (actualXmlBytes > MAX_XML_TOTAL_BYTES) throw new Error("The Office package expands beyond Rune's 24 MB XML limit.");
    return { files, warnings: [] };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The ZIP package could not be opened.";
    throw new Error(`Office import failed: ${detail}`);
  }
}

function parseXml(source: string, path: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error(`${path} contains a blocked XML declaration.`);
  const issues: string[] = [];
  const document = new DOMParser({
    locator: false,
    onError(_level, message) {
      issues.push(message);
    },
  }).parseFromString(source, "application/xml");
  if (issues.length || !document.documentElement) {
    throw new Error(`${path} is not valid XML${issues[0] ? `: ${issues[0]}` : "."}`);
  }
  return document;
}

function xmlPart(context: PackageContext, path: string): XmlDocument;
function xmlPart(context: PackageContext, path: string, required: true): XmlDocument;
function xmlPart(context: PackageContext, path: string, required: false): XmlDocument | null;
function xmlPart(context: PackageContext, path: string, required = true): XmlDocument | null {
  const bytes = context.files[path];
  if (!bytes) {
    if (required) throw new Error(`Required Office part is missing: ${path}`);
    return null;
  }
  return parseXml(strFromU8(bytes), path);
}

function localName(node: XmlNode) {
  return node.localName || node.nodeName.split(":").pop() || node.nodeName;
}

function childElements(node: XmlNode, name?: string): XmlElement[] {
  const result: XmlElement[] = [];
  for (let index = 0; index < node.childNodes.length; index += 1) {
    const child = node.childNodes.item(index);
    if (child?.nodeType === 1 && (!name || localName(child) === name)) result.push(child as XmlElement);
  }
  return result;
}

function descendantElements(node: XmlDocument | XmlElement, name: string): XmlElement[] {
  const result: XmlElement[] = [];
  const elements = node.getElementsByTagName("*");
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements.item(index);
    if (element && localName(element) === name) result.push(element);
  }
  return result;
}

function firstChild(node: XmlNode, name: string) {
  return childElements(node, name)[0] ?? null;
}

function firstDescendant(node: XmlDocument | XmlElement, name: string) {
  return descendantElements(node, name)[0] ?? null;
}

function attribute(element: XmlElement | null, name: string) {
  if (!element) return "";
  for (let index = 0; index < element.attributes.length; index += 1) {
    const item = element.attributes.item(index);
    if (item && (item.localName === name || item.name === name)) return item.value;
  }
  return "";
}

function relationshipId(element: XmlElement | null) {
  if (!element) return "";
  for (let index = 0; index < element.attributes.length; index += 1) {
    const item = element.attributes.item(index);
    if (item && (item.name === "r:id" || (item.localName === "id" && /relationships/i.test(item.namespaceURI ?? "")))) {
      return item.value;
    }
  }
  return attribute(element, "id");
}

function elementText(element: XmlElement | null) {
  return element?.textContent ?? "";
}

function relationships(context: PackageContext, path: string) {
  const document = xmlPart(context, path, false);
  const result = new Map<string, Relationship>();
  if (!document) return result;
  descendantElements(document, "Relationship").forEach((element) => {
    const relationship = {
      id: attribute(element, "Id"),
      target: attribute(element, "Target"),
      targetMode: attribute(element, "TargetMode"),
      type: attribute(element, "Type"),
    };
    if (relationship.id && relationship.target) result.set(relationship.id, relationship);
  });
  return result;
}

function resolvePartPath(sourcePart: string, target: string) {
  if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) return null;
  const sourceDirectory = sourcePart.split("/").slice(0, -1);
  const segments = target.startsWith("/") ? [] : sourceDirectory;
  for (const segment of target.replace(/^\//, "").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (!segments.length) throw new Error("An Office relationship escapes the package root.");
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join("/");
}

function baseName(name: string) {
  return name.replace(/\.(?:docx|xlsx|pptx)$/i, "").trim() || "imported-office";
}

function safeFileSegment(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "artifact";
}

function stableImportId(fileName: string, suffix = "") {
  const slug = safeFileSegment(`${baseName(fileName)}${suffix ? `-${suffix}` : ""}`).toLowerCase();
  return `import-${slug}`;
}

function escapeMarkdown(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/([`*_[\]{}#>+!~<>])/g, "\\$1");
}

function oneLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function boundedSource(source: string, label: string) {
  const normalized = `${source.trim()}\n`;
  if (!normalized.trim()) throw new Error(`${label} did not contain importable text.`);
  if (normalized.length > MAX_OUTPUT_CHARS) throw new Error(`${label} converts to more than 200,000 source characters.`);
  return normalized;
}

function enabledProperty(element: XmlElement | null, name: string) {
  const property = element ? firstDescendant(element, name) : null;
  if (!property) return false;
  return !/^(?:0|false|off)$/i.test(attribute(property, "val"));
}

function decorateRun(text: string, run: XmlElement) {
  if (!text) return "";
  const properties = firstChild(run, "rPr");
  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match || !match[2]) return escapeMarkdown(text);
  let core = escapeMarkdown(match[2]);
  if (enabledProperty(properties, "b")) core = `**${core}**`;
  if (enabledProperty(properties, "i")) core = `_${core}_`;
  if (enabledProperty(properties, "strike")) core = `~~${core}~~`;
  return `${match[1]}${core}${match[3]}`;
}

function wordRunText(run: XmlElement) {
  let value = "";
  function visit(node: XmlNode) {
    if (node.nodeType !== 1) return;
    const name = localName(node);
    if (name === "rPr") return;
    if (name === "t" || name === "instrText") {
      value += node.textContent ?? "";
      return;
    }
    if (name === "tab") {
      value += "\t";
      return;
    }
    if (name === "br" || name === "cr") {
      value += "\n";
      return;
    }
    for (let index = 0; index < node.childNodes.length; index += 1) {
      const child = node.childNodes.item(index);
      if (child) visit(child);
    }
  }
  visit(run);
  return decorateRun(value, run);
}

function safeLinkTarget(target: string) {
  if (!/^(?:https?:|mailto:)/i.test(target)) return "";
  return target.replaceAll(">", "%3E");
}

function wordInlineContent(node: XmlElement, rels: Map<string, Relationship>): string {
  let result = "";
  childElements(node).forEach((child) => {
    const name = localName(child);
    if (name === "r") {
      result += wordRunText(child);
      return;
    }
    if (name === "hyperlink") {
      const label = wordInlineContent(child, rels);
      const relation = rels.get(relationshipId(child));
      const anchor = attribute(child, "anchor");
      const target = relation?.targetMode === "External" ? safeLinkTarget(relation.target) : anchor ? `#${anchor}` : "";
      result += target && label ? `[${label}](<${target}>)` : label;
      return;
    }
    if (name !== "pPr" && name !== "del") result += wordInlineContent(child, rels);
  });
  return result;
}

function wordStyleHeadings(context: PackageContext) {
  const document = xmlPart(context, "word/styles.xml", false);
  const result = new Map<string, { heading?: number; quote?: boolean }>();
  if (!document) return result;
  descendantElements(document, "style").forEach((style) => {
    const id = attribute(style, "styleId");
    if (!id || (attribute(style, "type") && attribute(style, "type") !== "paragraph")) return;
    const name = attribute(firstDescendant(style, "name"), "val") || id;
    const outlineValue = attribute(firstDescendant(style, "outlineLvl"), "val");
    const outline = outlineValue === "" ? Number.NaN : Number(outlineValue);
    const headingMatch = `${id} ${name}`.match(/heading\s*([1-6])/i);
    const heading = headingMatch ? Number(headingMatch[1]) : Number.isInteger(outline) && outline >= 0 && outline <= 5 ? outline + 1 : /^(?:title|subtitle)$/i.test(name) ? 1 : undefined;
    result.set(id, { heading, quote: /quote/i.test(name) });
  });
  return result;
}

function wordNumbering(context: PackageContext) {
  const document = xmlPart(context, "word/numbering.xml", false);
  const formats = new Map<string, string>();
  if (!document) return formats;
  const abstractFormats = new Map<string, Map<string, string>>();
  descendantElements(document, "abstractNum").forEach((abstract) => {
    const levels = new Map<string, string>();
    descendantElements(abstract, "lvl").forEach((level) => {
      levels.set(attribute(level, "ilvl") || "0", attribute(firstDescendant(level, "numFmt"), "val") || "bullet");
    });
    abstractFormats.set(attribute(abstract, "abstractNumId"), levels);
  });
  descendantElements(document, "num").forEach((numbering) => {
    const id = attribute(numbering, "numId");
    const abstractId = attribute(firstDescendant(numbering, "abstractNumId"), "val");
    abstractFormats.get(abstractId)?.forEach((format, level) => formats.set(`${id}:${level}`, format));
  });
  return formats;
}

function wordParagraph(
  paragraph: XmlElement,
  rels: Map<string, Relationship>,
  styles: Map<string, { heading?: number; quote?: boolean }>,
  numbering: Map<string, string>,
) {
  const text = wordInlineContent(paragraph, rels).trim();
  if (!text) return "";
  const properties = firstChild(paragraph, "pPr");
  const styleId = attribute(properties ? firstDescendant(properties, "pStyle") : null, "val");
  const style = styles.get(styleId);
  if (style?.heading) return `${"#".repeat(style.heading)} ${text}`;
  if (style?.quote) return `> ${text}`;
  const numProperties = properties ? firstDescendant(properties, "numPr") : null;
  const numId = attribute(numProperties ? firstDescendant(numProperties, "numId") : null, "val");
  if (numId) {
    const level = attribute(numProperties ? firstDescendant(numProperties, "ilvl") : null, "val") || "0";
    const format = numbering.get(`${numId}:${level}`) ?? "bullet";
    const indent = Math.max(0, Math.min(6, Number(level) || 0));
    return `${"  ".repeat(indent)}${format === "bullet" ? "-" : "1."} ${text}`;
  }
  return text;
}

function markdownTable(rows: string[][]) {
  const width = Math.max(0, ...rows.map((row) => row.length));
  if (!width) return "";
  const normalized = rows.map((row) => Array.from({ length: width }, (_, index) => oneLine(row[index] ?? "").replaceAll("|", "\\|")));
  const header = normalized[0];
  const body = normalized.slice(1);
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function wordTable(
  table: XmlElement,
  rels: Map<string, Relationship>,
  styles: Map<string, { heading?: number; quote?: boolean }>,
  numbering: Map<string, string>,
) {
  const rows = childElements(table, "tr").map((row) => childElements(row, "tc").map((cell) => (
    descendantElements(cell, "p")
      .map((paragraph) => wordParagraph(paragraph, rels, styles, numbering))
      .filter(Boolean)
      .join(" / ")
  )));
  return markdownTable(rows);
}

function convertDocx(fileName: string, context: PackageContext): OfficeImportResult {
  const document = xmlPart(context, "word/document.xml");
  const body = firstDescendant(document, "body");
  if (!body) throw new Error("The DOCX main document does not contain a body.");
  const rels = relationships(context, "word/_rels/document.xml.rels");
  const styles = wordStyleHeadings(context);
  const numbering = wordNumbering(context);
  const blocks: string[] = [];
  childElements(body).forEach((block) => {
    if (blocks.length >= MAX_WORD_BLOCKS) throw new Error("The DOCX contains more than 10,000 body blocks.");
    if (localName(block) === "p") {
      const paragraph = wordParagraph(block, rels, styles, numbering);
      if (paragraph) blocks.push(paragraph);
    } else if (localName(block) === "tbl") {
      const table = wordTable(block, rels, styles, numbering);
      if (table) blocks.push(table);
    }
  });
  const imageCount = descendantElements(document, "drawing").length + descendantElements(document, "pict").length;
  if (imageCount) context.warnings.push(`${imageCount} embedded image${imageCount === 1 ? " was" : "s were"} omitted from the semantic DOCX import.`);
  if (context.files["word/comments.xml"]) context.warnings.push("DOCX comments were not imported into canonical Markdown.");
  const source = boundedSource(blocks.join("\n\n"), "DOCX");
  return {
    sourceType: "docx",
    warnings: context.warnings,
    artifacts: [{
      id: stableImportId(fileName),
      name: `${safeFileSegment(baseName(fileName))}.md`,
      kind: "document",
      language: "Markdown",
      source,
    }],
  };
}

function excelColumnIndex(reference: string) {
  const letters = reference.match(/^([A-Z]+)\d+$/i)?.[1].toUpperCase();
  if (!letters) return -1;
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return index - 1;
}

function sharedStrings(context: PackageContext) {
  const document = xmlPart(context, "xl/sharedStrings.xml", false);
  if (!document) return [];
  return descendantElements(document, "si").map((item) => (
    descendantElements(item, "t").map(elementText).join("")
  ));
}

function dateStyleIndexes(context: PackageContext) {
  const document = xmlPart(context, "xl/styles.xml", false);
  const result = new Set<number>();
  if (!document) return result;
  const customFormats = new Map<number, string>();
  descendantElements(document, "numFmt").forEach((format) => {
    customFormats.set(Number(attribute(format, "numFmtId")), attribute(format, "formatCode"));
  });
  const builtInDateFormats = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
  const cellFormats = firstDescendant(document, "cellXfs");
  if (!cellFormats) return result;
  childElements(cellFormats, "xf").forEach((format, index) => {
    const id = Number(attribute(format, "numFmtId"));
    const code = (customFormats.get(id) ?? "").replace(/"[^\"]*"|\[[^\]]*\]/g, "");
    if (builtInDateFormats.has(id) || /[ymdhis]/i.test(code)) result.add(index);
  });
  return result;
}

function excelDate(serial: number, uses1904Epoch: boolean) {
  const epoch = uses1904Epoch ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const date = new Date(epoch + serial * 86_400_000);
  if (!Number.isFinite(date.getTime())) return String(serial);
  const iso = date.toISOString();
  return Math.abs(serial % 1) < 1e-9 ? iso.slice(0, 10) : iso.slice(0, 19).replace("T", " ");
}

function excelCellValue(
  cell: XmlElement,
  strings: string[],
  dateStyles: Set<number>,
  uses1904Epoch: boolean,
  formulaBudget: { count: number },
): DataCell {
  const type = attribute(cell, "t");
  const raw = elementText(firstChild(cell, "v"));
  if (firstChild(cell, "f")) formulaBudget.count += 1;
  if (type === "inlineStr") return descendantElements(cell, "t").map(elementText).join("");
  if (type === "s") return strings[Number(raw)] ?? "";
  if (type === "b") return raw === "1";
  if (type === "str" || type === "e" || type === "d") return raw;
  if (!raw) return null;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return raw;
  const styleIndex = Number(attribute(cell, "s"));
  return dateStyles.has(styleIndex) ? excelDate(numeric, uses1904Epoch) : numeric;
}

function worksheetRows(
  document: XmlDocument,
  strings: string[],
  dateStyles: Set<number>,
  uses1904Epoch: boolean,
  cellBudget: { count: number },
  formulaBudget: { count: number },
) {
  const sparseRows = new Map<number, Map<number, DataCell>>();
  let maximumColumn = -1;
  descendantElements(document, "row").forEach((row, rowOffset) => {
    const declaredRow = Number(attribute(row, "r"));
    const rowIndex = Number.isInteger(declaredRow) && declaredRow > 0 ? declaredRow - 1 : rowOffset;
    if (rowIndex >= MAX_WORKBOOK_ROWS) throw new Error("An XLSX worksheet exceeds the 10,000-row semantic import limit.");
    const values = new Map<number, DataCell>();
    let inferredColumn = 0;
    childElements(row, "c").forEach((cell) => {
      const referenceColumn = excelColumnIndex(attribute(cell, "r"));
      const column = referenceColumn >= 0 ? referenceColumn : inferredColumn;
      inferredColumn = column + 1;
      if (column >= MAX_WORKBOOK_COLUMNS) throw new Error("An XLSX worksheet exceeds the 256-column semantic import limit.");
      cellBudget.count += 1;
      if (cellBudget.count > MAX_WORKBOOK_CELLS) throw new Error("The XLSX contains more than 50,000 imported cells.");
      values.set(column, excelCellValue(cell, strings, dateStyles, uses1904Epoch, formulaBudget));
      maximumColumn = Math.max(maximumColumn, column);
    });
    if (values.size) sparseRows.set(rowIndex, values);
  });
  if (!sparseRows.size || maximumColumn < 0) return [];
  const maximumRow = Math.max(...sparseRows.keys());
  return Array.from({ length: maximumRow + 1 }, (_, rowIndex) => (
    Array.from({ length: maximumColumn + 1 }, (_, columnIndex) => sparseRows.get(rowIndex)?.get(columnIndex) ?? null)
  ));
}

function csvCell(value: DataCell, injectionBudget: { count: number }) {
  if (value == null) return "";
  let string = String(value);
  if (typeof value === "string" && /^[\t\r\n ]*[=+@-]/.test(string)) {
    string = `'${string}`;
    injectionBudget.count += 1;
  }
  return /[",\r\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

function toCsv(rows: DataCell[][], injectionBudget: { count: number }) {
  return rows.map((row) => row.map((value) => csvCell(value, injectionBudget)).join(",")).join("\n");
}

function convertXlsx(fileName: string, context: PackageContext): OfficeImportResult {
  const workbook = xmlPart(context, "xl/workbook.xml");
  const rels = relationships(context, "xl/_rels/workbook.xml.rels");
  const strings = sharedStrings(context);
  const dateStyles = dateStyleIndexes(context);
  const workbookProperties = firstDescendant(workbook, "workbookPr");
  const uses1904Epoch = /^(?:1|true)$/i.test(attribute(workbookProperties, "date1904"));
  const allSheets = descendantElements(workbook, "sheet");
  const visibleSheets = allSheets.filter((sheet) => !/^(?:hidden|veryHidden)$/i.test(attribute(sheet, "state")));
  if (visibleSheets.length < allSheets.length) context.warnings.push(`${allSheets.length - visibleSheets.length} hidden worksheet${allSheets.length - visibleSheets.length === 1 ? " was" : "s were"} not imported.`);
  if (visibleSheets.length > MAX_WORKBOOK_SHEETS) context.warnings.push(`Only the first ${MAX_WORKBOOK_SHEETS} visible worksheets were imported.`);
  const selectedSheets = visibleSheets.slice(0, MAX_WORKBOOK_SHEETS);
  const artifacts: WorkspaceArtifact[] = [];
  const usedNames = new Set<string>();
  const cellBudget = { count: 0 };
  const formulaBudget = { count: 0 };
  const injectionBudget = { count: 0 };
  selectedSheets.forEach((sheet, index) => {
    const relation = rels.get(relationshipId(sheet));
    const partPath = relation ? resolvePartPath("xl/workbook.xml", relation.target) : null;
    if (!partPath) throw new Error(`Worksheet relationship is missing for ${attribute(sheet, "name") || index + 1}.`);
    const worksheet = xmlPart(context, partPath);
    const rows = worksheetRows(worksheet, strings, dateStyles, uses1904Epoch, cellBudget, formulaBudget);
    if (!rows.length) {
      context.warnings.push(`${attribute(sheet, "name") || `Sheet ${index + 1}`} was empty and was not imported.`);
      return;
    }
    const sheetName = safeFileSegment(attribute(sheet, "name") || `sheet-${index + 1}`);
    const base = safeFileSegment(baseName(fileName));
    let outputName = selectedSheets.length === 1 ? `${base}.csv` : `${base}--${sheetName}.csv`;
    let suffix = 2;
    while (usedNames.has(outputName)) {
      outputName = `${base}--${sheetName}-${suffix}.csv`;
      suffix += 1;
    }
    usedNames.add(outputName);
    artifacts.push({
      id: stableImportId(fileName, sheetName),
      name: outputName,
      kind: "data",
      language: "CSV",
      source: boundedSource(toCsv(rows, injectionBudget), `XLSX worksheet ${sheetName}`),
    });
  });
  if (!artifacts.length) throw new Error("The XLSX did not contain a non-empty visible worksheet.");
  if (artifacts.reduce((total, artifact) => total + artifact.source.length, 0) > MAX_TOTAL_OUTPUT_CHARS) {
    throw new Error("The XLSX converts to more than 500,000 total source characters.");
  }
  if (formulaBudget.count) context.warnings.push(`${formulaBudget.count} formula cell${formulaBudget.count === 1 ? " was" : "s were"} imported using the cached workbook value.`);
  if (injectionBudget.count) context.warnings.push(`${injectionBudget.count} formula-leading text cell${injectionBudget.count === 1 ? " was" : "s were"} prefixed with an apostrophe for CSV safety.`);
  return { sourceType: "xlsx", artifacts, warnings: context.warnings };
}

type SlideParagraph = { text: string; bullet: boolean; level: number };
type SlideShape = { title: boolean; paragraphs: SlideParagraph[] };

function pptParagraphs(shape: XmlElement): SlideParagraph[] {
  const textBody = firstDescendant(shape, "txBody");
  if (!textBody) return [];
  return descendantElements(textBody, "p").map((paragraph) => {
    const text = oneLine(descendantElements(paragraph, "t").map(elementText).join(""));
    const properties = firstChild(paragraph, "pPr");
    const bullet = Boolean(properties && (firstDescendant(properties, "buChar") || firstDescendant(properties, "buAutoNum")));
    const level = Math.max(0, Math.min(6, Number(attribute(properties, "lvl")) || 0));
    return { text, bullet, level };
  }).filter((paragraph) => paragraph.text);
}

function pptShape(shape: XmlElement): SlideShape | null {
  const paragraphs = pptParagraphs(shape);
  if (!paragraphs.length) return null;
  const placeholder = firstDescendant(firstDescendant(shape, "nvPr") ?? shape, "ph");
  const placeholderType = attribute(placeholder, "type");
  return { title: placeholderType === "title" || placeholderType === "ctrTitle", paragraphs };
}

function pptTable(table: XmlElement) {
  const rows = childElements(table, "tr").map((row) => childElements(row, "tc").map((cell) => (
    oneLine(descendantElements(cell, "t").map(elementText).join(""))
  )));
  return markdownTable(rows.map((row) => row.map(escapeMarkdown)));
}

function slideContent(document: XmlDocument) {
  const shapes: SlideShape[] = [];
  const tables: string[] = [];
  const shapeTree = firstDescendant(document, "spTree");
  function visit(container: XmlElement) {
    childElements(container).forEach((child) => {
      const name = localName(child);
      if (name === "sp") {
        const shape = pptShape(child);
        if (shape) shapes.push(shape);
      } else if (name === "graphicFrame") {
        const table = firstDescendant(child, "tbl");
        if (table) {
          const markdown = pptTable(table);
          if (markdown) tables.push(markdown);
        }
      } else if (name === "grpSp") {
        visit(child);
      }
    });
  }
  if (shapeTree) visit(shapeTree);
  return { shapes, tables };
}

function escapeDeckText(value: string) {
  const escaped = escapeMarkdown(oneLine(value));
  return escaped === "---" ? "\\---" : escaped;
}

function presentationTitle(context: PackageContext, fileName: string) {
  const core = xmlPart(context, "docProps/core.xml", false);
  const title = core ? oneLine(elementText(firstDescendant(core, "title"))) : "";
  return (title || baseName(fileName)).slice(0, 120);
}

function convertPptx(fileName: string, context: PackageContext): OfficeImportResult {
  const presentation = xmlPart(context, "ppt/presentation.xml");
  const rels = relationships(context, "ppt/_rels/presentation.xml.rels");
  const slideIds = descendantElements(presentation, "sldId");
  if (slideIds.length > MAX_PRESENTATION_SLIDES) context.warnings.push(`Only the first ${MAX_PRESENTATION_SLIDES} slides were imported.`);
  const selectedSlides = slideIds.slice(0, MAX_PRESENTATION_SLIDES);
  const slideSources: string[] = [];
  let omittedImages = 0;
  let omittedCharts = 0;
  selectedSlides.forEach((slideId, index) => {
    const relation = rels.get(relationshipId(slideId));
    const partPath = relation ? resolvePartPath("ppt/presentation.xml", relation.target) : null;
    if (!partPath) throw new Error(`Slide relationship is missing at position ${index + 1}.`);
    const slide = xmlPart(context, partPath);
    omittedImages += descendantElements(slide, "pic").length;
    omittedCharts += descendantElements(slide, "chart").length;
    const content = slideContent(slide);
    const explicitTitle = content.shapes.find((shape) => shape.title)?.paragraphs.map((paragraph) => paragraph.text).join(" ");
    const firstShape = content.shapes[0];
    const title = explicitTitle || firstShape?.paragraphs[0]?.text || `Slide ${index + 1}`;
    let consumedFallbackTitle = !explicitTitle && Boolean(firstShape?.paragraphs[0]?.text);
    const body: string[] = [];
    content.shapes.forEach((shape) => {
      if (shape.title) return;
      const inheritedBullet = shape.paragraphs.length > 1;
      shape.paragraphs.forEach((paragraph) => {
        if (consumedFallbackTitle) {
          consumedFallbackTitle = false;
          return;
        }
        const text = escapeDeckText(paragraph.text);
        if (!text) return;
        body.push(paragraph.bullet || inheritedBullet
          ? `${"  ".repeat(paragraph.level)}- ${text}`
          : text);
      });
    });
    body.push(...content.tables);
    const layout = index === 0 && body.length <= 1 && !content.tables.length ? "cover" : "content";
    slideSources.push([
      `<!-- layout: ${layout} -->`,
      "",
      `# ${escapeDeckText(title)}`,
      ...(body.length ? ["", ...body] : []),
    ].join("\n"));
  });
  if (!slideSources.length) throw new Error("The PPTX did not contain any slides.");
  if (omittedImages) context.warnings.push(`${omittedImages} slide image${omittedImages === 1 ? " was" : "s were"} omitted from semantic import.`);
  if (omittedCharts) context.warnings.push(`${omittedCharts} embedded chart${omittedCharts === 1 ? " was" : "s were"} omitted; import its source data as CSV to rebuild a live Rune chart.`);
  const title = presentationTitle(context, fileName);
  const language = /[\u3400-\u9fff]/.test(`${title} ${slideSources.join(" ")}`) ? "zh-CN" : "en";
  const source = boundedSource([
    "---",
    "version: 1",
    `title: ${oneLine(title)}`,
    "theme: rune",
    "ratio: 16:9",
    `lang: ${language}`,
    "---",
    "",
    slideSources.join("\n\n---\n\n"),
  ].join("\n"), "PPTX");
  return {
    sourceType: "pptx",
    warnings: context.warnings,
    artifacts: [{
      id: stableImportId(fileName),
      name: `${safeFileSegment(baseName(fileName))}.deck.md`,
      kind: "slides",
      language: "Deck Markdown",
      source,
    }],
  };
}

export function convertOfficeFile(fileName: string, input: ArrayBuffer | Uint8Array): OfficeImportResult {
  const kind = officeKind(fileName);
  const context = openPackage(input);
  if (kind === "docx") return convertDocx(fileName, context);
  if (kind === "xlsx") return convertXlsx(fileName, context);
  return convertPptx(fileName, context);
}
