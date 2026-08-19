import {
  DEFAULT_MODEL_TOKEN_BUDGET,
  UNKNOWN_MODEL_CONNECTION_HEALTH,
  modelCapabilityManifest,
  normalizeModelTokenBudget,
  type ModelCapabilityManifest,
  type ModelConnectionHealth,
  type ModelTokenBudget,
} from "./model-profiles.ts";

export const DEFAULT_OPENAI_MODEL = "gpt-5.6";
export const RUNE_MODEL_MODE_STORAGE_KEY = "rune-model-mode-v1";

export type RuneModelMode = "auto" | "local";

export type ModelProviderStatus = {
  configured: boolean;
  provider: "openai" | "openrouter" | "anthropic" | "gemini" | "custom" | null;
  model: string | null;
  source?: "personal" | "deployment" | null;
  profileName?: string | null;
  budget: ModelTokenBudget | null;
  capabilities: ModelCapabilityManifest | null;
  health: ModelConnectionHealth;
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
  const budget = normalizeModelTokenBudget(
    {
      maxInputTokens: Number(environment.RUNE_MODEL_MAX_INPUT_TOKENS),
      maxOutputTokens: Number(environment.RUNE_MODEL_MAX_OUTPUT_TOKENS),
    },
    DEFAULT_MODEL_TOKEN_BUDGET,
  );
  return {
    configured,
    provider: configured ? "openai" : null,
    model: configured ? safeModelName(environment.OPENAI_MODEL) : null,
    budget: configured ? budget : null,
    capabilities: configured ? modelCapabilityManifest("responses") : null,
    health: { ...UNKNOWN_MODEL_CONNECTION_HEALTH },
  };
}
