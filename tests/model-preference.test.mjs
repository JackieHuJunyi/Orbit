import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_OPENAI_MODEL,
  modelProviderStatus,
  normalizeRuneModelMode,
} from "../app/lib/model-preference.ts";
import { GET as getModelStatus } from "../app/api/model-status/route.ts";

test("normalizes only non-secret Rune model preferences", () => {
  assert.equal(normalizeRuneModelMode("auto"), "auto");
  assert.equal(normalizeRuneModelMode("local"), "local");
  assert.equal(normalizeRuneModelMode("openai"), null);
  assert.equal(normalizeRuneModelMode(null), null);
});

test("exposes model readiness without exposing the server credential", () => {
  assert.deepEqual(modelProviderStatus({}), {
    configured: false,
    provider: null,
    model: null,
  });
  assert.deepEqual(modelProviderStatus({ OPENAI_API_KEY: "secret" }), {
    configured: true,
    provider: "openai",
    model: DEFAULT_OPENAI_MODEL,
  });
  assert.deepEqual(modelProviderStatus({ OPENAI_API_KEY: "secret", OPENAI_MODEL: "gpt-5.6-terra" }), {
    configured: true,
    provider: "openai",
    model: "gpt-5.6-terra",
  });
  assert.deepEqual(modelProviderStatus({ OPENAI_API_KEY: "secret", OPENAI_MODEL: "secret value\nwith spaces" }), {
    configured: true,
    provider: "openai",
    model: DEFAULT_OPENAI_MODEL,
  });
});

test("returns only bounded non-secret model status from the API route", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = "route-only-secret";
  process.env.OPENAI_MODEL = "gpt-5.6-sol";
  try {
    const response = await getModelStatus();
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.deepEqual(body, { configured: true, provider: "openai", model: "gpt-5.6-sol" });
    assert.doesNotMatch(JSON.stringify(body), /route-only-secret/);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = previousModel;
  }
});
