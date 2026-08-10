import assert from "node:assert/strict";
import test from "node:test";

import {
  findChartReferences,
  parseChartSource,
  renderChartModelHtml,
  renderChartReferencesToHtml,
  resolveChartModel,
  tokenizeChartReferences,
} from "../app/lib/charts.ts";
import { defaultArtifacts, parseDataSource } from "../app/lib/workspace.ts";

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
