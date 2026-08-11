import Papa from "papaparse";
import { parseChartSource, validateChartSourceBinding } from "./charts.ts";
import { compileDeckSource, isDeckMarkdownArtifact, parseDeckSource } from "./deck.ts";
import { validateReadQuery } from "./sql.ts";

export type ArtifactKind = "document" | "data" | "query" | "chart" | "slides";

export type WorkspaceArtifact = {
  id: string;
  name: string;
  kind: ArtifactKind;
  language: string;
  source: string;
};

export type DataCell = string | number | boolean | null;

export type ParsedData = {
  columns: string[];
  rows: Array<Record<string, DataCell>>;
  errors: string[];
  format: "CSV" | "JSON";
};

export type LocalPlan = {
  nextSource: string;
  summary: string;
  detail: string;
};

export type LocalWorkspacePlan = {
  summary: string;
  detail: string;
  patches: Array<LocalPlan & { artifactId: string }>;
};

const documentSource = `# Q2 Business Review

> **Live source** · Updated from the same workspace as the data and board deck.

## Executive summary

Revenue reached **{{ metric("total_revenue") }}**, up **{{ metric("qoq_growth") }} quarter over quarter**. **{{ metric("top_region") }}** led growth while gross margin reached **{{ metric("gross_margin") }}**.

## What changed

- The leading region contributed {{ metric("region.apac.revenue") }} after the partner launch.
- Gross margin improved 2.8 points as infrastructure costs normalized.
- Enterprise retention held above 96%.

## Revenue by region

{{ chart("regional-revenue-chart") }}

## Margin signal from SQL

{{ chart("regional-margin-chart") }}

## Decisions

| Decision | Owner | Due |
| --- | --- | --- |
| Expand APAC partner program | Growth | Aug 22 |
| Reprice legacy startup tier | Finance | Sep 05 |

## Next actions

- [ ] Validate the Q3 pipeline assumptions.
- [ ] Turn the findings into a six-slide board narrative.
`;

const dataSource = `Region,Q2 Revenue,Q1 Revenue,Cost,Customers
APAC,1840000,1540000,1120000,148
North America,1560000,1490000,1010000,121
Europe,970000,920000,690000,84
LATAM,450000,340000,315000,39`;

const querySource = `-- workspace_data is rebuilt from regional-revenue.csv before every run.
SELECT
  Region,
  "Q2 Revenue" AS q2_revenue,
  "Q1 Revenue" AS q1_revenue,
  ROUND(("Q2 Revenue" - Cost) / "Q2 Revenue" * 100, 1) AS margin_pct,
  Customers
FROM workspace_data
ORDER BY "Q2 Revenue" DESC;`;

const chartSource = `{
  "version": 1,
  "title": "Q2 revenue by region",
  "description": "Canonical regional revenue, sorted high to low",
  "source": "regional-revenue",
  "mark": "bar",
  "category": "Region",
  "value": "Q2 Revenue",
  "sort": "descending",
  "format": "currency",
  "color": "#ff5c35",
  "maxItems": 8
}`;

const marginChartSource = `{
  "version": 1,
  "title": "Gross margin by region",
  "description": "Derived live from regional-analysis.sql",
  "source": "regional-analysis",
  "mark": "bar",
  "category": "Region",
  "value": "margin_pct",
  "sort": "descending",
  "format": "percent",
  "color": "#8267ce",
  "maxItems": 8
}`;

const slidesSource = `---
version: 1
title: Q2 Board Briefing
theme: rune
ratio: 16:9
lang: en
---

<!-- layout: cover -->
<!-- eyebrow: Q2 · Board Briefing -->

# Growth became more durable.

A shared story compiled from the same source as the operating data and written report.

---

<!-- layout: metrics -->
<!-- eyebrow: The quarter at a glance -->

# Momentum with healthier economics.

| Q2 revenue | Quarter over quarter | Gross margin |
| --- | --- | --- |
| **{{ metric("total_revenue") }}** | **{{ metric("qoq_growth") }}** | **{{ metric("gross_margin") }}** |

---

<!-- layout: split -->
<!-- eyebrow: Regional signal -->

# {{ metric("top_region") }} is now the growth engine.

Partner distribution created a repeatable acquisition channel.

{{ chart("regional-revenue-chart") }}

---

<!-- layout: split -->
<!-- eyebrow: Query-backed signal -->

# Margin varies by region.

This chart is computed from readable DuckDB SQL, not copied into the deck.

{{ chart("regional-margin-chart") }}
`;

export const defaultArtifacts: WorkspaceArtifact[] = [
  {
    id: "q2-review",
    name: "q2-review.md",
    kind: "document",
    language: "Markdown",
    source: documentSource,
  },
  {
    id: "regional-revenue",
    name: "regional-revenue.csv",
    kind: "data",
    language: "CSV / JSON",
    source: dataSource,
  },
  {
    id: "regional-analysis",
    name: "regional-analysis.sql",
    kind: "query",
    language: "DuckDB SQL",
    source: querySource,
  },
  {
    id: "regional-revenue-chart",
    name: "regional-revenue.chart.json",
    kind: "chart",
    language: "Chart JSON",
    source: chartSource,
  },
  {
    id: "regional-margin-chart",
    name: "regional-margin.chart.json",
    kind: "chart",
    language: "Chart JSON",
    source: marginChartSource,
  },
  {
    id: "board-briefing",
    name: "board-briefing.deck.md",
    kind: "slides",
    language: "Deck Markdown",
    source: slidesSource,
  },
];

export const quickCommands: Record<ArtifactKind, string[]> = {
  document: ["把摘要压缩成三条要点", "补充下一步行动"],
  data: ["按收入从高到低排序", "增加利润率列"],
  query: ["计算利润率并排序", "汇总季度收入"],
  chart: ["保持数据源顺序", "改成紫色强调"],
  slides: ["把主题改成深色", "新增一页结论"],
};

export const workspaceQuickCommands = [
  "根据当前报告新建一份演示",
  "同步季度结论到报告和演示",
  "让分析、报告和演示保持一致",
];

export function cloneDefaultArtifacts(): WorkspaceArtifact[] {
  return defaultArtifacts.map((artifact) => ({ ...artifact }));
}

export function normalizeWorkspaceArtifacts(value: unknown): WorkspaceArtifact[] {
  const restored: WorkspaceArtifact[] = [];
  const seen = new Set<string>();
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      const candidate = entry as Partial<WorkspaceArtifact>;
      if (typeof candidate.id !== "string"
        || typeof candidate.name !== "string"
        || typeof candidate.language !== "string"
        || typeof candidate.source !== "string"
        || !["document", "data", "query", "chart", "slides"].includes(candidate.kind ?? "")
        || seen.has(candidate.id)) return;
      seen.add(candidate.id);
      restored.push(candidate as WorkspaceArtifact);
    });
  }
  const preservedIds = new Set(seen);
  let skippedDefaultQueryChart = false;
  cloneDefaultArtifacts().forEach((artifact) => {
    if (seen.has(artifact.id)) return;
    if (artifact.id === "regional-margin-chart"
      && validateChartSourceBinding(artifact, [...restored, artifact], parseDataSource).length) {
      skippedDefaultQueryChart = true;
      return;
    }
    restored.push(artifact);
    seen.add(artifact.id);
  });
  if (!skippedDefaultQueryChart) return restored;
  return restored.map((artifact) => (
    preservedIds.has(artifact.id)
      ? artifact
      : {
          ...artifact,
          source: artifact.source.replaceAll(
            '{{ chart("regional-margin-chart") }}',
            "Query-backed margin view becomes available when the preserved SQL exposes Region and margin_pct.",
          ),
        }
  ));
}

function normalizeJsonRows(value: unknown): Array<Record<string, DataCell>> {
  const items = Array.isArray(value) ? value : [value];
  return items.map((item, index) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(
        Object.entries(item).map(([key, cell]) => [
          key,
          cell === null || ["string", "number", "boolean"].includes(typeof cell)
            ? (cell as DataCell)
            : JSON.stringify(cell),
        ]),
      );
    }
    return { row: index + 1, value: item == null ? null : String(item) };
  });
}

export function parseDataSource(source: string): ParsedData {
  const trimmed = source.trim();
  if (!trimmed) {
    return { columns: [], rows: [], errors: ["Add CSV or JSON to create a data view."], format: "CSV" };
  }

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const rows = normalizeJsonRows(JSON.parse(trimmed));
      const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
      return { columns, rows, errors: [], format: "JSON" };
    } catch (error) {
      return {
        columns: [],
        rows: [],
        errors: [error instanceof Error ? error.message : "Invalid JSON."],
        format: "JSON",
      };
    }
  }

  const result = Papa.parse<Record<string, DataCell>>(source, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: true,
  });
  const columns = result.meta.fields ?? [];
  return {
    columns,
    rows: result.data,
    errors: result.errors.map((error) => `Row ${error.row ?? "?"}: ${error.message}`),
    format: "CSV",
  };
}

export function validateArtifact(artifact: WorkspaceArtifact): string[] {
  if (!artifact.source.trim()) return ["The source is empty."];
  if (artifact.kind === "data") return parseDataSource(artifact.source).errors;
  if (artifact.kind === "query") return validateReadQuery(artifact.source);
  if (artifact.kind === "chart") return parseChartSource(artifact.source).errors;
  if (artifact.kind === "slides") {
    if (isDeckMarkdownArtifact(artifact)) return parseDeckSource(artifact.source).errors;
    const errors: string[] = [];
    if (!/<main[\s>]/i.test(artifact.source)) errors.push("Slides need a <main> element.");
    if (!/<section[\s>]/i.test(artifact.source)) errors.push("Add at least one <section> slide.");
    if (/<script[\s>]/i.test(artifact.source)) errors.push("Scripts are blocked in the slide preview.");
    return errors;
  }
  return [];
}

export function artifactStats(artifact: WorkspaceArtifact): string {
  if (artifact.kind === "data") {
    const parsed = parseDataSource(artifact.source);
    return `${parsed.rows.length} rows · ${parsed.columns.length} columns`;
  }
  if (artifact.kind === "slides") {
    const slides = isDeckMarkdownArtifact(artifact)
      ? compileDeckSource(artifact.source).slideCount
      : artifact.source.match(/<section[\s>]/gi)?.length ?? 0;
    return `${slides} slides · ${artifact.source.length.toLocaleString()} chars`;
  }
  if (artifact.kind === "query") {
    return `SQL · ${artifact.source.split("\n").length} lines`;
  }
  if (artifact.kind === "chart") {
    const parsed = parseChartSource(artifact.source);
    return parsed.spec ? `${parsed.spec.mark} chart · ${parsed.spec.maxItems} marks max` : "Invalid chart JSON";
  }
  const words = artifact.source.trim() ? artifact.source.trim().split(/\s+/).length : 0;
  return `${words} words · ${artifact.source.split("\n").length} lines`;
}

function insertAfterTitle(source: string, block: string): string {
  const title = source.match(/^# .+$/m);
  if (!title || title.index == null) return `${block}\n\n${source}`;
  const end = title.index + title[0].length;
  return `${source.slice(0, end)}\n\n${block}${source.slice(end)}`;
}

function planDocument(source: string, prompt: string): LocalPlan {
  if (/三条|要点|summary|摘要/i.test(prompt)) {
    const block = `## Executive summary\n\n- Revenue reached **{{ metric("total_revenue") }}**, with **{{ metric("qoq_growth") }}** quarter-over-quarter growth.\n- **{{ metric("top_region") }}** became the leading growth engine after the partner launch.\n- Gross margin reached **{{ metric("gross_margin") }}**, increasing confidence in Q3.`;
    const pattern = /## Executive summary[\s\S]*?(?=\n## |$)/i;
    return {
      nextSource: pattern.test(source) ? source.replace(pattern, block) : insertAfterTitle(source, block),
      summary: "Rewrite the executive summary as three decision-ready points",
      detail: "One section will be replaced; the rest of the document stays untouched.",
    };
  }

  if (/行动|next action|todo|下一步/i.test(prompt)) {
    const actions = `## Next actions\n\n- [ ] Validate Q3 pipeline assumptions with Sales.\n- [ ] Confirm APAC partner capacity before the next board update.\n- [ ] Publish a single metric definition for revenue and margin.`;
    const pattern = /## Next actions[\s\S]*?(?=\n## |$)/i;
    return {
      nextSource: pattern.test(source) ? source.replace(pattern, actions) : `${source.trim()}\n\n${actions}\n`,
      summary: "Turn the analysis into owned next actions",
      detail: "The Next actions section will be created or replaced.",
    };
  }

  return {
    nextSource: `${source.trim()}\n\n> **Agent note** · ${prompt.trim()}\n`,
    summary: "Add the instruction as an explicit review note",
    detail: "The local planner only performs deterministic edits; a model provider can replace this planner later.",
  };
}

function planData(source: string, prompt: string): LocalPlan {
  const parsed = parseDataSource(source);
  if (parsed.errors.length || !parsed.columns.length) {
    throw new Error(parsed.errors[0] ?? "The data could not be parsed.");
  }
  if (parsed.format !== "CSV") {
    throw new Error("The local data actions currently modify CSV; JSON preview remains fully supported.");
  }

  const revenueColumn = parsed.columns.find((column) => /q2.*revenue|revenue|收入/i.test(column));
  const costColumn = parsed.columns.find((column) => /cost|成本/i.test(column));

  if (/排序|sort|高到低|descending/i.test(prompt)) {
    if (!revenueColumn) throw new Error("No revenue column was found for sorting.");
    const rows = [...parsed.rows].sort(
      (left, right) => Number(right[revenueColumn] ?? 0) - Number(left[revenueColumn] ?? 0),
    );
    return {
      nextSource: Papa.unparse(rows, { columns: parsed.columns }),
      summary: `Sort all rows by ${revenueColumn}`,
      detail: "Headers and row values remain intact; only row order changes.",
    };
  }

  if (/利润率|margin|profit/i.test(prompt)) {
    if (!revenueColumn || !costColumn) throw new Error("Revenue and cost columns are required.");
    const rows = parsed.rows.map((row) => {
      const revenue = Number(row[revenueColumn] ?? 0);
      const cost = Number(row[costColumn] ?? 0);
      const margin = revenue ? `${(((revenue - cost) / revenue) * 100).toFixed(1)}%` : "0.0%";
      return { ...row, Margin: margin };
    });
    const columns = [...parsed.columns.filter((column) => column !== "Margin"), "Margin"];
    return {
      nextSource: Papa.unparse(rows, { columns }),
      summary: "Add a deterministic gross-margin column",
      detail: `Margin is calculated from ${revenueColumn} and ${costColumn} for every row.`,
    };
  }

  throw new Error("Try sorting by revenue or adding a margin column in this local prototype.");
}

function planDeckSlides(artifact: WorkspaceArtifact, prompt: string): LocalPlan {
  const source = artifact.source;
  if (/深色|dark|night/i.test(prompt)) {
    return {
      nextSource: source.replace(/^theme:\s*(?:rune|rune-dark)\s*$/m, "theme: rune-dark"),
      summary: "Switch the deck compiler to the Rune night theme",
      detail: "Only the validated frontmatter theme changes; slide content stays untouched.",
    };
  }
  if (/结论|conclusion|summary slide|新增.*页/i.test(prompt)) {
    const block = `---\n\n<!-- layout: conclusion -->\n<!-- eyebrow: Decision -->\n\n# Scale the repeatable channel, protect the margin.\n\nFund APAC partner growth while standardizing the revenue model used by every artifact.`;
    const conclusionPattern = /\n---\s*\n\s*<!--\s*layout:\s*conclusion\s*-->[\s\S]*?(?=\n---\s*(?:\n|$)|$)/i;
    const hasConclusion = conclusionPattern.test(source);
    return {
      nextSource: hasConclusion ? source.replace(conclusionPattern, `\n${block}`) : `${source.trim()}\n\n${block}\n`,
      summary: hasConclusion ? "Refresh the decision-led conclusion slide" : "Add a decision-led conclusion slide",
      detail: "The Deck Markdown compiler owns layout and slide numbering.",
    };
  }
  throw new Error("Try changing the theme to dark or adding a conclusion slide.");
}

function planSlides(artifact: WorkspaceArtifact, prompt: string): LocalPlan {
  if (isDeckMarkdownArtifact(artifact)) return planDeckSlides(artifact, prompt);
  const source = artifact.source;
  if (/深色|dark|night/i.test(prompt)) {
    const themed = source
      .replace(/--ink:\s*#[0-9a-f]{3,8}/i, "--ink: #f5f1e8")
      .replace(/--muted:\s*#[0-9a-f]{3,8}/i, "--muted: #a9b5ad")
      .replace(/--paper:\s*#[0-9a-f]{3,8}/i, "--paper: #17201b")
      .replace(/--line:\s*#[0-9a-f]{3,8}/i, "--line: #344139")
      .replace(/background:\s*#dad7cf/i, "background: #0d120f");
    return {
      nextSource: themed,
      summary: "Switch the deck to the Rune night theme",
      detail: "Only shared design tokens and the stage background change.",
    };
  }

  if (/结论|conclusion|summary slide|新增.*页/i.test(prompt)) {
    const conclusionPattern = /<section class="slide" data-layout="conclusion">[\s\S]*?<\/section>/i;
    const hasConclusion = conclusionPattern.test(source);
    const slideCount = (source.match(/<section[\s>]/gi)?.length ?? 0) + (hasConclusion ? 0 : 1);
    const totalLabel = String(slideCount).padStart(2, "0");
    const conclusion = `    <section class="slide" data-layout="conclusion">\n      <p class="eyebrow">Decision</p>\n      <h2>Scale the repeatable channel, protect the margin.</h2>\n      <p class="lede">Fund APAC partner growth while standardizing the revenue model used by every artifact.</p>\n      <span class="number">${totalLabel} / ${totalLabel}</span>\n    </section>\n`;
    const withConclusion = hasConclusion
      ? source.replace(conclusionPattern, conclusion.trim())
      : source.replace(/\s*<\/main>/i, `\n${conclusion}  </main>`);
    return {
      nextSource: withConclusion.replace(
        /(<span class="number">\s*\d+\s*\/\s*)\d+(\s*<\/span>)/gi,
        `$1${totalLabel}$2`,
      ),
      summary: hasConclusion ? "Refresh the decision-led conclusion slide" : "Add a decision-led conclusion slide",
      detail: hasConclusion ? "The existing conclusion section is replaced in place." : "A semantic section is inserted before the deck closes.",
    };
  }

  throw new Error("Try changing the theme to dark or adding a conclusion slide.");
}

function planQuery(prompt: string): LocalPlan {
  if (/利润率|margin|排序|sort/i.test(prompt)) {
    return {
      nextSource: querySource,
      summary: "Calculate margin and rank every region by Q2 revenue",
      detail: "The query reads only workspace_data and returns a deterministic regional view.",
    };
  }

  if (/汇总|季度|summary|total|总计/i.test(prompt)) {
    return {
      nextSource: `SELECT
  SUM("Q2 Revenue") AS total_q2_revenue,
  SUM("Q1 Revenue") AS total_q1_revenue,
  ROUND((SUM("Q2 Revenue") / SUM("Q1 Revenue") - 1) * 100, 1) AS qoq_growth_pct,
  SUM(Customers) AS customers
FROM workspace_data;`,
      summary: "Summarize the quarter from the canonical workspace data",
      detail: "One aggregate row is computed locally from revenue and customer columns.",
    };
  }

  throw new Error("Try calculating margin and ranking regions, or summarizing quarterly revenue.");
}

function planChart(source: string, prompt: string): LocalPlan {
  const parsed = parseChartSource(source);
  if (!parsed.spec) throw new Error(parsed.errors[0] ?? "The chart specification is invalid.");
  if (/顺序|source order|原始/i.test(prompt)) {
    return {
      nextSource: JSON.stringify({ ...parsed.spec, sort: "source" }, null, 2),
      summary: "Use the canonical data source order",
      detail: "Only the chart sort policy changes; fields and data stay untouched.",
    };
  }
  if (/紫色|purple|violet/i.test(prompt)) {
    return {
      nextSource: JSON.stringify({ ...parsed.spec, color: "#8267ce" }, null, 2),
      summary: "Use the presentation accent for this chart",
      detail: "The chart remains data-bound; only its validated color token changes.",
    };
  }
  throw new Error("Try keeping source order or changing the chart accent to purple.");
}

export function planLocalChange(artifact: WorkspaceArtifact, prompt: string): LocalPlan {
  if (!prompt.trim()) throw new Error("Describe the change you want Rune to make.");
  if (artifact.kind === "document") return planDocument(artifact.source, prompt);
  if (artifact.kind === "data") return planData(artifact.source, prompt);
  if (artifact.kind === "query") return planQuery(prompt);
  if (artifact.kind === "chart") return planChart(artifact.source, prompt);
  return planSlides(artifact, prompt);
}

export function planLocalWorkspaceChange(artifacts: WorkspaceArtifact[], prompt: string): LocalWorkspacePlan {
  const instruction = prompt.trim();
  if (!instruction) throw new Error("Describe the workspace outcome you want Rune to coordinate.");
  if (!/同步|一致|workspace|all artifacts|所有|全局|报告|演示/i.test(instruction)) {
    throw new Error("Try synchronizing the quarterly conclusion across the report and presentation.");
  }

  const patches: LocalWorkspacePlan["patches"] = [];
  const document = artifacts.find((artifact) => artifact.kind === "document");
  const query = artifacts.find((artifact) => artifact.kind === "query");
  const slides = artifacts.find((artifact) => artifact.kind === "slides");

  if (document) {
    const plan = planDocument(document.source, "把摘要压缩成三条要点");
    if (plan.nextSource !== document.source) patches.push({ artifactId: document.id, ...plan });
  }
  if (query && /分析|query|sql|一致|所有|全局/i.test(instruction)) {
    const plan = planQuery("计算利润率并排序");
    if (plan.nextSource !== query.source) patches.push({ artifactId: query.id, ...plan });
  }
  if (slides) {
    const plan = planSlides(slides, "新增一页结论");
    if (plan.nextSource !== slides.source) patches.push({ artifactId: slides.id, ...plan });
  }

  if (patches.length < 2) throw new Error("Rune needs at least a report and presentation to coordinate this workspace action.");
  return {
    summary: `Synchronize the quarterly narrative across ${patches.length} artifacts`,
    detail: "Each canonical source changes independently, then the complete workspace is validated and applied as one transaction.",
    patches,
  };
}

export function detectArtifact(name: string, source: string): WorkspaceArtifact | null {
  const extension = name.split(".").pop()?.toLowerCase();
  const common = { id: `import-${Date.now()}`, name, source };
  if (name.toLowerCase().endsWith(".chart.json")) {
    return { ...common, kind: "chart", language: "Chart JSON" };
  }
  if (name.toLowerCase().endsWith(".deck.md")) {
    return { ...common, kind: "slides", language: "Deck Markdown" };
  }
  if (extension === "md" || extension === "markdown") {
    return { ...common, kind: "document", language: "Markdown" };
  }
  if (extension === "csv" || extension === "json") {
    return { ...common, kind: "data", language: extension === "json" ? "JSON" : "CSV" };
  }
  if (extension === "sql") {
    return { ...common, kind: "query", language: "DuckDB SQL" };
  }
  if (extension === "html" || extension === "htm") {
    return { ...common, kind: "slides", language: "Semantic HTML" };
  }
  return null;
}
