import assert from "node:assert/strict";
import test from "node:test";

import {
  agentModelSelectionOpensSettings,
  agentModelSelectionRequest,
  buildAgentModelOptions,
  discoveredAgentModelId,
  selectedAgentModelValue,
} from "../app/lib/agent-model-options.ts";
import { connectDiscoveredModelConnection } from "../app/lib/model-connection-client.ts";

const labels = {
  local: "Local tools",
  localDetail: "Deterministic work with no model call",
  connected: "Connected",
  needsSignIn: "Sign in required",
};

const deepseekCandidate = {
  id: "deepseek-cc-switch",
  sourceKind: "cc-switch",
  sourceLabel: "CC Switch · DeepSeek",
  locality: "cloud",
  provider: "deepseek",
  protocol: "chat-completions",
  name: "DeepSeek",
  baseURL: "https://api.deepseek.com",
  model: "deepseek-v4-flash",
  models: [],
  credentialState: "detected",
};

test("keeps discovered connections and account sign-in entry points in Chat after onboarding was skipped", () => {
  const options = buildAgentModelOptions(
    null,
    {
      supported: true,
      candidates: [deepseekCandidate],
      accounts: [
        {
          id: "claude",
          provider: "claude-account",
          label: "Claude",
          sourceLabel: "Claude Code · Claude account",
          model: "claude-account",
          installed: true,
          status: "sign-in-required",
        },
      ],
    },
    labels,
  );
  assert.deepEqual(
    options.map(({ value, group, action }) => ({ value, group, action })),
    [
      { value: "discovered:deepseek-cc-switch", group: "available", action: "connect" },
      { value: "account-settings:claude", group: "available", action: "settings" },
      { value: "local", group: "local", action: "local" },
    ],
  );
  assert.equal(discoveredAgentModelId(options[0].value), "deepseek-cc-switch");
  assert.equal(agentModelSelectionOpensSettings(options[1].value), true);
  assert.deepEqual(agentModelSelectionRequest("profile:deepseek:profile-model:deepseek-v4-pro"), {
    action: "profile-model",
    profileId: "deepseek",
    model: "deepseek-v4-pro",
  });
  assert.equal(selectedAgentModelValue("device-tools-only", null), "local");
});

test("renders only the models and effort levels returned by a signed-in Codex account", () => {
  const accountProfile = {
    id: "codex",
    name: "Codex · ChatGPT account",
    provider: "codex-account",
    protocol: "responses",
    baseURL: "http://127.0.0.1:54321/__orbit_account__/codex/v1",
    model: "gpt-6-astra@medium",
    budget: { maxInputTokens: 16_000, maxOutputTokens: 4_000 },
    createdAt: "2026-09-14T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z",
    credentialConfigured: true,
    capabilities: {},
    health: { status: "unknown", checkedAt: null, retryAt: null },
  };
  const state = {
    vaultAvailable: true,
    configured: true,
    activeProfileId: accountProfile.id,
    activeSource: "personal",
    activeProfile: accountProfile,
    profiles: [accountProfile],
    failoverEnabled: false,
    deployment: { configured: false, provider: null, model: null, budget: null, capabilities: null },
  };
  const options = buildAgentModelOptions(state, null, labels, {
    codex: ["gpt-6-astra@low", "gpt-6-astra@medium", "gpt-6-astra@max", "gpt-5.6-luna@low"],
  });
  assert.deepEqual(
    options.slice(0, -1).map(({ modelLabel, effort }) => ({ modelLabel, effort })),
    [
      { modelLabel: "GPT-6 Astra", effort: "low" },
      { modelLabel: "GPT-6 Astra", effort: "medium" },
      { modelLabel: "GPT-6 Astra", effort: "max" },
      { modelLabel: "GPT-5.6 Luna", effort: "low" },
    ],
  );
  assert.equal(
    options.some((option) => option.effort === "high"),
    false,
  );
  assert.match(selectedAgentModelValue("model-assisted", state, options), /gpt-6-astra@medium/u);
});

test("connects one discovered chat choice through catalog, probe, and encrypted profile save", async () => {
  globalThis.window = {
    orbitDesktop: {
      async discoverModels() {
        throw new Error("not used");
      },
      async importDiscoveredModel(id) {
        assert.equal(id, deepseekCandidate.id);
        return {
          provider: "deepseek",
          protocol: "chat-completions",
          name: "DeepSeek",
          baseURL: "https://api.deepseek.com",
          model: "deepseek-v4-flash",
          apiKey: "private-test-key",
        };
      },
    },
  };
  const actions = [];
  const phases = [];
  const savedState = {
    vaultAvailable: true,
    configured: true,
    activeProfileId: "deepseek",
    activeSource: "personal",
    activeProfile: null,
    profiles: [],
    failoverEnabled: false,
    deployment: {
      configured: false,
      provider: null,
      model: null,
      budget: null,
      capabilities: null,
      health: { status: "unknown", checkedAt: null, retryAt: null },
    },
  };
  const result = await connectDiscoveredModelConnection({
    candidate: deepseekCandidate,
    accounts: [],
    onPhase: (phase) => phases.push(phase),
    fetcher: async (_url, init) => {
      const body = JSON.parse(init.body);
      actions.push(body.action);
      if (body.action === "models") return Response.json({ models: ["deepseek-v4-flash"] });
      if (body.action === "probe") return Response.json({ ready: true });
      if (body.action === "upsert") return Response.json(savedState);
      return Response.json({ error: "unexpected" }, { status: 400 });
    },
  });
  assert.deepEqual(result, savedState);
  assert.deepEqual(actions, ["models", "probe", "upsert"]);
  assert.deepEqual(phases, ["reading", "catalog", "response", "saving"]);
  delete globalThis.window;
});
