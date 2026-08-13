import {
  artifactCreationSourceOptions,
  prepareArtifactCreation,
  type ChartCreationFormat,
  type ChartCreationMark,
} from "./artifact-creation.ts";
import { formatChartReference } from "./charts.ts";
import {
  prepareWorkspaceMutation,
  type ArtifactCreationChange,
} from "./patches.ts";
import { formatQueryDataSourceDirective } from "./query-source.ts";
import { parseDataSource, type WorkspaceArtifact } from "./workspace.ts";
import type { RuneLocale } from "./localization.ts";

export const MAX_OPERATING_REVIEW_TITLE_CHARS = 60;
export const MAX_OPERATING_REVIEW_PERIOD_CHARS = 60;
export const MAX_OPERATING_REVIEW_FOCUS_CHARS = 140;

export type OperatingReviewAudience = "leadership" | "board" | "team";
export type OperatingReviewAggregation = "sum" | "average";
export type OperatingReviewDeliverable = "document" | "slides";

export type OperatingReviewInput = {
  title: string;
  dataArtifactId: string;
  category: string;
  value: string;
  aggregation: OperatingReviewAggregation;
  mark: ChartCreationMark;
  format: ChartCreationFormat;
  period: string;
  audience: OperatingReviewAudience;
  focus: string;
  deliverables: OperatingReviewDeliverable[];
  locale: RuneLocale;
};

export type OperatingReviewPlan = {
  summary: string;
  detail: string;
  patches: [];
  creations: ArtifactCreationChange[];
};

export type PreparedOperatingReview = {
  plan?: OperatingReviewPlan;
  errors: string[];
};

const audienceLabels = {
  "zh-CN": {
    leadership: "管理层",
    board: "董事会",
    team: "执行团队",
  },
  en: {
    leadership: "Leadership",
    board: "Board",
    team: "Operating team",
  },
} as const;

function normalizeTaskText(value: string) {
  return value.normalize("NFKC").replace(/[\t ]+/gu, " ").trim();
}

function validateTaskText(value: string, label: string, maxChars: number) {
  if (!value.trim()) return `${label} is required.`;
  if (/[\r\n\u0000-\u001f\u007f<>{}]/u.test(value)) {
    return `${label} must be one plain-text line without angle brackets or binding braces.`;
  }
  if (normalizeTaskText(value).length > maxChars) return `${label} is limited to ${maxChars} characters.`;
  return "";
}

function markdownInline(value: string) {
  return value.replace(/[\\`*_\[\]#|]/gu, (character) => `\\${character}`);
}

function quoteSqlIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function fieldIsSafe(value: string) {
  return value.length > 0
    && value.length <= 120
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function clipped(value: string, maxChars: number) {
  const characters = [...value];
  return characters.length <= maxChars ? value : `${characters.slice(0, Math.max(1, maxChars - 1)).join("")}…`;
}

function querySource(input: OperatingReviewInput) {
  const category = quoteSqlIdentifier(input.category);
  const value = quoteSqlIdentifier(input.value);
  const aggregate = input.aggregation === "average" ? "AVG" : "SUM";
  const order = input.mark === "line" ? "MIN(rowid)" : `${value} DESC`;
  return `${formatQueryDataSourceDirective(input.dataArtifactId)}
SELECT
  ${category},
  ${aggregate}(${value}) AS ${value}
FROM workspace_data
WHERE ${category} IS NOT NULL
  AND TRIM(CAST(${category} AS VARCHAR)) <> ''
  AND ${value} IS NOT NULL
GROUP BY ${category}
ORDER BY ${order}
LIMIT 20;
`;
}

function reportSource(
  input: OperatingReviewInput,
  data: WorkspaceArtifact,
  chart: WorkspaceArtifact,
) {
  const zh = input.locale === "zh-CN";
  const title = markdownInline(normalizeTaskText(input.title));
  const period = markdownInline(normalizeTaskText(input.period));
  const focus = markdownInline(normalizeTaskText(input.focus));
  const category = markdownInline(input.category);
  const value = markdownInline(input.value);
  const sourceName = markdownInline(data.name);
  const audience = audienceLabels[input.locale][input.audience];
  const aggregation = input.aggregation === "average"
    ? zh ? "平均值" : "average"
    : zh ? "合计值" : "sum";
  const chartBinding = formatChartReference(chart.id);

  if (zh) {
    return `# ${title}

> **任务范围** · ${period} · ${audience} · 本地来源 \`${sourceName}\`

## 本次目标

${focus}

## 可核验视图

以下视图按 **${category}** 汇总 **${value}** 的${aggregation}。Rune 没有在没有证据时自动补写经营结论；图表中的每个可证明数据点仍可回到原始来源。

${chartBinding}

## 审核问题

- 哪些 ${category} 对 ${value} 的贡献最高或变化最明显？
- 当前结果是否受到缺失值、口径变化或样本范围影响？
- 哪一项判断需要补充负责人、截止时间或下一步实验？

## 决策与行动

| 决策 / 行动 | 负责人 | 截止时间 | 证据 |
| --- | --- | --- | --- |
| 待审核后填写 | — | — | ${sourceName} |
`;
  }

  return `# ${title}

> **Task scope** · ${period} · ${audience} · local source \`${sourceName}\`

## Objective

${focus}

## Verifiable view

This view uses the ${aggregation} of **${value}** grouped by **${category}**. Rune has not invented a business conclusion without evidence; every provable chart datum can still return to canonical source.

${chartBinding}

## Review questions

- Which ${category} entries contribute most to ${value}, or changed most materially?
- Could missing values, definition changes, or scope affect the result?
- Which decision needs an owner, due date, or next experiment?

## Decisions and actions

| Decision / action | Owner | Due | Evidence |
| --- | --- | --- | --- |
| Complete after review | — | — | ${sourceName} |
`;
}

function deckSource(
  input: OperatingReviewInput,
  data: WorkspaceArtifact,
  chart: WorkspaceArtifact,
) {
  const zh = input.locale === "zh-CN";
  const title = markdownInline(normalizeTaskText(input.title));
  const period = markdownInline(normalizeTaskText(input.period));
  const focus = markdownInline(normalizeTaskText(input.focus));
  const category = markdownInline(input.category);
  const value = markdownInline(input.value);
  const sourceName = markdownInline(data.name);
  const audience = audienceLabels[input.locale][input.audience];
  const chartBinding = formatChartReference(chart.id);
  return `---
version: 1
title: ${normalizeTaskText(input.title)}
theme: rune
ratio: 16:9
lang: ${input.locale}
---

<!-- layout: cover -->
<!-- eyebrow: ${zh ? "经营汇报" : "Operating review"} -->

# ${title}

${period} · ${audience}

---

<!-- layout: split -->
<!-- eyebrow: ${zh ? "可核验证据" : "Verifiable evidence"} -->

## ${value} ${zh ? "按" : "by"} ${category}

${chartBinding}

---

<!-- layout: content -->
<!-- eyebrow: ${zh ? "任务重点" : "Task focus"} -->

## ${zh ? "本次需要回答什么" : "What this review must answer"}

${focus}

- ${zh ? `检查 ${sourceName} 的范围与口径` : `Confirm the scope and definitions in ${sourceName}`}
- ${zh ? "对关键变化补充负责人和下一步" : "Assign an owner and next step to material changes"}
- ${zh ? "审核后再形成最终经营结论" : "Form the final business conclusion only after review"}

---

<!-- layout: conclusion -->
<!-- eyebrow: ${zh ? "决策" : "Decision"} -->

## ${zh ? "证据已连接，结论等待审核。" : "Evidence is connected; the conclusion awaits review."}

${zh ? "所有应用动作仍需在 Rune 的事务审核中明确确认。" : "Every apply remains subject to an explicit Rune transaction review."}
`;
}

function uniqueDeliverables(deliverables: OperatingReviewDeliverable[]) {
  return [...new Set(deliverables)].filter((item): item is OperatingReviewDeliverable => (
    item === "document" || item === "slides"
  ));
}

export function prepareOperatingReviewWorkflow(
  artifacts: WorkspaceArtifact[],
  input: OperatingReviewInput,
): PreparedOperatingReview {
  const errors = [
    validateTaskText(input.title, "Review title", MAX_OPERATING_REVIEW_TITLE_CHARS),
    validateTaskText(input.period, "Reporting period", MAX_OPERATING_REVIEW_PERIOD_CHARS),
    validateTaskText(input.focus, "Review focus", MAX_OPERATING_REVIEW_FOCUS_CHARS),
  ].filter(Boolean);
  if (!["leadership", "board", "team"].includes(input.audience)) errors.push("Choose a supported audience.");
  if (!["sum", "average"].includes(input.aggregation)) errors.push("Choose sum or average aggregation.");
  if (!["bar", "line"].includes(input.mark)) errors.push("Choose a supported chart form.");
  if (!["number", "currency", "percent"].includes(input.format)) errors.push("Choose a supported number format.");
  if (input.locale !== "zh-CN" && input.locale !== "en") errors.push("Choose a supported interface language.");

  const deliverables = uniqueDeliverables(input.deliverables);
  if (!deliverables.length) errors.push("Choose at least one deliverable.");
  if (deliverables.length !== input.deliverables.length) errors.push("Deliverable choices must be unique and supported.");

  const sourceOptions = artifactCreationSourceOptions(artifacts, "query");
  const sourceOption = sourceOptions.find((option) => option.artifactId === input.dataArtifactId);
  const data = artifacts.find((artifact) => artifact.id === input.dataArtifactId);
  if (!sourceOption || !data || data.kind !== "data") errors.push("Choose one exact valid Data source.");
  if (!fieldIsSafe(input.category) || sourceOption?.columns.filter((column) => column === input.category).length !== 1) {
    errors.push("Choose one exact visible category field from the selected Data source.");
  }
  if (!fieldIsSafe(input.value) || sourceOption?.columns.filter((column) => column === input.value).length !== 1) {
    errors.push("Choose one exact visible value field from the selected Data source.");
  }
  if (input.category === input.value) errors.push("Category and value must use different fields.");

  if (data) {
    const parsed = parseDataSource(data.source);
    if (parsed.errors.length || !parsed.rows.length) errors.push("The selected Data source needs at least one valid row.");
    const valueIsStrictlyNumeric = parsed.rows.length > 0 && parsed.rows.every((row) => (
      typeof row[input.value] === "number" && Number.isFinite(row[input.value])
    ));
    if (!valueIsStrictlyNumeric) errors.push("The selected value field must contain only finite numeric values, not formatted text.");
  }
  if (errors.length || !data) return { errors: [...new Set(errors)] };

  const title = normalizeTaskText(input.title);
  const queryPrepared = prepareArtifactCreation(artifacts, {
    kind: "query",
    title: `${title} Analysis`,
    sourceArtifactId: data.id,
  });
  if (!queryPrepared.artifact || queryPrepared.errors.length) {
    return { errors: queryPrepared.errors.length ? queryPrepared.errors : ["Rune could not prepare the mapped analysis."] };
  }
  const query = { ...queryPrepared.artifact, source: querySource(input) };
  let workingArtifacts = [...artifacts, query];

  const chartPrepared = prepareArtifactCreation(workingArtifacts, {
    kind: "chart",
    title: `${title} View`,
    sourceArtifactId: query.id,
    category: input.category,
    value: input.value,
    mark: input.mark,
    format: input.format,
  });
  if (!chartPrepared.artifact || chartPrepared.errors.length) {
    return { errors: chartPrepared.errors.length ? chartPrepared.errors : ["Rune could not prepare the mapped chart."] };
  }
  const chart = {
    ...chartPrepared.artifact,
    source: `${JSON.stringify({
      version: 1,
      title: clipped(`${input.value} by ${input.category}`, 120),
      description: clipped(`${input.aggregation === "average" ? "Average" : "Sum"} for ${normalizeTaskText(input.period)} · ${data.name}`, 240),
      source: query.id,
      mark: input.mark,
      category: input.category,
      value: input.value,
      sort: input.mark === "line" ? "source" : "descending",
      format: input.format,
      color: "#ff5c35",
      maxItems: 8,
    }, null, 2)}\n`,
  };
  workingArtifacts = [...workingArtifacts, chart];

  const creations: ArtifactCreationChange[] = [
    {
      artifact: query,
      summary: `Aggregate ${input.value} by ${input.category} from ${data.name}`,
      detail: `The Query keeps an exact Data binding and ${input.aggregation === "average" ? "averages" : "sums"} one explicitly selected numeric field.`,
    },
    {
      artifact: chart,
      summary: `Create a live ${input.mark} view from ${query.name}`,
      detail: "The Chart reads the mapped Query output and retains the selected fields as canonical source.",
    },
  ];

  for (const deliverable of deliverables) {
    const prepared = prepareArtifactCreation(workingArtifacts, {
      kind: deliverable,
      title: `${title} ${deliverable === "document" ? "Report" : "Briefing"}`,
    });
    if (!prepared.artifact || prepared.errors.length) {
      return { errors: prepared.errors.length ? prepared.errors : [`Rune could not prepare the ${deliverable} deliverable.`] };
    }
    const artifact = {
      ...prepared.artifact,
      source: deliverable === "document"
        ? reportSource(input, data, chart)
        : deckSource(input, data, chart),
    };
    creations.push({
      artifact,
      summary: `Create ${artifact.name} with one live Chart binding`,
      detail: `The ${deliverable === "document" ? "report" : "presentation"} records the chosen period, audience, focus, and exact evidence route without inventing unsupported conclusions.`,
    });
    workingArtifacts = [...workingArtifacts, artifact];
  }

  const mutation = prepareWorkspaceMutation(artifacts, [], creations);
  if (mutation.errors.length) return { errors: mutation.errors };
  const zh = input.locale === "zh-CN";
  return {
    errors: [],
    plan: {
      summary: zh
        ? `为「${title}」创建一条可核验经营汇报链`
        : `Create a verifiable operating-review chain for “${title}”`,
      detail: zh
        ? `Rune 将 ${data.name}、字段映射、SQL、图表和 ${deliverables.length} 份成品编译成一次原子审核事务。`
        : `Rune compiled ${data.name}, explicit field mappings, SQL, a live Chart, and ${deliverables.length} deliverable${deliverables.length === 1 ? "" : "s"} into one atomic review transaction.`,
      patches: [],
      creations,
    },
  };
}
