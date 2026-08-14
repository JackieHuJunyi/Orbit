import assert from "node:assert/strict";
import test from "node:test";

import { parseChartSource } from "../app/lib/charts.ts";
import { derivePreviewSourceTargets } from "../app/lib/preview-targets.ts";
import {
  canVisualEditChartSpec,
  projectVisualChartSpecDraft,
  prepareVisualChartSpecEdit,
  visualChartSourceFields,
  visualChartSpecDraft,
  visualChartSpecPreviewSource,
} from "../app/lib/visual-chart-edit.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";

function chartArtifact() {
  const artifact = defaultArtifacts.find((candidate) => candidate.id === "regional-revenue-chart");
  assert.ok(artifact);
  return artifact;
}

test("compiles controlled Chart properties into the complete exact canonical source", () => {
  const artifact = chartArtifact();
  const [target] = derivePreviewSourceTargets(artifact);
  assert.equal(target.kind, "chart-spec");
  assert.equal(target.start, 0);
  assert.equal(target.end, artifact.source.length);
  assert.equal(canVisualEditChartSpec(artifact, target), true);
  const draft = visualChartSpecDraft(artifact);
  assert.ok(draft);

  const result = prepareVisualChartSpecEdit(artifact, target, {
    ...draft,
    title: "Regional trend",
    description: "Current source order",
    mark: "line",
    sort: "source",
    format: "number",
    color: "#8267CE",
    maxItems: 3,
  });
  assert.deepEqual(result.errors, []);
  assert.ok(result.nextTarget);
  assert.equal(result.nextTarget.start, 0);
  assert.equal(result.nextTarget.end, result.nextSource.length);
  assert.deepEqual(parseChartSource(result.nextSource).spec, {
    ...parseChartSource(artifact.source).spec,
    title: "Regional trend",
    description: "Current source order",
    mark: "line",
    sort: "source",
    format: "number",
    color: "#8267ce",
    maxItems: 3,
  });
});

test("keeps the bound source identity outside the visual Chart draft", () => {
  const artifact = chartArtifact();
  const draft = visualChartSpecDraft(artifact);
  assert.ok(draft);
  assert.equal(Object.hasOwn(draft, "source"), false);
  const preview = visualChartSpecPreviewSource(artifact, { ...draft, value: "Q1 Revenue" });
  assert.deepEqual(preview.errors, []);
  assert.equal(parseChartSource(preview.source).spec?.source, "regional-revenue");
});

test("projects unsaved Chart controls as complete canonical Chart JSON", () => {
  const artifact = Object.freeze(chartArtifact());
  const [target] = derivePreviewSourceTargets(artifact);
  const draft = visualChartSpecDraft(artifact);
  assert.ok(draft);
  const projection = projectVisualChartSpecDraft(artifact, target, { ...draft, title: "Projected title" });
  assert.deepEqual(projection.errors, []);
  assert.equal(projection.start, 0);
  assert.equal(projection.end, projection.nextSource.length);
  assert.equal(parseChartSource(projection.nextSource).spec?.title, "Projected title");
  assert.notEqual(projection.nextSource, artifact.source);

  const invalid = projectVisualChartSpecDraft(artifact, target, { ...draft, color: "orange" });
  assert.match(invalid.errors[0], /color/i);
  assert.match(invalid.nextSource, /"color": "orange"/u);
  assert.equal(parseChartSource(invalid.nextSource).spec, undefined);
});

test("derives exact Data and Query field choices from current readable sources", () => {
  const data = visualChartSourceFields(defaultArtifacts, "regional-revenue");
  assert.deepEqual(data.errors, []);
  assert.equal(data.sourceName, "regional-revenue.csv");
  assert.deepEqual(data.columns, ["Region", "Q2 Revenue", "Q1 Revenue", "Cost", "Customers"]);

  const query = visualChartSourceFields(defaultArtifacts, "regional-analysis");
  assert.deepEqual(query.errors, []);
  assert.equal(query.sourceName, "regional-analysis.sql");
  assert.deepEqual(query.columns, ["Region", "q2_revenue", "q1_revenue", "margin_pct", "Customers"]);
  assert.match(visualChartSourceFields(defaultArtifacts, "missing").errors[0], /not found/u);
});

test("rejects stale, unchanged, oversized, and schema-invalid Chart edits", () => {
  const artifact = chartArtifact();
  const [target] = derivePreviewSourceTargets(artifact);
  const draft = visualChartSpecDraft(artifact);
  assert.ok(draft);
  assert.match(
    prepareVisualChartSpecEdit(artifact, { ...target, end: target.end - 1 }, draft).errors[0],
    /no longer match/u,
  );
  assert.match(prepareVisualChartSpecEdit(artifact, target, draft).errors[0], /unchanged/u);
  assert.match(prepareVisualChartSpecEdit(artifact, target, { ...draft, title: "" }).errors[0], /title/u);
  assert.match(prepareVisualChartSpecEdit(artifact, target, { ...draft, color: "red" }).errors[0], /color/u);
  assert.match(prepareVisualChartSpecEdit(artifact, target, { ...draft, maxItems: 21 }).errors[0], /maxItems/u);
});

test("withholds Chart edit targets from invalid or non-Chart source", () => {
  const invalid = { ...chartArtifact(), source: "{}" };
  assert.deepEqual(derivePreviewSourceTargets(invalid), []);
  const document = { id: "brief", name: "brief.md", kind: "document", language: "Markdown", source: "# Brief" };
  const fake = {
    id: "chart-spec:0:0",
    index: 0,
    kind: "chart-spec",
    label: "Brief",
    start: 0,
    end: document.source.length,
  };
  assert.equal(canVisualEditChartSpec(document, fake), false);
  assert.match(
    prepareVisualChartSpecEdit(document, fake, {
      title: "Brief",
      description: "",
      mark: "bar",
      category: "Item",
      value: "Value",
      sort: "source",
      format: "number",
      color: "#ff5c35",
      maxItems: 8,
    }).errors[0],
    /Chart JSON/u,
  );
});
