import {
  DEFAULT_MODEL_TOKEN_BUDGET,
  MODEL_PROVIDER_PRESETS,
  normalizeCustomModelBaseURL,
  normalizeModelTokenBudget,
  type ModelProtocol,
  type ModelProviderKind,
  type ModelTokenBudget,
} from "./model-profiles.ts";

export const MAX_MODEL_PROFILE_IMPORT_BYTES = 20_000;

export type ModelProfileImportErrorCode =
  | "empty"
  | "too-large"
  | "invalid-json"
  | "unsupported-link"
  | "remote-config"
  | "batch"
  | "ambiguous"
  | "invalid-fields"
  | "invalid-endpoint";

export class ModelProfileImportError extends Error {
  readonly code: ModelProfileImportErrorCode;

  constructor(code: ModelProfileImportErrorCode, message: string) {
    super(message);
    this.name = "ModelProfileImportError";
    this.code = code;
  }
}

export type ImportedModelProfileDraft = {
  provider: ModelProviderKind;
  protocol: ModelProtocol;
  name: string;
  baseURL: string;
  model: string;
  budget: ModelTokenBudget;
  apiKey: string;
};

export type ModelProfileImportWarning =
  | { code: "credential-missing" }
  | { code: "unsupported-fields"; count: number };

export type ModelProfileImportResult = {
  source: "rune-json" | "cc-switch-deeplink";
  draft: ImportedModelProfileDraft;
  warnings: ModelProfileImportWarning[];
};

export type ModelProfileImportReview = Omit<ImportedModelProfileDraft, "apiKey"> & {
  source: ModelProfileImportResult["source"];
  credentialDetected: boolean;
  warnings: ModelProfileImportWarning[];
};

const FIELD_ALIASES = {
  provider: ["provider", "provider_kind", "providerkind"],
  protocol: ["protocol", "api_protocol", "apiprotocol"],
  name: ["name", "profile_name", "profilename", "label"],
  endpoint: ["baseurl", "base_url", "endpoint", "api_base_url", "apibaseurl"],
  model: ["model", "model_id", "modelid", "default_model", "defaultmodel"],
  apiKey: ["apikey", "api_key", "key", "token", "auth_token", "authtoken"],
  app: ["app", "client", "application"],
  budget: ["budget", "token_budget", "tokenbudget"],
  inputBudget: ["maxinputtokens", "max_input_tokens", "input_budget", "inputbudget"],
  outputBudget: ["maxoutputtokens", "max_output_tokens", "output_budget", "outputbudget"],
} as const;

const ENV_API_KEYS = [
  "openai_api_key",
  "anthropic_api_key",
  "anthropic_auth_token",
  "gemini_api_key",
  "google_api_key",
] as const;
const ENV_ENDPOINTS = [
  "openai_base_url",
  "anthropic_base_url",
  "gemini_base_url",
  "google_gemini_base_url",
] as const;
const ENV_MODELS = ["openai_model", "anthropic_model", "gemini_model"] as const;
const REMOTE_CONFIG_FIELDS = new Set(["configurl", "config_url", "remoteconfig", "remote_config"]);
const KNOWN_FIELDS = new Set(
  [...Object.values(FIELD_ALIASES).flat(), "env", "config", "resource", ...ENV_API_KEYS, ...ENV_ENDPOINTS, ...ENV_MODELS].map(
    (field) => field.toLowerCase(),
  ),
);

function fail(code: ModelProfileImportErrorCode, message: string): never {
  throw new ModelProfileImportError(code, message);
}

function objectRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function caseInsensitiveRecord(value: Record<string, unknown>) {
  const record = new Map<string, unknown>();
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (record.has(normalized)) fail("ambiguous", "The import repeats a configuration field.");
    record.set(normalized, item);
  }
  return record;
}

function aliasedValue(record: Map<string, unknown>, aliases: readonly string[]) {
  let found = false;
  let result: unknown;
  for (const alias of aliases) {
    const value = record.get(alias.toLowerCase());
    if (value === undefined) continue;
    if (found) fail("ambiguous", "The import supplies more than one value for the same setting.");
    found = true;
    result = value;
  }
  return result;
}

function cleanText(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text || text.length > maximum || /[\u0000-\u001f\u007f]/u.test(text)) return "";
  return text;
}

function importedProtocol(value: unknown): ModelProtocol | null {
  const normalized = cleanText(value, 80).toLowerCase();
  if (normalized === "responses" || normalized === "openai-responses") return "responses";
  if (
    normalized === "chat-completions" ||
    normalized === "chat_completions" ||
    normalized === "openai-compatible"
  )
    return "chat-completions";
  if (normalized === "anthropic-messages" || normalized === "anthropic_messages" || normalized === "messages")
    return "anthropic-messages";
  if (
    normalized === "gemini-generate-content" ||
    normalized === "gemini_generate_content" ||
    normalized === "generatecontent"
  )
    return "gemini-generate-content";
  return null;
}

function importedProvider(value: unknown): ModelProviderKind | null {
  const normalized = cleanText(value, 80).toLowerCase();
  if (normalized === "openai" || normalized === "codex") return "openai";
  if (normalized === "openrouter") return "openrouter";
  if (normalized === "anthropic" || normalized === "claude") return "anthropic";
  if (normalized === "gemini" || normalized === "google" || normalized === "google-gemini") return "gemini";
  if (normalized === "custom" || normalized === "compatible") return "custom";
  return null;
}

function providerFromApp(value: unknown): ModelProviderKind | null {
  const app = cleanText(value, 80).toLowerCase();
  if (app === "codex" || app === "openai") return "openai";
  if (app === "claude" || app === "claude-code" || app === "claude-desktop") return "anthropic";
  if (app === "gemini" || app === "gemini-cli") return "gemini";
  return null;
}

function normalizedEndpoint(value: string) {
  return value.replace(/\/+$/u, "");
}

function officialProviderForEndpoint(endpoint: string) {
  const normalized = normalizedEndpoint(endpoint);
  return MODEL_PROVIDER_PRESETS.find(
    (preset) => preset.id !== "custom" && normalizedEndpoint(preset.baseURL) === normalized,
  )?.id;
}

function inferProviderFromEnvironment(environment: Map<string, unknown>) {
  const providers = new Set<ModelProviderKind>();
  if (
    environment.has("anthropic_api_key") ||
    environment.has("anthropic_auth_token") ||
    environment.has("anthropic_base_url") ||
    environment.has("anthropic_model")
  )
    providers.add("anthropic");
  if (
    environment.has("gemini_api_key") ||
    environment.has("google_api_key") ||
    environment.has("gemini_base_url") ||
    environment.has("google_gemini_base_url") ||
    environment.has("gemini_model")
  )
    providers.add("gemini");
  if (environment.has("openai_api_key") || environment.has("openai_base_url") || environment.has("openai_model"))
    providers.add("openai");
  if (providers.size > 1) fail("ambiguous", "Import environment variables for one provider at a time.");
  return providers.values().next().value ?? null;
}

function parseCcSwitchLink(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    fail("unsupported-link", "Use a Rune JSON object or a ccswitch://v1/import provider link.");
  }
  if (url.protocol !== "ccswitch:" || url.hostname !== "v1" || url.pathname !== "/import") {
    fail("unsupported-link", "Only ccswitch://v1/import provider links are supported.");
  }
  const record: Record<string, unknown> = {};
  for (const [key, value] of url.searchParams) {
    const normalized = key.toLowerCase();
    if (record[normalized] !== undefined) fail("ambiguous", "The import link repeats a configuration field.");
    record[normalized] = value;
  }
  if (cleanText(record.resource, 80).toLowerCase() !== "provider") {
    fail("unsupported-link", "The CC Switch link must import one provider.");
  }
  if ([...REMOTE_CONFIG_FIELDS].some((field) => record[field] !== undefined)) {
    fail("remote-config", "Remote configuration URLs are not imported.");
  }
  if (typeof record.endpoint === "string" && record.endpoint.includes(",")) {
    fail("ambiguous", "Import one provider endpoint at a time.");
  }
  const config = cleanText(record.config, MAX_MODEL_PROFILE_IMPORT_BYTES);
  if (config.startsWith("{")) {
    try {
      const parsed = objectRecord(JSON.parse(config));
      if (parsed) Object.assign(record, parsed, { ...record });
    } catch {
      fail("invalid-json", "The embedded CC Switch configuration is not valid JSON.");
    }
  }
  return { record, source: "cc-switch-deeplink" as const };
}

function parseJsonImport(input: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    fail("invalid-json", "The model profile import is not valid JSON.");
  }
  if (Array.isArray(parsed)) fail("batch", "Import one model profile at a time.");
  const record = objectRecord(parsed);
  if (!record) fail("invalid-fields", "The import must be one JSON object.");
  if (Array.isArray(record.profiles) || Array.isArray(record.providers)) {
    fail("batch", "Import one model profile at a time.");
  }
  return { record, source: "rune-json" as const };
}

export function parseModelProfileImport(raw: string): ModelProfileImportResult {
  const input = raw.trim();
  if (!input) fail("empty", "Paste or choose one model profile first.");
  if (new TextEncoder().encode(input).byteLength > MAX_MODEL_PROFILE_IMPORT_BYTES) {
    fail("too-large", "The model profile import is too large.");
  }
  const parsed = input.toLowerCase().startsWith("ccswitch://") ? parseCcSwitchLink(input) : parseJsonImport(input);
  const record = caseInsensitiveRecord(parsed.record);
  if ([...REMOTE_CONFIG_FIELDS].some((field) => record.has(field))) {
    fail("remote-config", "Remote configuration URLs are not imported.");
  }
  const environmentRecord = objectRecord(record.get("env"));
  const environment = caseInsensitiveRecord(environmentRecord ?? {});
  const explicitProviderValue = aliasedValue(record, FIELD_ALIASES.provider);
  const explicitProvider = importedProvider(explicitProviderValue);
  if (explicitProviderValue !== undefined && !explicitProvider) {
    fail("invalid-fields", "The imported provider is not supported.");
  }
  const appProvider = providerFromApp(aliasedValue(record, FIELD_ALIASES.app));
  const environmentProvider = inferProviderFromEnvironment(environment);
  const endpoint = cleanText(
    aliasedValue(record, FIELD_ALIASES.endpoint) ?? aliasedValue(environment, ENV_ENDPOINTS),
    300,
  );
  if (endpoint.includes(",")) fail("ambiguous", "Import one provider endpoint at a time.");
  const officialProvider = endpoint ? officialProviderForEndpoint(endpoint) : undefined;
  const providerSignals = new Set(
    [explicitProvider, appProvider, environmentProvider, officialProvider].filter(
      (provider): provider is Exclude<ModelProviderKind, "custom"> => Boolean(provider && provider !== "custom"),
    ),
  );
  if (providerSignals.size > 1) fail("ambiguous", "The import identifies conflicting providers.");
  const requestedProvider = explicitProvider ?? appProvider ?? environmentProvider ?? officialProvider ?? null;
  if (!requestedProvider) fail("invalid-fields", "The import does not identify a supported provider.");
  const provider: ModelProviderKind = endpoint && !officialProvider ? "custom" : (officialProvider ?? requestedProvider);
  const protocolValue = aliasedValue(record, FIELD_ALIASES.protocol);
  const protocolSource = importedProtocol(protocolValue);
  if (protocolValue !== undefined && !protocolSource) {
    fail("invalid-fields", "The imported API protocol is not supported.");
  }
  const protocolProvider =
    requestedProvider === "custom" ? (appProvider ?? environmentProvider ?? officialProvider ?? "openai") : requestedProvider;
  const protocol =
    protocolSource ?? MODEL_PROVIDER_PRESETS.find((preset) => preset.id === protocolProvider)?.protocol ?? "responses";
  const preset = MODEL_PROVIDER_PRESETS.find((item) => item.id === provider)!;
  let baseURL = preset.baseURL;
  if (provider === "custom") {
    if (!endpoint) fail("invalid-endpoint", "A custom provider import needs one HTTPS API base URL.");
    try {
      baseURL = normalizeCustomModelBaseURL(endpoint);
    } catch {
      fail("invalid-endpoint", "The imported endpoint must be a public HTTPS API base URL.");
    }
  }
  const fallbackPreset = MODEL_PROVIDER_PRESETS.find((item) => item.id === protocolProvider) ?? preset;
  const requestedModel =
    aliasedValue(record, FIELD_ALIASES.model) ?? aliasedValue(environment, ENV_MODELS) ?? fallbackPreset.defaultModel;
  const model = cleanText(requestedModel, 120);
  if (!model || !/^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,119}$/u.test(model)) {
    fail("invalid-fields", "The imported model ID is invalid.");
  }
  const budgetRecord = objectRecord(aliasedValue(record, FIELD_ALIASES.budget));
  const budget = normalizeModelTokenBudget(
    {
      maxInputTokens:
        aliasedValue(caseInsensitiveRecord(budgetRecord ?? {}), FIELD_ALIASES.inputBudget) ??
        aliasedValue(record, FIELD_ALIASES.inputBudget),
      maxOutputTokens:
        aliasedValue(caseInsensitiveRecord(budgetRecord ?? {}), FIELD_ALIASES.outputBudget) ??
        aliasedValue(record, FIELD_ALIASES.outputBudget),
    },
    DEFAULT_MODEL_TOKEN_BUDGET,
  );
  const apiKey = cleanText(aliasedValue(record, FIELD_ALIASES.apiKey) ?? aliasedValue(environment, ENV_API_KEYS), 512);
  const name = cleanText(aliasedValue(record, FIELD_ALIASES.name), 60) || fallbackPreset.label;
  const ignoredFieldCount = Object.keys(parsed.record).filter(
    (field) =>
      !KNOWN_FIELDS.has(field.toLowerCase()) && field.toLowerCase() !== "profiles" && field.toLowerCase() !== "providers",
  ).length;
  const warnings: ModelProfileImportWarning[] = [];
  if (!apiKey) warnings.push({ code: "credential-missing" });
  if (ignoredFieldCount) warnings.push({ code: "unsupported-fields", count: ignoredFieldCount });
  return {
    source: parsed.source,
    draft: { provider, protocol, name, baseURL, model, budget, apiKey },
    warnings,
  };
}

export function modelProfileImportReview(result: ModelProfileImportResult): ModelProfileImportReview {
  const { apiKey, ...draft } = result.draft;
  return {
    source: result.source,
    ...draft,
    credentialDetected: Boolean(apiKey),
    warnings: result.warnings,
  };
}
