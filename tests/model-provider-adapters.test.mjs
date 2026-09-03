import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import { listProviderModels, requestProviderPlan } from "../app/lib/model-provider-adapters.ts";
import { DEFAULT_MODEL_TOKEN_BUDGET, modelCapabilityManifest } from "../app/lib/model-profiles.ts";

const schema = z
  .object({
    summary: z.string().min(1).max(160),
    edits: z
      .array(z.object({ type: z.literal("replace_text"), find: z.string(), replace: z.string() }).strict())
      .min(1),
  })
  .strict();
const output = { summary: "Replace one value", edits: [{ type: "replace_text", find: "old", replace: "new" }] };

function connection(protocol) {
  return {
    source: "personal",
    profileId: protocol,
    profileName: "Test provider",
    provider:
      protocol === "anthropic-messages" ? "anthropic" : protocol === "gemini-generate-content" ? "gemini" : "custom",
    protocol,
    apiKey: `secret-${protocol}`,
    baseURL:
      protocol === "anthropic-messages"
        ? "https://api.anthropic.com/v1"
        : protocol === "gemini-generate-content"
          ? "https://generativelanguage.googleapis.com/v1beta"
          : "https://models.example.com/v1",
    model: protocol === "gemini-generate-content" ? "gemini-2.5-pro" : "model-1",
    budget: { ...DEFAULT_MODEL_TOKEN_BUDGET },
    capabilities: modelCapabilityManifest(protocol),
  };
}

function jsonResponse(value) {
  return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
}

async function run(protocol, providerPayload) {
  let request;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), init, body: JSON.parse(String(init.body)) };
    return jsonResponse(providerPayload);
  };
  try {
    const result = await requestProviderPlan({
      connection: connection(protocol),
      instructions: "System contract",
      input: "Current artifact",
      schema,
      schemaName: "orbit_test",
      signal: new AbortController().signal,
    });
    return { request, result };
  } finally {
    globalThis.fetch = previousFetch;
  }
}

test("adapts OpenAI Responses without storing content or exposing its credential", async () => {
  const { request, result } = await run("responses", {
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }],
    usage: { input_tokens: 12, output_tokens: 5 },
  });
  assert.equal(request.url, "https://models.example.com/v1/responses");
  assert.equal(new Headers(request.init.headers).get("authorization"), "Bearer secret-responses");
  assert.equal(request.body.store, false);
  assert.equal(request.body.max_output_tokens, DEFAULT_MODEL_TOKEN_BUDGET.maxOutputTokens);
  assert.equal(request.body.text.format.type, "json_schema");
  assert.equal(request.body.text.format.strict, true);
  assert.deepEqual(result, { output, usage: { inputTokens: 12, outputTokens: 5 } });
  assert.doesNotMatch(JSON.stringify(result), /secret-responses/);
});

test("adapts OpenAI-compatible Chat Completions with strict response_format", async () => {
  const { request, result } = await run("chat-completions", {
    choices: [{ message: { role: "assistant", content: JSON.stringify(output) } }],
    usage: { prompt_tokens: 15, completion_tokens: 6 },
  });
  assert.equal(request.url, "https://models.example.com/v1/chat/completions");
  assert.equal(new Headers(request.init.headers).get("authorization"), "Bearer secret-chat-completions");
  assert.equal(request.body.response_format.type, "json_schema");
  assert.equal(request.body.response_format.json_schema.strict, true);
  assert.equal(request.body.store, false);
  assert.deepEqual(result, { output, usage: { inputTokens: 15, outputTokens: 6 } });
});

test("adapts Anthropic Messages through one forced typed tool input", async () => {
  const { request, result } = await run("anthropic-messages", {
    content: [{ type: "tool_use", name: "submit_orbit_plan", input: output }],
    usage: { input_tokens: 17, output_tokens: 7 },
  });
  const headers = new Headers(request.init.headers);
  assert.equal(request.url, "https://api.anthropic.com/v1/messages");
  assert.equal(headers.get("x-api-key"), "secret-anthropic-messages");
  assert.equal(headers.get("anthropic-version"), "2023-06-01");
  assert.equal(headers.get("authorization"), null);
  assert.deepEqual(request.body.tool_choice, {
    type: "tool",
    name: "submit_orbit_plan",
    disable_parallel_tool_use: true,
  });
  assert.equal(request.body.tools[0].input_schema.additionalProperties, false);
  assert.deepEqual(result, { output, usage: { inputTokens: 17, outputTokens: 7 } });
});

test("disables DeepSeek thinking before forcing the typed Anthropic tool", async () => {
  let request;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), init, body: JSON.parse(String(init.body)) };
    return jsonResponse({
      content: [{ type: "tool_use", name: "submit_orbit_plan", input: output }],
      usage: { input_tokens: 23, output_tokens: 9 },
    });
  };
  try {
    const result = await requestProviderPlan({
      connection: {
        ...connection("anthropic-messages"),
        provider: "deepseek",
        baseURL: "https://api.deepseek.com/anthropic",
        model: "deepseek-v4-flash",
      },
      instructions: "System contract",
      input: "Current artifact",
      schema,
      schemaName: "orbit_deepseek_test",
      signal: new AbortController().signal,
    });
    assert.equal(request.url, "https://api.deepseek.com/anthropic/messages");
    assert.deepEqual(request.body.thinking, { type: "disabled" });
    assert.deepEqual(request.body.tool_choice, {
      type: "tool",
      name: "submit_orbit_plan",
      disable_parallel_tool_use: true,
    });
    assert.deepEqual(result, { output, usage: { inputTokens: 23, outputTokens: 9 } });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("adapts Gemini generateContent with JSON Schema and x-goog-api-key", async () => {
  const { request, result } = await run("gemini-generate-content", {
    candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }],
    usageMetadata: { promptTokenCount: 19, candidatesTokenCount: 8 },
  });
  const headers = new Headers(request.init.headers);
  assert.equal(request.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent");
  assert.equal(headers.get("x-goog-api-key"), "secret-gemini-generate-content");
  assert.equal(headers.get("authorization"), null);
  assert.equal(request.body.generationConfig.responseMimeType, "application/json");
  assert.equal(request.body.generationConfig.responseJsonSchema.additionalProperties, false);
  assert.equal("$schema" in request.body.generationConfig.responseJsonSchema, false);
  assert.deepEqual(request.body.generationConfig.responseJsonSchema.properties.edits.items.properties.type.enum, [
    "replace_text",
  ]);
  assert.equal(
    "const" in request.body.generationConfig.responseJsonSchema.properties.edits.items.properties.type,
    false,
  );
  assert.deepEqual(result, { output, usage: { inputTokens: 19, outputTokens: 8 } });
});

test("lists Anthropic and Gemini model catalogs with protocol-specific authentication", async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), headers: new Headers(init.headers) });
    return requests.length === 1
      ? jsonResponse({ data: [{ id: "claude-sonnet-5" }, { id: "claude-opus-5" }] })
      : jsonResponse({
          models: [
            { name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent"] },
            { name: "models/text-embedding", supportedGenerationMethods: ["embedContent"] },
          ],
        });
  };
  try {
    assert.deepEqual(await listProviderModels(connection("anthropic-messages"), new AbortController().signal), [
      "claude-opus-5",
      "claude-sonnet-5",
    ]);
    assert.deepEqual(await listProviderModels(connection("gemini-generate-content"), new AbortController().signal), [
      "gemini-2.5-pro",
    ]);
    assert.equal(requests[0].headers.get("x-api-key"), "secret-anthropic-messages");
    assert.equal(requests[1].headers.get("x-goog-api-key"), "secret-gemini-generate-content");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("fails closed for invalid structured output and oversized provider responses", async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls += 1;
      return jsonResponse({ choices: [{ message: { content: "not json" } }] });
    };
    await assert.rejects(
      () =>
        requestProviderPlan({
          connection: connection("chat-completions"),
          instructions: "x",
          input: "y",
          schema,
          schemaName: "orbit_test",
          signal: new AbortController().signal,
        }),
      /invalid structured JSON/i,
    );
    assert.equal(calls, 1, "an invalid response must not trigger a second provider or protocol");
    globalThis.fetch = async () => {
      calls += 1;
      return new Response("{}", { headers: { "content-length": "2000001" } });
    };
    await assert.rejects(
      () =>
        requestProviderPlan({
          connection: connection("responses"),
          instructions: "x",
          input: "y",
          schema,
          schemaName: "orbit_test",
          signal: new AbortController().signal,
        }),
      /unexpectedly large/i,
    );
    assert.equal(calls, 2, "each user request calls exactly its selected provider once");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("does not echo a provider error body that may contain sensitive evidence", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { message: "workspace-secret-fragment" } }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  try {
    await assert.rejects(
      () =>
        requestProviderPlan({
          connection: connection("responses"),
          instructions: "x",
          input: "y",
          schema,
          schemaName: "orbit_test",
          signal: new AbortController().signal,
        }),
      (error) => {
        assert.match(error.message, /rejected Orbit's request \(401\)/i);
        assert.doesNotMatch(error.message, /workspace-secret-fragment/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("enforces each profile's input and output token budget before accepting a plan", async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (_input, init) => {
      calls += 1;
      const request = JSON.parse(String(init.body));
      assert.equal(request.max_output_tokens, 512);
      return jsonResponse({
        output: [{ content: [{ type: "output_text", text: JSON.stringify(output) }] }],
        usage: { input_tokens: 20, output_tokens: 513 },
      });
    };
    const budgeted = {
      ...connection("responses"),
      budget: { maxInputTokens: 1_024, maxOutputTokens: 512 },
    };
    await assert.rejects(
      () =>
        requestProviderPlan({
          connection: budgeted,
          instructions: "x".repeat(2_100),
          input: "y",
          schema,
          schemaName: "orbit_test",
          signal: new AbortController().signal,
        }),
      /estimated.*above.*input budget/i,
    );
    assert.equal(calls, 0);
    await assert.rejects(
      () =>
        requestProviderPlan({
          connection: budgeted,
          instructions: "short",
          input: "bounded",
          schema,
          schemaName: "orbit_test",
          signal: new AbortController().signal,
        }),
      /reported output usage above/i,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
