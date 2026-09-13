import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  createDesktopModelDiscovery,
  DESKTOP_API_PROVIDER_REGISTRY,
  DESKTOP_MODEL_DISCOVERY_LIMITS,
} from "../desktop/model-discovery.mjs";

function missingFiles(files = new Map()) {
  return {
    async stat(filePath) {
      const value = files.get(filePath);
      if (value === undefined) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return { isFile: () => true, size: Buffer.byteLength(value) };
    },
    async readFile(filePath) {
      const value = files.get(filePath);
      if (value === undefined) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return value;
    },
    async fetch() {
      throw new Error("no local runtime");
    },
  };
}

test("discovers process credentials without returning a secret before explicit import", async () => {
  const discovery = createDesktopModelDiscovery({
    homeDirectory: "/missing",
    environment: { OPENAI_API_KEY: "process-secret", OPENAI_MODEL: "gpt-5.6-sol" },
    includeApiConnections: true,
    capabilities: missingFiles(),
  });
  const result = await discovery.scan();
  assert.equal(result.supported, true);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].sourceKind, "environment");
  assert.equal(result.candidates[0].model, "gpt-5.6-sol");
  assert.doesNotMatch(JSON.stringify(result), /process-secret/u);
  assert.equal("profile" in result.candidates[0], false);

  const imported = await discovery.importCandidate(result.candidates[0].id);
  assert.equal(imported.apiKey, "process-secret");
  await assert.rejects(() => discovery.importCandidate("unknown"), /no longer available/i);
});

test("defaults to signed-in accounts without reading API configuration", async () => {
  const accountToken = "account-bridge-token";
  const discovery = createDesktopModelDiscovery({
    accountRuntime: {
      async discover() {
        return {
          accounts: [
            {
              id: "codex",
              provider: "codex-account",
              label: "ChatGPT",
              sourceLabel: "Codex · ChatGPT account",
              model: "chatgpt-codex-account",
              installed: true,
              status: "ready",
            },
            {
              id: "gemini",
              provider: "gemini-account",
              label: "Gemini",
              sourceLabel: "Gemini CLI · Google account",
              model: "gemini-2.5-flash",
              installed: false,
              status: "not-installed",
            },
          ],
          connections: [
            {
              sourceKind: "account-runtime",
              sourceLabel: "Codex · ChatGPT account",
              sourceIdentity: "account:codex",
              provider: "codex-account",
              name: "Codex · ChatGPT account",
              baseURL: "http://127.0.0.1:54321/__orbit_account__/codex/v1",
              model: "chatgpt-codex-account",
              apiKey: accountToken,
              protocol: "responses",
              locality: "device",
              credentialState: "account-session",
            },
          ],
        };
      },
    },
    homeDirectory: "/missing",
    environment: { OPENAI_API_KEY: "must-not-be-read" },
    capabilities: missingFiles(),
  });
  const result = await discovery.scan();
  assert.equal(result.accounts[0].status, "ready");
  assert.equal(result.accounts.length, 1);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].provider, "codex-account");
  assert.equal(result.candidates[0].credentialState, "account-session");
  assert.doesNotMatch(JSON.stringify(result), /account-bridge-token|must-not-be-read/u);
  assert.equal((await discovery.importCandidate(result.candidates[0].id)).apiKey, accountToken);
});

test("recognizes a direct DeepSeek environment without exposing its credential", async () => {
  const discovery = createDesktopModelDiscovery({
    homeDirectory: "/missing",
    environment: {
      DEEPSEEK_API_KEY: "deepseek-process-secret",
      DEEPSEEK_MODEL: "deepseek-v4-pro",
    },
    includeApiConnections: true,
    capabilities: missingFiles(),
  });
  const result = await discovery.scan();
  assert.deepEqual(
    result.candidates.map(({ provider, name, baseURL, model }) => ({ provider, name, baseURL, model })),
    [
      {
        provider: "deepseek",
        name: "DeepSeek",
        baseURL: "https://api.deepseek.com",
        model: "deepseek-v4-pro",
      },
    ],
  );
  assert.doesNotMatch(JSON.stringify(result), /deepseek-process-secret/u);
  assert.equal((await discovery.importCandidate(result.candidates[0].id)).apiKey, "deepseek-process-secret");
});

test("discovers major compatible providers from literal shell configuration without executing it", async () => {
  const home = "/Users/orbit";
  const files = new Map([
    [
      path.join(home, ".zshrc"),
      [
        "export XAI_API_KEY='xai-secret'",
        "export GROQ_API_KEY='groq-secret'",
        "export DASHSCOPE_API_KEY='qwen-secret'",
        "export ARK_API_KEY='doubao-secret'",
        "export HUNYUAN_API_KEY='hunyuan-secret'",
        "export OPENAI_API_KEY=$(security find-generic-password -w -s ignored)",
      ].join("\n"),
    ],
  ]);
  const discovery = createDesktopModelDiscovery({
    homeDirectory: home,
    environment: {},
    includeApiConnections: true,
    capabilities: missingFiles(files),
  });
  const result = await discovery.scan();
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.name).sort(),
    ["Alibaba Cloud · Qwen", "Groq", "Tencent Hunyuan", "Volcengine Ark · Doubao", "xAI"].sort(),
  );
  assert.equal(
    result.candidates.every((candidate) => candidate.sourceLabel === "Shell · .zshrc"),
    true,
  );
  assert.doesNotMatch(JSON.stringify(result), /secret|security find/u);
});

test("keeps the provider registry broad, explicit, and compatible with Orbit transports", () => {
  const ids = DESKTOP_API_PROVIDER_REGISTRY.map((provider) => provider.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of [
    "openai",
    "anthropic",
    "gemini",
    "deepseek",
    "openrouter",
    "xai",
    "mistral",
    "groq",
    "together",
    "dashscope",
    "volcengine-ark",
    "tencent-hunyuan",
  ]) {
    assert.equal(ids.includes(id), true, id);
  }
  assert.equal(
    DESKTOP_API_PROVIDER_REGISTRY.every((provider) => provider.apiKeyVariables.length > 0),
    true,
  );
});

test("discovers bounded Claude, Codex, and Gemini live configurations without executing them", async () => {
  const home = "/Users/orbit";
  const files = new Map([
    [
      path.join(home, ".claude", "settings.json"),
      JSON.stringify({
        env: {
          ANTHROPIC_AUTH_TOKEN: "claude-secret",
          ANTHROPIC_BASE_URL: "https://claude.example.com/v1",
          ANTHROPIC_MODEL: "claude-team",
        },
      }),
    ],
    [path.join(home, ".codex", "auth.json"), JSON.stringify({ OPENAI_API_KEY: "codex-secret" })],
    [
      path.join(home, ".codex", "config.toml"),
      'model = "gpt-team"\n[model_providers.team]\nbase_url = "https://codex.example.com/v1"\nwire_api = "responses"',
    ],
    [
      path.join(home, ".gemini", ".env"),
      "GEMINI_API_KEY='gemini-secret'\nGEMINI_MODEL=gemini-team\nIGNORED=$(touch /tmp/never-run)",
    ],
  ]);
  const discovery = createDesktopModelDiscovery({
    homeDirectory: home,
    environment: {},
    includeApiConnections: true,
    capabilities: missingFiles(files),
  });
  const result = await discovery.scan();
  assert.deepEqual(result.candidates.map((candidate) => candidate.sourceLabel).sort(), [
    "Claude Code",
    "Codex",
    "Gemini CLI",
  ]);
  assert.doesNotMatch(JSON.stringify(result), /claude-secret|codex-secret|gemini-secret/u);
  const claude = result.candidates.find((candidate) => candidate.sourceLabel === "Claude Code");
  assert.equal(claude.provider, "custom");
  assert.equal(claude.protocol, "anthropic-messages");
});

test("discovers running Ollama and LM Studio catalogs as credential-free device models", async () => {
  const capabilities = missingFiles();
  capabilities.fetch = async (url) => {
    if (url.endsWith("/api/tags")) {
      return new Response(JSON.stringify({ models: [{ name: "qwen3:8b" }, { name: "llama3.2" }] }), {
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ data: [{ id: "local/phi-4" }] }), {
      headers: { "content-type": "application/json" },
    });
  };
  const discovery = createDesktopModelDiscovery({ homeDirectory: "/missing", environment: {}, capabilities });
  const result = await discovery.scan();
  assert.deepEqual(
    result.candidates.map(({ provider, locality, credentialState }) => ({ provider, locality, credentialState })),
    [
      { provider: "ollama", locality: "device", credentialState: "not-required" },
      { provider: "lmstudio", locality: "device", credentialState: "not-required" },
    ],
  );
  const imported = await discovery.importCandidate(result.candidates[0].id);
  assert.equal(imported.apiKey, "");
  assert.equal(imported.baseURL, "http://127.0.0.1:11434/v1");
});

test("reads CC Switch through a read-only bounded provider query", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "orbit-discovery-"));
  const directory = path.join(home, ".cc-switch");
  await mkdir(directory);
  const database = new DatabaseSync(path.join(directory, "cc-switch.db"));
  database.exec(
    "CREATE TABLE providers (id TEXT, app_type TEXT, name TEXT, settings_config TEXT, is_current INTEGER, sort_index INTEGER)",
  );
  database.prepare("INSERT INTO providers VALUES (?, ?, ?, ?, ?, ?)").run(
    "team",
    "codex",
    "Team gateway",
    JSON.stringify({
      auth: { OPENAI_API_KEY: "cc-switch-secret" },
      config:
        'model = "gpt-team"\n[model_providers.team]\nbase_url = "https://models.example.com/v1"\nwire_api = "responses"',
    }),
    1,
    0,
  );
  database.close();
  try {
    const discovery = createDesktopModelDiscovery({
      homeDirectory: home,
      environment: {},
      includeApiConnections: true,
    });
    const result = await discovery.scan();
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].sourceLabel, "CC Switch · Codex");
    assert.equal(result.candidates[0].provider, "custom");
    assert.doesNotMatch(JSON.stringify(result), /cc-switch-secret/u);
    assert.equal((await discovery.importCandidate(result.candidates[0].id)).apiKey, "cc-switch-secret");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("recognizes and deduplicates one DeepSeek connection shared by CC Switch and Claude Code", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "orbit-deepseek-discovery-"));
  const ccSwitchDirectory = path.join(home, ".cc-switch");
  const claudeDirectory = path.join(home, ".claude");
  await Promise.all([mkdir(ccSwitchDirectory), mkdir(claudeDirectory)]);
  const settings = {
    env: {
      ANTHROPIC_API_KEY: "shared-deepseek-secret",
      ANTHROPIC_BASE_URL: "https://api.deepseek.com/anthropic",
      ANTHROPIC_MODEL: "deepseek-v4-flash",
    },
  };
  await writeFile(path.join(claudeDirectory, "settings.json"), JSON.stringify(settings));
  const database = new DatabaseSync(path.join(ccSwitchDirectory, "cc-switch.db"));
  database.exec(
    "CREATE TABLE providers (id TEXT, app_type TEXT, name TEXT, settings_config TEXT, is_current INTEGER, sort_index INTEGER)",
  );
  database
    .prepare("INSERT INTO providers VALUES (?, ?, ?, ?, ?, ?)")
    .run("deepseek", "claude", "DeepSeek", JSON.stringify(settings), 1, 0);
  database.close();
  try {
    const discovery = createDesktopModelDiscovery({
      homeDirectory: home,
      environment: {},
      includeApiConnections: true,
      capabilities: {
        async fetch() {
          throw new Error("no local runtime");
        },
      },
    });
    const result = await discovery.scan();
    assert.equal(result.candidates.length, 1);
    assert.deepEqual(
      {
        provider: result.candidates[0].provider,
        protocol: result.candidates[0].protocol,
        sourceLabel: result.candidates[0].sourceLabel,
        baseURL: result.candidates[0].baseURL,
      },
      {
        provider: "deepseek",
        protocol: "anthropic-messages",
        sourceLabel: "CC Switch · DeepSeek",
        baseURL: "https://api.deepseek.com/anthropic",
      },
    );
    assert.doesNotMatch(JSON.stringify(result), /shared-deepseek-secret/u);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("publishes fixed discovery bounds", () => {
  assert.deepEqual(DESKTOP_MODEL_DISCOVERY_LIMITS, {
    maximumCandidates: 32,
    maximumFileBytes: 256 * 1024,
    localProbeTimeoutMs: 650,
  });
});
