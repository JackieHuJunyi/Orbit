import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_WORKSPACE_AGENT_ARTIFACTS,
  buildWorkspaceDependencyGraph,
  dependencyEdgesForContext,
  selectWorkspaceAgentContext,
  workspaceAgentContextIsClosed,
} from "../app/lib/dependency-graph.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";

test("compiles canonical data, query, metric, chart, and embed dependencies", () => {
  const graph = buildWorkspaceDependencyGraph(defaultArtifacts);
  assert.deepEqual(graph.issues, []);
  assert.deepEqual(graph.edges.map((edge) => [
    edge.fromArtifactId,
    edge.toArtifactId,
    edge.kind,
    edge.label,
  ]), [
    ["regional-revenue", "q2-review", "metric", "5 metrics"],
    ["regional-revenue", "regional-analysis", "query", "workspace_data"],
    ["regional-revenue", "regional-revenue-chart", "chart-data", "Region → Q2 Revenue"],
    ["regional-revenue", "board-briefing", "metric", "4 metrics"],
    ["regional-revenue-chart", "q2-review", "chart-embed", "chart embed"],
    ["regional-revenue-chart", "board-briefing", "chart-embed", "chart embed"],
  ]);
});

test("selects a deterministic dependency-first Agent context instead of the whole workspace", () => {
  const extraArtifacts = Array.from({ length: 7 }, (_, index) => ({
    id: `notes-${index}`,
    name: `notes-${index}.md`,
    kind: "document",
    language: "Markdown",
    source: `# Notes ${index}\n\n{{ metric(\"total_revenue\") }}`,
  }));
  const workspace = [...defaultArtifacts, ...extraArtifacts];
  const graph = buildWorkspaceDependencyGraph(workspace);
  const context = selectWorkspaceAgentContext(workspace, graph, "q2-review");
  assert.equal(context.length, MAX_WORKSPACE_AGENT_ARTIFACTS);
  assert.deepEqual(context.slice(0, 5).map((artifact) => artifact.id), [
    "q2-review",
    "regional-revenue",
    "regional-analysis",
    "regional-revenue-chart",
    "board-briefing",
  ]);
  assert.equal(context[5].id, "notes-0");
  assert.equal(context.some((artifact) => artifact.id === "notes-6"), false);
  assert.equal(workspaceAgentContextIsClosed(graph, context), true);
  assert.deepEqual(
    dependencyEdgesForContext(graph, context).map((edge) => edge.kind).sort(),
    ["chart-data", "chart-embed", "chart-embed", "metric", "metric", "metric", "query"],
  );
});

test("keeps the selected artifact while enforcing per-file and total context budgets", () => {
  const selected = {
    id: "report",
    name: "report.md",
    kind: "document",
    language: "Markdown",
    source: "# Report\n\n{{ metric(\"total_revenue\") }}",
  };
  const oversizedData = {
    id: "data",
    name: "data.csv",
    kind: "data",
    language: "CSV / JSON",
    source: `Item,Value\n${"x".repeat(100_001)},1`,
  };
  const smallDeck = {
    id: "deck",
    name: "deck.deck.md",
    kind: "slides",
    language: "Deck Markdown",
    source: "---\nversion: 1\ntitle: Deck\ntheme: rune\nratio: 16:9\nlang: en\n---\n\n# Deck",
  };
  const workspace = [selected, oversizedData, smallDeck];
  const graph = buildWorkspaceDependencyGraph(workspace);
  assert.deepEqual(
    selectWorkspaceAgentContext(workspace, graph, selected.id).map((artifact) => artifact.id),
    ["report"],
  );
  assert.equal(workspaceAgentContextIsClosed(graph, [selected]), false);
});

test("does not pad an isolated selection with unrelated workspace artifacts", () => {
  const workspace = [
    {
      id: "selected-notes",
      name: "selected-notes.md",
      kind: "document",
      language: "Markdown",
      source: "# Selected notes",
    },
    {
      id: "unrelated-notes",
      name: "unrelated-notes.md",
      kind: "document",
      language: "Markdown",
      source: "# Unrelated notes",
    },
  ];
  const graph = buildWorkspaceDependencyGraph(workspace);
  assert.deepEqual(graph, { edges: [], issues: [] });
  assert.deepEqual(
    selectWorkspaceAgentContext(workspace, graph, "selected-notes").map((artifact) => artifact.id),
    ["selected-notes"],
  );
});

test("reports unresolved graph intent without inventing dependency nodes", () => {
  const workspace = [
    {
      id: "report",
      name: "report.md",
      kind: "document",
      language: "Markdown",
      source: "# Report\n\n{{ metric(\"missing\") }}\n\n{{ chart(\"missing-chart\") }}",
    },
    {
      id: "chart",
      name: "chart.chart.json",
      kind: "chart",
      language: "Chart JSON",
      source: '{"version":1,"title":"Chart","description":"","source":"missing-data","mark":"bar","category":"Item","value":"Value","sort":"source","format":"number","color":"#ff5c35","maxItems":8}',
    },
  ];
  const graph = buildWorkspaceDependencyGraph(workspace);
  assert.deepEqual(graph.edges, []);
  assert.deepEqual(graph.issues.map((issue) => issue.kind), ["chart-embed", "metric", "chart-data"]);
  assert.match(graph.issues[0].message, /missing-chart/);
  assert.match(graph.issues[1].message, /missing/);
  assert.match(graph.issues[2].message, /missing-data/);
});
