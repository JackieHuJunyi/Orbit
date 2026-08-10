import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentPatchSchema,
  AgentRequestSchema,
  AgentWorkspacePatchSchema,
  buildAgentInput,
  buildAgentInstructions,
} from "../app/lib/agent-contract.ts";

const request = {
  artifact: {
    id: "report",
    name: "report.md",
    kind: "document",
    language: "Markdown",
    source: "# Report\n\nRevenue: {{ metric(\"total_revenue\") }}",
  },
  prompt: "Make the conclusion more concise.",
  metrics: { total_revenue: "$4.82M" },
};

test("accepts a bounded artifact request and preserves metric context", () => {
  const parsed = AgentRequestSchema.parse(request);
  assert.match(buildAgentInstructions(parsed), /Preserve useful headings/);
  assert.match(buildAgentInput(parsed), /total_revenue/);
});

test("requires a complete reviewable patch", () => {
  assert.equal(AgentPatchSchema.safeParse({ summary: "Shorten it" }).success, false);
  assert.equal(AgentPatchSchema.safeParse({
    summary: "Shorten the conclusion",
    detail: "Only the conclusion changes.",
    nextSource: "# Report\n\nA concise conclusion.",
  }).success, true);
});

test("rejects oversized or empty agent inputs before provider calls", () => {
  assert.equal(AgentRequestSchema.safeParse({ ...request, prompt: "" }).success, false);
  assert.equal(AgentRequestSchema.safeParse({ ...request, prompt: "x".repeat(2_001) }).success, false);
});

test("constrains query patches to read-only DuckDB SQL", () => {
  const queryRequest = AgentRequestSchema.parse({
    ...request,
    artifact: {
      id: "analysis",
      name: "analysis.sql",
      kind: "query",
      language: "DuckDB SQL",
      source: "SELECT * FROM workspace_data;",
    },
  });
  assert.match(buildAgentInstructions(queryRequest), /read-only DuckDB/);
  assert.match(buildAgentInstructions(queryRequest), /workspace_data/);
});

test("constrains chart patches to the strict data-bound JSON contract", () => {
  const chartRequest = AgentRequestSchema.parse({
    ...request,
    artifact: {
      id: "revenue-chart",
      name: "revenue.chart.json",
      kind: "chart",
      language: "Chart JSON",
      source: '{"version":1,"title":"Revenue","description":"","source":"data","mark":"bar","category":"Region","value":"Revenue","sort":"descending","format":"currency","color":"#ff5c35","maxItems":8}',
    },
  });
  assert.match(buildAgentInstructions(chartRequest), /strict Chart JSON/);
  assert.match(buildAgentInstructions(chartRequest), /six-digit hex/);
});

test("keeps Deck Markdown model output out of the raw HTML runtime", () => {
  const deck = defaultDeckRequest();
  assert.match(buildAgentInstructions(deck), /complete Deck Markdown/);
  assert.match(buildAgentInstructions(deck), /Never return raw HTML/);
  assert.match(buildAgentInstructions(deck), /manual slide numbers/);
});

function defaultDeckRequest() {
  return AgentRequestSchema.parse({
    ...request,
    artifact: {
      id: "deck",
      name: "deck.deck.md",
      kind: "slides",
      language: "Deck Markdown",
      source: "---\ntitle: Deck\ntheme: rune\nratio: 16:9\nlang: en\n---\n\n<!-- layout: cover -->\n\n# Deck",
    },
  });
}

test("builds a bounded workspace request with coordinated file instructions", () => {
  const workspaceRequest = AgentRequestSchema.parse({
    ...request,
    scope: "workspace",
    workspaceArtifacts: [
      request.artifact,
      {
        id: "deck",
        name: "deck.html",
        kind: "slides",
        language: "Semantic HTML",
        source: "<main><section>Quarterly conclusion</section></main>",
      },
    ],
  });
  assert.match(buildAgentInstructions(workspaceRequest), /coordinated, reviewable outcome/);
  assert.match(buildAgentInstructions(workspaceRequest), /1-4 complete file patches/);
  assert.match(buildAgentInput(workspaceRequest), /workspaceArtifacts/);
  assert.match(buildAgentInput(workspaceRequest), /selectedArtifactId/);
});

test("rejects ambiguous or oversized workspace context before provider calls", () => {
  assert.equal(AgentRequestSchema.safeParse({
    ...request,
    scope: "workspace",
    workspaceArtifacts: [request.artifact, request.artifact],
  }).success, false);
  assert.equal(AgentRequestSchema.safeParse({
    ...request,
    scope: "workspace",
    workspaceArtifacts: [
      { ...request.artifact, id: "another-report" },
      { ...request.artifact, id: "third-report" },
    ],
  }).success, false);

  const largeArtifact = { ...request.artifact, source: "x".repeat(95_000) };
  assert.equal(AgentRequestSchema.safeParse({
    ...request,
    scope: "workspace",
    artifact: largeArtifact,
    workspaceArtifacts: [largeArtifact, { ...largeArtifact, id: "large-deck", name: "large-deck.md" }],
  }).success, false);
});

test("requires one to four complete file patches in a workspace plan", () => {
  const filePatch = {
    artifactId: "report",
    summary: "Align the conclusion",
    detail: "The report now uses the shared quarterly conclusion.",
    nextSource: "# Aligned report",
  };
  assert.equal(AgentWorkspacePatchSchema.safeParse({
    summary: "Coordinate the workspace",
    detail: "One report changes.",
    patches: [filePatch],
  }).success, true);
  assert.equal(AgentWorkspacePatchSchema.safeParse({
    summary: "No changes",
    detail: "Nothing changes.",
    patches: [],
  }).success, false);
  assert.equal(AgentWorkspacePatchSchema.safeParse({
    summary: "Too many changes",
    detail: "Five files change.",
    patches: Array.from({ length: 5 }, (_, index) => ({ ...filePatch, artifactId: `file-${index}` })),
  }).success, false);
});
