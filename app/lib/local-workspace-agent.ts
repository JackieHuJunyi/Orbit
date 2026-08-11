import {
  artifactCreationSourceOptions,
  prepareArtifactCreation,
  type ArtifactCreationInput,
  type CreatableArtifactKind,
} from "./artifact-creation.ts";
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
  if (/(?:图表|可视化|chart|graph|visuali[sz]ation)/i.test(prompt)) return "chart";
  if (/(?:查询|分析|sql|query|analysis)/i.test(prompt)) return "query";
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
  if (artifact.kind === "query" || artifact.kind === "chart") return artifact.source;
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

function localCreationInput(
  kind: CreatableArtifactKind,
  title: string,
  contextArtifacts: WorkspaceArtifact[],
  prompt: string,
): ArtifactCreationInput {
  if (kind === "query") {
    const source = artifactCreationSourceOptions(contextArtifacts, "query")[0];
    if (!source) throw new Error("Pin or select one valid Data source before creating a Query.");
    return { kind, title, sourceArtifactId: source.artifactId };
  }
  if (kind === "chart") {
    const sources = artifactCreationSourceOptions(contextArtifacts, "chart");
    const prefersQuery = /(?:查询|分析|sql|query|analysis)/i.test(prompt);
    const source = (prefersQuery ? sources.find((option) => option.kind === "query") : undefined)
      ?? sources.find((option) => option.kind === "data")
      ?? sources[0];
    if (!source) throw new Error("Pin or select one valid Data or Query source before creating a Chart.");
    const category = source.columns[0] ?? "";
    const value = source.numericColumns.find((column) => column !== category)
      ?? source.columns.find((column) => column !== category)
      ?? source.columns[0]
      ?? "";
    const format = /(?:百分比|比例|percent|margin|rate)/i.test(prompt)
      ? "percent"
      : /(?:收入|营收|金额|销售|revenue|sales|currency|amount)/i.test(prompt)
        ? "currency"
        : "number";
    const mark = /(?:趋势|时间|折线|line|trend|timeline)/i.test(prompt) ? "line" : "bar";
    return {
      kind,
      title,
      sourceArtifactId: source.artifactId,
      category,
      value,
      mark,
      format,
    };
  }
  return { kind, title };
}

function planLocalCreation(
  artifacts: WorkspaceArtifact[],
  contextArtifacts: WorkspaceArtifact[],
  kind: CreatableArtifactKind,
  prompt: string,
): LocalWorkspaceAgentPlan {
  const title = kind === "slides"
    ? "Workspace Briefing"
    : kind === "data"
      ? "Workspace Index"
      : kind === "query"
        ? "Workspace Analysis"
        : kind === "chart"
          ? "Workspace Chart"
      : "Workspace Brief";
  const input = localCreationInput(kind, title, contextArtifacts, prompt);
  const prepared = prepareArtifactCreation(artifacts, input);
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
    summary: `Create a new ${kind === "slides" ? "presentation" : kind === "data" ? "data table" : kind === "query" ? "Query" : kind === "chart" ? "Chart" : "document"}`,
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
  if (kind) return planLocalCreation(artifacts, contextArtifacts, kind, prompt);
  return { ...planLocalWorkspaceChange(contextArtifacts, prompt), creations: [] };
}
