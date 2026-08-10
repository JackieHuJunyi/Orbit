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

test("compiles provider operations into the existing concrete Agent response", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "gpt-5.6";
  let providerRequest;
  globalThis.fetch = async (_input, init) => {
    providerRequest = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(providerResponse({
      summary: "Shorten the conclusion",
      detail: "One exact sentence changes.",
      edits: [{ find: "Old conclusion.", replace: "Concise conclusion." }],
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
  assert.deepEqual(Object.keys(providerRequest.text.format.schema.properties.edits.items.properties).sort(), ["find", "replace"]);
  assert.equal("nextSource" in providerRequest.text.format.schema.properties, false);
  assert.match(providerRequest.input[0].content, /exact source operations|ordered edits/i);
});

test("compiles a coordinated workspace operation plan without partial files", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  const workspaceArtifacts = [
    requestBody().artifact,
    {
      id: "deck",
      name: "deck.deck.md",
      kind: "slides",
      language: "Deck Markdown",
      source: "---\nversion: 1\ntitle: Deck\ntheme: rune\nratio: 16:9\nlang: en\n---\n\n# Old conclusion.",
    },
  ];
  globalThis.fetch = async () => new Response(JSON.stringify(providerResponse({
    summary: "Align both conclusions",
    detail: "Two exact operations create one shared statement.",
    patches: workspaceArtifacts.map((artifact) => ({
      artifactId: artifact.id,
      summary: `Align ${artifact.id}`,
      detail: "One exact sentence changes.",
      edits: [{ find: "Old conclusion.", replace: "Shared conclusion." }],
    })),
  })), { status: 200, headers: { "content-type": "application/json" } });

  const response = await POST(new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody({ scope: "workspace", workspaceArtifacts })),
  }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.plan.patches.map((patch) => patch.operationCount), [1, 1]);
  assert.ok(payload.plan.patches.every((patch) => /Shared conclusion/.test(patch.nextSource)));
  assert.ok(payload.plan.patches.every((patch) => !("edits" in patch)));
});

test("rejects an ambiguous provider anchor before returning a review patch", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => new Response(JSON.stringify(providerResponse({
    summary: "Ambiguous edit",
    detail: "This cannot identify one exact target.",
    edits: [{ find: "repeat", replace: "changed" }],
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

test("rejects a compiled operation that fails the artifact safety gate", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => new Response(JSON.stringify(providerResponse({
    summary: "Mutate workspace data",
    detail: "The read-only query boundary must reject this operation.",
    edits: [{ find: "SELECT", replace: "DELETE" }],
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
