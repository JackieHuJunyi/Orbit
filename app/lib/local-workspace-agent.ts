import { prepareArtifactCreation, type CreatableArtifactKind } from "./artifact-creation.ts";
import {
  prepareWorkspaceMutation,
  type ArtifactCreationChange,
} from "./patches.ts";
import {
  planLocalWorkspaceChange,
  type LocalWorkspacePlan,
  type WorkspaceArtifact,
} from "./workspace.ts";

export type LocalWorkspaceAgentPlan = LocalWorkspacePlan & {
  creations: ArtifactCreationChange[];
};

function requestedCreationKind(prompt: string): CreatableArtifactKind | null {
  if (!/(?:新建|创建|生成|create|new|draft|build)/i.test(prompt)) return null;
  if (/(?:演示|幻灯|deck|slides?|presentation)/i.test(prompt)) return "slides";
  if (/(?:表格|数据|csv|data|table)/i.test(prompt)) return "data";
  if (/(?:文档|报告|简报|document|report|brief|memo)/i.test(prompt)) return "document";
  return null;
}

function inlineCode(value: string) {
  return value.replaceAll("`", "'");
}

function csvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function contextualSource(artifact: WorkspaceArtifact, existing: WorkspaceArtifact[]) {
  const sourceList = existing.slice(0, 8).map((item) => (
    `- **${item.kind}:** \`${inlineCode(item.name)}\``
  )).join("\n");

  if (artifact.kind === "document") {
    return `${artifact.source}## Workspace context\n\n${sourceList}\n\n## Starting point\n\nSynthesize the canonical sources above into a review-ready brief.\n`;
  }
  if (artifact.kind === "data") {
    const rows = existing.slice(0, 48).map((item) => `${csvCell(item.name)},${csvCell(item.kind)}`);
    return `Artifact,Type\n${rows.join("\n")}\n`;
  }
  return `${artifact.source.trimEnd()}

---

<!-- eyebrow: Workspace context -->

## Canonical source map

${sourceList}

---

<!-- eyebrow: Next step -->

## Review-ready starting point

Use the canonical files above to refine this narrative without copying hidden state.
`;
}

function planLocalCreation(
  artifacts: WorkspaceArtifact[],
  contextArtifacts: WorkspaceArtifact[],
  kind: CreatableArtifactKind,
): LocalWorkspaceAgentPlan {
  const title = kind === "slides"
    ? "Workspace Briefing"
    : kind === "data"
      ? "Workspace Index"
      : "Workspace Brief";
  const prepared = prepareArtifactCreation(artifacts, { kind, title });
  if (!prepared.artifact || prepared.errors.length) {
    throw new Error(prepared.errors[0] ?? "Rune could not prepare that artifact.");
  }
  const artifact = {
    ...prepared.artifact,
    source: contextualSource(prepared.artifact, contextArtifacts),
  };
  const creation: ArtifactCreationChange = {
    artifact,
    summary: `Create ${artifact.name} from workspace context`,
    detail: "Rune generated the file identity and a deterministic starter source from visible canonical artifacts.",
  };
  const mutation = prepareWorkspaceMutation(artifacts, [], [creation]);
  if (mutation.errors.length) throw new Error(mutation.errors[0]);
  return {
    summary: `Create a new ${kind === "slides" ? "presentation" : kind === "data" ? "data table" : "document"}`,
    detail: "The new source is reviewed as a concrete diff, then added with one atomic workspace write.",
    patches: [],
    creations: [creation],
  };
}

export function planLocalWorkspaceAgentChange(
  artifacts: WorkspaceArtifact[],
  prompt: string,
  contextArtifacts = artifacts,
): LocalWorkspaceAgentPlan {
  const kind = requestedCreationKind(prompt.trim());
  if (kind) return planLocalCreation(artifacts, contextArtifacts, kind);
  return { ...planLocalWorkspaceChange(contextArtifacts, prompt), creations: [] };
}
