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
export const ORBIT_MODEL_MODE_STORAGE_KEY = "orbit-model-mode-v1";

export type OrbitModelMode = "model-assisted" | "device-tools-only";

export type ModelProviderStatus = {
  configured: boolean;
  provider: "openai" | "openrouter" | "deepseek" | "anthropic" | "gemini" | "ollama" | "lmstudio" | "custom" | null;
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

export function normalizeOrbitModelMode(value: unknown): OrbitModelMode | null {
  if (value === "model-assisted" || value === "auto") return "model-assisted";
  if (value === "device-tools-only" || value === "local") return "device-tools-only";
  return null;
}

export function modelProviderStatus(environment: Record<string, string | undefined>): ModelProviderStatus {
  const configured = Boolean(environment.OPENAI_API_KEY?.trim());
  const budget = normalizeModelTokenBudget(
    {
      maxInputTokens: Number(environment.ORBIT_MODEL_MAX_INPUT_TOKENS),
      maxOutputTokens: Number(environment.ORBIT_MODEL_MAX_OUTPUT_TOKENS),
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
