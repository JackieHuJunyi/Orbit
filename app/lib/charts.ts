import { z } from "zod";

export const ChartSpecSchema = z.object({
  version: z.literal(1),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(240).default(""),
  source: z.string().trim().min(1).max(120),
  mark: z.literal("bar"),
  category: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(120),
  sort: z.enum(["source", "ascending", "descending"]).default("descending"),
  format: z.enum(["currency", "number", "percent"]).default("number"),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Use a six-digit hex color.").default("#ff5c35"),
  maxItems: z.number().int().min(1).max(20).default(8),
}).strict();

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
};

export type ChartModel = {
  chartArtifactId: string;
  sourceArtifactId: string;
  sourceArtifactName: string;
  spec: ChartSpec;
  data: ChartDatum[];
};

export type ChartResolution = {
  model?: ChartModel;
  errors: string[];
};

export type ChartSourcePart =
  | { type: "source"; value: string }
  | { type: "chart"; value: string };

function chartReferencePattern() {
  return /\{\{\s*chart\(["']([a-z0-9_.-]+)["']\)\s*\}\}/gi;
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

function formatChartValue(value: number, format: ChartSpec["format"]) {
  if (format === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (format === "percent") return `${value.toFixed(1)}%`;
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(value);
}

export function resolveChartModel(
  chartArtifact: ChartArtifactLike,
  artifacts: ChartArtifactLike[],
  parseData: (source: string) => ParsedChartData,
): ChartResolution {
  const parsedSpec = parseChartSource(chartArtifact.source);
  if (!parsedSpec.spec) return { errors: parsedSpec.errors };
  const spec = parsedSpec.spec;
  const sourceArtifact = artifacts.find((artifact) => artifact.id === spec.source && artifact.kind === "data");
  if (!sourceArtifact) return { errors: [`Data source not found: ${spec.source}`] };

  const parsedData = parseData(sourceArtifact.source);
  if (parsedData.errors.length) return { errors: parsedData.errors.map((error) => `Data source: ${error}`) };
  const errors: string[] = [];
  if (!parsedData.columns.includes(spec.category)) errors.push(`Category column not found: ${spec.category}`);
  if (!parsedData.columns.includes(spec.value)) errors.push(`Value column not found: ${spec.value}`);
  if (errors.length) return { errors };

  const rows: Array<{ label: string; value: number }> = [];
  parsedData.rows.forEach((row, index) => {
    const label = String(row[spec.category] ?? "").trim();
    const value = toFiniteNumber(row[spec.value]);
    if (!label) errors.push(`Row ${index + 1} has an empty ${spec.category} value.`);
    if (value == null) errors.push(`Row ${index + 1} has a non-numeric ${spec.value} value.`);
    if (label && value != null) rows.push({ label, value });
  });
  if (errors.length) return { errors };
  if (!rows.length) return { errors: ["The chart data source has no rows."] };

  if (spec.sort === "ascending") rows.sort((left, right) => left.value - right.value);
  if (spec.sort === "descending") rows.sort((left, right) => right.value - left.value);
  const visibleRows = rows.slice(0, spec.maxItems);
  const maximum = Math.max(...visibleRows.map((row) => Math.abs(row.value)), 0) || 1;
  return {
    model: {
      chartArtifactId: chartArtifact.id,
      sourceArtifactId: sourceArtifact.id,
      sourceArtifactName: sourceArtifact.name,
      spec,
      data: visibleRows.map((row) => ({
        ...row,
        formatted: formatChartValue(row.value, spec.format),
        ratio: Math.abs(row.value) / maximum,
      })),
    },
    errors: [],
  };
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
    if (index > cursor) parts.push({ type: "source", value: source.slice(cursor, index) });
    parts.push({ type: "chart", value: match[1] });
    cursor = index + match[0].length;
  }
  if (cursor < source.length) parts.push({ type: "source", value: source.slice(cursor) });
  return parts.length ? parts : [{ type: "source", value: source }];
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
  const rows = model.data.map((datum) => `<div class="rune-chart-row">
    <span>${escapeHtml(datum.label)}</span>
    <div class="rune-chart-track"><i style="width:${(datum.ratio * 100).toFixed(2)}%"></i></div>
    <strong>${escapeHtml(datum.formatted)}</strong>
  </div>`).join("\n");
  return `<figure class="rune-embedded-chart" style="--rune-chart-accent:${model.spec.color}" aria-label="${escapeHtml(model.spec.title)}">
  <style>
    .rune-embedded-chart{margin:0;padding:22px;border:1px solid rgba(98,112,104,.24);border-radius:14px;background:rgba(255,255,255,.4);font-family:Inter,ui-sans-serif,system-ui,sans-serif}.rune-embedded-chart figcaption{display:grid;gap:4px;margin-bottom:18px}.rune-embedded-chart figcaption strong{font-size:18px}.rune-embedded-chart figcaption span{color:#627068;font-size:11px}.rune-chart-rows{display:grid;gap:10px}.rune-chart-row{display:grid;grid-template-columns:minmax(82px,1fr) minmax(100px,3fr) auto;align-items:center;gap:10px;color:#627068;font-size:11px}.rune-chart-row>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rune-chart-row>strong{color:#18211c;font-size:11px;font-variant-numeric:tabular-nums}.rune-chart-track{height:9px;overflow:hidden;border-radius:999px;background:rgba(98,112,104,.16)}.rune-chart-track i{display:block;height:100%;border-radius:inherit;background:var(--rune-chart-accent)}
  </style>
  <figcaption><strong>${escapeHtml(model.spec.title)}</strong><span>${escapeHtml(model.spec.description || `${model.spec.value} by ${model.spec.category}`)}</span></figcaption>
  <div class="rune-chart-rows">${rows}</div>
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
