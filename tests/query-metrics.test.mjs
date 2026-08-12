import assert from "node:assert/strict";
import test from "node:test";

import {
  compileArtifactSource,
  compiledSourceRangeToCanonical,
  findMetricReferences,
  findQueryMetricReferences,
  parseMetricBindings,
  queryMetricSourceIdsForArtifact,
} from "../app/lib/bindings.ts";
import { validateWorkspaceArtifacts } from "../app/lib/patches.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";
import { defaultSummaryQuerySnapshot } from "./query-snapshot-fixture.mjs";

const scalarSource = [
  '{{ metric("regional-summary", "total_q2_revenue", "currency") }}',
  '{{ metric("regional-summary", "qoq_growth_pct", "percent") }}',
  '{{ metric("regional-summary", "total_customers", "number") }}',
].join(" · ");

test("parses exact Query scalar metrics alongside legacy metric compatibility", () => {
  const source = `${scalarSource} · {{ metric('top_region') }}`;
  assert.deepEqual(parseMetricBindings(source).errors, []);
  assert.deepEqual(findMetricReferences(source), ["top_region"]);
  assert.deepEqual(findQueryMetricReferences(source), [
    { queryArtifactId: "regional-summary", column: "total_q2_revenue", format: "currency" },
    { queryArtifactId: "regional-summary", column: "qoq_growth_pct", format: "percent" },
    { queryArtifactId: "regional-summary", column: "total_customers", format: "number" },
  ]);
  assert.deepEqual(queryMetricSourceIdsForArtifact(source), ["regional-summary"]);
});

test("compiles one current Query row into explicitly formatted scalar values", () => {
  const compiled = compileArtifactSource(scalarSource, defaultArtifacts, [defaultSummaryQuerySnapshot()]);
  assert.equal(compiled.source, "$4.82M · 12.4% · 392");
  assert.equal(compiled.sourceOffsets.length, compiled.source.length + 1);
  assert.equal(compiled.sourceOffsets[0], 0);
  assert.equal(compiled.sourceOffsets.at(-1), scalarSource.length);
  const firstBindingEnd = parseMetricBindings(scalarSource).bindings[0].end;
  assert.deepEqual(compiled.sourceOffsets.slice(0, "$4.82M".length + 1), [0, 0, 0, 0, 0, 0, firstBindingEnd]);
  assert.deepEqual(compiledSourceRangeToCanonical(compiled, 0, "$4.82M".length), { start: 0, end: firstBindingEnd });
  assert.equal(compiledSourceRangeToCanonical(compiled, -1, 2), null);
  assert.deepEqual(compiled.metricBindingErrors, []);
  assert.deepEqual(compiled.unresolvedQueryMetrics, []);
  assert.deepEqual(compiled.pendingQueryMetrics, []);
  assert.deepEqual(compiled.queryMetricRuntimeErrors, []);
  assert.equal(Object.keys(compiled.queryMetrics).length, 3);
});

test("keeps scalar compilation pending until the exact Query and Data revision is ready", () => {
  const pending = compileArtifactSource(scalarSource, defaultArtifacts);
  assert.equal(pending.source, "… · … · …");
  assert.deepEqual(pending.pendingQueryMetrics, [
    "regional-summary.total_q2_revenue",
    "regional-summary.qoq_growth_pct",
    "regional-summary.total_customers",
  ]);

  const staleSnapshot = {
    ...defaultSummaryQuerySnapshot(),
    dataSource: "stale",
  };
  const stale = compileArtifactSource(scalarSource, defaultArtifacts, [staleSnapshot]);
  assert.match(stale.queryMetricRuntimeErrors.join(" "), /stale/i);
  assert.match(stale.source, /⚠ regional-summary\.total_q2_revenue/);
});

test("fails closed for malformed, unresolved, multi-row, or non-numeric Query metrics", () => {
  const malformed = '{{ metric("regional-summary", "total_q2_revenue", "money") }}';
  assert.match(parseMetricBindings(malformed).errors.join(" "), /currency, number, percent/i);

  const document = defaultArtifacts.find((artifact) => artifact.kind === "document");
  assert.ok(document);
  const missing = {
    ...document,
    source: '# Missing\n\n{{ metric("missing-query", "total", "number") }}',
  };
  assert.match(validateWorkspaceArtifacts([missing]).join(" "), /Query metric source not found/i);

  const missingColumn = {
    ...document,
    source: '# Missing column\n\n{{ metric("regional-summary", "missing", "number") }}',
  };
  assert.match(validateWorkspaceArtifacts(defaultArtifacts.map((artifact) => (
    artifact.id === document.id ? missingColumn : artifact
  ))).join(" "), /column not found in Query output/i);

  const multiRowSnapshot = {
    ...defaultSummaryQuerySnapshot(),
    result: {
      ...defaultSummaryQuerySnapshot().result,
      rows: [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]],
      sourceRowIndices: [null, null],
      cellLineage: [Array(5).fill(null), Array(5).fill(null)],
    },
  };
  assert.match(
    compileArtifactSource(scalarSource, defaultArtifacts, [multiRowSnapshot]).queryMetricRuntimeErrors.join(" "),
    /exactly one row/i,
  );

  const textSnapshot = {
    ...defaultSummaryQuerySnapshot(),
    result: {
      ...defaultSummaryQuerySnapshot().result,
      rows: [["not numeric", 12.4, 35, 1_840_000, 392]],
    },
  };
  assert.match(
    compileArtifactSource(scalarSource, defaultArtifacts, [textSnapshot]).queryMetricRuntimeErrors.join(" "),
    /finite number/i,
  );
});

test("resolves a Query metric through its explicit Data id after workspace reordering", () => {
  const decoy = {
    id: "decoy-data",
    name: "decoy.csv",
    kind: "data",
    language: "CSV / JSON",
    source: "Region,Q2 Revenue,Q1 Revenue,Cost,Customers\nWrong,1,1,1,1",
  };
  const reordered = [decoy, ...defaultArtifacts];
  const compiled = compileArtifactSource(scalarSource, reordered, [defaultSummaryQuerySnapshot()]);
  assert.equal(compiled.source, "$4.82M · 12.4% · 392");
  assert.deepEqual(compiled.unresolvedQueryMetrics, []);
});
