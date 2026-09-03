import assert from "node:assert/strict";
import test from "node:test";

import { compileLegacyHtmlSlides } from "../app/lib/legacy-html-slides.ts";
import {
  appendSemanticHtmlPresentationSlide,
  insertSemanticHtmlPresentationSlideAfter,
  replaceSemanticHtmlPresentationSlide,
  semanticHtmlPresentationFromDeckSource,
  semanticHtmlPresentationMetadata,
  semanticHtmlPresentationStarter,
} from "../app/lib/semantic-html-presentation.ts";

const deck = `---
version: 1
title: Live review
theme: orbit-dark
ratio: 16:9
lang: zh-CN
origin: review.md
origin_revision: r1-a-aaaaaaaaaaaaaaaa
audience: leadership
purpose: decide
---

<!-- layout: cover -->

# Live review

{{ metric("review-query", "revenue", "currency") }}

---

<!-- layout: split -->

## Evidence

{{ chart("review-chart") }}
`;

test("turns strict Deck input into proven semantic HTML with raw bindings and portable metadata", () => {
  const result = semanticHtmlPresentationFromDeckSource(deck);
  assert.deepEqual(result.errors, []);
  assert.ok(result.source);
  assert.match(result.source, /^<!doctype html>/);
  assert.match(result.source, /data-orbit-format="presentation-v1"/);
  assert.match(result.source, /\{\{ metric\("review-query", "revenue", "currency"\) \}\}/);
  assert.match(result.source, /\{\{ chart\("review-chart"\) \}\}/);
  assert.doesNotMatch(result.source, /metric\(&quot;/);
  assert.deepEqual(semanticHtmlPresentationMetadata(result.source), {
    title: "Live review",
    theme: "orbit-dark",
    lang: "zh-CN",
    origin: "review.md",
    originRevision: "r1-a-aaaaaaaaaaaaaaaa",
    audience: "leadership",
    purpose: "decide",
  });
  assert.equal(compileLegacyHtmlSlides(result.source).slides.length, 2);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.errors), true);
});

test("creates one complete semantic HTML cover without exposing the internal Deck compiler", () => {
  const result = semanticHtmlPresentationStarter("Board narrative", "ja");
  assert.deepEqual(result.errors, []);
  assert.ok(result.source);
  assert.equal(compileLegacyHtmlSlides(result.source).slides.length, 1);
  assert.deepEqual(semanticHtmlPresentationMetadata(result.source), {
    title: "Board narrative",
    theme: "orbit",
    lang: "ja",
  });
  assert.doesNotMatch(result.source, /^---/);
});

test("replaces and inserts exact compiled slide ranges while retaining the complete document", () => {
  const starter = semanticHtmlPresentationStarter("Board narrative").source;
  assert.ok(starter);
  const replaced = replaceSemanticHtmlPresentationSlide(
    starter,
    0,
    '<section class="slide cover" data-layout="cover"><div class="slide-body"><h1>Launch decision</h1><p>Review the evidence.</p></div></section>',
  );
  assert.deepEqual(replaced.errors, []);
  assert.ok(replaced.source);
  assert.match(replaced.source, /<title>Board narrative<\/title>/);
  assert.match(replaced.source, /<h1>Launch decision<\/h1>/);
  assert.doesNotMatch(replaced.source, /<h1>Board narrative<\/h1>/);

  const inserted = insertSemanticHtmlPresentationSlideAfter(
    replaced.source,
    0,
    '<section class="slide conclusion" data-layout="conclusion"><div class="slide-body"><h2>Decision</h2><p>{{ metric("review-query", "revenue", "currency") }}</p></div></section>',
  );
  assert.deepEqual(inserted.errors, []);
  assert.ok(inserted.source);
  const compiled = compileLegacyHtmlSlides(inserted.source);
  assert.equal(compiled.slides.length, 2);
  assert.match(compiled.slides[0].source, /data-slide-index="0"/);
  assert.match(compiled.slides[0].source, /<span class="number">01 \/ 02<\/span>/);
  assert.match(compiled.slides[1].source, /data-slide-index="1"/);
  assert.match(compiled.slides[1].source, /<span class="number">02 \/ 02<\/span>/);
  assert.match(compiled.slides[1].source, /\{\{ metric\("review-query"/);
  assert.equal(semanticHtmlPresentationMetadata(inserted.source)?.title, "Board narrative");
});

test("appends before the compiler-proven main close even when raw text and comments contain close-like text", () => {
  const source = `<!doctype html><html lang="en"><head><style>.label::after{content:"</main>"}</style></head><body><main data-orbit-format="presentation-v1" data-orbit-title="Safe" data-orbit-theme="orbit" data-orbit-lang="en"><!-- </main> --><section><h1>Safe</h1></section></main></body></html>`;
  const result = appendSemanticHtmlPresentationSlide(source, "<section><h2>Next</h2></section>");
  assert.deepEqual(result.errors, []);
  assert.ok(result.source);
  assert.match(result.source, /content:"<\/main>"/);
  const compiled = compileLegacyHtmlSlides(result.source);
  assert.equal(compiled.slides.length, 2);
  assert.match(compiled.slides[0].source, /data-slide-index="0"/);
  assert.match(compiled.slides[0].source, /<span class="number">01 \/ 02<\/span>/);
  assert.match(compiled.slides[1].source, /data-slide-index="1"/);
  assert.match(compiled.slides[1].source, /<span class="number">02 \/ 02<\/span>/);
  assert.ok(result.source.lastIndexOf("<section><h2>Next") < result.source.lastIndexOf("</main>"));
});

test("fails closed for scripts, wrappers, invalid indices, no-ops, and invalid lineage metadata", () => {
  const source = semanticHtmlPresentationStarter("Safe").source;
  assert.ok(source);
  assert.match(
    replaceSemanticHtmlPresentationSlide(source, 0, "<section><script>alert(1)</script></section>").errors.join(" "),
    /script/i,
  );
  assert.match(
    insertSemanticHtmlPresentationSlideAfter(
      source,
      0,
      "<section><h2>One</h2></section><section><h2>Two</h2></section>",
    ).errors.join(" "),
    /exactly one/i,
  );
  assert.match(
    replaceSemanticHtmlPresentationSlide(source, 4, "<section><h2>No</h2></section>").errors.join(" "),
    /index/i,
  );
  const first = compileLegacyHtmlSlides(source).slides[0];
  assert.match(replaceSemanticHtmlPresentationSlide(source, 0, first.source).errors.join(" "), /does not change/i);

  const invalidRevision = source.replace(
    'data-orbit-lang="en"',
    'data-orbit-lang="en" data-orbit-origin="brief.md" data-orbit-origin-revision="not-a-revision"',
  );
  assert.equal(semanticHtmlPresentationMetadata(invalidRevision), null);
});
