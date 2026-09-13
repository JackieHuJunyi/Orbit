import { accountModelChoice, accountModelChoices } from "../../shared/account-model-catalog.mjs";
import { isAccountModelProvider, type ModelProfilesState } from "./model-profiles.ts";
import type { OrbitModelMode } from "./model-preference.ts";

const ACCOUNT_MODEL_OPTION_MARKER = ":account-model:";

export type AgentActivity = "idle" | "preparing" | "waiting" | "query-evidence" | "validating" | "repairing";

export type AgentModelOption = Readonly<{ value: string; label: string }>;

function accountModelOptionValue(profileId: string, model: string) {
  return `profile:${profileId}${ACCOUNT_MODEL_OPTION_MARKER}${model}`;
}

export function buildAgentModelOptions(
  state: ModelProfilesState | null,
  labels: { local: string; connected: string },
): AgentModelOption[] {
  const options: AgentModelOption[] = [];
  for (const profile of state?.profiles ?? []) {
    if (isAccountModelProvider(profile.provider)) {
      for (const choice of accountModelChoices(profile.provider)) {
        options.push({
          value: accountModelOptionValue(profile.id, choice.id),
          label: `${profile.name} · ${choice.label}`,
        });
      }
    } else {
      options.push({ value: `profile:${profile.id}`, label: `${profile.name} · ${profile.model}` });
    }
  }
  if (state?.deployment.configured) {
    options.push({
      value: "deployment",
      label: `${state.deployment.provider ?? labels.connected} · ${state.deployment.model ?? labels.connected}`,
    });
  }
  options.push({ value: "local", label: labels.local });
  return options;
}

export function selectedAgentModelValue(mode: OrbitModelMode, state: ModelProfilesState | null) {
  if (mode === "device-tools-only") return "local";
  if (state?.activeSource === "personal" && state.activeProfileId) {
    const active = state.activeProfile;
    return active && isAccountModelProvider(active.provider) && accountModelChoice(active.provider, active.model)
      ? accountModelOptionValue(active.id, active.model)
      : `profile:${state.activeProfileId}`;
  }
  return state?.activeSource === "deployment" ? "deployment" : "local";
}

export function agentModelSelectionRequest(value: string) {
  if (value === "deployment") return { action: "deployment" } as const;
  if (!value.startsWith("profile:")) return null;
  const marker = value.indexOf(ACCOUNT_MODEL_OPTION_MARKER);
  if (marker >= 9) {
    const profileId = value.slice(8, marker);
    const model = value.slice(marker + ACCOUNT_MODEL_OPTION_MARKER.length);
    return profileId && model ? ({ action: "account-model", profileId, model } as const) : null;
  }
  const profileId = value.slice(8);
  return profileId ? ({ action: "activate", profileId } as const) : null;
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
