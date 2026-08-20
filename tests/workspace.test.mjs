import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultArtifacts,
  detectArtifact,
  normalizeWorkspaceArtifacts,
  parseDataSource,
  planLocalChange,
  planLocalWorkspaceChange,
  validateArtifact,
} from "../app/lib/workspace.ts";
import {
  compileArtifactSource,
  deriveWorkspaceMetrics,
  findMetricReferences,
  findQueryMetricReferences,
} from "../app/lib/bindings.ts";
import { prepareWorkspacePatch, validateWorkspaceArtifacts } from "../app/lib/patches.ts";
import { compileLegacyHtmlSlides } from "../app/lib/legacy-html-slides.ts";
import { parseQueryDataSourceDirective } from "../app/lib/query-source.ts";
import { defaultSummaryQuerySnapshot } from "./query-snapshot-fixture.mjs";

test("parses the sample CSV without sending data anywhere", () => {
  const artifact = defaultArtifacts.find((item) => item.kind === "data");
  assert.ok(artifact);
  const parsed = parseDataSource(artifact.source);
  assert.equal(parsed.format, "CSV");
  assert.equal(parsed.rows.length, 4);
  assert.deepEqual(parsed.errors, []);
  assert.ok(parsed.columns.includes("Q2 Revenue"));
});

test("supports structured JSON data", () => {
  const parsed = parseDataSource('[{"region":"APAC","revenue":1840000}]');
  assert.equal(parsed.format, "JSON");
  assert.deepEqual(parsed.columns, ["region", "revenue"]);
  assert.equal(parsed.rows[0].revenue, 1840000);
});

test("plans data changes as a reviewable next source", () => {
  const artifact = defaultArtifacts.find((item) => item.kind === "data");
  assert.ok(artifact);
  const plan = planLocalChange(artifact, "增加利润率列");
  assert.notEqual(plan.nextSource, artifact.source);
  assert.match(plan.nextSource, /Margin/);
  assert.match(plan.nextSource, /39\.1%/);
});

test("ships a DuckDB query artifact with a deterministic local plan", () => {
  const query = defaultArtifacts.find((item) => item.kind === "query");
  assert.ok(query);
  assert.match(query.source, /FROM workspace_data/);
  assert.deepEqual(parseQueryDataSourceDirective(query.source), {
    artifactId: "regional-revenue",
    explicit: true,
    errors: [],
  });
  assert.deepEqual(validateArtifact(query), []);
  const plan = planLocalChange(query, "汇总季度收入");
  assert.match(plan.nextSource, /SUM\("Q2 Revenue"\)/);
  assert.match(plan.summary, /Summarize the quarter/);
});

test("recognizes imported SQL and migrates older device workspaces", () => {
  const imported = detectArtifact("analysis.sql", "SELECT * FROM workspace_data;");
  assert.equal(imported?.kind, "query");
  const oldDocument = { ...defaultArtifacts[0], source: "# Preserved draft" };
  const restored = normalizeWorkspaceArtifacts([oldDocument]);
  assert.equal(restored.find((item) => item.id === oldDocument.id)?.source, "# Preserved draft");
  assert.ok(restored.some((item) => item.kind === "query"));
  assert.ok(restored.some((item) => item.kind === "chart"));
});

test("preserves an older custom Query without injecting an incompatible default Chart", () => {
  const data = defaultArtifacts.find((item) => item.kind === "data");
  const query = defaultArtifacts.find((item) => item.kind === "query");
  assert.ok(data && query);
  const customQuery = {
    ...query,
    source: 'SELECT Region, "Q2 Revenue" AS revenue FROM workspace_data ORDER BY revenue DESC;',
  };
  const restored = normalizeWorkspaceArtifacts([data, customQuery]);
  assert.equal(restored.find((item) => item.id === query.id)?.source, customQuery.source);
  assert.equal(
    restored.some((item) => item.id === "regional-margin-chart"),
    false,
  );
  assert.equal(
    restored.some((item) => item.source.includes('{{ chart("regional-margin-chart") }}')),
    false,
  );
  assert.deepEqual(validateWorkspaceArtifacts(restored), []);
});

test("recognizes and plans validated Chart JSON artifacts", () => {
  const chart = defaultArtifacts.find((item) => item.kind === "chart");
  assert.ok(chart);
  assert.deepEqual(validateArtifact(chart), []);
  assert.equal(detectArtifact("growth.chart.json", chart.source)?.kind, "chart");
  const plan = planLocalChange(chart, "改成紫色强调");
  assert.match(plan.nextSource, /#8267ce/);
  assert.deepEqual(validateArtifact({ ...chart, source: plan.nextSource }), []);
});

test("keeps slide scripts out of the trusted preview contract", () => {
  const artifact = {
    id: "unsafe",
    name: "unsafe.html",
    kind: "slides",
    language: "Semantic HTML",
    source: "<main><section>Safe</section><script>alert(1)</script></main>",
  };
  assert.match(validateArtifact(artifact)[0], /Scripts are blocked/);
});

test("compiles document and slide metrics from the shared CSV source", () => {
  const document = defaultArtifacts.find((item) => item.kind === "document");
  const slides = defaultArtifacts.find((item) => item.kind === "slides");
  assert.ok(document);
  assert.ok(slides);
  const summarySnapshot = defaultSummaryQuerySnapshot();
  const documentResult = compileArtifactSource(document.source, defaultArtifacts, [summarySnapshot]);
  const slidesResult = compileArtifactSource(slides.source, defaultArtifacts, [summarySnapshot]);
  assert.match(documentResult.source, /\$4\.82M/);
  assert.match(documentResult.source, /12\.4%/);
  assert.doesNotMatch(documentResult.source, /\{\{\s*metric/);
  assert.deepEqual(findMetricReferences(slides.source), ["top_region"]);
  assert.equal(findQueryMetricReferences(slides.source).length, 3);
  assert.deepEqual(slidesResult.unresolved, []);
  assert.deepEqual(documentResult.chartReferences, ["regional-revenue-chart", "regional-margin-chart"]);
  assert.deepEqual(slidesResult.chartReferences, ["regional-revenue-chart", "regional-margin-chart"]);
  assert.deepEqual(documentResult.unresolvedCharts, []);
});

test("recompiles every artifact when the canonical data changes", () => {
  const changed = defaultArtifacts.map((artifact) =>
    artifact.kind === "data"
      ? { ...artifact, source: artifact.source.replace("APAC,1840000", "APAC,2840000") }
      : artifact,
  );
  const metrics = deriveWorkspaceMetrics(changed);
  assert.equal(metrics.total_revenue.formatted, "$5.82M");
  const document = changed.find((item) => item.kind === "document");
  const changedData = changed.find((item) => item.kind === "data");
  assert.ok(document);
  assert.ok(changedData);
  const snapshot = defaultSummaryQuerySnapshot();
  const changedSnapshot = {
    ...snapshot,
    dataSource: changedData.source,
    result: { ...snapshot.result, rows: [[5_820_000, 35.7, 45, 2_840_000, 392]] },
  };
  assert.match(compileArtifactSource(document.source, changed, [changedSnapshot]).source, /\$5\.82M/);
  assert.match(document.source, /metric\("regional-summary", "total_q2_revenue", "currency"\)/);
});

test("coordinates analysis, report, and slides as one valid local workspace plan", () => {
  const plan = planLocalWorkspaceChange(defaultArtifacts, "让分析、报告和演示保持一致");
  assert.equal(plan.patches.length, 2);
  assert.equal(new Set(plan.patches.map((patch) => patch.artifactId)).size, 2);
  assert.deepEqual(
    plan.patches.map((patch) => defaultArtifacts.find((artifact) => artifact.id === patch.artifactId)?.kind),
    ["document", "slides"],
  );
  const prepared = prepareWorkspacePatch(defaultArtifacts, plan.patches);
  assert.deepEqual(prepared.errors, []);
  assert.equal(
    prepared.nextArtifacts.find((artifact) => artifact.kind === "query")?.source,
    defaultArtifacts.find((artifact) => artifact.kind === "query")?.source,
  );
  const nextSlides = prepared.nextArtifacts.find((artifact) => artifact.kind === "slides")?.source ?? "";
  assert.match(nextSlides, /data-layout="conclusion"/);
  const compiledSlides = compileLegacyHtmlSlides(nextSlides);
  assert.deepEqual(compiledSlides.errors, []);
  assert.equal(compiledSlides.slides.length, 5);
  assert.match(compiledSlides.slides[0].source, /01 \/ 05/);
  assert.match(compiledSlides.slides[4].source, /05 \/ 05/);
});
