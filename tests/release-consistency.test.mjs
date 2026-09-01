import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { RUNE_PRODUCT_VERSION } from "../app/lib/product-meta.ts";
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

  assert.equal(packageJson.version, `${RUNE_PRODUCT_VERSION}.0`);
  assert.equal(packageJson.scripts["start:e2e"], "npm run prepare:runtime && node scripts/start-e2e.mjs");
  assert.match(readme.slice(0, 4_000), new RegExp(`Rune v${RUNE_PRODUCT_VERSION.replace(".", "\\.")}`));
  assert.match(changelog.slice(0, 4_000), new RegExp(`Rune v${RUNE_PRODUCT_VERSION.replace(".", "\\.")}`));
  assert.match(progress.slice(0, 1_000), new RegExp(`Rune v${RUNE_PRODUCT_VERSION.replace(".", "\\.")}`));
  assert.match(handoff.slice(0, 1_000), new RegExp(`Rune v${RUNE_PRODUCT_VERSION.replace(".", "\\.")}`));
  assert.doesNotMatch(handoff, /main` and `origin\/main` resolve to/u);
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
