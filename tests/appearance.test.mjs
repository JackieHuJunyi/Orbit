import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeRuneAppearanceTheme,
  RUNE_APPEARANCE_STORAGE_KEY,
  RUNE_APPEARANCE_THEMES,
} from "../app/lib/appearance.ts";

test("ships a restrained current-iPhone-inspired material palette with one stable default", () => {
  assert.equal(RUNE_APPEARANCE_STORAGE_KEY, "rune-appearance-theme-v1");
  assert.deepEqual(RUNE_APPEARANCE_THEMES.map(({ id }) => id), ["mist-blue", "sage", "lavender", "sky-blue", "light-gold", "deep-blue", "cosmic-orange", "silver", "space-black"]);
  assert.equal(new Set(RUNE_APPEARANCE_THEMES.map(({ color }) => color)).size, RUNE_APPEARANCE_THEMES.length);
  for (const theme of RUNE_APPEARANCE_THEMES) {
    assert.match(theme.color, /^#[0-9a-f]{6}$/i);
    assert.match(theme.soft, /^#[0-9a-f]{6}$/i);
    assert.equal(theme.finish.length, 2);
    assert.ok(theme.finish.every((color) => /^#[0-9a-f]{6}$/i.test(color)));
    assert.equal(normalizeRuneAppearanceTheme(theme.id), theme.id);
  }
  assert.equal(normalizeRuneAppearanceTheme("black"), null);
  assert.equal(normalizeRuneAppearanceTheme(null), null);
});

test("keeps Rune vermilion distinct and supplies real RTL/LTR boundaries", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /--rune-mark:\s*#dc4b36/);
  for (const { id } of RUNE_APPEARANCE_THEMES) assert.match(css, new RegExp(`html\\[data-theme="${id}"\\]`));
  assert.match(css, /html\[dir="rtl"\] \.source-editor/);
  assert.match(css, /html\[dir="rtl"\] \.canonical-ltr/);
  assert.match(css, /direction:\s*ltr/);
});
