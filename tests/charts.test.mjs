import assert from "node:assert/strict";
import test from "node:test";

import {
  chartQuerySourceIdsForArtifact,
  findChartReferences,
  parseChartSource,
  renderChartModelHtml,
  renderChartReferencesToHtml,
  resolveChartModel,
  tokenizeChartReferences,
  validateChartSourceBinding,
} from "../app/lib/charts.ts";
import { defaultArtifacts, parseDataSource } from "../app/lib/workspace.ts";
import { defaultQuerySnapshot } from "./query-snapshot-fixture.mjs";

function chartArtifact() {
  const artifact = defaultArtifacts.find((item) => item.kind === "chart");
  assert.ok(artifact);
  return artifact;
}

test("parses the bounded Chart JSON contract", () => {
  const parsed = parseChartSource(chartArtifact().source);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.spec?.source, "regional-revenue");
  assert.equal(parsed.spec?.mark, "bar");
  assert.equal(parseChartSource('{"version":1,"title":"x"}').spec, undefined);
  assert.match(parseChartSource('{"version":1,"title":"x"}').errors.join(" "), /source|mark|category|value/i);
});

test("projects canonical CSV rows into a sorted local chart model", () => {
  const resolution = resolveChartModel(chartArtifact(), defaultArtifacts, parseDataSource);
  assert.deepEqual(resolution.errors, []);
  assert.ok(resolution.model);
  assert.equal(resolution.model.sourceArtifactName, "regional-revenue.csv");
  assert.deepEqual(resolution.model.data.map((datum) => datum.label), ["APAC", "North America", "Europe", "LATAM"]);
  assert.deepEqual(resolution.model.data.map((datum) => datum.sourceRowIndex), [0, 1, 2, 3]);
  assert.equal(resolution.model.data[0].formatted, "$1.84M");
  assert.equal(resolution.model.data[2].formatted, "$970K");
  assert.equal(resolution.model.data[0].ratio, 1);
});

test("keeps exact source-row provenance through chart sorting and duplicate labels", () => {
  const data = {
    id: "data",
    name: "data.csv",
    kind: "data",
    language: "CSV / JSON",
    source: "Region,Revenue\nShared,10\nShared,30\nOther,20",
  };
  const chart = {
    id: "chart",
    name: "chart.chart.json",
    kind: "chart",
    language: "Chart JSON",
    source: JSON.stringify({
      version: 1,
      title: "Revenue",
      description: "",
      source: "data",
      mark: "bar",
      category: "Region",
      value: "Revenue",
      sort: "descending",
      format: "number",
      color: "#ff5c35",
      maxItems: 2,
    }),
  };
  const resolution = resolveChartModel(chart, [data, chart], parseDataSource);
  assert.ok(resolution.model);
  assert.deepEqual(resolution.model.data.map((datum) => datum.label), ["Shared", "Other"]);
  assert.deepEqual(resolution.model.data.map((datum) => datum.sourceRowIndex), [1, 2]);
});

test("projects a revision-bound Query result into a Chart without inventing cell lineage", () => {
  const chart = defaultArtifacts.find((artifact) => artifact.id === "regional-margin-chart");
  const report = defaultArtifacts.find((artifact) => artifact.id === "q2-review");
  const deck = defaultArtifacts.find((artifact) => artifact.id === "board-briefing");
  assert.ok(chart && report && deck);
  const snapshot = defaultQuerySnapshot();
  assert.deepEqual(validateChartSourceBinding(chart, defaultArtifacts, parseDataSource), []);
  assert.deepEqual(chartQuerySourceIdsForArtifact(report, defaultArtifacts), ["regional-analysis"]);
  assert.deepEqual(chartQuerySourceIdsForArtifact(deck, defaultArtifacts), ["regional-analysis"]);

  const resolution = resolveChartModel(chart, defaultArtifacts, parseDataSource, [snapshot]);
  assert.deepEqual(resolution.errors, []);
  assert.ok(resolution.model);
  assert.equal(resolution.model.sourceArtifactKind, "query");
  assert.equal(resolution.model.sourceArtifactName, "regional-analysis.sql");
  assert.deepEqual(resolution.model.data.map((datum) => datum.label), ["APAC", "North America", "LATAM", "Europe"]);
  assert.deepEqual(resolution.model.data.map((datum) => datum.formatted), ["39.1%", "35.3%", "30.0%", "28.9%"]);
  assert.deepEqual(resolution.model.data.map((datum) => datum.sourceRowIndex), [0, 1, 3, 2]);
  assert.deepEqual(resolution.model.data.map((datum) => datum.categoryProvenance), [0, 1, 3, 2].map((sourceRowIndex) => ({
    artifactId: "regional-revenue",
    sourceRowIndex,
    sourceColumn: "Region",
  })));
  assert.deepEqual(resolution.model.data.map((datum) => datum.valueProvenance), [null, null, null, null]);
});

test("keeps a Query-backed Chart on its explicit Data source after workspace reordering", () => {
  const chart = defaultArtifacts.find((artifact) => artifact.id === "regional-margin-chart");
  assert.ok(chart);
  const decoy = {
    id: "decoy-data",
    name: "decoy.csv",
    kind: "data",
    language: "CSV / JSON",
    source: "Region,Q2 Revenue,Q1 Revenue,Cost,Customers\nWrong,1,1,1,1",
  };
  const workspace = [decoy, ...defaultArtifacts];
  assert.deepEqual(validateChartSourceBinding(chart, workspace, parseDataSource), []);
  const resolution = resolveChartModel(chart, workspace, parseDataSource, [defaultQuerySnapshot()]);
  assert.deepEqual(resolution.errors, []);
  assert.equal(resolution.model?.data[0].categoryProvenance?.artifactId, "regional-revenue");
});

test("rejects missing, stale, truncated, or schema-drifting Query chart snapshots", () => {
  const chart = defaultArtifacts.find((artifact) => artifact.id === "regional-margin-chart");
  assert.ok(chart);
  const snapshot = defaultQuerySnapshot();
  assert.match(resolveChartModel(chart, defaultArtifacts, parseDataSource).errors[0], /still running/i);
  assert.match(resolveChartModel(chart, defaultArtifacts.map((artifact) => (
    artifact.id === "regional-revenue" ? { ...artifact, source: `${artifact.source}\n` } : artifact
  )), parseDataSource, [snapshot]).errors[0], /stale/i);
  assert.match(resolveChartModel(chart, defaultArtifacts, parseDataSource, [{
    ...snapshot,
    result: { ...snapshot.result, truncated: true },
  }]).errors[0], /exceeds 500 rows/i);
  assert.match(validateChartSourceBinding({
    ...chart,
    source: chart.source.replace('"margin_pct"', '"missing_metric"'),
  }, defaultArtifacts, parseDataSource)[0], /not found in Query output/i);
});

test("escapes chart text when compiling a static slide embed", () => {
  const unsafe = {
    ...chartArtifact(),
    source: chartArtifact().source.replace("Q2 revenue by region", "<img src=x onerror=alert(1)>")
  };
  const resolution = resolveChartModel(unsafe, defaultArtifacts, parseDataSource);
  assert.ok(resolution.model);
  const html = renderChartModelHtml(resolution.model);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<script/i);
});

test("finds and tokenizes chart references without evaluating source", () => {
  const source = '# Review\n\n{{ chart("regional-revenue-chart") }}\n\nEnd';
  assert.deepEqual(findChartReferences(source), ["regional-revenue-chart"]);
  assert.deepEqual(tokenizeChartReferences(source).map((part) => part.type), ["source", "chart", "source"]);
});

test("compiles a chart directive into static sandbox-safe slide HTML", () => {
  const source = '<section>{{ chart("regional-revenue-chart") }}</section>';
  const html = renderChartReferencesToHtml(source, (id) => {
    const chart = defaultArtifacts.find((artifact) => artifact.id === id);
    return chart ? resolveChartModel(chart, defaultArtifacts, parseDataSource) : { errors: ["Missing chart"] };
  });
  assert.doesNotMatch(html, /\{\{\s*chart/);
  assert.match(html, /class="rune-embedded-chart"/);
  assert.match(html, /Q2 revenue by region/);
});
