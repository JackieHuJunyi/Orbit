import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeOrbitAppearanceTheme,
  ORBIT_APPEARANCE_STORAGE_KEY,
  ORBIT_APPEARANCE_THEMES,
} from "../app/lib/appearance.ts";
import { loadOrbitLocaleCatalog, orbitText } from "../app/lib/localization.ts";

await Promise.all(["fr", "es", "ru", "ar", "ja", "ko"].map(loadOrbitLocaleCatalog));

function relativeLuminance(hex) {
  const channels = hex
    .match(/[0-9a-f]{2}/gi)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
  const values = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("ships a restrained current-iPhone-inspired material palette with one stable default", () => {
  assert.equal(ORBIT_APPEARANCE_STORAGE_KEY, "orbit-appearance-theme-v1");
  assert.deepEqual(
    ORBIT_APPEARANCE_THEMES.map(({ id }) => id),
    [
      "ultramarine",
      "starlight",
      "mist-blue",
      "sage",
      "lavender",
      "sky-blue",
      "light-gold",
      "deep-blue",
      "cosmic-orange",
      "rose-pearl",
      "silver",
      "space-black",
    ],
  );
  assert.equal(new Set(ORBIT_APPEARANCE_THEMES.map(({ color }) => color)).size, ORBIT_APPEARANCE_THEMES.length);
  for (const theme of ORBIT_APPEARANCE_THEMES) {
    assert.match(theme.color, /^#[0-9a-f]{6}$/i);
    assert.match(theme.soft, /^#[0-9a-f]{6}$/i);
    assert.equal(theme.finish.length, 2);
    assert.ok(theme.finish.every((color) => /^#[0-9a-f]{6}$/i.test(color)));
    assert.equal(normalizeOrbitAppearanceTheme(theme.id), theme.id);
  }
  assert.equal(normalizeOrbitAppearanceTheme("black"), null);
  assert.equal(normalizeOrbitAppearanceTheme(null), null);
});

test("keeps the Space Black accent legible and visibly distinct from its deepest surface", async () => {
  const spaceBlack = ORBIT_APPEARANCE_THEMES.find(({ id }) => id === "space-black");
  assert.ok(spaceBlack);
  assert.ok(contrastRatio(spaceBlack.color, spaceBlack.finish[1]) >= 7);
  assert.notEqual(spaceBlack.soft, "#ededee");

  const tokens = await readFile(new URL("../app/styles/tokens.css", import.meta.url), "utf8");
  assert.match(tokens, /--orbit-accent-surface:\s*#2f719d/);
  assert.match(tokens, /--muted:\s*#bbc3cd/);
  assert.match(tokens, /--orbit-material-solid:\s*#252c34/);
});

test("keeps Orbit vermilion distinct and supplies real RTL/LTR boundaries", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /--orbit-mark:\s*#dc4b36/);
  for (const { id } of ORBIT_APPEARANCE_THEMES) assert.match(css, new RegExp(`html\\[data-theme="${id}"\\]`));
  assert.match(css, /html\[dir="rtl"\] \.source-editor/);
  assert.match(css, /html\[dir="rtl"\] \.canonical-ltr/);
  assert.match(css, /direction:\s*ltr/);
});

test("names every material theme in every non-Chinese interface locale", () => {
  for (const locale of ["fr", "es", "ru", "ar", "ja", "ko"]) {
    for (const theme of ORBIT_APPEARANCE_THEMES) {
      assert.notEqual(
        orbitText(locale, theme.english, theme.chinese),
        theme.english,
        `${theme.id} falls back to English in ${locale}`,
      );
    }
  }
});
