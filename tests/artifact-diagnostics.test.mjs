import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MAX_ARTIFACT_DIAGNOSTICS,
  MAX_ARTIFACT_DIAGNOSTIC_DETAIL_CHARS,
  prepareArtifactDiagnostics,
} from "../app/lib/artifact-diagnostics.ts";

const artifact = Object.freeze({ id: "sales", kind: "data" });

test("classifies source and dependency issues without changing compiler detail", () => {
  const diagnostics = prepareArtifactDiagnostics(artifact, [
    { category: "source", detail: "Row 2: Too many fields." },
    { category: "unresolved-metric", detail: "Unresolved metric: revenue", reference: "revenue" },
    { category: "unresolved-chart", detail: "Unresolved chart: growth", reference: "growth" },
    { category: "chart-binding", detail: "Chart source is missing." },
  ]);
  assert.deepEqual(diagnostics.map(({ code, detail, reference }) => ({ code, detail, reference })), [
    { code: "data-source-invalid", detail: "Row 2: Too many fields.", reference: undefined },
    { code: "metric-missing", detail: "Unresolved metric: revenue", reference: "revenue" },
    { code: "chart-missing", detail: "Unresolved chart: growth", reference: "growth" },
    { code: "chart-binding-invalid", detail: "Chart source is missing.", reference: undefined },
  ]);
});

test("distinguishes empty, unsafe, and kind-specific source failures", () => {
  assert.equal(prepareArtifactDiagnostics(
    { id: "empty", kind: "document" },
    [{ category: "source", detail: "The source is empty." }],
  )[0].code, "source-empty");
  assert.equal(prepareArtifactDiagnostics(
    { id: "deck", kind: "slides" },
    [{ category: "source", detail: "Scripts are blocked in the slide preview." }],
  )[0].code, "source-unsafe");
  for (const [kind, code] of [
    ["document", "document-source-invalid"],
    ["query", "query-source-invalid"],
    ["chart", "chart-source-invalid"],
    ["slides", "slides-source-invalid"],
  ]) {
    assert.equal(prepareArtifactDiagnostics(
      { id: kind, kind },
      [{ category: "source", detail: "Invalid source." }],
    )[0].code, code);
  }
});

test("deduplicates, bounds, freezes, and never mutates diagnostic input", () => {
  const longDetail = `Error ${"x".repeat(MAX_ARTIFACT_DIAGNOSTIC_DETAIL_CHARS + 50)}`;
  const inputs = Object.freeze([
    Object.freeze({ category: "source", detail: longDetail }),
    Object.freeze({ category: "source", detail: longDetail }),
    ...Array.from({ length: MAX_ARTIFACT_DIAGNOSTICS + 4 }, (_, index) => Object.freeze({
      category: "metric-binding",
      detail: `Binding ${index}`,
    })),
  ]);
  const snapshot = structuredClone(inputs);
  const diagnostics = prepareArtifactDiagnostics(artifact, inputs);
  assert.equal(diagnostics.length, MAX_ARTIFACT_DIAGNOSTICS);
  assert.equal(diagnostics[0].detail.length, MAX_ARTIFACT_DIAGNOSTIC_DETAIL_CHARS);
  assert.equal(diagnostics[0].detailTruncated, true);
  assert.equal(Object.isFrozen(diagnostics), true);
  assert.equal(diagnostics.every(Object.isFrozen), true);
  assert.deepEqual(inputs, snapshot);
});

test("keeps classification outside React, browser, provider, persistence, and mutation boundaries", async () => {
  const source = await readFile(new URL("../app/lib/artifact-diagnostics.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from ["']react|window\.|document\.|localStorage|indexedDB|fetch\(|setArtifacts|persistDeviceWorkspace|model-provider/i);
});
