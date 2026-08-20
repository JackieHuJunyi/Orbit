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

export type WorkspaceProposalChange = {
  baseRevision: WorkspaceSourceRevision;
  patches: ArtifactSourcePatch[];
  creations: ArtifactCreationChange[];
};

export type WorkspaceProposalSurface = {
  proposalPreview: WorkspaceProposalPreview | null;
  proposalArtifact: WorkspaceArtifact | null;
  proposalReviewActive: boolean;
  proposalPreviewActive: boolean;
  presentedArtifact: WorkspaceArtifact | null;
  presentedArtifacts: WorkspaceArtifact[];
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

/**
 * Derives the single candidate snapshot consumed by both Source and Preview.
 * Invalid or absent proposals fall back to the unchanged canonical workspace;
 * review state remains explicit so the UI can fail closed without divergence.
 */
export function prepareWorkspaceProposalSurface(input: {
  artifacts: WorkspaceArtifact[];
  selectedArtifact?: WorkspaceArtifact | null;
  proposal?: WorkspaceProposalChange | null;
  requestedArtifactId?: string;
}): WorkspaceProposalSurface {
  const proposalPreview = input.proposal
    ? prepareWorkspaceProposalPreview({
        artifacts: input.artifacts,
        ...input.proposal,
        requestedArtifactId: input.requestedArtifactId,
      })
    : null;
  const proposalArtifact = proposalPreview?.artifact ?? null;
  const proposalReviewActive = Boolean(input.proposal);
  const proposalPreviewActive = Boolean(proposalArtifact);

  return {
    proposalPreview,
    proposalArtifact,
    proposalReviewActive,
    proposalPreviewActive,
    presentedArtifact: proposalArtifact ?? input.selectedArtifact ?? null,
    presentedArtifacts: proposalPreviewActive ? (proposalPreview?.artifacts ?? input.artifacts) : input.artifacts,
  };
}
