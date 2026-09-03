import { strToU8, zipSync, type Zippable } from "fflate";

import { resolveChartModel, type ChartModel } from "./charts.ts";
import { isDeckMarkdownArtifact, parseDeckSource, type DeckSlide } from "./deck.ts";
import { safeExportBaseName, type ArtifactExportResult } from "./export-contract.ts";
import {
  extractOrbitAssetIds,
  parseOrbitMarkdownImage,
  orbitImageAssetMap,
  orbitImageDimensions,
  orbitImageExtension,
  type OrbitExportImageAsset,
} from "./local-assets.ts";
import { parseMarkdownBlocks, type MarkdownBlock } from "./office-export.ts";
import type { WorkspaceQuerySnapshot } from "./query-snapshot.ts";
import { convertSemanticHtmlPresentationToDeck } from "./semantic-html-presentation-export.ts";
import { parseDataSource, type DataCell, type WorkspaceArtifact } from "./workspace.ts";

export const MAX_ODF_EXPORT_SOURCE_CHARS = 2_000_000;
export const MAX_ODF_EXPORT_BYTES = 12 * 1024 * 1024;

const MAX_ODT_SOURCE_CHARS = 200_000;
const MAX_ODT_BLOCKS = 10_000;
const ODF_VERSION = "1.3";

const ODF_MIME_TYPES = {
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
} as const;

type OdfExportKind = keyof typeof ODF_MIME_TYPES;
export type OdfExportResult = ArtifactExportResult<OdfExportKind>;

type InlineSegment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: string;
};

type OdpParagraph = { text: string; bullet: boolean; level: number; strong?: boolean };
type OdpSlideImage = { reference: { id: string; alt: string }; asset: OrbitExportImageAsset };
type OdpSlideModel = {
  title: string;
  eyebrow: string;
  paragraphs: OdpParagraph[];
  tables: string[][][];
  charts: ChartModel[];
  image: OdpSlideImage | null;
  layout: DeckSlide["layout"];
};

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
const OFFICE_NS = "urn:oasis:names:tc:opendocument:xmlns:office:1.0";
const STYLE_NS = "urn:oasis:names:tc:opendocument:xmlns:style:1.0";
const TEXT_NS = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";
const TABLE_NS = "urn:oasis:names:tc:opendocument:xmlns:table:1.0";
const DRAW_NS = "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0";
const PRESENTATION_NS = "urn:oasis:names:tc:opendocument:xmlns:presentation:1.0";
const MANIFEST_NS = "urn:oasis:names:tc:opendocument:xmlns:manifest:1.0";
const SVG_NS = "urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0";
const META_NS = "urn:oasis:names:tc:opendocument:xmlns:meta:1.0";
const DC_NS = "http://purl.org/dc/elements/1.1/";
const FO_NS = "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0";
const XLINK_NS = "http://www.w3.org/1999/xlink";
const NUMBER_NS = "urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0";
const MARKDOWN_TOKEN =
  /(!?\[[^\]\n]*\]\([^)\n]+\)|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_)/gu;
const CHART_TOKEN = /\{\{\s*chart\(["']([a-z0-9_.-]+)["']\)\s*\}\}/giu;
const EXACT_CHART_TOKEN = /^\s*\{\{\s*chart\(["']([a-z0-9_.-]+)["']\)\s*\}\}\s*$/iu;

function namespaces() {
  return `xmlns:office="${OFFICE_NS}" xmlns:style="${STYLE_NS}" xmlns:text="${TEXT_NS}" xmlns:table="${TABLE_NS}" xmlns:draw="${DRAW_NS}" xmlns:presentation="${PRESENTATION_NS}" xmlns:svg="${SVG_NS}" xmlns:meta="${META_NS}" xmlns:dc="${DC_NS}" xmlns:fo="${FO_NS}" xmlns:xlink="${XLINK_NS}" xmlns:number="${NUMBER_NS}"`;
}

function cleanXmlCharacters(value: string) {
  let result = "";
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    const valid =
      code === 0x9 ||
      code === 0xa ||
      code === 0xd ||
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd) ||
      (code >= 0x10000 && code <= 0x10ffff);
    result += valid ? character : "�";
  }
  return result;
}

function xmlText(value: string) {
  return cleanXmlCharacters(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function xmlAttribute(value: string) {
  return xmlText(value).replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function manifest(kind: OdfExportKind, images: Iterable<{ path: string; asset: OrbitExportImageAsset }> = []) {
  const mime = ODF_MIME_TYPES[kind];
  const imageEntries = [...images]
    .map(
      ({ path, asset }) =>
        `<manifest:file-entry manifest:full-path="${xmlAttribute(path)}" manifest:media-type="${asset.mimeType}"/>`,
    )
    .join("");
  return `${XML_DECLARATION}<manifest:manifest xmlns:manifest="${MANIFEST_NS}" manifest:version="${ODF_VERSION}"><manifest:file-entry manifest:full-path="/" manifest:version="${ODF_VERSION}" manifest:media-type="${mime}"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>${imageEntries}</manifest:manifest>`;
}

function metaXml(title: string) {
  return `${XML_DECLARATION}<office:document-meta ${namespaces()} office:version="${ODF_VERSION}"><office:meta><meta:generator>Orbit</meta:generator><dc:title>${xmlText(title)}</dc:title><dc:creator>Orbit</dc:creator></office:meta></office:document-meta>`;
}

function packageOdf(
  kind: OdfExportKind,
  title: string,
  content: string,
  styles: string,
  images = new Map<string, OrbitExportImageAsset>(),
) {
  const timestamp = new Date(Date.UTC(1980, 0, 1));
  const packagedImages = [...images.values()].map((asset) => ({
    path: `Pictures/orbit-${asset.id}.${orbitImageExtension(asset.mimeType)}`,
    asset,
  }));
  const files: Zippable = {
    mimetype: [strToU8(ODF_MIME_TYPES[kind]), { level: 0, mtime: timestamp }],
    "content.xml": [strToU8(content), { level: 6, mtime: timestamp }],
    "styles.xml": [strToU8(styles), { level: 6, mtime: timestamp }],
    "meta.xml": [strToU8(metaXml(title)), { level: 6, mtime: timestamp }],
    "META-INF/manifest.xml": [strToU8(manifest(kind, packagedImages)), { level: 6, mtime: timestamp }],
  };
  packagedImages.forEach(({ path, asset }) => {
    files[path] = [asset.bytes, { level: 6, mtime: timestamp }];
  });
  const bytes = zipSync(files, { level: 6, mtime: timestamp });
  if (bytes.length > MAX_ODF_EXPORT_BYTES)
    throw new Error("The generated OpenDocument package exceeds Orbit's 12 MB export limit.");
  return bytes;
}

function unescapeMarkdown(value: string) {
  return value.replace(/\\([\\`*_[\]{}#>+!|~<>-])/gu, "$1");
}

function isSafeLink(target: string) {
  if (/[\u0000-\u001f\u007f<>"']/u.test(target)) return false;
  try {
    const url = new URL(target);
    if (url.protocol === "http:" || url.protocol === "https:") return Boolean(url.hostname);
    return url.protocol === "mailto:" && Boolean(url.pathname);
  } catch {
    return false;
  }
}

function sanitizeInlineSource(source: string, warnings: Set<string>) {
  let result = source.replace(CHART_TOKEN, (_token, id: string) => {
    warnings.add(
      "Inline Orbit chart references use an omission marker in OpenDocument export; put a chart on its own line to export a current-data snapshot.",
    );
    return `[Chart omitted: ${id}]`;
  });
  result = result.replace(/(^|[^\\])<[^>]+>/gu, (_token, prefix: string) => {
    warnings.add("Raw HTML tags were removed from semantic OpenDocument export.");
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
    const image = token.match(/^!\[([^\]]*)\]\([^)]+\)$/u);
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/u);
    if (image) {
      warnings.add("Markdown images are not embedded in semantic OpenDocument export.");
      segments.push({ text: `[Image omitted${image[1] ? `: ${image[1]}` : ""}]` });
    } else if (link) {
      const target = link[2]
        .trim()
        .replace(/^<|>$/gu, "")
        .split(/\s+["']/u)[0];
      if (isSafeLink(target)) segments.push({ text: unescapeMarkdown(link[1]), link: target });
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

function odfInline(source: string, warnings: Set<string>) {
  return inlineSegments(source, warnings)
    .map((segment) => {
      let text = xmlText(segment.text).replaceAll("\n", "<text:line-break/>").replaceAll("\t", "<text:tab/>");
      const styles = [
        segment.bold ? "OrbitBold" : "",
        segment.italic ? "OrbitItalic" : "",
        segment.strike ? "OrbitStrike" : "",
        segment.code ? "OrbitCode" : "",
      ].filter(Boolean);
      if (styles.length > 1) {
        styles.forEach((style) => {
          text = `<text:span text:style-name="${style}">${text}</text:span>`;
        });
      } else if (styles[0]) {
        text = `<text:span text:style-name="${styles[0]}">${text}</text:span>`;
      }
      return segment.link
        ? `<text:a xlink:type="simple" xlink:href="${xmlAttribute(segment.link)}">${text}</text:a>`
        : text;
    })
    .join("");
}

function plainMarkdownInline(source: string, warnings: Set<string>) {
  return inlineSegments(source, warnings)
    .map((segment) => segment.text)
    .join("")
    .replace(/\s+/gu, " ")
    .trim();
}

function semanticTable(rows: string[][], warnings: Set<string>, name: string) {
  const width = Math.max(1, ...rows.map((row) => row.length));
  return `<table:table table:name="${xmlAttribute(name)}" table:style-name="OrbitTable"><table:table-column table:style-name="OrbitColumn" table:number-columns-repeated="${width}"/>${rows.map((row, rowIndex) => `<table:table-row>${Array.from({ length: width }, (_, index) => `<table:table-cell table:style-name="${rowIndex === 0 ? "OrbitHeaderCell" : "OrbitCell"}" office:value-type="string"><text:p>${odfInline(row[index] ?? "", warnings)}</text:p></table:table-cell>`).join("")}</table:table-row>`).join("")}</table:table>`;
}

function resolveOdfChart(
  id: string,
  workspace: WorkspaceArtifact[],
  snapshots: WorkspaceQuerySnapshot[],
  warnings: Set<string>,
) {
  const artifact = workspace.find((candidate) => candidate.id === id && candidate.kind === "chart");
  if (!artifact) {
    warnings.add(`Chart ${id} was omitted because its workspace artifact was unavailable during OpenDocument export.`);
    return null;
  }
  const resolution = resolveChartModel(artifact, workspace, parseDataSource, snapshots);
  if (!resolution.model) {
    warnings.add(
      `Chart ${id} was omitted because its current data snapshot could not compile: ${resolution.errors[0] ?? "unknown chart error"}`,
    );
    return null;
  }
  return resolution.model;
}

function chartRows(model: ChartModel) {
  const sequenceMark = model.spec.mark !== "bar";
  const secondHeader = sequenceMark ? "Trend" : "Relative bar";
  return [
    [model.spec.category, secondHeader, model.spec.value],
    ...model.data.map((datum, index) => {
      const previous = model.data[index - 1];
      const visual = sequenceMark
        ? !previous
          ? "Start"
          : datum.value > previous.value
            ? "Increase"
            : datum.value < previous.value
              ? "Decrease"
              : "No change"
        : datum.value === 0
          ? ""
          : "█".repeat(Math.max(1, Math.round(datum.ratio * 12)));
      return [datum.label, visual, datum.formatted];
    }),
  ];
}

function odfChart(model: ChartModel, warnings: Set<string>, tableName: string) {
  warnings.add(
    `Live Orbit charts are exported as static semantic current-data tables from ${model.sourceArtifactName}; OpenDocument files do not retain the live data binding.`,
  );
  return `<text:h text:outline-level="3">${odfInline(model.spec.title, warnings)}</text:h>${model.spec.description ? `<text:p text:style-name="OrbitQuote">${odfInline(model.spec.description, warnings)}</text:p>` : ""}${semanticTable(chartRows(model), warnings, tableName)}`;
}

function commonStyles() {
  return `<style:default-style style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.08in"/><style:text-properties style:font-name="Arial" fo:font-size="11pt" fo:color="#17211b"/></style:default-style><style:style style:name="OrbitTitle" style:family="paragraph"><style:paragraph-properties fo:margin-top="0.2in" fo:margin-bottom="0.16in"/><style:text-properties fo:font-size="24pt" fo:font-weight="bold" fo:color="#17211b"/></style:style>${Array.from({ length: 6 }, (_, index) => `<style:style style:name="OrbitHeading${index + 1}" style:family="paragraph"><style:paragraph-properties fo:margin-top="0.16in" fo:margin-bottom="0.08in"/><style:text-properties fo:font-size="${Math.max(13, 22 - index * 2)}pt" fo:font-weight="bold" fo:color="#17211b"/></style:style>`).join("")}<style:style style:name="OrbitQuote" style:family="paragraph"><style:paragraph-properties fo:margin-left="0.25in" fo:border-left="0.03in solid #ff5c35" fo:padding-left="0.12in"/><style:text-properties fo:font-style="italic" fo:color="#627068"/></style:style><style:style style:name="OrbitCodeBlock" style:family="paragraph"><style:paragraph-properties fo:background-color="#f1f3ef" fo:padding="0.08in"/><style:text-properties style:font-name="Courier New" fo:font-size="9.5pt"/></style:style><style:style style:name="OrbitBold" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style><style:style style:name="OrbitItalic" style:family="text"><style:text-properties fo:font-style="italic"/></style:style><style:style style:name="OrbitStrike" style:family="text"><style:text-properties style:text-line-through-style="solid"/></style:style><style:style style:name="OrbitCode" style:family="text"><style:text-properties style:font-name="Courier New" fo:background-color="#f1f3ef"/></style:style><style:style style:name="OrbitTable" style:family="table"><style:table-properties style:width="7.2in" table:align="margins" fo:margin-top="0.08in" fo:margin-bottom="0.14in"/></style:style><style:style style:name="OrbitColumn" style:family="table-column"><style:table-column-properties style:column-width="2.3in"/></style:style><style:style style:name="OrbitCell" style:family="table-cell"><style:table-cell-properties fo:border="0.01in solid #d9d7cf" fo:padding="0.05in"/></style:style><style:style style:name="OrbitHeaderCell" style:family="table-cell"><style:table-cell-properties fo:border="0.01in solid #d9d7cf" fo:padding="0.05in" fo:background-color="#2a8c69"/><style:text-properties fo:font-weight="bold" fo:color="#ffffff"/></style:style>`;
}

function listStyles() {
  const bullets = Array.from(
    { length: 7 },
    (_, index) =>
      `<text:list-level-style-bullet text:level="${index + 1}" text:bullet-char="•"><style:list-level-properties text:space-before="${0.25 + index * 0.2}in" text:min-label-width="0.2in"/></text:list-level-style-bullet>`,
  ).join("");
  const numbers = Array.from(
    { length: 7 },
    (_, index) =>
      `<text:list-level-style-number text:level="${index + 1}" style:num-format="1" style:num-suffix="."><style:list-level-properties text:space-before="${0.25 + index * 0.2}in" text:min-label-width="0.28in"/></text:list-level-style-number>`,
  ).join("");
  return `<text:list-style style:name="OrbitBullet">${bullets}</text:list-style><text:list-style style:name="OrbitNumber">${numbers}</text:list-style>`;
}

function textStylesXml() {
  return `${XML_DECLARATION}<office:document-styles ${namespaces()} office:version="${ODF_VERSION}"><office:styles>${commonStyles()}${listStyles()}<style:style style:name="OrbitImage" style:family="graphic"><style:graphic-properties style:horizontal-pos="center" style:horizontal-rel="paragraph" style:vertical-pos="top" style:vertical-rel="paragraph" style:wrap="none"/></style:style><style:style style:name="OrbitImageCaption" style:family="paragraph"><style:paragraph-properties fo:text-align="center" fo:margin-bottom="0.12in"/><style:text-properties fo:font-size="9pt" fo:font-style="italic" fo:color="#627068"/></style:style></office:styles><office:automatic-styles><style:page-layout style:name="OrbitPage"><style:page-layout-properties fo:page-width="8.27in" fo:page-height="11.69in" style:print-orientation="portrait" fo:margin="0.7in"/></style:page-layout></office:automatic-styles><office:master-styles><style:master-page style:name="Orbit" style:page-layout-name="OrbitPage"/></office:master-styles></office:document-styles>`;
}

function blockToOdt(
  block: MarkdownBlock,
  index: number,
  warnings: Set<string>,
  workspace: WorkspaceArtifact[],
  snapshots: WorkspaceQuerySnapshot[],
  images: Map<string, OrbitExportImageAsset>,
) {
  if (block.type === "heading")
    return `<text:h text:style-name="${block.level === 1 ? "OrbitTitle" : `OrbitHeading${Math.min(6, block.level)}`}" text:outline-level="${Math.min(6, block.level)}">${odfInline(block.source, warnings)}</text:h>`;
  if (block.type === "quote")
    return `<text:p text:style-name="OrbitQuote">${odfInline(block.source, warnings)}</text:p>`;
  if (block.type === "list")
    return `<text:list text:style-name="${block.ordered ? "OrbitNumber" : "OrbitBullet"}"><text:list-item><text:p>${odfInline(block.source, warnings)}</text:p></text:list-item></text:list>`;
  if (block.type === "table") return semanticTable(block.rows, warnings, `OrbitTable${index + 1}`);
  if (block.type === "code") {
    warnings.add("Fenced Markdown code was exported as preformatted OpenDocument text.");
    return `<text:p text:style-name="OrbitCodeBlock">${xmlText(block.source).replaceAll("\n", "<text:line-break/>") || " "}</text:p>`;
  }
  const imageReference = block.type === "paragraph" ? parseOrbitMarkdownImage(block.source) : null;
  if (imageReference) {
    const asset = images.get(imageReference.id);
    if (!asset) throw new Error(`Referenced local image is missing or corrupt: ${imageReference.id}`);
    const path = `Pictures/orbit-${asset.id}.${orbitImageExtension(asset.mimeType)}`;
    const alt = imageReference.alt || asset.name || "Orbit image";
    const dimensions = orbitImageDimensions(asset.bytes, asset.mimeType);
    if (!dimensions) throw new Error(`Orbit export image dimensions are invalid: ${asset.id}`);
    const naturalWidth = dimensions.width / 96;
    const naturalHeight = dimensions.height / 96;
    const scale = Math.min(6.2 / naturalWidth, 9 / naturalHeight, 1);
    const width = Math.max(0.01, naturalWidth * scale);
    const height = Math.max(0.01, naturalHeight * scale);
    warnings.add(
      "Orbit local images are embedded as portable, static ODT pictures; the content-hash source reference remains only in canonical Markdown.",
    );
    return `<draw:frame draw:style-name="OrbitImage" draw:name="${xmlAttribute(alt)}" text:anchor-type="paragraph" svg:width="${width.toFixed(4)}in" svg:height="${height.toFixed(4)}in"><draw:image xlink:href="${xmlAttribute(path)}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad" draw:mime-type="${asset.mimeType}"/><svg:title>${xmlText(alt)}</svg:title></draw:frame><text:p text:style-name="OrbitImageCaption">${xmlText(alt)}</text:p>`;
  }
  const chartId = block.source.match(EXACT_CHART_TOKEN)?.[1];
  if (chartId) {
    const chart = resolveOdfChart(chartId, workspace, snapshots, warnings);
    if (chart) return odfChart(chart, warnings, `OrbitChart${index + 1}`);
  }
  return `<text:p>${odfInline(block.source, warnings)}</text:p>`;
}

function exportOdt(
  artifact: WorkspaceArtifact,
  workspace: WorkspaceArtifact[],
  snapshots: WorkspaceQuerySnapshot[],
  imageAssets: readonly OrbitExportImageAsset[],
): OdfExportResult {
  if (artifact.source.length > MAX_ODT_SOURCE_CHARS)
    throw new Error("ODT export is limited to 200,000 source characters.");
  const warnings = new Set<string>();
  const images = orbitImageAssetMap(imageAssets);
  const blocks = parseMarkdownBlocks(artifact.source);
  const referencedImageIds = blocks.flatMap((block) =>
    block.type === "paragraph"
      ? [parseOrbitMarkdownImage(block.source)?.id].filter((id): id is string => Boolean(id))
      : [],
  );
  const inlineImage = extractOrbitAssetIds(artifact.source).find((id) => !referencedImageIds.includes(id));
  if (inlineImage) throw new Error("Place each Orbit local image on its own Markdown line before ODT export.");
  const unexpectedImage = imageAssets.find((asset) => !referencedImageIds.includes(asset.id));
  if (unexpectedImage) throw new Error(`Orbit export image is not referenced by this Document: ${unexpectedImage.id}`);
  if (blocks.length > MAX_ODT_BLOCKS) throw new Error("ODT export is limited to 10,000 semantic blocks.");
  const body =
    blocks.map((block, index) => blockToOdt(block, index, warnings, workspace, snapshots, images)).join("") ||
    "<text:p/>";
  warnings.add(
    "ODT export preserves semantic structure; page layout, comments, tracked changes, and advanced word-processor styling are not generated.",
  );
  const title = safeExportBaseName(artifact.name);
  const content = `${XML_DECLARATION}<office:document-content ${namespaces()} office:version="${ODF_VERSION}"><office:automatic-styles/><office:body><office:text>${body}</office:text></office:body></office:document-content>`;
  return {
    bytes: packageOdf("odt", title, content, textStylesXml(), images),
    fileName: `${title}.odt`,
    mimeType: ODF_MIME_TYPES.odt,
    warnings: [...warnings],
    targetType: "odt",
  };
}

function odsCell(value: DataCell, styleName: string) {
  if (typeof value === "number" && Number.isFinite(value))
    return `<table:table-cell table:style-name="${styleName}" office:value-type="float" office:value="${value}"><text:p>${xmlText(String(value))}</text:p></table:table-cell>`;
  if (typeof value === "boolean")
    return `<table:table-cell table:style-name="${styleName}" office:value-type="boolean" office:boolean-value="${value}"><text:p>${value ? "TRUE" : "FALSE"}</text:p></table:table-cell>`;
  const text = value == null ? "" : String(value);
  return `<table:table-cell table:style-name="${styleName}" office:value-type="string"><text:p>${xmlText(text)}</text:p></table:table-cell>`;
}

function spreadsheetStylesXml() {
  return `${XML_DECLARATION}<office:document-styles ${namespaces()} office:version="${ODF_VERSION}"><office:styles>${commonStyles()}</office:styles><office:automatic-styles/><office:master-styles/></office:document-styles>`;
}

function exportOds(artifact: WorkspaceArtifact): OdfExportResult {
  const parsed = parseDataSource(artifact.source);
  if (parsed.errors.length) throw new Error(parsed.errors[0]);
  if (!parsed.columns.length) throw new Error("The data artifact does not contain any columns to export.");
  if (parsed.columns.length > 256) throw new Error("ODS export is limited to 256 columns.");
  if (parsed.rows.length > 10_000) throw new Error("ODS export is limited to 10,000 data rows.");
  if ((parsed.rows.length + 1) * parsed.columns.length > 50_000)
    throw new Error("ODS export is limited to 50,000 cells.");
  const title = safeExportBaseName(artifact.name);
  const sheetName = title.replace(/[:\\/?*\[\]]/gu, "-").slice(0, 80) || "Orbit data";
  const rows: DataCell[][] = [
    parsed.columns,
    ...parsed.rows.map((row) => parsed.columns.map((column) => row[column] ?? null)),
  ];
  const rowsXml = rows
    .map(
      (row, rowIndex) =>
        `<table:table-row>${row.map((value) => odsCell(value, rowIndex === 0 ? "OrbitHeaderCell" : "OrbitCell")).join("")}</table:table-row>`,
    )
    .join("");
  const columnsXml = `<table:table-column table:style-name="OrbitColumn" table:number-columns-repeated="${parsed.columns.length}"/>`;
  const content = `${XML_DECLARATION}<office:document-content ${namespaces()} office:version="${ODF_VERSION}"><office:automatic-styles/><office:body><office:spreadsheet><table:table table:name="${xmlAttribute(sheetName)}">${columnsXml}${rowsXml}</table:table></office:spreadsheet></office:body></office:document-content>`;
  const warnings = [
    "ODS export contains typed values only; formulas, charts, comments, filters, and source formatting are not generated.",
    "Formula-looking text remains a string and is never emitted as an OpenFormula expression.",
  ];
  return {
    bytes: packageOdf("ods", title, content, spreadsheetStylesXml()),
    fileName: `${title}.ods`,
    mimeType: ODF_MIME_TYPES.ods,
    warnings,
    targetType: "ods",
  };
}

function deckSlideModel(
  slide: DeckSlide,
  warnings: Set<string>,
  workspace: WorkspaceArtifact[],
  snapshots: WorkspaceQuerySnapshot[],
  index: number,
  images: Map<string, OrbitExportImageAsset>,
): OdpSlideModel {
  const blocks = parseMarkdownBlocks(slide.source);
  const titleBlock = blocks.find((block) => block.type === "heading");
  const title =
    titleBlock && titleBlock.type === "heading"
      ? plainMarkdownInline(titleBlock.source, warnings)
      : `Slide ${index + 1}`;
  const paragraphs: OdpParagraph[] = [];
  const tables: string[][][] = [];
  const charts: ChartModel[] = [];
  let image: OdpSlideImage | null = null;
  let titleConsumed = false;
  blocks.forEach((block) => {
    if (block === titleBlock && !titleConsumed) {
      titleConsumed = true;
      return;
    }
    if (block.type === "table") {
      tables.push(block.rows);
      return;
    }
    if (block.type === "list") {
      paragraphs.push({ text: plainMarkdownInline(block.source, warnings), bullet: true, level: block.level });
      return;
    }
    if (block.type === "heading") {
      paragraphs.push({ text: plainMarkdownInline(block.source, warnings), bullet: false, level: 0, strong: true });
      return;
    }
    const imageReference = parseOrbitMarkdownImage(block.source);
    if (imageReference) {
      const asset = images.get(imageReference.id);
      if (!asset) throw new Error(`Referenced local image is missing or corrupt: ${imageReference.id}`);
      image = { reference: imageReference, asset };
      return;
    }
    const chartId = block.source.match(EXACT_CHART_TOKEN)?.[1];
    if (chartId) {
      const chart = resolveOdfChart(chartId, workspace, snapshots, warnings);
      if (chart) charts.push(chart);
      return;
    }
    paragraphs.push({ text: plainMarkdownInline(block.source, warnings), bullet: false, level: 0 });
  });
  return { title, eyebrow: slide.eyebrow, paragraphs, tables, charts, image, layout: slide.layout };
}

function odpTextFrame(model: OdpSlideModel) {
  const paragraphs: string[] = [];
  if (model.eyebrow)
    paragraphs.push(`<text:p text:style-name="OrbitEyebrow">${xmlText(model.eyebrow.toUpperCase())}</text:p>`);
  let listOpen = false;
  model.paragraphs.forEach((paragraph) => {
    if (paragraph.bullet && !listOpen) {
      paragraphs.push('<text:list text:style-name="OrbitBullet">');
      listOpen = true;
    } else if (!paragraph.bullet && listOpen) {
      paragraphs.push("</text:list>");
      listOpen = false;
    }
    if (paragraph.bullet)
      paragraphs.push(
        `<text:list-item><text:p>${paragraph.level ? `${" ".repeat(Math.min(6, paragraph.level))}` : ""}${xmlText(paragraph.text)}</text:p></text:list-item>`,
      );
    else
      paragraphs.push(
        `<text:p${paragraph.strong ? ' text:style-name="OrbitSlideHeading"' : ""}>${xmlText(paragraph.text)}</text:p>`,
      );
  });
  if (listOpen) paragraphs.push("</text:list>");
  model.tables.forEach((rows, index) =>
    paragraphs.push(semanticTable(rows, new Set<string>(), `SlideTable${index + 1}`)),
  );
  model.charts.forEach((chart, index) =>
    paragraphs.push(
      `<text:h text:outline-level="3">${xmlText(chart.spec.title)}</text:h>${chart.spec.description ? `<text:p text:style-name="OrbitQuote">${xmlText(chart.spec.description)}</text:p>` : ""}${semanticTable(chartRows(chart), new Set<string>(), `SlideChart${index + 1}`)}`,
    ),
  );
  return `<draw:frame draw:style-name="OrbitContentFrame" presentation:class="outline" svg:x="0.8in" svg:y="1.75in" svg:width="${model.image ? "5.25in" : "11.73in"}" svg:height="5.2in"><draw:text-box>${paragraphs.join("") || "<text:p/>"}</draw:text-box></draw:frame>`;
}

function odpImageFrame(image: OdpSlideImage) {
  const dimensions = orbitImageDimensions(image.asset.bytes, image.asset.mimeType);
  if (!dimensions) throw new Error(`Orbit export image dimensions are invalid: ${image.asset.id}`);
  const box = { x: 6.55, y: 1.55, width: 5.95, height: 4.95 };
  const scale = Math.min(box.width / dimensions.width, box.height / dimensions.height);
  const width = dimensions.width * scale;
  const height = dimensions.height * scale;
  const x = box.x + (box.width - width) / 2;
  const y = box.y + (box.height - height) / 2;
  const path = `Pictures/orbit-${image.asset.id}.${orbitImageExtension(image.asset.mimeType)}`;
  return `<draw:frame draw:style-name="OrbitImageFrame" draw:name="${xmlAttribute(image.reference.alt || image.asset.name || "Orbit image")}" svg:x="${x.toFixed(4)}in" svg:y="${y.toFixed(4)}in" svg:width="${width.toFixed(4)}in" svg:height="${height.toFixed(4)}in"><draw:image xlink:href="${xmlAttribute(path)}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame>`;
}

function presentationStylesXml() {
  return `${XML_DECLARATION}<office:document-styles ${namespaces()} office:version="${ODF_VERSION}"><office:styles>${commonStyles()}${listStyles()}<style:style style:name="OrbitSlideTitle" style:family="paragraph"><style:text-properties fo:font-size="26pt" fo:font-weight="bold" fo:color="#17211b"/></style:style><style:style style:name="OrbitSlideHeading" style:family="paragraph"><style:text-properties fo:font-size="16pt" fo:font-weight="bold" fo:color="#17211b"/></style:style><style:style style:name="OrbitEyebrow" style:family="paragraph"><style:text-properties fo:font-size="10pt" fo:font-weight="bold" fo:color="#ff5c35"/></style:style><style:presentation-page-layout style:name="OrbitSlide"><presentation:placeholder presentation:object="title" svg:x="0.8in" svg:y="0.55in" svg:width="11.73in" svg:height="1.05in"/><presentation:placeholder presentation:object="outline" svg:x="0.8in" svg:y="1.75in" svg:width="11.73in" svg:height="5.2in"/></style:presentation-page-layout></office:styles><office:automatic-styles><style:page-layout style:name="OrbitSlideLayout"><style:page-layout-properties fo:page-width="13.333in" fo:page-height="7.5in" style:print-orientation="landscape" fo:margin="0in"/></style:page-layout><style:style style:name="OrbitPage" style:family="drawing-page"><style:drawing-page-properties draw:fill="solid" draw:fill-color="#fbfaf6" presentation:background-visible="true"/></style:style><style:style style:name="OrbitTitleFrame" style:family="graphic"><style:graphic-properties draw:stroke="none" draw:fill="none"/></style:style><style:style style:name="OrbitContentFrame" style:family="graphic"><style:graphic-properties draw:stroke="none" draw:fill="none" fo:padding="0.04in"/></style:style><style:style style:name="OrbitImageFrame" style:family="graphic"><style:graphic-properties draw:stroke="none" draw:fill="none"/></style:style></office:automatic-styles><office:master-styles><style:master-page style:name="Orbit" style:page-layout-name="OrbitSlideLayout" draw:style-name="OrbitPage"/></office:master-styles></office:document-styles>`;
}

function exportOdp(
  artifact: WorkspaceArtifact,
  workspace: WorkspaceArtifact[],
  snapshots: WorkspaceQuerySnapshot[],
  imageAssets: readonly OrbitExportImageAsset[],
): OdfExportResult {
  const parsed = parseDeckSource(artifact.source);
  if (!parsed.deck) throw new Error(parsed.errors[0] ?? "The Deck Markdown source is not valid.");
  const warnings = new Set<string>();
  const images = orbitImageAssetMap(imageAssets);
  const referencedImageIds = extractOrbitAssetIds(artifact.source);
  const missingImage = referencedImageIds.find((id) => !images.has(id));
  if (missingImage) throw new Error(`Referenced local image is missing or corrupt: ${missingImage}`);
  const unexpectedImage = imageAssets.find((asset) => !referencedImageIds.includes(asset.id));
  if (unexpectedImage) throw new Error(`Orbit export image is not referenced by this Deck: ${unexpectedImage.id}`);
  const models = parsed.deck.slides.map((slide, index) =>
    deckSlideModel(slide, warnings, workspace, snapshots, index, images),
  );
  if (models.some((model) => model.tables.length > 2))
    warnings.add(
      "ODP preserves semantic tables, but crowded slides may need layout adjustment in the receiving presentation app.",
    );
  if (models.some((model) => model.charts.length))
    warnings.add(
      "Live Orbit charts are exported as selectable current-data tables in ODP; the live binding and chart geometry are not retained.",
    );
  if (models.some((model) => model.image))
    warnings.add(
      "Orbit local images are embedded as portable, static ODP media; content-hash references remain only in canonical Deck Markdown.",
    );
  warnings.add(
    "ODP export preserves slide order, text, bullets, tables, local images, and current chart values; animation, speaker notes, and exact master styling are not generated.",
  );
  const pages = models
    .map(
      (model, index) =>
        `<draw:page draw:name="Slide ${index + 1}" draw:style-name="OrbitPage" draw:master-page-name="Orbit" presentation:presentation-page-layout-name="OrbitSlide"><draw:frame draw:style-name="OrbitTitleFrame" presentation:class="title" svg:x="0.8in" svg:y="0.55in" svg:width="${model.image ? "5.25in" : "11.73in"}" svg:height="1.05in"><draw:text-box><text:p text:style-name="OrbitSlideTitle">${xmlText(model.title)}</text:p></draw:text-box></draw:frame>${odpTextFrame(model)}${model.image ? odpImageFrame(model.image) : ""}</draw:page>`,
    )
    .join("");
  const content = `${XML_DECLARATION}<office:document-content ${namespaces()} office:version="${ODF_VERSION}"><office:automatic-styles/><office:body><office:presentation>${pages}</office:presentation></office:body></office:document-content>`;
  const title = safeExportBaseName(artifact.name);
  return {
    bytes: packageOdf("odp", parsed.deck.frontmatter.title || title, content, presentationStylesXml(), images),
    fileName: `${title}.odp`,
    mimeType: ODF_MIME_TYPES.odp,
    warnings: [...warnings],
    targetType: "odp",
  };
}

export function isOdfExportArtifact(artifact: WorkspaceArtifact) {
  return artifact.kind === "document" || artifact.kind === "data" || artifact.kind === "slides";
}

export function exportOdfArtifact(
  artifact: WorkspaceArtifact,
  workspace: WorkspaceArtifact[] = [],
  querySnapshots: WorkspaceQuerySnapshot[] = [],
  imageAssets: readonly OrbitExportImageAsset[] = [],
): OdfExportResult {
  if (!artifact.source.trim()) throw new Error("The source is empty.");
  if (artifact.source.length > MAX_ODF_EXPORT_SOURCE_CHARS)
    throw new Error("OpenDocument export is limited to 2,000,000 source characters.");
  if (artifact.kind === "document") return exportOdt(artifact, workspace, querySnapshots, imageAssets);
  if (artifact.kind === "data") return exportOds(artifact);
  if (artifact.kind === "slides") {
    const conversion = isDeckMarkdownArtifact(artifact) ? null : convertSemanticHtmlPresentationToDeck(artifact);
    const result = exportOdp(conversion?.artifact ?? artifact, workspace, querySnapshots, imageAssets);
    return conversion ? { ...result, warnings: [...conversion.warnings, ...result.warnings] } : result;
  }
  throw new Error(
    "OpenDocument export supports Markdown documents, CSV/JSON data, Deck Markdown, and semantic HTML presentations.",
  );
}
