import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MAX_SOURCE_NAVIGATION_REFERENCE_CHARS,
  prepareSourceNavigation,
  selectPreviewNavigationCandidate,
} from "../app/lib/source-navigation.ts";

const artifacts = Object.freeze([
  Object.freeze({
    id: "report",
    name: "report.md",
    kind: "document",
    language: "markdown",
    source: '# Report\n\nRevenue is {{ metric("revenue") }}.',
  }),
  Object.freeze({ id: "data", name: "data.csv", kind: "data", language: "csv", source: "region,revenue\nNorth,12" }),
]);

test("prepares one exact preview-to-Source selection and its layout effects", () => {
  const source = artifacts[1].source;
  const start = source.indexOf("North");
  const snapshot = structuredClone(artifacts);
  const result = prepareSourceNavigation({
    artifacts,
    selectedArtifactId: "report",
    workspaceView: "preview",
    request: {
      origin: "preview",
      artifactId: "data",
      sourceRevision: source,
      start,
      end: start + 5,
      label: "Row 1 · region",
    },
  });
  assert.equal(result.error, "");
  assert.deepEqual(result.plan, {
    origin: "preview",
    artifactId: "data",
    sourceRevision: source,
    start,
    end: start + 5,
    label: "Row 1 · region",
    changesArtifact: true,
    revealsSource: true,
    activateSelectionAgent: true,
    matchedReference: false,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.plan), true);
  assert.deepEqual(artifacts, snapshot);
});

test("resolves diagnostic references exactly and falls back to the first Source line", () => {
  const source = artifacts[0].source;
  const exact = prepareSourceNavigation({
    artifacts,
    selectedArtifactId: "report",
    workspaceView: "split",
    request: {
      origin: "diagnostic",
      artifactId: "report",
      sourceRevision: source,
      reference: "revenue",
      label: "Needs attention",
    },
  });
  assert.equal(exact.plan.start, source.indexOf("revenue"));
  assert.equal(exact.plan.end, source.indexOf("revenue") + "revenue".length);
  assert.equal(exact.plan.activateSelectionAgent, false);
  assert.equal(exact.plan.matchedReference, true);

  const fallback = prepareSourceNavigation({
    artifacts,
    selectedArtifactId: "report",
    workspaceView: "preview",
    request: {
      origin: "diagnostic",
      artifactId: "report",
      sourceRevision: source,
      reference: "missing",
      label: "Needs attention",
    },
  });
  assert.deepEqual({ start: fallback.plan.start, end: fallback.plan.end }, { start: 0, end: "# Report".length });
  assert.equal(fallback.plan.revealsSource, true);
  assert.equal(fallback.plan.matchedReference, false);
});

test("allows an empty Source repair focus without manufacturing a selection", () => {
  const empty = Object.freeze([{ id: "empty", name: "empty.md", kind: "document", language: "markdown", source: "" }]);
  const result = prepareSourceNavigation({
    artifacts: empty,
    selectedArtifactId: "empty",
    workspaceView: "preview",
    request: { origin: "diagnostic", artifactId: "empty", sourceRevision: "", label: "Add source content" },
  });
  assert.deepEqual({ start: result.plan.start, end: result.plan.end }, { start: 0, end: 0 });
  assert.equal(result.error, "");
});

test("fails closed for missing artifacts, stale revisions, unsafe ranges, and oversized references", () => {
  const base = { artifacts, selectedArtifactId: "report", workspaceView: "split" };
  assert.match(
    prepareSourceNavigation({
      ...base,
      request: { origin: "preview", artifactId: "missing", sourceRevision: "", start: 0, end: 1, label: "Missing" },
    }).error,
    /no longer in this workspace/,
  );
  assert.match(
    prepareSourceNavigation({
      ...base,
      request: { origin: "preview", artifactId: "report", sourceRevision: "stale", start: 0, end: 1, label: "Stale" },
    }).error,
    /current artifact revision/,
  );
  assert.match(
    prepareSourceNavigation({
      ...base,
      request: {
        origin: "preview",
        artifactId: "report",
        sourceRevision: artifacts[0].source,
        start: -1,
        end: 2,
        label: "Unsafe",
      },
    }).error,
    /does not match/,
  );
  assert.match(
    prepareSourceNavigation({
      ...base,
      request: {
        origin: "diagnostic",
        artifactId: "report",
        sourceRevision: artifacts[0].source,
        reference: "x".repeat(MAX_SOURCE_NAVIGATION_REFERENCE_CHARS + 1),
        label: "Long",
      },
    }).error,
    /limited/,
  );
});

test("chooses the most exact rendered Preview node for Source-driven scrolling", () => {
  const candidates = [
    { sourceId: "block-2", sectionId: "section-1", primary: false },
    { sourceId: "block-2", sectionId: "section-1", primary: true },
    { sourceId: "fragment-1", sectionId: "section-1", primary: false },
  ];
  assert.equal(selectPreviewNavigationCandidate({ id: "block-2", kind: "document-block" }, candidates), 1);
  assert.equal(selectPreviewNavigationCandidate({ id: "section-1", kind: "document-section" }, candidates), 0);
  assert.equal(selectPreviewNavigationCandidate({ id: "fragment-1", kind: "document-fragment" }, candidates), 2);
  assert.equal(selectPreviewNavigationCandidate({ id: "missing", kind: "document-block" }, candidates), -1);
});

test("keeps navigation planning outside React, DOM, provider, persistence, and mutation boundaries", async () => {
  const source = await readFile(new URL("../app/lib/source-navigation.ts", import.meta.url), "utf8");
  assert.doesNotMatch(
    source,
    /from ["']react|window\.|document\.|querySelector|localStorage|indexedDB|fetch\(|setArtifacts|persistDeviceWorkspace|model-provider/i,
  );
});

test("routes Preview clicks and diagnostic repair through one Workbench effect executor", async () => {
  const source = await readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8");
  const previewScroll = await readFile(
    new URL("../app/components/use-source-preview-scroll.ts", import.meta.url),
    "utf8",
  );
  assert.equal(source.split("executeSourceNavigation(navigation.plan").length - 1, 2);
  assert.match(source, /function executeSourceNavigation\([\s\S]*editor\.setSelectionRange\(plan\.start, plan\.end/);
  assert.match(source, /if \(plan\.activateSelectionAgent\) \{[\s\S]*setAgentScope\("selection"\)/);
  assert.match(source, /inspectSourceNavigationRef\.current = !plan\.activateSelectionAgent/);
  assert.match(source, /if \(inspectSourceNavigationRef\.current\) \{[\s\S]*setSourceSelection[\s\S]*return;/);
  assert.match(source, /useSourcePreviewScroll\(\{/);
  assert.match(previewScroll, /selectPreviewNavigationCandidate\([\s\S]*linkedElements\.map/);
  assert.doesNotMatch(previewScroll, /setArtifacts|persistDeviceWorkspace|fetch\(|localStorage|indexedDB/);
});
