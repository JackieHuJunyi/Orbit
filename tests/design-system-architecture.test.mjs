import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const modules = ["tokens", "shell", "content", "overlays", "onboarding", "motion", "responsive"];

test("loads the modular design system in one explicit responsibility order", async () => {
  const [layout, entry] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/index.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(layout, /import "\.\/globals\.css";/);
  assert.match(layout, /import "\.\/styles\/index\.css";/);
  assert.match(entry, /@layer legacy, tokens, shell, content, overlays, onboarding, motion, responsive;/);
  assert.match(entry, /@import "\.\.\/globals\.css" layer\(legacy\);/);
  assert.deepEqual(
    [...entry.matchAll(/@import "\.\/(.+?)\.css" layer\((.+?)\);/g)].map((match) => match[1]),
    modules,
  );
  assert.deepEqual(
    [...entry.matchAll(/@import "\.\/(.+?)\.css" layer\((.+?)\);/g)].map((match) => match[2]),
    modules,
  );
});

test("keeps empty, compact, and contextual surfaces inside the maintained cascade", async () => {
  const [shell, content, responsive, onboarding, workbench, modelManager] = await Promise.all([
    readFile(new URL("../app/styles/shell.css", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/content.css", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/responsive.css", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/onboarding.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/orbit-workbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/model-profile-manager.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(workbench, /emptyWorkspace \? "is-empty" : ""/);
  assert.match(shell, /\.workspace\.is-empty\.with-file-rail[^{]*\{[^}]*grid-template-columns:/s);
  assert.match(
    shell,
    /\.workspace\.is-empty\.with-file-rail > \.empty-workspace-canvas\s*\{\s*grid-column:\s*3 \/ -1;/,
  );
  assert.match(responsive, /@media \(max-width:\s*960px\)[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\)/);
  assert.match(responsive, /workspace-view-option="split"/);
  assert.match(content, /\.agent-dock\.collapsed/);
  assert.match(workbench, /agentComposerOpen/);
  assert.match(workbench, /data-orbit-hydrated=\{hydrated \? "true" : "false"\}/);
  assert.match(shell, /\.workspace-view-switch button\s*\{[^}]*border:\s*0;[^}]*cursor:\s*pointer;/s);
  assert.match(onboarding, /\.model-profile-manager\.compact/);
  assert.match(modelManager, /state\.profiles\.length > 0 && state\.deployment\.configured/);
});

test("keeps the authoritative layer scale in tokens and consumes semantic layers elsewhere", async () => {
  const [tokens, ...responsibilityStyles] = await Promise.all(
    modules.map((name) => readFile(new URL(`../app/styles/${name}.css`, import.meta.url), "utf8")),
  );
  assert.match(tokens, /--orbit-layer-canvas:\s*0;/);
  assert.match(tokens, /--orbit-layer-workspace:\s*10;/);
  assert.match(tokens, /--orbit-layer-pane-float:\s*80;/);
  assert.match(tokens, /--orbit-layer-topbar:\s*100;/);
  assert.match(tokens, /--orbit-layer-global-float:\s*500;/);
  assert.match(tokens, /--orbit-layer-modal:\s*1000;/);
  assert.match(tokens, /--orbit-layer-onboarding:\s*1100;/);
  for (const styles of responsibilityStyles) {
    assert.doesNotMatch(styles, /z-index:\s*-?\d/);
    for (const match of styles.matchAll(/z-index:\s*([^;]+);/g)) {
      assert.match(match[1], /var\(--orbit-layer-|calc\(var\(--orbit-layer-/);
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
  assert.match(shell, /\.orbit-shell\s*\{[^}]*isolation:\s*auto;[^}]*overflow:\s*visible;/s);
  assert.match(shell, /\.orbit-shell > \.topbar\s*\{[^}]*var\(--orbit-layer-topbar\)/s);
  assert.match(content, /\.preview-header\s*\{[^}]*overflow:\s*visible;/s);
  assert.match(
    overlays,
    /\.tools-popover,\s*\.export-popover\s*\{[^}]*var\(--orbit-layer-global-float\)[^}]*max-height:[^}]*overflow-y:\s*auto;/s,
  );
  assert.match(overlays, /\.import-review-backdrop\s*\{[^}]*var\(--orbit-layer-modal\)/s);
  assert.match(onboarding, /\.welcome-backdrop\s*\{[^}]*var\(--orbit-layer-onboarding\)/s);
});

test("keeps focused content geometry and places the compact primary action with language choice", async () => {
  const [tokens, onboarding, component] = await Promise.all([
    readFile(new URL("../app/styles/tokens.css", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/onboarding.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/welcome-experience.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(tokens, /--orbit-content-reading:\s*920px;/);
  assert.match(tokens, /--orbit-file-width:\s*220px;/);
  assert.match(
    onboarding,
    /\.welcome-language-card > \.welcome-primary\s*\{[^}]*min-width:\s*118px;[^}]*align-self:\s*flex-end;/s,
  );
  const cardStart = component.indexOf('className="welcome-language-card"');
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
    /\.deck-slide-canvas\s*\{[^}]*var\(--orbit-radius-card\)[^}]*var\(--orbit-shadow-card\)[^}]*var\(--orbit-duration-micro\)/s,
  );
  assert.match(content, /\.deck-slide-source-hit\s*\{[^}]*z-index:\s*calc\(var\(--orbit-layer-canvas\) \+ 1\)/s);
  assert.match(content, /\.deck-slide-source-hit:focus-visible/);
  assert.doesNotMatch(motion, /\.welcome-window\s*\{[^}]*animation:\s*orbit-float/s);
});

test("keeps non-modal menu focus shared while business capabilities remain in the Workbench", async () => {
  const [workbench, activityRail, exportMenu, settingsMenu, menuFocus, responsive] = await Promise.all([
    readFile(new URL("../app/components/orbit-workbench.tsx", import.meta.url), "utf8"),
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
  assert.match(settingsMenu, /actions\.length \+ ORBIT_APPEARANCE_THEMES\.length/);
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

test("restores the licensed English Hello gesture while keeping every translated line redistributable", async () => {
  const [component, experience, fontBundles, glyphData, onboarding, motion] = await Promise.all([
    readFile(new URL("../app/components/handwritten-greeting.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/welcome-experience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/greeting-font-bundles.ts", import.meta.url), "utf8"),
    Promise.all(
      ["caveat", "ma-shan-zheng", "iansui", "nanum-pen-script"].map((name) =>
        readFile(new URL(`../app/lib/greeting-glyph-data/${name}.json`, import.meta.url), "utf8"),
      ),
    ).then((files) => files.join("\n")),
    readFile(new URL("../app/styles/onboarding.css", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/motion.css", import.meta.url), "utf8"),
  ]);

  assert.match(component, /"data-motion-sequence": "write-settle-reveal"/);
  assert.match(component, /"data-motion-timeline": "path-length-staggered"/);
  assert.match(component, /"data-color-system": "apple-hello-spectrum"/);
  assert.match(component, /"data-ink-material": "pressure-pencil-spectrum"/);
  assert.match(component, /<TegakiRenderer/);
  assert.match(component, /speed: penSpeed \/ motion\.durationScale/);
  assert.match(component, /duration: WELCOME_SIGNATURE_DURATION_SECONDS/);
  assert.match(component, /ENGLISH_HELLO_STROKES/);
  assert.match(component, /licensed-vector-centerline/);
  assert.match(component, /feTurbulence[^]*feDisplacementMap/);
  assert.match(component, /variant === "inline" \? "welcome-signature" : "welcome-greeting"/);
  assert.match(experience, /presentation=\{welcomeSignaturePresentation\}/);
  assert.match(experience, /locale: greetingLocale, value: text\.welcomeEyebrow/);
  assert.doesNotMatch(component, /stagger:/);
  assert.doesNotMatch(component, /welcome-greeting-(?:color-bloom|ink-trail|ink-sheen|stroke-head)/);
  assert.match(experience, /greetingPresentation\.completeAfterMs \+ 180/);
  assert.match(experience, /WELCOME_SIGNATURE_COMPLETE_AFTER_MS/);
  assert.match(fontBundles, /Ma Shan Zheng/);
  assert.match(fontBundles, /Iansui/);
  assert.match(fontBundles, /tegaki\/fonts\/klee-one/);
  assert.match(fontBundles, /Nanum Pen Script/);
  assert.match(fontBundles, /tegaki\/fonts\/amiri/);
  for (const character of ["你", "好", "欢", "迎", "来", "到", "哈", "囉", "歡", "來", "O", "r", "b", "i", "t"]) {
    assert.match(glyphData, new RegExp(`"${character}"`));
  }
  assert.match(onboarding, /\.welcome-backdrop\[data-intro-phase="writing"\]\s*\{[^}]*background:\s*#050506;/s);
  assert.match(
    onboarding,
    /\.welcome-language-heading \.welcome-written-eyebrow\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s,
  );
  assert.match(motion, /@keyframes orbit-greeting-pencil-write/);
  assert.doesNotMatch(motion, /@keyframes orbit-greeting-(?:write|ink-settle)/);
  assert.match(motion, /@keyframes orbit-setup-unfold/);
  assert.doesNotMatch(experience, /WelcomeAmbientMotion|greetingCycleDuration|setGreetingIndex/);
  assert.doesNotMatch(onboarding + motion, /welcome-ambient|greeting-color-bloom|greeting-stroke-head/);
});
