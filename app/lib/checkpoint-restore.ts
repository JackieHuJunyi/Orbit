import {
  appendCheckpoint,
  canCheckpointSource,
  createCheckpoint,
  type CheckpointMap,
  type WorkspaceCheckpoint,
} from "./checkpoints.ts";
import {
  captureWorkspaceSourceRevision,
  createLineDiffPreview,
  prepareWorkspaceMutation,
  workspaceMatchesSourceRevision,
  type ArtifactSourcePatch,
  type PatchDiffLine,
  type WorkspaceSourceRevision,
} from "./patches.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export type CheckpointRestorePlan = Readonly<{
  artifactId: string;
  artifactName: string;
  checkpointId: string;
  checkpointLabel: string;
  beforeSource: string;
  nextSource: string;
  baseRevision: WorkspaceSourceRevision;
  diff: readonly PatchDiffLine[];
  patch: ArtifactSourcePatch;
  nextArtifacts: WorkspaceArtifact[];
}>;

export type PreparedCheckpointRestore = Readonly<{
  plan: CheckpointRestorePlan | null;
  errors: readonly string[];
}>;

export type CommittedCheckpointRestore = Readonly<{
  artifactId: string;
  checkpointLabel: string;
  nextArtifacts: WorkspaceArtifact[];
  nextCheckpoints: CheckpointMap;
}>;

type CheckpointRestoreWorkspaceSnapshot = Readonly<{
  artifacts: WorkspaceArtifact[];
  checkpoints: CheckpointMap;
}>;

export type CheckpointRestoreCommitPorts = Readonly<{
  expectedPlan: CheckpointRestorePlan;
  readWorkspace: () => CheckpointRestoreWorkspaceSnapshot;
  preflight: (artifacts: WorkspaceArtifact[], patches: ArtifactSourcePatch[]) => Promise<unknown>;
  persist: (artifacts: WorkspaceArtifact[], selectedId: string, checkpoints: CheckpointMap) => void;
  now?: Date;
}>;

function failed(...errors: string[]): PreparedCheckpointRestore {
  return Object.freeze({ plan: null, errors: Object.freeze(errors) });
}

export function prepareCheckpointRestore(
  artifacts: WorkspaceArtifact[],
  checkpoint: WorkspaceCheckpoint,
): PreparedCheckpointRestore {
  const artifact = artifacts.find((candidate) => candidate.id === checkpoint.artifactId);
  if (!artifact) return failed("The checkpoint does not belong to a current workspace artifact.");
  if (checkpoint.source === artifact.source) return failed(`${artifact.name}: this checkpoint is already current.`);
  if (!canCheckpointSource(artifact.source)) {
    return failed(`${artifact.name}: the current source is too large for a safe restore checkpoint.`);
  }
  if (!canCheckpointSource(checkpoint.source)) {
    return failed(`${artifact.name}: the checkpoint source is too large for device restore.`);
  }

  const patch: ArtifactSourcePatch = Object.freeze({
    artifactId: artifact.id,
    summary: `Restore checkpoint · ${checkpoint.label.trim() || "Saved checkpoint"}`,
    detail: "Restore one reviewed device checkpoint after validating the complete proposed workspace.",
    nextSource: checkpoint.source,
    operationCount: 1,
  });
  const prepared = prepareWorkspaceMutation(artifacts, [patch], []);
  if (prepared.errors.length) return failed(...prepared.errors);

  const baseRevision = captureWorkspaceSourceRevision(artifacts);
  const diff = createLineDiffPreview(artifact.source, checkpoint.source, 24).map((line) => Object.freeze({ ...line }));
  const plan: CheckpointRestorePlan = Object.freeze({
    artifactId: artifact.id,
    artifactName: artifact.name,
    checkpointId: checkpoint.id,
    checkpointLabel: checkpoint.label.trim() || "Saved checkpoint",
    beforeSource: artifact.source,
    nextSource: checkpoint.source,
    baseRevision,
    diff: Object.freeze(diff),
    patch,
    nextArtifacts: prepared.nextArtifacts,
  });

  return Object.freeze({ plan, errors: Object.freeze([]) });
}

export async function commitCheckpointRestore({
  expectedPlan,
  readWorkspace,
  preflight,
  persist,
  now,
}: CheckpointRestoreCommitPorts): Promise<CommittedCheckpointRestore> {
  const current = readWorkspace();
  if (!workspaceMatchesSourceRevision(current.artifacts, expectedPlan.baseRevision)) {
    throw new Error("The workspace changed after this restore review opened. Review the current version again.");
  }
  const checkpoint = (current.checkpoints[expectedPlan.artifactId] ?? []).find(
    (candidate) => candidate.id === expectedPlan.checkpointId,
  );
  if (!checkpoint || checkpoint.source !== expectedPlan.nextSource) {
    throw new Error("This checkpoint changed or is no longer available on this device.");
  }
  const prepared = prepareCheckpointRestore(current.artifacts, checkpoint);
  if (!prepared.plan || prepared.errors.length) {
    throw new Error(prepared.errors[0] ?? "Rune could not validate this checkpoint restore.");
  }

  try {
    await preflight(current.artifacts, [prepared.plan.patch]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The local runtime could not verify this restore.";
    throw new Error(`Runtime verification failed · ${message}`);
  }

  const verified = readWorkspace();
  if (!workspaceMatchesSourceRevision(verified.artifacts, expectedPlan.baseRevision)) {
    throw new Error("The workspace changed while Rune was verifying this restore. Review the current version again.");
  }
  const verifiedCheckpoint = (verified.checkpoints[expectedPlan.artifactId] ?? []).find(
    (candidate) => candidate.id === expectedPlan.checkpointId && candidate.source === expectedPlan.nextSource,
  );
  if (!verifiedCheckpoint) throw new Error("This checkpoint changed during verification. Review device history again.");
  const currentArtifact = verified.artifacts.find((artifact) => artifact.id === expectedPlan.artifactId);
  if (!currentArtifact) throw new Error("The file being restored is no longer in this workspace.");

  const safetyCheckpoint = createCheckpoint(
    currentArtifact,
    `Before restoring ${expectedPlan.checkpointLabel}`,
    "restore",
    now,
  );
  const nextCheckpoints = appendCheckpoint(verified.checkpoints, safetyCheckpoint);
  try {
    persist(prepared.plan.nextArtifacts, currentArtifact.id, nextCheckpoints);
  } catch {
    throw new Error("Device persistence failed, so Rune kept every source unchanged.");
  }

  return Object.freeze({
    artifactId: currentArtifact.id,
    checkpointLabel: expectedPlan.checkpointLabel,
    nextArtifacts: prepared.plan.nextArtifacts,
    nextCheckpoints,
  });
}
