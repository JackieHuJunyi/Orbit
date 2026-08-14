import {
  prepareWorkspaceMutation,
  workspaceMatchesSourceRevision,
  type ArtifactCreationChange,
  type ArtifactSourcePatch,
  type WorkspaceSourceRevision,
} from "./patches.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export type WorkspaceProposalPreview = {
  artifacts: WorkspaceArtifact[];
  artifact: WorkspaceArtifact | null;
  changedArtifactIds: string[];
  isCreation: boolean;
  errors: string[];
};

export function prepareWorkspaceProposalPreview(input: {
  artifacts: WorkspaceArtifact[];
  baseRevision: WorkspaceSourceRevision;
  patches: ArtifactSourcePatch[];
  creations: ArtifactCreationChange[];
  requestedArtifactId?: string;
}): WorkspaceProposalPreview {
  const changedArtifactIds = [
    ...input.patches.map((patch) => patch.artifactId),
    ...input.creations.map((creation) => creation.artifact.id),
  ];
  if (!workspaceMatchesSourceRevision(input.artifacts, input.baseRevision)) {
    return {
      artifacts: input.artifacts,
      artifact: null,
      changedArtifactIds,
      isCreation: false,
      errors: ["The proposed preview no longer matches the current workspace revision."],
    };
  }

  const prepared = prepareWorkspaceMutation(input.artifacts, input.patches, input.creations);
  if (prepared.errors.length) {
    return {
      artifacts: input.artifacts,
      artifact: null,
      changedArtifactIds,
      isCreation: false,
      errors: prepared.errors,
    };
  }

  const requestedArtifact = input.requestedArtifactId
    ? prepared.nextArtifacts.find((artifact) => artifact.id === input.requestedArtifactId)
    : undefined;
  const artifact =
    requestedArtifact ??
    changedArtifactIds.flatMap((artifactId) => {
      const candidate = prepared.nextArtifacts.find((item) => item.id === artifactId);
      return candidate ? [candidate] : [];
    })[0] ??
    null;
  const creationIds = new Set(input.creations.map((creation) => creation.artifact.id));

  return {
    artifacts: prepared.nextArtifacts,
    artifact,
    changedArtifactIds,
    isCreation: Boolean(artifact && creationIds.has(artifact.id)),
    errors: artifact ? [] : ["The proposed workspace does not contain a previewable artifact."],
  };
}
