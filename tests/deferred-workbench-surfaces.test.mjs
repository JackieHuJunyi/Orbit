import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const surfaceModules = [
  "document-structure-review-dialog",
  "delivery-outcome-dialog",
  "document-briefing-dialog",
  "local-image-review-dialog",
  "export-review-dialog",
  "import-review-dialog",
  "new-artifact-dialog",
  "operating-review-dialog",
  "pilot-evidence-review-dialog",
  "workbench-command-menu",
  "pdf-ocr-setup-dialog",
  "transaction-review-map",
  "welcome-experience",
];

test("loads low-frequency Workbench surfaces through typed lazy boundaries", async () => {
  const source = await readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8");

  for (const moduleName of surfaceModules) {
    assert.match(source, new RegExp(`import\\(\"\\./${moduleName}\"\\)`), `${moduleName} needs a dynamic import.`);
    assert.doesNotMatch(
      source,
      new RegExp(`import\\s+(?!type\\b)[^;]+from\\s+\"\\./${moduleName}\"`, "s"),
      `${moduleName} must not return to the eager Workbench graph.`,
    );
  }

  assert.match(source, /<Suspense fallback={<DeferredWorkbenchSurfaceFallback locale={locale}/);
  assert.match(source, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(source, /variant="welcome"/);
  assert.match(source, /variant="inline"/);
});

test("keeps deferred-surface copy pure, local, and complete for every Rune locale", async () => {
  const source = await readFile(new URL("../app/lib/workbench-surface-copy.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /from\s+"react"|\.\.\/components|localStorage|indexedDB|fetch\(|WorkspaceArtifact/);
  for (const locale of ["en", "zh-CN", "zh-TW", "fr", "es", "ru", "ar", "ja", "ko"]) {
    const key =
      locale === "en" ||
      locale === "fr" ||
      locale === "es" ||
      locale === "ru" ||
      locale === "ar" ||
      locale === "ja" ||
      locale === "ko"
        ? `${locale}:`
        : `"${locale}":`;
    assert.match(source, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(source, /export function deferredSurfaceCopy/);
  assert.match(source, /export function localImageActionCopy/);
});
