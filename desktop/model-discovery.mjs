import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const MAX_DISCOVERY_FILE_BYTES = 256 * 1024;
const MAX_DISCOVERED_CONNECTIONS = 32;
const LOCAL_PROBE_TIMEOUT_MS = 650;

const PROVIDERS = Object.freeze({
  openai: {
    label: "OpenAI",
    protocol: "responses",
    baseURL: "https://api.openai.com/v1",
    model: "gpt-5.6",
  },
  openrouter: {
    label: "OpenRouter",
    protocol: "chat-completions",
    baseURL: "https://openrouter.ai/api/v1",
    model: "openai/gpt-5.6",
  },
  deepseek: {
    label: "DeepSeek",
    protocol: "chat-completions",
    baseURL: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
  },
  anthropic: {
    label: "Anthropic",
    protocol: "anthropic-messages",
    baseURL: "https://api.anthropic.com/v1",
    model: "claude-sonnet-5",
  },
  gemini: {
    label: "Google Gemini",
    protocol: "gemini-generate-content",
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-pro",
  },
  "codex-account": {
    label: "ChatGPT",
    protocol: "responses",
    baseURL: "http://127.0.0.1",
    model: "chatgpt-codex-account",
  },
  "claude-account": {
    label: "Claude",
    protocol: "responses",
    baseURL: "http://127.0.0.1",
    model: "claude-account",
  },
  "gemini-account": {
    label: "Gemini",
    protocol: "responses",
    baseURL: "http://127.0.0.1",
    model: "gemini-account",
  },
});

export const DESKTOP_API_PROVIDER_REGISTRY = Object.freeze([
  {
    id: "openai",
    label: "OpenAI",
    provider: "openai",
    protocol: "responses",
    baseURL: "https://api.openai.com/v1",
    model: "gpt-5.6",
    apiKeyVariables: ["OPENAI_API_KEY"],
    baseURLVariables: ["OPENAI_BASE_URL"],
    modelVariables: ["OPENAI_MODEL"],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    provider: "anthropic",
    protocol: "anthropic-messages",
    baseURL: "https://api.anthropic.com/v1",
    model: "claude-sonnet-5",
    apiKeyVariables: ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"],
    baseURLVariables: ["ANTHROPIC_BASE_URL"],
    modelVariables: ["ANTHROPIC_MODEL"],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    provider: "gemini",
    protocol: "gemini-generate-content",
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-pro",
    apiKeyVariables: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    baseURLVariables: ["GEMINI_BASE_URL", "GOOGLE_GEMINI_BASE_URL"],
    modelVariables: ["GEMINI_MODEL"],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    provider: "deepseek",
    protocol: "chat-completions",
    baseURL: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    apiKeyVariables: ["DEEPSEEK_API_KEY", "DEEPSEEK_AUTH_TOKEN"],
    baseURLVariables: ["DEEPSEEK_BASE_URL"],
    modelVariables: ["DEEPSEEK_MODEL"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    provider: "openrouter",
    protocol: "chat-completions",
    baseURL: "https://openrouter.ai/api/v1",
    model: "openai/gpt-5.6",
    apiKeyVariables: ["OPENROUTER_API_KEY"],
    baseURLVariables: ["OPENROUTER_BASE_URL"],
    modelVariables: ["OPENROUTER_MODEL"],
  },
  {
    id: "xai",
    label: "xAI",
    provider: "custom",
    protocol: "chat-completions",
    baseURL: "https://api.x.ai/v1",
    model: "grok-4.6",
    apiKeyVariables: ["XAI_API_KEY"],
    baseURLVariables: ["XAI_BASE_URL"],
    modelVariables: ["XAI_MODEL"],
  },
  {
    id: "mistral",
    label: "Mistral AI",
    provider: "custom",
    protocol: "chat-completions",
    baseURL: "https://api.mistral.ai/v1",
    model: "mistral-large-latest",
    apiKeyVariables: ["MISTRAL_API_KEY"],
    baseURLVariables: ["MISTRAL_BASE_URL"],
    modelVariables: ["MISTRAL_MODEL"],
  },
  {
    id: "groq",
    label: "Groq",
    provider: "custom",
    protocol: "chat-completions",
    baseURL: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-20b",
    apiKeyVariables: ["GROQ_API_KEY"],
    baseURLVariables: ["GROQ_BASE_URL"],
    modelVariables: ["GROQ_MODEL"],
  },
  {
    id: "together",
    label: "Together AI",
    provider: "custom",
    protocol: "chat-completions",
    baseURL: "https://api.together.xyz/v1",
    model: "openai/gpt-oss-20b",
    apiKeyVariables: ["TOGETHER_API_KEY"],
    baseURLVariables: ["TOGETHER_BASE_URL"],
    modelVariables: ["TOGETHER_MODEL"],
  },
  {
    id: "perplexity",
    label: "Perplexity",
    provider: "custom",
    protocol: "chat-completions",
    baseURL: "https://api.perplexity.ai",
    model: "sonar-pro",
    apiKeyVariables: ["PERPLEXITY_API_KEY", "PPLX_API_KEY"],
    baseURLVariables: ["PERPLEXITY_BASE_URL"],
    modelVariables: ["PERPLEXITY_MODEL", "PPLX_MODEL"],
  },
  {
    id: "moonshot",
    label: "Moonshot · Kimi",
    provider: "custom",
    protocol: "chat-completions",
    baseURL: "https://api.moonshot.cn/v1",
    model: "kimi-k2.5",
    apiKeyVariables: ["MOONSHOT_API_KEY", "KIMI_API_KEY"],
    baseURLVariables: ["MOONSHOT_BASE_URL", "KIMI_BASE_URL"],
    modelVariables: ["MOONSHOT_MODEL", "KIMI_MODEL"],
  },
  {
    id: "dashscope",
    label: "Alibaba Cloud · Qwen",
    provider: "custom",
    protocol: "chat-completions",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    apiKeyVariables: ["DASHSCOPE_API_KEY", "QWEN_API_KEY"],
    baseURLVariables: ["DASHSCOPE_BASE_URL", "QWEN_BASE_URL"],
    modelVariables: ["DASHSCOPE_MODEL", "QWEN_MODEL"],
  },
  {
    id: "volcengine-ark",
    label: "Volcengine Ark · Doubao",
    provider: "custom",
    protocol: "responses",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-seed-2-0-lite-260215",
    apiKeyVariables: ["ARK_API_KEY", "VOLCENGINE_ARK_API_KEY"],
    baseURLVariables: ["ARK_BASE_URL", "VOLCENGINE_ARK_BASE_URL"],
    modelVariables: ["ARK_MODEL", "DOUBAO_MODEL"],
  },
  {
    id: "tencent-hunyuan",
    label: "Tencent Hunyuan",
    provider: "custom",
    protocol: "chat-completions",
    baseURL: "https://tokenhub.tencentmaas.com/v1",
    model: "hy3-preview",
    apiKeyVariables: ["HUNYUAN_API_KEY", "TENCENTMAAS_API_KEY", "TOKENHUB_API_KEY"],
    baseURLVariables: ["HUNYUAN_BASE_URL", "TENCENTMAAS_BASE_URL", "TOKENHUB_BASE_URL"],
    modelVariables: ["HUNYUAN_MODEL", "TENCENTMAAS_MODEL", "TOKENHUB_MODEL"],
  },
  {
    id: "zhipu",
    label: "Zhipu AI · GLM",
    provider: "custom",
    protocol: "chat-completions",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4.5",
    apiKeyVariables: ["ZHIPUAI_API_KEY", "BIGMODEL_API_KEY"],
    baseURLVariables: ["ZHIPUAI_BASE_URL", "BIGMODEL_BASE_URL"],
    modelVariables: ["ZHIPUAI_MODEL", "BIGMODEL_MODEL"],
  },
  {
    id: "minimax",
    label: "MiniMax",
    provider: "custom",
    protocol: "chat-completions",
    baseURL: "https://api.minimax.io/v1",
    model: "MiniMax-M2.1",
    apiKeyVariables: ["MINIMAX_API_KEY"],
    baseURLVariables: ["MINIMAX_BASE_URL"],
    modelVariables: ["MINIMAX_MODEL"],
  },
  {
    id: "siliconflow",
    label: "SiliconFlow",
    provider: "custom",
    protocol: "chat-completions",
    baseURL: "https://api.siliconflow.cn/v1",
    model: "deepseek-ai/DeepSeek-V3.2",
    apiKeyVariables: ["SILICONFLOW_API_KEY"],
    baseURLVariables: ["SILICONFLOW_BASE_URL"],
    modelVariables: ["SILICONFLOW_MODEL"],
  },
  {
    id: "fireworks",
    label: "Fireworks AI",
    provider: "custom",
    protocol: "chat-completions",
    baseURL: "https://api.fireworks.ai/inference/v1",
    model: "accounts/fireworks/models/gpt-oss-120b",
    apiKeyVariables: ["FIREWORKS_API_KEY"],
    baseURLVariables: ["FIREWORKS_BASE_URL"],
    modelVariables: ["FIREWORKS_MODEL"],
  },
  {
    id: "cerebras",
    label: "Cerebras",
    provider: "custom",
    protocol: "chat-completions",
    baseURL: "https://api.cerebras.ai/v1",
    model: "gpt-oss-120b",
    apiKeyVariables: ["CEREBRAS_API_KEY"],
    baseURLVariables: ["CEREBRAS_BASE_URL"],
    modelVariables: ["CEREBRAS_MODEL"],
  },
]);

const SHELL_ENVIRONMENT_FILES = Object.freeze([
  ".zshenv",
  ".zprofile",
  ".zshrc",
  ".bash_profile",
  ".bashrc",
  ".profile",
  ".env",
]);

function cleanText(value, maximum = 300) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  return text && text.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(text) ? text : "";
}

function cleanModel(value, fallback) {
  const model = cleanText(value, 120);
  return /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,119}$/u.test(model) ? model : fallback;
}

function providerForEndpoint(endpoint) {
  const normalized = endpoint.replace(/\/+$/u, "");
  const exact = Object.entries(PROVIDERS).find(([, item]) => item.baseURL === normalized)?.[0];
  if (exact) return exact;
  try {
    if (new URL(normalized).hostname.toLowerCase() === "api.deepseek.com") return "deepseek";
  } catch {
    // Endpoint validation remains owned by the model-profile normalizer.
  }
  return null;
}

function candidateId(sourceKind, sourceIdentity) {
  return createHash("sha256").update(`${sourceKind}\0${sourceIdentity}`).digest("hex").slice(0, 24);
}

function publicCandidate(candidate) {
  const publicValue = { ...candidate };
  delete publicValue.profile;
  return Object.freeze(publicValue);
}

function profileCandidate({
  sourceKind,
  sourceLabel,
  sourceIdentity,
  provider,
  name,
  baseURL,
  model,
  apiKey,
  protocol,
  locality = "cloud",
  models = [],
  credentialState,
}) {
  const preset = PROVIDERS[provider] ?? PROVIDERS.openai;
  const endpoint = cleanText(baseURL, 300) || preset.baseURL;
  const key = cleanText(apiKey, 512);
  const local = locality === "device";
  if (!local && !key) return null;
  const resolvedProtocol = protocol || preset.protocol;
  const official = providerForEndpoint(endpoint);
  const resolvedProvider = local ? provider : official || (endpoint === preset.baseURL ? provider : "custom");
  const resolvedModel = cleanModel(model, cleanModel(models[0], preset.model));
  if (!resolvedModel) return null;
  const profile = {
    provider: resolvedProvider,
    protocol: resolvedProtocol,
    name: cleanText(name, 60) || preset.label,
    baseURL: endpoint,
    model: resolvedModel,
    apiKey: key,
  };
  return {
    id: candidateId(sourceKind, sourceIdentity),
    sourceKind,
    sourceLabel,
    locality,
    provider: resolvedProvider,
    protocol: resolvedProtocol,
    name: profile.name,
    baseURL: profile.baseURL,
    model: profile.model,
    models: models
      .map((item) => cleanModel(item, ""))
      .filter(Boolean)
      .slice(0, 80),
    credentialState: credentialState || (local ? "not-required" : "detected"),
    profile,
  };
}

async function boundedText(filePath, capabilities) {
  try {
    const metadata = await capabilities.stat(filePath);
    if (!metadata.isFile() || metadata.size <= 0 || metadata.size > MAX_DISCOVERY_FILE_BYTES) return "";
    return await capabilities.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function boundedJson(filePath, capabilities) {
  const text = await boundedText(filePath, capabilities);
  if (!text) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function parseEnvironmentText(text) {
  const result = {};
  for (const line of text.split(/\r?\n/gu).slice(0, 500)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/u);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (/`|\$\(|\$\{/u.test(value)) continue;
    result[match[1]] = value;
  }
  return result;
}

function tomlString(text, key) {
  const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*["']([^"'\\r\\n]+)["']`, "mu"));
  return cleanText(match?.[1], 300);
}

function candidatesFromEnvironment(environment, sourceKind, sourceLabel, sourceIdentity) {
  const values = environment && typeof environment === "object" ? environment : {};
  const firstValue = (keys) => keys.map((key) => cleanText(values[key], 512)).find(Boolean) ?? "";
  return DESKTOP_API_PROVIDER_REGISTRY.map((provider) =>
    profileCandidate({
      sourceKind,
      sourceLabel,
      sourceIdentity: `${sourceIdentity}:${provider.id}`,
      provider: provider.provider,
      name: provider.label,
      baseURL: firstValue(provider.baseURLVariables) || provider.baseURL,
      model: firstValue(provider.modelVariables) || provider.model,
      apiKey: firstValue(provider.apiKeyVariables),
      protocol: provider.protocol,
    }),
  ).filter(Boolean);
}

function ccSwitchCandidate(row) {
  let settings;
  try {
    settings = JSON.parse(row.settings_config);
  } catch {
    return null;
  }
  const source = `cc-switch:${row.app_type}:${row.id}`;
  if (row.app_type === "codex") {
    const config =
      typeof settings?.config === "string" &&
      settings.config.length <= MAX_DISCOVERY_FILE_BYTES &&
      !/[\u0000\u007f]/u.test(settings.config)
        ? settings.config
        : "";
    const auth = settings?.auth && typeof settings.auth === "object" ? settings.auth : {};
    const endpoint = tomlString(config, "base_url");
    const wireApi = tomlString(config, "wire_api");
    return profileCandidate({
      sourceKind: "cc-switch",
      sourceLabel: "CC Switch · Codex",
      sourceIdentity: source,
      provider: "openai",
      name: row.name,
      baseURL: endpoint,
      model: tomlString(config, "model"),
      apiKey: auth.OPENAI_API_KEY,
      protocol: wireApi === "chat" ? "chat-completions" : "responses",
    });
  }
  const environment = settings?.env && typeof settings.env === "object" ? settings.env : {};
  const provider = row.app_type === "claude" ? "anthropic" : row.app_type === "gemini" ? "gemini" : null;
  if (!provider) return null;
  const endpoint = provider === "anthropic" ? environment.ANTHROPIC_BASE_URL : environment.GEMINI_BASE_URL;
  const sourceProvider =
    providerForEndpoint(cleanText(endpoint, 300)) === "deepseek"
      ? "DeepSeek"
      : row.app_type === "claude"
        ? "Claude"
        : "Gemini";
  return profileCandidate({
    sourceKind: "cc-switch",
    sourceLabel: `CC Switch · ${sourceProvider}`,
    sourceIdentity: source,
    provider,
    name: row.name,
    baseURL: endpoint,
    model: provider === "anthropic" ? environment.ANTHROPIC_MODEL : environment.GEMINI_MODEL,
    apiKey:
      provider === "anthropic"
        ? environment.ANTHROPIC_API_KEY || environment.ANTHROPIC_AUTH_TOKEN
        : environment.GEMINI_API_KEY || environment.GOOGLE_API_KEY,
  });
}

async function ccSwitchCandidates(databasePath) {
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      database.exec("PRAGMA query_only = ON");
      const rows = database
        .prepare(
          "SELECT id, app_type, name, settings_config FROM providers WHERE app_type IN ('claude','codex','gemini') ORDER BY is_current DESC, COALESCE(sort_index, 999999), id LIMIT 32",
        )
        .all();
      return rows.map(ccSwitchCandidate).filter(Boolean);
    } finally {
      database.close();
    }
  } catch {
    return [];
  }
}

async function probeJson(url, capabilities) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOCAL_PROBE_TIMEOUT_MS);
  try {
    const response = await capabilities.fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const length = Number(response.headers.get("content-length") ?? "0");
    if (length > MAX_DISCOVERY_FILE_BYTES) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function localRuntimeCandidates(capabilities) {
  const [ollama, lmStudio] = await Promise.all([
    probeJson("http://127.0.0.1:11434/api/tags", capabilities),
    probeJson("http://127.0.0.1:1234/v1/models", capabilities),
  ]);
  const ollamaModels = Array.isArray(ollama?.models)
    ? ollama.models.map((item) => cleanModel(item?.name || item?.model, "")).filter(Boolean)
    : [];
  const lmStudioModels = Array.isArray(lmStudio?.data)
    ? lmStudio.data.map((item) => cleanModel(item?.id, "")).filter(Boolean)
    : [];
  return [
    ollamaModels.length
      ? profileCandidate({
          sourceKind: "local-runtime",
          sourceLabel: "Ollama",
          sourceIdentity: "ollama:127.0.0.1:11434",
          provider: "ollama",
          name: "Ollama",
          baseURL: "http://127.0.0.1:11434/v1",
          model: ollamaModels[0],
          models: ollamaModels,
          protocol: "chat-completions",
          locality: "device",
        })
      : null,
    lmStudioModels.length
      ? profileCandidate({
          sourceKind: "local-runtime",
          sourceLabel: "LM Studio",
          sourceIdentity: "lm-studio:127.0.0.1:1234",
          provider: "lmstudio",
          name: "LM Studio",
          baseURL: "http://127.0.0.1:1234/v1",
          model: lmStudioModels[0],
          models: lmStudioModels,
          protocol: "chat-completions",
          locality: "device",
        })
      : null,
  ].filter(Boolean);
}

export function createDesktopModelDiscovery({
  accountRuntime,
  homeDirectory,
  environment = process.env,
  includeApiConnections = false,
  capabilities: overrides = {},
} = {}) {
  const home = homeDirectory || process.env.USERPROFILE || process.env.HOME || "";
  const capabilities = { readFile, stat, fetch, ...overrides };
  const privateCandidates = new Map();

  async function scan() {
    privateCandidates.clear();
    const accountDiscovery = accountRuntime ? await accountRuntime.discover() : { accounts: [], connections: [] };
    const discovered = accountDiscovery.connections.map((connection) => profileCandidate(connection));
    if (includeApiConnections) {
      discovered.push(...candidatesFromEnvironment(environment, "environment", "Environment", "process"));
    }
    if (home && includeApiConnections) {
      const shellEnvironments = await Promise.all(
        SHELL_ENVIRONMENT_FILES.map(async (fileName) => ({
          fileName,
          values: parseEnvironmentText(await boundedText(path.join(home, fileName), capabilities)),
        })),
      );
      for (const { fileName, values } of shellEnvironments) {
        discovered.push(...candidatesFromEnvironment(values, "app-config", `Shell · ${fileName}`, `shell:${fileName}`));
      }
      discovered.push(...(await ccSwitchCandidates(path.join(home, ".cc-switch", "cc-switch.db"))));

      const claudeSettings = await boundedJson(path.join(home, ".claude", "settings.json"), capabilities);
      discovered.push(
        ...candidatesFromEnvironment(claudeSettings?.env, "app-config", "Claude Code", "claude-settings"),
      );

      const codexAuth = await boundedJson(path.join(home, ".codex", "auth.json"), capabilities);
      const codexConfig = await boundedText(path.join(home, ".codex", "config.toml"), capabilities);
      const codexKey =
        cleanText(codexAuth?.OPENAI_API_KEY, 512) || tomlString(codexConfig, "experimental_bearer_token");
      if (codexKey) {
        discovered.push(
          profileCandidate({
            sourceKind: "app-config",
            sourceLabel: "Codex",
            sourceIdentity: "codex-live",
            provider: "openai",
            name: "Codex",
            baseURL: tomlString(codexConfig, "base_url"),
            model: tomlString(codexConfig, "model"),
            apiKey: codexKey,
            protocol: tomlString(codexConfig, "wire_api") === "chat" ? "chat-completions" : "responses",
          }),
        );
      }

      const geminiEnvironment = parseEnvironmentText(
        await boundedText(path.join(home, ".gemini", ".env"), capabilities),
      );
      discovered.push(...candidatesFromEnvironment(geminiEnvironment, "app-config", "Gemini CLI", "gemini-env"));
    }
    discovered.push(...(await localRuntimeCandidates(capabilities)));

    const unique = discovered
      .filter(Boolean)
      .filter(
        (candidate, index, all) =>
          all.findIndex(
            (item) =>
              item.provider === candidate.provider &&
              item.protocol === candidate.protocol &&
              item.baseURL === candidate.baseURL &&
              item.model === candidate.model &&
              item.profile.apiKey === candidate.profile.apiKey,
          ) === index,
      )
      .slice(0, MAX_DISCOVERED_CONNECTIONS);
    for (const candidate of unique) privateCandidates.set(candidate.id, candidate);
    return {
      supported: true,
      accounts: accountDiscovery.accounts.filter((account) => account.installed && account.status !== "not-installed"),
      candidates: unique.map(publicCandidate),
    };
  }

  async function importCandidate(id) {
    const candidate = privateCandidates.get(cleanText(id, 80));
    if (!candidate) throw new Error("That discovered model connection is no longer available. Scan again.");
    return { ...candidate.profile };
  }

  return Object.freeze({ scan, importCandidate });
}

export const DESKTOP_MODEL_DISCOVERY_LIMITS = Object.freeze({
  maximumCandidates: MAX_DISCOVERED_CONNECTIONS,
  maximumFileBytes: MAX_DISCOVERY_FILE_BYTES,
  localProbeTimeoutMs: LOCAL_PROBE_TIMEOUT_MS,
});
