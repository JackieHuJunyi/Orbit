import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ORBIT_PRODUCT_LOCKUP,
  ORBIT_PRODUCT_NAME,
  ORBIT_PRODUCT_NAME_ZH,
  ORBIT_PRODUCT_VERSION,
} from "../app/lib/product-meta.ts";
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
  assert.equal(ORBIT_PRODUCT_NAME_ZH, "引力");
  assert.equal(ORBIT_PRODUCT_LOCKUP, "Orbit · 引力");
  assert.equal(packageJson.name, "orbit-office");
  assert.match(packageJson.description, /Orbit · 引力/u);
  assert.match(layout, /ORBIT_PRODUCT_LOCKUP/);
  assert.match(welcome, /欢迎来到 Orbit · 引力/u);
  assert.match(welcome, /Welcome to Orbit · 引力/u);
  assert.match(workbench, /<strong dir="ltr">\{ORBIT_PRODUCT_LOCKUP\}<\/strong>/u);
  assert.match(settings, /\{ORBIT_PRODUCT_LOCKUP\} \{ORBIT_PRODUCT_VERSION\}/u);
  assert.match(desktop, /app\.setName\("Orbit"\)/u);
  assert.match(desktop, /path\.join\(app\.getPath\("appData"\), "Rune"\)/u);
  assert.match(desktop, /app\.setPath\("userData", legacyRuneUserDataDirectory\)/u);
  assert.doesNotMatch(
    `${layout}\n${welcome}\n${workbench}\n${settings}\n${desktop}`,
    /Welcome to Rune|<strong>Rune|setName\("Rune"\)/u,
  );

  assert.match(layout, /rune-onboarding-v1/u);
  assert.match(desktop, /RUNE_CREDENTIAL_ENCRYPTION_KEY/u);
  assert.match(directoryWorkspace, /\.rune-assets/u);
  assert.match(localAssets, /rune-asset:sha256:/u);
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
