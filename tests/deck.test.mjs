import assert from "node:assert/strict";
import test from "node:test";

import { renderChartReferencesToHtml, resolveChartModel } from "../app/lib/charts.ts";
import { compileDeckSource, isDeckMarkdownArtifact, parseDeckSource } from "../app/lib/deck.ts";
import { compileArtifactSource } from "../app/lib/bindings.ts";
import { defaultArtifacts, detectArtifact, parseDataSource, planLocalChange, validateArtifact } from "../app/lib/workspace.ts";

function deckArtifact() {
  const artifact = defaultArtifacts.find((item) => item.kind === "slides");
  assert.ok(artifact);
  assert.equal(isDeckMarkdownArtifact(artifact), true);
  return artifact;
}

test("parses the bounded Deck Markdown grammar", () => {
  const parsed = parseDeckSource(deckArtifact().source);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.deck?.frontmatter.version, 1);
  assert.equal(parsed.deck?.frontmatter.title, "Q2 Board Briefing");
  assert.equal(parsed.deck?.slides.length, 3);
  assert.deepEqual(parsed.deck?.slides.map((slide) => slide.layout), ["cover", "metrics", "split"]);
  assert.equal(detectArtifact("briefing.deck.md", deckArtifact().source)?.kind, "slides");
  assert.equal(detectArtifact("briefing.deck.md", deckArtifact().source)?.language, "Deck Markdown");
});

test("compiles metrics, numbering, and a shared chart into static deck HTML", () => {
  const compiledBindings = compileArtifactSource(deckArtifact().source, defaultArtifacts);
  const deck = compileDeckSource(compiledBindings.source);
  assert.deepEqual(deck.errors, []);
  assert.equal(deck.slideCount, 3);
  assert.match(deck.html ?? "", /\$4\.82M/);
  assert.match(deck.html ?? "", /01 \/ 03/);
  assert.match(deck.html ?? "", /03 \/ 03/);
  assert.match(deck.html ?? "", /\{\{\s*chart\("regional-revenue-chart"\)/);

  const runtime = renderChartReferencesToHtml(deck.html ?? "", (id) => {
    const chart = defaultArtifacts.find((artifact) => artifact.id === id);
    return chart ? resolveChartModel(chart, defaultArtifacts, parseDataSource) : { errors: ["Missing chart"] };
  });
  assert.doesNotMatch(runtime, /\{\{\s*chart/);
  assert.match(runtime, /rune-embedded-chart/);
  assert.doesNotMatch(runtime, /<script/i);
});

test("rejects raw HTML and unsupported layout metadata", () => {
  const rawHtml = deckArtifact().source.replace("# Growth became more durable.", "# Growth\n\n<script>alert(1)</script>");
  assert.match(parseDeckSource(rawHtml).errors.join(" "), /raw HTML/);
  const badLayout = deckArtifact().source.replace("layout: cover", "layout: freeform");
  assert.match(parseDeckSource(badLayout).errors.join(" "), /unsupported layout/);
  const futureVersion = deckArtifact().source.replace("version: 1", "version: 2");
  assert.match(parseDeckSource(futureVersion).errors.join(" "), /version/);
});

test("escapes frontmatter and eyebrow text in compiled HTML", () => {
  const source = deckArtifact().source
    .replace("title: Q2 Board Briefing", "title: <img src=x>")
    .replace("Q2 · Board Briefing", "<img src=x>");
  const compiled = compileDeckSource(source);
  assert.deepEqual(compiled.errors, []);
  assert.doesNotMatch(compiled.html ?? "", /<img src=x>/);
  assert.match(compiled.html ?? "", /&lt;img src=x&gt;/);
});

test("keeps legacy semantic HTML decks valid", () => {
  const legacy = {
    id: "legacy-deck",
    name: "legacy.html",
    kind: "slides",
    language: "Semantic HTML",
    source: "<!doctype html><main><section><h1>Legacy</h1></section></main>",
  };
  assert.deepEqual(validateArtifact(legacy), []);
  assert.equal(isDeckMarkdownArtifact(legacy), false);
});

test("plans theme and conclusion changes in Deck Markdown source", () => {
  const deck = deckArtifact();
  const dark = planLocalChange(deck, "把主题改成深色");
  assert.match(dark.nextSource, /^theme: rune-dark$/m);
  assert.deepEqual(validateArtifact({ ...deck, source: dark.nextSource }), []);

  const conclusion = planLocalChange(deck, "新增一页结论");
  assert.match(conclusion.nextSource, /layout: conclusion/);
  assert.equal(compileDeckSource(conclusion.nextSource).slideCount, 4);
  const refreshed = planLocalChange({ ...deck, source: conclusion.nextSource }, "新增一页结论");
  assert.equal((refreshed.nextSource.match(/layout: conclusion/g) ?? []).length, 1);
  assert.equal(compileDeckSource(refreshed.nextSource).slideCount, 4);
});
