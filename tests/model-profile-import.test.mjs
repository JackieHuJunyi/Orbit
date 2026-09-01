import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_MODEL_PROFILE_IMPORT_BYTES,
  ModelProfileImportError,
  modelProfileImportReview,
  parseModelProfileImport,
} from "../app/lib/model-profile-import.ts";

test("imports one Rune JSON profile with aliases and a custom compatible endpoint", () => {
  const result = parseModelProfileImport(
    JSON.stringify({
      profile_name: "Team gateway",
      provider: "openai",
      api_protocol: "chat-completions",
      base_url: "https://models.example.com/v1/",
      model_id: "team/model-v2",
      api_key: "secret-json-key",
      max_input_tokens: 32_000,
      max_output_tokens: 2_000,
    }),
  );

  assert.equal(result.source, "rune-json");
  assert.deepEqual(result.draft, {
    provider: "custom",
    protocol: "chat-completions",
    name: "Team gateway",
    baseURL: "https://models.example.com/v1",
    model: "team/model-v2",
    budget: { maxInputTokens: 32_000, maxOutputTokens: 2_000 },
    apiKey: "secret-json-key",
  });
  assert.deepEqual(result.warnings, []);
});

test("imports a CC Switch Codex provider without navigating to the secret-bearing link", () => {
  const result = parseModelProfileImport(
    "ccswitch://v1/import?resource=provider&app=codex&name=Personal%20OpenAI&endpoint=https%3A%2F%2Fapi.openai.com%2Fv1&apiKey=secret-link-key&model=gpt-5.6",
  );

  assert.equal(result.source, "cc-switch-deeplink");
  assert.equal(result.draft.provider, "openai");
  assert.equal(result.draft.protocol, "responses");
  assert.equal(result.draft.baseURL, "https://api.openai.com/v1");
  assert.equal(result.draft.model, "gpt-5.6");
  assert.equal(result.draft.apiKey, "secret-link-key");
});

test("maps a CC Switch Claude gateway to Rune's custom Anthropic protocol", () => {
  const result = parseModelProfileImport(
    "ccswitch://v1/import?resource=provider&app=claude&endpoint=https%3A%2F%2Fclaude.example.com%2Fv1&model=claude-team&apiKey=secret",
  );
  assert.equal(result.draft.provider, "custom");
  assert.equal(result.draft.protocol, "anthropic-messages");
  assert.equal(result.draft.baseURL, "https://claude.example.com/v1");
});

test("imports common CC Switch environment JSON without requiring a credential in the file", () => {
  const result = parseModelProfileImport(
    JSON.stringify({
      name: "Claude gateway",
      env: {
        ANTHROPIC_BASE_URL: "https://anthropic.example.com/v1",
        ANTHROPIC_MODEL: "claude-team",
      },
    }),
  );
  assert.equal(result.draft.provider, "custom");
  assert.equal(result.draft.protocol, "anthropic-messages");
  assert.equal(result.draft.apiKey, "");
  assert.deepEqual(result.warnings, [{ code: "credential-missing" }]);
});

test("produces a review object that never exposes the imported credential", () => {
  const result = parseModelProfileImport(
    '{"provider":"openrouter","model":"openai/gpt-5.6","apiKey":"never-render-this-secret","never-render-this-field":"ignored"}',
  );
  const review = modelProfileImportReview(result);
  assert.equal(review.credentialDetected, true);
  assert.equal("apiKey" in review, false);
  assert.doesNotMatch(JSON.stringify(review), /never-render-this-secret/u);
  assert.doesNotMatch(JSON.stringify(review), /never-render-this-field/u);
});

test("rejects remote, batch, conflicting, local, and oversized imports with stable codes", () => {
  const cases = [
    ['{"provider":"openai","configUrl":"https://example.com/profile.json"}', "remote-config"],
    ['{"profiles":[{"provider":"openai"}]}', "batch"],
    [
      "ccswitch://v1/import?resource=provider&app=codex&endpoint=https://one.example/v1,https://two.example/v1",
      "ambiguous",
    ],
    ['{"provider":"openai","endpoint":"https://api.anthropic.com/v1"}', "ambiguous"],
    ['{"provider":"openai","baseURL":"https://api.openai.com/v1","endpoint":"https://example.com/v1"}', "ambiguous"],
    ['{"env":{"OPENAI_MODEL":"gpt-5.6","ANTHROPIC_MODEL":"claude-sonnet-4"}}', "ambiguous"],
    ['{"provider":"openai","Provider":"anthropic"}', "ambiguous"],
    ['{"provider":"openai","protocol":"unsupported"}', "invalid-fields"],
    ['{"provider":"custom","endpoint":"http://localhost:11434/v1","model":"local"}', "invalid-endpoint"],
    ["x".repeat(MAX_MODEL_PROFILE_IMPORT_BYTES + 1), "too-large"],
  ];
  for (const [input, code] of cases) {
    assert.throws(
      () => parseModelProfileImport(input),
      (error) => error instanceof ModelProfileImportError && error.code === code,
      String(code),
    );
  }
});
