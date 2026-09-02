import assert from "node:assert/strict";
import test from "node:test";

import { applyDocumentFormatting } from "../app/lib/document-formatting.ts";

test("adds and removes reversible inline Markdown formatting", () => {
  const bold = applyDocumentFormatting("Ship the plan.", "bold", 9, 13);
  assert.deepEqual(bold, {
    draft: "Ship the **plan**.",
    selectionStart: 11,
    selectionEnd: 15,
    error: null,
  });
  assert.deepEqual(applyDocumentFormatting(bold.draft, "bold", bold.selectionStart, bold.selectionEnd), {
    draft: "Ship the plan.",
    selectionStart: 9,
    selectionEnd: 13,
    error: null,
  });

  const emptyItalic = applyDocumentFormatting("Note", "italic", 4, 4);
  assert.equal(emptyItalic.draft, "Note__");
  assert.equal(emptyItalic.selectionStart, 5);
  assert.equal(emptyItalic.selectionEnd, 5);
  assert.equal(applyDocumentFormatting("Note__", "italic", 5, 5).draft, "Note");
});

test("uses a collision-safe backtick delimiter and toggles code spans", () => {
  const formatted = applyDocumentFormatting("Use a`b now", "code", 4, 7);
  assert.equal(formatted.draft, "Use ``a`b`` now");
  assert.deepEqual([formatted.selectionStart, formatted.selectionEnd], [6, 9]);
  const restored = applyDocumentFormatting(formatted.draft, "code", formatted.selectionStart, formatted.selectionEnd);
  assert.equal(restored.draft, "Use a`b now");
  assert.deepEqual([restored.selectionStart, restored.selectionEnd], [4, 7]);

  const backticksOnly = applyDocumentFormatting("``", "code", 0, 2);
  assert.equal(backticksOnly.draft, "`".repeat(8));
  assert.deepEqual([backticksOnly.selectionStart, backticksOnly.selectionEnd], [3, 5]);
});

test("creates editable links, removes complete links, and rejects multiline labels", () => {
  const source = "Read Orbit";
  const linked = applyDocumentFormatting(source, "link", 5, source.length);
  assert.equal(linked.draft, "Read [Orbit](https://)");
  assert.equal(linked.draft.slice(linked.selectionStart, linked.selectionEnd), "https://");
  assert.equal(linked.error, null);

  const unlinked = applyDocumentFormatting(linked.draft, "link", 5, linked.draft.length);
  assert.equal(unlinked.draft, source);
  assert.deepEqual([unlinked.selectionStart, unlinked.selectionEnd], [5, source.length]);

  const invalid = applyDocumentFormatting("first\nsecond", "link", 0, 12);
  assert.equal(invalid.draft, "first\nsecond");
  assert.match(invalid.error ?? "", /one line/u);
});

test("switches and removes list markers while preserving the selected content", () => {
  const bullets = applyDocumentFormatting("Alpha\nBeta\nAfter", "bullet-list", 0, 10);
  assert.equal(bullets.draft, "- Alpha\n- Beta\nAfter");
  assert.deepEqual([bullets.selectionStart, bullets.selectionEnd], [2, 14]);

  const numbered = applyDocumentFormatting(
    bullets.draft,
    "numbered-list",
    bullets.selectionStart,
    bullets.selectionEnd,
  );
  assert.equal(numbered.draft, "1. Alpha\n2. Beta\nAfter");
  assert.deepEqual([numbered.selectionStart, numbered.selectionEnd], [3, 16]);

  const plain = applyDocumentFormatting(
    numbered.draft,
    "numbered-list",
    numbered.selectionStart,
    numbered.selectionEnd,
  );
  assert.equal(plain.draft, "Alpha\nBeta\nAfter");
  assert.deepEqual([plain.selectionStart, plain.selectionEnd], [0, 10]);
});

test("formats the current empty line and maps a collapsed caret after its marker", () => {
  const bullet = applyDocumentFormatting("Before\n\nAfter", "bullet-list", 7, 7);
  assert.equal(bullet.draft, "Before\n- \nAfter");
  assert.deepEqual([bullet.selectionStart, bullet.selectionEnd], [9, 9]);

  const quote = applyDocumentFormatting("  Decision", "quote", 2, 2);
  assert.equal(quote.draft, "  > Decision");
  assert.deepEqual([quote.selectionStart, quote.selectionEnd], [4, 4]);
});

test("normalizes reversed and out-of-range textarea selections", () => {
  const formatted = applyDocumentFormatting("Orbit", "strikethrough", 99, -4);
  assert.equal(formatted.draft, "~~Orbit~~");
  assert.deepEqual([formatted.selectionStart, formatted.selectionEnd], [2, 7]);
});
