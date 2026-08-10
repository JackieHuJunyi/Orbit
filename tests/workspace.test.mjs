import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultArtifacts,
  detectArtifact,
  normalizeWorkspaceArtifacts,
  parseDataSource,
  planLocalChange,
  validateArtifact,
} from "../app/lib/workspace.ts";
import {
  compileArtifactSource,
  deriveWorkspaceMetrics,
  findMetricReferences,
} from "../app/lib/bindings.ts";

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
  const documentResult = compileArtifactSource(document.source, defaultArtifacts);
  const slidesResult = compileArtifactSource(slides.source, defaultArtifacts);
  assert.match(documentResult.source, /\$4\.82M/);
  assert.match(documentResult.source, /\+12\.4%/);
  assert.doesNotMatch(documentResult.source, /\{\{\s*metric/);
  assert.ok(findMetricReferences(slides.source).length >= 5);
  assert.deepEqual(slidesResult.unresolved, []);
});

test("recompiles every artifact when the canonical data changes", () => {
  const changed = defaultArtifacts.map((artifact) => artifact.kind === "data"
    ? { ...artifact, source: artifact.source.replace("APAC,1840000", "APAC,2840000") }
    : artifact);
  const metrics = deriveWorkspaceMetrics(changed);
  assert.equal(metrics.total_revenue.formatted, "$5.82M");
  const document = changed.find((item) => item.kind === "document");
  assert.ok(document);
  assert.match(compileArtifactSource(document.source, changed).source, /\$5\.82M/);
  assert.match(document.source, /metric\("total_revenue"\)/);
});
