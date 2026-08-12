import { findChartReferences } from "./charts.ts";
import { resolveQueryDataArtifact } from "./query-source.ts";
import {
  workspaceQuerySnapshotIsCurrent,
  type WorkspaceQuerySnapshot,
} from "./query-snapshot.ts";
import { inferQueryOutputColumns } from "./sql.ts";
import { parseDataSource, type DataCell, type WorkspaceArtifact } from "./workspace.ts";
import {
  formatCompactCurrency,
  formatDeterministicNumber,
  formatFixedPercent,
  formatInteger,
} from "./number-format.ts";

export const QUERY_METRIC_FORMATS = ["currency", "number", "percent"] as const;

export type QueryMetricFormat = typeof QUERY_METRIC_FORMATS[number];

export type WorkspaceMetric = {
  key: string;
  label: string;
  value: DataCell;
  formatted: string;
  sourceArtifactId: string;
};

export type QueryMetricReference = {
  queryArtifactId: string;
  column: string;
  format: QueryMetricFormat;
};

export type WorkspaceQueryMetric = QueryMetricReference & {
  key: string;
  value: number;
  formatted: string;
  dataArtifactId: string;
};

export type CompiledArtifact = {
  source: string;
  sourceOffsets: number[];
  references: string[];
  unresolved: string[];
  queryMetricReferences: QueryMetricReference[];
  unresolvedQueryMetrics: string[];
  pendingQueryMetrics: string[];
  queryMetricRuntimeErrors: string[];
  metricBindingErrors: string[];
  chartReferences: string[];
  unresolvedCharts: string[];
  metrics: Record<string, WorkspaceMetric>;
  queryMetrics: Record<string, WorkspaceQueryMetric>;
};

type MetricBinding =
  | { kind: "legacy"; key: string; start: number; end: number }
  | { kind: "query"; reference: QueryMetricReference; start: number; end: number };

export type ParsedMetricBindings = {
  bindings: MetricBinding[];
  errors: string[];
};

export type QueryMetricValidation = {
  queryArtifact?: WorkspaceArtifact;
  dataArtifact?: WorkspaceArtifact;
  errors: string[];
};

type QueryMetricResolution = QueryMetricValidation & {
  metric?: WorkspaceQueryMetric;
  pending: boolean;
  staticValid: boolean;
};

const LEGACY_METRIC_KEY = /^[a-z0-9_.-]+$/iu;
const MAX_METRIC_IDENTITY_CHARS = 120;

function findColumn(columns: string[], pattern: RegExp) {
  return columns.find((column) => pattern.test(column));
}

function numeric(row: Record<string, DataCell>, column?: string) {
  if (!column) return 0;
  const value = Number(row[column] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function formatCurrency(value: number) {
  return formatCompactCurrency(value);
}

function formatPercent(value: number, showSign = false) {
  return formatFixedPercent(value, showSign);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function splitMetricArguments(source: string): string[] | null {
  const parts: string[] = [];
  let quote: "\"" | "'" | null = null;
  let escaped = false;
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }
    if (character === ",") {
      parts.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (quote || escaped) return null;
  parts.push(source.slice(start).trim());
  return parts.every(Boolean) ? parts : null;
}

function decodeMetricString(source: string): string | null {
  if (source.startsWith("\"") && source.endsWith("\"")) {
    try {
      const value: unknown = JSON.parse(source);
      return typeof value === "string" ? value : null;
    } catch {
      return null;
    }
  }
  if (!source.startsWith("'") || !source.endsWith("'")) return null;
  const body = source.slice(1, -1);
  let value = "";
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character !== "\\") {
      value += character;
      continue;
    }
    const next = body[index + 1];
    if (next !== "\\" && next !== "'") return null;
    value += next;
    index += 1;
  }
  return value;
}

function validMetricIdentity(value: string) {
  return value.length > 0
    && value.length <= MAX_METRIC_IDENTITY_CHARS
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

export function queryMetricReferenceKey(reference: QueryMetricReference) {
  return JSON.stringify([reference.queryArtifactId, reference.column, reference.format]);
}

export function queryMetricReferenceLabel(reference: QueryMetricReference) {
  return `${reference.queryArtifactId}.${reference.column}`;
}

export function parseMetricBindings(source: string): ParsedMetricBindings {
  const bindings: MetricBinding[] = [];
  const errors: string[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf("{{", cursor);
    if (start < 0) break;
    const endMarker = source.indexOf("}}", start + 2);
    if (endMarker < 0) {
      if (/^\{\{\s*metric\b/iu.test(source.slice(start))) {
        errors.push("Close the metric binding with }}.");
      }
      break;
    }
    const end = endMarker + 2;
    const inner = source.slice(start + 2, endMarker).trim();
    cursor = end;
    if (!/^metric\b/iu.test(inner)) continue;
    const invocation = inner.match(/^metric\s*\(([\s\S]*)\)$/iu);
    if (!invocation) {
      errors.push('Use {{ metric("key") }} or {{ metric("query-id", "column", "currency|number|percent") }}.');
      continue;
    }
    const rawArguments = splitMetricArguments(invocation[1]);
    const argumentsList = rawArguments?.map(decodeMetricString);
    if (!rawArguments || !argumentsList || argumentsList.some((value) => value == null)) {
      errors.push("Metric binding arguments must be quoted strings with valid escapes.");
      continue;
    }
    const values = argumentsList as string[];
    if (values.length === 1) {
      const key = values[0].toLocaleLowerCase("en-US");
      if (!LEGACY_METRIC_KEY.test(key) || key.length > MAX_METRIC_IDENTITY_CHARS) {
        errors.push("A legacy metric key may contain only letters, numbers, dots, underscores, and hyphens.");
        continue;
      }
      bindings.push({ kind: "legacy", key, start, end });
      continue;
    }
    if (values.length !== 3) {
      errors.push('A Query metric needs exactly three arguments: metric("query-id", "column", "format").');
      continue;
    }
    const [queryArtifactId, column, format] = values;
    if (!validMetricIdentity(queryArtifactId) || !validMetricIdentity(column)) {
      errors.push("Query metric ids and columns must be 1–120 visible characters.");
      continue;
    }
    if (!QUERY_METRIC_FORMATS.includes(format as QueryMetricFormat)) {
      errors.push(`Query metric format must be ${QUERY_METRIC_FORMATS.join(", ")}.`);
      continue;
    }
    bindings.push({
      kind: "query",
      reference: { queryArtifactId, column, format: format as QueryMetricFormat },
      start,
      end,
    });
  }
  return { bindings, errors: [...new Set(errors)] };
}

export function findMetricReferences(source: string): string[] {
  const references = new Set<string>();
  parseMetricBindings(source).bindings.forEach((binding) => {
    if (binding.kind === "legacy") references.add(binding.key);
  });
  return [...references];
}

export function findQueryMetricReferences(source: string): QueryMetricReference[] {
  const references = new Map<string, QueryMetricReference>();
  parseMetricBindings(source).bindings.forEach((binding) => {
    if (binding.kind === "query") {
      references.set(queryMetricReferenceKey(binding.reference), binding.reference);
    }
  });
  return [...references.values()];
}

export function queryMetricSourceIdsForArtifact(source: string) {
  return [...new Set(findQueryMetricReferences(source).map((reference) => reference.queryArtifactId))];
}

export function deriveWorkspaceMetrics(artifacts: WorkspaceArtifact[]): Record<string, WorkspaceMetric> {
  const dataArtifact = artifacts.find((artifact) => artifact.kind === "data");
  if (!dataArtifact) return {};
  const parsed = parseDataSource(dataArtifact.source);
  if (parsed.errors.length || !parsed.rows.length) return {};

  const revenueColumn = findColumn(parsed.columns, /q2.*revenue|revenue|收入/i);
  const priorRevenueColumn = findColumn(parsed.columns, /q1.*revenue|prior.*revenue|上季.*收入/i);
  const costColumn = findColumn(parsed.columns, /cost|成本/i);
  const regionColumn = findColumn(parsed.columns, /region|地区|区域/i);
  const customerColumn = findColumn(parsed.columns, /customer|客户/i);

  const totalRevenue = parsed.rows.reduce((sum, row) => sum + numeric(row, revenueColumn), 0);
  const priorRevenue = parsed.rows.reduce((sum, row) => sum + numeric(row, priorRevenueColumn), 0);
  const totalCost = parsed.rows.reduce((sum, row) => sum + numeric(row, costColumn), 0);
  const totalCustomers = parsed.rows.reduce((sum, row) => sum + numeric(row, customerColumn), 0);
  const qoqGrowth = priorRevenue ? ((totalRevenue - priorRevenue) / priorRevenue) * 100 : 0;
  const grossMargin = totalRevenue ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
  const topRow = [...parsed.rows].sort((a, b) => numeric(b, revenueColumn) - numeric(a, revenueColumn))[0];
  const topRegion = regionColumn ? String(topRow?.[regionColumn] ?? "—") : "—";

  const values: WorkspaceMetric[] = [
    { key: "total_revenue", label: "Total revenue", value: totalRevenue, formatted: formatCurrency(totalRevenue), sourceArtifactId: dataArtifact.id },
    { key: "qoq_growth", label: "Quarter-over-quarter growth", value: qoqGrowth, formatted: formatPercent(qoqGrowth, true), sourceArtifactId: dataArtifact.id },
    { key: "gross_margin", label: "Gross margin", value: grossMargin, formatted: formatPercent(grossMargin), sourceArtifactId: dataArtifact.id },
    { key: "top_region", label: "Top region", value: topRegion, formatted: topRegion, sourceArtifactId: dataArtifact.id },
    { key: "total_customers", label: "Customers", value: totalCustomers, formatted: formatInteger(totalCustomers), sourceArtifactId: dataArtifact.id },
  ];

  if (regionColumn) {
    parsed.rows.forEach((row) => {
      const region = String(row[regionColumn] ?? "region");
      const revenue = numeric(row, revenueColumn);
      values.push({
        key: `region.${slug(region)}.revenue`,
        label: `${region} revenue`,
        value: revenue,
        formatted: formatCurrency(revenue),
        sourceArtifactId: dataArtifact.id,
      });
    });
  }

  return Object.fromEntries(values.map((metric) => [metric.key, metric]));
}

export function validateQueryMetricReference(
  reference: QueryMetricReference,
  artifacts: WorkspaceArtifact[],
): QueryMetricValidation {
  const queryArtifact = artifacts.find((artifact) => artifact.id === reference.queryArtifactId);
  if (!queryArtifact) {
    return { errors: [`Query metric source not found: ${reference.queryArtifactId}`] };
  }
  if (queryArtifact.kind !== "query") {
    return { errors: [`Query metric source must reference a Query artifact: ${reference.queryArtifactId}`] };
  }
  const dataResolution = resolveQueryDataArtifact(queryArtifact, artifacts);
  if (!dataResolution.artifact) {
    return {
      queryArtifact,
      errors: dataResolution.errors.map((error) => `Query metric source: ${error}`),
    };
  }
  const dataArtifact = dataResolution.artifact;
  const parsedData = parseDataSource(dataArtifact.source);
  if (parsedData.errors.length || !parsedData.columns.length) {
    return {
      queryArtifact,
      dataArtifact,
      errors: (parsedData.errors.length ? parsedData.errors : ["The bound Data artifact has no columns."])
        .map((error) => `Query metric Data source: ${error}`),
    };
  }
  const output = inferQueryOutputColumns(queryArtifact.source, parsedData.columns);
  if (output.errors.length) {
    return {
      queryArtifact,
      dataArtifact,
      errors: output.errors.map((error) => `Query metric source: ${error}`),
    };
  }
  if (!output.columns.includes(reference.column)) {
    return {
      queryArtifact,
      dataArtifact,
      errors: [`Query metric column not found in Query output: ${reference.column}`],
    };
  }
  return { queryArtifact, dataArtifact, errors: [] };
}

function queryMetricNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const number = Number(value.replace(/[$,%\s,]/gu, ""));
  return Number.isFinite(number) ? number : null;
}

function formatQueryMetric(value: number, format: QueryMetricFormat) {
  if (format === "currency") return formatCurrency(value);
  if (format === "percent") return formatPercent(value);
  return formatDeterministicNumber(value);
}

function resolveQueryMetricReference(
  reference: QueryMetricReference,
  artifacts: WorkspaceArtifact[],
  querySnapshots: WorkspaceQuerySnapshot[],
): QueryMetricResolution {
  const validation = validateQueryMetricReference(reference, artifacts);
  if (!validation.queryArtifact || !validation.dataArtifact || validation.errors.length) {
    return { ...validation, pending: false, staticValid: false };
  }
  const snapshot = querySnapshots.find((candidate) => (
    candidate.queryArtifactId === validation.queryArtifact?.id
  ));
  if (!snapshot) return { ...validation, pending: true, staticValid: true };
  if (!workspaceQuerySnapshotIsCurrent(snapshot, validation.queryArtifact, validation.dataArtifact)) {
    return {
      ...validation,
      pending: false,
      staticValid: true,
      errors: [`Query metric result is stale: ${reference.queryArtifactId}`],
    };
  }
  if (snapshot.result.truncated) {
    return {
      ...validation,
      pending: false,
      staticValid: true,
      errors: [`Query metric source exceeds 500 rows: ${reference.queryArtifactId}`],
    };
  }
  if (snapshot.result.rows.length !== 1) {
    return {
      ...validation,
      pending: false,
      staticValid: true,
      errors: [`Query metric source must return exactly one row: ${reference.queryArtifactId} returned ${snapshot.result.rows.length}.`],
    };
  }
  const columnIndices = snapshot.result.columns.flatMap((column, index) => (
    column === reference.column ? [index] : []
  ));
  if (columnIndices.length !== 1) {
    return {
      ...validation,
      pending: false,
      staticValid: true,
      errors: [`Query metric column is missing or ambiguous at runtime: ${reference.column}`],
    };
  }
  const value = queryMetricNumber(snapshot.result.rows[0]?.[columnIndices[0]]);
  if (value == null) {
    return {
      ...validation,
      pending: false,
      staticValid: true,
      errors: [`Query metric value must be a finite number: ${queryMetricReferenceLabel(reference)}`],
    };
  }
  const key = queryMetricReferenceKey(reference);
  return {
    ...validation,
    pending: false,
    staticValid: true,
    errors: [],
    metric: {
      ...reference,
      key,
      value,
      formatted: formatQueryMetric(value, reference.format),
      dataArtifactId: validation.dataArtifact.id,
    },
  };
}

export function compileArtifactSource(
  source: string,
  artifacts: WorkspaceArtifact[],
  querySnapshots: WorkspaceQuerySnapshot[] = [],
): CompiledArtifact {
  const parsedBindings = parseMetricBindings(source);
  const metrics = deriveWorkspaceMetrics(artifacts);
  const references = findMetricReferences(source);
  const unresolved = references.filter((reference) => !metrics[reference]);
  const queryMetricReferences = findQueryMetricReferences(source);
  const queryResolutions = new Map(queryMetricReferences.map((reference) => [
    queryMetricReferenceKey(reference),
    resolveQueryMetricReference(reference, artifacts, querySnapshots),
  ]));
  const unresolvedQueryMetrics = [...queryResolutions.values()].flatMap((resolution) => (
    !resolution.staticValid ? resolution.errors : []
  ));
  const pendingQueryMetrics = queryMetricReferences
    .filter((reference) => queryResolutions.get(queryMetricReferenceKey(reference))?.pending)
    .map(queryMetricReferenceLabel);
  const queryMetricRuntimeErrors = [...queryResolutions.values()].flatMap((resolution) => (
    resolution.staticValid && !resolution.pending && !resolution.metric
      ? resolution.errors
      : []
  ));
  const queryMetrics = Object.fromEntries([...queryResolutions.entries()].flatMap(([key, resolution]) => (
    resolution.metric ? [[key, resolution.metric]] : []
  )));
  const chartReferences = findChartReferences(source);
  const unresolvedCharts = chartReferences.filter((reference) => (
    !artifacts.some((artifact) => artifact.id === reference && artifact.kind === "chart")
  ));

  let compiledSource = "";
  const sourceOffsets: number[] = [0];
  const appendOriginal = (start: number, end: number) => {
    for (let index = start; index < end; index += 1) {
      compiledSource += source[index];
      sourceOffsets.push(index + 1);
    }
  };
  const appendReplacement = (value: string, start: number, end: number) => {
    compiledSource += value;
    if (!value.length) {
      sourceOffsets[sourceOffsets.length - 1] = end;
      return;
    }
    for (let index = 1; index <= value.length; index += 1) {
      sourceOffsets.push(index === value.length ? end : start);
    }
  };
  let cursor = 0;
  parsedBindings.bindings.forEach((binding) => {
    appendOriginal(cursor, binding.start);
    let replacement: string;
    if (binding.kind === "legacy") {
      replacement = metrics[binding.key]?.formatted ?? `⚠ ${binding.key}`;
    } else {
      const resolution = queryResolutions.get(queryMetricReferenceKey(binding.reference));
      replacement = resolution?.metric?.formatted
        ?? (resolution?.pending ? "…" : `⚠ ${queryMetricReferenceLabel(binding.reference)}`);
    }
    appendReplacement(replacement, binding.start, binding.end);
    cursor = binding.end;
  });
  appendOriginal(cursor, source.length);

  return {
    source: compiledSource,
    sourceOffsets,
    references,
    unresolved,
    queryMetricReferences,
    unresolvedQueryMetrics: [...new Set(unresolvedQueryMetrics)],
    pendingQueryMetrics,
    queryMetricRuntimeErrors: [...new Set(queryMetricRuntimeErrors)],
    metricBindingErrors: parsedBindings.errors,
    chartReferences,
    unresolvedCharts,
    metrics,
    queryMetrics,
  };
}

export function compiledSourceRangeToCanonical(
  compiled: Pick<CompiledArtifact, "source" | "sourceOffsets">,
  start: number,
  end: number,
): { start: number; end: number } | null {
  if (!Number.isInteger(start)
    || !Number.isInteger(end)
    || start < 0
    || end <= start
    || end > compiled.source.length
    || compiled.sourceOffsets.length !== compiled.source.length + 1) return null;
  const canonicalStart = compiled.sourceOffsets[start];
  const canonicalEnd = compiled.sourceOffsets[end];
  return Number.isInteger(canonicalStart) && Number.isInteger(canonicalEnd) && canonicalStart < canonicalEnd
    ? { start: canonicalStart, end: canonicalEnd }
    : null;
}
