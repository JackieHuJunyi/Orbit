import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_WORKSPACE_AGENT_ARTIFACTS,
  MAX_WORKSPACE_AGENT_PINS,
  buildWorkspaceDependencyGraph,
  dependencyEdgesForContext,
  selectWorkspaceAgentContext,
  workspaceAgentContextIsClosed,
} from "../app/lib/dependency-graph.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";

test("compiles canonical data, query, metric, chart, and embed dependencies", () => {
  const graph = buildWorkspaceDependencyGraph(defaultArtifacts);
  assert.deepEqual(graph.issues, []);
  assert.deepEqual(
    graph.edges.map((edge) => [edge.fromArtifactId, edge.toArtifactId, edge.kind, edge.label]),
    [
      ["regional-revenue", "q2-review", "metric", "1 metric"],
      ["regional-revenue", "regional-analysis", "query", "workspace_data · regional-revenue"],
      ["regional-revenue", "regional-summary", "query", "workspace_data · regional-revenue"],
      ["regional-revenue", "regional-revenue-chart", "chart-data", "Region → Q2 Revenue"],
      ["regional-revenue", "board-briefing", "metric", "1 metric"],
      ["regional-analysis", "regional-margin-chart", "chart-query", "query output · Region → margin_pct"],
      ["regional-summary", "q2-review", "query-metric", "4 scalar metrics"],
      ["regional-summary", "board-briefing", "query-metric", "3 scalar metrics"],
      ["regional-revenue-chart", "q2-review", "chart-embed", "chart embed"],
      ["regional-revenue-chart", "board-briefing", "chart-embed", "chart embed"],
      ["regional-margin-chart", "q2-review", "chart-embed", "chart embed"],
      ["regional-margin-chart", "board-briefing", "chart-embed", "chart embed"],
    ],
  );
});

test("keeps an explicitly bound Query on its Data artifact when workspace order changes", () => {
  const decoy = {
    id: "decoy-data",
    name: "decoy.csv",
    kind: "data",
    language: "CSV / JSON",
    source: "Region,Q2 Revenue,Q1 Revenue,Cost,Customers\nWrong,1,1,1,1",
  };
  const data = defaultArtifacts.find((artifact) => artifact.id === "regional-revenue");
  const query = defaultArtifacts.find((artifact) => artifact.id === "regional-analysis");
  const chart = defaultArtifacts.find((artifact) => artifact.id === "regional-margin-chart");
  assert.ok(data && query && chart);
  const workspace = [decoy, data, query, chart];
  const graph = buildWorkspaceDependencyGraph(workspace);
  const queryEdge = graph.edges.find((edge) => edge.kind === "query" && edge.toArtifactId === "regional-analysis");
  assert.equal(queryEdge?.fromArtifactId, "regional-revenue");
  assert.deepEqual(queryEdge?.references, ["regional-revenue"]);
  const context = selectWorkspaceAgentContext(workspace, graph, "regional-margin-chart");
  assert.deepEqual(
    context.map((artifact) => artifact.id),
    ["regional-revenue", "regional-analysis", "regional-margin-chart"],
  );
});

test("connects a Deck Markdown presentation to its exact Document origin", () => {
  const document = { id: "brief", name: "brief.md", kind: "document", language: "Markdown", source: "# Brief" };
  const linkedDeck = {
    id: "deck",
    name: "deck.deck.md",
    kind: "slides",
    language: "Deck Markdown",
    source: `---\nversion: 1\ntitle: Deck\ntheme: orbit\nratio: 16:9\nlang: en\norigin: ${document.id}\n---\n\n# Deck`,
  };
  const graph = buildWorkspaceDependencyGraph([document, linkedDeck]);
  assert.deepEqual(graph.issues, []);
  assert.deepEqual(graph.edges, [
    {
      fromArtifactId: document.id,
      toArtifactId: linkedDeck.id,
      kind: "deck-origin",
      label: "presentation source",
      references: [document.id],
    },
  ]);
  const context = selectWorkspaceAgentContext([document, linkedDeck], graph, linkedDeck.id);
  assert.deepEqual(
    context.map((artifact) => artifact.id),
    [document.id, linkedDeck.id],
  );
  assert.equal(workspaceAgentContextIsClosed(graph, context), true);
  assert.deepEqual(
    dependencyEdgesForContext(graph, context).map((edge) => edge.kind),
    ["deck-origin"],
  );
});

test("connects a semantic HTML presentation to its exact Document origin", () => {
  const document = { id: "brief", name: "brief.md", kind: "document", language: "Markdown", source: "# Brief" };
  const presentation = {
    id: "presentation",
    name: "presentation.html",
    kind: "slides",
    language: "Semantic HTML",
    source:
      '<!doctype html><html lang="en"><body><main data-orbit-format="presentation-v1" data-orbit-title="Presentation" data-orbit-theme="orbit" data-orbit-lang="en" data-orbit-origin="brief"><section><h1>Presentation</h1></section></main></body></html>',
  };
  const graph = buildWorkspaceDependencyGraph([document, presentation]);
  assert.deepEqual(graph.issues, []);
  assert.deepEqual(graph.edges, [
    {
      fromArtifactId: document.id,
      toArtifactId: presentation.id,
      kind: "deck-origin",
      label: "presentation source",
      references: [document.id],
    },
  ]);
});

test("reports a missing Deck origin without inventing a dependency", () => {
  const linkedDeck = {
    id: "deck",
    name: "deck.deck.md",
    kind: "slides",
    language: "Deck Markdown",
    source:
      "---\nversion: 1\ntitle: Deck\ntheme: orbit\nratio: 16:9\nlang: en\norigin: missing-document\n---\n\n# Deck",
  };
  const graph = buildWorkspaceDependencyGraph([linkedDeck]);
  assert.deepEqual(graph.edges, []);
  assert.deepEqual(
    graph.issues.map((issue) => [issue.kind, issue.target]),
    [["deck-origin", "missing-document"]],
  );
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
  assert.deepEqual(
    context.map((artifact) => artifact.id),
    [
      "q2-review",
      "regional-revenue",
      "regional-analysis",
      "regional-summary",
      "regional-revenue-chart",
      "regional-margin-chart",
      "board-briefing",
    ],
  );
  assert.equal(
    context.some((artifact) => artifact.id === "notes-0"),
    false,
  );
  assert.equal(
    context.some((artifact) => artifact.id === "notes-6"),
    false,
  );
  assert.equal(workspaceAgentContextIsClosed(graph, context), true);
  assert.deepEqual(
    dependencyEdgesForContext(graph, context)
      .map((edge) => edge.kind)
      .sort(),
    [
      "chart-data",
      "chart-embed",
      "chart-embed",
      "chart-embed",
      "chart-embed",
      "chart-query",
      "metric",
      "metric",
      "query",
      "query",
      "query-metric",
      "query-metric",
    ],
  );
});

test("keeps the selected artifact while enforcing per-file and total context budgets", () => {
  const selected = {
    id: "report",
    name: "report.md",
    kind: "document",
    language: "Markdown",
    source: '# Report\n\n{{ metric("total_revenue") }}',
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
    source: "---\nversion: 1\ntitle: Deck\ntheme: orbit\nratio: 16:9\nlang: en\n---\n\n# Deck",
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

test("adds explicit pins and their upstream closure without padding other components", () => {
  const isolated = {
    id: "isolated-brief",
    name: "isolated-brief.md",
    kind: "document",
    language: "Markdown",
    source: "# Independent brief",
  };
  const unrelated = {
    id: "unrelated-brief",
    name: "unrelated-brief.md",
    kind: "document",
    language: "Markdown",
    source: "# Unrelated brief",
  };
  const workspace = [...defaultArtifacts, isolated, unrelated];
  const graph = buildWorkspaceDependencyGraph(workspace);
  const context = selectWorkspaceAgentContext(workspace, graph, "q2-review", {
    pinnedArtifactIds: [isolated.id],
  });
  assert.equal(MAX_WORKSPACE_AGENT_PINS, 6);
  assert.deepEqual(
    context.map((artifact) => artifact.id),
    [
      "q2-review",
      "regional-revenue",
      "regional-analysis",
      "regional-summary",
      "regional-revenue-chart",
      "regional-margin-chart",
      "isolated-brief",
    ],
  );
  assert.equal(
    context.some((artifact) => artifact.id === unrelated.id),
    false,
  );
  assert.equal(workspaceAgentContextIsClosed(graph, context), true);
});

test("keeps every explicit root visible when a pinned upstream closure cannot fit", () => {
  const selected = {
    id: "selected",
    name: "selected.md",
    kind: "document",
    language: "Markdown",
    source: "# Selected",
  };
  const pinned = {
    id: "pinned-report",
    name: "pinned-report.md",
    kind: "document",
    language: "Markdown",
    source: '# Pinned\n\n{{ metric("total_revenue") }}',
  };
  const oversizedData = {
    id: "data",
    name: "data.csv",
    kind: "data",
    language: "CSV / JSON",
    source: `Item,Value\n${"x".repeat(100_001)},1`,
  };
  const workspace = [selected, pinned, oversizedData];
  const graph = buildWorkspaceDependencyGraph(workspace);
  const context = selectWorkspaceAgentContext(workspace, graph, selected.id, {
    pinnedArtifactIds: [pinned.id],
  });
  assert.deepEqual(
    context.map((artifact) => artifact.id),
    [selected.id, pinned.id],
  );
  assert.equal(workspaceAgentContextIsClosed(graph, context), false);
});

test("reports unresolved graph intent without inventing dependency nodes", () => {
  const workspace = [
    {
      id: "report",
      name: "report.md",
      kind: "document",
      language: "Markdown",
      source: '# Report\n\n{{ metric("missing") }}\n\n{{ chart("missing-chart") }}',
    },
    {
      id: "chart",
      name: "chart.chart.json",
      kind: "chart",
      language: "Chart JSON",
      source:
        '{"version":1,"title":"Chart","description":"","source":"missing-data","mark":"bar","category":"Item","value":"Value","sort":"source","format":"number","color":"#ff5c35","maxItems":8}',
    },
  ];
  const graph = buildWorkspaceDependencyGraph(workspace);
  assert.deepEqual(graph.edges, []);
  assert.deepEqual(
    graph.issues.map((issue) => issue.kind),
    ["chart-embed", "metric", "chart-data"],
  );
  assert.match(graph.issues[0].message, /missing-chart/);
  assert.match(graph.issues[1].message, /missing/);
  assert.match(graph.issues[2].message, /missing-data/);
});
