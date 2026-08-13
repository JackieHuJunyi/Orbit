export const MAX_MODEL_PROFILES = 3;
export const MODEL_PROFILE_COOKIE = "rune_model_profiles_v1";
export const MODEL_PROFILE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type ModelProviderKind = "openai" | "openrouter" | "custom";

export type ModelProviderPreset = {
  id: ModelProviderKind;
  label: string;
  baseURL: string;
  defaultModel: string;
  editableEndpoint: boolean;
};

export const MODEL_PROVIDER_PRESETS: readonly ModelProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-5.6",
    editableEndpoint: false,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-5.6",
    editableEndpoint: false,
  },
  {
    id: "custom",
    label: "Custom Responses API",
    baseURL: "",
    defaultModel: "",
    editableEndpoint: true,
  },
] as const;

export type StoredModelProfile = {
  id: string;
  name: string;
  provider: ModelProviderKind;
  baseURL: string;
  model: string;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicModelProfile = Omit<StoredModelProfile, "apiKey"> & {
  credentialConfigured: true;
};

export type ModelProfileVault = {
  version: 1;
  activeProfileId: string | null;
  profiles: StoredModelProfile[];
};

export type ModelProfilesState = {
  vaultAvailable: boolean;
  configured: boolean;
  activeProfileId: string | null;
  activeSource: "personal" | "deployment" | null;
  activeProfile: PublicModelProfile | null;
  profiles: PublicModelProfile[];
  deployment: {
    configured: boolean;
    provider: "openai" | "openrouter" | "custom" | null;
    model: string | null;
  };
};

export type ModelProfileDraft = {
  id?: unknown;
  name?: unknown;
  provider?: unknown;
  baseURL?: unknown;
  model?: unknown;
  apiKey?: unknown;
};

export const EMPTY_MODEL_PROFILE_VAULT: ModelProfileVault = {
  version: 1,
  activeProfileId: null,
  profiles: [],
};

function cleanText(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text || text.length > maximum || /[\u0000-\u001f\u007f]/u.test(text)) return "";
  return text;
}

function isIpLiteral(hostname: string) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname)
    || hostname.includes(":")
    || /^0x[\da-f]+$/iu.test(hostname)
    || /^\d+$/u.test(hostname);
}

export function normalizeCustomModelBaseURL(value: unknown) {
  const input = cleanText(value, 300);
  if (!input) throw new Error("Enter the HTTPS base URL for this Responses API.");
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
  if (!hostname.includes(".")
    || isIpLiteral(hostname)
    || hostname === "localhost"
    || [".localhost", ".local", ".internal", ".home", ".lan"].some((suffix) => hostname.endsWith(suffix))) {
    throw new Error("Custom model endpoints must use a public DNS hostname, not a local or IP address.");
  }
  const path = url.pathname.replace(/\/+$/u, "");
  if (/\/(?:responses|chat\/completions)$/iu.test(path)) {
    throw new Error("Enter the API base URL, not the final /responses or /chat/completions path.");
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
  if (provider !== "openai" && provider !== "openrouter" && provider !== "custom") {
    throw new Error("Choose a supported model provider.");
  }
  const preset = MODEL_PROVIDER_PRESETS.find((item) => item.id === provider)!;
  const name = cleanText(draft.name, 60) || preset.label;
  const model = cleanText(draft.model, 120);
  if (!model || !/^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,119}$/u.test(model)) {
    throw new Error("Enter a valid model ID without spaces.");
  }
  const baseURL = preset.editableEndpoint ? normalizeCustomModelBaseURL(draft.baseURL) : preset.baseURL;
  const suppliedKey = cleanText(draft.apiKey, 512);
  if (!suppliedKey && existing && (existing.provider !== provider || existing.baseURL !== baseURL)) {
    throw new Error("Enter a new API key when changing the provider or endpoint.");
  }
  const apiKey = suppliedKey || existing?.apiKey || "";
  if (!apiKey) throw new Error("Enter an API key. Rune will clear the field after saving it.");
  const requestedId = cleanText(draft.id, 80);
  if (requestedId && requestedId !== existing?.id) throw new Error("The model profile identity is stale.");
  return {
    id: existing?.id ?? createId(),
    name,
    provider,
    baseURL,
    model,
    apiKey,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function publicModelProfile(profile: StoredModelProfile): PublicModelProfile {
  return {
    id: profile.id,
    name: profile.name,
    provider: profile.provider,
    baseURL: profile.baseURL,
    model: profile.model,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    credentialConfigured: true,
  };
}

export function normalizeModelProfileVault(value: unknown): ModelProfileVault {
  if (!value || typeof value !== "object") return { ...EMPTY_MODEL_PROFILE_VAULT, profiles: [] };
  const candidate = value as Partial<ModelProfileVault>;
  if (candidate.version !== 1 || !Array.isArray(candidate.profiles)) {
    return { ...EMPTY_MODEL_PROFILE_VAULT, profiles: [] };
  }
  const profiles = candidate.profiles.flatMap((profile) => {
    if (!profile || typeof profile !== "object") return [];
    const item = profile as StoredModelProfile;
    try {
      const normalized = normalizeModelProfileDraft(item, {
        ...item,
        apiKey: cleanText(item.apiKey, 512),
      }, item.updatedAt, () => item.id);
      if (!cleanText(item.id, 80) || !cleanText(item.createdAt, 40)) return [];
      return [{ ...normalized, id: item.id, createdAt: item.createdAt, updatedAt: item.updatedAt }];
    } catch {
      return [];
    }
  }).slice(0, MAX_MODEL_PROFILES);
  const unique = profiles.filter((profile, index) => profiles.findIndex((item) => item.id === profile.id) === index);
  const activeProfileId = candidate.activeProfileId === null
    ? null
    : typeof candidate.activeProfileId === "string"
      && unique.some((profile) => profile.id === candidate.activeProfileId)
      ? candidate.activeProfileId
      : unique[0]?.id ?? null;
  return { version: 1, profiles: unique, activeProfileId };
}
