import assert from "node:assert/strict";
import test from "node:test";

import { planLocalWorkspaceAgentChange } from "../app/lib/local-workspace-agent.ts";
import { buildWorkspaceTransactionReview } from "../app/lib/transaction-review.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";

test("derives one focused Data-to-Query-to-Chart-to-deliverables transaction map", () => {
  const plan = planLocalWorkspaceAgentChange(
    defaultArtifacts,
    "根据收入数据创建分析图表、报告和演示",
  );
  const review = buildWorkspaceTransactionReview(defaultArtifacts, plan.patches, plan.creations);
  const createdArtifacts = plan.creations.map((creation) => creation.artifact);
  const [query, chart, report, deck] = createdArtifacts;

  assert.deepEqual(review.errors, []);
  assert.deepEqual(review.issues, []);
  assert.equal(review.changeCount, 4);
  assert.equal(review.createdCount, 4);
  assert.equal(review.editedCount, 0);
  assert.equal(review.validatedCount, 0);
  assert.equal(review.inputCount, 1);
  assert.deepEqual(review.nodes.map((node) => [node.artifactId, node.status]), [
    ["regional-revenue", "input"],
    [query.id, "created"],
    [chart.id, "created"],
    [report.id, "created"],
    [deck.id, "created"],
  ]);
  assert.equal(review.nodes.some((node) => node.artifactId === "q2-review"), false);
  assert.deepEqual(review.edges.map((edge) => [
    edge.fromArtifactId,
    edge.toArtifactId,
    edge.kind,
    edge.status,
  ]), [
    ["regional-revenue", query.id, "query", "added"],
    [query.id, chart.id, "chart-query", "added"],
    [chart.id, report.id, "chart-embed", "added"],
    [chart.id, deck.id, "chart-embed", "added"],
  ]);
  assert.equal(review.addedEdgeCount, 4);
  assert.equal(review.removedEdgeCount, 0);
  assert.equal(review.updatedEdgeCount, 0);
});

test("shows every transitively validated consumer of a proposed Data edit", () => {
  const data = defaultArtifacts.find((artifact) => artifact.id === "regional-revenue");
  assert.ok(data);
  const review = buildWorkspaceTransactionReview(defaultArtifacts, [{
    artifactId: data.id,
    summary: "Update APAC revenue",
    detail: "One canonical numeric value changes.",
    nextSource: data.source.replace("APAC,1840000", "APAC,1850000"),
  }], []);

  assert.deepEqual(review.errors, []);
  assert.equal(review.nodes.length, defaultArtifacts.length);
  assert.equal(review.editedCount, 1);
  assert.equal(review.validatedCount, defaultArtifacts.length - 1);
  assert.equal(review.inputCount, 0);
  assert.equal(review.edges.length, 12);
  assert.equal(review.edges.every((edge) => edge.status === "retained"), true);
  assert.equal(
    review.nodes.find((node) => node.artifactId === "board-briefing")?.status,
    "validated",
  );
});

test("keeps removed bindings visible instead of drawing only the proposed graph", () => {
  const data = {
    id: "data",
    name: "data.csv",
    kind: "data",
    language: "CSV / JSON",
    source: "Region,Revenue\nAPAC,42",
  };
  const chart = {
    id: "chart",
    name: "chart.chart.json",
    kind: "chart",
    language: "Chart JSON",
    source: JSON.stringify({
      version: 1,
      title: "Revenue",
      description: "Revenue by region",
      source: data.id,
      mark: "bar",
      category: "Region",
      value: "Revenue",
      sort: "source",
      format: "currency",
      color: "#ff5c35",
      maxItems: 8,
    }, null, 2),
  };
  const report = {
    id: "report",
    name: "report.md",
    kind: "document",
    language: "Markdown",
    source: '# Report\n\n{{ chart("chart") }}',
  };
  const review = buildWorkspaceTransactionReview([data, chart, report], [{
    artifactId: report.id,
    summary: "Remove the chart",
    detail: "The report becomes text-only.",
    nextSource: "# Report\n\nNo chart in this revision.",
  }], []);

  assert.deepEqual(review.errors, []);
  assert.deepEqual(review.nodes.map((node) => [node.artifactId, node.status]), [
    [data.id, "input"],
    [chart.id, "input"],
    [report.id, "edited"],
  ]);
  assert.deepEqual(review.edges.map((edge) => [edge.kind, edge.status]), [
    ["chart-data", "retained"],
    ["chart-embed", "removed"],
  ]);
  assert.equal(review.removedEdgeCount, 1);
});

test("marks a retained dependency identity as updated when its field contract changes", () => {
  const data = {
    id: "data",
    name: "data.csv",
    kind: "data",
    language: "CSV / JSON",
    source: "Region,Revenue,Cost\nAPAC,42,30",
  };
  const chart = {
    id: "chart",
    name: "chart.chart.json",
    kind: "chart",
    language: "Chart JSON",
    source: JSON.stringify({
      version: 1,
      title: "Regional measure",
      description: "One regional measure",
      source: data.id,
      mark: "bar",
      category: "Region",
      value: "Revenue",
      sort: "source",
      format: "currency",
      color: "#ff5c35",
      maxItems: 8,
    }, null, 2),
  };
  const review = buildWorkspaceTransactionReview([data, chart], [{
    artifactId: chart.id,
    summary: "Chart cost",
    detail: "Retarget the exact numeric field.",
    nextSource: chart.source.replace('"value": "Revenue"', '"value": "Cost"'),
  }], []);

  assert.deepEqual(review.errors, []);
  assert.equal(review.edges.length, 1);
  assert.equal(review.edges[0].status, "updated");
  assert.equal(review.edges[0].previousLabel, "Region → Revenue");
  assert.equal(review.edges[0].label, "Region → Cost");
  assert.equal(review.updatedEdgeCount, 1);
});

test("fails closed when asked to review an invalid mutation", () => {
  const review = buildWorkspaceTransactionReview(defaultArtifacts, [{
    artifactId: "missing",
    summary: "Unknown edit",
    detail: "This identity is not in the workspace.",
    nextSource: "# Missing",
  }], []);
  assert.match(review.errors[0], /Unknown artifact/);
  assert.deepEqual(review.nodes, []);
  assert.deepEqual(review.edges, []);
  assert.equal(review.changeCount, 1);
});
