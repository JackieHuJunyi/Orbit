export const MAX_MODEL_PROFILES = 3;
export const MODEL_PROFILE_COOKIE = "rune_model_profiles_v1";
export const MODEL_PROFILE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
export const MIN_MODEL_INPUT_TOKEN_BUDGET = 1_024;
export const MAX_MODEL_INPUT_TOKEN_BUDGET = 200_000;
export const MIN_MODEL_OUTPUT_TOKEN_BUDGET = 256;
export const MAX_MODEL_OUTPUT_TOKEN_BUDGET = 8_000;

export type ModelTokenBudget = {
  maxInputTokens: number;
  maxOutputTokens: number;
};

export const DEFAULT_MODEL_TOKEN_BUDGET: Readonly<ModelTokenBudget> = Object.freeze({
  maxInputTokens: 50_000,
  maxOutputTokens: 4_000,
});

export type ModelProviderKind = "openai" | "openrouter" | "anthropic" | "gemini" | "custom";
export type ModelProtocol = "responses" | "chat-completions" | "anthropic-messages" | "gemini-generate-content";

export type ModelCapabilityManifest = {
  protocol: ModelProtocol;
  structuredOutput: "json-schema" | "forced-tool";
  modelCatalog: true;
  tokenUsage: "provider-reported";
  maximumOutputTokens: number;
};

export type ModelConnectionHealth = {
  status: "unknown" | "healthy" | "unhealthy";
  checkedAt: string | null;
  retryAt: string | null;
};

export const UNKNOWN_MODEL_CONNECTION_HEALTH: Readonly<ModelConnectionHealth> = Object.freeze({
  status: "unknown",
  checkedAt: null,
  retryAt: null,
});

export function modelCapabilityManifest(protocol: ModelProtocol): ModelCapabilityManifest {
  return {
    protocol,
    structuredOutput: protocol === "anthropic-messages" ? "forced-tool" : "json-schema",
    modelCatalog: true,
    tokenUsage: "provider-reported",
    maximumOutputTokens: MAX_MODEL_OUTPUT_TOKEN_BUDGET,
  };
}

export type ModelProviderPreset = {
  id: ModelProviderKind;
  label: string;
  baseURL: string;
  defaultModel: string;
  protocol: ModelProtocol;
  editableEndpoint: boolean;
  editableProtocol: boolean;
};

export const MODEL_PROVIDER_PRESETS: readonly ModelProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-5.6",
    protocol: "responses",
    editableEndpoint: false,
    editableProtocol: false,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-5.6",
    protocol: "chat-completions",
    editableEndpoint: false,
    editableProtocol: false,
  },
  {
    id: "anthropic",
    label: "Anthropic",
    baseURL: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-5",
    protocol: "anthropic-messages",
    editableEndpoint: false,
    editableProtocol: false,
  },
  {
    id: "gemini",
    label: "Google Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-pro",
    protocol: "gemini-generate-content",
    editableEndpoint: false,
    editableProtocol: false,
  },
  {
    id: "custom",
    label: "Custom API",
    baseURL: "",
    defaultModel: "",
    protocol: "responses",
    editableEndpoint: true,
    editableProtocol: true,
  },
] as const;

export type StoredModelProfile = {
  id: string;
  name: string;
  provider: ModelProviderKind;
  protocol: ModelProtocol;
  baseURL: string;
  model: string;
  budget: ModelTokenBudget;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicModelProfile = Omit<StoredModelProfile, "apiKey"> & {
  credentialConfigured: true;
  capabilities: ModelCapabilityManifest;
  health: ModelConnectionHealth;
};

export type ModelProfileVault = {
  version: 1;
  activeProfileId: string | null;
  failoverEnabled: boolean;
  profiles: StoredModelProfile[];
};

export type ModelProfilesState = {
  vaultAvailable: boolean;
  configured: boolean;
  activeProfileId: string | null;
  activeSource: "personal" | "deployment" | null;
  activeProfile: PublicModelProfile | null;
  profiles: PublicModelProfile[];
  failoverEnabled: boolean;
  deployment: {
    configured: boolean;
    provider: ModelProviderKind | null;
    model: string | null;
    budget: ModelTokenBudget | null;
    capabilities: ModelCapabilityManifest | null;
    health: ModelConnectionHealth;
  };
};

export type ModelProfileDraft = {
  id?: unknown;
  name?: unknown;
  provider?: unknown;
  protocol?: unknown;
  baseURL?: unknown;
  model?: unknown;
  budget?: unknown;
  apiKey?: unknown;
};

export const EMPTY_MODEL_PROFILE_VAULT: ModelProfileVault = {
  version: 1,
  activeProfileId: null,
  failoverEnabled: false,
  profiles: [],
};

function boundedInteger(value: unknown, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum
    ? value
    : undefined;
}

export function normalizeModelTokenBudget(value: unknown, fallback = DEFAULT_MODEL_TOKEN_BUDGET): ModelTokenBudget {
  if (!value || typeof value !== "object") return { ...fallback };
  const candidate = value as Partial<ModelTokenBudget>;
  return {
    maxInputTokens:
      boundedInteger(candidate.maxInputTokens, MIN_MODEL_INPUT_TOKEN_BUDGET, MAX_MODEL_INPUT_TOKEN_BUDGET) ??
      fallback.maxInputTokens,
    maxOutputTokens:
      boundedInteger(candidate.maxOutputTokens, MIN_MODEL_OUTPUT_TOKEN_BUDGET, MAX_MODEL_OUTPUT_TOKEN_BUDGET) ??
      fallback.maxOutputTokens,
  };
}

function cleanText(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text || text.length > maximum || /[\u0000-\u001f\u007f]/u.test(text)) return "";
  return text;
}

function isIpLiteral(hostname: string) {
  return (
    /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname) ||
    hostname.includes(":") ||
    /^0x[\da-f]+$/iu.test(hostname) ||
    /^\d+$/u.test(hostname)
  );
}

export function normalizeCustomModelBaseURL(value: unknown) {
  const input = cleanText(value, 300);
  if (!input) throw new Error("Enter the HTTPS base URL for this model API.");
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("The model endpoint must be a valid HTTPS URL.");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/u, "");
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Custom model endpoints must use HTTPS without credentials, query text, or fragments.");
  }
  if (url.port && url.port !== "443") {
    throw new Error("Custom model endpoints may use only the standard HTTPS port.");
  }
  if (
    !hostname.includes(".") ||
    isIpLiteral(hostname) ||
    hostname === "localhost" ||
    [".localhost", ".local", ".internal", ".home", ".lan"].some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new Error("Custom model endpoints must use a public DNS hostname, not a local or IP address.");
  }
  const path = url.pathname.replace(/\/+$/u, "");
  if (/(?:\/(?:responses|chat\/completions|messages)|\/models\/[^/]+:generateContent)$/iu.test(path)) {
    throw new Error("Enter the API base URL, not a final generation endpoint.");
  }
  return `${url.origin}${path}`;
}

export function normalizeModelProfileDraft(
  draft: ModelProfileDraft,
  existing?: StoredModelProfile,
  now = new Date().toISOString(),
  createId: () => string = () => crypto.randomUUID(),
): StoredModelProfile {
  const provider = draft.provider;
  if (
    provider !== "openai" &&
    provider !== "openrouter" &&
    provider !== "anthropic" &&
    provider !== "gemini" &&
    provider !== "custom"
  ) {
    throw new Error("Choose a supported model provider.");
  }
  const preset = MODEL_PROVIDER_PRESETS.find((item) => item.id === provider)!;
  const requestedProtocol = draft.protocol;
  const protocol =
    preset.editableProtocol &&
    (requestedProtocol === "responses" ||
      requestedProtocol === "chat-completions" ||
      requestedProtocol === "anthropic-messages" ||
      requestedProtocol === "gemini-generate-content")
      ? requestedProtocol
      : preset.protocol;
  const name = cleanText(draft.name, 60) || preset.label;
  const model = cleanText(draft.model, 120);
  if (!model || !/^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,119}$/u.test(model)) {
    throw new Error("Enter a valid model ID without spaces.");
  }
  const baseURL = preset.editableEndpoint ? normalizeCustomModelBaseURL(draft.baseURL) : preset.baseURL;
  const budget = normalizeModelTokenBudget(draft.budget, existing?.budget ?? DEFAULT_MODEL_TOKEN_BUDGET);
  const suppliedKey = cleanText(draft.apiKey, 512);
  if (
    !suppliedKey &&
    existing &&
    (existing.provider !== provider || existing.baseURL !== baseURL || existing.protocol !== protocol)
  ) {
    throw new Error("Enter a new API key when changing the provider, protocol, or endpoint.");
  }
  const apiKey = suppliedKey || existing?.apiKey || "";
  if (!apiKey) throw new Error("Enter an API key. Rune will clear the field after saving it.");
  const requestedId = cleanText(draft.id, 80);
  if (requestedId && requestedId !== existing?.id) throw new Error("The model profile identity is stale.");
  return {
    id: existing?.id ?? createId(),
    name,
    provider,
    protocol,
    baseURL,
    model,
    budget,
    apiKey,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function publicModelProfile(
  profile: StoredModelProfile,
  health: ModelConnectionHealth = UNKNOWN_MODEL_CONNECTION_HEALTH,
): PublicModelProfile {
  return {
    id: profile.id,
    name: profile.name,
    provider: profile.provider,
    protocol: profile.protocol,
    baseURL: profile.baseURL,
    model: profile.model,
    budget: { ...profile.budget },
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    credentialConfigured: true,
    capabilities: modelCapabilityManifest(profile.protocol),
    health: { ...health },
  };
}

export function normalizeModelProfileVault(value: unknown): ModelProfileVault {
  if (!value || typeof value !== "object") return { ...EMPTY_MODEL_PROFILE_VAULT, profiles: [] };
  const candidate = value as Partial<ModelProfileVault>;
  if (candidate.version !== 1 || !Array.isArray(candidate.profiles)) {
    return { ...EMPTY_MODEL_PROFILE_VAULT, profiles: [] };
  }
  const profiles = candidate.profiles
    .flatMap((profile) => {
      if (!profile || typeof profile !== "object") return [];
      const item = profile as StoredModelProfile;
      try {
        const normalized = normalizeModelProfileDraft(
          item,
          {
            ...item,
            apiKey: cleanText(item.apiKey, 512),
          },
          item.updatedAt,
          () => item.id,
        );
        if (!cleanText(item.id, 80) || !cleanText(item.createdAt, 40)) return [];
        return [{ ...normalized, id: item.id, createdAt: item.createdAt, updatedAt: item.updatedAt }];
      } catch {
        return [];
      }
    })
    .slice(0, MAX_MODEL_PROFILES);
  const unique = profiles.filter((profile, index) => profiles.findIndex((item) => item.id === profile.id) === index);
  const activeProfileId =
    candidate.activeProfileId === null
      ? null
      : typeof candidate.activeProfileId === "string" &&
          unique.some((profile) => profile.id === candidate.activeProfileId)
        ? candidate.activeProfileId
        : (unique[0]?.id ?? null);
  return { version: 1, profiles: unique, activeProfileId, failoverEnabled: candidate.failoverEnabled === true };
}
