import { findChartReferences, formatChartReference, parseChartSource } from "./charts.ts";
import { isDeckMarkdownArtifact } from "./deck.ts";
import { appendSemanticHtmlPresentationSlide, escapeSemanticHtml } from "./semantic-html-presentation.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export type ChartEmbeddingTarget = Pick<WorkspaceArtifact, "id" | "name" | "kind" | "language">;

export type PreparedChartEmbedding = {
  artifactId?: string;
  nextSource?: string;
  errors: string[];
};

export function chartEmbeddingTargets(artifacts: WorkspaceArtifact[]): ChartEmbeddingTarget[] {
  return artifacts
    .filter((artifact) => artifact.kind === "document" || artifact.kind === "slides")
    .map(({ id, name, kind, language }) => ({ id, name, kind, language }));
}

export function prepareChartEmbedding(
  artifacts: WorkspaceArtifact[],
  chartArtifactId: string,
  targetArtifactId: string,
): PreparedChartEmbedding {
  const chart = artifacts.find((artifact) => artifact.id === chartArtifactId);
  if (!chart || chart.kind !== "chart") return { errors: [`Chart not found: ${chartArtifactId}`] };
  const parsed = parseChartSource(chart.source);
  if (!parsed.spec) return { errors: parsed.errors };
  const target = artifacts.find((artifact) => artifact.id === targetArtifactId);
  if (!target) return { errors: [`Embed target not found: ${targetArtifactId}`] };
  if (target.kind !== "document" && target.kind !== "slides") {
    return { errors: ["Charts can be embedded only in Markdown documents or semantic presentations."] };
  }
  if (findChartReferences(target.source).includes(chart.id)) {
    return { errors: [`${target.name} already embeds ${chart.name}.`] };
  }

  const title = parsed.spec.title.replace(/\s+/gu, " ").trim();
  const reference = formatChartReference(chart.id);
  if (target.kind === "document") {
    return {
      artifactId: target.id,
      nextSource: `${target.source.trimEnd()}\n\n## ${title}\n\n${reference}\n`,
      errors: [],
    };
  }
  if (isDeckMarkdownArtifact(target)) {
    return {
      artifactId: target.id,
      nextSource: `${target.source.trimEnd()}\n\n---\n\n<!-- layout: split -->\n\n# ${title}\n\n${reference}\n`,
      errors: [],
    };
  }
  const appended = appendSemanticHtmlPresentationSlide(
    target.source,
    `<section class="slide split" data-layout="split"><div class="slide-body"><h2>${escapeSemanticHtml(title)}</h2><div class="chart-slot">${reference}</div></div></section>`,
  );
  return appended.source
    ? { artifactId: target.id, nextSource: appended.source, errors: [] }
    : { errors: [...appended.errors] };
}
