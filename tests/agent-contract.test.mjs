import assert from "node:assert/strict";
import test from "node:test";
import { zodTextFormat } from "openai/helpers/zod";

import {
  AgentCompiledPatchSchema,
  AgentOperationPatchSchema,
  AgentPatchSchema,
  AgentRequestSchema,
  AgentWorkspacePatchSchema,
  AgentWorkspaceOperationPlanSchema,
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

test("binds Selection Agent context to one exact non-empty source range", () => {
  const source = "# Report\n\nA long conclusion that should become concise.\n\nKeep this paragraph.";
  const start = source.indexOf("A long conclusion");
  const end = source.indexOf("\n\nKeep");
  const parsed = AgentRequestSchema.parse({
    ...request,
    scope: "selection",
    artifact: { ...request.artifact, source },
    selection: { start, end },
  });
  assert.match(buildAgentInstructions(parsed), /source-selection editing agent/i);
  assert.match(buildAgentInstructions(parsed), /rejects any result that crosses the selected range/i);
  const input = JSON.parse(buildAgentInput(parsed));
  assert.deepEqual(input.selection, {
    start,
    end,
    selectedSource: "A long conclusion that should become concise.",
  });
  assert.equal(input.artifact.source, source);
  assert.equal(input.workspaceArtifacts, undefined);
});

test("rejects missing, collapsed, stale, oversized, or misplaced source selections", () => {
  const base = { ...request, scope: "selection" };
  assert.equal(AgentRequestSchema.safeParse(base).success, false);
  assert.equal(AgentRequestSchema.safeParse({ ...base, selection: { start: 2, end: 2 } }).success, false);
  assert.equal(AgentRequestSchema.safeParse({ ...base, selection: { start: 0, end: request.artifact.source.length + 1 } }).success, false);
  const largeSource = "x".repeat(16_001);
  assert.equal(AgentRequestSchema.safeParse({
    ...base,
    artifact: { ...request.artifact, source: largeSource },
    selection: { start: 0, end: largeSource.length },
  }).success, false);
  assert.equal(AgentRequestSchema.safeParse({
    ...request,
    scope: "artifact",
    selection: { start: 0, end: 1 },
  }).success, false);
});

test("keeps a complete compiled source as the internal review contract", () => {
  assert.equal(AgentPatchSchema.safeParse({ summary: "Shorten it" }).success, false);
  assert.equal(AgentPatchSchema.safeParse({
    summary: "Shorten the conclusion",
    detail: "Only the conclusion changes.",
    nextSource: "# Report\n\nA concise conclusion.",
  }).success, true);
});

test("requires bounded typed operations from the model instead of nextSource", () => {
  const operationPlan = {
    summary: "Shorten the conclusion",
    detail: "Only the exact conclusion sentence changes.",
    edits: [{ type: "replace_text", find: "A verbose conclusion.", replace: "A concise conclusion." }],
  };
  assert.equal(AgentOperationPatchSchema.safeParse(operationPlan).success, true);
  assert.equal(AgentOperationPatchSchema.safeParse({
    summary: operationPlan.summary,
    detail: operationPlan.detail,
    nextSource: "# Model-authored whole file",
  }).success, false);
  assert.equal(AgentOperationPatchSchema.safeParse({
    ...operationPlan,
    edits: [{ type: "replace_text", find: "", replace: "Cannot anchor this." }],
  }).success, false);
  assert.equal(AgentOperationPatchSchema.safeParse({
    ...operationPlan,
    edits: Array.from({ length: 9 }, () => operationPlan.edits[0]),
  }).success, false);
  assert.equal(AgentCompiledPatchSchema.safeParse({
    summary: operationPlan.summary,
    detail: operationPlan.detail,
    nextSource: "# Report\n\nA concise conclusion.",
    operationCount: 1,
  }).success, true);
});

test("converts both operation protocols into provider structured-output schemas", () => {
  const artifactFormat = zodTextFormat(AgentOperationPatchSchema, "artifact_operations");
  const workspaceFormat = zodTextFormat(AgentWorkspaceOperationPlanSchema, "workspace_operations");
  assert.equal(artifactFormat.type, "json_schema");
  assert.equal(artifactFormat.name, "artifact_operations");
  assert.equal(workspaceFormat.type, "json_schema");
  assert.equal(workspaceFormat.name, "workspace_operations");
  const operationTypes = artifactFormat.schema.properties.edits.items.anyOf
    .map((operation) => operation.properties.type.const);
  assert.deepEqual(operationTypes, [
    "replace_text",
    "replace_markdown_section",
    "insert_markdown_section_after",
    "upsert_data_row",
    "replace_deck_slide",
    "insert_deck_slide_after",
  ]);
  assert.equal(JSON.stringify(artifactFormat.schema).includes("nextSource"), false);
  const actionTypes = workspaceFormat.schema.properties.actions.items.anyOf
    .map((action) => action.properties.type.const);
  assert.deepEqual(actionTypes, ["patch_artifact", "create_artifact"]);
  const createAction = workspaceFormat.schema.properties.actions.items.anyOf
    .find((action) => action.properties.type.const === "create_artifact");
  assert.deepEqual(Object.keys(createAction.properties).sort(), ["detail", "edits", "kind", "summary", "title", "type"]);
  assert.equal(JSON.stringify(createAction).includes("nextSource"), false);
});

test("accepts strict artifact-aware section, row, and slide operations", () => {
  const base = { summary: "Semantic edit", detail: "Target one stable artifact structure." };
  const operations = [
    { type: "replace_markdown_section", heading: "Conclusion", body: "A concise result." },
    { type: "insert_markdown_section_after", heading: "Summary", section: "## Risks\n\nOne risk." },
    {
      type: "upsert_data_row",
      keyColumn: "Quarter",
      keyValue: "Q2",
      cells: [{ column: "Revenue", value: 42.5 }, { column: "Approved", value: true }],
    },
    { type: "replace_deck_slide", title: "Results", slide: "# Results\n\nImproved." },
    { type: "insert_deck_slide_after", title: "Results", slide: "# Outlook\n\nDurable." },
  ];
  operations.forEach((operation) => {
    assert.equal(AgentOperationPatchSchema.safeParse({ ...base, edits: [operation] }).success, true);
  });
  assert.equal(AgentOperationPatchSchema.safeParse({
    ...base,
    edits: [{ ...operations[0], find: "unexpected" }],
  }).success, false);
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
  const instructions = buildAgentInstructions(queryRequest);
  assert.match(instructions, /read-only DuckDB/);
  assert.match(instructions, /workspace_data/);
  assert.match(instructions, /-- rune:data/);
  assert.match(instructions, /exact existing Data artifact id/);
});

test("constrains chart patches to the strict Data-or-Query JSON contract", () => {
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
  assert.match(buildAgentInstructions(chartRequest), /Data or Query artifact/);
  assert.match(buildAgentInstructions(chartRequest), /explicit AS alias/);
  assert.match(buildAgentInstructions(chartRequest), /six-digit hex/);
});

test("keeps Deck Markdown model output out of the raw HTML runtime", () => {
  const deck = defaultDeckRequest();
  assert.match(buildAgentInstructions(deck), /complete Deck Markdown/);
  assert.match(buildAgentInstructions(deck), /Never introduce raw HTML/);
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
    workspaceDependencies: [{
      fromArtifactId: "report",
      toArtifactId: "deck",
      kind: "metric",
      references: ["total_revenue"],
    }],
    workspacePinnedArtifactIds: ["deck"],
  });
  assert.match(buildAgentInstructions(workspaceRequest), /coordinated, reviewable outcome/);
  assert.match(buildAgentInstructions(workspaceRequest), /1-4 actions/);
  assert.match(buildAgentInstructions(workspaceRequest), /create_artifact/);
  assert.match(buildAgentInstructions(workspaceRequest), /Never provide an id, filename, extension, language, source, or nextSource/);
  assert.match(buildAgentInstructions(workspaceRequest), /Item,Value/);
  assert.match(buildAgentInstructions(workspaceRequest), /find and replace/);
  assert.match(buildAgentInstructions(workspaceRequest), /Markdown by exact heading/);
  assert.match(buildAgentInstructions(workspaceRequest), /rejects missing, ambiguous, type-incompatible/);
  assert.match(buildAgentInstructions(workspaceRequest), /bounded context pack selected from the current dependency graph/);
  assert.match(buildAgentInstructions(workspaceRequest), /deliberately included across otherwise disconnected components/);
  const workspaceInput = JSON.parse(buildAgentInput(workspaceRequest));
  assert.equal(workspaceInput.selectedArtifactId, "report");
  assert.equal(workspaceInput.workspaceArtifacts.length, 2);
  assert.deepEqual(workspaceInput.workspaceDependencies, [{
    fromArtifactId: "report",
    toArtifactId: "deck",
    kind: "metric",
    references: ["total_revenue"],
  }]);
  assert.deepEqual(workspaceInput.workspacePinnedArtifactIds, ["deck"]);
});

test("rejects ambiguous or oversized workspace context before provider calls", () => {
  assert.equal(AgentRequestSchema.safeParse({
    ...request,
    scope: "workspace",
    workspaceArtifacts: [request.artifact, { ...request.artifact, id: "deck", name: "deck.md" }],
  }).success, false);
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

  const workspaceArtifacts = [request.artifact, { ...request.artifact, id: "deck", name: "deck.md" }];
  const dependency = {
    fromArtifactId: "report",
    toArtifactId: "deck",
    kind: "metric",
    references: ["total_revenue"],
  };
  assert.equal(AgentRequestSchema.safeParse({
    ...request,
    scope: "workspace",
    workspaceArtifacts,
    workspaceDependencies: [{ ...dependency, toArtifactId: "foreign" }],
    workspacePinnedArtifactIds: [],
  }).success, false);
  assert.equal(AgentRequestSchema.safeParse({
    ...request,
    scope: "workspace",
    workspaceArtifacts,
    workspaceDependencies: [dependency, dependency],
    workspacePinnedArtifactIds: [],
  }).success, false);
  assert.equal(AgentRequestSchema.safeParse({
    ...request,
    scope: "workspace",
    workspaceArtifacts,
    workspaceDependencies: [],
    workspacePinnedArtifactIds: ["deck", "deck"],
  }).success, false);
  assert.equal(AgentRequestSchema.safeParse({
    ...request,
    scope: "workspace",
    workspaceArtifacts,
    workspaceDependencies: [],
    workspacePinnedArtifactIds: ["foreign"],
  }).success, false);
  assert.equal(AgentRequestSchema.safeParse({
    ...request,
    workspaceDependencies: [],
    workspacePinnedArtifactIds: [],
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

test("requires one to four bounded patch-or-create workspace actions", () => {
  const filePatch = {
    type: "patch_artifact",
    artifactId: "report",
    summary: "Align the conclusion",
    detail: "One exact sentence changes.",
    edits: [{ type: "replace_text", find: "Old conclusion", replace: "Shared conclusion" }],
  };
  assert.equal(AgentWorkspaceOperationPlanSchema.safeParse({
    summary: "Coordinate the workspace",
    detail: "The report and deck use one conclusion.",
    actions: [filePatch, { ...filePatch, artifactId: "deck" }],
  }).success, true);
  const creation = {
    type: "create_artifact",
    kind: "slides",
    title: "Board Briefing",
    summary: "Create the briefing",
    detail: "The new deck starts from Rune's deterministic template.",
    edits: [{ type: "replace_deck_slide", title: "Board Briefing", slide: "# Board Briefing\n\nReview." }],
  };
  assert.equal(AgentWorkspaceOperationPlanSchema.safeParse({
    summary: "Create from context",
    detail: "One new presentation is proposed.",
    actions: [creation],
  }).success, true);
  assert.equal(AgentWorkspaceOperationPlanSchema.safeParse({
    summary: "Reject model-owned identity",
    detail: "Rune must own generated metadata.",
    actions: [{ ...creation, id: "model-id", name: "model.deck.md", source: "# bypass" }],
  }).success, false);
  assert.equal(AgentWorkspaceOperationPlanSchema.safeParse({
    summary: "No changes",
    detail: "Nothing changes.",
    actions: [],
  }).success, false);
});
