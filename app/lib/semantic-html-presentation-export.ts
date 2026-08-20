import { DOMParser, type Element as XmlElement, type Node as XmlNode } from "@xmldom/xmldom";
import { safeExportBaseName } from "./export-contract.ts";
import { compileLegacyHtmlSlides } from "./legacy-html-slides.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export type SemanticHtmlPresentationExport = Readonly<{
  artifact: Readonly<WorkspaceArtifact>;
  warnings: readonly string[];
}>;

const SUPPORTED_DECK_LAYOUTS = new Set(["cover", "content", "metrics", "split", "conclusion"]);
const OMITTED_TEXT_ELEMENTS = new Set(["script", "style", "template", "noscript", "svg", "canvas"]);
const BLOCK_TEXT_ELEMENTS = new Set(["p", "blockquote", "pre", "figcaption"]);
const RUNE_LOCALES = new Set(["en", "zh-CN", "zh-TW", "fr", "es", "ru", "ar", "ja", "ko"]);

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

function escapeDeckText(value: string) {
  return value
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/\\/gu, "\\\\")
    .replace(/([`*_[\]<>#+\-])/gu, "\\$1");
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
  if (/<(?:img|picture|video)\b/iu.test(artifact.source)) {
    warnings.add(
      "Images and video referenced by semantic HTML are omitted because they are not verified Rune local assets.",
    );
  }
  const slides = compilation.slides.map((slide) => parseSection(slide.source, slide.index, slide.label, warnings));
  const title = escapeDeckText(safeExportBaseName(artifact.name));
  const source = `---
version: 1
title: ${title}
theme: rune
ratio: 16:9
lang: ${sourceLocale(artifact.source)}
---

${slides.join("\n\n---\n\n")}`;
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
