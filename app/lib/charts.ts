import { z } from "zod";
import { inferQueryOutputColumns, validateReadQuery } from "./sql.ts";
import { workspaceQuerySnapshotIsCurrent, type WorkspaceQuerySnapshot } from "./query-snapshot.ts";
import { resolveQueryDataArtifact } from "./query-source.ts";
import { formatCompactCurrency, formatCompactNumber, formatFixedPercent } from "./number-format.ts";

export const ChartSpecSchema = z
  .object({
    version: z.literal(1),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(240).default(""),
    source: z.string().trim().min(1).max(120),
    mark: z.enum(["bar", "line", "area"]),
    category: z.string().trim().min(1).max(120),
    value: z.string().trim().min(1).max(120),
    sort: z.enum(["source", "ascending", "descending"]).default("descending"),
    format: z.enum(["currency", "number", "percent"]).default("number"),
    color: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i, "Use a six-digit hex color.")
      .default("#ff5c35"),
    maxItems: z.number().int().min(1).max(20).default(8),
  })
  .strict();

export type ChartSpec = z.infer<typeof ChartSpecSchema>;

export type ChartArtifactLike = {
  id: string;
  name: string;
  kind: string;
  source: string;
};

export type ParsedChartData = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  errors: string[];
};

export type ChartDatum = {
  label: string;
  value: number;
  formatted: string;
  ratio: number;
  position: number;
  sourceRowIndex: number;
  categoryProvenance: ChartCellProvenance | null;
  valueProvenance: ChartCellProvenance | null;
};

export type ChartCellProvenance = {
  artifactId: string;
  sourceRowIndex: number;
  sourceColumn: string;
};

export type ChartModel = {
  chartArtifactId: string;
  sourceArtifactId: string;
  sourceArtifactName: string;
  sourceArtifactKind: "data" | "query";
  spec: ChartSpec;
  data: ChartDatum[];
};

export type ChartResolution = {
  model?: ChartModel;
  errors: string[];
};

export type ChartLinePoint = {
  datum: ChartDatum;
  x: number;
  y: number;
};

export type ChartSourcePart =
  | { type: "source"; value: string; start: number; end: number }
  | { type: "chart"; value: string; start: number; end: number };

function chartReferencePattern() {
  return /\{\{\s*chart\(["']([\p{L}\p{N}_.-]+)["']\)\s*\}\}/giu;
}

export function formatChartReference(artifactId: string) {
  if (!/^[\p{L}\p{N}_.-]+$/u.test(artifactId)) {
    throw new Error("A Chart binding id may contain only letters, numbers, dots, underscores, or hyphens.");
  }
  return `{{ chart(${JSON.stringify(artifactId)}) }}`;
}

export function parseChartSource(source: string): { spec?: ChartSpec; errors: string[] } {
  if (!source.trim()) return { errors: ["Add a JSON chart specification."] };
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    return { errors: [error instanceof Error ? `Invalid chart JSON: ${error.message}` : "Invalid chart JSON."] };
  }
  const parsed = ChartSpecSchema.safeParse(value);
  if (!parsed.success) {
    return {
      errors: parsed.error.issues.map((issue) => {
        const location = issue.path.length ? `${issue.path.join(".")}: ` : "";
        return `${location}${issue.message}`;
      }),
    };
  }
  return { spec: parsed.data, errors: [] };
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.replace(/[$,%\s]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function formatChartValue(value: number, format: ChartSpec["format"]) {
  if (format === "currency") return formatCompactCurrency(value);
  if (format === "percent") return formatFixedPercent(value);
  return formatCompactNumber(value);
}

export function resolveChartModel(
  chartArtifact: ChartArtifactLike,
  artifacts: ChartArtifactLike[],
  parseData: (source: string) => ParsedChartData,
  querySnapshots: WorkspaceQuerySnapshot[] = [],
): ChartResolution {
  const parsedSpec = parseChartSource(chartArtifact.source);
  if (!parsedSpec.spec) return { errors: parsedSpec.errors };
  const spec = parsedSpec.spec;
  const sourceArtifact = artifacts.find((artifact) => artifact.id === spec.source);
  if (!sourceArtifact || (sourceArtifact.kind !== "data" && sourceArtifact.kind !== "query")) {
    return { errors: [`Chart source not found: ${spec.source}`] };
  }

  let columns: string[];
  let rows: unknown[][];
  let provenanceFor: (rowIndex: number, columnIndex: number, column: string) => ChartCellProvenance | null;
  if (sourceArtifact.kind === "data") {
    const parsedData = parseData(sourceArtifact.source);
    if (parsedData.errors.length) return { errors: parsedData.errors.map((error) => `Data source: ${error}`) };
    columns = parsedData.columns;
    rows = parsedData.rows.map((row) => columns.map((column) => row[column]));
    provenanceFor = (rowIndex, _columnIndex, column) => ({
      artifactId: sourceArtifact.id,
      sourceRowIndex: rowIndex,
      sourceColumn: column,
    });
  } else {
    const dataResolution = resolveQueryDataArtifact(sourceArtifact, artifacts);
    if (!dataResolution.artifact) return { errors: dataResolution.errors };
    const canonicalData = dataResolution.artifact;
    const snapshot = querySnapshots.find((candidate) => candidate.queryArtifactId === sourceArtifact.id);
    if (!snapshot) return { errors: [`Query source is still running: ${sourceArtifact.id}`] };
    if (!workspaceQuerySnapshotIsCurrent(snapshot, sourceArtifact, canonicalData)) {
      return { errors: [`Query source result is stale: ${sourceArtifact.id}`] };
    }
    if (snapshot.result.truncated) {
      return { errors: [`Query source exceeds 500 rows; narrow ${sourceArtifact.name} before charting it.`] };
    }
    columns = snapshot.result.columns;
    rows = snapshot.result.rows;
    provenanceFor = (rowIndex, columnIndex) => {
      const lineage = snapshot.result.cellLineage[rowIndex]?.[columnIndex];
      return lineage
        ? {
            artifactId: snapshot.dataArtifactId,
            sourceRowIndex: lineage.sourceRowIndex,
            sourceColumn: lineage.sourceColumn,
          }
        : null;
    };
  }

  const errors: string[] = [];
  const categoryIndices = columns.flatMap((column, index) => (column === spec.category ? [index] : []));
  const valueIndices = columns.flatMap((column, index) => (column === spec.value ? [index] : []));
  if (!categoryIndices.length) errors.push(`Category column not found: ${spec.category}`);
  if (categoryIndices.length > 1) errors.push(`Category column is ambiguous: ${spec.category}`);
  if (!valueIndices.length) errors.push(`Value column not found: ${spec.value}`);
  if (valueIndices.length > 1) errors.push(`Value column is ambiguous: ${spec.value}`);
  if (errors.length) return { errors };
  const categoryIndex = categoryIndices[0];
  const valueIndex = valueIndices[0];

  const chartRows: Array<{
    label: string;
    value: number;
    sourceRowIndex: number;
    categoryProvenance: ChartCellProvenance | null;
    valueProvenance: ChartCellProvenance | null;
  }> = [];
  rows.forEach((row, index) => {
    const label = String(row[categoryIndex] ?? "").trim();
    const value = toFiniteNumber(row[valueIndex]);
    if (!label) errors.push(`Row ${index + 1} has an empty ${spec.category} value.`);
    if (value == null) errors.push(`Row ${index + 1} has a non-numeric ${spec.value} value.`);
    if (label && value != null)
      chartRows.push({
        label,
        value,
        sourceRowIndex: index,
        categoryProvenance: provenanceFor(index, categoryIndex, spec.category),
        valueProvenance: provenanceFor(index, valueIndex, spec.value),
      });
  });
  if (errors.length) return { errors };
  if (!chartRows.length) return { errors: ["The chart data source has no rows."] };

  if (spec.sort === "ascending") chartRows.sort((left, right) => left.value - right.value);
  if (spec.sort === "descending") chartRows.sort((left, right) => right.value - left.value);
  const visibleRows = chartRows.slice(0, spec.maxItems);
  const maximum = Math.max(...visibleRows.map((row) => Math.abs(row.value)), 0) || 1;
  const minimumValue = Math.min(...visibleRows.map((row) => row.value));
  const maximumValue = Math.max(...visibleRows.map((row) => row.value));
  const valueRange = maximumValue - minimumValue;
  return {
    model: {
      chartArtifactId: chartArtifact.id,
      sourceArtifactId: sourceArtifact.id,
      sourceArtifactName: sourceArtifact.name,
      sourceArtifactKind: sourceArtifact.kind,
      spec,
      data: visibleRows.map((row) => ({
        ...row,
        formatted: formatChartValue(row.value, spec.format),
        ratio: Math.abs(row.value) / maximum,
        position: valueRange ? (row.value - minimumValue) / valueRange : 0.5,
      })),
    },
    errors: [],
  };
}

export function chartLinePoints(model: ChartModel): ChartLinePoint[] {
  const denominator = model.data.length - 1;
  return model.data.map((datum, index) => ({
    datum,
    x: denominator > 0 ? index / denominator : 0.5,
    y: 1 - datum.position,
  }));
}

export function validateChartSourceBinding(
  chartArtifact: ChartArtifactLike,
  artifacts: ChartArtifactLike[],
  parseData: (source: string) => ParsedChartData,
) {
  const parsedSpec = parseChartSource(chartArtifact.source);
  if (!parsedSpec.spec) return parsedSpec.errors;
  const spec = parsedSpec.spec;
  const sourceArtifact = artifacts.find((artifact) => artifact.id === spec.source);
  if (!sourceArtifact || (sourceArtifact.kind !== "data" && sourceArtifact.kind !== "query")) {
    return [`Chart source not found: ${spec.source}`];
  }
  if (sourceArtifact.kind === "data") {
    return resolveChartModel(chartArtifact, artifacts, parseData).errors;
  }
  const queryErrors = validateReadQuery(sourceArtifact.source);
  if (queryErrors.length) return queryErrors.map((error) => `Query source: ${error}`);
  const dataResolution = resolveQueryDataArtifact(sourceArtifact, artifacts);
  if (!dataResolution.artifact) return dataResolution.errors.map((error) => `Query source: ${error}`);
  const canonicalData = dataResolution.artifact;
  const parsedData = parseData(canonicalData.source);
  if (parsedData.errors.length) return parsedData.errors.map((error) => `Data source: ${error}`);
  const output = inferQueryOutputColumns(sourceArtifact.source, parsedData.columns);
  if (output.errors.length) return output.errors.map((error) => `Query source: ${error}`);
  const errors: string[] = [];
  if (!output.columns.includes(spec.category))
    errors.push(`Category column not found in Query output: ${spec.category}`);
  if (!output.columns.includes(spec.value)) errors.push(`Value column not found in Query output: ${spec.value}`);
  return errors;
}

export function chartQuerySourceIdsForArtifact(artifact: ChartArtifactLike, artifacts: ChartArtifactLike[]) {
  const chartIds = artifact.kind === "chart" ? [artifact.id] : findChartReferences(artifact.source);
  const queryIds = new Set<string>();
  chartIds.forEach((chartId) => {
    const chart = artifacts.find((candidate) => candidate.id === chartId && candidate.kind === "chart");
    if (!chart) return;
    const spec = parseChartSource(chart.source).spec;
    if (!spec) return;
    const source = artifacts.find((candidate) => candidate.id === spec.source);
    if (source?.kind === "query") queryIds.add(source.id);
  });
  return artifacts.filter((candidate) => queryIds.has(candidate.id)).map((candidate) => candidate.id);
}

export function findChartReferences(source: string): string[] {
  const references = new Set<string>();
  for (const match of source.matchAll(chartReferencePattern())) references.add(match[1]);
  return [...references];
}

export function tokenizeChartReferences(source: string): ChartSourcePart[] {
  const parts: ChartSourcePart[] = [];
  const pattern = chartReferencePattern();
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ type: "source", value: source.slice(cursor, index), start: cursor, end: index });
    const end = index + match[0].length;
    parts.push({ type: "chart", value: match[1], start: index, end });
    cursor = end;
  }
  if (cursor < source.length)
    parts.push({ type: "source", value: source.slice(cursor), start: cursor, end: source.length });
  return parts.length ? parts : [{ type: "source", value: source, start: 0, end: source.length }];
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderChartModelHtml(model: ChartModel): string {
  if (model.spec.mark !== "bar") {
    const points = chartLinePoints(model);
    const plotPoints = points
      .map((point) => `${(50 + point.x * 900).toFixed(2)},${(24 + point.y * 172).toFixed(2)}`)
      .join(" ");
    const circles = points
      .map((point) => {
        const x = (50 + point.x * 900).toFixed(2);
        const y = (24 + point.y * 172).toFixed(2);
        return `<circle cx="${x}" cy="${y}" r="7"><title>${escapeHtml(`${point.datum.label}: ${point.datum.formatted}`)}</title></circle>`;
      })
      .join("");
    const areaPoints = points.length
      ? `${(50 + points[0].x * 900).toFixed(2)},196 ${plotPoints} ${(50 + points.at(-1)!.x * 900).toFixed(2)},196`
      : "";
    const labels = model.data
      .map(
        (datum) => `<div><span>${escapeHtml(datum.label)}</span><strong>${escapeHtml(datum.formatted)}</strong></div>`,
      )
      .join("");
    return `<figure class="orbit-embedded-chart orbit-line-chart${model.spec.mark === "area" ? " orbit-area-chart" : ""}" style="--orbit-chart-accent:${model.spec.color}" aria-label="${escapeHtml(model.spec.title)}">
  <style>
    .orbit-embedded-chart{margin:0;padding:22px;border:1px solid rgba(98,112,104,.24);border-radius:14px;background:rgba(255,255,255,.4);font-family:Inter,ui-sans-serif,system-ui,sans-serif}.orbit-embedded-chart figcaption{display:grid;gap:4px;margin-bottom:18px}.orbit-embedded-chart figcaption strong{font-size:18px}.orbit-embedded-chart figcaption span{color:#627068;font-size:11px}.orbit-line-plot{display:block;width:100%;height:auto;overflow:visible}.orbit-line-grid line{stroke:rgba(98,112,104,.16);stroke-width:1}.orbit-area-series{fill:var(--orbit-chart-accent);fill-opacity:.16;stroke:none}.orbit-line-series{fill:none;stroke:var(--orbit-chart-accent);stroke-width:8;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}.orbit-line-points circle{fill:#fff;stroke:var(--orbit-chart-accent);stroke-width:5;vector-effect:non-scaling-stroke}.orbit-line-labels{display:grid;grid-template-columns:repeat(var(--orbit-line-count),minmax(0,1fr));gap:6px;margin-top:4px}.orbit-line-labels div{display:grid;gap:2px;min-width:0;text-align:center}.orbit-line-labels span{overflow:hidden;color:#627068;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.orbit-line-labels strong{color:#18211c;font-size:10px;font-variant-numeric:tabular-nums}
  </style>
  <figcaption><strong>${escapeHtml(model.spec.title)}</strong><span>${escapeHtml(model.spec.description || `${model.spec.value} by ${model.spec.category}`)}</span></figcaption>
  <svg class="orbit-line-plot" viewBox="0 0 1000 220" role="img" aria-label="${escapeHtml(`${model.spec.title} ${model.spec.mark} chart`)}"><title>${escapeHtml(model.spec.title)}</title><g class="orbit-line-grid"><line x1="50" y1="24" x2="950" y2="24"/><line x1="50" y1="110" x2="950" y2="110"/><line x1="50" y1="196" x2="950" y2="196"/></g>${model.spec.mark === "area" ? `<polygon class="orbit-area-series" points="${areaPoints}"/>` : ""}<polyline class="orbit-line-series" points="${plotPoints}"/><g class="orbit-line-points">${circles}</g></svg>
  <div class="orbit-line-labels" style="--orbit-line-count:${model.data.length}">${labels}</div>
</figure>`;
  }
  const rows = model.data
    .map(
      (datum) => `<div class="orbit-chart-row">
    <span>${escapeHtml(datum.label)}</span>
    <div class="orbit-chart-track"><i style="width:${(datum.ratio * 100).toFixed(2)}%"></i></div>
    <strong>${escapeHtml(datum.formatted)}</strong>
  </div>`,
    )
    .join("\n");
  return `<figure class="orbit-embedded-chart" style="--orbit-chart-accent:${model.spec.color}" aria-label="${escapeHtml(model.spec.title)}">
  <style>
    .orbit-embedded-chart{margin:0;padding:22px;border:1px solid rgba(98,112,104,.24);border-radius:14px;background:rgba(255,255,255,.4);font-family:Inter,ui-sans-serif,system-ui,sans-serif}.orbit-embedded-chart figcaption{display:grid;gap:4px;margin-bottom:18px}.orbit-embedded-chart figcaption strong{font-size:18px}.orbit-embedded-chart figcaption span{color:#627068;font-size:11px}.orbit-chart-rows{display:grid;gap:10px}.orbit-chart-row{display:grid;grid-template-columns:minmax(82px,1fr) minmax(100px,3fr) auto;align-items:center;gap:10px;color:#627068;font-size:11px}.orbit-chart-row>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.orbit-chart-row>strong{color:#18211c;font-size:11px;font-variant-numeric:tabular-nums}.orbit-chart-track{height:9px;overflow:hidden;border-radius:999px;background:rgba(98,112,104,.16)}.orbit-chart-track i{display:block;height:100%;border-radius:inherit;background:var(--orbit-chart-accent)}
  </style>
  <figcaption><strong>${escapeHtml(model.spec.title)}</strong><span>${escapeHtml(model.spec.description || `${model.spec.value} by ${model.spec.category}`)}</span></figcaption>
  <div class="orbit-chart-rows">${rows}</div>
</figure>`;
}

export function renderChartReferencesToHtml(
  source: string,
  resolve: (chartArtifactId: string) => ChartResolution,
): string {
  return source.replace(chartReferencePattern(), (_token, chartArtifactId: string) => {
    const resolution = resolve(chartArtifactId);
    if (resolution.model) return renderChartModelHtml(resolution.model);
    const message = resolution.errors[0] ?? `Chart not found: ${chartArtifactId}`;
    return `<aside style="padding:16px;border:1px solid #e7bcb5;border-radius:10px;background:#fff0ed;color:#8d3e35;font:12px system-ui">Chart unavailable · ${escapeHtml(message)}</aside>`;
  });
}
