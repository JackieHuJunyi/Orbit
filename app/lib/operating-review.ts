import {
  artifactCreationSourceOptions,
  prepareArtifactCreation,
  type ChartCreationFormat,
  type ChartCreationMark,
} from "./artifact-creation.ts";
import { formatChartReference } from "./charts.ts";
import { formatQueryMetricReference } from "./bindings.ts";
import {
  prepareWorkspaceMutation,
  type ArtifactCreationChange,
  type ArtifactSourcePatch,
} from "./patches.ts";
import { formatQueryDataSourceDirective } from "./query-source.ts";
import { parseDataSource, type WorkspaceArtifact } from "./workspace.ts";
import { isChineseRuneLocale, normalizeRuneLocale, runeText, type RuneLocale } from "./localization.ts";
import {
  MAX_OPERATING_REVIEW_EVIDENCE_ROWS,
  validateOperatingReviewNarrative,
  type OperatingReviewEvidenceRow,
  type OperatingReviewNarrative,
} from "./operating-review-contract.ts";
import {
  formatOperatingReviewScopeLabel,
  formatOperatingReviewScopePredicate,
  normalizeOperatingReviewScope,
  prepareOperatingReviewScope,
  type OperatingReviewScope,
} from "./operating-review-scope.ts";
import {
  appendOperatingReviewDeliveryOutcome as appendDeliveryOutcome,
  createOperatingReviewDeliveryOutcome,
  normalizeOperatingReviewDeliveryOutcomes,
  summarizeOperatingReviewDeliveryOutcomes,
  type OperatingReviewDeliveryMethod,
  type OperatingReviewDeliveryOutcome,
  type OperatingReviewDeliveryRating,
  type OperatingReviewDeliveryTarget,
} from "./delivery-outcomes.ts";

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
  scope?: OperatingReviewScope | null;
  period: string;
  audience: OperatingReviewAudience;
  focus: string;
  deliverables: OperatingReviewDeliverable[];
  locale: RuneLocale;
};

export const MAX_SAVED_OPERATING_REVIEWS = 8;
export const MAX_OPERATING_REVIEW_RUNS = 12;

export type OperatingReviewArtifactIds = {
  query: string;
  chart: string;
  document?: string;
  slides?: string;
};

export type SavedOperatingReview = {
  version: 1;
  id: string;
  input: OperatingReviewInput;
  artifactIds: OperatingReviewArtifactIds;
  runs: OperatingReviewRun[];
  deliveries: OperatingReviewDeliveryOutcome[];
};

export type OperatingReviewRun = {
  version: 1;
  id: string;
  completedAt: string;
  period: string;
  status: "applied" | "stopped";
  stopReason: "validation" | "runtime" | "stale" | "persistence" | "cancelled" | null;
  provider: "local" | "openai";
  changedFileCount: number;
  queryCount: number;
  chartConsumerCount: number;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type PreparedSavedOperatingReview = PreparedOperatingReview & {
  workflow?: SavedOperatingReview;
};

export type OperatingReviewPlan = {
  summary: string;
  detail: string;
  patches: ArtifactSourcePatch[];
  creations: ArtifactCreationChange[];
};

export type PreparedOperatingReview = {
  plan?: OperatingReviewPlan;
  errors: string[];
};

export type { OperatingReviewNarrative } from "./operating-review-contract.ts";

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
  "zh-TW": {
    leadership: "管理層",
    board: "董事會",
    team: "執行團隊",
  },
} as const;

function audienceLabel(locale: RuneLocale, audience: OperatingReviewAudience) {
  if (locale === "zh-CN" || locale === "zh-TW" || locale === "en") return audienceLabels[locale][audience];
  return runeText(locale, audienceLabels.en[audience], audienceLabels.en[audience]);
}

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

export function prepareOperatingReviewEvidence(
  artifacts: WorkspaceArtifact[],
  input: OperatingReviewInput,
) {
  const data = artifacts.find((artifact) => artifact.id === input.dataArtifactId);
  if (!data || data.kind !== "data") return { errors: ["Choose one exact valid Data source."] };
  const parsed = parseDataSource(data.source);
  if (parsed.errors.length || !parsed.rows.length) {
    return { errors: ["The selected Data source needs at least one valid row."] };
  }
  if (!parsed.columns.includes(input.category) || !parsed.columns.includes(input.value)) {
    return { errors: ["The selected evidence fields are missing from the current Data source."] };
  }
  const preparedScope = prepareOperatingReviewScope(parsed.rows, parsed.columns, input.scope);
  if (preparedScope.errors.length) return { errors: preparedScope.errors };
  const groups = new Map<string, {
    category: string;
    sum: number;
    count: number;
    sourceOrder: number;
  }>();
  for (const [rowIndex, row] of preparedScope.rows.entries()) {
    const categoryValue = row[input.category];
    const numericValue = row[input.value];
    if (categoryValue == null || !String(categoryValue).trim()) continue;
    if (typeof numericValue !== "number" || !Number.isFinite(numericValue)) {
      return { errors: ["The selected value field must contain only finite numeric values, not formatted text."] };
    }
    const key = JSON.stringify([typeof categoryValue, categoryValue]);
    const current = groups.get(key);
    if (current) {
      current.sum += numericValue;
      current.count += 1;
    } else {
      groups.set(key, {
        category: clipped(String(categoryValue).replace(/[\r\n]+/gu, " ").trim(), 120),
        sum: numericValue,
        count: 1,
        sourceOrder: rowIndex,
      });
    }
  }
  if (!groups.size) return { errors: ["The selected category field has no usable values."] };
  const aggregated = [...groups.values()].map((group) => ({
    ...group,
    value: input.aggregation === "average" ? group.sum / group.count : group.sum,
  }));
  if (input.mark === "bar") {
    aggregated.sort((left, right) => right.value - left.value || left.sourceOrder - right.sourceOrder);
  } else {
    aggregated.sort((left, right) => left.sourceOrder - right.sourceOrder);
  }
  const evidenceRows: OperatingReviewEvidenceRow[] = aggregated
    .slice(0, MAX_OPERATING_REVIEW_EVIDENCE_ROWS)
    .map((group, index) => ({
      id: `result-${index + 1}`,
      category: group.category,
      value: group.value,
      sourceRowCount: group.count,
    }));
  return {
    data,
    evidenceRows,
    scope: preparedScope.scope,
    matchedRowCount: preparedScope.rows.length,
    errors: [],
  };
}

function querySource(input: OperatingReviewInput, scope: OperatingReviewScope | null) {
  const category = quoteSqlIdentifier(input.category);
  const value = quoteSqlIdentifier(input.value);
  const aggregate = input.aggregation === "average" ? "AVG" : "SUM";
  const order = input.mark === "line" ? "MIN(rowid)" : `${value} DESC`;
  return `${formatQueryDataSourceDirective(input.dataArtifactId)}
SELECT
  ${category},
  ${aggregate}(CAST(${value} AS DOUBLE)) AS ${value}
FROM workspace_data
WHERE ${category} IS NOT NULL
  AND TRIM(CAST(${category} AS VARCHAR)) <> ''
${formatOperatingReviewScopePredicate(scope)}  AND ${value} IS NOT NULL
GROUP BY ${category}
ORDER BY ${order}
LIMIT 20;
`;
}

function operatingReviewScopeText(locale: RuneLocale, scope: OperatingReviewScope | null) {
  if (!scope) return isChineseRuneLocale(locale) ? "全部数据行" : "all Data rows";
  return formatOperatingReviewScopeLabel(scope);
}

function narrativeEvidenceBinding(
  query: WorkspaceArtifact,
  input: OperatingReviewInput,
  evidenceRowId: string,
) {
  const rowIndex = Number(evidenceRowId.replace(/^result-/u, "")) - 1;
  return formatQueryMetricReference({
    queryArtifactId: query.id,
    column: input.value,
    format: input.format,
    rowIndex,
  });
}

function reportNarrativeSource(
  input: OperatingReviewInput,
  query: WorkspaceArtifact,
  narrative?: OperatingReviewNarrative,
) {
  if (!narrative) return "";
  const zh = isChineseRuneLocale(input.locale);
  const prompts = narrative.insights.map((insight) => {
    const primary = narrativeEvidenceBinding(query, input, insight.primaryEvidenceRowId);
    const supporting = insight.supportingEvidenceRowId
      ? narrativeEvidenceBinding(query, input, insight.supportingEvidenceRowId)
      : "";
    return `<!-- rune:evidence ${query.id} ${insight.primaryEvidenceRowId}${insight.supportingEvidenceRowId ? ` ${insight.supportingEvidenceRowId}` : ""} -->
### ${markdownInline(normalizeTaskText(insight.title))}

${markdownInline(normalizeTaskText(insight.question))}

> **${zh ? "实时证据" : "Live evidence"}** · ${zh ? "主要汇总" : "Primary aggregate"} ${primary}${supporting ? ` · ${zh ? "对照汇总" : "Comparison aggregate"} ${supporting}` : ""}

**${zh ? "待审核的决策提示" : "Decision prompt to review"}** · ${markdownInline(normalizeTaskText(insight.decisionPrompt))}`;
  }).join("\n\n");
  return `## ${zh ? "证据驱动的审核提示" : "Evidence-led review prompts"}

${zh ? "以下问题由模型根据有界聚合证据提出；数字仍由当前 Query 实时编译，问题与决策提示必须由你审核。" : "A configured model proposed these questions from bounded aggregate evidence. Every number still compiles live from the current Query; review each question and decision prompt."}

${prompts}

`;
}

function deckNarrativeSource(
  input: OperatingReviewInput,
  query: WorkspaceArtifact,
  narrative?: OperatingReviewNarrative,
) {
  if (!narrative) return "";
  const zh = isChineseRuneLocale(input.locale);
  return narrative.insights.map((insight) => {
    const primary = narrativeEvidenceBinding(query, input, insight.primaryEvidenceRowId);
    const supporting = insight.supportingEvidenceRowId
      ? narrativeEvidenceBinding(query, input, insight.supportingEvidenceRowId)
      : "";
    return `### ${markdownInline(normalizeTaskText(insight.title))}

${markdownInline(normalizeTaskText(insight.question))}

- **${zh ? "实时证据" : "Live evidence"}** · ${primary}${supporting ? ` · ${supporting}` : ""}
- **${zh ? "待审核" : "Review"}** · ${markdownInline(normalizeTaskText(insight.decisionPrompt))}`;
  }).join("\n\n");
}

function reportSource(
  input: OperatingReviewInput,
  data: WorkspaceArtifact,
  query: WorkspaceArtifact,
  chart: WorkspaceArtifact,
  scope: OperatingReviewScope | null,
  narrative?: OperatingReviewNarrative,
) {
  const zh = isChineseRuneLocale(input.locale);
  const title = markdownInline(normalizeTaskText(input.title));
  const period = markdownInline(normalizeTaskText(input.period));
  const focus = markdownInline(normalizeTaskText(input.focus));
  const category = markdownInline(input.category);
  const value = markdownInline(input.value);
  const sourceName = markdownInline(data.name);
  const audience = audienceLabel(input.locale, input.audience);
  const aggregation = input.aggregation === "average"
    ? zh ? "平均值" : "average"
    : zh ? "合计值" : "sum";
  const chartBinding = formatChartReference(chart.id);
  const scopeText = markdownInline(operatingReviewScopeText(input.locale, scope));
  const narrativeSource = reportNarrativeSource(input, query, narrative);

  if (zh) {
    const source = `# ${title}

> **任务范围** · ${period} · ${audience} · ${scopeText} · 本地来源 \`${sourceName}\`

## 本次目标

${focus}

## 可核验视图

以下视图仅在 **${scopeText}** 范围内按 **${category}** 汇总 **${value}** 的${aggregation}。Rune 没有在没有证据时自动补写经营结论；图表中的每个可证明数据点仍可回到原始来源。

${chartBinding}

${narrativeSource}## 审核问题

- 哪些 ${category} 对 ${value} 的贡献最高或变化最明显？
- 当前结果是否受到缺失值、口径变化或样本范围影响？
- 哪一项判断需要补充负责人、截止时间或下一步实验？

## 决策与行动

| 决策 / 行动 | 负责人 | 截止时间 | 证据 |
| --- | --- | --- | --- |
| 待审核后填写 | — | — | ${sourceName} |
`;
    return runeText(input.locale, source, source, [title, period, focus, category, value, sourceName, chartBinding, ...(scope ? [scopeText] : [])]);
  }

  return `# ${title}

> **Task scope** · ${period} · ${audience} · ${scopeText} · local source \`${sourceName}\`

## Objective

${focus}

## Verifiable view

Within **${scopeText}**, this view uses the ${aggregation} of **${value}** grouped by **${category}**. Rune has not invented a business conclusion without evidence; every provable chart datum can still return to canonical source.

${chartBinding}

${narrativeSource}## Review questions

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
  query: WorkspaceArtifact,
  chart: WorkspaceArtifact,
  scope: OperatingReviewScope | null,
  narrative?: OperatingReviewNarrative,
) {
  const zh = isChineseRuneLocale(input.locale);
  const title = markdownInline(normalizeTaskText(input.title));
  const period = markdownInline(normalizeTaskText(input.period));
  const focus = markdownInline(normalizeTaskText(input.focus));
  const category = markdownInline(input.category);
  const value = markdownInline(input.value);
  const sourceName = markdownInline(data.name);
  const audience = audienceLabel(input.locale, input.audience);
  const chartBinding = formatChartReference(chart.id);
  const scopeText = markdownInline(operatingReviewScopeText(input.locale, scope));
  const narrativeSource = deckNarrativeSource(input, query, narrative);
  const source = `---
version: 1
title: ${normalizeTaskText(input.title)}
theme: rune
ratio: 16:9
lang: ${input.locale}
---

<!-- layout: cover -->
<!-- eyebrow: ${zh ? "经营汇报" : "Operating review"} -->

# ${title}

${period} · ${audience} · ${scopeText}

---

<!-- layout: split -->
<!-- eyebrow: ${zh ? "可核验证据" : "Verifiable evidence"} -->

## ${value} ${zh ? "按" : "by"} ${category}

${zh ? "数据范围" : "Data scope"} · ${scopeText}

${chartBinding}

---

<!-- layout: content -->
<!-- eyebrow: ${zh ? "任务重点" : "Task focus"} -->

## ${narrative ? zh ? "哪些证据需要决定" : "What the evidence must decide" : zh ? "本次需要回答什么" : "What this review must answer"}

${narrative ? narrativeSource : `${focus}

- ${zh ? `检查 ${sourceName} 的范围与口径` : `Confirm the scope and definitions in ${sourceName}`}
- ${zh ? "对关键变化补充负责人和下一步" : "Assign an owner and next step to material changes"}
- ${zh ? "审核后再形成最终经营结论" : "Form the final business conclusion only after review"}`}

---

<!-- layout: conclusion -->
<!-- eyebrow: ${zh ? "决策" : "Decision"} -->

## ${zh ? "证据已连接，结论等待审核。" : "Evidence is connected; the conclusion awaits review."}

${zh ? "所有应用动作仍需在 Rune 的事务审核中明确确认。" : "Every apply remains subject to an explicit Rune transaction review."}
`;
  return zh ? runeText(input.locale, source, source, [title, period, focus, category, value, sourceName, chartBinding, ...(scope ? [scopeText] : [])]) : source;
}

function uniqueDeliverables(deliverables: OperatingReviewDeliverable[]) {
  return [...new Set(deliverables)].filter((item): item is OperatingReviewDeliverable => (
    item === "document" || item === "slides"
  ));
}

export function prepareOperatingReviewWorkflow(
  artifacts: WorkspaceArtifact[],
  input: OperatingReviewInput,
  narrative?: OperatingReviewNarrative,
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
  if (!normalizeRuneLocale(input.locale)) errors.push("Choose a supported interface language.");

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

  let evidence: ReturnType<typeof prepareOperatingReviewEvidence> | undefined;
  if (data && sourceOption
    && fieldIsSafe(input.category) && sourceOption.columns.includes(input.category)
    && fieldIsSafe(input.value) && sourceOption.columns.includes(input.value)
    && input.category !== input.value) {
    evidence = prepareOperatingReviewEvidence(artifacts, input);
    if (evidence.errors.length) errors.push(...evidence.errors);
  }
  if (errors.length || !data || !evidence?.evidenceRows) return { errors: [...new Set(errors)] };
  const scope = evidence.scope ?? null;
  if (narrative) {
    const validatedNarrative = validateOperatingReviewNarrative(narrative, evidence.evidenceRows);
    if (!validatedNarrative.narrative || validatedNarrative.errors.length) {
      return { errors: validatedNarrative.errors };
    }
    narrative = validatedNarrative.narrative;
  }

  const title = normalizeTaskText(input.title);
  const queryPrepared = prepareArtifactCreation(artifacts, {
    kind: "query",
    title: `${title} Analysis`,
    sourceArtifactId: data.id,
  });
  if (!queryPrepared.artifact || queryPrepared.errors.length) {
    return { errors: queryPrepared.errors.length ? queryPrepared.errors : ["Rune could not prepare the mapped analysis."] };
  }
  const query = { ...queryPrepared.artifact, source: querySource(input, scope) };
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
      description: clipped(`${input.aggregation === "average" ? "Average" : "Sum"} for ${normalizeTaskText(input.period)} · ${operatingReviewScopeText(input.locale, scope)} · ${data.name}`, 240),
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
      detail: `The Query keeps an exact Data binding, applies ${scope ? `the exact ${formatOperatingReviewScopeLabel(scope)} scope` : "all Data rows"}, and ${input.aggregation === "average" ? "averages" : "sums"} one explicitly selected numeric field.`,
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
        ? reportSource(input, data, query, chart, scope, narrative)
        : deckSource(input, data, query, chart, scope, narrative),
    };
    creations.push({
      artifact,
      summary: `Create ${artifact.name} with one live Chart binding`,
      detail: `The ${deliverable === "document" ? "report" : "presentation"} records the chosen period, audience, focus, and exact evidence route${narrative ? " with model-proposed questions whose numbers stay live Query bindings" : " without inventing unsupported conclusions"}.`,
    });
    workingArtifacts = [...workingArtifacts, artifact];
  }

  const mutation = prepareWorkspaceMutation(artifacts, [], creations);
  if (mutation.errors.length) return { errors: mutation.errors };
  const zh = isChineseRuneLocale(input.locale);
  const chineseSummary = `为「${title}」创建一条可核验经营汇报链`;
  const chineseDetail = `Rune 将 ${data.name}、字段映射、SQL、图表和 ${deliverables.length} 份成品编译成一次原子审核事务。`;
  return {
    errors: [],
    plan: {
      summary: zh
        ? runeText(input.locale, chineseSummary, chineseSummary, [title])
        : `Create a verifiable operating-review chain for “${title}”`,
      detail: zh
        ? runeText(input.locale, chineseDetail, chineseDetail, [data.name])
        : `Rune compiled ${data.name}, explicit field mappings, SQL, a live Chart, and ${deliverables.length} deliverable${deliverables.length === 1 ? "" : "s"} into one atomic review transaction.`,
      patches: [],
      creations,
    },
  };
}

function savedReviewId(artifactIds: OperatingReviewArtifactIds) {
  return `operating-review:${artifactIds.query}`;
}

function copyOperatingReviewInput(input: OperatingReviewInput): OperatingReviewInput {
  return {
    ...input,
    scope: normalizeOperatingReviewScope(input.scope) ?? null,
    deliverables: [...input.deliverables],
  };
}

export function createSavedOperatingReview(
  input: OperatingReviewInput,
  plan: OperatingReviewPlan,
): SavedOperatingReview | undefined {
  const byKind = new Map(plan.creations.map(({ artifact }) => [artifact.kind, artifact.id] as const));
  const query = byKind.get("query");
  const chart = byKind.get("chart");
  if (!query || !chart) return undefined;
  const document = byKind.get("document");
  const slides = byKind.get("slides");
  return {
    version: 1,
    id: savedReviewId({ query, chart, document, slides }),
    input: copyOperatingReviewInput(input),
    artifactIds: { query, chart, ...(document ? { document } : {}), ...(slides ? { slides } : {}) },
    runs: [],
    deliveries: [],
  };
}

function nonNegativeInteger(value: unknown, max: number) {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max ? Number(value) : undefined;
}

function normalizeOperatingReviewRuns(value: unknown): OperatingReviewRun[] {
  if (!Array.isArray(value)) return [];
  const runs: OperatingReviewRun[] = [];
  const ids = new Set<string>();
  for (const entry of value.slice(0, MAX_OPERATING_REVIEW_RUNS * 2)) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Partial<OperatingReviewRun>;
    const id = stringValue(candidate.id, 160);
    const period = stringValue(candidate.period, MAX_OPERATING_REVIEW_PERIOD_CHARS);
    const completedAt = stringValue(candidate.completedAt, 40);
    const status = candidate.status === "applied" || candidate.status === "stopped" ? candidate.status : undefined;
    const stopReason = candidate.stopReason === null
      || ["validation", "runtime", "stale", "persistence", "cancelled"].includes(candidate.stopReason ?? "")
      ? candidate.stopReason as OperatingReviewRun["stopReason"]
      : undefined;
    const changedFileCount = nonNegativeInteger(candidate.changedFileCount, 4);
    const queryCount = nonNegativeInteger(candidate.queryCount, 50);
    const chartConsumerCount = nonNegativeInteger(candidate.chartConsumerCount, 50);
    const durationMs = nonNegativeInteger(candidate.durationMs, 30 * 60 * 1000);
    const inputTokens = candidate.inputTokens === null ? null : nonNegativeInteger(candidate.inputTokens, 10_000_000);
    const outputTokens = candidate.outputTokens === null ? null : nonNegativeInteger(candidate.outputTokens, 10_000_000);
    if (candidate.version !== 1 || !id || ids.has(id) || !period || !completedAt || !status
      || Number.isNaN(Date.parse(completedAt)) || (candidate.provider !== "local" && candidate.provider !== "openai")
      || stopReason === undefined || (status === "applied" ? stopReason !== null : stopReason === null)
      || changedFileCount == null || queryCount == null || chartConsumerCount == null || durationMs == null
      || inputTokens === undefined || outputTokens === undefined) continue;
    ids.add(id);
    runs.push({
      version: 1,
      id,
      completedAt: new Date(completedAt).toISOString(),
      period,
      status,
      stopReason,
      provider: candidate.provider,
      changedFileCount,
      queryCount,
      chartConsumerCount,
      durationMs,
      inputTokens,
      outputTokens,
    });
    if (runs.length >= MAX_OPERATING_REVIEW_RUNS) break;
  }
  return runs.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

export function appendOperatingReviewRun(
  workflow: SavedOperatingReview,
  run: OperatingReviewRun,
): SavedOperatingReview {
  const normalized = normalizeOperatingReviewRuns([run, ...workflow.runs]);
  return { ...workflow, runs: normalized };
}

export function summarizeOperatingReviewRuns(runs: OperatingReviewRun[]) {
  const applied = runs.filter((run) => run.status === "applied");
  const modelRuns = runs.filter((run) => run.inputTokens != null && run.outputTokens != null);
  return {
    total: runs.length,
    applied: applied.length,
    stopped: runs.length - applied.length,
    successRate: runs.length ? Math.round((applied.length / runs.length) * 100) : null,
    averageDurationMs: runs.length
      ? Math.round(runs.reduce((total, run) => total + run.durationMs, 0) / runs.length)
      : null,
    modelRunCount: modelRuns.length,
    inputTokens: modelRuns.length ? modelRuns.reduce((total, run) => total + (run.inputTokens ?? 0), 0) : null,
    outputTokens: modelRuns.length ? modelRuns.reduce((total, run) => total + (run.outputTokens ?? 0), 0) : null,
  };
}

export async function recordOperatingReviewDelivery(input: {
  workflow: SavedOperatingReview;
  runId: string;
  artifactId: string;
  source: string;
  method: OperatingReviewDeliveryMethod;
  target: OperatingReviewDeliveryTarget;
  rating: OperatingReviewDeliveryRating;
  now?: Date;
}) {
  const workflow = normalizeSavedOperatingReviews([input.workflow])[0];
  if (!workflow) throw new Error("The saved operating review is no longer valid.");
  const run = workflow.runs.find((candidate) => candidate.id === input.runId);
  if (!run || run.status !== "applied") throw new Error("The applied task run is no longer available.");
  const deliverableArtifactIds = [workflow.artifactIds.document, workflow.artifactIds.slides].filter((value): value is string => Boolean(value));
  if (!deliverableArtifactIds.includes(input.artifactId)) throw new Error("This file is not an exact deliverable of the saved task.");
  const outcome = await createOperatingReviewDeliveryOutcome({
    run,
    artifactId: input.artifactId,
    source: input.source,
    method: input.method,
    target: input.target,
    rating: input.rating,
    now: input.now,
  });
  return {
    ...workflow,
    deliveries: appendDeliveryOutcome(workflow.deliveries, outcome, {
      appliedRunIds: workflow.runs.filter((candidate) => candidate.status === "applied").map((candidate) => candidate.id),
      deliverableArtifactIds,
    }),
  };
}

export { summarizeOperatingReviewDeliveryOutcomes };
export type { OperatingReviewDeliveryMethod, OperatingReviewDeliveryOutcome, OperatingReviewDeliveryRating, OperatingReviewDeliveryTarget };

function stringValue(value: unknown, maxChars: number) {
  return typeof value === "string" && value.length <= maxChars ? value : undefined;
}

export function normalizeSavedOperatingReviews(value: unknown): SavedOperatingReview[] {
  if (!Array.isArray(value)) return [];
  const normalized: SavedOperatingReview[] = [];
  const ids = new Set<string>();
  for (const entry of value.slice(0, MAX_SAVED_OPERATING_REVIEWS * 2)) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Partial<SavedOperatingReview>;
    const input = candidate.input as Partial<OperatingReviewInput> | undefined;
    const artifactIds = candidate.artifactIds as Partial<OperatingReviewArtifactIds> | undefined;
    const id = stringValue(candidate.id, 180);
    const title = stringValue(input?.title, MAX_OPERATING_REVIEW_TITLE_CHARS);
    const dataArtifactId = stringValue(input?.dataArtifactId, 120);
    const category = stringValue(input?.category, 120);
    const numericValue = stringValue(input?.value, 120);
    const period = stringValue(input?.period, MAX_OPERATING_REVIEW_PERIOD_CHARS);
    const focus = stringValue(input?.focus, MAX_OPERATING_REVIEW_FOCUS_CHARS);
    const query = stringValue(artifactIds?.query, 120);
    const chart = stringValue(artifactIds?.chart, 120);
    const document = artifactIds?.document == null ? undefined : stringValue(artifactIds.document, 120);
    const slides = artifactIds?.slides == null ? undefined : stringValue(artifactIds.slides, 120);
    const normalizedArtifactIds = query && chart
      ? { query, chart, ...(document ? { document } : {}), ...(slides ? { slides } : {}) }
      : undefined;
    const deliverables = Array.isArray(input?.deliverables)
      ? [...new Set(input.deliverables)].filter((item): item is OperatingReviewDeliverable => item === "document" || item === "slides")
      : [];
    const normalizedLocale = normalizeRuneLocale(input?.locale);
    const normalizedScope = normalizeOperatingReviewScope(input?.scope);
    if (candidate.version !== 1 || !id || ids.has(id) || !title || !dataArtifactId || !category
      || !numericValue || !period || !focus || !query || !chart || !deliverables.length
      || !normalizedArtifactIds || id !== savedReviewId(normalizedArtifactIds)
      || Boolean(validateTaskText(title, "Review title", MAX_OPERATING_REVIEW_TITLE_CHARS))
      || Boolean(validateTaskText(period, "Reporting period", MAX_OPERATING_REVIEW_PERIOD_CHARS))
      || Boolean(validateTaskText(focus, "Review focus", MAX_OPERATING_REVIEW_FOCUS_CHARS))
      || ![dataArtifactId, category, numericValue, query, chart, document, slides].filter(Boolean).every((item) => fieldIsSafe(item as string))
      || !["sum", "average"].includes(input?.aggregation ?? "")
      || !["bar", "line"].includes(input?.mark ?? "")
      || !["number", "currency", "percent"].includes(input?.format ?? "")
      || !["leadership", "board", "team"].includes(input?.audience ?? "")
      || !normalizedLocale
      || normalizedScope === undefined
      || (deliverables.includes("document") !== Boolean(document))
      || (deliverables.includes("slides") !== Boolean(slides))) continue;
    ids.add(id);
    const runs = normalizeOperatingReviewRuns(candidate.runs);
    const deliverableArtifactIds = [document, slides].filter((value): value is string => Boolean(value));
    normalized.push({
      version: 1,
      id,
      input: {
        title,
        dataArtifactId,
        category,
        value: numericValue,
        aggregation: input?.aggregation as OperatingReviewAggregation,
        mark: input?.mark as ChartCreationMark,
        format: input?.format as ChartCreationFormat,
        scope: normalizedScope,
        period,
        audience: input?.audience as OperatingReviewAudience,
        focus,
        deliverables,
        locale: normalizedLocale,
      },
      artifactIds: normalizedArtifactIds,
      runs,
      deliveries: normalizeOperatingReviewDeliveryOutcomes(candidate.deliveries, {
        appliedRunIds: runs.filter((run) => run.status === "applied").map((run) => run.id),
        deliverableArtifactIds,
      }),
    });
    if (normalized.length >= MAX_SAVED_OPERATING_REVIEWS) break;
  }
  return normalized;
}

export function prepareSavedOperatingReviewRerun(
  artifacts: WorkspaceArtifact[],
  workflow: SavedOperatingReview,
  input: OperatingReviewInput,
  narrative?: OperatingReviewNarrative,
): PreparedSavedOperatingReview {
  const normalized = normalizeSavedOperatingReviews([workflow])[0];
  if (!normalized || normalized.id !== workflow.id) return { errors: ["The saved operating review is invalid."] };
  const expectedDeliverables = normalized.input.deliverables;
  if (uniqueDeliverables(input.deliverables).join("|") !== expectedDeliverables.join("|")) {
    return { errors: ["A saved review keeps its existing report and presentation outputs when rerun."] };
  }
  const targets: Array<[keyof OperatingReviewArtifactIds, WorkspaceArtifact["kind"]]> = [
    ["query", "query"],
    ["chart", "chart"],
  ];
  if (expectedDeliverables.includes("document")) targets.push(["document", "document"]);
  if (expectedDeliverables.includes("slides")) targets.push(["slides", "slides"]);
  const targetArtifacts: WorkspaceArtifact[] = [];
  const targetIds = new Set<string>();
  for (const [key, kind] of targets) {
    const artifactId = normalized.artifactIds[key];
    const artifact = artifacts.find((item) => item.id === artifactId);
    if (!artifact || artifact.kind !== kind || targetIds.has(artifact.id)) {
      return { errors: [`The saved review can no longer find its exact ${kind} artifact.`] };
    }
    targetIds.add(artifact.id);
    targetArtifacts.push(artifact);
  }
  if (targetArtifacts.some((artifact) => artifact.id === input.dataArtifactId)) {
    return { errors: ["The saved review Data source cannot be one of its generated outputs."] };
  }
  const prepared = prepareOperatingReviewWorkflow(artifacts, input, narrative);
  if (!prepared.plan || prepared.errors.length) return prepared;
  const generatedByKind = new Map(prepared.plan.creations.map((creation) => [creation.artifact.kind, creation] as const));
  const generatedQuery = generatedByKind.get("query")?.artifact;
  const generatedChart = generatedByKind.get("chart")?.artifact;
  const actualQuery = targetArtifacts.find((artifact) => artifact.kind === "query");
  const actualChart = targetArtifacts.find((artifact) => artifact.kind === "chart");
  if (!generatedQuery || !generatedChart || !actualQuery || !actualChart) {
    return { errors: ["Rune could not rebuild the saved evidence chain."] };
  }
  const patches: ArtifactSourcePatch[] = [];
  for (const target of targetArtifacts) {
    const generated = generatedByKind.get(target.kind);
    if (!generated) return { errors: [`Rune could not rebuild the saved ${target.kind} output.`] };
    let nextSource = generated.artifact.source;
    if (target.kind === "chart") {
      const chartSource = JSON.parse(nextSource) as { source: string };
      chartSource.source = actualQuery.id;
      nextSource = `${JSON.stringify(chartSource, null, 2)}\n`;
    } else if (target.kind === "document" || target.kind === "slides") {
      nextSource = nextSource.replace(
        formatChartReference(generatedChart.id),
        formatChartReference(actualChart.id),
      );
      nextSource = nextSource.replaceAll(generatedQuery.id, actualQuery.id);
    }
    if (nextSource === target.source) continue;
    patches.push({
      artifactId: target.id,
      nextSource,
      summary: `Refresh ${target.name} from the saved operating review`,
      detail: generated.detail,
    });
  }
  if (!patches.length) return { errors: ["The saved review already matches these settings and current source mapping."] };
  const mutation = prepareWorkspaceMutation(artifacts, patches, []);
  if (mutation.errors.length) return { errors: mutation.errors };
  const zh = isChineseRuneLocale(input.locale);
  const chineseSummary = `更新已保存的「${normalizeTaskText(input.title)}」`;
  const chineseDetail = `Rune 将重新编译 ${patches.length} 个既有文件；文件身份不变，所有变化仍需一次事务审核。`;
  return {
    errors: [],
    plan: {
      summary: zh ? runeText(input.locale, chineseSummary, chineseSummary, [normalizeTaskText(input.title)]) : `Update saved review “${normalizeTaskText(input.title)}”`,
      detail: zh
        ? runeText(input.locale, chineseDetail, chineseDetail)
        : `Rune will recompile ${patches.length} existing files without changing their identities; every change still requires one transaction review.`,
      patches,
      creations: [],
    },
    workflow: {
      ...normalized,
      input: copyOperatingReviewInput(input),
    },
  };
}
