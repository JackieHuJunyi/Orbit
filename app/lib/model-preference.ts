export const DEFAULT_OPENAI_MODEL = "gpt-5.6";
export const RUNE_MODEL_MODE_STORAGE_KEY = "rune-model-mode-v1";

export type RuneModelMode = "auto" | "local";

export type ModelProviderStatus = {
  configured: boolean;
  provider: "openai" | "openrouter" | "anthropic" | "gemini" | "custom" | null;
  model: string | null;
  source?: "personal" | "deployment" | null;
  profileName?: string | null;
};

function safeModelName(value: string | undefined) {
  const candidate = value?.trim();
  return candidate && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/u.test(candidate) ? candidate : DEFAULT_OPENAI_MODEL;
}

export function normalizeRuneModelMode(value: unknown): RuneModelMode | null {
  if (value === "auto" || value === "local") return value;
  return null;
}

export function modelProviderStatus(environment: Record<string, string | undefined>): ModelProviderStatus {
  const configured = Boolean(environment.OPENAI_API_KEY?.trim());
  return {
    configured,
    provider: configured ? "openai" : null,
    model: configured ? safeModelName(environment.OPENAI_MODEL) : null,
  };
}
