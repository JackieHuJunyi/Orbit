import { compileDeckSource } from "./deck.ts";
import { compileLegacyHtmlSlides } from "./legacy-html-slides.ts";
import { PORTABLE_SOURCE_REVISION_PATTERN } from "./source-revision.ts";

export type SemanticHtmlPresentationMetadata = Readonly<{
  audience?: "customer" | "leadership" | "team";
  lang: string;
  origin?: string;
  originRevision?: string;
  purpose?: string;
  theme: "orbit" | "orbit-dark";
  title: string;
}>;

export type SemanticHtmlSourceResult = Readonly<{
  errors: readonly string[];
  source?: string;
}>;

const ATTRIBUTE_PATTERN = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu;
const PORTABLE_ORIGIN_PATTERN = /^[^\u0000-\u001f\u007f\r\n]{1,128}$/u;

export function escapeSemanticHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&amp;/giu, "&");
}

function rootAttributes(source: string) {
  const compilation = compileLegacyHtmlSlides(source);
  if (compilation.errors.length || !compilation.root) return null;
  const attributes = new Map<string, string>();
  for (const match of compilation.root.source.matchAll(ATTRIBUTE_PATTERN)) {
    attributes.set(match[1].toLowerCase(), decodeHtmlAttribute(match[2] ?? match[3] ?? ""));
  }
  return { attributes, compilation };
}

export function semanticHtmlPresentationMetadata(source: string): SemanticHtmlPresentationMetadata | null {
  const parsed = rootAttributes(source);
  if (!parsed || parsed.attributes.get("data-orbit-format") !== "presentation-v1") return null;
  const title = parsed.attributes.get("data-orbit-title")?.trim() ?? "";
  const lang = parsed.attributes.get("data-orbit-lang")?.trim() ?? "en";
  const theme = parsed.attributes.get("data-orbit-theme") === "orbit-dark" ? "orbit-dark" : "orbit";
  const origin = parsed.attributes.get("data-orbit-origin")?.trim() || undefined;
  const originRevision = parsed.attributes.get("data-orbit-origin-revision")?.trim() || undefined;
  const audienceValue = parsed.attributes.get("data-orbit-audience")?.trim();
  const audience = ["customer", "leadership", "team"].includes(audienceValue ?? "")
    ? (audienceValue as SemanticHtmlPresentationMetadata["audience"])
    : undefined;
  const purpose = parsed.attributes.get("data-orbit-purpose")?.trim() || undefined;
  if (!title || title.length > 120 || !lang || lang.length > 16) return null;
  if (origin && !PORTABLE_ORIGIN_PATTERN.test(origin)) return null;
  if (originRevision && (!origin || !PORTABLE_SOURCE_REVISION_PATTERN.test(originRevision))) return null;
  if (purpose && purpose.length > 180) return null;
  return Object.freeze({
    title,
    theme,
    lang,
    ...(origin ? { origin } : {}),
    ...(originRevision ? { originRevision } : {}),
    ...(audience ? { audience } : {}),
    ...(purpose ? { purpose } : {}),
  });
}

export function semanticHtmlPresentationFromDeckSource(deckSource: string): SemanticHtmlSourceResult {
  const compilation = compileDeckSource(deckSource, { preserveLocalAssetReferences: true });
  if (!compilation.html || compilation.errors.length) {
    return Object.freeze({
      errors: Object.freeze(
        compilation.errors.length
          ? [...compilation.errors]
          : ["Orbit could not compile the presentation as semantic HTML."],
      ),
    });
  }
  const html = compileLegacyHtmlSlides(compilation.html);
  if (html.errors.length || !semanticHtmlPresentationMetadata(compilation.html)) {
    return Object.freeze({
      errors: Object.freeze(
        html.errors.length ? [...html.errors] : ["Orbit could not prove the generated semantic HTML presentation."],
      ),
    });
  }
  return Object.freeze({ source: compilation.html, errors: Object.freeze([]) });
}

export function semanticHtmlPresentationStarter(title: string, lang = "en") {
  return semanticHtmlPresentationFromDeckSource(`---
version: 1
title: ${title}
theme: orbit
ratio: 16:9
lang: ${lang}
---

<!-- layout: cover -->

# ${title}
`);
}

function validSemanticSection(section: string) {
  const sectionProbe = compileLegacyHtmlSlides(`<main>${section.trim()}</main>`);
  if (
    sectionProbe.errors.length ||
    sectionProbe.slides.length !== 1 ||
    sectionProbe.slides[0]?.source !== section.trim()
  ) {
    return {
      errors: sectionProbe.errors.length
        ? [...sectionProbe.errors]
        : ["Provide exactly one complete outer semantic HTML slide section."],
    };
  }
  return { section: section.trim(), errors: [] };
}

function normalizeSlideOpeningTag(section: string, index: number) {
  let quote = "";
  let openEnd = -1;
  for (let offset = 0; offset < section.length; offset += 1) {
    const character = section[offset];
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === ">") {
      openEnd = offset + 1;
      break;
    }
  }
  if (openEnd < 0) return section;
  const opening = section.slice(0, openEnd);
  let found = false;
  const normalized = opening.replace(/\sdata-slide-index\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/giu, () => {
    if (found) return "";
    found = true;
    return ` data-slide-index="${index}"`;
  });
  const withIndex = found ? normalized : normalized.replace(/>$/, ` data-slide-index="${index}">`);
  return `${withIndex}${section.slice(openEnd)}`;
}

function normalizeSlideNumber(section: string, index: number, total: number) {
  const label = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  const numbered = section.replace(
    /<span\b(?=[^>]*\bclass\s*=\s*(?:"[^"]*\bnumber\b[^"]*"|'[^']*\bnumber\b[^']*'))[^>]*>[^<]*<\/span\s*>/iu,
    `<span class="number">${label}</span>`,
  );
  if (numbered !== section) return numbered;
  return section.replace(/<\/section\s*>\s*$/iu, `<span class="number">${label}</span>\n</section>`);
}

function normalizeOrbitPresentationSlides(source: string) {
  if (!semanticHtmlPresentationMetadata(source)) return source;
  const compilation = compileLegacyHtmlSlides(source);
  if (compilation.errors.length) return source;
  let normalized = source;
  const total = compilation.slides.length;
  for (const slide of [...compilation.slides].reverse()) {
    const section = normalizeSlideNumber(normalizeSlideOpeningTag(slide.source, slide.index), slide.index, total);
    normalized = `${normalized.slice(0, slide.start)}${section}${normalized.slice(slide.end)}`;
  }
  return normalized;
}

function validateSemanticSlideMutation(source: string, expectedSlideCount: number): SemanticHtmlSourceResult {
  const normalized = normalizeOrbitPresentationSlides(source);
  const next = compileLegacyHtmlSlides(normalized);
  if (next.errors.length || next.slides.length !== expectedSlideCount) {
    return Object.freeze({
      errors: Object.freeze(
        next.errors.length ? [...next.errors] : ["Orbit could not prove the changed semantic HTML presentation."],
      ),
    });
  }
  return Object.freeze({ source: normalized, errors: Object.freeze([]) });
}

function semanticSlideIndex(source: string, index: number) {
  const current = rootAttributes(source);
  if (!current?.compilation.root) {
    return { errors: ["Orbit could not prove the semantic HTML presentation root."] };
  }
  if (!Number.isInteger(index) || index < 0 || index >= current.compilation.slides.length) {
    return { errors: [`Semantic HTML slide index is outside the current presentation: ${index}`] };
  }
  return { current, slide: current.compilation.slides[index], errors: [] };
}

export function replaceSemanticHtmlPresentationSlide(
  source: string,
  index: number,
  section: string,
): SemanticHtmlSourceResult {
  const resolved = semanticSlideIndex(source, index);
  if (!resolved.current || !resolved.slide) return Object.freeze({ errors: Object.freeze(resolved.errors) });
  const candidate = validSemanticSection(section);
  if (!candidate.section) return Object.freeze({ errors: Object.freeze(candidate.errors) });
  if (resolved.slide.source === candidate.section) {
    return Object.freeze({
      errors: Object.freeze(["The semantic HTML slide replacement does not change its source."]),
    });
  }
  return validateSemanticSlideMutation(
    `${source.slice(0, resolved.slide.start)}${candidate.section}${source.slice(resolved.slide.end)}`,
    resolved.current.compilation.slides.length,
  );
}

export function insertSemanticHtmlPresentationSlideAfter(
  source: string,
  index: number,
  section: string,
): SemanticHtmlSourceResult {
  const resolved = semanticSlideIndex(source, index);
  if (!resolved.current || !resolved.slide) return Object.freeze({ errors: Object.freeze(resolved.errors) });
  const candidate = validSemanticSection(section);
  if (!candidate.section) return Object.freeze({ errors: Object.freeze(candidate.errors) });
  return validateSemanticSlideMutation(
    `${source.slice(0, resolved.slide.end).trimEnd()}\n${candidate.section}\n${source.slice(resolved.slide.end).trimStart()}`,
    resolved.current.compilation.slides.length + 1,
  );
}

export function appendSemanticHtmlPresentationSlide(source: string, section: string): SemanticHtmlSourceResult {
  const current = rootAttributes(source);
  if (!current?.compilation.root) {
    return Object.freeze({ errors: Object.freeze(["Orbit could not prove the semantic HTML presentation root."]) });
  }
  const candidate = validSemanticSection(section);
  if (!candidate.section) return Object.freeze({ errors: Object.freeze(candidate.errors) });
  const insertion = current.compilation.root.closeStart;
  const nextSource = `${source.slice(0, insertion).trimEnd()}\n${candidate.section}\n${source.slice(insertion)}`;
  return validateSemanticSlideMutation(nextSource, current.compilation.slides.length + 1);
}
