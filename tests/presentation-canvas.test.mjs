import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { compileDeckSource } from "../app/lib/deck.ts";
import { compileLegacyHtmlSlides } from "../app/lib/legacy-html-slides.ts";
import {
  PRESENTATION_CANVAS_HEIGHT,
  PRESENTATION_CANVAS_WIDTH,
  presentationCanvasTransform,
} from "../app/lib/presentation-canvas.ts";
import { deckSourceFixture } from "./deck-fixture.mjs";

test("fits one fixed 1120 by 630 presentation canvas without changing its internal layout", () => {
  assert.equal(PRESENTATION_CANVAS_WIDTH, 1120);
  assert.equal(PRESENTATION_CANVAS_HEIGHT, 630);
  assert.deepEqual(presentationCanvasTransform(1120, 630), { offsetX: 0, offsetY: 0, scale: 1 });
  assert.deepEqual(presentationCanvasTransform(560, 315), { offsetX: 0, offsetY: 0, scale: 0.5 });
  assert.deepEqual(presentationCanvasTransform(700, 315), { offsetX: 70, offsetY: 0, scale: 0.5 });
  assert.deepEqual(presentationCanvasTransform(0, 315), { offsetX: 0, offsetY: 0, scale: 0 });
});

test("isolated Deck and semantic HTML previews declare the fixed canvas contract", () => {
  const deck = compileDeckSource(deckSourceFixture);
  assert.deepEqual(deck.errors, []);
  assert.doesNotMatch(deck.html ?? "", /data-rune-preview-canvas/u);
  for (const slide of deck.previewSlides ?? []) {
    assert.match(slide.html, /data-rune-preview-canvas="1120x630"/u);
    assert.match(slide.html, /width:1120px!important;height:630px!important/u);
    assert.match(slide.html, /<meta name="viewport" content="width=1120,initial-scale=1"/u);
  }

  const semantic = compileLegacyHtmlSlides(
    "<main><section><h1>Stable layout</h1><table><tr><td>Proof</td></tr></table></section></main>",
  );
  assert.deepEqual(semantic.errors, []);
  assert.match(semantic.slides[0].html, /data-rune-preview-canvas="1120x630"/u);
  assert.match(semantic.slides[0].html, /body>main>section\{width:1120px!important;height:630px!important/u);
});

test("the host frame observes its viewport and scales a fixed-size iframe", async () => {
  const component = await readFile(new URL("../app/components/presentation-frame.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(component, /new ResizeObserver\(fitCanvas\)/u);
  assert.match(component, /data-presentation-canvas/u);
  assert.match(component, /height=\{PRESENTATION_CANVAS_HEIGHT\}/u);
  assert.match(component, /width=\{PRESENTATION_CANVAS_WIDTH\}/u);
  assert.match(styles, /\.presentation-frame-viewport > iframe\.presentation-frame/u);
  assert.match(styles, /transform:[^;]*scale\(var\(--presentation-frame-scale\)\)/u);
});
