import {
  artifactCreationSourceOptions,
  prepareArtifactCreation,
  type ArtifactCreationInput,
  type CreatableArtifactKind,
} from "./artifact-creation.ts";
import { prepareChartEmbedding } from "./chart-embedding.ts";
import { isDeckMarkdownArtifact } from "./deck.ts";
import { prepareWorkspaceMutation, type ArtifactCreationChange } from "./patches.ts";
import { appendSemanticHtmlPresentationSlide, escapeSemanticHtml } from "./semantic-html-presentation.ts";
import { planLocalWorkspaceChange, type LocalWorkspacePlan, type WorkspaceArtifact } from "./workspace.ts";

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

function requestedAnalysisWorkflowTargets(prompt: string): Array<"document" | "slides"> {
  if (!/(?:新建|创建|生成|create|new|draft|build)/i.test(prompt)) return [];
  const asksForChart = /(?:图表|可视化|chart|graph|visuali[sz]ation)/i.test(prompt);
  const hasDataIntent = /(?:数据|分析|查询|sql|data|analysis|query)/i.test(prompt);
  if (!asksForChart || !hasDataIntent) return [];
  const targets: Array<"document" | "slides"> = [];
  if (/(?:文档|报告|简报|document|report|brief|memo)/i.test(prompt)) targets.push("document");
  if (/(?:演示|幻灯|deck|slides?|presentation)/i.test(prompt)) targets.push("slides");
  return targets;
}

function inlineCode(value: string) {
  return value.replaceAll("`", "'");
}

function csvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function contextualSource(artifact: WorkspaceArtifact, existing: WorkspaceArtifact[]) {
  const sourceList = existing
    .slice(0, 8)
    .map((item) => `- **${item.kind}:** \`${inlineCode(item.name)}\``)
    .join("\n");

  if (artifact.kind === "document") {
    return `${artifact.source}## Workspace context\n\n${sourceList}\n\n## Starting point\n\nSynthesize the canonical sources above into a review-ready brief.\n`;
  }
  if (artifact.kind === "data") {
    const rows = existing.slice(0, 48).map((item) => `${csvCell(item.name)},${csvCell(item.kind)}`);
    return `Artifact,Type\n${rows.join("\n")}\n`;
  }
  if (artifact.kind === "query" || artifact.kind === "chart") return artifact.source;
  if (!isDeckMarkdownArtifact(artifact)) {
    const items = existing
      .slice(0, 8)
      .map(
        (item) =>
          `<li><strong>${escapeSemanticHtml(item.kind)}</strong> · <code>${escapeSemanticHtml(item.name)}</code></li>`,
      )
      .join("");
    const context = appendSemanticHtmlPresentationSlide(
      artifact.source,
      `<section class="slide content" data-layout="content" data-eyebrow="Workspace context">
        <p class="eyebrow">Workspace context</p><div class="slide-body"><h2>Canonical source map</h2><ul>${items}</ul></div>
      </section>`,
    );
    if (!context.source) throw new Error(context.errors[0] ?? "Orbit could not append semantic HTML context.");
    const next = appendSemanticHtmlPresentationSlide(
      context.source,
      `<section class="slide conclusion" data-layout="conclusion" data-eyebrow="Next step">
        <p class="eyebrow">Next step</p><div class="slide-body"><h2>Review-ready starting point</h2><p>Use the canonical files above to refine this narrative without copying hidden state.</p></div>
      </section>`,
    );
    if (!next.source) throw new Error(next.errors[0] ?? "Orbit could not append the semantic HTML next step.");
    return next.source;
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

function chartCreationFields(source: ReturnType<typeof artifactCreationSourceOptions>[number], prompt: string) {
  const category = source.columns[0] ?? "";
  const value =
    source.numericColumns.find((column) => column !== category) ??
    source.columns.find((column) => column !== category) ??
    source.columns[0] ??
    "";
  const format = /(?:百分比|比例|percent|margin|rate)/i.test(prompt)
    ? ("percent" as const)
    : /(?:收入|营收|金额|销售|revenue|sales|currency|amount)/i.test(prompt)
      ? ("currency" as const)
      : ("number" as const);
  const mark = /(?:趋势|时间|折线|line|trend|timeline)/i.test(prompt) ? ("line" as const) : ("bar" as const);
  return { category, value, format, mark };
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
    const source =
      (prefersQuery ? sources.find((option) => option.kind === "query") : undefined) ??
      sources.find((option) => option.kind === "data") ??
      sources[0];
    if (!source) throw new Error("Pin or select one valid Data or Query source before creating a Chart.");
    const { category, value, format, mark } = chartCreationFields(source, prompt);
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

function planLocalAnalysisWorkflow(
  artifacts: WorkspaceArtifact[],
  contextArtifacts: WorkspaceArtifact[],
  targets: Array<"document" | "slides">,
  prompt: string,
): LocalWorkspaceAgentPlan {
  const dataSource = artifactCreationSourceOptions(contextArtifacts, "query")[0];
  if (!dataSource) throw new Error("Pin or select one valid Data source before creating an analysis workflow.");

  const queryPrepared = prepareArtifactCreation(artifacts, {
    kind: "query",
    title: "Workspace Analysis",
    sourceArtifactId: dataSource.artifactId,
  });
  if (!queryPrepared.artifact || queryPrepared.errors.length) {
    throw new Error(queryPrepared.errors[0] ?? "Orbit could not prepare the workflow Query.");
  }
  const query = queryPrepared.artifact;
  let workingArtifacts = [...artifacts, query];
  const queryOption = artifactCreationSourceOptions(workingArtifacts, "chart").find(
    (option) => option.artifactId === query.id,
  );
  if (!queryOption) throw new Error("The new Query does not expose a stable Chart schema.");
  const fields = chartCreationFields({ ...queryOption, numericColumns: dataSource.numericColumns }, prompt);
  const chartPrepared = prepareArtifactCreation(workingArtifacts, {
    kind: "chart",
    title: fields.mark === "bar" ? "Workspace Chart" : "Workspace Trend",
    sourceArtifactId: query.id,
    ...fields,
  });
  if (!chartPrepared.artifact || chartPrepared.errors.length) {
    throw new Error(chartPrepared.errors[0] ?? "Orbit could not prepare the workflow Chart.");
  }
  const chart = chartPrepared.artifact;
  workingArtifacts = [...workingArtifacts, chart];
  const creations: ArtifactCreationChange[] = [
    {
      artifact: query,
      summary: `Create ${query.name} from ${dataSource.name}`,
      detail: "The Query uses an exact Orbit-owned Data binding and remains readable DuckDB SQL.",
    },
    {
      artifact: chart,
      summary: `Create ${chart.name} from ${query.name}`,
      detail: "The Chart binds exact Query output fields and stays live instead of copying result values.",
    },
  ];

  targets.forEach((kind) => {
    const title = kind === "slides" ? "Workspace Briefing" : "Workspace Report";
    const prepared = prepareArtifactCreation(workingArtifacts, { kind, title });
    if (!prepared.artifact || prepared.errors.length) {
      throw new Error(prepared.errors[0] ?? `Orbit could not prepare the workflow ${kind}.`);
    }
    const contextual = {
      ...prepared.artifact,
      source: contextualSource(prepared.artifact, contextArtifacts),
    };
    const candidateArtifacts = [...workingArtifacts, contextual];
    const embedding = prepareChartEmbedding(candidateArtifacts, chart.id, contextual.id);
    if (!embedding.nextSource || embedding.errors.length) {
      throw new Error(embedding.errors[0] ?? `Orbit could not embed the Chart in ${contextual.name}.`);
    }
    const consumer = { ...contextual, source: embedding.nextSource };
    creations.push({
      artifact: consumer,
      summary: `Create ${consumer.name} with a live Chart binding`,
      detail: "The deliverable keeps one exact Chart reference so future Data and SQL changes recompile it.",
    });
    workingArtifacts = [...workingArtifacts, consumer];
  });

  const mutation = prepareWorkspaceMutation(artifacts, [], creations);
  if (mutation.errors.length) throw new Error(mutation.errors[0]);
  return {
    summary: `Create one source-bound analysis workflow across ${creations.length} files`,
    detail:
      "Orbit resolves every generated identity first, validates the complete dependency chain, and holds one atomic workspace transaction for review.",
    patches: [],
    creations,
  };
}

function planLocalCreation(
  artifacts: WorkspaceArtifact[],
  contextArtifacts: WorkspaceArtifact[],
  kind: CreatableArtifactKind,
  prompt: string,
): LocalWorkspaceAgentPlan {
  const title =
    kind === "slides"
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
    throw new Error(prepared.errors[0] ?? "Orbit could not prepare that artifact.");
  }
  const artifact = {
    ...prepared.artifact,
    source: contextualSource(prepared.artifact, contextArtifacts),
  };
  const creation: ArtifactCreationChange = {
    artifact,
    summary: `Create ${artifact.name} from workspace context`,
    detail: "Orbit generated the file identity and a deterministic starter source from visible canonical artifacts.",
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
  const instruction = prompt.trim();
  const workflowTargets = requestedAnalysisWorkflowTargets(instruction);
  if (workflowTargets.length) {
    return planLocalAnalysisWorkflow(artifacts, contextArtifacts, workflowTargets, instruction);
  }
  const kind = requestedCreationKind(instruction);
  if (kind) return planLocalCreation(artifacts, contextArtifacts, kind, prompt);
  return { ...planLocalWorkspaceChange(contextArtifacts, prompt), creations: [] };
}
