import { parseChartSource, type ChartSpec } from "./charts.ts";
import {
  derivePreviewSourceTargets,
  type PreviewSourceTarget,
} from "./preview-targets.ts";
import { resolveQueryDataArtifact } from "./query-source.ts";
import {
  MAX_AGENT_SELECTION_CHARS,
  sourceOutsideSelectionIsUnchanged,
} from "./source-selection.ts";
import { inferQueryOutputColumns, validateReadQuery } from "./sql.ts";
import { parseDataSource, type WorkspaceArtifact } from "./workspace.ts";

export const MAX_VISUAL_CHART_SOURCE_CHARS = MAX_AGENT_SELECTION_CHARS;

export type VisualChartSpecEditInput = Pick<
  ChartSpec,
  "title" | "description" | "mark" | "category" | "value" | "sort" | "format" | "color" | "maxItems"
>;

export type PreparedVisualChartSpecEdit = {
  nextSource: string;
  nextTarget: PreviewSourceTarget | null;
  errors: string[];
};

export type VisualChartSpecDraftProjection = {
  nextSource: string;
  start: number;
  end: number;
  errors: string[];
};

export type VisualChartSourceFields = {
  sourceName: string;
  columns: string[];
  errors: string[];
};

function emptyResult(source: string, error: string): PreparedVisualChartSpecEdit {
  return { nextSource: source, nextTarget: null, errors: [error] };
}

function currentTargetForRevision(
  artifact: WorkspaceArtifact,
  requested: PreviewSourceTarget,
) {
  return derivePreviewSourceTargets(artifact).find((target) => (
    target.kind === "chart-spec"
    && requested.kind === "chart-spec"
    && target.id === requested.id
    && target.index === requested.index
    && target.label === requested.label
    && target.start === requested.start
    && target.end === requested.end
  ));
}

function specForInput(
  artifact: WorkspaceArtifact,
  input: VisualChartSpecEditInput,
) {
  const current = parseChartSource(artifact.source);
  if (!current.spec) return { errors: current.errors };
  const source = JSON.stringify({
    version: 1,
    title: input.title,
    description: input.description,
    source: current.spec.source,
    mark: input.mark,
    category: input.category,
    value: input.value,
    sort: input.sort,
    format: input.format,
    color: typeof input.color === "string" ? input.color.toLowerCase() : input.color,
    maxItems: input.maxItems,
  });
  return parseChartSource(source);
}

function sourceForInput(
  artifact: WorkspaceArtifact,
  input: VisualChartSpecEditInput,
) {
  const current = parseChartSource(artifact.source).spec;
  if (!current) return artifact.source;
  return `${JSON.stringify({
    version: 1,
    title: input.title,
    description: input.description,
    source: current.source,
    mark: input.mark,
    category: input.category,
    value: input.value,
    sort: input.sort,
    format: input.format,
    color: typeof input.color === "string" ? input.color.toLowerCase() : input.color,
    maxItems: input.maxItems,
  }, null, 2)}${artifact.source.endsWith("\n") ? "\n" : ""}`;
}

function serializeSpec(spec: ChartSpec, trailingNewline: boolean) {
  return `${JSON.stringify(spec, null, 2)}${trailingNewline ? "\n" : ""}`;
}

export function visualChartSpecDraft(
  artifact: WorkspaceArtifact,
): VisualChartSpecEditInput | null {
  const spec = parseChartSource(artifact.source).spec;
  if (!spec || artifact.kind !== "chart") return null;
  return {
    title: spec.title,
    description: spec.description,
    mark: spec.mark,
    category: spec.category,
    value: spec.value,
    sort: spec.sort,
    format: spec.format,
    color: spec.color,
    maxItems: spec.maxItems,
  };
}

export function visualChartSpecPreviewSource(
  artifact: WorkspaceArtifact,
  input: VisualChartSpecEditInput,
) {
  const parsed = specForInput(artifact, input);
  return parsed.spec
    ? { source: serializeSpec(parsed.spec, artifact.source.endsWith("\n")), errors: [] }
    : { source: "", errors: parsed.errors };
}

export function visualChartSourceFields(
  artifacts: WorkspaceArtifact[],
  sourceId: string,
): VisualChartSourceFields {
  const source = artifacts.find((artifact) => artifact.id === sourceId);
  if (!source || (source.kind !== "data" && source.kind !== "query")) {
    return { sourceName: sourceId, columns: [], errors: [`Chart source not found: ${sourceId}`] };
  }
  if (source.kind === "data") {
    const parsed = parseDataSource(source.source);
    return parsed.errors.length
      ? { sourceName: source.name, columns: [], errors: parsed.errors }
      : { sourceName: source.name, columns: parsed.columns, errors: [] };
  }
  const queryErrors = validateReadQuery(source.source);
  if (queryErrors.length) return { sourceName: source.name, columns: [], errors: queryErrors };
  const dataResolution = resolveQueryDataArtifact(source, artifacts);
  if (!dataResolution.artifact) return { sourceName: source.name, columns: [], errors: dataResolution.errors };
  const data = parseDataSource(dataResolution.artifact.source);
  if (data.errors.length) return { sourceName: source.name, columns: [], errors: data.errors };
  const output = inferQueryOutputColumns(source.source, data.columns);
  return output.errors.length
    ? { sourceName: source.name, columns: [], errors: output.errors }
    : { sourceName: source.name, columns: output.columns, errors: [] };
}

export function canVisualEditChartSpec(
  artifact: WorkspaceArtifact,
  target: PreviewSourceTarget,
) {
  if (artifact.kind !== "chart" || artifact.language !== "Chart JSON" || target.kind !== "chart-spec") return false;
  const current = currentTargetForRevision(artifact, target);
  return Boolean(current && current.end - current.start <= MAX_VISUAL_CHART_SOURCE_CHARS);
}

export function projectVisualChartSpecDraft(
  artifact: WorkspaceArtifact,
  requestedTarget: PreviewSourceTarget,
  input: VisualChartSpecEditInput,
): VisualChartSpecDraftProjection {
  const target = artifact.kind === "chart"
    ? currentTargetForRevision(artifact, requestedTarget)
    : undefined;
  if (!target) {
    return {
      nextSource: artifact.source,
      start: requestedTarget.start,
      end: requestedTarget.end,
      errors: ["The Chart properties no longer match the current source revision."],
    };
  }
  const preview = visualChartSpecPreviewSource(artifact, input);
  const prepared = prepareVisualChartSpecEdit(artifact, target, input);
  const nextSource = preview.source || sourceForInput(artifact, input);
  return {
    nextSource,
    start: 0,
    end: nextSource.length,
    errors: [...new Set([
      ...preview.errors,
      ...prepared.errors.filter((error) => !/unchanged\.?$/iu.test(error)),
    ])],
  };
}

export function prepareVisualChartSpecEdit(
  artifact: WorkspaceArtifact,
  requestedTarget: PreviewSourceTarget,
  input: VisualChartSpecEditInput,
): PreparedVisualChartSpecEdit {
  if (artifact.kind !== "chart" || artifact.language !== "Chart JSON") {
    return emptyResult(artifact.source, "Visual Chart editing requires a Chart JSON artifact.");
  }
  const target = currentTargetForRevision(artifact, requestedTarget);
  if (!target) return emptyResult(artifact.source, "The Chart properties no longer match the current source revision.");
  if (target.end - target.start > MAX_VISUAL_CHART_SOURCE_CHARS) {
    return emptyResult(
      artifact.source,
      `Visual Chart source is limited to ${MAX_VISUAL_CHART_SOURCE_CHARS.toLocaleString("en-US")} characters.`,
    );
  }
  const current = parseChartSource(artifact.source);
  if (!current.spec) return emptyResult(artifact.source, current.errors[0] ?? "The current Chart JSON is invalid.");
  const parsed = specForInput(artifact, input);
  if (!parsed.spec) return emptyResult(artifact.source, parsed.errors[0] ?? "The edited Chart properties are invalid.");
  if (JSON.stringify(parsed.spec) === JSON.stringify(current.spec)) {
    return emptyResult(artifact.source, "The edited Chart properties are unchanged.");
  }

  const nextSource = serializeSpec(parsed.spec, artifact.source.endsWith("\n"));
  if (!sourceOutsideSelectionIsUnchanged(artifact.source, nextSource, target)) {
    return emptyResult(artifact.source, "The visual edit crossed the complete Chart JSON boundary.");
  }
  const nextArtifact = { ...artifact, source: nextSource };
  const nextTarget = derivePreviewSourceTargets(nextArtifact).find((candidate) => (
    candidate.kind === "chart-spec"
    && candidate.index === 0
    && candidate.start === 0
    && candidate.end === nextSource.length
  )) ?? null;
  if (!nextTarget) return emptyResult(artifact.source, "Rune could not prove the edited Chart JSON source range.");
  return { nextSource, nextTarget, errors: [] };
}
