import {
  MAX_MODEL_PROFILES,
  currentModelProfileBaseURL,
  isAccountModelProvider,
  modelProviderAvailableInEnvironment,
  normalizeModelProfileDraft,
  publicModelProfile,
  type ModelProfileVault,
  type ModelProfilesState,
} from "../../lib/model-profiles.ts";
import {
  activeStoredProfile,
  deploymentModelConnection,
  modelVaultAvailable,
  readModelProfileVault,
  serializeModelProfileVaultCookie,
} from "../../lib/model-credential-vault.ts";
import { modelProviderStatus } from "../../lib/model-preference.ts";
import { listProviderModels, requestProviderPlan } from "../../lib/model-provider-adapters.ts";
import { modelConnectionHealth } from "../../lib/model-routing.ts";
import { z } from "zod";

const ModelProtocolProbeSchema = z.object({ ready: z.literal(true) }).strict();

function personalConnection(profile: ModelProfileVault["profiles"][number]) {
  return {
    source: "personal" as const,
    profileId: profile.id,
    profileName: profile.name,
    provider: profile.provider,
    protocol: profile.protocol,
    apiKey: profile.apiKey,
    baseURL: currentModelProfileBaseURL(profile.provider, profile.baseURL),
    model: profile.model,
    budget: profile.budget,
    capabilities: publicModelProfile(profile).capabilities,
  };
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function state(vault: ModelProfileVault): ModelProfilesState {
  const deploymentConnection = deploymentModelConnection(process.env);
  const baseDeployment = modelProviderStatus(process.env);
  const deployment = {
    ...baseDeployment,
    health: deploymentConnection ? modelConnectionHealth(deploymentConnection) : baseDeployment.health,
  };
  const availableProfiles = vault.profiles.filter((profile) =>
    modelProviderAvailableInEnvironment(profile.provider, process.env),
  );
  const active = activeStoredProfile({ ...vault, profiles: availableProfiles });
  const profiles = availableProfiles.map((profile) =>
    publicModelProfile(profile, modelConnectionHealth(personalConnection(profile))),
  );
  return {
    vaultAvailable: modelVaultAvailable(process.env),
    configured: Boolean(active) || deployment.configured,
    activeProfileId: active?.id ?? null,
    activeSource: active ? "personal" : deployment.configured ? "deployment" : null,
    activeProfile: active ? (profiles.find((profile) => profile.id === active.id) ?? null) : null,
    profiles,
    failoverEnabled: vault.failoverEnabled,
    deployment,
  };
}

function jsonState(vault: ModelProfileVault, cookie?: string) {
  const headers = new Headers({ "cache-control": "no-store", vary: "Cookie" });
  if (cookie) headers.set("set-cookie", cookie);
  return Response.json(state(vault), { headers });
}

export async function GET(request: Request) {
  return jsonState(await readModelProfileVault(request));
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Cross-origin model configuration is not allowed." }, { status: 403 });
  if (!modelVaultAvailable(process.env)) {
    return Response.json(
      { error: "The encrypted credential vault is unavailable on this server.", code: "MODEL_VAULT_UNAVAILABLE" },
      { status: 503 },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object")
    return Response.json({ error: "The model configuration request is invalid." }, { status: 400 });
  const input = body as { action?: unknown; profileId?: unknown; profile?: unknown; enabled?: unknown };
  const vault = await readModelProfileVault(request);
  let next: ModelProfileVault;
  try {
    if (input.action === "models") {
      if (!input.profile || typeof input.profile !== "object")
        throw new Error("Enter the model profile details first.");
      const requestedId =
        typeof (input.profile as { id?: unknown }).id === "string" ? (input.profile as { id: string }).id : "";
      const existing = requestedId ? vault.profiles.find((profile) => profile.id === requestedId) : undefined;
      if (requestedId && !existing) throw new Error("That model profile no longer exists. Refresh and try again.");
      const profile = normalizeModelProfileDraft(input.profile, existing);
      if (!modelProviderAvailableInEnvironment(profile.provider, process.env)) {
        throw new Error("Device model runtimes are available only in the Orbit desktop app.");
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      try {
        const models = await listProviderModels(personalConnection(profile), controller.signal);
        return Response.json({ models }, { headers: { "cache-control": "no-store" } });
      } catch (error) {
        if (controller.signal.aborted) throw new Error("The provider model-list request timed out.");
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    } else if (input.action === "probe") {
      if (!input.profile || typeof input.profile !== "object")
        throw new Error("Enter the model profile details first.");
      const profile = normalizeModelProfileDraft(input.profile);
      if (!modelProviderAvailableInEnvironment(profile.provider, process.env)) {
        throw new Error("Device model runtimes are available only in the Orbit desktop app.");
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), isAccountModelProvider(profile.provider) ? 60_000 : 20_000);
      try {
        const result = await requestProviderPlan({
          connection: personalConnection(profile),
          instructions:
            "Return the required readiness object through this provider's structured-output protocol. Do not add fields.",
          input: "Confirm that this connection can return Orbit's required structured response.",
          schema: ModelProtocolProbeSchema,
          schemaName: "model_protocol_probe",
          responseDescription: "Return the minimal Orbit model-protocol readiness object.",
          signal: controller.signal,
        });
        if (!ModelProtocolProbeSchema.safeParse(result.output).success) {
          throw new Error("The provider did not return Orbit's required structured response.");
        }
        return Response.json({ ready: true }, { headers: { "cache-control": "no-store" } });
      } catch (error) {
        if (controller.signal.aborted) throw new Error("The provider structured-response check timed out.");
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    } else if (input.action === "upsert") {
      if (!input.profile || typeof input.profile !== "object") throw new Error("Enter the model profile details.");
      const requestedId =
        typeof (input.profile as { id?: unknown }).id === "string" ? (input.profile as { id: string }).id : "";
      const existing = requestedId ? vault.profiles.find((profile) => profile.id === requestedId) : undefined;
      if (requestedId && !existing) throw new Error("That model profile no longer exists. Refresh and try again.");
      if (!existing && vault.profiles.length >= MAX_MODEL_PROFILES) {
        throw new Error(`Orbit supports up to ${MAX_MODEL_PROFILES} personal model profiles in this release.`);
      }
      const profile = normalizeModelProfileDraft(input.profile, existing);
      if (!modelProviderAvailableInEnvironment(profile.provider, process.env)) {
        throw new Error("Device model runtimes are available only in the Orbit desktop app.");
      }
      const profiles = existing
        ? vault.profiles.map((item) => (item.id === existing.id ? profile : item))
        : [...vault.profiles, profile];
      next = { ...vault, profiles, activeProfileId: profile.id };
    } else if (input.action === "deployment") {
      if (!modelProviderStatus(process.env).configured) throw new Error("No deployment model is configured.");
      next = { ...vault, activeProfileId: null };
    } else if (input.action === "activate") {
      if (
        typeof input.profileId !== "string" ||
        !vault.profiles.some(
          (profile) =>
            profile.id === input.profileId && modelProviderAvailableInEnvironment(profile.provider, process.env),
        )
      ) {
        throw new Error("That model profile no longer exists.");
      }
      next = { ...vault, activeProfileId: input.profileId };
    } else if (input.action === "failover") {
      if (typeof input.enabled !== "boolean") throw new Error("Choose whether provider failover is allowed.");
      const availableProfileCount = vault.profiles.filter((profile) =>
        modelProviderAvailableInEnvironment(profile.provider, process.env),
      ).length;
      if (input.enabled && availableProfileCount + Number(modelProviderStatus(process.env).configured) < 2) {
        throw new Error("Configure at least two model connections before allowing provider failover.");
      }
      next = { ...vault, failoverEnabled: input.enabled };
    } else if (input.action === "delete") {
      if (typeof input.profileId !== "string" || !vault.profiles.some((profile) => profile.id === input.profileId)) {
        throw new Error("That model profile no longer exists.");
      }
      const profiles = vault.profiles.filter((profile) => profile.id !== input.profileId);
      next = {
        ...vault,
        profiles,
        activeProfileId: vault.activeProfileId === input.profileId ? (profiles[0]?.id ?? null) : vault.activeProfileId,
        failoverEnabled:
          profiles.filter((profile) => modelProviderAvailableInEnvironment(profile.provider, process.env)).length +
            Number(modelProviderStatus(process.env).configured) >=
            2 && vault.failoverEnabled,
      };
    } else {
      throw new Error("Choose a supported model profile action.");
    }
    return jsonState(next, await serializeModelProfileVaultCookie(request, next));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Orbit could not update that model profile." },
      { status: 400 },
    );
  }
}
