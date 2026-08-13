import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../app/api/tasks/document-briefing/route.ts";
import { serializeModelProfileVaultCookie } from "../app/lib/model-credential-vault.ts";
import { normalizeModelProfileDraft } from "../app/lib/model-profiles.ts";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENAI_API_KEY;
const originalVaultKey = process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY;

const artifact = {
  id: "launch-source",
  name: "launch-source.md",
  kind: "document",
  language: "Markdown",
  source: "# Launch\n\n## Context\n\nTeams need a source-linked review workflow with visible proposed changes.\n\n## Decision\n\nApprove the next cohort only after the reviewed workflow passes.",
};

const input = {
  sourceArtifactId: artifact.id,
  title: "Launch briefing",
  audience: "leadership",
  focus: "Decide whether the next cohort is ready.",
  slideCount: 4,
  locale: "en",
};

test.after(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
  if (originalVaultKey === undefined) delete process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY;
  else process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY = originalVaultKey;
});

async function personalCookie() {
  process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY = "document-briefing-vault-key-123456789";
  delete process.env.OPENAI_API_KEY;
  const profile = normalizeModelProfileDraft({
    provider: "custom",
    name: "Private narrative model",
    baseURL: "https://models.example.com/v1",
    model: "narrative-1",
    apiKey: "document-briefing-secret",
  }, undefined, "2026-08-14T00:00:00.000Z", () => "briefing");
  return (await serializeModelProfileVaultCookie(
    new Request("https://rune.example/api/model-profiles"),
    { version: 1, activeProfileId: profile.id, profiles: [profile] },
  )).split(";", 1)[0];
}

function providerResponse(outline) {
  return {
    output: [{ content: [{ type: "output_text", text: JSON.stringify(outline) }] }],
    usage: { input_tokens: 31, output_tokens: 17 },
  };
}

test("shapes a bounded source-evidenced outline through the active personal model", async () => {
  const cookie = await personalCookie();
  let providerRequest;
  globalThis.fetch = async (url, init) => {
    providerRequest = { url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) };
    return new Response(JSON.stringify(providerResponse({
      slides: [
        { sourceUnitId: "source-1", title: "A visible workflow", bullets: ["Every proposed change remains reviewable."] },
        { sourceUnitId: "source-2", title: "A bounded decision", bullets: ["Approve only after the workflow passes."] },
      ],
    })), { headers: { "content-type": "application/json" } });
  };
  const response = await POST(new Request("https://rune.example/api/tasks/document-briefing", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ artifact, input }),
  }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.provider, "custom");
  assert.equal(payload.profileName, "Private narrative model");
  assert.equal(payload.model, "narrative-1");
  assert.deepEqual(payload.usage, { inputTokens: 31, outputTokens: 17 });
  assert.equal(payload.outline.slides.length, 2);
  assert.equal(providerRequest.url, "https://models.example.com/v1/responses");
  assert.equal(providerRequest.headers.get("authorization"), "Bearer document-briefing-secret");
  assert.equal(providerRequest.body.text.format.name, "document_briefing_outline");
  assert.match(providerRequest.body.input[0].content, /Rune owns the cover, conclusion, file identity/u);
  assert.match(providerRequest.body.input[1].content, /"sourceUnitId": "source-1"/u);
  assert.doesNotMatch(JSON.stringify(payload), /document-briefing-secret/u);
});

test("rejects a model outline that reuses evidence instead of broadening model authority", async () => {
  const cookie = await personalCookie();
  globalThis.fetch = async () => new Response(JSON.stringify(providerResponse({
    slides: [
      { sourceUnitId: "source-1", title: "First", bullets: ["One"] },
      { sourceUnitId: "source-1", title: "Repeated", bullets: ["Two"] },
    ],
  })), { headers: { "content-type": "application/json" } });
  const response = await POST(new Request("https://rune.example/api/tasks/document-briefing", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ artifact, input }),
  }));
  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.equal(payload.code, "MODEL_OUTLINE_INVALID");
  assert.match(payload.error, /Every bounded source unit/u);
});

test("returns an explicit unconfigured result without contacting a provider", async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY;
  globalThis.fetch = async () => { throw new Error("provider must not be called"); };
  const response = await POST(new Request("http://localhost/api/tasks/document-briefing", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ artifact, input }),
  }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "MODEL_UNCONFIGURED");
});
