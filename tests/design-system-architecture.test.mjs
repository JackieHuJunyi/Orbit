import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const modules = ["tokens", "shell", "content", "overlays", "onboarding", "motion", "responsive"];

test("loads the modular design system in one explicit responsibility order", async () => {
  const [layout, entry] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/index.css", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /import "\.\/globals\.css";\s*import "\.\/styles\/index\.css";/);
  assert.deepEqual(
    [...entry.matchAll(/@import "\.\/(.+?)\.css";/g)].map((match) => match[1]),
    modules,
  );
});

test("keeps the authoritative layer scale in tokens and consumes semantic layers elsewhere", async () => {
  const [tokens, ...responsibilityStyles] = await Promise.all(
    modules.map((name) => readFile(new URL(`../app/styles/${name}.css`, import.meta.url), "utf8")),
  );
  assert.match(tokens, /--rune-layer-canvas:\s*0;/);
  assert.match(tokens, /--rune-layer-workspace:\s*10;/);
  assert.match(tokens, /--rune-layer-pane-float:\s*80;/);
  assert.match(tokens, /--rune-layer-topbar:\s*100;/);
  assert.match(tokens, /--rune-layer-global-float:\s*500;/);
  assert.match(tokens, /--rune-layer-modal:\s*1000;/);
  assert.match(tokens, /--rune-layer-onboarding:\s*1100;/);
  for (const styles of responsibilityStyles) {
    assert.doesNotMatch(styles, /z-index:\s*-?\d/);
    for (const match of styles.matchAll(/z-index:\s*([^;]+);/g)) {
      assert.match(match[1], /var\(--rune-layer-|calc\(var\(--rune-layer-/);
    }
  }
});

test("prevents global and pane overlays from being clipped and keeps modal tiers above chrome", async () => {
  const [shell, content, overlays, onboarding] = await Promise.all([
    readFile(new URL("../app/styles/shell.css", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/content.css", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/overlays.css", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/onboarding.css", import.meta.url), "utf8"),
  ]);
  assert.match(shell, /\.rune-shell\s*\{[^}]*isolation:\s*auto;[^}]*overflow:\s*visible;/s);
  assert.match(shell, /\.rune-shell > \.topbar\s*\{[^}]*var\(--rune-layer-topbar\)/s);
  assert.match(content, /\.preview-header\s*\{[^}]*overflow:\s*visible;/s);
  assert.match(
    overlays,
    /\.tools-popover,\s*\.export-popover\s*\{[^}]*var\(--rune-layer-global-float\)[^}]*max-height:[^}]*overflow-y:\s*auto;/s,
  );
  assert.match(overlays, /\.import-review-backdrop\s*\{[^}]*var\(--rune-layer-modal\)/s);
  assert.match(onboarding, /\.welcome-backdrop\s*\{[^}]*var\(--rune-layer-onboarding\)/s);
});

test("keeps ColaMD-informed content geometry and places the primary welcome action with language choice", async () => {
  const [tokens, onboarding, component] = await Promise.all([
    readFile(new URL("../app/styles/tokens.css", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/onboarding.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/welcome-experience.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(tokens, /--rune-content-reading:\s*780px;/);
  assert.match(tokens, /--rune-file-width:\s*220px;/);
  assert.match(onboarding, /\.welcome-language-card > \.welcome-primary\s*\{[^}]*width:\s*100%;/s);
  const cardStart = component.indexOf('<section className="welcome-language-card"');
  const cardEnd = component.indexOf("</section>", cardStart);
  assert.match(component.slice(cardStart, cardEnd), /className="welcome-primary"/);
});

test("keeps the navigable Deck canvas inside the content layer and semantic motion/layer scales", async () => {
  const [content, motion] = await Promise.all([
    readFile(new URL("../app/styles/content.css", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/motion.css", import.meta.url), "utf8"),
  ]);
  assert.match(
    content,
    /\.deck-slide-canvas\s*\{[^}]*var\(--rune-radius-card\)[^}]*var\(--rune-shadow-card\)[^}]*var\(--rune-duration-micro\)/s,
  );
  assert.match(content, /\.deck-slide-source-hit\s*\{[^}]*z-index:\s*calc\(var\(--rune-layer-canvas\) \+ 1\)/s);
  assert.match(content, /\.deck-slide-source-hit:focus-visible/);
  assert.doesNotMatch(motion, /\.welcome-window\s*\{[^}]*animation:\s*rune-float/s);
});

test("keeps the startup spectrum inside one restrained textured handwritten performance", async () => {
  const [component, onboarding, motion] = await Promise.all([
    readFile(new URL("../app/components/handwritten-greeting.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/onboarding.css", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/motion.css", import.meta.url), "utf8"),
  ]);

  assert.match(component, /data-motion-sequence="write-settle-reveal"/);
  assert.match(component, /<feTurbulence[^>]+type="fractalNoise"/);
  assert.match(component, /className="welcome-greeting-color-bloom"/);
  assert.match(component, /className="welcome-greeting-ink-trail"/);
  assert.match(component, /data-color-system="apple-six-color"/);
  assert.doesNotMatch(
    component,
    /welcome-greeting-ink-ribbon|welcome-greeting-ink-bristle|welcome-greeting-stroke-head-bristle/,
  );
  assert.match(onboarding, /\.welcome-greeting-spectrum stop\s*\{[^}]*animation:[^;]+\s1 both;/s);
  assert.doesNotMatch(onboarding, /\.welcome-greeting-spectrum stop\s*\{[^}]*animation:[^;]*infinite/s);
  assert.match(motion, /@keyframes rune-greeting-spectrum-flow/);
  assert.match(motion, /@keyframes rune-greeting-color-bloom/);
  assert.match(motion, /@keyframes rune-boot-chroma/);
});
