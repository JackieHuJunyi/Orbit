import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ORBIT_PRODUCT_NAME, ORBIT_PRODUCT_VERSION } from "../app/lib/product-meta.ts";
import { isExpectedE2EStreamCancellation } from "../scripts/start-e2e.mjs";

const rootFile = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");

test("keeps product, package, release notes, progress, and handoff on one current version", async () => {
  const [packageSource, readme, changelog, progress, handoff] = await Promise.all([
    rootFile("package.json"),
    rootFile("README.md"),
    rootFile("CHANGELOG.md"),
    rootFile("PROGRESS.md"),
    rootFile("docs/FIRST-RELEASE-HANDOFF.md"),
  ]);
  const packageJson = JSON.parse(packageSource);

  assert.equal(packageJson.version, `${ORBIT_PRODUCT_VERSION}.0`);
  assert.equal(packageJson.scripts["start:e2e"], "npm run prepare:runtime && node scripts/start-e2e.mjs");
  assert.match(readme.slice(0, 4_000), new RegExp(`Orbit v${ORBIT_PRODUCT_VERSION.replace(".", "\\.")}`));
  assert.match(changelog.slice(0, 4_000), new RegExp(`Orbit v${ORBIT_PRODUCT_VERSION.replace(".", "\\.")}`));
  assert.match(progress.slice(0, 1_000), new RegExp(`Orbit v${ORBIT_PRODUCT_VERSION.replace(".", "\\.")}`));
  assert.match(handoff.slice(0, 1_000), new RegExp(`Orbit v${ORBIT_PRODUCT_VERSION.replace(".", "\\.")}`));
  assert.doesNotMatch(handoff, /main` and `origin\/main` resolve to/u);
});

test("presents Orbit while preserving the legacy Rune compatibility namespace", async () => {
  const [packageSource, layout, welcome, workbench, settings, desktop, localAssets, directoryWorkspace] =
    await Promise.all([
      rootFile("package.json"),
      rootFile("app/layout.tsx"),
      rootFile("app/components/welcome-experience.tsx"),
      rootFile("app/components/rune-workbench.tsx"),
      rootFile("app/components/workbench-settings-menu.tsx"),
      rootFile("desktop/main.mjs"),
      rootFile("app/lib/local-assets.ts"),
      rootFile("app/lib/directory-workspace.ts"),
    ]);
  const packageJson = JSON.parse(packageSource);

  assert.equal(ORBIT_PRODUCT_NAME, "Orbit");
  assert.equal(packageJson.name, "orbit-office");
  assert.match(packageJson.description, /^Orbit —/u);
  assert.match(layout, /ORBIT_PRODUCT_NAME/);
  assert.match(welcome, /欢迎来到 Orbit/u);
  assert.match(welcome, /Welcome to Orbit/u);
  assert.match(workbench, /<strong dir="ltr">\{ORBIT_PRODUCT_NAME\}<\/strong>/u);
  assert.match(settings, /\{ORBIT_PRODUCT_NAME\} \{ORBIT_PRODUCT_VERSION\}/u);
  assert.match(desktop, /app\.setName\("Orbit"\)/u);
  assert.match(desktop, /app\.setName\("Rune"\)/u);
  assert.match(desktop, /path\.join\(app\.getPath\("appData"\), "Rune"\)/u);
  assert.match(desktop, /app\.setPath\("userData", legacyRuneUserDataDirectory\)/u);
  assert.ok(desktop.indexOf('app.setName("Rune")') < desktop.indexOf("await initializeDesktopCredentialVault()"));
  assert.ok(desktop.indexOf("await initializeDesktopCredentialVault()") < desktop.indexOf('app.setName("Orbit")'));
  assert.doesNotMatch(
    `${layout}\n${welcome}\n${workbench}\n${settings}\n${desktop}`,
    /Orbit · 引力|Welcome to Rune|<strong>Rune/u,
  );

  assert.match(layout, /rune-onboarding-v1/u);
  assert.match(desktop, /RUNE_CREDENTIAL_ENCRYPTION_KEY/u);
  assert.match(directoryWorkspace, /\.rune-assets/u);
  assert.match(localAssets, /rune-asset:sha256:/u);
});

test("ships one shared, scalable two-planet Orbit mark", async () => {
  const [mark, master, icon, dockIcon, desktop, welcome, workbench, shellStyles, onboardingStyles] = await Promise.all([
    rootFile("app/components/orbit-mark.tsx"),
    rootFile("icon-design/icon.svg"),
    rootFile("app/icon.svg"),
    readFile(new URL("../desktop/orbit-app-icon.png", import.meta.url)),
    rootFile("desktop/main.mjs"),
    rootFile("app/components/welcome-experience.tsx"),
    rootFile("app/components/rune-workbench.tsx"),
    rootFile("app/styles/shell.css"),
    rootFile("app/styles/onboarding.css"),
  ]);

  assert.equal(mark.match(/<circle\b/gu)?.length, 2);
  assert.equal(mark.match(/<ellipse\b/gu)?.length, 2);
  assert.match(mark, /orbit-mark__path--first/u);
  assert.match(mark, /orbit-mark__path--second/u);
  assert.match(mark, /aria-hidden="true"[\s\S]{0,80}focusable="false"/u);
  assert.equal(icon.match(/<ellipse\b/gu)?.length, 2);
  assert.equal(icon.match(/<circle\b/gu)?.length, 2);
  assert.equal(master.match(/<ellipse\b/gu)?.length, 2);
  assert.equal(master.match(/<circle\b/gu)?.length, 2);
  assert.match(icon, /<path id="bg"[\s\S]{0,1600}fill="#2A2A2E"/u);
  assert.equal(icon.match(/<g id="glyph"[\s\S]*<\/g>/u)?.[0], master.match(/<g id="glyph"[\s\S]*<\/g>/u)?.[0]);
  assert.deepEqual([...dockIcon.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.match(desktop, /icon: orbitAppIconPath/u);
  assert.match(desktop, /app\.dock\.setIcon\(orbitAppIconPath\)/u);
  assert.match(welcome, /<OrbitMark className="orbit-mark" \/>/u);
  assert.match(workbench, /<OrbitMark className="orbit-mark" \/>/u);
  assert.doesNotMatch(`${welcome}\n${workbench}`, /<span>O<\/span>/u);
  assert.match(shellStyles, /\.orbit-mark__planet \{ fill: var\(--theme-accent\); \}/u);
  assert.match(onboardingStyles, /\.welcome-chrome-brand \.orbit-mark/u);
});

test("runs every browser scenario in Chromium, Firefox, and WebKit", async () => {
  const [config, workflow] = await Promise.all([
    rootFile("playwright.config.ts"),
    rootFile(".github/workflows/release-quality.yml"),
  ]);
  assert.match(config, /command: "npm run start:e2e"/u);
  for (const [name, device] of [
    ["chromium", "Desktop Chrome"],
    ["firefox", "Desktop Firefox"],
    ["webkit", "Desktop Safari"],
  ]) {
    assert.match(config, new RegExp(`name: "${name}"[\\s\\S]{0,80}devices\\["${device}"\\]`));
  }
  assert.match(workflow, /matrix:[\s\S]{0,100}project: \[chromium, firefox, webkit\]/u);
  assert.match(workflow, /- run: npm run test:e2e -- --project=\$\{\{ matrix\.project \}\}[\s\S]{0,180}HOME: \/root/u);
  assert.match(workflow, /name: playwright-report-\$\{\{ matrix\.project \}\}/u);
});

test("filters only the expected DuckDB stream cancellation from the E2E server", () => {
  assert.equal(
    isExpectedE2EStreamCancellation(
      "[vinext] Static file stream error for /workspace/dist/client/duckdb/duckdb-mvp.wasm: Premature close",
    ),
    true,
  );
  assert.equal(
    isExpectedE2EStreamCancellation(
      "[vinext] Static file stream error for C:\\workspace\\dist\\client\\duckdb\\duckdb-mvp.wasm: Premature close",
    ),
    true,
  );
  assert.equal(
    isExpectedE2EStreamCancellation(
      "[vinext] Static file stream error for /workspace/dist/client/duckdb/duckdb-mvp.wasm: Permission denied",
    ),
    false,
  );
  assert.equal(isExpectedE2EStreamCancellation("[vinext] API route failed"), false);
});
