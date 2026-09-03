import { normalizeCheckpointMap, type CheckpointMap } from "./checkpoints.ts";
import { normalizeSavedOperatingReviews, type SavedOperatingReview } from "./operating-review.ts";
import { normalizeOrbitTaskEvidence, type OrbitTaskEvidence } from "./task-evidence.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export const MAX_WORKSPACE_RESET_SNAPSHOT_BYTES = 12 * 1_024 * 1_024;

export type WorkspaceDeviceState = Readonly<{
  artifacts: WorkspaceArtifact[];
  selectedId: string;
  checkpoints: CheckpointMap;
  savedOperatingReviews: SavedOperatingReview[];
  taskEvidence: OrbitTaskEvidence;
}>;

export type WorkspaceResetMode = "sample" | "recovery";

export type WorkspaceResetFacts = Readonly<{
  artifactCount: number;
  checkpointCount: number;
  savedTaskCount: number;
  taskRunCount: number;
  artifactNames: readonly string[];
  hiddenArtifactCount: number;
}>;

export type WorkspaceResetPlan = Readonly<{
  mode: WorkspaceResetMode;
  baseSnapshot: string;
  targetSnapshot: string;
  current: WorkspaceResetFacts;
  target: WorkspaceResetFacts;
  nextState: WorkspaceDeviceState;
  nextRecovery: WorkspaceDeviceState;
}>;

export type PreparedWorkspaceReset = Readonly<{
  plan: WorkspaceResetPlan | null;
  errors: readonly string[];
}>;

export type CommittedWorkspaceReset = Readonly<{
  mode: WorkspaceResetMode;
  nextState: WorkspaceDeviceState;
  nextRecovery: WorkspaceDeviceState;
}>;

export type WorkspaceResetCommitPorts = Readonly<{
  expectedPlan: WorkspaceResetPlan;
  readCurrent: () => WorkspaceDeviceState;
  readTarget: () => WorkspaceDeviceState | null;
  persist: (nextState: WorkspaceDeviceState, nextRecovery: WorkspaceDeviceState) => void;
}>;

function failed(...errors: string[]): PreparedWorkspaceReset {
  return Object.freeze({ plan: null, errors: Object.freeze(errors) });
}

function isArtifact(value: unknown): value is WorkspaceArtifact {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WorkspaceArtifact>;
  return (
    typeof candidate.id === "string" &&
    Boolean(candidate.id) &&
    typeof candidate.name === "string" &&
    Boolean(candidate.name) &&
    typeof candidate.language === "string" &&
    typeof candidate.source === "string" &&
    ["document", "data", "query", "chart", "slides"].includes(candidate.kind ?? "")
  );
}

function cloneArtifacts(value: unknown): WorkspaceArtifact[] | null {
  if (!Array.isArray(value) || !value.length || !value.every(isArtifact)) return null;
  const artifacts = value.map((artifact) => ({ ...artifact }));
  const ids = new Set(artifacts.map((artifact) => artifact.id));
  const names = new Set(artifacts.map((artifact) => artifact.name.normalize("NFKC").toLocaleLowerCase("en-US")));
  if (ids.size !== artifacts.length || names.size !== artifacts.length) return null;
  return artifacts;
}

export function normalizeWorkspaceDeviceState(value: unknown): WorkspaceDeviceState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<WorkspaceDeviceState>;
  const artifacts = cloneArtifacts(candidate.artifacts);
  if (!artifacts || typeof candidate.selectedId !== "string") return null;
  if (!artifacts.some((artifact) => artifact.id === candidate.selectedId)) return null;
  return {
    artifacts,
    selectedId: candidate.selectedId,
    checkpoints: normalizeCheckpointMap(candidate.checkpoints),
    savedOperatingReviews: normalizeSavedOperatingReviews(candidate.savedOperatingReviews),
    taskEvidence: normalizeOrbitTaskEvidence(candidate.taskEvidence),
  };
}

export function serializeWorkspaceDeviceState(state: WorkspaceDeviceState) {
  return JSON.stringify({
    artifacts: state.artifacts,
    selectedId: state.selectedId,
    checkpoints: state.checkpoints,
    savedOperatingReviews: state.savedOperatingReviews,
    taskEvidence: state.taskEvidence,
  });
}

function cloneWorkspaceDeviceState(state: WorkspaceDeviceState): WorkspaceDeviceState {
  const cloned = normalizeWorkspaceDeviceState(JSON.parse(serializeWorkspaceDeviceState(state)));
  if (!cloned) throw new Error("Orbit could not preserve this device workspace exactly.");
  return Object.freeze({
    ...cloned,
    artifacts: Object.freeze(cloned.artifacts.map((artifact) => Object.freeze(artifact))) as WorkspaceArtifact[],
    checkpoints: Object.freeze(cloned.checkpoints),
    savedOperatingReviews: Object.freeze(cloned.savedOperatingReviews) as SavedOperatingReview[],
    taskEvidence: Object.freeze(cloned.taskEvidence),
  });
}

export function workspaceDeviceStateSnapshotError(state: WorkspaceDeviceState, label: string) {
  const bytes = new TextEncoder().encode(serializeWorkspaceDeviceState(state)).byteLength;
  return bytes <= MAX_WORKSPACE_RESET_SNAPSHOT_BYTES
    ? null
    : `${label} is too large for the ${MAX_WORKSPACE_RESET_SNAPSHOT_BYTES / 1_048_576} MB device recovery limit.`;
}

function resetFacts(state: WorkspaceDeviceState): WorkspaceResetFacts {
  const artifactNames = state.artifacts.slice(0, 8).map((artifact) => artifact.name);
  return Object.freeze({
    artifactCount: state.artifacts.length,
    checkpointCount: Object.values(state.checkpoints).reduce((total, entries) => total + entries.length, 0),
    savedTaskCount: state.savedOperatingReviews.length,
    taskRunCount: state.taskEvidence.runs.length,
    artifactNames: Object.freeze(artifactNames),
    hiddenArtifactCount: Math.max(0, state.artifacts.length - artifactNames.length),
  });
}

export function prepareWorkspaceReset(
  currentInput: WorkspaceDeviceState,
  targetInput: WorkspaceDeviceState,
  mode: WorkspaceResetMode,
): PreparedWorkspaceReset {
  const current = normalizeWorkspaceDeviceState(currentInput);
  const target = normalizeWorkspaceDeviceState(targetInput);
  if (!current) return failed("The current device workspace is not safe to preserve.");
  if (!target) return failed("The target device workspace is not a valid Orbit workspace snapshot.");
  const currentSizeError = workspaceDeviceStateSnapshotError(current, "The current workspace");
  if (currentSizeError) return failed(currentSizeError);
  const targetSizeError = workspaceDeviceStateSnapshotError(
    target,
    mode === "sample" ? "The sample workspace" : "The recovery workspace",
  );
  if (targetSizeError) return failed(targetSizeError);

  const baseSnapshot = serializeWorkspaceDeviceState(current);
  const targetSnapshot = serializeWorkspaceDeviceState(target);
  if (baseSnapshot === targetSnapshot) {
    return failed(
      mode === "sample" ? "The sample workspace is already current." : "That recovery workspace is already current.",
    );
  }

  const nextState = cloneWorkspaceDeviceState(target);
  const nextRecovery = cloneWorkspaceDeviceState(current);
  const plan: WorkspaceResetPlan = Object.freeze({
    mode,
    baseSnapshot,
    targetSnapshot,
    current: resetFacts(current),
    target: resetFacts(target),
    nextState,
    nextRecovery,
  });
  return Object.freeze({ plan, errors: Object.freeze([]) });
}

export async function commitWorkspaceReset({
  expectedPlan,
  readCurrent,
  readTarget,
  persist,
}: WorkspaceResetCommitPorts): Promise<CommittedWorkspaceReset> {
  const current = readCurrent();
  if (serializeWorkspaceDeviceState(current) !== expectedPlan.baseSnapshot) {
    throw new Error("The device workspace changed after this review opened. Review the current workspace again.");
  }
  const target = readTarget();
  if (!target || serializeWorkspaceDeviceState(target) !== expectedPlan.targetSnapshot) {
    throw new Error(
      expectedPlan.mode === "sample"
        ? "The built-in sample changed after this review opened."
        : "The recovery workspace changed or is no longer available on this device.",
    );
  }
  const prepared = prepareWorkspaceReset(current, target, expectedPlan.mode);
  if (!prepared.plan || prepared.errors.length) {
    throw new Error(prepared.errors[0] ?? "Orbit could not validate this workspace transition.");
  }
  try {
    persist(prepared.plan.nextState, prepared.plan.nextRecovery);
  } catch {
    throw new Error("Device persistence failed, so Orbit kept the current workspace unchanged.");
  }
  return Object.freeze({
    mode: expectedPlan.mode,
    nextState: prepared.plan.nextState,
    nextRecovery: prepared.plan.nextRecovery,
  });
}
