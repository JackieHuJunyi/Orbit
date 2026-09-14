import { accountModelChoices, accountModelSelection } from "../../shared/account-model-catalog.mjs";
import type { DesktopModelDiscovery, DiscoveredModelConnection } from "./desktop-bridge.ts";
import { isAccountModelProvider, type ModelProfilesState } from "./model-profiles.ts";
import type { OrbitModelMode } from "./model-preference.ts";

const ACCOUNT_MODEL_OPTION_MARKER = ":account-model:";
const PROFILE_MODEL_OPTION_MARKER = ":profile-model:";

export type AgentActivity = "idle" | "preparing" | "waiting" | "query-evidence" | "validating" | "repairing";

export type AgentModelOption = Readonly<{
  value: string;
  label: string;
  detail: string;
  group: "connected" | "available" | "local";
  action: "switch" | "connect" | "settings" | "local";
  connectionKey: string;
  connectionLabel: string;
  modelKey: string | null;
  modelLabel: string | null;
  effort: string | null;
}>;

const DISCOVERED_MODEL_MARKER = "discovered:";
const ACCOUNT_SETTINGS_MARKER = "account-settings:";

function accountModelOptionValue(profileId: string, model: string) {
  return `profile:${profileId}${ACCOUNT_MODEL_OPTION_MARKER}${model}`;
}

export function buildAgentModelOptions(
  state: ModelProfilesState | null,
  discovery: DesktopModelDiscovery | null,
  labels: { local: string; localDetail: string; connected: string; needsSignIn: string },
  profileModels: Readonly<Record<string, readonly string[]>> = {},
): AgentModelOption[] {
  const options: AgentModelOption[] = [];
  for (const profile of state?.profiles ?? []) {
    if (isAccountModelProvider(profile.provider)) {
      const catalog = profileModels[profile.id];
      const choices = (catalog === undefined ? [profile.model] : catalog)
        .map((model) => accountModelSelection(profile.provider, model))
        .filter((choice): choice is NonNullable<typeof choice> => Boolean(choice));
      const fallbackChoices = choices.length ? choices : accountModelChoices(profile.provider);
      for (const choice of fallbackChoices) {
        const value = accountModelOptionValue(profile.id, choice.id);
        options.push({
          value,
          label: choice.label,
          detail: profile.name,
          group: "connected",
          action: "switch",
          connectionKey: `profile:${profile.id}`,
          connectionLabel: accountConnectionLabel(profile.provider),
          modelKey: choice.model,
          modelLabel: choice.label.split(" · ")[0],
          effort: choice.effort,
        });
      }
    } else {
      const connectionKey = `profile:${profile.id}`;
      const models = [...new Set([profile.model, ...(profileModels[profile.id] ?? [])])].slice(0, 80);
      for (const model of models) {
        options.push({
          value: profileModelOptionValue(profile.id, model),
          label: model,
          detail: profile.name,
          group: "connected",
          action: "switch",
          connectionKey,
          connectionLabel: profile.name,
          modelKey: model,
          modelLabel: model,
          effort: null,
        });
      }
    }
  }
  if (state?.deployment.configured) {
    options.push({
      value: "deployment",
      label: `${state.deployment.provider ?? labels.connected} · ${state.deployment.model ?? labels.connected}`,
      detail: labels.connected,
      group: "connected",
      action: "switch",
      connectionKey: "deployment",
      connectionLabel: state.deployment.provider ?? labels.connected,
      modelKey: state.deployment.model,
      modelLabel: state.deployment.model,
      effort: null,
    });
  }
  const connectedProfiles = state?.profiles ?? [];
  const availableCandidates = (discovery?.candidates ?? []).filter(
    (candidate) =>
      !connectedProfiles.some((profile) =>
        isAccountModelProvider(profile.provider)
          ? profile.provider === candidate.provider
          : sameDiscoveredConnection(profile, candidate),
      ),
  );
  for (const candidate of availableCandidates) {
    const value = `${DISCOVERED_MODEL_MARKER}${candidate.id}`;
    const connectionLabel = isAccountModelProvider(candidate.provider)
      ? accountConnectionLabel(candidate.provider)
      : candidate.name;
    options.push({
      value,
      label: connectionLabel,
      detail: `${candidate.model} · ${candidate.sourceLabel}`,
      group: "available",
      action: "connect",
      connectionKey: value,
      connectionLabel,
      modelKey: candidate.model,
      modelLabel: candidate.model,
      effort: null,
    });
  }
  const candidateProviders = new Set(discovery?.candidates.map((candidate) => candidate.provider) ?? []);
  for (const account of discovery?.accounts ?? []) {
    if (
      !account.installed ||
      account.status === "not-installed" ||
      candidateProviders.has(account.provider) ||
      connectedProfiles.some((profile) => profile.provider === account.provider)
    )
      continue;
    const value = `${ACCOUNT_SETTINGS_MARKER}${account.id}`;
    options.push({
      value,
      label: account.label,
      detail: labels.needsSignIn,
      group: "available",
      action: "settings",
      connectionKey: value,
      connectionLabel: account.label,
      modelKey: null,
      modelLabel: null,
      effort: null,
    });
  }
  options.push({
    value: "local",
    label: labels.local,
    detail: labels.localDetail,
    group: "local",
    action: "local",
    connectionKey: "local",
    connectionLabel: labels.local,
    modelKey: null,
    modelLabel: null,
    effort: null,
  });
  return options;
}

function profileModelOptionValue(profileId: string, model: string) {
  return `profile:${profileId}${PROFILE_MODEL_OPTION_MARKER}${encodeURIComponent(model)}`;
}

function accountConnectionLabel(provider: ModelProfilesState["profiles"][number]["provider"]) {
  if (provider === "codex-account") return "ChatGPT";
  if (provider === "claude-account") return "Claude";
  return "Gemini";
}

function sameDiscoveredConnection(
  profile: ModelProfilesState["profiles"][number],
  candidate: DiscoveredModelConnection,
) {
  return (
    profile.provider === candidate.provider &&
    profile.protocol === candidate.protocol &&
    profile.baseURL.replace(/\/+$/u, "") === candidate.baseURL.replace(/\/+$/u, "") &&
    profile.model === candidate.model
  );
}

export function selectedAgentModelValue(
  mode: OrbitModelMode,
  state: ModelProfilesState | null,
  options: readonly AgentModelOption[] = [],
) {
  if (mode === "device-tools-only") return "local";
  if (state?.activeSource === "personal" && state.activeProfileId) {
    const active = state.activeProfile;
    if (active && isAccountModelProvider(active.provider) && accountModelSelection(active.provider, active.model)) {
      return accountModelOptionValue(active.id, active.model);
    }
    return (
      options.find(
        (option) => option.connectionKey === `profile:${state.activeProfileId}` && option.modelKey === active?.model,
      )?.value ?? `profile:${state.activeProfileId}`
    );
  }
  return state?.activeSource === "deployment" ? "deployment" : "local";
}

export function agentModelSelectionRequest(value: string) {
  if (value === "deployment") return { action: "deployment" } as const;
  if (!value.startsWith("profile:")) return null;
  const profileModelMarker = value.indexOf(PROFILE_MODEL_OPTION_MARKER);
  if (profileModelMarker >= 9) {
    const profileId = value.slice(8, profileModelMarker);
    let model = "";
    try {
      model = decodeURIComponent(value.slice(profileModelMarker + PROFILE_MODEL_OPTION_MARKER.length));
    } catch {
      return null;
    }
    return profileId && model ? ({ action: "profile-model", profileId, model } as const) : null;
  }
  const marker = value.indexOf(ACCOUNT_MODEL_OPTION_MARKER);
  if (marker >= 9) {
    const profileId = value.slice(8, marker);
    const model = value.slice(marker + ACCOUNT_MODEL_OPTION_MARKER.length);
    return profileId && model ? ({ action: "account-model", profileId, model } as const) : null;
  }
  const profileId = value.slice(8);
  return profileId ? ({ action: "activate", profileId } as const) : null;
}

export function discoveredAgentModelId(value: string) {
  const id = value.startsWith(DISCOVERED_MODEL_MARKER) ? value.slice(DISCOVERED_MODEL_MARKER.length) : "";
  return id || null;
}

export function agentModelSelectionOpensSettings(value: string) {
  return value.startsWith(ACCOUNT_SETTINGS_MARKER);
}

export function agentActivityCanStop(activity: AgentActivity) {
  return activity === "waiting" || activity === "query-evidence" || activity === "repairing";
}

export function agentActivityLabel(
  activity: AgentActivity,
  labels: { starting: string; reading: string; query: string; validating: string; repairing: string },
) {
  if (activity === "preparing") return labels.starting;
  if (activity === "query-evidence") return labels.query;
  if (activity === "validating") return labels.validating;
  if (activity === "repairing") return labels.repairing;
  return labels.reading;
}
