import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_OPENAI_MODEL, modelProviderStatus, normalizeRuneModelMode } from "../app/lib/model-preference.ts";
import { GET as getModelStatus } from "../app/api/model-status/route.ts";
import {
  DEFAULT_MODEL_TOKEN_BUDGET,
  MAX_MODEL_PROFILES,
  UNKNOWN_MODEL_CONNECTION_HEALTH,
  modelCapabilityManifest,
  modelProviderAvailableInEnvironment,
  normalizeCustomModelBaseURL,
  normalizeModelProfileDraft,
  normalizeModelProfileVault,
  publicModelProfile,
} from "../app/lib/model-profiles.ts";
import {
  readModelProfileVault,
  resolveActiveModelConnection,
  resolveModelRouting,
  serializeModelProfileVaultCookie,
} from "../app/lib/model-credential-vault.ts";
import { GET as getModelProfiles, POST as postModelProfiles } from "../app/api/model-profiles/route.ts";

test("normalizes only non-secret Orbit model preferences", () => {
  assert.equal(normalizeRuneModelMode("model-assisted"), "model-assisted");
  assert.equal(normalizeRuneModelMode("device-tools-only"), "device-tools-only");
  assert.equal(normalizeRuneModelMode("auto"), "model-assisted");
  assert.equal(normalizeRuneModelMode("local"), "device-tools-only");
  assert.equal(normalizeRuneModelMode("openai"), null);
  assert.equal(normalizeRuneModelMode(null), null);
});

test("exposes model readiness without exposing the server credential", () => {
  assert.deepEqual(modelProviderStatus({}), {
    configured: false,
    provider: null,
    model: null,
    budget: null,
    capabilities: null,
    health: UNKNOWN_MODEL_CONNECTION_HEALTH,
  });
  assert.deepEqual(modelProviderStatus({ OPENAI_API_KEY: "secret" }), {
    configured: true,
    provider: "openai",
    model: DEFAULT_OPENAI_MODEL,
    budget: DEFAULT_MODEL_TOKEN_BUDGET,
    capabilities: modelCapabilityManifest("responses"),
    health: UNKNOWN_MODEL_CONNECTION_HEALTH,
  });
  assert.deepEqual(modelProviderStatus({ OPENAI_API_KEY: "secret", OPENAI_MODEL: "gpt-5.6-terra" }), {
    configured: true,
    provider: "openai",
    model: "gpt-5.6-terra",
    budget: DEFAULT_MODEL_TOKEN_BUDGET,
    capabilities: modelCapabilityManifest("responses"),
    health: UNKNOWN_MODEL_CONNECTION_HEALTH,
  });
  assert.deepEqual(modelProviderStatus({ OPENAI_API_KEY: "secret", OPENAI_MODEL: "secret value\nwith spaces" }), {
    configured: true,
    provider: "openai",
    model: DEFAULT_OPENAI_MODEL,
    budget: DEFAULT_MODEL_TOKEN_BUDGET,
    capabilities: modelCapabilityManifest("responses"),
    health: UNKNOWN_MODEL_CONNECTION_HEALTH,
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
    assert.deepEqual(body, {
      configured: true,
      provider: "openai",
      model: "gpt-5.6-sol",
      source: "deployment",
      profileName: "Deployment OpenAI",
      budget: DEFAULT_MODEL_TOKEN_BUDGET,
      capabilities: modelCapabilityManifest("responses"),
      health: UNKNOWN_MODEL_CONNECTION_HEALTH,
    });
    assert.doesNotMatch(JSON.stringify(body), /route-only-secret/);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = previousModel;
  }
});

test("normalizes supported model presets and rejects unsafe custom endpoints", () => {
  assert.equal(normalizeCustomModelBaseURL("https://models.example.com/v1/"), "https://models.example.com/v1");
  for (const endpoint of [
    "http://models.example.com/v1",
    "https://localhost/v1",
    "https://127.0.0.1/v1",
    "https://models.internal/v1",
    "https://models.example.com/v1/responses",
    "https://user:pass@models.example.com/v1",
  ]) {
    assert.throws(() => normalizeCustomModelBaseURL(endpoint));
  }
  const openAI = normalizeModelProfileDraft(
    {
      provider: "openai",
      name: "Work",
      baseURL: "https://attacker.example/v1",
      model: "gpt-5.6",
      apiKey: "secret-key",
    },
    undefined,
    "2026-08-13T00:00:00.000Z",
    () => "profile-1",
  );
  assert.equal(openAI.baseURL, "https://api.openai.com/v1");
  assert.equal(openAI.protocol, "responses");
  assert.equal(openAI.id, "profile-1");
  assert.deepEqual(openAI.budget, DEFAULT_MODEL_TOKEN_BUDGET);
  assert.equal(publicModelProfile(openAI).capabilities.structuredOutput, "json-schema");
  assert.doesNotMatch(JSON.stringify(publicModelProfile(openAI)), /secret-key/);
  assert.throws(
    () =>
      normalizeModelProfileDraft(
        {
          ...openAI,
          provider: "openrouter",
          apiKey: "",
        },
        openAI,
      ),
    /new API key/i,
  );
  assert.throws(
    () =>
      normalizeModelProfileDraft(
        {
          ...openAI,
          provider: "custom",
          baseURL: "https://different.example.com/v1",
          apiKey: "",
        },
        { ...openAI, provider: "custom", baseURL: "https://models.example.com/v1" },
      ),
    /new API key/i,
  );
  const anthropic = normalizeModelProfileDraft({
    provider: "anthropic",
    protocol: "responses",
    model: "claude-sonnet-5",
    apiKey: "anthropic-secret",
  });
  assert.equal(anthropic.baseURL, "https://api.anthropic.com/v1");
  assert.equal(anthropic.protocol, "anthropic-messages");
  const deepseek = normalizeModelProfileDraft({
    provider: "deepseek",
    protocol: "anthropic-messages",
    baseURL: "https://api.deepseek.com/anthropic",
    model: "deepseek-v4-flash",
    apiKey: "deepseek-secret",
  });
  assert.equal(deepseek.baseURL, "https://api.deepseek.com/anthropic");
  assert.equal(deepseek.protocol, "anthropic-messages");
  const gemini = normalizeModelProfileDraft({
    provider: "gemini",
    model: "gemini-2.5-pro",
    apiKey: "gemini-secret",
  });
  assert.equal(gemini.protocol, "gemini-generate-content");
  const chat = normalizeModelProfileDraft({
    provider: "custom",
    protocol: "chat-completions",
    baseURL: "https://models.example.com/v1",
    model: "chat-model",
    apiKey: "chat-secret",
    budget: { maxInputTokens: 2_048, maxOutputTokens: 512 },
  });
  assert.equal(chat.protocol, "chat-completions");
  assert.deepEqual(chat.budget, { maxInputTokens: 2_048, maxOutputTokens: 512 });
  const ollama = normalizeModelProfileDraft({ provider: "ollama", model: "qwen3:8b", apiKey: "" });
  assert.equal(ollama.baseURL, "http://127.0.0.1:11434/v1");
  assert.equal(ollama.protocol, "chat-completions");
  assert.equal(ollama.apiKey, "");
  assert.equal(modelProviderAvailableInEnvironment("ollama", {}), false);
  assert.equal(modelProviderAvailableInEnvironment("ollama", { RUNE_DESKTOP_RUNTIME: "1" }), true);
  assert.equal(modelProviderAvailableInEnvironment("openai", {}), true);
  assert.throws(
    () =>
      normalizeModelProfileDraft(
        {
          ...chat,
          protocol: "responses",
          apiKey: "",
        },
        chat,
      ),
    /new API key/i,
  );
});

test("encrypts personal credentials in an HttpOnly cookie and rejects tampering", async () => {
  const environment = { NODE_ENV: "production", RUNE_CREDENTIAL_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef" };
  const request = new Request("https://rune.example/api/model-profiles");
  const profile = normalizeModelProfileDraft(
    {
      provider: "custom",
      name: "Research gateway",
      baseURL: "https://models.example.com/v1",
      model: "rune-model-1",
      apiKey: "personal-secret",
    },
    undefined,
    "2026-08-13T00:00:00.000Z",
    () => "profile-1",
  );
  const vault = { version: 1, activeProfileId: profile.id, failoverEnabled: false, profiles: [profile] };
  const cookie = await serializeModelProfileVaultCookie(request, vault, environment);
  assert.match(cookie, /^rune_model_profiles_v1=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\/api/);
  assert.match(cookie, /Secure/);
  assert.doesNotMatch(cookie, /personal-secret|Research gateway/);

  const readRequest = new Request("https://rune.example/api/model-profiles", {
    headers: { cookie: cookie.split(";", 1)[0] },
  });
  assert.deepEqual(await readModelProfileVault(readRequest, environment), vault);
  const connection = await resolveActiveModelConnection(readRequest, environment);
  assert.equal(connection?.apiKey, "personal-secret");
  assert.equal(connection?.baseURL, "https://models.example.com/v1");

  const [name, value] = cookie.split(";", 1)[0].split("=");
  const tamperIndex = Math.floor(value.length / 2);
  const tampered = `${name}=${value.slice(0, tamperIndex)}${value[tamperIndex] === "a" ? "b" : "a"}${value.slice(tamperIndex + 1)}`;
  const empty = await readModelProfileVault(
    new Request("https://rune.example", { headers: { cookie: tampered } }),
    environment,
  );
  assert.deepEqual(empty.profiles, []);
});

test("migrates existing v1 profiles without a protocol to the provider's explicit default", () => {
  const legacy = {
    id: "legacy",
    name: "Legacy OpenRouter",
    provider: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    model: "openai/gpt-5.6",
    apiKey: "legacy-secret",
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
  };
  const normalized = normalizeModelProfileVault({ version: 1, activeProfileId: "legacy", profiles: [legacy] });
  assert.equal(normalized.profiles.length, 1);
  assert.equal(normalized.profiles[0].protocol, "chat-completions");
  assert.equal(normalized.profiles[0].apiKey, "legacy-secret");
});

test("model profile route saves, redacts, activates, and deletes personal profiles", async () => {
  const previousSecret = process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY;
  const previousNodeEnvironment = process.env.NODE_ENV;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY = "abcdef0123456789abcdef0123456789";
  process.env.NODE_ENV = "production";
  delete process.env.OPENAI_API_KEY;
  try {
    const save = await postModelProfiles(
      new Request("https://rune.example/api/model-profiles", {
        method: "POST",
        headers: { origin: "https://rune.example", "content-type": "application/json" },
        body: JSON.stringify({
          action: "upsert",
          profile: {
            provider: "openrouter",
            name: "Router",
            model: "openai/gpt-5.6",
            apiKey: "route-secret",
          },
        }),
      }),
    );
    assert.equal(save.status, 200);
    const saved = await save.json();
    assert.equal(saved.configured, true);
    assert.equal(saved.activeSource, "personal");
    assert.equal(saved.profiles.length, 1);
    assert.equal(saved.profiles[0].baseURL, "https://openrouter.ai/api/v1");
    assert.doesNotMatch(JSON.stringify(saved), /route-secret/);
    const cookie = save.headers.get("set-cookie").split(";", 1)[0];

    const refusedFailover = await postModelProfiles(
      new Request("https://rune.example/api/model-profiles", {
        method: "POST",
        headers: { origin: "https://rune.example", cookie, "content-type": "application/json" },
        body: JSON.stringify({ action: "failover", enabled: true }),
      }),
    );
    assert.equal(refusedFailover.status, 400);
    assert.match((await refusedFailover.json()).error, /at least two model connections/i);

    process.env.OPENAI_API_KEY = "deployment-route-secret";
    const allowFailover = await postModelProfiles(
      new Request("https://rune.example/api/model-profiles", {
        method: "POST",
        headers: { origin: "https://rune.example", cookie, "content-type": "application/json" },
        body: JSON.stringify({ action: "failover", enabled: true }),
      }),
    );
    assert.equal(allowFailover.status, 200);
    assert.equal((await allowFailover.json()).failoverEnabled, true);
    assert.match(allowFailover.headers.get("set-cookie"), /HttpOnly/u);
    delete process.env.OPENAI_API_KEY;

    const get = await getModelProfiles(new Request("https://rune.example/api/model-profiles", { headers: { cookie } }));
    const listed = await get.json();
    assert.equal(listed.activeProfile.name, "Router");
    assert.doesNotMatch(JSON.stringify(listed), /route-secret/);

    const remove = await postModelProfiles(
      new Request("https://rune.example/api/model-profiles", {
        method: "POST",
        headers: { origin: "https://rune.example", cookie, "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", profileId: saved.activeProfileId }),
      }),
    );
    assert.equal(remove.status, 200);
    assert.match(remove.headers.get("set-cookie"), /Max-Age=0/);
    assert.equal((await remove.json()).configured, false);

    const crossOrigin = await postModelProfiles(
      new Request("https://rune.example/api/model-profiles", {
        method: "POST",
        headers: { origin: "https://evil.example", "content-type": "application/json" },
        body: JSON.stringify({ action: "activate", profileId: "anything" }),
      }),
    );
    assert.equal(crossOrigin.status, 403);
    assert.equal(MAX_MODEL_PROFILES, 3);
  } finally {
    if (previousSecret === undefined) delete process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY = previousSecret;
    if (previousNodeEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnvironment;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("fetches a bounded model catalog without following redirects or returning the credential", async () => {
  const previousSecret = process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY;
  const previousFetch = globalThis.fetch;
  process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY = "99999999999999999999999999999999";
  let providerRequest;
  globalThis.fetch = async (input, init) => {
    providerRequest = { input: String(input), init };
    return new Response(
      JSON.stringify({
        data: [{ id: "gpt-5.6" }, { id: "gpt-5.6" }, { id: "gpt-5.6-terra" }, { name: "missing-id" }],
      }),
      { headers: { "content-type": "application/json" } },
    );
  };
  try {
    const response = await postModelProfiles(
      new Request("https://rune.example/api/model-profiles", {
        method: "POST",
        headers: { origin: "https://rune.example", "content-type": "application/json" },
        body: JSON.stringify({
          action: "models",
          profile: {
            provider: "openai",
            model: "gpt-5.6",
            apiKey: "catalog-secret",
          },
        }),
      }),
    );
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload, { models: ["gpt-5.6", "gpt-5.6-terra"] });
    assert.equal(providerRequest.input, "https://api.openai.com/v1/models");
    assert.equal(providerRequest.init.redirect, "error");
    assert.equal(new Headers(providerRequest.init.headers).get("authorization"), "Bearer catalog-secret");
    assert.doesNotMatch(JSON.stringify(payload), /catalog-secret/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousSecret === undefined) delete process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY = previousSecret;
  }
});

test("verifies DeepSeek through its canonical model catalog even when generation uses Anthropic Messages", async () => {
  const previousSecret = process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY;
  const previousFetch = globalThis.fetch;
  process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY = "deepseek-vault-key-0123456789abcdef";
  let providerRequest;
  globalThis.fetch = async (input, init) => {
    providerRequest = { input: String(input), init };
    return new Response(JSON.stringify({ data: [{ id: "deepseek-v4-flash" }, { id: "deepseek-v4-pro" }] }), {
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const response = await postModelProfiles(
      new Request("https://rune.example/api/model-profiles", {
        method: "POST",
        headers: { origin: "https://rune.example", "content-type": "application/json" },
        body: JSON.stringify({
          action: "models",
          profile: {
            provider: "deepseek",
            protocol: "anthropic-messages",
            baseURL: "https://api.deepseek.com/anthropic",
            model: "deepseek-v4-flash",
            apiKey: "deepseek-catalog-secret",
          },
        }),
      }),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { models: ["deepseek-v4-flash", "deepseek-v4-pro"] });
    assert.equal(providerRequest.input, "https://api.deepseek.com/models");
    const headers = new Headers(providerRequest.init.headers);
    assert.equal(headers.get("authorization"), "Bearer deepseek-catalog-secret");
    assert.equal(headers.has("x-api-key"), false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousSecret === undefined) delete process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY = previousSecret;
  }
});

test("keeps loopback model runtimes desktop-only and never invents an authorization header", async () => {
  const previousSecret = process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY;
  const previousDesktopRuntime = process.env.RUNE_DESKTOP_RUNTIME;
  const previousFetch = globalThis.fetch;
  process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY = "desktop-vault-key-0123456789abcdef";
  delete process.env.RUNE_DESKTOP_RUNTIME;
  const profile = { provider: "ollama", name: "Ollama", model: "qwen3:8b", apiKey: "" };
  try {
    const webSave = await postModelProfiles(
      new Request("https://rune.example/api/model-profiles", {
        method: "POST",
        headers: { origin: "https://rune.example", "content-type": "application/json" },
        body: JSON.stringify({ action: "upsert", profile }),
      }),
    );
    assert.equal(webSave.status, 400);
    assert.match((await webSave.json()).error, /desktop app/i);

    process.env.RUNE_DESKTOP_RUNTIME = "1";
    let providerRequest;
    globalThis.fetch = async (input, init) => {
      providerRequest = { input: String(input), init };
      return new Response(JSON.stringify({ data: [{ id: "qwen3:8b" }] }), {
        headers: { "content-type": "application/json" },
      });
    };
    const catalog = await postModelProfiles(
      new Request("https://rune.example/api/model-profiles", {
        method: "POST",
        headers: { origin: "https://rune.example", "content-type": "application/json" },
        body: JSON.stringify({ action: "models", profile }),
      }),
    );
    assert.equal(catalog.status, 200);
    assert.deepEqual(await catalog.json(), { models: ["qwen3:8b"] });
    assert.equal(providerRequest.input, "http://127.0.0.1:11434/v1/models");
    assert.equal(new Headers(providerRequest.init.headers).has("authorization"), false);

    const save = await postModelProfiles(
      new Request("https://rune.example/api/model-profiles", {
        method: "POST",
        headers: { origin: "https://rune.example", "content-type": "application/json" },
        body: JSON.stringify({ action: "upsert", profile }),
      }),
    );
    assert.equal(save.status, 200);
    const saved = await save.json();
    assert.equal(saved.activeProfile.provider, "ollama");
    const cookie = save.headers.get("set-cookie").split(";", 1)[0];
    delete process.env.RUNE_DESKTOP_RUNTIME;
    const refusedActivation = await postModelProfiles(
      new Request("https://rune.example/api/model-profiles", {
        method: "POST",
        headers: { origin: "https://rune.example", cookie, "content-type": "application/json" },
        body: JSON.stringify({ action: "activate", profileId: saved.activeProfileId }),
      }),
    );
    assert.equal(refusedActivation.status, 400);
    assert.deepEqual(
      (await resolveModelRouting(new Request("https://rune.example/api/agent", { headers: { cookie } }), process.env))
        .connections,
      [],
    );
    process.env.RUNE_DESKTOP_RUNTIME = "1";
    const desktopRouting = await resolveModelRouting(
      new Request("https://rune.example/api/agent", { headers: { cookie } }),
      process.env,
    );
    assert.equal(desktopRouting.connections[0]?.provider, "ollama");
    assert.equal(desktopRouting.connections[0]?.apiKey, "");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousSecret === undefined) delete process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY = previousSecret;
    if (previousDesktopRuntime === undefined) delete process.env.RUNE_DESKTOP_RUNTIME;
    else process.env.RUNE_DESKTOP_RUNTIME = previousDesktopRuntime;
  }
});

test("personal profile takes precedence over the deployment connection", async () => {
  const environment = {
    NODE_ENV: "production",
    RUNE_CREDENTIAL_ENCRYPTION_KEY: "fedcba9876543210fedcba9876543210",
    OPENAI_API_KEY: "deployment-key",
    OPENAI_MODEL: "deployment-model",
  };
  const profile = normalizeModelProfileDraft(
    {
      provider: "openrouter",
      model: "openai/gpt-5.6",
      apiKey: "personal-key",
    },
    undefined,
    "2026-08-13T00:00:00.000Z",
    () => "personal",
  );
  const baseRequest = new Request("https://rune.example/api/model-profiles");
  const cookie = await serializeModelProfileVaultCookie(
    baseRequest,
    { version: 1, activeProfileId: "personal", profiles: [profile] },
    environment,
  );
  const connection = await resolveActiveModelConnection(
    new Request("https://rune.example/api/agent", {
      headers: { cookie: cookie.split(";", 1)[0] },
    }),
    environment,
  );
  assert.equal(connection?.source, "personal");
  assert.equal(connection?.apiKey, "personal-key");
  assert.equal(connection?.model, "openai/gpt-5.6");
});

test("routing preserves the selected profile first and exposes fallbacks only after explicit authorization", async () => {
  const environment = {
    RUNE_CREDENTIAL_ENCRYPTION_KEY: "routing-vault-key-0123456789abcdef",
    OPENAI_API_KEY: "deployment-key",
  };
  const primary = normalizeModelProfileDraft(
    { provider: "openai", name: "Primary", model: "primary-model", apiKey: "primary-key" },
    undefined,
    "2026-08-19T00:00:00.000Z",
    () => "primary",
  );
  const fallback = normalizeModelProfileDraft(
    { provider: "anthropic", name: "Fallback", model: "fallback-model", apiKey: "fallback-key" },
    undefined,
    "2026-08-19T00:00:00.000Z",
    () => "fallback",
  );
  const baseRequest = new Request("https://rune.example/api/model-profiles");
  async function routing(failoverEnabled) {
    const cookie = await serializeModelProfileVaultCookie(
      baseRequest,
      { version: 1, activeProfileId: primary.id, failoverEnabled, profiles: [primary, fallback] },
      environment,
    );
    return resolveModelRouting(
      new Request("https://rune.example/api/agent", { headers: { cookie: cookie.split(";", 1)[0] } }),
      environment,
    );
  }
  const single = await routing(false);
  assert.equal(single.failoverEnabled, false);
  assert.deepEqual(
    single.connections.map((connection) => connection.profileName),
    ["Primary"],
  );
  const authorized = await routing(true);
  assert.equal(authorized.failoverEnabled, true);
  assert.deepEqual(
    authorized.connections.map((connection) => connection.profileName),
    ["Primary", "Fallback", "Deployment OpenAI"],
  );
});

test("can switch from a personal profile back to the deployment model without deleting it", async () => {
  const previousSecret = process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY = "1234567890abcdef1234567890abcdef";
  process.env.OPENAI_API_KEY = "deployment-secret";
  try {
    const profile = normalizeModelProfileDraft(
      {
        provider: "openai",
        model: "personal-model",
        apiKey: "personal-secret",
      },
      undefined,
      "2026-08-13T00:00:00.000Z",
      () => "personal",
    );
    const request = new Request("https://rune.example/api/model-profiles");
    const cookie = await serializeModelProfileVaultCookie(request, {
      version: 1,
      activeProfileId: "personal",
      profiles: [profile],
    });
    const switched = await postModelProfiles(
      new Request("https://rune.example/api/model-profiles", {
        method: "POST",
        headers: {
          origin: "https://rune.example",
          cookie: cookie.split(";", 1)[0],
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "deployment" }),
      }),
    );
    assert.equal(switched.status, 200);
    const body = await switched.json();
    assert.equal(body.activeSource, "deployment");
    assert.equal(body.profiles.length, 1);
    const nextCookie = switched.headers.get("set-cookie").split(";", 1)[0];
    const connection = await resolveActiveModelConnection(
      new Request("https://rune.example/api/agent", { headers: { cookie: nextCookie } }),
    );
    assert.equal(connection?.source, "deployment");
    assert.equal(connection?.apiKey, "deployment-secret");
  } finally {
    if (previousSecret === undefined) delete process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY = previousSecret;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});
