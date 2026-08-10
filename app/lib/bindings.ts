import { parseDataSource, type DataCell, type WorkspaceArtifact } from "./workspace.ts";
import { findChartReferences } from "./charts.ts";

export type WorkspaceMetric = {
  key: string;
  label: string;
  value: DataCell;
  formatted: string;
  sourceArtifactId: string;
};

export type CompiledArtifact = {
  source: string;
  references: string[];
  unresolved: string[];
  chartReferences: string[];
  unresolvedCharts: string[];
  metrics: Record<string, WorkspaceMetric>;
};

const metricPattern = /\{\{\s*metric\(["']([a-z0-9_.-]+)["']\)\s*\}\}/gi;

function findColumn(columns: string[], pattern: RegExp) {
  return columns.find((column) => pattern.test(column));
}

function numeric(row: Record<string, DataCell>, column?: string) {
  if (!column) return 0;
  const value = Number(row[column] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number, showSign = false) {
  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function findMetricReferences(source: string): string[] {
  const references = new Set<string>();
  for (const match of source.matchAll(metricPattern)) references.add(match[1]);
  return [...references];
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
    { key: "total_customers", label: "Customers", value: totalCustomers, formatted: Math.round(totalCustomers).toLocaleString("en-US"), sourceArtifactId: dataArtifact.id },
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

export function compileArtifactSource(source: string, artifacts: WorkspaceArtifact[]): CompiledArtifact {
  const metrics = deriveWorkspaceMetrics(artifacts);
  const references = findMetricReferences(source);
  const unresolved = references.filter((reference) => !metrics[reference]);
  const chartReferences = findChartReferences(source);
  const unresolvedCharts = chartReferences.filter((reference) => (
    !artifacts.some((artifact) => artifact.id === reference && artifact.kind === "chart")
  ));
  return {
    source: source.replace(metricPattern, (_token, key: string) => metrics[key]?.formatted ?? `⚠ ${key}`),
    references,
    unresolved,
    chartReferences,
    unresolvedCharts,
    metrics,
  };
}
