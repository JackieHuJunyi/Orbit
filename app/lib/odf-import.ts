import {
  DOMParser,
  type Document as XmlDocument,
  type Element as XmlElement,
  type Node as XmlNode,
} from "@xmldom/xmldom";
import { strFromU8, unzipSync, type Unzipped } from "fflate";

import type { DataCell, WorkspaceArtifact } from "./workspace.ts";

export const MAX_ODF_IMPORT_BYTES = 12 * 1024 * 1024;

const MAX_PACKAGE_ENTRIES = 2_000;
const MAX_XML_PART_BYTES = 6 * 1024 * 1024;
const MAX_XML_TOTAL_BYTES = 24 * 1024 * 1024;
const MAX_OUTPUT_CHARS = 200_000;
const MAX_TOTAL_OUTPUT_CHARS = 500_000;
const MAX_TEXT_BLOCKS = 10_000;
const MAX_SHEETS = 10;
const MAX_ROWS = 10_000;
const MAX_COLUMNS = 256;
const MAX_CELLS = 50_000;
const MAX_SLIDES = 40;

const ODF_MIME_TYPES = {
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
} as const;

type OdfKind = keyof typeof ODF_MIME_TYPES;

type PackageContext = {
  files: Unzipped;
  paths: string[];
  warnings: string[];
};

type TextStyle = {
  bold: boolean;
  italic: boolean;
  strike: boolean;
};

export type OdfImportResult = {
  artifacts: WorkspaceArtifact[];
  warnings: string[];
  sourceType: OdfKind;
};

function extensionOf(name: string) {
  return name.split(".").pop()?.toLocaleLowerCase("en-US") ?? "";
}

export function isOdfFileName(name: string) {
  return ["odt", "ods", "odp"].includes(extensionOf(name));
}

function odfKind(fileName: string): OdfKind {
  const extension = extensionOf(fileName);
  if (extension === "odt" || extension === "ods" || extension === "odp") return extension;
  throw new Error("Choose an ODT, ODS, or ODP file for OpenDocument import.");
}

function toBytes(input: ArrayBuffer | Uint8Array) {
  return input instanceof Uint8Array ? new Uint8Array(input) : new Uint8Array(input.slice(0));
}

function firstZipEntry(bytes: Uint8Array) {
  if (bytes.length < 30 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    throw new Error("This file is not a valid OpenDocument ZIP package.");
  }
  const compressionMethod = bytes[8] | (bytes[9] << 8);
  const nameLength = bytes[26] | (bytes[27] << 8);
  const extraLength = bytes[28] | (bytes[29] << 8);
  if (30 + nameLength + extraLength > bytes.length) throw new Error("The OpenDocument ZIP header is truncated.");
  const name = new TextDecoder().decode(bytes.subarray(30, 30 + nameLength));
  return { name, compressionMethod };
}

function openPackage(kind: OdfKind, input: ArrayBuffer | Uint8Array): PackageContext {
  const bytes = toBytes(input);
  if (!bytes.length || bytes.length > MAX_ODF_IMPORT_BYTES) {
    throw new Error("OpenDocument import is limited to 12 MB per file.");
  }
  const first = firstZipEntry(bytes);
  if (first.name !== "mimetype" || first.compressionMethod !== 0) {
    throw new Error("A conforming OpenDocument package must store an uncompressed mimetype entry first.");
  }
  let entryCount = 0;
  let expandedXmlBytes = 0;
  const seenPaths = new Set<string>();
  const paths: string[] = [];
  const requiredEntries = new Set(["mimetype", "content.xml", "META-INF/manifest.xml"]);
  try {
    const files = unzipSync(bytes, {
      filter(file) {
        entryCount += 1;
        if (entryCount > MAX_PACKAGE_ENTRIES) throw new Error("The OpenDocument package contains too many entries.");
        const path = file.name.replaceAll("\\", "/");
        if (path.split("/").includes("..") || path.includes("\0") || /^(?:\/|[a-z]:\/)/iu.test(path)) {
          throw new Error("The OpenDocument package contains an unsafe part path.");
        }
        if (seenPaths.has(path)) throw new Error(`The OpenDocument package repeats part ${path}.`);
        seenPaths.add(path);
        paths.push(path);
        if (requiredEntries.has(path) && file.originalSize > MAX_XML_PART_BYTES) {
          throw new Error(`${path} exceeds Rune's 6 MB required-part limit.`);
        }
        const relevant = path === "mimetype"
          || path === "content.xml"
          || path === "styles.xml"
          || path === "meta.xml"
          || path === "META-INF/manifest.xml";
        if (!relevant) return false;
        if (path.endsWith(".xml")) {
          if (file.originalSize > MAX_XML_PART_BYTES) throw new Error(`${path} exceeds Rune's 6 MB XML-part limit.`);
          expandedXmlBytes += file.originalSize;
          if (expandedXmlBytes > MAX_XML_TOTAL_BYTES) throw new Error("The OpenDocument package expands beyond Rune's 24 MB XML limit.");
        }
        return true;
      },
    });
    const actualXmlBytes = Object.entries(files).reduce((total, [path, data]) => {
      if (!path.endsWith(".xml")) return total;
      if (data.length > MAX_XML_PART_BYTES) throw new Error(`${path} exceeds Rune's 6 MB XML-part limit.`);
      return total + data.length;
    }, 0);
    if (actualXmlBytes > MAX_XML_TOTAL_BYTES) throw new Error("The OpenDocument package expands beyond Rune's 24 MB XML limit.");
    requiredEntries.forEach((path) => {
      if (!seenPaths.has(path)) throw new Error(`Required OpenDocument part is missing: ${path}`);
    });
    const expectedMimeType = ODF_MIME_TYPES[kind];
    const actualMimeType = files.mimetype && files.mimetype.length <= 128 ? strFromU8(files.mimetype) : "";
    if (actualMimeType !== expectedMimeType) {
      throw new Error(`The package mimetype does not match .${kind}: expected ${expectedMimeType}.`);
    }
    return { files, paths, warnings: [] };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The ZIP package could not be opened.";
    throw new Error(detail.startsWith("The OpenDocument") || detail.startsWith("A conforming") || detail.startsWith("The package")
      ? detail
      : `OpenDocument import failed: ${detail}`);
  }
}

function parseXml(source: string, path: string) {
  if (/<!DOCTYPE|<!ENTITY/iu.test(source)) throw new Error(`${path} contains a blocked XML declaration.`);
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
    if (required) throw new Error(`Required OpenDocument part is missing: ${path}`);
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

function oneLine(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function escapeMarkdown(value: string) {
  return value
    .replace(/\\/gu, "\\\\")
    .replace(/([`*_[\]#>+!|~<>])/gu, "\\$1")
    .replaceAll("{", "&#123;")
    .replaceAll("}", "&#125;");
}

function baseName(name: string) {
  return name.replace(/\.(?:odt|ods|odp)$/iu, "").trim() || "imported-opendocument";
}

function safeFileSegment(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 72) || "artifact";
}

function stableImportId(fileName: string, suffix = "") {
  const slug = safeFileSegment(`${baseName(fileName)}${suffix ? `-${suffix}` : ""}`).toLocaleLowerCase("en-US");
  return `import-${slug}`;
}

function boundedSource(source: string, label: string) {
  const normalized = `${source.trim()}\n`;
  if (!normalized.trim()) throw new Error(`${label} did not contain importable content.`);
  if (normalized.length > MAX_OUTPUT_CHARS) throw new Error(`${label} converts to more than 200,000 source characters.`);
  return normalized;
}

function repeatCount(element: XmlElement, name: string, maximum: number, label: string) {
  const raw = attribute(element, name);
  if (!raw) return 1;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`${label} has an unsafe repeated-item count.`);
  return value;
}

function validateManifest(kind: OdfKind, context: PackageContext) {
  const manifest = xmlPart(context, "META-INF/manifest.xml");
  if (descendantElements(manifest, "encryption-data").length || descendantElements(manifest, "encrypted-key").length) {
    throw new Error("Encrypted OpenDocument packages are not supported. Import an unlocked copy.");
  }
  const root = descendantElements(manifest, "file-entry").find((entry) => attribute(entry, "full-path") === "/");
  if (!root || attribute(root, "media-type") !== ODF_MIME_TYPES[kind]) {
    throw new Error("The OpenDocument manifest does not declare the expected document type.");
  }
  const contentEntry = descendantElements(manifest, "file-entry").find((entry) => attribute(entry, "full-path") === "content.xml");
  if (!contentEntry || attribute(contentEntry, "media-type") !== "text/xml") {
    throw new Error("The OpenDocument manifest must declare content.xml as text/xml.");
  }
}

function packageWarnings(context: PackageContext, content: XmlDocument) {
  const scriptPaths = context.paths.filter((path) => /^(?:Basic|Scripts)\//iu.test(path));
  const scriptElements = descendantElements(content, "scripts").length + descendantElements(content, "script").length;
  if (scriptPaths.length || scriptElements) context.warnings.push("OpenDocument macros or scripts were ignored and never executed.");
  const signaturePaths = context.paths.filter((path) => /^META-INF\/.*signatures.*\.xml$/iu.test(path));
  if (signaturePaths.length) context.warnings.push("Digital signatures were not preserved after semantic import.");
}

function styleMap(context: PackageContext, content: XmlDocument) {
  const documents = [content, xmlPart(context, "styles.xml", false)].filter((value): value is XmlDocument => Boolean(value));
  const raw = new Map<string, TextStyle & { parent: string }>();
  documents.forEach((document) => descendantElements(document, "style").forEach((style) => {
    const name = attribute(style, "name");
    if (!name) return;
    const properties = firstDescendant(style, "text-properties");
    raw.set(name, {
      parent: attribute(style, "parent-style-name"),
      bold: /^(?:bold|[6-9]00)$/iu.test(attribute(properties, "font-weight")),
      italic: attribute(properties, "font-style") === "italic",
      strike: Boolean(attribute(properties, "text-line-through-style") && attribute(properties, "text-line-through-style") !== "none"),
    });
  }));
  const resolved = new Map<string, TextStyle>();
  function resolve(name: string, seen = new Set<string>()): TextStyle {
    if (resolved.has(name)) return resolved.get(name) as TextStyle;
    const own = raw.get(name);
    if (!own || seen.has(name)) return { bold: false, italic: false, strike: false };
    seen.add(name);
    const parent = own.parent ? resolve(own.parent, seen) : { bold: false, italic: false, strike: false };
    const value = { bold: own.bold || parent.bold, italic: own.italic || parent.italic, strike: own.strike || parent.strike };
    resolved.set(name, value);
    return value;
  }
  raw.forEach((_value, name) => resolve(name));
  return resolved;
}

function safeLinkTarget(target: string) {
  if (/[\u0000-\u001f\u007f<>"']/u.test(target)) return "";
  try {
    const url = new URL(target);
    if (url.protocol === "http:" || url.protocol === "https:") return url.hostname ? target.replaceAll(">", "%3E") : "";
    return url.protocol === "mailto:" && url.pathname ? target.replaceAll(">", "%3E") : "";
  } catch {
    return "";
  }
}

function plainText(node: XmlNode): string {
  if (node.nodeType === 3 || node.nodeType === 4) return node.nodeValue ?? "";
  if (node.nodeType !== 1) return "";
  const element = node as XmlElement;
  const name = localName(element);
  if (["annotation", "note", "tracked-changes", "change-start", "change-end"].includes(name)) return "";
  if (name === "tab") return "\t";
  if (name === "line-break") return "\n";
  if (name === "s") return " ".repeat(repeatCount(element, "c", 1_000, "OpenDocument whitespace"));
  let value = "";
  for (let index = 0; index < element.childNodes.length; index += 1) {
    const child = element.childNodes.item(index);
    if (child) value += plainText(child);
  }
  return value;
}

function inlineText(node: XmlNode, styles: Map<string, TextStyle>, warnings: string[]): string {
  if (node.nodeType === 3 || node.nodeType === 4) return escapeMarkdown(node.nodeValue ?? "");
  if (node.nodeType !== 1) return "";
  const element = node as XmlElement;
  const name = localName(element);
  if (["annotation", "note", "tracked-changes", "change-start", "change-end"].includes(name)) return "";
  if (name === "tab") return "\t";
  if (name === "line-break") return "\n";
  if (name === "s") return " ".repeat(repeatCount(element, "c", 1_000, "OpenDocument whitespace"));
  let value = "";
  for (let index = 0; index < element.childNodes.length; index += 1) {
    const child = element.childNodes.item(index);
    if (child) value += inlineText(child, styles, warnings);
  }
  if (name === "a") {
    const target = safeLinkTarget(attribute(element, "href"));
    if (target && value.trim()) return `[${value}](<${target}>)`;
    if (attribute(element, "href")) warnings.push("A non-HTTP OpenDocument link was imported as plain text.");
    return value;
  }
  if (name === "span") {
    const style = styles.get(attribute(element, "style-name"));
    if (!style || !value.trim()) return value;
    const match = value.match(/^(\s*)([\s\S]*?)(\s*)$/u);
    if (!match?.[2]) return value;
    let core = match[2];
    if (style.bold) core = `**${core}**`;
    if (style.italic) core = `_${core}_`;
    if (style.strike) core = `~~${core}~~`;
    return `${match[1]}${core}${match[3]}`;
  }
  return value;
}

function listStyles(context: PackageContext, content: XmlDocument) {
  const result = new Map<string, Map<number, boolean>>();
  const documents = [content, xmlPart(context, "styles.xml", false)].filter((value): value is XmlDocument => Boolean(value));
  documents.forEach((document) => descendantElements(document, "list-style").forEach((style) => {
    const name = attribute(style, "name");
    if (!name) return;
    const levels = new Map<number, boolean>();
    childElements(style).forEach((level) => {
      const levelNumber = Math.max(1, Number(attribute(level, "level")) || 1);
      levels.set(levelNumber, localName(level) === "list-level-style-number");
    });
    result.set(name, levels);
  }));
  return result;
}

function listLines(
  list: XmlElement,
  styles: Map<string, TextStyle>,
  definitions: Map<string, Map<number, boolean>>,
  warnings: string[],
  level = 0,
  inheritedStyle = "",
): string[] {
  const styleName = attribute(list, "style-name") || inheritedStyle;
  const ordered = definitions.get(styleName)?.get(level + 1) ?? false;
  const lines: string[] = [];
  childElements(list).forEach((item) => {
    if (localName(item) !== "list-item" && localName(item) !== "list-header") return;
    const paragraphs = childElements(item).filter((child) => ["p", "h"].includes(localName(child)));
    paragraphs.forEach((paragraph, index) => {
      const text = oneLine(inlineText(paragraph, styles, warnings));
      if (text) lines.push(`${"  ".repeat(level)}${index === 0 ? ordered ? "1." : "-" : "  "} ${text}`);
    });
    childElements(item, "list").forEach((nested) => lines.push(...listLines(nested, styles, definitions, warnings, level + 1, styleName)));
  });
  return lines;
}

function tableRowsForMarkdown(table: XmlElement, styles: Map<string, TextStyle>, warnings: string[]) {
  const rows: string[][] = [];
  let cellCount = 0;
  function addRows(container: XmlElement) {
    childElements(container).forEach((row) => {
      const name = localName(row);
      if (["table-header-rows", "table-rows", "table-row-group"].includes(name)) {
        addRows(row);
        return;
      }
      if (name !== "table-row") return;
      const repeat = repeatCount(row, "number-rows-repeated", MAX_ROWS, "OpenDocument table row");
      const values: string[] = [];
      childElements(row).forEach((cell) => {
        const cellName = localName(cell);
        if (cellName !== "table-cell" && cellName !== "covered-table-cell") return;
        const columnRepeat = repeatCount(cell, "number-columns-repeated", MAX_COLUMNS, "OpenDocument table cell");
        if (attribute(cell, "number-columns-spanned") || attribute(cell, "number-rows-spanned")) {
          warnings.push("Merged OpenDocument table cells were flattened during semantic import.");
        }
        const value = cellName === "covered-table-cell"
          ? ""
          : oneLine(childElements(cell).filter((child) => ["p", "h"].includes(localName(child))).map((paragraph) => inlineText(paragraph, styles, warnings)).join(" / "));
        for (let index = 0; index < columnRepeat; index += 1) values.push(value);
      });
      if (values.length > MAX_COLUMNS) throw new Error("An OpenDocument table exceeds the 256-column semantic import limit.");
      for (let index = 0; index < repeat; index += 1) {
        if (rows.length >= MAX_ROWS) throw new Error("An OpenDocument table exceeds the 10,000-row semantic import limit.");
        cellCount += values.length;
        if (cellCount > MAX_CELLS) throw new Error("An OpenDocument table contains more than 50,000 imported cells.");
        rows.push([...values]);
      }
    });
  }
  addRows(table);
  return rows;
}

function markdownTable(rows: string[][]) {
  const width = Math.max(0, ...rows.map((row) => row.length));
  if (!width) return "";
  const normalized = rows.map((row) => Array.from({ length: width }, (_, index) => oneLine(row[index] ?? "").replaceAll("|", "\\|")));
  return [
    `| ${normalized[0].join(" | ")} |`,
    `| ${normalized[0].map(() => "---").join(" | ")} |`,
    ...normalized.slice(1).map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function documentTitle(context: PackageContext, fileName: string) {
  const meta = xmlPart(context, "meta.xml", false);
  const title = meta ? oneLine(firstDescendant(meta, "title")?.textContent ?? "") : "";
  return (title || baseName(fileName)).slice(0, 120);
}

function convertOdt(fileName: string, context: PackageContext, content: XmlDocument): OdfImportResult {
  const body = firstDescendant(content, "text");
  if (!body) throw new Error("The ODT content does not contain an office:text body.");
  const styles = styleMap(context, content);
  const definitions = listStyles(context, content);
  const blocks: string[] = [];
  function visit(container: XmlElement) {
    childElements(container).forEach((block) => {
      if (blocks.length >= MAX_TEXT_BLOCKS) throw new Error("The ODT contains more than 10,000 semantic blocks.");
      const name = localName(block);
      if (name === "h") {
        const level = Math.max(1, Math.min(6, Number(attribute(block, "outline-level")) || 1));
        const text = oneLine(inlineText(block, styles, context.warnings));
        if (text) blocks.push(`${"#".repeat(level)} ${text}`);
      } else if (name === "p") {
        const text = oneLine(inlineText(block, styles, context.warnings));
        if (text) blocks.push(text);
      } else if (name === "list") {
        const lines = listLines(block, styles, definitions, context.warnings);
        if (lines.length) blocks.push(lines.join("\n"));
      } else if (name === "table") {
        const table = markdownTable(tableRowsForMarkdown(block, styles, context.warnings));
        if (table) blocks.push(table);
      } else if (["section", "index-body"].includes(name)) {
        visit(block);
      }
    });
  }
  visit(body);
  const images = context.paths.filter((path) => /^Pictures\//u.test(path)).length + descendantElements(content, "image").length;
  const annotations = descendantElements(content, "annotation").length;
  const trackedChanges = descendantElements(content, "tracked-changes").length + descendantElements(content, "change-start").length;
  if (images) context.warnings.push("ODT images were omitted from canonical Markdown.");
  if (annotations) context.warnings.push(`${annotations} ODT ${annotations === 1 ? "annotation was" : "annotations were"} omitted.`);
  if (trackedChanges) context.warnings.push("ODT tracked-change markup and history were not preserved; review the imported text state.");
  context.warnings.push("ODT page layout, headers, footers, fields, and advanced styles were not preserved in canonical Markdown.");
  const source = boundedSource(blocks.join("\n\n"), "ODT");
  return {
    sourceType: "odt",
    warnings: [...new Set(context.warnings)],
    artifacts: [{
      id: stableImportId(fileName),
      name: `${safeFileSegment(baseName(fileName))}.md`,
      kind: "document",
      language: "Markdown",
      source,
    }],
  };
}

function odsCellValue(cell: XmlElement, styles: Map<string, TextStyle>, warnings: string[], formulaBudget: { count: number }): DataCell {
  if (attribute(cell, "formula")) formulaBudget.count += 1;
  const valueType = attribute(cell, "value-type");
  if (valueType === "float" || valueType === "currency" || valueType === "percentage") {
    const value = Number(attribute(cell, "value"));
    return Number.isFinite(value) ? value : oneLine(cell.textContent ?? "");
  }
  if (valueType === "boolean") return attribute(cell, "boolean-value") === "true";
  if (valueType === "date") return attribute(cell, "date-value") || oneLine(cell.textContent ?? "");
  if (valueType === "time") return attribute(cell, "time-value") || oneLine(cell.textContent ?? "");
  const explicit = attribute(cell, "string-value");
  if (explicit) return explicit;
  return oneLine(childElements(cell).filter((child) => ["p", "h"].includes(localName(child))).map(plainText).join(" / "));
}

function odsRows(
  table: XmlElement,
  styles: Map<string, TextStyle>,
  warnings: string[],
  cellBudget: { count: number },
  formulaBudget: { count: number },
) {
  const sparseRows = new Map<number, DataCell[]>();
  let rowCursor = 0;
  function addRows(container: XmlElement) {
    childElements(container).forEach((row) => {
      const name = localName(row);
      if (["table-header-rows", "table-rows", "table-row-group"].includes(name)) {
        addRows(row);
        return;
      }
      if (name !== "table-row") return;
      const rowRepeat = repeatCount(row, "number-rows-repeated", 1_048_576, "ODS row");
      const valuesByColumn = new Map<number, DataCell>();
      let columnCursor = 0;
      childElements(row).forEach((cell) => {
        const cellName = localName(cell);
        if (cellName !== "table-cell" && cellName !== "covered-table-cell") return;
        const columnRepeat = repeatCount(cell, "number-columns-repeated", 16_384, "ODS cell");
        const value = cellName === "covered-table-cell" ? null : odsCellValue(cell, styles, warnings, formulaBudget);
        if (value != null && value !== "") {
          if (columnCursor >= MAX_COLUMNS || columnCursor + columnRepeat > MAX_COLUMNS) {
            throw new Error("An ODS worksheet exceeds the 256-column semantic import limit.");
          }
          for (let index = 0; index < columnRepeat; index += 1) valuesByColumn.set(columnCursor + index, value);
        }
        columnCursor += columnRepeat;
      });
      const width = valuesByColumn.size ? Math.max(...valuesByColumn.keys()) + 1 : 0;
      const values = Array.from({ length: width }, (_, column) => valuesByColumn.get(column) ?? null);
      if (values.length) for (let index = 0; index < rowRepeat; index += 1) {
        const rowIndex = rowCursor + index;
        if (rowIndex >= MAX_ROWS) throw new Error("An ODS worksheet exceeds the 10,000-row semantic import limit.");
        cellBudget.count += width;
        if (cellBudget.count > MAX_CELLS) throw new Error("The ODS contains more than 50,000 imported cells.");
        sparseRows.set(rowIndex, [...values]);
      }
      rowCursor += rowRepeat;
    });
  }
  addRows(table);
  if (!sparseRows.size) return [];
  const lastRow = Math.max(...sparseRows.keys());
  return Array.from({ length: lastRow + 1 }, (_, index) => sparseRows.get(index) ?? []);
}

function csvCell(value: DataCell, injectionBudget: { count: number }) {
  if (value == null) return "";
  let text = String(value);
  if (typeof value === "string" && /^[\t\r\n ]*[=+@-]/u.test(text)) {
    text = `'${text}`;
    injectionBudget.count += 1;
  }
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: DataCell[][], injectionBudget: { count: number }) {
  const width = Math.max(0, ...rows.map((row) => row.length));
  return rows.map((row) => Array.from({ length: width }, (_, index) => csvCell(row[index] ?? null, injectionBudget)).join(",")).join("\n");
}

function convertOds(fileName: string, context: PackageContext, content: XmlDocument): OdfImportResult {
  const spreadsheet = firstDescendant(content, "spreadsheet");
  if (!spreadsheet) throw new Error("The ODS content does not contain an office:spreadsheet body.");
  const styles = styleMap(context, content);
  const tables = childElements(spreadsheet, "table");
  const visible = tables.filter((table) => !/^(?:false|0)$/iu.test(attribute(table, "display")));
  if (visible.length < tables.length) context.warnings.push(`${tables.length - visible.length} hidden ODS ${tables.length - visible.length === 1 ? "sheet was" : "sheets were"} not imported.`);
  if (visible.length > MAX_SHEETS) context.warnings.push(`Only the first ${MAX_SHEETS} visible ODS sheets were imported.`);
  const selected = visible.slice(0, MAX_SHEETS);
  const cellBudget = { count: 0 };
  const formulaBudget = { count: 0 };
  const injectionBudget = { count: 0 };
  const usedNames = new Set<string>();
  const usedIds = new Set<string>();
  const artifacts: WorkspaceArtifact[] = [];
  selected.forEach((table, index) => {
    const rows = odsRows(table, styles, context.warnings, cellBudget, formulaBudget);
    const sheetLabel = attribute(table, "name") || `Sheet ${index + 1}`;
    if (!rows.length) {
      context.warnings.push(`${sheetLabel} was empty and was not imported.`);
      return;
    }
    const sheetName = safeFileSegment(sheetLabel);
    const base = safeFileSegment(baseName(fileName));
    let outputName = selected.length === 1 ? `${base}.csv` : `${base}--${sheetName}.csv`;
    let suffix = 2;
    while (usedNames.has(outputName)) {
      outputName = `${base}--${sheetName}-${suffix}.csv`;
      suffix += 1;
    }
    usedNames.add(outputName);
    const idBase = stableImportId(fileName, sheetName);
    let outputId = idBase;
    let idSuffix = 2;
    while (usedIds.has(outputId)) {
      outputId = `${idBase}-${idSuffix}`;
      idSuffix += 1;
    }
    usedIds.add(outputId);
    artifacts.push({
      id: outputId,
      name: outputName,
      kind: "data",
      language: "CSV",
      source: boundedSource(toCsv(rows, injectionBudget), `ODS sheet ${sheetName}`),
    });
  });
  if (!artifacts.length) throw new Error("The ODS did not contain a non-empty visible sheet.");
  if (artifacts.reduce((total, artifact) => total + artifact.source.length, 0) > MAX_TOTAL_OUTPUT_CHARS) {
    throw new Error("The ODS converts to more than 500,000 total source characters.");
  }
  if (formulaBudget.count) context.warnings.push(`${formulaBudget.count} ODS formula ${formulaBudget.count === 1 ? "cell was" : "cells were"} imported using the cached displayed value.`);
  if (injectionBudget.count) context.warnings.push(`${injectionBudget.count} formula-leading text ${injectionBudget.count === 1 ? "cell was" : "cells were"} prefixed with an apostrophe for CSV safety.`);
  context.warnings.push("ODS cell formatting, filters, validations, charts, and print layout were not preserved in canonical CSV.");
  return { sourceType: "ods", artifacts, warnings: [...new Set(context.warnings)] };
}

function escapeDeckText(value: string) {
  const escaped = escapeMarkdown(oneLine(value));
  return escaped === "---" ? "\\---" : escaped;
}

function odpFrameParagraphs(frame: XmlElement, styles: Map<string, TextStyle>, warnings: string[]) {
  void styles;
  void warnings;
  return descendantElements(frame, "p")
    .filter((paragraph) => {
      let ancestor = paragraph.parentNode;
      while (ancestor && ancestor !== frame) {
        if (ancestor.nodeType === 1 && localName(ancestor) === "table") return false;
        ancestor = ancestor.parentNode;
      }
      return true;
    })
    .map((paragraph) => {
      let ancestor = paragraph.parentNode;
      let listLevel = 0;
      while (ancestor && ancestor !== frame) {
        if (ancestor.nodeType === 1 && localName(ancestor) === "list") listLevel += 1;
        ancestor = ancestor.parentNode;
      }
      return { text: oneLine(plainText(paragraph)), listLevel };
    })
    .filter((paragraph) => Boolean(paragraph.text));
}

function hasAncestor(element: XmlElement, name: string, boundary: XmlElement) {
  let ancestor = element.parentNode;
  while (ancestor && ancestor !== boundary) {
    if (ancestor.nodeType === 1 && localName(ancestor) === name) return true;
    ancestor = ancestor.parentNode;
  }
  return false;
}

function convertOdp(fileName: string, context: PackageContext, content: XmlDocument): OdfImportResult {
  const presentation = firstDescendant(content, "presentation");
  if (!presentation) throw new Error("The ODP content does not contain an office:presentation body.");
  const styles = styleMap(context, content);
  const pages = childElements(presentation, "page");
  if (pages.length > MAX_SLIDES) context.warnings.push(`Only the first ${MAX_SLIDES} ODP slides were imported.`);
  const selected = pages.slice(0, MAX_SLIDES);
  const slides: string[] = [];
  let images = 0;
  let objects = 0;
  let notes = 0;
  selected.forEach((page, index) => {
    images += descendantElements(page, "image").length;
    objects += descendantElements(page, "object").length + descendantElements(page, "object-ole").length;
    notes += descendantElements(page, "notes").length;
    const frames = descendantElements(page, "frame").filter((frame) => !hasAncestor(frame, "notes", page));
    const titleFrame = frames.find((frame) => /^(?:title|subtitle)$/iu.test(attribute(frame, "class")));
    const fallbackFrame = frames.find((frame) => odpFrameParagraphs(frame, styles, context.warnings).length);
    const titleParagraphs = titleFrame ? odpFrameParagraphs(titleFrame, styles, context.warnings) : fallbackFrame ? odpFrameParagraphs(fallbackFrame, styles, context.warnings) : [];
    const title = titleParagraphs[0]?.text || attribute(page, "name") || `Slide ${index + 1}`;
    const body: string[] = [];
    frames.forEach((frame) => {
      if (frame === titleFrame) return;
      const paragraphs = odpFrameParagraphs(frame, styles, context.warnings);
      if (frame === fallbackFrame && !titleFrame) paragraphs.shift();
      paragraphs.forEach((paragraph) => body.push(paragraph.listLevel
        ? `${"  ".repeat(Math.max(0, paragraph.listLevel - 1))}- ${escapeDeckText(paragraph.text)}`
        : escapeDeckText(paragraph.text)));
      descendantElements(frame, "table").forEach((table) => {
        const markdown = markdownTable(tableRowsForMarkdown(table, styles, context.warnings));
        if (markdown) body.push(markdown);
      });
    });
    childElements(page, "table").forEach((table) => {
      const markdown = markdownTable(tableRowsForMarkdown(table, styles, context.warnings));
      if (markdown) body.push(markdown);
    });
    const layout = index === 0 && body.length <= 1 ? "cover" : "content";
    slides.push([`<!-- layout: ${layout} -->`, "", `# ${escapeDeckText(title)}`, ...(body.length ? ["", ...body] : [])].join("\n"));
  });
  if (!slides.length) throw new Error("The ODP did not contain any slides.");
  if (images) context.warnings.push(`${images} ODP ${images === 1 ? "image was" : "images were"} omitted.`);
  if (objects) context.warnings.push(`${objects} embedded ODP ${objects === 1 ? "object was" : "objects were"} omitted; import its source data to rebuild a live Rune artifact.`);
  if (notes) context.warnings.push("ODP speaker notes were not imported into Deck Markdown.");
  context.warnings.push("ODP positioning, theme, master styling, transitions, animation, and inline text styling were not preserved in Deck Markdown.");
  const title = documentTitle(context, fileName);
  const safeTitle = oneLine(title).replaceAll("{", "&#123;").replaceAll("}", "&#125;");
  const language = /[\u3400-\u9fff]/u.test(`${title} ${slides.join(" ")}`) ? "zh-CN" : "en";
  const source = boundedSource([
    "---",
    "version: 1",
    `title: ${safeTitle}`,
    "theme: rune",
    "ratio: 16:9",
    `lang: ${language}`,
    "---",
    "",
    slides.join("\n\n---\n\n"),
  ].join("\n"), "ODP");
  return {
    sourceType: "odp",
    warnings: [...new Set(context.warnings)],
    artifacts: [{
      id: stableImportId(fileName),
      name: `${safeFileSegment(baseName(fileName))}.deck.md`,
      kind: "slides",
      language: "Deck Markdown",
      source,
    }],
  };
}

export function convertOdfFile(fileName: string, input: ArrayBuffer | Uint8Array): OdfImportResult {
  const kind = odfKind(fileName);
  const context = openPackage(kind, input);
  validateManifest(kind, context);
  const content = xmlPart(context, "content.xml");
  packageWarnings(context, content);
  if (kind === "odt") return convertOdt(fileName, context, content);
  if (kind === "ods") return convertOds(fileName, context, content);
  return convertOdp(fileName, context, content);
}
