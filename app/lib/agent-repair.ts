import { z } from "zod";
import { MAX_WORKSPACE_AGENT_ARTIFACT_CHARS } from "./dependency-graph.ts";
import type { ArtifactCreationChange, ArtifactSourcePatch } from "./patches.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export const MAX_AGENT_RUNTIME_REPAIR_ARTIFACTS = 4;
export const MAX_AGENT_RUNTIME_REPAIR_ERROR_CHARS = 1_000;

export const AgentRuntimeRepairProposedArtifactSchema = z.object({
  artifactId: z.string().min(1).max(120),
  name: z.string().min(1).max(240),
  kind: z.enum(["document", "data", "query", "chart", "slides"]),
  language: z.string().min(1).max(80),
  proposedSource: z.string().min(1).max(MAX_WORKSPACE_AGENT_ARTIFACT_CHARS),
  isCreation: z.boolean(),
}).strict();

export const AgentRuntimeRepairSchema = z.object({
  attempt: z.literal(1),
  failure: z.string().trim().min(1).max(MAX_AGENT_RUNTIME_REPAIR_ERROR_CHARS),
  proposedArtifacts: z.array(AgentRuntimeRepairProposedArtifactSchema)
    .min(1)
    .max(MAX_AGENT_RUNTIME_REPAIR_ARTIFACTS),
}).strict().superRefine((repair, context) => {
  if (new Set(repair.proposedArtifacts.map((artifact) => artifact.artifactId)).size
    !== repair.proposedArtifacts.length) {
    context.addIssue({ code: "custom", message: "Runtime repair artifact ids must be unique." });
  }
  if (!repair.proposedArtifacts.some((artifact) => ["data", "query", "chart"].includes(artifact.kind))) {
    context.addIssue({ code: "custom", message: "Runtime repair requires a proposed Data, Query, or Chart source." });
  }
});

export type AgentRuntimeRepair = z.infer<typeof AgentRuntimeRepairSchema>;

function boundedFailure(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "The first proposed runtime impact could not be verified.";
  const bounded = message
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_AGENT_RUNTIME_REPAIR_ERROR_CHARS);
  return bounded || "The first proposed runtime impact could not be verified.";
}

export function buildAgentRuntimeRepair(
  currentArtifacts: WorkspaceArtifact[],
  patches: ArtifactSourcePatch[],
  creations: ArtifactCreationChange[],
  error: unknown,
): AgentRuntimeRepair {
  const currentById = new Map(currentArtifacts.map((artifact) => [artifact.id, artifact] as const));
  const proposedArtifacts = [
    ...patches.map((patch) => {
      const artifact = currentById.get(patch.artifactId);
      if (!artifact) throw new Error(`Cannot build runtime repair feedback for unknown artifact: ${patch.artifactId}`);
      return {
        artifactId: artifact.id,
        name: artifact.name,
        kind: artifact.kind,
        language: artifact.language,
        proposedSource: patch.nextSource,
        isCreation: false,
      };
    }),
    ...creations.map(({ artifact }) => ({
      artifactId: artifact.id,
      name: artifact.name,
      kind: artifact.kind,
      language: artifact.language,
      proposedSource: artifact.source,
      isCreation: true,
    })),
  ];
  return AgentRuntimeRepairSchema.parse({
    attempt: 1,
    failure: boundedFailure(error),
    proposedArtifacts,
  });
}
