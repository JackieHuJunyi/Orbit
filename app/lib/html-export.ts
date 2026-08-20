import { DOMParser } from "@xmldom/xmldom";
import { compileArtifactSource } from "./bindings.ts";
import { renderChartReferencesToHtml, resolveChartModel, type ChartModel } from "./charts.ts";
import { compileDeckSource, isDeckMarkdownArtifact } from "./deck.ts";
import { safeExportBaseName, type ArtifactExportResult } from "./export-contract.ts";
import { compileLegacyHtmlSlides } from "./legacy-html-slides.ts";
import {
  extractRuneAssetIds,
  parseRuneAssetReference,
  renderRuneHtmlAssetReferences,
  runeImageAssetMap,
  runeImageDataUrl,
  type RuneExportImageAsset,
} from "./local-assets.ts";
import type { WorkspaceQuerySnapshot } from "./query-snapshot.ts";
import { parseDataSource, type WorkspaceArtifact } from "./workspace.ts";

export const MAX_STANDALONE_HTML_BYTES = 12 * 1024 * 1024;

const PORTABLE_EXPORT_HEAD = `<meta name="generator" content="Rune" />
<meta name="rune-export" content="standalone-deck-v1" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:" />
<style id="rune-portable-export">
  @page{size:13.333333in 7.5in;margin:0}
  @media print{html,body{background:#fff!important}.deck{display:block;padding:0}.slide{width:13.333333in;height:7.5in;max-width:none;break-after:page;page-break-after:always;border-radius:0;box-shadow:none}.slide:last-child{break-after:auto;page-break-after:auto}}
</style>`;

function withPortableExportHead(source: string) {
  if (/<\/head\s*>/iu.test(source)) return source.replace(/<\/head\s*>/iu, `${PORTABLE_EXPORT_HEAD}\n</head>`);
  if (/<html\b[^>]*>/iu.test(source))
    return source.replace(/<html\b[^>]*>/iu, (opening) => `${opening}<head>${PORTABLE_EXPORT_HEAD}</head>`);
  return `<!doctype html><html><head>${PORTABLE_EXPORT_HEAD}</head><body>${source}</body></html>`;
}

function hasUnsafePortableBoundary(source: string, approvedDataUrls: ReadonlySet<string>) {
  const document = new DOMParser().parseFromString(source, "text/html");
  const blockedElements = new Set([
    "script",
    "iframe",
    "object",
    "embed",
    "link",
    "form",
    "input",
    "button",
    "select",
    "textarea",
    "video",
    "audio",
    "source",
  ]);
  const elements = document.getElementsByTagName("*");
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements.item(index);
    if (!element) continue;
    const name = element.tagName.toLowerCase();
    if (blockedElements.has(name)) return true;
    if (name === "style" && /@import|url\s*\(/iu.test(element.textContent ?? "")) return true;
    for (let attributeIndex = 0; attributeIndex < element.attributes.length; attributeIndex += 1) {
      const attribute = element.attributes.item(attributeIndex);
      if (!attribute) continue;
      const attributeName = attribute.name.toLowerCase();
      if (attributeName.startsWith("on")) return true;
      if (attributeName === "style" && /@import|url\s*\(/iu.test(attribute.value)) return true;
      if (attributeName === "href" || (attributeName === "src" && !approvedDataUrls.has(attribute.value))) return true;
    }
  }
  return false;
}

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
    throw new Error(
      `Resolve ${compiled.unresolved.length} missing metric ${compiled.unresolved.length === 1 ? "reference" : "references"} before HTML export.`,
    );
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
    throw new Error(
      `Resolve ${compiled.unresolvedCharts.length} missing chart ${compiled.unresolvedCharts.length === 1 ? "reference" : "references"} before HTML export.`,
    );
  }
  const charts = new Map<string, ChartModel>();
  compiled.chartReferences.forEach((chartArtifactId) => {
    const chartArtifact = workspace.find((candidate) => candidate.id === chartArtifactId && candidate.kind === "chart");
    if (!chartArtifact) throw new Error(`Chart not found: ${chartArtifactId}`);
    const resolution = resolveChartModel(chartArtifact, workspace, parseDataSource, querySnapshots);
    if (!resolution.model)
      throw new Error(`Chart ${chartArtifactId}: ${resolution.errors[0] ?? "current data could not compile"}`);
    charts.set(chartArtifactId, resolution.model);
  });
  return { compiledSource: compiled.source, charts };
}

export function exportDeckHtml(
  artifact: WorkspaceArtifact,
  workspace: WorkspaceArtifact[],
  querySnapshots: WorkspaceQuerySnapshot[] = [],
  imageAssets: readonly RuneExportImageAsset[] = [],
): ArtifactExportResult<"html"> {
  if (artifact.kind !== "slides") throw new Error("Standalone HTML export requires a presentation artifact.");
  const deckArtifact = isDeckMarkdownArtifact(artifact);
  const { compiledSource, charts } = resolvedCharts(artifact, workspace, querySnapshots);
  const images = runeImageAssetMap(imageAssets);
  const referencedImageIds = extractRuneAssetIds(compiledSource);
  const missingImage = referencedImageIds.find((id) => !images.has(id));
  if (missingImage) throw new Error(`Referenced local image is missing or corrupt: ${missingImage}`);
  const unexpectedImage = imageAssets.find((asset) => !referencedImageIds.includes(asset.id));
  if (unexpectedImage) throw new Error(`Rune export image is not referenced by this Deck: ${unexpectedImage.id}`);
  const approvedDataUrls = new Set<string>();
  const resolveLocalAssetUrl = (reference: string) => {
    const id = parseRuneAssetReference(reference);
    const asset = id ? images.get(id) : null;
    if (!asset) return null;
    const url = runeImageDataUrl(asset);
    approvedDataUrls.add(url);
    return url;
  };
  let presentationHtml = "";
  if (deckArtifact) {
    const deck = compileDeckSource(compiledSource, { resolveLocalAssetUrl });
    if (!deck.html) throw new Error(deck.errors[0] ?? "The Deck Markdown source could not compile to HTML.");
    presentationHtml = deck.html;
  } else {
    const semantic = compileLegacyHtmlSlides(compiledSource);
    if (semantic.errors.length) throw new Error(semantic.errors[0]);
    presentationHtml = renderRuneHtmlAssetReferences(compiledSource, resolveLocalAssetUrl);
  }
  const rendered = withPortableExportHead(
    renderChartReferencesToHtml(presentationHtml, (chartArtifactId) => {
      const model = charts.get(chartArtifactId);
      return model ? { model, errors: [] } : { errors: [`Chart not found: ${chartArtifactId}`] };
    }),
  );
  if (/\{\{\s*(?:metric|chart)\(/i.test(rendered))
    throw new Error("The standalone HTML still contains an unresolved workspace binding.");
  if (hasUnsafePortableBoundary(rendered, approvedDataUrls)) {
    throw new Error("Rune refused to export HTML containing an executable or external resource boundary.");
  }
  const bytes = new TextEncoder().encode(rendered);
  if (bytes.length > MAX_STANDALONE_HTML_BYTES)
    throw new Error("The standalone HTML exceeds Rune's 12 MB export limit.");
  return {
    bytes,
    fileName: `${safeExportBaseName(artifact.name)}.html`,
    mimeType: "text/html;charset=utf-8",
    warnings: [
      `Standalone HTML preserves the current ${deckArtifact ? "Rune theme" : "semantic presentation source"}, local images, compiled metrics, and current-data charts in one scriptless file.`,
      "Live workspace bindings, Agent controls, checkpoints, and editing UI are not included in the exported HTML.",
      "Print styles create one 16:9 page per slide when a browser prints or saves the file as PDF.",
    ],
    targetType: "html",
  };
}
