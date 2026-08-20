import assert from "node:assert/strict";
import test from "node:test";

import { compileDeckSource, parseDeckSource } from "../app/lib/deck.ts";
import { convertSemanticHtmlPresentationToDeck } from "../app/lib/semantic-html-presentation-export.ts";

function semanticHtmlArtifact(source) {
  return {
    id: "semantic-html",
    name: "季度简报.html",
    kind: "slides",
    language: "Semantic HTML",
    source,
  };
}

test("converts bounded semantic HTML into immutable valid Deck handoff source", () => {
  const source = `<!doctype html>
<html lang="zh-Hant">
<head><style>.cover { color: red; }</style></head>
<body><main>
  <section data-layout="cover" data-eyebrow="Q2 &amp; board">
    <h1>收入 <em>&amp;</em> 计划 [now] #1</h1>
    <p>增长 <strong>20%</strong><br>数据留在设备上。</p>
    <ol><li>先验证</li><li>再交付</li></ol>
  </section>
  <section data-layout="conclusion">
    <h2>决定</h2>
    <table><tr><th>区域</th><th>收入</th></tr><tr><td>APAC</td><td>42</td></tr></table>
    <img src="https://example.com/not-exported.png" alt="External image">
  </section>
</main></body></html>`;
  const artifact = semanticHtmlArtifact(source);
  const snapshot = structuredClone(artifact);

  const first = convertSemanticHtmlPresentationToDeck(artifact);
  const second = convertSemanticHtmlPresentationToDeck(artifact);

  assert.deepEqual(first, second);
  assert.deepEqual(artifact, snapshot);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.artifact), true);
  assert.equal(Object.isFrozen(first.warnings), true);
  assert.equal(first.artifact.name, "季度简报.deck.md");
  assert.equal(first.artifact.language, "Deck Markdown");
  assert.match(first.artifact.source, /lang: zh-TW/u);
  assert.match(first.artifact.source, /<!-- layout: cover -->/u);
  assert.match(first.artifact.source, /<!-- eyebrow: Q2 & board -->/u);
  assert.ok(first.artifact.source.includes("# 收入 & 计划 \\[now\\] \\#1"));
  assert.match(first.artifact.source, /- 1\. 先验证\n- 2\. 再交付/u);
  assert.match(first.artifact.source, /\| 区域 \| 收入 \|\n\| --- \| --- \|\n\| APAC \| 42 \|/u);
  assert.doesNotMatch(first.artifact.source, /style|example\.com|<img/iu);
  assert.match(first.warnings.join(" "), /CSS, exact positioning, animation/iu);
  assert.match(first.warnings.join(" "), /Images and video/iu);

  const parsed = parseDeckSource(first.artifact.source);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.deck?.slides.length, 2);
  const compiled = compileDeckSource(first.artifact.source);
  assert.deepEqual(compiled.errors, []);
  assert.match(compiled.html ?? "", /收入 &amp; 计划 \[now\] #1/u);
  assert.doesNotMatch(compiled.html ?? "", /\\\[now|\\#1/u);
});

test("falls back visibly for unsupported layouts and irregular tables", () => {
  const artifact = semanticHtmlArtifact(`<main>
    <section data-layout="orbit"><h1>Opening</h1></section>
    <section><h2>Rows</h2><table><tr><td>A|B</td><td>C</td></tr><tr><td>D</td></tr></table></section>
  </main>`);
  const result = convertSemanticHtmlPresentationToDeck(artifact);

  assert.match(result.artifact.source, /<!-- layout: cover -->/u);
  assert.ok(result.artifact.source.includes("- A|B · C\n- D"));
  assert.match(result.warnings.join(" "), /Unsupported semantic HTML data-layout/iu);
  assert.match(result.warnings.join(" "), /flattened into readable row bullets/iu);
  assert.deepEqual(parseDeckSource(result.artifact.source).errors, []);
});

test("refuses non-semantic, malformed, scripted, or oversized presentation input", () => {
  assert.throws(
    () =>
      convertSemanticHtmlPresentationToDeck({
        ...semanticHtmlArtifact("<main><section><h1>Deck</h1></section></main>"),
        language: "Deck Markdown",
      }),
    /requires one Semantic HTML Slides artifact/iu,
  );
  assert.throws(
    () => convertSemanticHtmlPresentationToDeck(semanticHtmlArtifact("<main><section>Broken</main>")),
    /closes <main>/iu,
  );
  assert.throws(
    () =>
      convertSemanticHtmlPresentationToDeck(
        semanticHtmlArtifact("<main><section><h1>Unsafe</h1><script>alert(1)</script></section></main>"),
      ),
    /Scripts are blocked/iu,
  );
  assert.throws(
    () =>
      convertSemanticHtmlPresentationToDeck(
        semanticHtmlArtifact(`<main><section><h1>Large</h1>${"x".repeat(120_000)}</section></main>`),
      ),
    /120,000-character limit/iu,
  );
});
