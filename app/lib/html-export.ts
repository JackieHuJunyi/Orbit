import { compileArtifactSource } from "./bindings.ts";
import { renderChartReferencesToHtml, resolveChartModel, type ChartModel } from "./charts.ts";
import { compileDeckSource, isDeckMarkdownArtifact } from "./deck.ts";
import { safeExportBaseName, type ArtifactExportResult } from "./export-contract.ts";
import type { WorkspaceQuerySnapshot } from "./query-snapshot.ts";
import { parseDataSource, type WorkspaceArtifact } from "./workspace.ts";

export const MAX_STANDALONE_HTML_BYTES = 2 * 1024 * 1024;

const PORTABLE_EXPORT_HEAD = `<meta name="generator" content="Rune" />
<meta name="rune-export" content="standalone-deck-v1" />
<style id="rune-portable-export">
  @page{size:13.333333in 7.5in;margin:0}
  @media print{html,body{background:#fff!important}.deck{display:block;padding:0}.slide{width:13.333333in;height:7.5in;max-width:none;break-after:page;page-break-after:always;border-radius:0;box-shadow:none}.slide:last-child{break-after:auto;page-break-after:auto}}
</style>`;

function resolvedCharts(
  artifact: WorkspaceArtifact,
  workspace: WorkspaceArtifact[],
  querySnapshots: WorkspaceQuerySnapshot[],
) {
  const compiled = compileArtifactSource(artifact.source, workspace, querySnapshots);
  if (compiled.metricBindingErrors.length) {
    throw new Error(`Fix the metric binding before HTML export: ${compiled.metricBindingErrors[0]}`);
  }
  if (compiled.unresolved.length) {
    throw new Error(`Resolve ${compiled.unresolved.length} missing metric ${compiled.unresolved.length === 1 ? "reference" : "references"} before HTML export.`);
  }
  if (compiled.unresolvedQueryMetrics.length) {
    throw new Error(`Resolve the Query metric before HTML export: ${compiled.unresolvedQueryMetrics[0]}`);
  }
  if (compiled.pendingQueryMetrics.length) {
    throw new Error(`Run ${compiled.pendingQueryMetrics[0]} before HTML export.`);
  }
  if (compiled.queryMetricRuntimeErrors.length) {
    throw new Error(`Query metric unavailable: ${compiled.queryMetricRuntimeErrors[0]}`);
  }
  if (compiled.unresolvedCharts.length) {
    throw new Error(`Resolve ${compiled.unresolvedCharts.length} missing chart ${compiled.unresolvedCharts.length === 1 ? "reference" : "references"} before HTML export.`);
  }
  const charts = new Map<string, ChartModel>();
  compiled.chartReferences.forEach((chartArtifactId) => {
    const chartArtifact = workspace.find((candidate) => candidate.id === chartArtifactId && candidate.kind === "chart");
    if (!chartArtifact) throw new Error(`Chart not found: ${chartArtifactId}`);
    const resolution = resolveChartModel(chartArtifact, workspace, parseDataSource, querySnapshots);
    if (!resolution.model) throw new Error(`Chart ${chartArtifactId}: ${resolution.errors[0] ?? "current data could not compile"}`);
    charts.set(chartArtifactId, resolution.model);
  });
  return { compiledSource: compiled.source, charts };
}

export function exportDeckHtml(
  artifact: WorkspaceArtifact,
  workspace: WorkspaceArtifact[],
  querySnapshots: WorkspaceQuerySnapshot[] = [],
): ArtifactExportResult<"html"> {
  if (artifact.kind !== "slides" || !isDeckMarkdownArtifact(artifact)) {
    throw new Error("Standalone HTML export supports Deck Markdown presentations.");
  }
  const { compiledSource, charts } = resolvedCharts(artifact, workspace, querySnapshots);
  const deck = compileDeckSource(compiledSource);
  if (!deck.html) throw new Error(deck.errors[0] ?? "The Deck Markdown source could not compile to HTML.");
  const rendered = renderChartReferencesToHtml(deck.html, (chartArtifactId) => {
    const model = charts.get(chartArtifactId);
    return model ? { model, errors: [] } : { errors: [`Chart not found: ${chartArtifactId}`] };
  }).replace("</head>", `${PORTABLE_EXPORT_HEAD}\n</head>`);
  if (/\{\{\s*(?:metric|chart)\(/i.test(rendered)) throw new Error("The standalone HTML still contains an unresolved workspace binding.");
  if (/<script\b|<(?:iframe|object|embed|link)\b|<[a-z][^>]*\s(?:src|href)\s*=/i.test(rendered)) {
    throw new Error("Rune refused to export HTML containing an executable or external resource boundary.");
  }
  const bytes = new TextEncoder().encode(rendered);
  if (bytes.length > MAX_STANDALONE_HTML_BYTES) throw new Error("The standalone HTML exceeds Rune's 2 MB export limit.");
  return {
    bytes,
    fileName: `${safeExportBaseName(artifact.name)}.html`,
    mimeType: "text/html;charset=utf-8",
    warnings: [
      "Standalone HTML preserves the current Rune theme, compiled metrics, and current-data charts in one scriptless file.",
      "Live workspace bindings, Agent controls, checkpoints, and editing UI are not included in the exported HTML.",
      "Print styles create one 16:9 page per slide when a browser prints or saves the file as PDF.",
    ],
    targetType: "html",
  };
}
