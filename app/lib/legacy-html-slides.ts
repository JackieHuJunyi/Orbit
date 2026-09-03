import { renderOrbitHtmlAssetReferences } from "./local-assets.ts";
import { PRESENTATION_CANVAS_WIDTH, PRESENTATION_PREVIEW_CANVAS_STYLE } from "./presentation-canvas.ts";

export type LegacyHtmlSlide = Readonly<{
  end: number;
  html: string;
  index: number;
  label: string;
  source: string;
  start: number;
}>;

export type LegacyHtmlSlideCompilation = Readonly<{
  errors: readonly string[];
  root?: Readonly<{
    closeEnd: number;
    closeStart: number;
    openEnd: number;
    openStart: number;
    source: string;
  }>;
  slides: readonly LegacyHtmlSlide[];
}>;

type HtmlTagToken = {
  closing: boolean;
  end: number;
  name: string;
  selfClosing: boolean;
  source: string;
  start: number;
};

const MAX_LEGACY_HTML_CHARS = 120_000;
const MAX_LEGACY_HTML_SLIDES = 40;

export type LegacyHtmlSlideCompileOptions = Readonly<{
  resolveLocalAssetUrl?: (reference: string) => string | null;
}>;

function tagEnd(source: string, start: number) {
  let quote = "";
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === ">") return index + 1;
  }
  return -1;
}

function readTag(source: string, start: number): HtmlTagToken | null {
  const end = tagEnd(source, start);
  if (end < 0) return null;
  const raw = source.slice(start, end);
  const match = raw.match(/^<\s*(\/)?\s*([a-z][a-z0-9:-]*)\b/i);
  if (!match) return { closing: false, end, name: "", selfClosing: false, source: raw, start };
  return {
    closing: Boolean(match[1]),
    end,
    name: match[2].toLowerCase(),
    selfClosing: /\/\s*>$/.test(raw),
    source: raw,
    start,
  };
}

function boundedLabel(source: string, fallback: string) {
  const heading = source.match(/<h[12]\b[^>]*>([^]*?)<\/h[12]\s*>/i)?.[1] ?? "";
  const readable = heading
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!readable) return fallback;
  return readable.length > 72 ? `${readable.slice(0, 69).trimEnd()}…` : readable;
}

function closingRawTextTag(source: string, name: string, start: number): HtmlTagToken | null {
  const pattern = new RegExp(`<\\/\\s*${name}\\s*>`, "gi");
  pattern.lastIndex = start;
  const match = pattern.exec(source);
  return match ? readTag(source, match.index) : null;
}

function slideDocument(
  htmlOpen: string,
  mainOpen: string,
  sharedStyles: string[],
  section: string,
  options: LegacyHtmlSlideCompileOptions,
) {
  const safeHtmlOpen = htmlOpen || '<html lang="en">';
  const safeMainOpen = mainOpen || "<main>";
  const renderedSection = renderOrbitHtmlAssetReferences(section, options.resolveLocalAssetUrl);
  return `<!doctype html>${safeHtmlOpen}<head><meta charset="utf-8"><meta name="viewport" content="width=${PRESENTATION_CANVAS_WIDTH},initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:">${sharedStyles.join("")}<style data-orbit-preview-canvas="1120x630">${PRESENTATION_PREVIEW_CANVAS_STYLE}</style></head><body>${safeMainOpen}${renderedSection}</main></body></html>`;
}

export function compileLegacyHtmlSlides(
  source: string,
  options: LegacyHtmlSlideCompileOptions = {},
): LegacyHtmlSlideCompilation {
  if (!source.trim()) return Object.freeze({ slides: [], errors: ["Add semantic HTML to create a presentation."] });
  if (source.length > MAX_LEGACY_HTML_CHARS) {
    return Object.freeze({ slides: [], errors: ["Semantic HTML exceeds the 120,000-character limit."] });
  }

  const errors: string[] = [];
  const ranges: Array<{ start: number; end: number }> = [];
  const sharedStyles: string[] = [];
  let htmlOpen = "";
  let mainOpen = "";
  let mainOpenStart = -1;
  let mainOpenEnd = -1;
  let mainCloseStart = -1;
  let mainCloseEnd = -1;
  let mainSeen = false;
  let insideMain = false;
  let sectionDepth = 0;
  let sectionStart = -1;
  let index = 0;

  while (index < source.length) {
    const nextTag = source.indexOf("<", index);
    if (nextTag < 0) break;
    if (source.startsWith("<!--", nextTag)) {
      const commentEnd = source.indexOf("-->", nextTag + 4);
      if (commentEnd < 0) {
        errors.push("Semantic HTML contains an unclosed comment.");
        break;
      }
      index = commentEnd + 3;
      continue;
    }
    const token = readTag(source, nextTag);
    if (!token) {
      errors.push("Semantic HTML contains an unclosed tag.");
      break;
    }
    index = token.end;
    if (!token.name) continue;
    if (token.name === "script") {
      errors.push("Scripts are blocked in the slide preview.");
      break;
    }
    if (!token.closing && (token.name === "style" || token.name === "title" || token.name === "textarea")) {
      const closing = closingRawTextTag(source, token.name, token.end);
      if (!closing) {
        errors.push(`Semantic HTML contains an unclosed <${token.name}> element.`);
        break;
      }
      if (token.name === "style" && !insideMain && sectionDepth === 0) {
        sharedStyles.push(source.slice(token.start, closing.end));
      }
      index = closing.end;
      continue;
    }
    if (!token.closing && token.name === "html" && !htmlOpen) htmlOpen = token.source;
    if (token.name === "main") {
      if (token.selfClosing) {
        errors.push("Slides need a non-empty <main> element.");
        break;
      }
      if (!token.closing) {
        if (insideMain || mainSeen) {
          errors.push("Semantic HTML must contain exactly one <main> presentation root.");
          break;
        }
        insideMain = true;
        mainSeen = true;
        mainOpen = token.source;
        mainOpenStart = token.start;
        mainOpenEnd = token.end;
      } else {
        if (!insideMain || sectionDepth > 0) {
          errors.push("Semantic HTML closes <main> before its slide sections are complete.");
          break;
        }
        insideMain = false;
        mainCloseStart = token.start;
        mainCloseEnd = token.end;
      }
      continue;
    }
    if (token.name !== "section" || !insideMain) continue;
    if (!token.closing) {
      if (token.selfClosing) {
        errors.push("Slide <section> elements cannot be self-closing.");
        break;
      }
      if (sectionDepth === 0) sectionStart = token.start;
      sectionDepth += 1;
      continue;
    }
    if (sectionDepth === 0) {
      errors.push("Semantic HTML contains an unmatched </section> inside <main>.");
      break;
    }
    sectionDepth -= 1;
    if (sectionDepth === 0 && sectionStart >= 0) {
      ranges.push({ start: sectionStart, end: token.end });
      sectionStart = -1;
    }
  }

  if (!errors.length && !mainSeen) errors.push("Slides need a <main> element.");
  if (!errors.length && insideMain) errors.push("Semantic HTML contains an unclosed <main> element.");
  if (!errors.length && sectionDepth > 0) errors.push("Semantic HTML contains an unclosed <section> slide.");
  if (!errors.length && !ranges.length) errors.push("Add at least one <section> slide.");
  if (!errors.length && ranges.length > MAX_LEGACY_HTML_SLIDES) {
    errors.push(`Semantic HTML is limited to ${MAX_LEGACY_HTML_SLIDES} slides.`);
  }
  if (errors.length) return Object.freeze({ slides: [], errors: Object.freeze([...new Set(errors)]) });

  const slides = ranges.map((range, slideIndex) => {
    const section = source.slice(range.start, range.end);
    return Object.freeze({
      ...range,
      html: slideDocument(htmlOpen, mainOpen, sharedStyles, section, options),
      index: slideIndex,
      label: boundedLabel(section, `Slide ${slideIndex + 1}`),
      source: section,
    });
  });
  const root = Object.freeze({
    openStart: mainOpenStart,
    openEnd: mainOpenEnd,
    closeStart: mainCloseStart,
    closeEnd: mainCloseEnd,
    source: mainOpen,
  });
  return Object.freeze({ root, slides: Object.freeze(slides), errors: Object.freeze([]) });
}
