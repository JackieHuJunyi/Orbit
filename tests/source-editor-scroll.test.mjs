import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { sourceEditorPresentation, sourceSelectionScrollTop } from "../app/lib/source-editor-scroll.ts";

const source = Array.from({ length: 100 }, (_, index) => `line ${index + 1}`).join("\n");

test("centers a preview-selected canonical range in the unwrapped source editor", () => {
  const start = source.indexOf("line 51");
  const top = sourceSelectionScrollTop({
    source,
    start,
    end: start + 7,
    lineHeight: 20,
    viewportHeight: 200,
    scrollHeight: 2_000,
  });
  assert.equal(top, 910);
});

test("clamps first and last source targets and handles a non-scrollable editor", () => {
  assert.equal(
    sourceSelectionScrollTop({
      source,
      start: 0,
      end: 6,
      lineHeight: 20,
      viewportHeight: 200,
      scrollHeight: 2_000,
    }),
    0,
  );
  assert.equal(
    sourceSelectionScrollTop({
      source,
      start: source.length - 7,
      end: source.length,
      lineHeight: 20,
      viewportHeight: 200,
      scrollHeight: 2_000,
    }),
    1_800,
  );
  assert.equal(
    sourceSelectionScrollTop({
      source,
      start: 10,
      end: 20,
      lineHeight: 20,
      viewportHeight: 300,
      scrollHeight: 300,
    }),
    0,
  );
  assert.equal(sourceEditorPresentation("a\nb").lineNumbers, "1\n2");
  assert.deepEqual(sourceEditorPresentation("x".repeat(250_001)), { large: true, lineNumbers: "" });
});

test("workbench applies preview selection, source scrolling, and gutter synchronization together", async () => {
  const workbench = await readFile(new URL("../app/components/orbit-workbench.tsx", import.meta.url), "utf8");
  const previewScroll = await readFile(
    new URL("../app/components/use-source-preview-scroll.ts", import.meta.url),
    "utf8",
  );
  assert.match(workbench, /sourceSelectionScrollTop\(\{/);
  assert.match(workbench, /editor\.scrollTo\(\{[\s\S]*behavior:[\s\S]*prefers-reduced-motion/);
  assert.match(workbench, /gutterRef\.current\.scrollTop = nextScrollTop/);
  assert.match(workbench, /useSourcePreviewScroll\(\{/);
  assert.match(previewScroll, /selectPreviewNavigationCandidate\([\s\S]*previewSourcePrimary === "true"/);
  assert.match(previewScroll, /block: repeatedTarget \? "nearest" : "center"/);
  assert.match(previewScroll, /cursorEnd,[\s\S]*cursorStart/);
  assert.match(workbench, /wrap="off"/);
});

test("Deck preview exposes every slide in one continuous source-linked flow", async () => {
  const preview = await readFile(new URL("../app/components/artifact-previews.tsx", import.meta.url), "utf8");
  const content = await readFile(new URL("../app/styles/content.css", import.meta.url), "utf8");
  assert.match(preview, /deckCompilation\?\.previewSlides/);
  assert.match(preview, /renderedPreviewSlides\.map\(\(slide, slideIndex\)/);
  assert.match(preview, /className="deck-slide-flow"/);
  assert.match(preview, /scrollToSlide\(targetIndex\)/);
  assert.match(preview, /data-deck-slide-index=\{slideIndex\}/);
  assert.match(preview, /className="deck-slide-source-hit"/);
  assert.match(preview, /data-preview-source-primary="true"/);
  assert.match(preview, /onClick=\{\(\) => onTargetSource\(artifact, target\)\}/);
  assert.match(preview, /loading=\{directEditable \? "eager" : "lazy"\}/);
  assert.doesNotMatch(preview, /visibleSlideIndex/);
  assert.match(content, /\.deck-slide-flow\s*\{[^}]*display:\s*grid[^}]*gap:/s);
  assert.match(content, /\.deck-slide-flow \.deck-slide-canvas\s*\{[^}]*aspect-ratio:\s*16 \/ 9[^}]*flex:\s*none/s);
});
