import assert from "node:assert/strict";
import test from "node:test";

import { exportDeckHtml, MAX_STANDALONE_HTML_BYTES } from "../app/lib/html-export.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";
import { defaultQuerySnapshot, defaultSummaryQuerySnapshot } from "./query-snapshot-fixture.mjs";

function defaultRuntimeSnapshots() {
  return [defaultQuerySnapshot(), defaultSummaryQuerySnapshot()];
}

function defaultDeck() {
  const deck = defaultArtifacts.find((artifact) => artifact.kind === "slides");
  assert.ok(deck);
  return deck;
}

test("exports a deterministic self-contained Deck HTML handoff", () => {
  const deck = defaultDeck();
  const sourceBefore = deck.source;
  const first = exportDeckHtml(deck, defaultArtifacts, defaultRuntimeSnapshots());
  const second = exportDeckHtml(deck, defaultArtifacts, defaultRuntimeSnapshots());
  assert.equal(first.targetType, "html");
  assert.equal(first.fileName, "board-briefing.html");
  assert.equal(first.mimeType, "text/html;charset=utf-8");
  assert.deepEqual(first.bytes, second.bytes);
  assert.ok(first.bytes.length < MAX_STANDALONE_HTML_BYTES);
  assert.equal(deck.source, sourceBefore);

  const html = new TextDecoder().decode(first.bytes);
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<meta name="generator" content="Rune" \/>/);
  assert.match(html, /data-deck-title="Q2 Board Briefing"/);
  assert.match(html, /\$4\.82M/);
  assert.match(html, /Q2 revenue by region/);
  assert.match(html, /class="rune-embedded-chart"/);
  assert.match(html, /APAC/);
  assert.match(html, /@page\{size:13\.333333in 7\.5in/);
  assert.equal((html.match(/<section class="slide /g) ?? []).length, 4);
  assert.match(html, /Gross margin by region/);
  assert.match(html, /39\.1%/);
  assert.doesNotMatch(html, /\{\{\s*(?:metric|chart)\(/i);
  assert.doesNotMatch(html, /<script\b|<(?:iframe|object|embed|link)\b|<[a-z][^>]*\s(?:src|href)\s*=/i);
  assert.match(first.warnings.join(" "), /scriptless file/i);
  assert.match(first.warnings.join(" "), /one 16:9 page per slide/i);
});

test("rejects unsupported or unresolved HTML export inputs", () => {
  const deck = defaultDeck();
  const document = defaultArtifacts.find((artifact) => artifact.kind === "document");
  assert.ok(document);
  assert.throws(() => exportDeckHtml(document, defaultArtifacts), /supports Deck Markdown presentations/i);
  assert.throws(
    () => exportDeckHtml({ ...deck, source: deck.source.replace('{{ metric("top_region") }}', '{{ metric("missing_metric") }}') }, defaultArtifacts),
    /missing metric reference/i,
  );
  assert.throws(
    () => exportDeckHtml(
      { ...deck, source: deck.source.replace("regional-revenue-chart", "missing-chart") },
      defaultArtifacts,
      defaultRuntimeSnapshots(),
    ),
    /missing chart reference/i,
  );
});

test("sanitizes portable HTML filenames and hostile deck metadata", () => {
  const deck = {
    ...defaultDeck(),
    name: "CON.deck.md",
    source: defaultDeck().source
      .replace("title: Q2 Board Briefing", "title: <script>alert & review</script>")
      .replace("Q2 · Board Briefing", "<img src=x onerror=alert(1)>")
      .replace(/\{\{ chart\("regional-revenue-chart"\) \}\}/g, "Chart intentionally removed"),
  };
  const result = exportDeckHtml(deck, defaultArtifacts, defaultRuntimeSnapshots());
  assert.equal(result.fileName, "rune-CON.html");
  const html = new TextDecoder().decode(result.bytes);
  assert.doesNotMatch(html, /<script>|<img/i);
  assert.match(html, /&lt;script&gt;alert &amp; review&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("caps standalone HTML after workspace charts are expanded", () => {
  const longLabel = "x".repeat(105_000);
  const rows = Array.from({ length: 20 }, (_, index) => `${index}-${longLabel},${index + 1}`).join("\n");
  const data = { id: "large-html-data", name: "large.csv", kind: "data", language: "CSV", source: `Label,Value\n${rows}\n` };
  const chart = {
    id: "large-html-chart",
    name: "large.chart.json",
    kind: "chart",
    language: "Chart JSON",
    source: JSON.stringify({ version: 1, title: "Large chart", description: "", source: data.id, mark: "bar", category: "Label", value: "Value", sort: "source", format: "number", color: "#ff5c35", maxItems: 20 }),
  };
  const deck = {
    id: "large-html-deck",
    name: "large.deck.md",
    kind: "slides",
    language: "Deck Markdown",
    source: `---
version: 1
title: Large export
theme: rune
ratio: 16:9
lang: en
---

# Large chart

{{ chart("large-html-chart") }}
`,
  };
  assert.throws(() => exportDeckHtml(deck, [deck, data, chart]), /exceeds Rune's 2 MB export limit/i);
});

test("exports a scriptless line chart with deterministic SVG geometry", () => {
  const data = { id: "trend-data", name: "trend.csv", kind: "data", language: "CSV / JSON", source: "Month,Value\nJan,10\nFeb,30\nMar,20\n" };
  const chart = {
    id: "trend-chart",
    name: "trend.chart.json",
    kind: "chart",
    language: "Chart JSON",
    source: JSON.stringify({ version: 1, title: "Monthly trend", description: "", source: data.id, mark: "line", category: "Month", value: "Value", sort: "source", format: "number", color: "#3676d1", maxItems: 8 }),
  };
  const deck = {
    id: "trend-deck",
    name: "trend.deck.md",
    kind: "slides",
    language: "Deck Markdown",
    source: `---
version: 1
title: Trend export
theme: rune
ratio: 16:9
lang: en
---

# Trend

{{ chart("trend-chart") }}
`,
  };
  const first = exportDeckHtml(deck, [deck, data, chart]);
  const second = exportDeckHtml(deck, [deck, data, chart]);
  assert.deepEqual(first.bytes, second.bytes);
  const html = new TextDecoder().decode(first.bytes);
  assert.match(html, /rune-line-chart/);
  assert.match(html, /<polyline class="rune-line-series"/);
  assert.equal((html.match(/<circle /g) ?? []).length, 3);
  assert.match(html, /Jan: 10/);
  assert.doesNotMatch(html, /<script\b/i);
});
