"use client";

import { BarChart3, Check, FileText, LoaderCircle, Presentation, ShieldCheck } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { artifactCreationSourceOptions } from "../lib/artifact-creation";
import { formatChartValue } from "../lib/charts";
import { localizeRuneCopy, type RuneLocale } from "../lib/localization";
import type { RuneModelMode } from "../lib/model-preference";
import {
  MAX_OPERATING_REVIEW_FOCUS_CHARS,
  MAX_OPERATING_REVIEW_PERIOD_CHARS,
  MAX_OPERATING_REVIEW_TITLE_CHARS,
  prepareOperatingReviewEvidence,
  prepareOperatingReviewWorkflow,
  type OperatingReviewDeliverable,
  type OperatingReviewInput,
} from "../lib/operating-review";
import {
  collectOperatingReviewScopeValues,
  formatOperatingReviewScopeLabel,
  operatingReviewScopeValueKey,
  prepareOperatingReviewNumericColumns,
  type OperatingReviewScopeValue,
} from "../lib/operating-review-scope";
import { parseDataSource, type WorkspaceArtifact } from "../lib/workspace";
import { ReviewDialog } from "./review-dialog";

type OperatingReviewDialogProps = {
  artifacts: WorkspaceArtifact[];
  locale: RuneLocale;
  error?: string;
  initialInput?: OperatingReviewInput;
  preferredDataArtifactId?: string;
  modelMode: RuneModelMode;
  onCancel: () => void;
  onPrepare: (input: OperatingReviewInput) => void | Promise<void>;
};

const MAX_OPERATING_REVIEW_PREVIEW_ROWS = 5;

export const OPERATING_REVIEW_BASE_COPY = {
  "zh-CN": {
    kicker: "经营汇报 · 任务优先",
    title: "准备一条可核验的经营汇报链",
    description: "先明确数据、口径和交付对象。Rune 会把分析、图表、报告和演示编译为一次待审核事务。",
    details: "经营汇报任务设置",
    reviewTitle: "汇报标题",
    reviewTitlePlaceholder: "例如：七月经营复盘",
    source: "数据来源",
    noSource: "工作区中没有可用的 Data 文件",
    category: "分类字段",
    value: "数值字段",
    noField: "没有可用字段",
    noNumericField: "没有严格数值字段",
    numericHint: "只显示在当前数据范围内全部为数值的字段。",
    dataScope: "数据范围",
    allRows: "全部数据行",
    scopeValue: "精确范围值",
    chooseScopeValue: "选择一个值",
    noScopeValue: "这个字段没有可用值",
    scopeHint: "可选。选择后，本地证据、SQL、图表与模型上下文只使用完全匹配的行。",
    compareWith: "对比范围",
    noComparison: "不对比",
    comparisonHint: "可选。用同一字段的另一个精确值作为对比，变化值按主范围减去对比范围计算。",
    scopeTooMany: "只显示前 100 个不同值；可改选更适合分期的字段。",
    scopeValueRequired: "选择一个精确范围值，或改回全部数据行。",
    aggregation: "汇总方式",
    sum: "求和",
    average: "平均值",
    chart: "图表形式",
    bar: "柱状图 · 比较",
    line: "折线图 · 顺序",
    format: "数字格式",
    number: "数字",
    currency: "货币 · USD",
    percent: "百分比",
    period: "报告周期",
    periodPlaceholder: "例如：2026 年 7 月",
    audience: "汇报对象",
    leadership: "管理层",
    board: "董事会",
    team: "执行团队",
    focus: "本次重点",
    focusPlaceholder: "说明这次汇报需要回答的问题和需要推动的决策。",
    deliverables: "交付物",
    report: "报告",
    reportDetail: "生成可继续编辑的 Markdown 报告",
    slides: "演示",
    slidesDetail: "生成可继续编辑的 Deck Markdown",
    summary: "实时任务摘要",
    incomplete: "补齐必填信息后，Rune 会在提交前验证完整工作流。",
    cancel: "取消",
    preparing: "正在编排并验证…",
    prepare: "准备审核",
    update: "准备更新审核",
    savedDescription: "调整本期范围后重新编译既有分析、图表和成品。文件身份保持不变，所有变化仍需审核。",
    savedKicker: "已保存任务 · 可重复运行",
    savedTitle: "更新这条经营汇报任务",
    planner: "审核问题编排",
    modelPlanner: "模型可用时启用 · 只发送有界聚合证据 · 本地确定性回退",
    localPlanner: "本地确定性编译器",
    modelFooter: "向你的模型发送有界聚合 · 审核后写入",
    localFooter: "一次原子事务 · 仅在本地编译",
    modelShaping: "模型正在根据有界聚合证据准备审核问题…",
    modelPrepared: "已准备模型辅助、数字保持实时绑定的经营汇报；审核后才会写入",
    localPrepared: "已准备本地确定性经营汇报；审核后才会写入",
    localFallback: "模型当前不可用，已准备本地确定性经营汇报；审核后才会写入",
    sourceTooLargeFallback: "数据超过模型上下文安全上限，已准备本地确定性经营汇报；审核后才会写入",
    localErrors: "请先检查以下设置：",
    chain: "交付链",
    fields: "字段与口径",
    scope: "周期与对象",
    focusSummary: "任务重点",
    evidencePreview: "聚合证据预览",
    evidenceDescription: "在请求模型前，Rune 已按当前范围在本地编译这些结果。",
    eligibleRows: "命中行",
    comparisonRows: "对比行",
    excludedRows: "排除行",
    sourceRows: "来源行",
    change: "变化",
    showing: "显示",
    of: "共",
    groups: "项",
  },
  en: {
    kicker: "Operating review · task first",
    title: "Prepare a verifiable operating-review chain",
    description:
      "Define the evidence, metric, and audience first. Rune compiles the analysis, chart, report, and slides into one review transaction.",
    details: "Operating-review task settings",
    reviewTitle: "Review title",
    reviewTitlePlaceholder: "For example: July operating review",
    source: "Data source",
    noSource: "No usable Data artifact in this workspace",
    category: "Category field",
    value: "Numeric value field",
    noField: "No available field",
    noNumericField: "No strictly numeric field",
    numericHint: "Only fields that are numeric throughout the current Data scope are shown.",
    dataScope: "Data scope",
    allRows: "All Data rows",
    scopeValue: "Exact scope value",
    chooseScopeValue: "Choose one value",
    noScopeValue: "No usable value in this field",
    scopeHint: "Optional. When selected, local evidence, SQL, charts, and model context use only exact matching rows.",
    compareWith: "Compare with",
    noComparison: "No comparison",
    comparisonHint: "Optional. Compare another exact value from the same field; change is primary minus comparison.",
    scopeTooMany: "Only the first 100 distinct values are shown; choose a lower-cardinality period field if needed.",
    scopeValueRequired: "Choose one exact scope value, or return to all Data rows.",
    aggregation: "Aggregation",
    sum: "Sum",
    average: "Average",
    chart: "Chart form",
    bar: "Bar · compare",
    line: "Line · sequence",
    format: "Number format",
    number: "Number",
    currency: "Currency · USD",
    percent: "Percent",
    period: "Reporting period",
    periodPlaceholder: "For example: July 2026",
    audience: "Audience",
    leadership: "Leadership",
    board: "Board",
    team: "Operating team",
    focus: "Review focus",
    focusPlaceholder: "State the question this review must answer and the decision it should support.",
    deliverables: "Deliverables",
    report: "Report",
    reportDetail: "Create an editable Markdown report",
    slides: "Slides",
    slidesDetail: "Create an editable Deck Markdown presentation",
    summary: "Live task summary",
    incomplete: "Complete the required fields and Rune will validate the whole workflow before review.",
    cancel: "Cancel",
    preparing: "Shaping and verifying…",
    prepare: "Prepare review",
    update: "Prepare update review",
    savedDescription:
      "Adjust this period and recompile the existing analysis, chart, and deliverables. File identities stay stable and every change remains reviewable.",
    savedKicker: "Saved task · repeatable",
    savedTitle: "Update this operating-review task",
    planner: "Review-question planner",
    modelPlanner: "Model when available · bounded aggregates only · deterministic local fallback",
    localPlanner: "Deterministic local compiler",
    modelFooter: "Bounded aggregates to your model · review before write",
    localFooter: "One atomic transaction · compiled locally",
    modelShaping: "The model is preparing review questions from bounded aggregate evidence…",
    modelPrepared: "Model-assisted operating review prepared with live-bound numbers; nothing writes until review",
    localPrepared: "Deterministic local operating review prepared; nothing writes until review",
    localFallback: "Model unavailable; deterministic local operating review prepared for review",
    sourceTooLargeFallback:
      "Data exceeds the model context safety limit; deterministic local operating review prepared for review",
    localErrors: "Check these settings first:",
    chain: "Delivery chain",
    fields: "Fields and measure",
    scope: "Period and audience",
    focusSummary: "Task focus",
    evidencePreview: "Aggregate evidence preview",
    evidenceDescription: "Rune compiled these results locally from the current scope before any model request.",
    eligibleRows: "Eligible rows",
    comparisonRows: "Comparison rows",
    excludedRows: "Excluded rows",
    sourceRows: "Source rows",
    change: "Change",
    showing: "Showing",
    of: "of",
    groups: "groups",
  },
} as const;

export function operatingReviewCopy(locale: RuneLocale) {
  return localizeRuneCopy(locale, OPERATING_REVIEW_BASE_COPY.en, OPERATING_REVIEW_BASE_COPY["zh-CN"]);
}

function selectedDeliverables(report: boolean, slides: boolean): OperatingReviewDeliverable[] {
  return [report ? "document" : null, slides ? "slides" : null].filter(
    (item): item is OperatingReviewDeliverable => item !== null,
  );
}

function comparisonConnector(locale: RuneLocale) {
  return (
    {
      "zh-CN": "对比",
      "zh-TW": "對比",
      en: "vs",
      fr: "contre",
      es: "frente a",
      ru: "против",
      ar: "مقابل",
      ja: "対",
      ko: "대비",
    } satisfies Record<RuneLocale, string>
  )[locale];
}

export function OperatingReviewDialog({
  artifacts,
  locale,
  error,
  initialInput,
  preferredDataArtifactId,
  modelMode,
  onCancel,
  onPrepare,
}: OperatingReviewDialogProps) {
  const copy = operatingReviewCopy(locale);
  const [title, setTitle] = useState(initialInput?.title ?? "");
  const [sourceArtifactId, setSourceArtifactId] = useState(
    initialInput?.dataArtifactId ?? preferredDataArtifactId ?? "",
  );
  const [category, setCategory] = useState(initialInput?.category ?? "");
  const [value, setValue] = useState(initialInput?.value ?? "");
  const [aggregation, setAggregation] = useState<OperatingReviewInput["aggregation"]>(
    initialInput?.aggregation ?? "sum",
  );
  const [mark, setMark] = useState<OperatingReviewInput["mark"]>(initialInput?.mark ?? "bar");
  const [format, setFormat] = useState<OperatingReviewInput["format"]>(initialInput?.format ?? "currency");
  const [scopeField, setScopeField] = useState(initialInput?.scope?.field ?? "");
  const [scopeValue, setScopeValue] = useState<OperatingReviewScopeValue | null>(initialInput?.scope?.value ?? null);
  const [comparisonValue, setComparisonValue] = useState<OperatingReviewScopeValue | null>(
    initialInput?.comparisonScope?.value ?? null,
  );
  const [period, setPeriod] = useState(initialInput?.period ?? "");
  const [audience, setAudience] = useState<OperatingReviewInput["audience"]>(initialInput?.audience ?? "leadership");
  const [focus, setFocus] = useState(initialInput?.focus ?? "");
  const [includeReport, setIncludeReport] = useState(initialInput?.deliverables.includes("document") ?? true);
  const [includeSlides, setIncludeSlides] = useState(initialInput?.deliverables.includes("slides") ?? true);
  const [attempted, setAttempted] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const sourceOptions = useMemo(() => artifactCreationSourceOptions(artifacts, "query"), [artifacts]);
  const sourceOption = sourceOptions.find((option) => option.artifactId === sourceArtifactId) ?? sourceOptions[0];
  const preferredCategory =
    sourceOption?.columns.find((column) => !sourceOption.numericColumns.includes(column)) ??
    sourceOption?.columns[0] ??
    "";
  const effectiveCategory = sourceOption?.columns.includes(category)
    ? category
    : initialInput
      ? category
      : preferredCategory;
  const parsedData = useMemo(() => {
    const source = artifacts.find((artifact) => artifact.id === sourceOption?.artifactId);
    if (!source || source.kind !== "data") return null;
    const parsed = parseDataSource(source.source);
    return parsed.errors.length || !parsed.rows.length ? null : parsed;
  }, [artifacts, sourceOption?.artifactId]);
  const effectiveScopeField = sourceOption?.columns.includes(scopeField)
    ? scopeField
    : initialInput?.scope
      ? scopeField
      : "";
  const scopeOptions = useMemo(
    () =>
      parsedData && effectiveScopeField && parsedData.columns.includes(effectiveScopeField)
        ? collectOperatingReviewScopeValues(parsedData.rows, effectiveScopeField)
        : { values: [], truncated: false },
    [effectiveScopeField, parsedData],
  );
  const scopeValueAvailable =
    scopeValue != null &&
    scopeOptions.values.some(
      (candidate) => operatingReviewScopeValueKey(candidate) === operatingReviewScopeValueKey(scopeValue),
    );
  const scopeReady = !effectiveScopeField || scopeValue != null;
  const effectiveScope = useMemo(
    () => (effectiveScopeField && scopeValue != null ? { field: effectiveScopeField, value: scopeValue } : null),
    [effectiveScopeField, scopeValue],
  );
  const comparisonValueAvailable =
    comparisonValue != null &&
    scopeOptions.values.some(
      (candidate) => operatingReviewScopeValueKey(candidate) === operatingReviewScopeValueKey(comparisonValue),
    );
  const effectiveComparisonScope = useMemo(
    () =>
      effectiveScopeField && comparisonValue != null ? { field: effectiveScopeField, value: comparisonValue } : null,
    [comparisonValue, effectiveScopeField],
  );
  const strictNumericColumns = useMemo(() => {
    if (!parsedData) return [];
    return prepareOperatingReviewNumericColumns(
      parsedData.rows,
      parsedData.columns,
      effectiveScope,
      effectiveComparisonScope,
    ).columns;
  }, [effectiveComparisonScope, effectiveScope, parsedData]);
  const effectiveValue =
    strictNumericColumns.includes(value) && value !== effectiveCategory
      ? value
      : initialInput
        ? value
        : (strictNumericColumns.find((column) => column !== effectiveCategory) ?? "");
  const deliverables = useMemo(
    () => selectedDeliverables(includeReport, includeSlides),
    [includeReport, includeSlides],
  );
  const input = useMemo<OperatingReviewInput>(
    () => ({
      title,
      dataArtifactId: sourceOption?.artifactId ?? "",
      category: effectiveCategory,
      value: effectiveValue,
      aggregation,
      mark,
      format,
      scope: effectiveScope,
      comparisonScope: effectiveComparisonScope,
      period,
      audience,
      focus,
      deliverables,
      locale,
    }),
    [
      aggregation,
      audience,
      deliverables,
      effectiveCategory,
      effectiveValue,
      focus,
      format,
      effectiveScope,
      effectiveComparisonScope,
      locale,
      mark,
      period,
      sourceOption?.artifactId,
      title,
    ],
  );
  const prepared = useMemo(() => prepareOperatingReviewWorkflow(artifacts, input), [artifacts, input]);
  const evidence = useMemo(() => prepareOperatingReviewEvidence(artifacts, input), [artifacts, input]);
  const evidenceRows = evidence.evidenceRows?.slice(0, MAX_OPERATING_REVIEW_PREVIEW_ROWS) ?? [];
  const eligibleRowCount = evidence.matchedRowCount ?? 0;
  const comparisonRowCount = evidence.comparisonMatchedRowCount ?? 0;
  const excludedRowCount = Math.max(0, (parsedData?.rows.length ?? 0) - eligibleRowCount - comparisonRowCount);

  const deliverableNames = deliverables.map((deliverable) => (deliverable === "document" ? copy.report : copy.slides));
  const aggregationLabel = aggregation === "average" ? copy.average : copy.sum;
  const markLabel = mark === "line" ? copy.line : copy.bar;
  const audienceLabel = audience === "board" ? copy.board : audience === "team" ? copy.team : copy.leadership;
  const primaryScopeLabel = effectiveScope ? formatOperatingReviewScopeLabel(effectiveScope) : copy.allRows;
  const scopeLabel = effectiveComparisonScope
    ? `${primaryScopeLabel} ${comparisonConnector(locale)} ${String(effectiveComparisonScope.value)}`
    : primaryScopeLabel;
  const liveSummary =
    sourceOption && effectiveCategory && effectiveValue && deliverableNames.length
      ? `${sourceOption.name} · ${effectiveCategory} → ${aggregationLabel}(${effectiveValue}) · ${scopeLabel} · ${markLabel} → ${deliverableNames.join(" + ")}`
      : copy.incomplete;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    if (!prepared.plan || preparing || !scopeReady) return;
    setPreparing(true);
    try {
      await onPrepare(input);
    } finally {
      setPreparing(false);
    }
  }

  const cancel = () => {
    if (!preparing) onCancel();
  };

  return (
    <ReviewDialog
      dialogId="operating-review"
      kicker={
        <>
          <BarChart3 aria-hidden="true" /> {initialInput ? copy.savedKicker : copy.kicker}
        </>
      }
      title={initialInput ? copy.savedTitle : copy.title}
      description={initialInput ? copy.savedDescription : copy.description}
      detailsLabel={copy.details}
      locale={locale}
      onCancel={cancel}
      footer={
        <>
          <div>
            <ShieldCheck aria-hidden="true" /> {modelMode === "auto" ? copy.modelFooter : copy.localFooter}
          </div>
          <span>
            <button className="button ghost-button" type="button" onClick={cancel} disabled={preparing}>
              {copy.cancel}
            </button>
            <button
              className="button primary-button"
              type="submit"
              form="operating-review-form"
              disabled={preparing || !sourceOptions.length || !scopeReady}
            >
              {preparing ? <LoaderCircle className="agent-spinner" aria-hidden="true" /> : <Check aria-hidden="true" />}
              {preparing ? copy.preparing : initialInput ? copy.update : copy.prepare}
            </button>
          </span>
        </>
      }
    >
      <form
        id="operating-review-form"
        className="operating-review-form"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <div className="operating-review-grid">
          <label className="operating-review-field wide" htmlFor="operating-review-title">
            <span>{copy.reviewTitle}</span>
            <input
              id="operating-review-title"
              data-dialog-initial-focus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={copy.reviewTitlePlaceholder}
              maxLength={MAX_OPERATING_REVIEW_TITLE_CHARS}
              required
              aria-invalid={attempted && !title.trim()}
            />
          </label>

          <label className="operating-review-field wide" htmlFor="operating-review-source">
            <span>{copy.source}</span>
            <select
              id="operating-review-source"
              value={sourceOption?.artifactId ?? ""}
              onChange={(event) => {
                setSourceArtifactId(event.target.value);
                setCategory("");
                setValue("");
                setScopeField("");
                setScopeValue(null);
                setComparisonValue(null);
              }}
              disabled={!sourceOptions.length}
              required
              aria-invalid={attempted && !sourceOption}
            >
              {!sourceOptions.length && <option value="">{copy.noSource}</option>}
              {sourceOptions.map((option) => (
                <option key={option.artifactId} value={option.artifactId}>
                  {option.name} · Data
                </option>
              ))}
            </select>
          </label>

          <label className="operating-review-field" htmlFor="operating-review-scope-field">
            <span>{copy.dataScope}</span>
            <select
              id="operating-review-scope-field"
              value={effectiveScopeField}
              onChange={(event) => {
                setScopeField(event.target.value);
                setScopeValue(null);
                setComparisonValue(null);
              }}
              aria-describedby="operating-review-scope-help"
            >
              <option value="">{copy.allRows}</option>
              {initialInput?.scope && effectiveScopeField && !sourceOption?.columns.includes(effectiveScopeField) && (
                <option value={effectiveScopeField}>
                  {effectiveScopeField} · {copy.noField}
                </option>
              )}
              {sourceOption?.columns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
            <small id="operating-review-scope-help">{copy.scopeHint}</small>
          </label>

          <label className="operating-review-field" htmlFor="operating-review-scope-value">
            <span>{copy.scopeValue}</span>
            <select
              id="operating-review-scope-value"
              value={scopeValue == null ? "" : operatingReviewScopeValueKey(scopeValue)}
              onChange={(event) => {
                const selected = scopeOptions.values.find(
                  (candidate) => operatingReviewScopeValueKey(candidate) === event.target.value,
                );
                setScopeValue(selected ?? null);
                if (
                  selected != null &&
                  comparisonValue != null &&
                  operatingReviewScopeValueKey(selected) === operatingReviewScopeValueKey(comparisonValue)
                ) {
                  setComparisonValue(null);
                }
              }}
              disabled={!effectiveScopeField || !scopeOptions.values.length}
              required={Boolean(effectiveScopeField)}
              aria-invalid={attempted && !scopeReady}
            >
              <option value="">
                {effectiveScopeField && !scopeOptions.values.length ? copy.noScopeValue : copy.chooseScopeValue}
              </option>
              {scopeValue != null && !scopeValueAvailable && (
                <option value={operatingReviewScopeValueKey(scopeValue)}>
                  {String(scopeValue)} · {copy.noScopeValue}
                </option>
              )}
              {scopeOptions.values.map((candidate) => (
                <option key={operatingReviewScopeValueKey(candidate)} value={operatingReviewScopeValueKey(candidate)}>
                  {String(candidate)}
                </option>
              ))}
            </select>
            {scopeOptions.truncated && <small>{copy.scopeTooMany}</small>}
            {attempted && !scopeReady && (
              <small className="operating-review-field-error">{copy.scopeValueRequired}</small>
            )}
          </label>

          <label className="operating-review-field" htmlFor="operating-review-comparison-value">
            <span>{copy.compareWith}</span>
            <select
              id="operating-review-comparison-value"
              value={comparisonValue == null ? "" : operatingReviewScopeValueKey(comparisonValue)}
              onChange={(event) => {
                const selected = scopeOptions.values.find(
                  (candidate) => operatingReviewScopeValueKey(candidate) === event.target.value,
                );
                setComparisonValue(selected ?? null);
              }}
              disabled={!effectiveScopeField || scopeValue == null || scopeOptions.values.length < 2}
              aria-describedby="operating-review-comparison-help"
            >
              <option value="">{copy.noComparison}</option>
              {comparisonValue != null && !comparisonValueAvailable && (
                <option value={operatingReviewScopeValueKey(comparisonValue)}>
                  {String(comparisonValue)} · {copy.noScopeValue}
                </option>
              )}
              {scopeOptions.values
                .filter(
                  (candidate) =>
                    scopeValue == null ||
                    operatingReviewScopeValueKey(candidate) !== operatingReviewScopeValueKey(scopeValue),
                )
                .map((candidate) => (
                  <option key={operatingReviewScopeValueKey(candidate)} value={operatingReviewScopeValueKey(candidate)}>
                    {String(candidate)}
                  </option>
                ))}
            </select>
            <small id="operating-review-comparison-help">{copy.comparisonHint}</small>
          </label>

          <label className="operating-review-field" htmlFor="operating-review-category">
            <span>{copy.category}</span>
            <select
              id="operating-review-category"
              value={effectiveCategory}
              onChange={(event) => {
                setCategory(event.target.value);
                if (event.target.value === effectiveValue) setValue("");
              }}
              disabled={!sourceOption?.columns.length}
              required
              aria-invalid={attempted && !effectiveCategory}
            >
              {!sourceOption?.columns.length && <option value="">{copy.noField}</option>}
              {initialInput && effectiveCategory && !sourceOption?.columns.includes(effectiveCategory) && (
                <option value={effectiveCategory}>
                  {effectiveCategory} · {copy.noField}
                </option>
              )}
              {sourceOption?.columns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </label>

          <label className="operating-review-field" htmlFor="operating-review-value">
            <span>{copy.value}</span>
            <select
              id="operating-review-value"
              value={effectiveValue}
              onChange={(event) => setValue(event.target.value)}
              disabled={!strictNumericColumns.some((column) => column !== effectiveCategory)}
              required
              aria-describedby="operating-review-value-help"
              aria-invalid={attempted && !effectiveValue}
            >
              {!strictNumericColumns.some((column) => column !== effectiveCategory) && (
                <option value="">{copy.noNumericField}</option>
              )}
              {initialInput && effectiveValue && !strictNumericColumns.includes(effectiveValue) && (
                <option value={effectiveValue}>
                  {effectiveValue} · {copy.noNumericField}
                </option>
              )}
              {strictNumericColumns
                .filter((column) => column !== effectiveCategory)
                .map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
            </select>
            <small id="operating-review-value-help">{copy.numericHint}</small>
          </label>

          <fieldset className="operating-review-field">
            <legend>{copy.aggregation}</legend>
            <div className="operating-review-options">
              <label>
                <input
                  type="radio"
                  name="operating-review-aggregation"
                  value="sum"
                  checked={aggregation === "sum"}
                  onChange={() => setAggregation("sum")}
                />{" "}
                <span>{copy.sum}</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="operating-review-aggregation"
                  value="average"
                  checked={aggregation === "average"}
                  onChange={() => setAggregation("average")}
                />{" "}
                <span>{copy.average}</span>
              </label>
            </div>
          </fieldset>

          <fieldset className="operating-review-field">
            <legend>{copy.chart}</legend>
            <div className="operating-review-options">
              <label>
                <input
                  type="radio"
                  name="operating-review-chart"
                  value="bar"
                  checked={mark === "bar"}
                  onChange={() => setMark("bar")}
                />{" "}
                <span>{copy.bar}</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="operating-review-chart"
                  value="line"
                  checked={mark === "line"}
                  onChange={() => setMark("line")}
                />{" "}
                <span>{copy.line}</span>
              </label>
            </div>
          </fieldset>

          <label className="operating-review-field" htmlFor="operating-review-format">
            <span>{copy.format}</span>
            <select
              id="operating-review-format"
              value={format}
              onChange={(event) => setFormat(event.target.value as OperatingReviewInput["format"])}
            >
              <option value="number">{copy.number}</option>
              <option value="currency">{copy.currency}</option>
              <option value="percent">{copy.percent}</option>
            </select>
          </label>

          <label className="operating-review-field" htmlFor="operating-review-period">
            <span>{copy.period}</span>
            <input
              id="operating-review-period"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              placeholder={copy.periodPlaceholder}
              maxLength={MAX_OPERATING_REVIEW_PERIOD_CHARS}
              required
              aria-invalid={attempted && !period.trim()}
            />
          </label>

          <label className="operating-review-field" htmlFor="operating-review-audience">
            <span>{copy.audience}</span>
            <select
              id="operating-review-audience"
              value={audience}
              onChange={(event) => setAudience(event.target.value as OperatingReviewInput["audience"])}
            >
              <option value="leadership">{copy.leadership}</option>
              <option value="board">{copy.board}</option>
              <option value="team">{copy.team}</option>
            </select>
          </label>

          <label className="operating-review-field wide" htmlFor="operating-review-focus">
            <span>{copy.focus}</span>
            <textarea
              id="operating-review-focus"
              value={focus}
              onChange={(event) => setFocus(event.target.value)}
              placeholder={copy.focusPlaceholder}
              maxLength={MAX_OPERATING_REVIEW_FOCUS_CHARS}
              rows={3}
              required
              aria-invalid={attempted && !focus.trim()}
            />
          </label>
        </div>

        <fieldset className="operating-review-deliverables">
          <legend>{copy.deliverables}</legend>
          <label>
            <input
              type="checkbox"
              checked={includeReport}
              disabled={Boolean(initialInput)}
              onChange={(event) => setIncludeReport(event.target.checked)}
            />
            <FileText aria-hidden="true" />
            <span>
              <strong>{copy.report}</strong>
              <small>{copy.reportDetail}</small>
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={includeSlides}
              disabled={Boolean(initialInput)}
              onChange={(event) => setIncludeSlides(event.target.checked)}
            />
            <Presentation aria-hidden="true" />
            <span>
              <strong>{copy.slides}</strong>
              <small>{copy.slidesDetail}</small>
            </span>
          </label>
        </fieldset>

        <section
          className="operating-review-summary"
          aria-labelledby="operating-review-summary-title"
          aria-live="polite"
        >
          <header>
            <BarChart3 aria-hidden="true" />
            <div>
              <span>{copy.summary}</span>
              <strong id="operating-review-summary-title">{title.trim() || copy.reviewTitlePlaceholder}</strong>
            </div>
          </header>
          <p>{liveSummary}</p>
          {!!evidenceRows.length && (
            <section className="operating-review-evidence" aria-labelledby="operating-review-evidence-title">
              <header>
                <div>
                  <strong id="operating-review-evidence-title">{copy.evidencePreview}</strong>
                  <span>{copy.evidenceDescription}</span>
                </div>
                <dl aria-label={copy.evidencePreview}>
                  <div>
                    <dt>{copy.eligibleRows}</dt>
                    <dd>{eligibleRowCount}</dd>
                  </div>
                  {effectiveComparisonScope && (
                    <div>
                      <dt>{copy.comparisonRows}</dt>
                      <dd>{comparisonRowCount}</dd>
                    </div>
                  )}
                  <div>
                    <dt>{copy.excludedRows}</dt>
                    <dd>{excludedRowCount}</dd>
                  </div>
                </dl>
              </header>
              <div className="operating-review-evidence-table">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{effectiveCategory}</th>
                      {effectiveComparisonScope ? (
                        <>
                          <th scope="col">
                            {effectiveValue} · {String(effectiveScope?.value ?? "")}
                          </th>
                          <th scope="col">
                            {effectiveValue} · {String(effectiveComparisonScope.value)}
                          </th>
                          <th scope="col">{copy.change}</th>
                        </>
                      ) : (
                        <th scope="col">{effectiveValue}</th>
                      )}
                      <th scope="col">{copy.sourceRows}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidenceRows.map((row) => (
                      <tr key={row.id}>
                        <th scope="row">{row.category}</th>
                        {effectiveComparisonScope ? (
                          <>
                            <td>{formatChartValue(row.primaryValue ?? 0, format)}</td>
                            <td>{formatChartValue(row.comparisonValue ?? 0, format)}</td>
                            <td>{formatChartValue(row.value, format)}</td>
                          </>
                        ) : (
                          <td>{formatChartValue(row.value, format)}</td>
                        )}
                        <td>{row.sourceRowCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer>
                {copy.showing} {evidenceRows.length} {copy.of} {evidence.groupCount ?? evidenceRows.length}{" "}
                {copy.groups}
              </footer>
            </section>
          )}
          <dl>
            <div>
              <dt>{copy.fields}</dt>
              <dd>
                {effectiveCategory && effectiveValue
                  ? `${effectiveCategory} → ${aggregationLabel}(${effectiveValue})`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>{copy.scope}</dt>
              <dd>
                {period.trim()
                  ? `${period.trim()} · ${audienceLabel} · ${scopeLabel}`
                  : `${audienceLabel} · ${scopeLabel}`}
              </dd>
            </div>
            <div>
              <dt>{copy.focusSummary}</dt>
              <dd>{focus.trim() || "—"}</dd>
            </div>
            <div>
              <dt>{copy.planner}</dt>
              <dd>{modelMode === "auto" ? copy.modelPlanner : copy.localPlanner}</dd>
            </div>
            <div>
              <dt>{copy.chain}</dt>
              <dd>{deliverableNames.length ? `Data → Query → Chart → ${deliverableNames.join(" + ")}` : "—"}</dd>
            </div>
          </dl>
        </section>

        {error && (
          <div className="import-review-error" role="alert">
            {error}
          </div>
        )}
        {attempted && prepared.errors.length > 0 && (
          <div className="import-review-error" role="alert">
            <strong>{copy.localErrors}</strong>
            <ul>
              {prepared.errors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </ReviewDialog>
  );
}
