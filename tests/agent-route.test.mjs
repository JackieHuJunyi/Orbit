import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../app/api/agent/route.ts";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.OPENAI_MODEL;

test.after(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
  if (originalModel === undefined) delete process.env.OPENAI_MODEL;
  else process.env.OPENAI_MODEL = originalModel;
});

function providerResponse(output) {
  return {
    id: "resp_rune_test",
    object: "response",
    created_at: 0,
    status: "completed",
    model: "gpt-5.6",
    output: [{
      id: "msg_rune_test",
      type: "message",
      status: "completed",
      role: "assistant",
      content: [{
        type: "output_text",
        text: JSON.stringify(output),
        annotations: [],
      }],
    }],
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: 8_000,
    parallel_tool_calls: true,
    previous_response_id: null,
    reasoning: { effort: null, summary: null },
    store: false,
    temperature: 1,
    text: { format: { type: "json_schema" } },
    tool_choice: "auto",
    tools: [],
    top_p: 1,
    truncation: "disabled",
    usage: {
      input_tokens: 1,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: 1,
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: 2,
    },
  };
}

function requestBody(overrides = {}) {
  return {
    scope: "artifact",
    artifact: {
      id: "report",
      name: "report.md",
      kind: "document",
      language: "Markdown",
      source: "# Report\n\nOld conclusion.",
    },
    prompt: "Make the conclusion concise.",
    metrics: {},
    ...overrides,
  };
}

test("compiles a provider Markdown-section operation into the concrete Agent response", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "gpt-5.6";
  let providerRequest;
  globalThis.fetch = async (_input, init) => {
    providerRequest = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(providerResponse({
      summary: "Shorten the conclusion",
      detail: "One Markdown section changes.",
      edits: [{ type: "replace_markdown_section", heading: "Report", body: "Concise conclusion." }],
    })), { status: 200, headers: { "content-type": "application/json" } });
  };

  const response = await POST(new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody()),
  }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.plan.nextSource, "# Report\n\nConcise conclusion.");
  assert.equal(payload.plan.operationCount, 1);
  assert.equal("edits" in payload.plan, false);
  assert.equal(providerRequest.max_output_tokens, 8_000);
  assert.equal(providerRequest.text.format.name, "artifact_operations");
  assert.deepEqual(Object.keys(providerRequest.text.format.schema.properties).sort(), ["detail", "edits", "summary"]);
  const operationTypes = providerRequest.text.format.schema.properties.edits.items.anyOf
    .map((operation) => operation.properties.type.const);
  assert.deepEqual(operationTypes, [
    "replace_text",
    "replace_markdown_section",
    "insert_markdown_section_after",
    "upsert_data_row",
    "replace_deck_slide",
    "insert_deck_slide_after",
  ]);
  assert.equal("nextSource" in providerRequest.text.format.schema.properties, false);
  assert.match(providerRequest.input[0].content, /Markdown by exact heading|ordered edits/i);
});

test("returns a Selection Agent patch only when every compiled change stays in range", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  const source = "# Report\n\nOld conclusion.\n\nKeep this paragraph.";
  const start = source.indexOf("Old conclusion.");
  const end = start + "Old conclusion.".length;
  let providerRequest;
  globalThis.fetch = async (_input, init) => {
    providerRequest = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(providerResponse({
      summary: "Shorten the selected conclusion",
      detail: "Only the exact selected sentence changes.",
      edits: [{ type: "replace_text", find: "Old conclusion.", replace: "Concise conclusion." }],
    })), { status: 200, headers: { "content-type": "application/json" } });
  };
  const response = await POST(new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody({
      scope: "selection",
      artifact: { ...requestBody().artifact, source },
      selection: { start, end },
    })),
  }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.plan.nextSource, "# Report\n\nConcise conclusion.\n\nKeep this paragraph.");
  assert.match(providerRequest.input[0].content, /source-selection editing agent/i);
  const providerInput = JSON.parse(providerRequest.input[1].content);
  assert.deepEqual(providerInput.selection, { start, end, selectedSource: "Old conclusion." });
});

test("rejects a valid typed operation when its concrete effect crosses the selection", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  const source = "# Report\n\nSelected sentence.\n\nOutside sentence.";
  const start = source.indexOf("Selected sentence.");
  const end = start + "Selected sentence.".length;
  globalThis.fetch = async () => new Response(JSON.stringify(providerResponse({
    summary: "Change outside the selection",
    detail: "The range gate must reject this otherwise valid edit.",
    edits: [{ type: "replace_text", find: "Outside sentence.", replace: "Illicit outside change." }],
  })), { status: 200, headers: { "content-type": "application/json" } });
  const response = await POST(new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody({
      scope: "selection",
      artifact: { ...requestBody().artifact, source },
      selection: { start, end },
    })),
  }));
  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.match(payload.error, /crossed the selected source range/i);
  assert.match(payload.details.join(" "), /cross the selected source range/i);
  assert.equal(payload.plan, undefined);
});

test("rejects stale or empty selection offsets before contacting the provider", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  let providerCalled = false;
  globalThis.fetch = async () => {
    providerCalled = true;
    return new Response(JSON.stringify(providerResponse({})), { status: 200 });
  };
  const response = await POST(new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody({ scope: "selection", selection: { start: 3, end: 3 } })),
  }));
  assert.equal(response.status, 400);
  assert.equal(providerCalled, false);
});

test("rejects incomplete or fabricated workspace dependency context before contacting the provider", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  let providerCalled = false;
  globalThis.fetch = async () => {
    providerCalled = true;
    return new Response(JSON.stringify(providerResponse({})), { status: 200 });
  };
  const workspaceArtifacts = [
    requestBody().artifact,
    {
      id: "data",
      name: "data.csv",
      kind: "data",
      language: "CSV / JSON",
      source: "Item,Value\nRevenue,42",
    },
  ];
  const response = await POST(new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody({
      scope: "workspace",
      workspaceArtifacts,
      workspaceDependencies: [{
        fromArtifactId: "data",
        toArtifactId: "report",
        kind: "metric",
        references: ["invented"],
      }],
      workspacePinnedArtifactIds: ["data"],
    })),
  }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /dependency context is stale or invalid/i);
  assert.equal(providerCalled, false);

  const unpinnedResponse = await POST(new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody({
      scope: "workspace",
      workspaceArtifacts,
      workspaceDependencies: [],
      workspacePinnedArtifactIds: [],
    })),
  }));
  assert.equal(unpinnedResponse.status, 400);
  assert.match((await unpinnedResponse.json()).error, /unpinned disconnected artifact/i);
  assert.equal(providerCalled, false);

  const incompleteArtifact = {
    ...requestBody().artifact,
    source: "# Report\n\n{{ chart(\"omitted-chart\") }}",
  };
  const incompleteResponse = await POST(new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody({
      scope: "workspace",
      artifact: incompleteArtifact,
      workspaceArtifacts: [incompleteArtifact, workspaceArtifacts[1]],
      workspaceDependencies: [],
      workspacePinnedArtifactIds: ["data"],
    })),
  }));
  assert.equal(incompleteResponse.status, 400);
  assert.match((await incompleteResponse.json()).error, /dependency context is incomplete or invalid/i);
  assert.equal(providerCalled, false);
});

test("compiles a coordinated document-data-Deck operation plan without partial files", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  const workspaceArtifacts = [
    requestBody().artifact,
    {
      id: "data",
      name: "data.csv",
      kind: "data",
      language: "CSV / JSON",
      source: "Region,Revenue\nAPAC,42\nEMEA,31",
    },
    {
      id: "deck",
      name: "deck.deck.md",
      kind: "slides",
      language: "Deck Markdown",
      source: "---\nversion: 1\ntitle: Deck\ntheme: rune\nratio: 16:9\nlang: en\n---\n\n# Old conclusion.",
    },
    {
      id: "analysis",
      name: "analysis.sql",
      kind: "query",
      language: "DuckDB SQL",
      source: "SELECT Region, Revenue FROM workspace_data",
    },
  ];
  globalThis.fetch = async () => new Response(JSON.stringify(providerResponse({
    summary: "Align the workspace",
    detail: "Three artifact-aware operations create one reviewed result.",
    actions: [
      {
        type: "patch_artifact",
        artifactId: "report",
        summary: "Align the report",
        detail: "One Markdown section changes.",
        edits: [{ type: "replace_markdown_section", heading: "Report", body: "Shared conclusion." }],
      },
      {
        type: "patch_artifact",
        artifactId: "data",
        summary: "Align the data",
        detail: "One typed row changes.",
        edits: [{
          type: "upsert_data_row",
          keyColumn: "Region",
          keyValue: "APAC",
          cells: [{ column: "Revenue", value: 48 }],
        }],
      },
      {
        type: "patch_artifact",
        artifactId: "deck",
        summary: "Align the deck",
        detail: "One slide changes.",
        edits: [{
          type: "replace_deck_slide",
          title: "Old conclusion.",
          slide: "# Shared conclusion.\n\nAligned result.",
        }],
      },
    ],
  })), { status: 200, headers: { "content-type": "application/json" } });

  const response = await POST(new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody({
      scope: "workspace",
      workspaceArtifacts,
      workspaceDependencies: [{
        fromArtifactId: "data",
        toArtifactId: "analysis",
        kind: "query",
        references: ["data"],
      }],
      workspacePinnedArtifactIds: ["data", "deck"],
    })),
  }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.plan.patches.map((patch) => patch.operationCount), [1, 1, 1]);
  assert.match(payload.plan.patches[0].nextSource, /Shared conclusion/);
  assert.match(payload.plan.patches[1].nextSource, /APAC,48/);
  assert.match(payload.plan.patches[2].nextSource, /Shared conclusion/);
  assert.ok(payload.plan.patches.every((patch) => !("edits" in patch)));
  assert.deepEqual(payload.plan.creations, []);
});

test("creates a new Deck through Rune-owned identity, template compilation, and review output", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  const workspaceArtifacts = [
    requestBody().artifact,
    {
      id: "data",
      name: "data.csv",
      kind: "data",
      language: "CSV / JSON",
      source: "Region,Revenue\nAPAC,42\nEMEA,31",
    },
  ];
  let providerRequest;
  globalThis.fetch = async (_input, init) => {
    providerRequest = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(providerResponse({
      summary: "Create a presentation from workspace context",
      detail: "One new Deck is prepared without model-authored file metadata.",
      actions: [{
        type: "create_artifact",
        kind: "slides",
        title: "Board Review",
        summary: "Create the board review",
        detail: "Replace the cover and insert a supporting slide.",
        edits: [
          { type: "replace_deck_slide", title: "Board Review", slide: "# Board Review\n\nShared workspace context." },
          { type: "insert_deck_slide_after", title: "Board Review", slide: "## Decision\n\nProceed." },
        ],
      }],
    })), { status: 200, headers: { "content-type": "application/json" } });
  };

  const response = await POST(new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody({ scope: "workspace", workspaceArtifacts, workspaceDependencies: [], workspacePinnedArtifactIds: ["data"] })),
  }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.plan.patches, []);
  assert.equal(payload.plan.creations.length, 1);
  assert.deepEqual({
    id: payload.plan.creations[0].artifact.id,
    name: payload.plan.creations[0].artifact.name,
    kind: payload.plan.creations[0].artifact.kind,
    language: payload.plan.creations[0].artifact.language,
  }, {
    id: "board-review",
    name: "board-review.deck.md",
    kind: "slides",
    language: "Deck Markdown",
  });
  assert.match(payload.plan.creations[0].artifact.source, /## Decision/);
  assert.equal(payload.plan.creations[0].operationCount, 2);
  assert.equal("edits" in payload.plan.creations[0], false);

  const actionVariants = providerRequest.text.format.schema.properties.actions.items.anyOf;
  assert.deepEqual(actionVariants.map((action) => action.properties.type.const), ["patch_artifact", "create_artifact"]);
  const creationSchema = actionVariants.find((action) => action.properties.type.const === "create_artifact");
  const creationJson = JSON.stringify(creationSchema);
  assert.equal(/artifactId|nextSource|"id"|"name"|"language"|"source"/.test(creationJson), false);
  assert.match(providerRequest.input[0].content, /Rune owns its identity and initial template/);
});

test("rejects model-authored creation metadata and unsafe created sources", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  const workspaceArtifacts = [
    requestBody().artifact,
    { id: "data", name: "data.csv", kind: "data", language: "CSV / JSON", source: "Item,Value\nA,1" },
  ];
  const baseCreation = {
    type: "create_artifact",
    kind: "slides",
    title: "Unsafe Deck",
    summary: "Create a deck",
    detail: "The request must remain bounded.",
    edits: [{
      type: "replace_deck_slide",
      title: "Unsafe Deck",
      slide: "# Unsafe Deck\n\n<script>alert(1)</script>",
    }],
  };

  globalThis.fetch = async () => new Response(JSON.stringify(providerResponse({
    summary: "Bypass Rune identity",
    detail: "The strict provider contract must reject extra metadata.",
    actions: [{ ...baseCreation, id: "model-id", name: "model.deck.md", source: "# bypass" }],
  })), { status: 200, headers: { "content-type": "application/json" } });
  const metadataResponse = await POST(new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody({ scope: "workspace", workspaceArtifacts, workspaceDependencies: [], workspacePinnedArtifactIds: ["data"] })),
  }));
  assert.equal(metadataResponse.status, 502);
  assert.equal((await metadataResponse.json()).plan, undefined);

  globalThis.fetch = async () => new Response(JSON.stringify(providerResponse({
    summary: "Create unsafe markup",
    detail: "The full-workspace safety gate must reject it.",
    actions: [baseCreation],
  })), { status: 200, headers: { "content-type": "application/json" } });
  const unsafeResponse = await POST(new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody({ scope: "workspace", workspaceArtifacts, workspaceDependencies: [], workspacePinnedArtifactIds: ["data"] })),
  }));
  assert.equal(unsafeResponse.status, 502);
  const unsafePayload = await unsafeResponse.json();
  assert.match(unsafePayload.error, /workspace safety gate/i);
  assert.match(unsafePayload.details.join(" "), /raw HTML/i);
  assert.equal(unsafePayload.plan, undefined);
});

test("rejects an ambiguous provider anchor before returning a review patch", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => new Response(JSON.stringify(providerResponse({
    summary: "Ambiguous edit",
    detail: "This cannot identify one exact target.",
    edits: [{ type: "replace_text", find: "repeat", replace: "changed" }],
  })), { status: 200, headers: { "content-type": "application/json" } });

  const response = await POST(new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody({
      artifact: { ...requestBody().artifact, source: "repeat and repeat" },
    })),
  }));
  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.match(payload.error, /do not match the current artifact revision/i);
  assert.match(payload.details.join(" "), /ambiguous/i);
  assert.equal(payload.plan, undefined);
});

test("rejects a semantic operation that is incompatible with the artifact kind", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => new Response(JSON.stringify(providerResponse({
    summary: "Wrong operation type",
    detail: "A data-row operation cannot target a Markdown document.",
    edits: [{
      type: "upsert_data_row",
      keyColumn: "id",
      keyValue: 1,
      cells: [{ column: "id", value: 1 }],
    }],
  })), { status: 200, headers: { "content-type": "application/json" } });

  const response = await POST(new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody()),
  }));
  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.match(payload.details.join(" "), /upsert_data_row only supports/i);
  assert.equal(payload.plan, undefined);
});

test("rejects a compiled operation that fails the artifact safety gate", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => new Response(JSON.stringify(providerResponse({
    summary: "Mutate workspace data",
    detail: "The read-only query boundary must reject this operation.",
    edits: [{ type: "replace_text", find: "SELECT", replace: "DELETE" }],
  })), { status: 200, headers: { "content-type": "application/json" } });

  const response = await POST(new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody({
      artifact: {
        id: "analysis",
        name: "analysis.sql",
        kind: "query",
        language: "DuckDB SQL",
        source: "SELECT * FROM workspace_data;",
      },
    })),
  }));
  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.match(payload.error, /artifact safety gate/i);
  assert.match(payload.details.join(" "), /read-only|SELECT|WITH/i);
  assert.equal(payload.plan, undefined);
});
