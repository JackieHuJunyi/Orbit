import assert from "node:assert/strict";
import test from "node:test";

import { compileLegacyHtmlSlides } from "../app/lib/legacy-html-slides.ts";

test("compiles only outer semantic slide sections into isolated source-linked documents", () => {
  const source = `<!doctype html>
<html lang="zh-CN">
<head>
  <title>季度 &amp; 计划</title>
  <style>
    main { display: grid; }
    section::after { content: "<section>not a slide</section>"; }
  </style>
</head>
<body>
  <!-- <section>not a slide</section> -->
  <main class="presentation" data-label="A > B">
    <section class="cover" data-title="Q2 > Q1">
      <h1>季度 <em>复盘</em> &amp; 计划</h1>
      <section aria-label="nested support">Nested support</section>
    </section>
    <section class="decision">
      <h2>Ship now</h2>
      <p>One action.</p>
    </section>
  </main>
</body>
</html>`;
  const snapshot = `${source}`;

  const compilation = compileLegacyHtmlSlides(source);

  assert.deepEqual(compilation.errors, []);
  assert.equal(compilation.slides.length, 2);
  assert.deepEqual(
    compilation.slides.map((slide) => slide.label),
    ["季度 复盘 & 计划", "Ship now"],
  );
  assert.equal(compilation.slides[0].source, source.slice(compilation.slides[0].start, compilation.slides[0].end));
  assert.match(compilation.slides[0].source, /^<section class="cover"/);
  assert.match(compilation.slides[0].source, /Nested support/);
  assert.doesNotMatch(compilation.slides[0].source, /Ship now/);
  assert.match(compilation.slides[1].source, /^<section class="decision"/);

  for (const slide of compilation.slides) {
    assert.match(slide.html, /Content-Security-Policy/);
    assert.match(slide.html, /<html lang="zh-CN">/);
    assert.match(slide.html, /<main class="presentation" data-label="A > B">/);
    assert.match(slide.html, /section::after/);
    assert.equal(slide.html.includes('class="cover"'), slide.index === 0);
    assert.equal(slide.html.includes('class="decision"'), slide.index === 1);
  }
  assert.doesNotMatch(compilation.slides[0].html, /Ship now/);
  assert.doesNotMatch(compilation.slides[1].html, /季度 <em>/);
  assert.equal(source, snapshot);
  assert.equal(Object.isFrozen(compilation), true);
  assert.equal(Object.isFrozen(compilation.slides), true);
  assert.equal(Object.isFrozen(compilation.slides[0]), true);
});

test("uses bounded fallback labels without changing exact source ranges", () => {
  const longLabel = "A".repeat(80);
  const source = `<main><section><p>No heading</p></section><section><h2>${longLabel}</h2></section></main>`;
  const compilation = compileLegacyHtmlSlides(source);

  assert.deepEqual(compilation.errors, []);
  assert.equal(compilation.slides[0].label, "Slide 1");
  assert.equal(compilation.slides[1].label, `${"A".repeat(69)}…`);
  assert.equal(source.slice(compilation.slides[1].start, compilation.slides[1].end), compilation.slides[1].source);
});

test("resolves only verified local image references in isolated slide HTML", () => {
  const id = "a".repeat(64);
  const source = `<main><section><h1>Proof</h1><img src="orbit-asset:sha256:${id}" alt="Proof" /></section></main>`;
  const resolved = compileLegacyHtmlSlides(source, {
    resolveLocalAssetUrl: () => "blob:https://orbit.local/proof",
  });
  assert.deepEqual(resolved.errors, []);
  assert.match(resolved.slides[0].html, /src="blob:https:\/\/orbit\.local\/proof"/u);
  assert.match(resolved.slides[0].source, new RegExp(`orbit-asset:sha256:${id}`, "u"));
  assert.equal(
    source,
    `<main><section><h1>Proof</h1><img src="orbit-asset:sha256:${id}" alt="Proof" /></section></main>`,
  );
});

test("rejects active scripts and malformed semantic presentation roots", () => {
  const invalidSources = [
    ["<main><section>One<script>alert(1)</script></section></main>", /Scripts are blocked/],
    ["<!-- unclosed", /unclosed comment/],
    ["<main data-label='unclosed><section>One</section></main>", /unclosed tag/],
    ["<section>One</section>", /need a <main>/i],
    ["<main></main>", /at least one <section>/i],
    ["<main><section /></main>", /cannot be self-closing/i],
    ["<main></section></main>", /unmatched <\/section>/i],
    ["<main><section>One</main>", /closes <main>/i],
    ["<main><section>One</section>", /unclosed <main>/i],
    ["<main><section>One</section></main><main><section>Two</section></main>", /exactly one <main>/i],
  ];

  for (const [source, error] of invalidSources) {
    const compilation = compileLegacyHtmlSlides(source);
    assert.equal(compilation.slides.length, 0, source);
    assert.match(compilation.errors[0], error, source);
  }
});

test("enforces bounded semantic HTML input and slide counts", () => {
  const tooManySlides = `<main>${Array.from({ length: 41 }, (_, index) => `<section>${index}</section>`).join("")}</main>`;
  const oversized = `<main><section>${"x".repeat(120_000)}</section></main>`;

  assert.match(compileLegacyHtmlSlides(tooManySlides).errors[0], /limited to 40 slides/);
  assert.match(compileLegacyHtmlSlides(oversized).errors[0], /120,000-character limit/);
  assert.match(compileLegacyHtmlSlides("  ").errors[0], /Add semantic HTML/);
});
