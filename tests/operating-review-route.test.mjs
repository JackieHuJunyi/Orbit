import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../app/api/tasks/operating-review/route.ts";
import { serializeModelProfileVaultCookie } from "../app/lib/model-credential-vault.ts";
import { normalizeModelProfileDraft } from "../app/lib/model-profiles.ts";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENAI_API_KEY;
const originalVaultKey = process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY;

const artifact = {
  id: "source-data",
  name: "source-data.csv",
  kind: "data",
  language: "CSV / JSON",
  source: "Region,Net Revenue\nAPAC,100\nEurope,80\nAPAC,50\n",
};

const input = {
  title: "Growth review",
  dataArtifactId: artifact.id,
  category: "Region",
  value: "Net Revenue",
  aggregation: "sum",
  mark: "bar",
  format: "currency",
  period: "Current period",
  audience: "leadership",
  focus: "Choose the next operating priority.",
  deliverables: ["document", "slides"],
  locale: "en",
};

const validNarrative = {
  insights: [
    {
      primaryEvidenceRowId: "result-1",
      supportingEvidenceRowId: "result-2",
      title: "Where is the result concentrated?",
      question: "What evidence explains the gap between the leading and comparison aggregates?",
      decisionPrompt: "Review whether the current allocation should change before assigning an owner.",
    },
    {
      primaryEvidenceRowId: "result-2",
      supportingEvidenceRowId: null,
      title: "What needs closer review?",
      question: "Could scope or definition choices materially affect this visible pattern?",
      decisionPrompt: "Confirm the evidence boundary before making a final operating decision.",
    },
  ],
};

test.after(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
  if (originalVaultKey === undefined) delete process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY;
  else process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY = originalVaultKey;
});

async function personalCookie() {
  process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY = "operating-review-vault-key-123456789";
  delete process.env.OPENAI_API_KEY;
  const profile = normalizeModelProfileDraft({
    provider: "custom",
    name: "Private review model",
    baseURL: "https://models.example.com/v1",
    model: "review-1",
    apiKey: "operating-review-secret",
  }, undefined, "2026-08-14T00:00:00.000Z", () => "review");
  return (await serializeModelProfileVaultCookie(
    new Request("https://rune.example/api/model-profiles"),
    { version: 1, activeProfileId: profile.id, profiles: [profile] },
  )).split(";", 1)[0];
}

function providerResponse(narrative) {
  return {
    output: [{ content: [{ type: "output_text", text: JSON.stringify(narrative) }] }],
    usage: { input_tokens: 29, output_tokens: 13 },
  };
}

test("sends only bounded aggregate evidence to the active personal model and returns validated questions", async () => {
  const cookie = await personalCookie();
  let providerRequest;
  globalThis.fetch = async (url, init) => {
    providerRequest = {
      url: String(url),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    };
    return new Response(JSON.stringify(providerResponse(validNarrative)), {
      headers: { "content-type": "application/json" },
    });
  };
  const response = await POST(new Request("https://rune.example/api/tasks/operating-review", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ artifact, input }),
  }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.provider, "custom");
  assert.equal(payload.profileName, "Private review model");
  assert.equal(payload.model, "review-1");
  assert.deepEqual(payload.usage, { inputTokens: 29, outputTokens: 13 });
  assert.deepEqual(payload.narrative, validNarrative);
  assert.equal(providerRequest.url, "https://models.example.com/v1/responses");
  assert.equal(providerRequest.headers.get("authorization"), "Bearer operating-review-secret");
  assert.equal(providerRequest.body.text.format.name, "operating_review_questions");
  assert.match(providerRequest.body.input[0].content, /Rune will insert live category context and every numeric value deterministically/u);
  const modelInput = JSON.parse(providerRequest.body.input[1].content);
  assert.deepEqual(modelInput.aggregateEvidence, [
    { id: "result-1", category: "APAC", value: 150, sourceRowCount: 2 },
    { id: "result-2", category: "Europe", value: 80, sourceRowCount: 1 },
  ]);
  assert.doesNotMatch(providerRequest.body.input[1].content, /Region,Net Revenue/u);
  assert.doesNotMatch(JSON.stringify(payload), /operating-review-secret/u);
});

test("rejects model prose that copies a source category instead of broadening write authority", async () => {
  const cookie = await personalCookie();
  globalThis.fetch = async () => new Response(JSON.stringify(providerResponse({
    insights: [
      { ...validNarrative.insights[0], title: "Why does APAC lead?" },
      validNarrative.insights[1],
    ],
  })), { headers: { "content-type": "application/json" } });
  const response = await POST(new Request("https://rune.example/api/tasks/operating-review", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ artifact, input }),
  }));
  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.equal(payload.code, "MODEL_NARRATIVE_INVALID");
  assert.match(payload.error, /generic qualitative text/u);
});

test("returns an explicit unconfigured result without contacting a provider", async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY;
  globalThis.fetch = async () => { throw new Error("provider must not be called"); };
  const response = await POST(new Request("http://localhost/api/tasks/operating-review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ artifact, input }),
  }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "MODEL_UNCONFIGURED");
});
