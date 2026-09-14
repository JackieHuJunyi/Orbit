import {
  importDesktopModelConnection,
  type DiscoveredAccountRuntime,
  type DiscoveredModelConnection,
} from "./desktop-bridge.ts";
import type { ModelProfilesState } from "./model-profiles.ts";

export type ModelConnectionPhase = "idle" | "reading" | "catalog" | "response" | "saving";

function providerError(payload: { error?: unknown }, fallback: string) {
  return typeof payload.error === "string" && payload.error.trim() && payload.error.length <= 240
    ? payload.error.trim()
    : fallback;
}

/**
 * One reviewed client transaction connects a redacted desktop discovery row.
 * Welcome and the in-chat model menu deliberately share this exact path so
 * neither surface can save an unverified credential or account capability.
 */
export async function connectDiscoveredModelConnection({
  candidate,
  accounts,
  fetcher = fetch,
  onPhase,
}: {
  candidate: DiscoveredModelConnection;
  accounts: readonly DiscoveredAccountRuntime[];
  fetcher?: typeof fetch;
  onPhase?: (phase: ModelConnectionPhase) => void;
}): Promise<ModelProfilesState> {
  onPhase?.("reading");
  const profile = await importDesktopModelConnection(candidate.id);
  onPhase?.("catalog");
  const modelResponse = await fetcher("/api/model-profiles", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "models", profile }),
  });
  const modelPayload = (await modelResponse.json()) as { models?: unknown; error?: unknown };
  if (!modelResponse.ok || !Array.isArray(modelPayload.models) || !modelPayload.models.length) {
    throw new Error(providerError(modelPayload, "The provider returned no usable model IDs."));
  }
  const models = modelPayload.models.filter((item): item is string => typeof item === "string");
  const verifiedProfile = { ...profile, model: models.includes(profile.model) ? profile.model : models[0] };
  const account = accounts.find((item) => item.provider === candidate.provider);
  const requiresResponseProbe = candidate.sourceKind !== "account-runtime" || account?.status === "verify-required";
  if (requiresResponseProbe) {
    onPhase?.("response");
    const probeResponse = await fetcher("/api/model-profiles", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "probe", profile: verifiedProfile }),
    });
    const probePayload = (await probeResponse.json()) as { ready?: unknown; error?: unknown };
    if (!probeResponse.ok || probePayload.ready !== true) {
      throw new Error(providerError(probePayload, "The provider did not complete the structured-output check."));
    }
  }
  onPhase?.("saving");
  const saveResponse = await fetcher("/api/model-profiles", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "upsert", profile: verifiedProfile }),
  });
  const saved = (await saveResponse.json()) as ModelProfilesState & { error?: unknown };
  if (!saveResponse.ok || typeof saved.configured !== "boolean") {
    throw new Error(providerError(saved, "Orbit could not save the verified connection."));
  }
  return saved;
}
