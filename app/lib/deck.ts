import { z } from "zod";

const DeckFrontmatterSchema = z.object({
  version: z.literal("1").transform(() => 1 as const),
  title: z.string().trim().min(1).max(120),
  theme: z.enum(["rune", "rune-dark"]),
  ratio: z.literal("16:9"),
  lang: z.enum(["en", "zh-CN", "zh-TW", "fr", "es", "ru", "ar", "ja", "ko"]).default("en"),
}).strict();

const DeckLayoutSchema = z.enum(["cover", "content", "metrics", "split", "conclusion"]);

export type DeckFrontmatter = z.infer<typeof DeckFrontmatterSchema>;
export type DeckLayout = z.infer<typeof DeckLayoutSchema>;

export type DeckSlide = {
  layout: DeckLayout;
  eyebrow: string;
  source: string;
};

export type ParsedDeck = {
  frontmatter: DeckFrontmatter;
  slides: DeckSlide[];
};

export type DeckParseResult = {
  deck?: ParsedDeck;
  errors: string[];
};

export type DeckCompilation = {
  html?: string;
  slideCount: number;
  errors: string[];
};

const MAX_DECK_SOURCE_CHARS = 120_000;
const MAX_DECK_SLIDES = 40;
const chartTokenPattern = /\{\{\s*chart\(["'][a-z0-9_.-]+["']\)\s*\}\}/gi;

function formatZodIssues(error: z.ZodError) {
  return error.issues.map((issue) => {
    const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
}

function parseFrontmatter(source: string): { frontmatter?: DeckFrontmatter; body: string; errors: string[] } {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  if (lines[0]?.trim() !== "---") return { body: source, errors: ["Deck Markdown must start with frontmatter delimited by ---."] };
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closingIndex < 0) return { body: source, errors: ["Deck frontmatter is missing its closing --- delimiter."] };

  const value: Record<string, string> = {};
  const errors: string[] = [];
  lines.slice(1, closingIndex).forEach((line, index) => {
    if (!line.trim()) return;
    const separator = line.indexOf(":");
    if (separator <= 0) {
      errors.push(`Frontmatter line ${index + 2} must use key: value.`);
      return;
    }
    const key = line.slice(0, separator).trim();
    const entry = line.slice(separator + 1).trim();
    if (key in value) errors.push(`Duplicate frontmatter key: ${key}`);
    value[key] = entry;
  });
  if (errors.length) return { body: lines.slice(closingIndex + 1).join("\n"), errors };
  const parsed = DeckFrontmatterSchema.safeParse(value);
  return parsed.success
    ? { frontmatter: parsed.data, body: lines.slice(closingIndex + 1).join("\n"), errors: [] }
    : { body: lines.slice(closingIndex + 1).join("\n"), errors: formatZodIssues(parsed.error) };
}

function parseSlide(source: string, index: number): { slide?: DeckSlide; errors: string[] } {
  let body = source.trim();
  let layout: DeckLayout = "content";
  let eyebrow = "";
  const metadataPattern = /^\s*<!--\s*(layout|eyebrow)\s*:\s*([^]*?)\s*-->\s*/i;
  const seen = new Set<string>();
  while (metadataPattern.test(body)) {
    const match = body.match(metadataPattern);
    if (!match) break;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (seen.has(key)) return { errors: [`Slide ${index + 1} repeats ${key} metadata.`] };
    seen.add(key);
    if (key === "layout") {
      const parsedLayout = DeckLayoutSchema.safeParse(value);
      if (!parsedLayout.success) return { errors: [`Slide ${index + 1} has an unsupported layout: ${value}`] };
      layout = parsedLayout.data;
    } else {
      if (value.length > 100) return { errors: [`Slide ${index + 1} eyebrow exceeds 100 characters.`] };
      eyebrow = value;
    }
    body = body.slice(match[0].length);
  }
  if (!body.trim()) return { errors: [`Slide ${index + 1} is empty.`] };
  if (/(^|[^\\])<\/?[a-z][^>]*>/i.test(body)) return { errors: [`Slide ${index + 1} contains raw HTML; use Deck Markdown instead.`] };
  if (!/^#{1,2}\s+\S/m.test(body)) return { errors: [`Slide ${index + 1} needs a # or ## heading.`] };
  return { slide: { layout, eyebrow, source: body }, errors: [] };
}

export function parseDeckSource(source: string): DeckParseResult {
  if (!source.trim()) return { errors: ["Add Deck Markdown to create a presentation."] };
  if (source.length > MAX_DECK_SOURCE_CHARS) return { errors: ["Deck Markdown exceeds the 120,000-character limit."] };
  const frontmatter = parseFrontmatter(source);
  if (!frontmatter.frontmatter) return { errors: frontmatter.errors };
  const slideSources = frontmatter.body.split(/^\s*---\s*$/m).map((slide) => slide.trim()).filter(Boolean);
  if (!slideSources.length) return { errors: ["Add at least one slide after the frontmatter."] };
  if (slideSources.length > MAX_DECK_SLIDES) return { errors: [`Deck Markdown is limited to ${MAX_DECK_SLIDES} slides.`] };
  const slides: DeckSlide[] = [];
  const errors: string[] = [];
  slideSources.forEach((slideSource, index) => {
    const parsed = parseSlide(slideSource, index);
    if (parsed.slide) slides.push(parsed.slide);
    errors.push(...parsed.errors);
  });
  return errors.length ? { errors } : { deck: { frontmatter: frontmatter.frontmatter, slides }, errors: [] };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function compileInline(source: string) {
  const tokens: string[] = [];
  const protectedSource = source.replace(/\\([<>-])/g, "$1").replace(chartTokenPattern, (token) => {
    const placeholder = `RUNECHARTTOKEN${tokens.length}END`;
    tokens.push(token);
    return placeholder;
  });
  let html = escapeHtml(protectedSource)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  tokens.forEach((token, index) => {
    html = html.replace(`RUNECHARTTOKEN${index}END`, token);
  });
  return html;
}

function tableCells(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isTableDivider(line: string) {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function compileTable(lines: string[], layout: DeckLayout) {
  const headers = tableCells(lines[0]);
  const rows = lines.slice(2).map(tableCells).filter((row) => row.length === headers.length);
  if (layout === "metrics" && rows[0]) {
    return `<div class="metric-grid">${headers.map((header, index) => `<div class="metric"><strong>${compileInline(rows[0][index] ?? "")}</strong><span>${compileInline(header)}</span></div>`).join("")}</div>`;
  }
  return `<table><thead><tr>${headers.map((header) => `<th>${compileInline(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${compileInline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function compileBlocks(source: string, layout: DeckLayout) {
  const lines = source.split("\n");
  const blocks: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    const heading = line.match(/^(#{1,2})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length === 1 ? "h1" : "h2";
      blocks.push(`<${level}>${compileInline(heading[2])}</${level}>`);
      index += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }
      blocks.push(`<ul>${items.map((item) => `<li>${compileInline(item)}</li>`).join("")}</ul>`);
      continue;
    }
    if (line.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const tableLines = [lines[index], lines[index + 1]];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        tableLines.push(lines[index]);
        index += 1;
      }
      blocks.push(compileTable(tableLines, layout));
      continue;
    }
    if (chartTokenPattern.test(line)) {
      chartTokenPattern.lastIndex = 0;
      blocks.push(`<div class="chart-slot">${compileInline(line)}</div>`);
      index += 1;
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || /^(#{1,2})\s+/.test(next) || /^[-*]\s+/.test(next) || chartTokenPattern.test(next)) {
        chartTokenPattern.lastIndex = 0;
        break;
      }
      if (next.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) break;
      paragraph.push(next);
      index += 1;
    }
    blocks.push(`<p>${compileInline(paragraph.join(" "))}</p>`);
  }
  return blocks.join("\n");
}

function deckStyles() {
  return `
    :root{--ink:#18211c;--muted:#627068;--paper:#f4f1e8;--accent:#ff5c35;--line:#d8d4c8;--stage:#dad7cf}body.rune-dark{--ink:#f5f1e8;--muted:#a9b5ad;--paper:#17201b;--line:#344139;--stage:#0d120f}*{box-sizing:border-box}body{margin:0;background:var(--stage);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,sans-serif}.deck{display:grid;gap:32px;padding:32px}.slide{position:relative;width:min(1120px,100%);aspect-ratio:16/9;margin:auto;padding:8%;overflow:hidden;background:var(--paper);border-radius:10px;box-shadow:0 18px 50px rgba(24,33,28,.14)}.eyebrow{margin:0 0 20px;color:var(--accent);font-size:15px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}h1,h2{max-width:900px;margin:0;line-height:.98;letter-spacing:-.055em}h1{font-size:clamp(42px,6vw,82px)}h2{font-size:clamp(34px,4.2vw,64px)}p{max-width:720px;margin:28px 0 0;color:var(--muted);font-size:clamp(18px,2vw,28px);line-height:1.45}ul{display:grid;gap:14px;max-width:760px;margin:30px 0 0;padding-left:24px;color:var(--muted);font-size:clamp(17px,1.8vw,25px)}code{padding:2px 6px;border-radius:5px;background:rgba(98,112,104,.14);font-family:ui-monospace,monospace;font-size:.82em}.number{position:absolute;right:7%;bottom:6%;color:var(--muted);font-size:14px}.metric-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:42px}.metric{padding:26px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.38)}.metric strong{display:block;font-size:clamp(28px,4vw,54px);letter-spacing:-.05em}.metric span{color:var(--muted);font-size:14px}.split .slide-body{display:grid;grid-template-columns:1.05fr .95fr;gap:7%;align-items:center;height:calc(100% - 44px)}.split .chart-slot{grid-column:2;grid-row:1/span 4}.split .slide-body>h1,.split .slide-body>h2,.split .slide-body>p{grid-column:1}.chart-slot{margin-top:28px}.chart-slot .rune-embedded-chart{padding:18px}.conclusion{background:var(--ink);color:var(--paper)}.conclusion p{color:color-mix(in srgb,var(--paper) 68%,transparent)}table{width:100%;margin-top:26px;border-collapse:collapse;color:var(--muted);font-size:15px}th,td{padding:10px;border-bottom:1px solid var(--line);text-align:left}@media(max-width:700px){.slide{border-radius:4px}.metric-grid{gap:8px}.metric{padding:14px}.deck{padding:12px}.split .slide-body{gap:3%}}
  `;
}

export function compileDeckSource(source: string): DeckCompilation {
  const parsed = parseDeckSource(source);
  if (!parsed.deck) return { slideCount: 0, errors: parsed.errors };
  const total = parsed.deck.slides.length;
  const slides = parsed.deck.slides.map((slide, index) => {
    const number = String(index + 1).padStart(2, "0");
    const totalLabel = String(total).padStart(2, "0");
    return `<section class="slide ${slide.layout}" data-layout="${slide.layout}">
      ${slide.eyebrow ? `<p class="eyebrow">${escapeHtml(slide.eyebrow)}</p>` : ""}
      <div class="slide-body">${compileBlocks(slide.source, slide.layout)}</div>
      <span class="number">${number} / ${totalLabel}</span>
    </section>`;
  }).join("\n");
  const { frontmatter } = parsed.deck;
  return {
    html: `<!doctype html>
<html lang="${frontmatter.lang}">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(frontmatter.title)}</title><style>${deckStyles()}</style></head>
<body class="${frontmatter.theme === "rune-dark" ? "rune-dark" : ""}"><main class="deck" data-deck-title="${escapeHtml(frontmatter.title)}">${slides}</main></body>
</html>`,
    slideCount: total,
    errors: [],
  };
}

export function isDeckMarkdownArtifact(artifact: { name: string; language: string }) {
  return artifact.language === "Deck Markdown" || artifact.name.toLowerCase().endsWith(".deck.md");
}
