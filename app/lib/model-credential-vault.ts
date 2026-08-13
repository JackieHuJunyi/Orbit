import {
  EMPTY_MODEL_PROFILE_VAULT,
  MODEL_PROFILE_COOKIE,
  MODEL_PROFILE_COOKIE_MAX_AGE,
  normalizeModelProfileVault,
  type ModelProfileVault,
  type ModelProtocol,
  type ModelProviderKind,
  type StoredModelProfile,
} from "./model-profiles.ts";
import { DEFAULT_OPENAI_MODEL } from "./model-preference.ts";

const VAULT_AAD = new TextEncoder().encode("rune:model-profiles:v1");
function vaultSecret(environment: Record<string, string | undefined>) {
  const configured = environment.RUNE_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (configured && configured.length >= 32) return configured;
  return null;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/gu, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/gu, "+").replace(/_/gu, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function cookieValue(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === MODEL_PROFILE_COOKIE) return rest.join("=");
  }
  return "";
}

export function modelVaultAvailable(environment: Record<string, string | undefined> = process.env) {
  return Boolean(vaultSecret(environment));
}

export async function readModelProfileVault(
  request: Request,
  environment: Record<string, string | undefined> = process.env,
): Promise<ModelProfileVault> {
  const secret = vaultSecret(environment);
  const encoded = cookieValue(request);
  if (!secret || !encoded) return { ...EMPTY_MODEL_PROFILE_VAULT, profiles: [] };
  try {
    const [ivText, encryptedText, extra] = encoded.split(".");
    if (!ivText || !encryptedText || extra) return { ...EMPTY_MODEL_PROFILE_VAULT, profiles: [] };
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(ivText), additionalData: VAULT_AAD },
      await encryptionKey(secret),
      fromBase64Url(encryptedText),
    );
    return normalizeModelProfileVault(JSON.parse(new TextDecoder().decode(decrypted)));
  } catch {
    return { ...EMPTY_MODEL_PROFILE_VAULT, profiles: [] };
  }
}

export async function serializeModelProfileVaultCookie(
  request: Request,
  vault: ModelProfileVault,
  environment: Record<string, string | undefined> = process.env,
) {
  const secret = vaultSecret(environment);
  if (!secret) throw new Error("Rune's encrypted credential vault is not configured on this server.");
  if (!vault.profiles.length) {
    return `${MODEL_PROFILE_COOKIE}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0`;
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: VAULT_AAD },
    await encryptionKey(secret),
    new TextEncoder().encode(JSON.stringify(vault)),
  ));
  const value = `${toBase64Url(iv)}.${toBase64Url(encrypted)}`;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const cookie = `${MODEL_PROFILE_COOKIE}=${value}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${MODEL_PROFILE_COOKIE_MAX_AGE}${secure}`;
  if (cookie.length > 3_900) throw new Error("The encrypted model profiles exceed the browser cookie limit.");
  return cookie;
}

export type ActiveModelConnection = {
  source: "personal" | "deployment";
  profileId: string | null;
  profileName: string;
  provider: ModelProviderKind;
  protocol: ModelProtocol;
  apiKey: string;
  baseURL: string;
  model: string;
};

export async function resolveActiveModelConnection(
  request: Request,
  environment: Record<string, string | undefined> = process.env,
): Promise<ActiveModelConnection | null> {
  const vault = await readModelProfileVault(request, environment);
  const active = vault.profiles.find((profile) => profile.id === vault.activeProfileId);
  if (active) {
    return {
      source: "personal",
      profileId: active.id,
      profileName: active.name,
      provider: active.provider,
      protocol: active.protocol,
      apiKey: active.apiKey,
      baseURL: active.baseURL,
      model: active.model,
    };
  }
  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = environment.OPENAI_MODEL?.trim();
  return {
    source: "deployment",
    profileId: null,
    profileName: "Deployment OpenAI",
    provider: "openai",
    protocol: "responses",
    apiKey,
    baseURL: "https://api.openai.com/v1",
    model: model && /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,119}$/u.test(model) ? model : DEFAULT_OPENAI_MODEL,
  };
}

export function activeStoredProfile(vault: ModelProfileVault): StoredModelProfile | undefined {
  return vault.profiles.find((profile) => profile.id === vault.activeProfileId);
}
