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

test("keeps focused content geometry and places the compact primary action with language choice", async () => {
  const [tokens, onboarding, component] = await Promise.all([
    readFile(new URL("../app/styles/tokens.css", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/onboarding.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/welcome-experience.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(tokens, /--rune-content-reading:\s*780px;/);
  assert.match(tokens, /--rune-file-width:\s*220px;/);
  assert.match(
    onboarding,
    /\.welcome-language-card > \.welcome-primary\s*\{[^}]*min-width:\s*118px;[^}]*align-self:\s*flex-end;/s,
  );
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

test("keeps non-modal menu focus shared while business capabilities remain in the Workbench", async () => {
  const [workbench, activityRail, exportMenu, settingsMenu, menuFocus, responsive] = await Promise.all([
    readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/workbench-activity-rail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/workbench-export-menu.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/workbench-settings-menu.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/use-workbench-menu-focus.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/responsive.css", import.meta.url), "utf8"),
  ]);

  assert.match(workbench, /<WorkbenchSettingsMenu/);
  assert.match(activityRail, /onOpenSettings:\s*\(edge: WorkbenchMenuFocusEdge\) => void/);
  assert.match(exportMenu, /useWorkbenchMenuFocus\(\{/);
  assert.match(settingsMenu, /useWorkbenchMenuFocus\(\{/);
  assert.match(settingsMenu, /actions\.length \+ RUNE_APPEARANCE_THEMES\.length/);
  assert.doesNotMatch(
    settingsMenu,
    /useState|setArtifacts|persistDeviceWorkspace|localStorage|sessionStorage|indexedDB|fetch\(|showDirectoryPicker|createObjectURL/,
  );
  assert.doesNotMatch(menuFocus, /WorkspaceArtifact|model|directory|theme|persist|localStorage|indexedDB|fetch\(/i);
  assert.match(menuFocus, /!item\.disabled/);
  assert.match(menuFocus, /itemRefs\.current\.length = itemCount/);
  assert.match(
    responsive,
    /@media \(max-width:\s*680px\)[\s\S]*\.settings-popover\s*\{[^}]*right:\s*10px;[^}]*bottom:\s*auto;[^}]*left:\s*10px;/,
  );
  assert.match(responsive, /html\[dir="rtl"\] \.settings-popover\s*\{[^}]*right:\s*10px;[^}]*left:\s*10px;/);
});

test("keeps the startup spectrum inside one licensed, path-timed handwritten performance", async () => {
  const [component, experience, fontBundles, glyphData, onboarding, motion] = await Promise.all([
    readFile(new URL("../app/components/handwritten-greeting.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/welcome-experience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/greeting-font-bundles.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/greeting-glyph-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/onboarding.css", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/motion.css", import.meta.url), "utf8"),
  ]);

  assert.match(component, /"data-motion-sequence": "write-settle-reveal"/);
  assert.match(component, /"data-motion-timeline": "path-length-staggered"/);
  assert.match(component, /"data-color-system": "apple-hello-spectrum"/);
  assert.match(component, /"data-ink-material": "pressure-pencil-spectrum"/);
  assert.match(component, /<TegakiRenderer/);
  assert.match(component, /speed: penSpeed/);
  assert.doesNotMatch(component, /stagger:/);
  assert.match(component, /feTurbulence[^]*feDisplacementMap/);
  assert.doesNotMatch(component, /welcome-greeting-(?:color-bloom|ink-trail|ink-sheen|stroke-head)/);
  assert.match(experience, /greetingPresentation\.completeAfterMs \+ 180/);
  assert.match(fontBundles, /Ma Shan Zheng/);
  assert.match(fontBundles, /Iansui/);
  assert.match(fontBundles, /Klee One/);
  assert.match(fontBundles, /Nanum Pen Script/);
  assert.match(fontBundles, /tegaki\/fonts\/amiri/);
  assert.match(glyphData, /SIMPLIFIED_CHINESE_GREETING_GLYPHS/);
  assert.match(glyphData, /TRADITIONAL_CHINESE_GREETING_GLYPHS/);
  assert.match(onboarding, /\.welcome-backdrop\[data-intro-phase="writing"\]\s*\{[^}]*background:\s*#050506;/s);
  assert.match(onboarding, /\.welcome-greeting-spectrum stop\s*\{\s*animation:\s*none;/s);
  assert.match(motion, /@keyframes rune-greeting-pencil-write/);
  assert.doesNotMatch(motion, /@keyframes rune-greeting-(?:write|ink-settle)/);
  assert.match(motion, /@keyframes rune-setup-unfold/);
  assert.doesNotMatch(experience, /WelcomeAmbientMotion|greetingCycleDuration|setGreetingIndex/);
  assert.doesNotMatch(onboarding + motion, /welcome-ambient|greeting-color-bloom|greeting-stroke-head/);
});
