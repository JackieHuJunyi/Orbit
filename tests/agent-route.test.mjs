import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../app/api/agent/route.ts";
import { DEFAULT_MODEL_TOKEN_BUDGET, normalizeModelProfileDraft } from "../app/lib/model-profiles.ts";
import { serializeModelProfileVaultCookie } from "../app/lib/model-credential-vault.ts";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.OPENAI_MODEL;
const originalVaultKey = process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY;

test.after(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
  if (originalModel === undefined) delete process.env.OPENAI_MODEL;
  else process.env.OPENAI_MODEL = originalModel;
  if (originalVaultKey === undefined) delete process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY;
  else process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY = originalVaultKey;
});

test("uses the active personal provider endpoint without exposing its credential in the Agent response", async () => {
  process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY = "agent-personal-vault-key-123456789";
  delete process.env.OPENAI_API_KEY;
  const profile = normalizeModelProfileDraft(
    {
      provider: "custom",
      name: "Private gateway",
      baseURL: "https://models.example.com/v1",
      model: "rune-model-1",
      apiKey: "personal-agent-secret",
    },
    undefined,
    "2026-08-13T00:00:00.000Z",
    () => "private",
  );
  const cookie = await serializeModelProfileVaultCookie(new Request("https://rune.example/api/model-profiles"), {
    version: 1,
    activeProfileId: profile.id,
    profiles: [profile],
  });
  let providerUrl = "";
  let providerAuthorization = "";
  globalThis.fetch = async (input, init) => {
    providerUrl = String(input);
    providerAuthorization = new Headers(init?.headers).get("authorization") ?? "";
    return new Response(
      JSON.stringify(
        providerResponse({
          summary: "Shorten the conclusion",
          detail: "One Markdown section changes.",
          edits: [{ type: "replace_markdown_section", heading: "Report", body: "Concise conclusion." }],
        }),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const response = await POST(
    new Request("https://rune.example/api/agent", {
      method: "POST",
      headers: {
        cookie: cookie.split(";", 1)[0],
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody()),
    }),
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.provider, "custom");
  assert.equal(payload.profileName, "Private gateway");
  assert.equal(payload.model, "rune-model-1");
  assert.deepEqual(payload.usage, { inputTokens: 1, outputTokens: 1 });
  assert.equal(providerUrl, "https://models.example.com/v1/responses");
  assert.equal(providerAuthorization, "Bearer personal-agent-secret");
  assert.doesNotMatch(JSON.stringify(payload), /personal-agent-secret/);
});

test("routes an Anthropic profile through Messages and the unchanged Rune operation compiler", async () => {
  process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY = "agent-anthropic-vault-key-1234567";
  delete process.env.OPENAI_API_KEY;
  const profile = normalizeModelProfileDraft(
    {
      provider: "anthropic",
      name: "Claude work",
      model: "claude-sonnet-5",
      apiKey: "anthropic-agent-secret",
    },
    undefined,
    "2026-08-13T00:00:00.000Z",
    () => "anthropic",
  );
  const cookie = await serializeModelProfileVaultCookie(new Request("https://rune.example/api/model-profiles"), {
    version: 1,
    activeProfileId: profile.id,
    profiles: [profile],
  });
  let providerRequest;
  globalThis.fetch = async (input, init) => {
    providerRequest = { url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) };
    return new Response(
      JSON.stringify({
        content: [
          {
            type: "tool_use",
            name: "submit_rune_plan",
            input: {
              summary: "Shorten the conclusion",
              detail: "One Markdown section changes.",
              edits: [{ type: "replace_markdown_section", heading: "Report", body: "Claude conclusion." }],
            },
          },
        ],
        usage: { input_tokens: 21, output_tokens: 9 },
      }),
      { headers: { "content-type": "application/json" } },
    );
  };
  const response = await POST(
    new Request("https://rune.example/api/agent", {
      method: "POST",
      headers: { cookie: cookie.split(";", 1)[0], "content-type": "application/json" },
      body: JSON.stringify(requestBody()),
    }),
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.provider, "anthropic");
  assert.equal(payload.profileName, "Claude work");
  assert.equal(payload.plan.nextSource, "# Report\n\nClaude conclusion.");
  assert.deepEqual(payload.usage, { inputTokens: 21, outputTokens: 9 });
  assert.equal(providerRequest.url, "https://api.anthropic.com/v1/messages");
  assert.equal(providerRequest.headers.get("x-api-key"), "anthropic-agent-secret");
  assert.equal(providerRequest.body.tool_choice.name, "submit_rune_plan");
  assert.doesNotMatch(JSON.stringify(payload), /anthropic-agent-secret/);
});

test("routes a Gemini profile through generateContent and the unchanged Rune operation compiler", async () => {
  process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY = "agent-gemini-vault-key-123456789";
  delete process.env.OPENAI_API_KEY;
  const profile = normalizeModelProfileDraft(
    {
      provider: "gemini",
      name: "Gemini work",
      model: "gemini-2.5-pro",
      apiKey: "gemini-agent-secret",
    },
    undefined,
    "2026-08-13T00:00:00.000Z",
    () => "gemini",
  );
  const cookie = await serializeModelProfileVaultCookie(new Request("https://rune.example/api/model-profiles"), {
    version: 1,
    activeProfileId: profile.id,
    profiles: [profile],
  });
  let providerRequest;
  globalThis.fetch = async (input, init) => {
    providerRequest = { url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) };
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: "Shorten the conclusion",
                    detail: "One Markdown section changes.",
                    edits: [{ type: "replace_markdown_section", heading: "Report", body: "Gemini conclusion." }],
                  }),
                },
              ],
            },
          },
        ],
        usageMetadata: { promptTokenCount: 23, candidatesTokenCount: 10 },
      }),
      { headers: { "content-type": "application/json" } },
    );
  };
  const response = await POST(
    new Request("https://rune.example/api/agent", {
      method: "POST",
      headers: { cookie: cookie.split(";", 1)[0], "content-type": "application/json" },
      body: JSON.stringify(requestBody()),
    }),
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.provider, "gemini");
  assert.equal(payload.plan.nextSource, "# Report\n\nGemini conclusion.");
  assert.deepEqual(payload.usage, { inputTokens: 23, outputTokens: 10 });
  assert.equal(
    providerRequest.url,
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent",
  );
  assert.equal(providerRequest.headers.get("x-goog-api-key"), "gemini-agent-secret");
  assert.equal(providerRequest.body.generationConfig.responseMimeType, "application/json");
  assert.doesNotMatch(JSON.stringify(payload), /gemini-agent-secret/);
});

function providerResponse(output) {
  return {
    id: "resp_rune_test",
    object: "response",
    created_at: 0,
    status: "completed",
    model: "gpt-5.6",
    output: [
      {
        id: "msg_rune_test",
        type: "message",
        status: "completed",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: JSON.stringify(output),
            annotations: [],
          },
        ],
      },
    ],
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

function queryWorkspaceBody(overrides = {}) {
  const data = {
    id: "data",
    name: "data.csv",
    kind: "data",
    language: "CSV / JSON",
    source: "Item,Value\nRevenue,42",
  };
  const query = {
    id: "analysis",
    name: "analysis.sql",
    kind: "query",
    language: "DuckDB SQL",
    source: '-- rune:data "data"\nSELECT SUM(Value) AS total FROM workspace_data;',
  };
  return requestBody({
    scope: "workspace",
    artifact: query,
    workspaceArtifacts: [data, query],
    workspaceDependencies: [
      {
        fromArtifactId: "data",
        toArtifactId: "analysis",
        kind: "query",
        references: ["data"],
      },
    ],
    workspacePinnedArtifactIds: [],
    ...overrides,
  });
}

function exactQueryEvidence() {
  return [
    {
      queryArtifactId: "analysis",
      dataArtifactId: "data",
      status: "ready",
      columns: ["total"],
      rows: [[42]],
      visibleResultRowCount: 1,
      totalColumnCount: 1,
      resultTruncated: false,
      evidenceTruncated: false,
    },
  ];
}

test("compiles a provider Markdown-section operation into the concrete Agent response", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "gpt-5.6";
  let providerRequest;
  globalThis.fetch = async (_input, init) => {
    providerRequest = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify(
        providerResponse({
          summary: "Shorten the conclusion",
          detail: "One Markdown section changes.",
          edits: [{ type: "replace_markdown_section", heading: "Report", body: "Concise conclusion." }],
        }),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody()),
    }),
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.plan.nextSource, "# Report\n\nConcise conclusion.");
  assert.equal(payload.plan.operationCount, 1);
  assert.equal(payload.repairAttempt, undefined);
  assert.deepEqual(payload.usage, { inputTokens: 1, outputTokens: 1 });
  assert.equal("edits" in payload.plan, false);
  assert.equal(providerRequest.max_output_tokens, DEFAULT_MODEL_TOKEN_BUDGET.maxOutputTokens);
  assert.equal(providerRequest.text.format.name, "artifact_operations");
  assert.deepEqual(Object.keys(providerRequest.text.format.schema.properties).sort(), ["detail", "edits", "summary"]);
  const operationTypes = providerRequest.text.format.schema.properties.edits.items.anyOf.map(
    (operation) => operation.properties.type.const,
  );
  assert.deepEqual(operationTypes, [
    "replace_text",
    "replace_markdown_section",
    "insert_markdown_section_after",
    "upsert_data_row",
    "upsert_data_column",
    "rename_data_column",
    "replace_deck_slide",
    "insert_deck_slide_after",
  ]);
  assert.equal("nextSource" in providerRequest.text.format.schema.properties, false);
  assert.match(providerRequest.input[0].content, /Markdown by exact heading|ordered edits/i);
});

test("returns a replacement plan marked as the single compiler-guided repair attempt", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  let providerRequest;
  globalThis.fetch = async (_input, init) => {
    providerRequest = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify(
        providerResponse({
          summary: "Repair the aggregate",
          detail: "The replacement keeps the canonical field and handles an empty result.",
          edits: [
            {
              type: "replace_text",
              find: "SELECT SUM(Value) AS total FROM workspace_data;",
              replace: "SELECT COALESCE(SUM(Value), 0) AS total FROM workspace_data;",
            },
          ],
        }),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const artifact = {
    id: "analysis",
    name: "analysis.sql",
    kind: "query",
    language: "DuckDB SQL",
    source: '-- rune:data "data"\nSELECT SUM(Value) AS total FROM workspace_data;',
  };
  const runtimeRepair = {
    attempt: 1,
    failure: "Runtime impact preflight failed · Binder Error: missing_value is unavailable.",
    proposedArtifacts: [
      {
        artifactId: "analysis",
        name: "analysis.sql",
        kind: "query",
        language: "DuckDB SQL",
        proposedSource: '-- rune:data "data"\nSELECT SUM(missing_value) AS total FROM workspace_data;',
        isCreation: false,
      },
    ],
  };
  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody({ artifact, runtimeRepair })),
    }),
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.repairAttempt, 1);
  assert.match(payload.plan.nextSource, /COALESCE/);
  const modelInput = JSON.parse(providerRequest.input[1].content);
  assert.deepEqual(modelInput.runtimeRepair, runtimeRepair);
  assert.match(providerRequest.input[0].content, /only automatic repair attempt/i);
  assert.match(providerRequest.input[0].content, /untrusted advisory data/i);
  assert.match(providerRequest.input[0].content, /complete replacement operation plan/i);
});

test("compiles a provider keyed Data-column operation into reviewable CSV source", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  let providerRequest;
  globalThis.fetch = async (_input, init) => {
    providerRequest = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify(
        providerResponse({
          summary: "Add gross margin",
          detail: "Every current region receives one typed value keyed by Region.",
          edits: [
            {
              type: "upsert_data_column",
              keyColumn: "Region",
              column: "Margin",
              values: [
                { keyValue: "APAC", value: 0.34 },
                { keyValue: "EMEA", value: 0.29 },
              ],
            },
          ],
        }),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        requestBody({
          artifact: {
            id: "revenue",
            name: "revenue.csv",
            kind: "data",
            language: "CSV / JSON",
            source: "Region,Revenue\nAPAC,42\nEMEA,31",
          },
          prompt: "Add a margin column.",
        }),
      ),
    }),
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.plan.operationCount, 1);
  assert.equal(payload.plan.nextSource, "Region,Revenue,Margin\nAPAC,42,0.34\nEMEA,31,0.29");
  assert.match(providerRequest.input[0].content, /globally unique non-empty key column/i);
  assert.match(providerRequest.input[0].content, /exactly one typed value for every current row/i);
  assert.equal(
    providerRequest.text.format.schema.properties.edits.items.anyOf.some(
      (operation) => operation.properties.type.const === "upsert_data_column",
    ),
    true,
  );
});

test("rejects a repeated automatic repair attempt before contacting the provider", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  let providerCalled = false;
  globalThis.fetch = async () => {
    providerCalled = true;
    throw new Error("provider must not be called");
  };
  const artifact = {
    id: "analysis",
    name: "analysis.sql",
    kind: "query",
    language: "DuckDB SQL",
    source: "SELECT Value FROM workspace_data;",
  };
  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        requestBody({
          artifact,
          runtimeRepair: {
            attempt: 2,
            failure: "still invalid",
            proposedArtifacts: [
              {
                artifactId: "analysis",
                name: "analysis.sql",
                kind: "query",
                language: "DuckDB SQL",
                proposedSource: "SELECT missing_value FROM workspace_data;",
                isCreation: false,
              },
            ],
          },
        }),
      ),
    }),
  );
  assert.equal(response.status, 400);
  assert.equal(providerCalled, false);
});

test("rejects a cross-file Query metric introduced outside Workspace scope", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify(
        providerResponse({
          summary: "Bind a hidden Query metric",
          detail: "Artifact scope must not create a cross-file dependency it could not inspect.",
          edits: [
            {
              type: "replace_text",
              find: "Old conclusion.",
              replace: '{{ metric("regional-summary", "total_q2_revenue", "currency") }}',
            },
          ],
        }),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody()),
    }),
  );
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /only in Workspace scope/i);
});

test("returns a Selection Agent patch only when every compiled change stays in range", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  const source = "# Report\n\nOld conclusion.\n\nKeep this paragraph.";
  const start = source.indexOf("Old conclusion.");
  const end = start + "Old conclusion.".length;
  let providerRequest;
  globalThis.fetch = async (_input, init) => {
    providerRequest = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify(
        providerResponse({
          summary: "Shorten the selected conclusion",
          detail: "Only the exact selected sentence changes.",
          edits: [{ type: "replace_text", find: "Old conclusion.", replace: "Concise conclusion." }],
        }),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        requestBody({
          scope: "selection",
          artifact: { ...requestBody().artifact, source },
          selection: { start, end },
        }),
      ),
    }),
  );
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
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify(
        providerResponse({
          summary: "Change outside the selection",
          detail: "The range gate must reject this otherwise valid edit.",
          edits: [{ type: "replace_text", find: "Outside sentence.", replace: "Illicit outside change." }],
        }),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        requestBody({
          scope: "selection",
          artifact: { ...requestBody().artifact, source },
          selection: { start, end },
        }),
      ),
    }),
  );
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
  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody({ scope: "selection", selection: { start: 3, end: 3 } })),
    }),
  );
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
  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        requestBody({
          scope: "workspace",
          workspaceArtifacts,
          workspaceDependencies: [
            {
              fromArtifactId: "data",
              toArtifactId: "report",
              kind: "metric",
              references: ["invented"],
            },
          ],
          workspacePinnedArtifactIds: ["data"],
        }),
      ),
    }),
  );
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /dependency context is stale or invalid/i);
  assert.equal(providerCalled, false);

  const unpinnedResponse = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        requestBody({
          scope: "workspace",
          workspaceArtifacts,
          workspaceDependencies: [],
          workspacePinnedArtifactIds: [],
        }),
      ),
    }),
  );
  assert.equal(unpinnedResponse.status, 400);
  assert.match((await unpinnedResponse.json()).error, /unpinned disconnected artifact/i);
  assert.equal(providerCalled, false);

  const incompleteArtifact = {
    ...requestBody().artifact,
    source: '# Report\n\n{{ chart("omitted-chart") }}',
  };
  const incompleteResponse = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        requestBody({
          scope: "workspace",
          artifact: incompleteArtifact,
          workspaceArtifacts: [incompleteArtifact, workspaceArtifacts[1]],
          workspaceDependencies: [],
          workspacePinnedArtifactIds: ["data"],
        }),
      ),
    }),
  );
  assert.equal(incompleteResponse.status, 400);
  assert.match((await incompleteResponse.json()).error, /dependency context is incomplete or invalid/i);
  assert.equal(providerCalled, false);
});

test("returns provider configuration status before requesting browser Query evidence", async () => {
  delete process.env.OPENAI_API_KEY;
  let providerCalled = false;
  globalThis.fetch = async () => {
    providerCalled = true;
    throw new Error("provider must not be called");
  };
  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(queryWorkspaceBody()),
    }),
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "MODEL_UNCONFIGURED");
  assert.equal(providerCalled, false);
});

test("requires exact current Query evidence before a configured Workspace model call", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  let providerCalled = false;
  globalThis.fetch = async () => {
    providerCalled = true;
    throw new Error("provider must not be called during the evidence handshake");
  };
  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(queryWorkspaceBody()),
    }),
  );
  assert.equal(response.status, 428);
  const payload = await response.json();
  assert.equal(payload.code, "QUERY_EVIDENCE_REQUIRED");
  assert.deepEqual(payload.queryArtifactIds, ["analysis"]);
  assert.equal(providerCalled, false);
});

test("passes exact bounded Query evidence to the model after the handshake", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  let providerRequest;
  globalThis.fetch = async (_input, init) => {
    providerRequest = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify(
        providerResponse({
          summary: "Clarify the total alias",
          detail: "One exact SQL token changes.",
          actions: [
            {
              type: "patch_artifact",
              artifactId: "analysis",
              summary: "Clarify the alias",
              detail: "The result remains one scalar row.",
              edits: [{ type: "replace_text", find: "AS total", replace: "AS total_value" }],
            },
          ],
        }),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(queryWorkspaceBody({ queryEvidence: exactQueryEvidence() })),
    }),
  );
  assert.equal(response.status, 200);
  assert.ok(providerRequest);
  const modelInput = JSON.parse(providerRequest.input[1].content);
  assert.deepEqual(modelInput.currentQueryEvidence, exactQueryEvidence());
  assert.match(providerRequest.input[0].content, /advisory evidence/i);
  assert.match((await response.json()).plan.patches[0].nextSource, /AS total_value/);
});

test("rejects stale or fabricated Query/Data evidence before contacting the provider", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  let providerCalled = false;
  globalThis.fetch = async () => {
    providerCalled = true;
    throw new Error("provider must not be called");
  };
  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        queryWorkspaceBody({
          queryEvidence: [{ ...exactQueryEvidence()[0], dataArtifactId: "fabricated-data" }],
        }),
      ),
    }),
  );
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.code, "QUERY_EVIDENCE_INVALID");
  assert.match(payload.details.join(" "), /wrong Data/i);
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
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify(
        providerResponse({
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
              edits: [
                {
                  type: "upsert_data_row",
                  keyColumn: "Region",
                  keyValue: "APAC",
                  cells: [{ column: "Revenue", value: 48 }],
                },
              ],
            },
            {
              type: "patch_artifact",
              artifactId: "deck",
              summary: "Align the deck",
              detail: "One slide changes.",
              edits: [
                {
                  type: "replace_deck_slide",
                  title: "Old conclusion.",
                  slide: "# Shared conclusion.\n\nAligned result.",
                },
              ],
            },
          ],
        }),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        requestBody({
          scope: "workspace",
          workspaceArtifacts,
          workspaceDependencies: [
            {
              fromArtifactId: "data",
              toArtifactId: "analysis",
              kind: "query",
              references: ["data"],
            },
          ],
          workspacePinnedArtifactIds: ["data", "deck"],
          queryEvidence: [
            {
              queryArtifactId: "analysis",
              dataArtifactId: "data",
              status: "ready",
              columns: ["Region", "Revenue"],
              rows: [
                ["APAC", 42],
                ["EMEA", 31],
              ],
              visibleResultRowCount: 2,
              totalColumnCount: 2,
              resultTruncated: false,
              evidenceTruncated: false,
            },
          ],
        }),
      ),
    }),
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(
    payload.plan.patches.map((patch) => patch.operationCount),
    [1, 1, 1],
  );
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
    return new Response(
      JSON.stringify(
        providerResponse({
          summary: "Create a presentation from workspace context",
          detail: "One new Deck is prepared without model-authored file metadata.",
          actions: [
            {
              type: "create_artifact",
              kind: "slides",
              title: "Board Review",
              handle: "board_review",
              summary: "Create the board review",
              detail: "Replace the cover and insert a supporting slide.",
              edits: [
                {
                  type: "replace_deck_slide",
                  title: "Board Review",
                  slide: "# Board Review\n\nShared workspace context.",
                },
                { type: "insert_deck_slide_after", title: "Board Review", slide: "## Decision\n\nProceed." },
              ],
            },
          ],
        }),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        requestBody({
          scope: "workspace",
          workspaceArtifacts,
          workspaceDependencies: [],
          workspacePinnedArtifactIds: ["data"],
        }),
      ),
    }),
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.plan.patches, []);
  assert.equal(payload.plan.creations.length, 1);
  assert.deepEqual(
    {
      id: payload.plan.creations[0].artifact.id,
      name: payload.plan.creations[0].artifact.name,
      kind: payload.plan.creations[0].artifact.kind,
      language: payload.plan.creations[0].artifact.language,
    },
    {
      id: "board-review",
      name: "board-review.deck.md",
      kind: "slides",
      language: "Deck Markdown",
    },
  );
  assert.match(payload.plan.creations[0].artifact.source, /## Decision/);
  assert.equal(payload.plan.creations[0].operationCount, 2);
  assert.equal("edits" in payload.plan.creations[0], false);

  const actionVariants = providerRequest.text.format.schema.properties.actions.items.anyOf;
  assert.deepEqual(
    actionVariants.map((action) => action.properties.type.const),
    ["patch_artifact", "create_artifact", "create_artifact", "create_artifact"],
  );
  const creationSchemas = actionVariants.filter((action) => action.properties.type.const === "create_artifact");
  assert.deepEqual(
    creationSchemas.map((action) => action.properties.kind),
    [
      { type: "string", enum: ["document", "data", "slides"] },
      { type: "string", const: "query" },
      { type: "string", const: "chart" },
    ],
  );
  creationSchemas.forEach((schema) => {
    const keys = Object.keys(schema.properties);
    ["artifactId", "nextSource", "id", "name", "language"].forEach((key) => assert.equal(keys.includes(key), false));
  });
  assert.match(providerRequest.input[0].content, /Rune owns its identity and initial source/);
});

test("creates typed Query and Chart sources from exact visible Agent bindings", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify(
        providerResponse({
          summary: "Create two source-first analysis artifacts",
          detail: "Both files use Rune-owned identities and exact visible bindings.",
          actions: [
            {
              type: "create_artifact",
              kind: "query",
              title: "Detail Analysis",
              handle: "detail_analysis",
              source: { kind: "artifact", artifactId: "data" },
              summary: "Create bound Query",
              detail: "Read the exact visible Data source.",
              edits: [],
            },
            {
              type: "create_artifact",
              kind: "chart",
              title: "Total Analysis",
              handle: "total_analysis",
              source: { kind: "artifact", artifactId: "analysis" },
              category: "total",
              value: "total",
              mark: "bar",
              format: "number",
              summary: "Create bound Chart",
              detail: "Use the exact current Query output field.",
              edits: [],
            },
          ],
        }),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        queryWorkspaceBody({
          prompt: "Create a Query and Chart from the visible analysis context.",
          queryEvidence: exactQueryEvidence(),
        }),
      ),
    }),
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.plan.patches, []);
  assert.deepEqual(
    payload.plan.creations.map((creation) => ({
      name: creation.artifact.name,
      kind: creation.artifact.kind,
      operationCount: creation.operationCount,
    })),
    [
      { name: "detail-analysis.sql", kind: "query", operationCount: 0 },
      { name: "total-analysis.chart.json", kind: "chart", operationCount: 0 },
    ],
  );
  assert.match(payload.plan.creations[0].artifact.source, /-- rune:data "data"/);
  assert.match(payload.plan.creations[1].artifact.source, /"source": "analysis"/);
});

test("resolves provider creation handles into one concrete four-file dependency chain", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  const workspaceArtifacts = [
    requestBody().artifact,
    { id: "data", name: "data.csv", kind: "data", language: "CSV / JSON", source: "Item,Value\nExisting,1" },
  ];
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify(
        providerResponse({
          summary: "Create one complete analysis workflow",
          detail: "Every dependent action uses a prior symbolic handle.",
          actions: [
            {
              type: "create_artifact",
              kind: "data",
              title: "Pipeline Data",
              handle: "pipeline_data",
              summary: "Create Data",
              detail: "Create the source rows.",
              edits: [{ type: "replace_text", find: "Item,Value\n", replace: "Region,Revenue\nAPAC,48\nEMEA,31\n" }],
            },
            {
              type: "create_artifact",
              kind: "query",
              title: "Pipeline Query",
              handle: "pipeline_query",
              source: { kind: "creation", handle: "pipeline_data" },
              summary: "Create Query",
              detail: "Read the prior Data creation.",
              edits: [],
            },
            {
              type: "create_artifact",
              kind: "chart",
              title: "Pipeline Chart",
              handle: "pipeline_chart",
              source: { kind: "creation", handle: "pipeline_query" },
              category: "Region",
              value: "Revenue",
              mark: "bar",
              format: "currency",
              summary: "Create Chart",
              detail: "Bind the prior Query creation.",
              edits: [],
            },
            {
              type: "create_artifact",
              kind: "document",
              title: "Pipeline Report",
              handle: "pipeline_report",
              summary: "Create report",
              detail: "Append the prior Chart creation.",
              edits: [
                {
                  type: "append_chart",
                  chart: { kind: "creation", handle: "pipeline_chart" },
                  heading: "Regional revenue",
                },
              ],
            },
          ],
        }),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        requestBody({
          scope: "workspace",
          workspaceArtifacts,
          workspaceDependencies: [],
          workspacePinnedArtifactIds: ["data"],
        }),
      ),
    }),
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(
    payload.plan.creations.map((creation) => creation.artifact.kind),
    ["data", "query", "chart", "document"],
  );
  const [data, query, chart, report] = payload.plan.creations.map((creation) => creation.artifact);
  assert.match(query.source, new RegExp(`rune:data \\"${data.id}\\"`));
  assert.match(chart.source, new RegExp(`\\"source\\": \\"${query.id}\\"`));
  assert.match(report.source, new RegExp(`chart\\(\\"${chart.id}\\"\\)`));
  assert.ok(payload.plan.creations.every((creation) => !("handle" in creation) && !("source" in creation)));
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
    handle: "unsafe_deck",
    summary: "Create a deck",
    detail: "The request must remain bounded.",
    edits: [
      {
        type: "replace_deck_slide",
        title: "Unsafe Deck",
        slide: "# Unsafe Deck\n\n<script>alert(1)</script>",
      },
    ],
  };

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify(
        providerResponse({
          summary: "Bypass Rune identity",
          detail: "The strict provider contract must reject extra metadata.",
          actions: [{ ...baseCreation, id: "model-id", name: "model.deck.md", source: "# bypass" }],
        }),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  const metadataResponse = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        requestBody({
          scope: "workspace",
          workspaceArtifacts,
          workspaceDependencies: [],
          workspacePinnedArtifactIds: ["data"],
        }),
      ),
    }),
  );
  assert.equal(metadataResponse.status, 502);
  assert.equal((await metadataResponse.json()).plan, undefined);

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify(
        providerResponse({
          summary: "Create unsafe markup",
          detail: "The full-workspace safety gate must reject it.",
          actions: [baseCreation],
        }),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  const unsafeResponse = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        requestBody({
          scope: "workspace",
          workspaceArtifacts,
          workspaceDependencies: [],
          workspacePinnedArtifactIds: ["data"],
        }),
      ),
    }),
  );
  assert.equal(unsafeResponse.status, 502);
  const unsafePayload = await unsafeResponse.json();
  assert.match(unsafePayload.error, /workspace safety gate/i);
  assert.match(unsafePayload.details.join(" "), /raw HTML/i);
  assert.equal(unsafePayload.plan, undefined);
});

test("rejects an ambiguous provider anchor before returning a review patch", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify(
        providerResponse({
          summary: "Ambiguous edit",
          detail: "This cannot identify one exact target.",
          edits: [{ type: "replace_text", find: "repeat", replace: "changed" }],
        }),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        requestBody({
          artifact: { ...requestBody().artifact, source: "repeat and repeat" },
        }),
      ),
    }),
  );
  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.match(payload.error, /do not match the current artifact revision/i);
  assert.match(payload.details.join(" "), /ambiguous/i);
  assert.equal(payload.plan, undefined);
});

test("rejects a semantic operation that is incompatible with the artifact kind", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify(
        providerResponse({
          summary: "Wrong operation type",
          detail: "A data-row operation cannot target a Markdown document.",
          edits: [
            {
              type: "upsert_data_row",
              keyColumn: "id",
              keyValue: 1,
              cells: [{ column: "id", value: 1 }],
            },
          ],
        }),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody()),
    }),
  );
  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.match(payload.details.join(" "), /upsert_data_row only supports/i);
  assert.equal(payload.plan, undefined);
});

test("rejects a compiled operation that fails the artifact safety gate", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify(
        providerResponse({
          summary: "Mutate workspace data",
          detail: "The read-only query boundary must reject this operation.",
          edits: [{ type: "replace_text", find: "SELECT", replace: "DELETE" }],
        }),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        requestBody({
          artifact: {
            id: "analysis",
            name: "analysis.sql",
            kind: "query",
            language: "DuckDB SQL",
            source: "SELECT * FROM workspace_data;",
          },
        }),
      ),
    }),
  );
  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.match(payload.error, /artifact safety gate/i);
  assert.match(payload.details.join(" "), /read-only|SELECT|WITH/i);
  assert.equal(payload.plan, undefined);
});
