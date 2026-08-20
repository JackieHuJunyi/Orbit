import { DOMParser, type Element as XmlElement, type Node as XmlNode } from "@xmldom/xmldom";
import { parseDeckSource } from "./deck.ts";
import { safeExportBaseName } from "./export-contract.ts";
import { compileLegacyHtmlSlides } from "./legacy-html-slides.ts";
import { parseRuneAssetReference } from "./local-assets.ts";
import { semanticHtmlPresentationMetadata } from "./semantic-html-presentation.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export type SemanticHtmlPresentationExport = Readonly<{
  artifact: Readonly<WorkspaceArtifact>;
  warnings: readonly string[];
}>;

const SUPPORTED_DECK_LAYOUTS = new Set(["cover", "content", "metrics", "split", "conclusion"]);
const OMITTED_TEXT_ELEMENTS = new Set(["script", "style", "template", "noscript", "svg", "canvas"]);
const BLOCK_TEXT_ELEMENTS = new Set(["p", "blockquote", "pre", "figcaption"]);
const RUNE_LOCALES = new Set(["en", "zh-CN", "zh-TW", "fr", "es", "ru", "ar", "ja", "ko"]);
const LIVE_BINDING_PATTERN = /\{\{\s*(?:metric|chart)\([^{}\r\n]*\)\s*\}\}/giu;

function tagName(node: XmlNode) {
  return node.nodeType === 1 ? (node as XmlElement).tagName.toLowerCase() : "";
}

function readableText(node: XmlNode): string {
  if (node.nodeType === 3 || node.nodeType === 4) return node.nodeValue ?? "";
  const name = tagName(node);
  if (OMITTED_TEXT_ELEMENTS.has(name)) return "";
  if (name === "br") return " ";
  return Array.from(node.childNodes).map(readableText).join(" ").replace(/\s+/gu, " ").trim();
}

function escapePlainDeckText(value: string) {
  return value.replace(/\\/gu, "\\\\").replace(/([`*_[\]<>#+\-])/gu, "\\$1");
}

function escapeDeckText(value: string) {
  const normalized = value.replace(/\s+/gu, " ").trim();
  let escaped = "";
  let offset = 0;
  for (const match of normalized.matchAll(LIVE_BINDING_PATTERN)) {
    const start = match.index ?? 0;
    escaped += escapePlainDeckText(normalized.slice(offset, start));
    escaped += match[0];
    offset = start + match[0].length;
  }
  return `${escaped}${escapePlainDeckText(normalized.slice(offset))}`;
}

function firstHeading(root: XmlElement) {
  const queue = [...Array.from(root.childNodes)];
  while (queue.length) {
    const node = queue.shift();
    if (!node) continue;
    const name = tagName(node);
    if (name === "h1" || name === "h2") return node as XmlElement;
    if (!OMITTED_TEXT_ELEMENTS.has(name)) queue.unshift(...Array.from(node.childNodes));
  }
  return null;
}

function directElements(root: XmlElement, name: string) {
  return Array.from(root.childNodes).filter(
    (node): node is XmlElement => node.nodeType === 1 && tagName(node) === name,
  );
}

function hasClass(element: XmlElement, token: string) {
  return (element.getAttribute("class") ?? "").split(/\s+/u).includes(token);
}

function firstDescendant(root: XmlElement, name: string) {
  return Array.from(root.getElementsByTagName(name))[0] ?? null;
}

function metricGridMarkdown(grid: XmlElement, warnings: Set<string>) {
  const metrics = directElements(grid, "div").filter((element) => hasClass(element, "metric"));
  if (!metrics.length || metrics.length > 8) {
    warnings.add("Unsupported semantic HTML metric groups are flattened into readable presentation text.");
    return null;
  }
  const columns = metrics.map((metric) => ({
    label: escapeDeckText(readableText(firstDescendant(metric, "span") ?? metric)),
    value: escapeDeckText(readableText(firstDescendant(metric, "strong") ?? metric)),
  }));
  if (
    columns.some((column) => !column.label || !column.value || column.label.includes("|") || column.value.includes("|"))
  ) {
    warnings.add("Unsupported semantic HTML metric groups are flattened into readable presentation text.");
    return null;
  }
  return [
    `| ${columns.map((column) => column.label).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    `| ${columns.map((column) => column.value).join(" | ")} |`,
  ].join("\n");
}

function tableMarkdown(table: XmlElement, warnings: Set<string>) {
  const sourceRows = Array.from(table.getElementsByTagName("tr"));
  const tableIsOversized =
    sourceRows.length > 20 ||
    sourceRows.some(
      (row) =>
        Array.from(row.childNodes).filter(
          (node): node is XmlElement => node.nodeType === 1 && ["th", "td"].includes(tagName(node)),
        ).length > 8,
    );
  const rows = sourceRows
    .slice(0, 20)
    .map((row) =>
      Array.from(row.childNodes)
        .filter((node): node is XmlElement => node.nodeType === 1 && ["th", "td"].includes(tagName(node)))
        .slice(0, 8)
        .map((cell) => readableText(cell)),
    )
    .filter((row) => row.length);
  if (!rows.length) return [];
  if (tableIsOversized) {
    warnings.add("Large semantic HTML tables are bounded to 20 rows and 8 columns in presentation handoff.");
  }
  const width = Math.max(...rows.map((row) => row.length));
  const rectangular = rows.every((row) => row.length === width);
  const containsDivider = rows.some((row) => row.some((cell) => cell.includes("|")));
  if (!rectangular || containsDivider) {
    warnings.add(
      "Irregular semantic HTML tables or cells containing vertical bars are flattened into readable row bullets.",
    );
    return rows.map((row) => `- ${escapeDeckText(row.join(" · "))}`);
  }
  const escaped = rows.map((row) => row.map(escapeDeckText));
  return [
    `| ${escaped[0].join(" | ")} |`,
    `| ${escaped[0].map(() => "---").join(" | ")} |`,
    ...escaped.slice(1).map((row) => `| ${row.join(" | ")} |`),
  ];
}

function listMarkdown(list: XmlElement) {
  const ordered = tagName(list) === "ol";
  return directElements(list, "li")
    .map((item, index) => {
      const value = escapeDeckText(readableText(item));
      return value ? `- ${ordered ? `${index + 1}. ` : ""}${value}` : "";
    })
    .filter(Boolean);
}

function markdownImageAlt(value: string) {
  return value
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 160)
    .replace(/\\/gu, "\\\\")
    .replace(/\[/gu, "\\[")
    .replace(/\]/gu, "\\]");
}

function localImageMarkdown(root: XmlElement, warnings: Set<string>) {
  const localImages: string[] = [];
  Array.from(root.getElementsByTagName("img")).forEach((image) => {
    const source = image.getAttribute("src") ?? "";
    const id = parseRuneAssetReference(source);
    if (!id) {
      warnings.add("Images not backed by verified Rune local assets are omitted from presentation handoff.");
      return;
    }
    const alt = markdownImageAlt(image.getAttribute("alt") || "Rune image");
    localImages.push(`![${alt || "Rune image"}](${source})`);
  });
  if (localImages.length > 1) {
    throw new Error("Semantic HTML handoff supports one verified local image per slide.");
  }
  return localImages[0] ?? "";
}

function collectBlocks(root: XmlElement, primaryHeading: XmlElement | null, warnings: Set<string>) {
  const blocks: string[] = [];
  const visit = (node: XmlNode) => {
    if (node.nodeType === 3 || node.nodeType === 4) {
      const value = escapeDeckText(node.nodeValue ?? "");
      if (value) blocks.push(value);
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as XmlElement;
    const name = tagName(element);
    if (OMITTED_TEXT_ELEMENTS.has(name) || name === "img" || name === "picture" || name === "video") return;
    if (hasClass(element, "eyebrow") || hasClass(element, "number")) return;
    if (element === primaryHeading) return;
    if (/^h[1-6]$/u.test(name)) {
      const value = escapeDeckText(readableText(element));
      if (value) blocks.push(`**${value}**`);
      return;
    }
    if (BLOCK_TEXT_ELEMENTS.has(name)) {
      const value = escapeDeckText(readableText(element));
      if (value) blocks.push(value);
      return;
    }
    if (name === "ul" || name === "ol") {
      const list = listMarkdown(element).join("\n");
      if (list) blocks.push(list);
      return;
    }
    if (name === "table") {
      const table = tableMarkdown(element, warnings).join("\n");
      if (table) blocks.push(table);
      return;
    }
    if (name === "div" && hasClass(element, "metric-grid")) {
      const metrics = metricGridMarkdown(element, warnings);
      if (metrics) {
        blocks.push(metrics);
        return;
      }
    }
    const descendants = Array.from(element.getElementsByTagName("*"));
    const hasStructuredDescendant = descendants.some((child) => {
      const childName = tagName(child);
      return (
        /^h[1-6]$/u.test(childName) || BLOCK_TEXT_ELEMENTS.has(childName) || ["ul", "ol", "table"].includes(childName)
      );
    });
    if (!hasStructuredDescendant) {
      const value = escapeDeckText(readableText(element));
      if (value) blocks.push(value);
      return;
    }
    Array.from(element.childNodes).forEach(visit);
  };
  Array.from(root.childNodes).forEach(visit);
  return blocks;
}

function sourceLocale(source: string) {
  const raw = source.match(/<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/iu)?.[1] ?? "en";
  if (RUNE_LOCALES.has(raw)) return raw;
  const normalized = raw.toLowerCase();
  if (normalized.startsWith("zh-tw") || normalized.startsWith("zh-hant")) return "zh-TW";
  if (normalized.startsWith("zh")) return "zh-CN";
  const base = normalized.split("-")[0];
  return RUNE_LOCALES.has(base) ? base : "en";
}

function parseSection(source: string, index: number, fallbackLabel: string, warnings: Set<string>) {
  const issues: string[] = [];
  const document = new DOMParser({
    onError(_level, message) {
      issues.push(message);
    },
  }).parseFromString(source, "text/html");
  if (issues.length || !document.documentElement || tagName(document.documentElement) !== "section") {
    throw new Error(`Slide ${index + 1} could not be converted from semantic HTML without guessing structure.`);
  }
  const section = document.documentElement;
  const heading = firstHeading(section);
  const title = escapeDeckText(heading ? readableText(heading) : fallbackLabel) || `Slide ${index + 1}`;
  const requestedLayout = section.getAttribute("data-layout")?.trim().toLowerCase() ?? "";
  const layout = SUPPORTED_DECK_LAYOUTS.has(requestedLayout) ? requestedLayout : index === 0 ? "cover" : "content";
  if (requestedLayout && requestedLayout !== layout) {
    warnings.add("Unsupported semantic HTML data-layout values use Rune's cover/content handoff layouts.");
  }
  const eyebrow = escapeDeckText(section.getAttribute("data-eyebrow") ?? "").slice(0, 100);
  const blocks = collectBlocks(section, heading, warnings);
  const image = localImageMarkdown(section, warnings);
  if (image) blocks.push(image);
  return `${`<!-- layout: ${layout} -->`}${eyebrow ? `\n<!-- eyebrow: ${eyebrow} -->` : ""}\n${index === 0 ? "#" : "##"} ${title}${blocks.length ? `\n\n${blocks.join("\n\n")}` : ""}`;
}

export function convertSemanticHtmlPresentationToDeck(artifact: WorkspaceArtifact): SemanticHtmlPresentationExport {
  if (artifact.kind !== "slides" || artifact.language !== "Semantic HTML" || !/\.html?$/iu.test(artifact.name)) {
    throw new Error("Semantic HTML presentation conversion requires one Semantic HTML Slides artifact.");
  }
  const compilation = compileLegacyHtmlSlides(artifact.source);
  if (compilation.errors.length) throw new Error(compilation.errors[0]);
  const warnings = new Set<string>([
    "Semantic HTML is converted to Rune's controlled slide model for this export; CSS, exact positioning, animation, forms, links, and unsupported elements are not retained.",
  ]);
  if (/<(?:picture|video)\b/iu.test(artifact.source))
    warnings.add("Picture and video elements are omitted from semantic presentation handoff.");
  const slides = compilation.slides.map((slide) => parseSection(slide.source, slide.index, slide.label, warnings));
  const metadata = semanticHtmlPresentationMetadata(artifact.source);
  const title = escapeDeckText(metadata?.title ?? safeExportBaseName(artifact.name));
  const lang = metadata && RUNE_LOCALES.has(metadata.lang) ? metadata.lang : sourceLocale(artifact.source);
  const lineage = metadata
    ? [
        metadata.origin ? `origin: ${metadata.origin}` : "",
        metadata.originRevision ? `origin_revision: ${metadata.originRevision}` : "",
        metadata.audience ? `audience: ${metadata.audience}` : "",
        metadata.purpose ? `purpose: ${escapeDeckText(metadata.purpose)}` : "",
      ].filter(Boolean)
    : [];
  const source = `---
version: 1
title: ${title}
theme: ${metadata?.theme ?? "rune"}
ratio: 16:9
lang: ${lang}${lineage.length ? `\n${lineage.join("\n")}` : ""}
---

${slides.join("\n\n---\n\n")}`;
  const parsed = parseDeckSource(source);
  if (!parsed.deck) {
    throw new Error(parsed.errors[0] ?? "The semantic HTML presentation could not enter Rune's controlled handoff.");
  }
  return Object.freeze({
    artifact: Object.freeze({
      ...artifact,
      name: `${safeExportBaseName(artifact.name)}.deck.md`,
      language: "Deck Markdown",
      source,
    }),
    warnings: Object.freeze([...warnings]),
  });
}
