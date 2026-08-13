"use client";

import {
  BarChart3,
  Check,
  FileText,
  LoaderCircle,
  Presentation,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { artifactCreationSourceOptions } from "../lib/artifact-creation";
import { runeText, type RuneLocale } from "../lib/localization";
import {
  MAX_OPERATING_REVIEW_FOCUS_CHARS,
  MAX_OPERATING_REVIEW_PERIOD_CHARS,
  MAX_OPERATING_REVIEW_TITLE_CHARS,
  prepareOperatingReviewWorkflow,
  type OperatingReviewDeliverable,
  type OperatingReviewInput,
} from "../lib/operating-review";
import { parseDataSource, type WorkspaceArtifact } from "../lib/workspace";
import { ReviewDialog } from "./review-dialog";

type OperatingReviewDialogProps = {
  artifacts: WorkspaceArtifact[];
  locale: RuneLocale;
  error?: string;
  initialInput?: OperatingReviewInput;
  onCancel: () => void;
  onPrepare: (input: OperatingReviewInput) => void | Promise<void>;
};

const COPY = {
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
    numericHint: "只显示 Rune 识别为数值的字段。",
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
    preparing: "正在验证来源…",
    prepare: "准备审核",
    update: "准备更新审核",
    savedDescription: "调整本期范围后重新编译既有分析、图表和成品。文件身份保持不变，所有变化仍需审核。",
    savedKicker: "已保存任务 · 可重复运行",
    savedTitle: "更新这条经营汇报任务",
    footer: "一次原子事务 · 不上传本地文件",
    localErrors: "请先检查以下设置：",
    chain: "交付链",
    fields: "字段与口径",
    scope: "周期与对象",
    focusSummary: "任务重点",
  },
  en: {
    kicker: "Operating review · task first",
    title: "Prepare a verifiable operating-review chain",
    description: "Define the evidence, metric, and audience first. Rune compiles the analysis, chart, report, and slides into one review transaction.",
    details: "Operating-review task settings",
    reviewTitle: "Review title",
    reviewTitlePlaceholder: "For example: July operating review",
    source: "Data source",
    noSource: "No usable Data artifact in this workspace",
    category: "Category field",
    value: "Numeric value field",
    noField: "No available field",
    noNumericField: "No strictly numeric field",
    numericHint: "Only fields Rune recognizes as numeric are shown.",
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
    preparing: "Verifying sources…",
    prepare: "Prepare review",
    update: "Prepare update review",
    savedDescription: "Adjust this period and recompile the existing analysis, chart, and deliverables. File identities stay stable and every change remains reviewable.",
    savedKicker: "Saved task · repeatable",
    savedTitle: "Update this operating-review task",
    footer: "One atomic transaction · no local file upload",
    localErrors: "Check these settings first:",
    chain: "Delivery chain",
    fields: "Fields and measure",
    scope: "Period and audience",
    focusSummary: "Task focus",
  },
} as const;

function operatingReviewCopy(locale: RuneLocale) {
  if (locale === "en") return COPY.en;
  if (locale === "zh-CN") return COPY["zh-CN"];
  return Object.fromEntries(Object.entries(COPY["zh-CN"]).map(([key, value]) => (
    [key, runeText(locale, value, value)]
  ))) as typeof COPY["zh-CN"];
}

function selectedDeliverables(report: boolean, slides: boolean): OperatingReviewDeliverable[] {
  return [report ? "document" : null, slides ? "slides" : null]
    .filter((item): item is OperatingReviewDeliverable => item !== null);
}

export function OperatingReviewDialog({
  artifacts,
  locale,
  error,
  initialInput,
  onCancel,
  onPrepare,
}: OperatingReviewDialogProps) {
  const copy = operatingReviewCopy(locale);
  const [title, setTitle] = useState(initialInput?.title ?? "");
  const [sourceArtifactId, setSourceArtifactId] = useState(initialInput?.dataArtifactId ?? "");
  const [category, setCategory] = useState(initialInput?.category ?? "");
  const [value, setValue] = useState(initialInput?.value ?? "");
  const [aggregation, setAggregation] = useState<OperatingReviewInput["aggregation"]>(initialInput?.aggregation ?? "sum");
  const [mark, setMark] = useState<OperatingReviewInput["mark"]>(initialInput?.mark ?? "bar");
  const [format, setFormat] = useState<OperatingReviewInput["format"]>(initialInput?.format ?? "currency");
  const [period, setPeriod] = useState(initialInput?.period ?? "");
  const [audience, setAudience] = useState<OperatingReviewInput["audience"]>(initialInput?.audience ?? "leadership");
  const [focus, setFocus] = useState(initialInput?.focus ?? "");
  const [includeReport, setIncludeReport] = useState(initialInput?.deliverables.includes("document") ?? true);
  const [includeSlides, setIncludeSlides] = useState(initialInput?.deliverables.includes("slides") ?? true);
  const [attempted, setAttempted] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const sourceOptions = useMemo(
    () => artifactCreationSourceOptions(artifacts, "query"),
    [artifacts],
  );
  const sourceOption = sourceOptions.find((option) => option.artifactId === sourceArtifactId)
    ?? sourceOptions[0];
  const preferredCategory = sourceOption?.columns.find((column) => !sourceOption.numericColumns.includes(column))
    ?? sourceOption?.columns[0]
    ?? "";
  const effectiveCategory = sourceOption?.columns.includes(category)
    ? category
    : initialInput
      ? category
      : preferredCategory;
  const strictNumericColumns = useMemo(() => {
    const source = artifacts.find((artifact) => artifact.id === sourceOption?.artifactId);
    if (!source || source.kind !== "data") return [];
    const parsed = parseDataSource(source.source);
    if (parsed.errors.length || !parsed.rows.length) return [];
    return parsed.columns.filter((column) => parsed.rows.every((row) => (
      typeof row[column] === "number" && Number.isFinite(row[column])
    )));
  }, [artifacts, sourceOption?.artifactId]);
  const effectiveValue = strictNumericColumns.includes(value) && value !== effectiveCategory
    ? value
    : initialInput
      ? value
      : strictNumericColumns.find((column) => column !== effectiveCategory) ?? "";
  const deliverables = useMemo(
    () => selectedDeliverables(includeReport, includeSlides),
    [includeReport, includeSlides],
  );
  const input = useMemo<OperatingReviewInput>(() => ({
    title,
    dataArtifactId: sourceOption?.artifactId ?? "",
    category: effectiveCategory,
    value: effectiveValue,
    aggregation,
    mark,
    format,
    period,
    audience,
    focus,
    deliverables,
    locale,
  }), [
    aggregation,
    audience,
    deliverables,
    effectiveCategory,
    effectiveValue,
    focus,
    format,
    locale,
    mark,
    period,
    sourceOption?.artifactId,
    title,
  ]);
  const prepared = useMemo(
    () => prepareOperatingReviewWorkflow(artifacts, input),
    [artifacts, input],
  );

  const deliverableNames = deliverables.map((deliverable) => (
    deliverable === "document" ? copy.report : copy.slides
  ));
  const aggregationLabel = aggregation === "average" ? copy.average : copy.sum;
  const markLabel = mark === "line" ? copy.line : copy.bar;
  const audienceLabel = audience === "board" ? copy.board : audience === "team" ? copy.team : copy.leadership;
  const liveSummary = sourceOption && effectiveCategory && effectiveValue && deliverableNames.length
    ? locale !== "en"
      ? runeText(locale, "", `从 ${sourceOption.name} 按「${effectiveCategory}」${aggregationLabel}「${effectiveValue}」，生成${markLabel}并交付${deliverableNames.join("和")}。`, [sourceOption.name, effectiveCategory, effectiveValue])
      : `Use ${aggregationLabel.toLowerCase()} of “${effectiveValue}” by “${effectiveCategory}” from ${sourceOption.name}, then create a ${markLabel.toLowerCase()} and ${deliverableNames.join(" plus ").toLowerCase()}.`
    : copy.incomplete;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    if (!prepared.plan || preparing) return;
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
      kicker={<><BarChart3 aria-hidden="true" /> {initialInput ? copy.savedKicker : copy.kicker}</>}
      title={initialInput ? copy.savedTitle : copy.title}
      description={initialInput ? copy.savedDescription : copy.description}
      detailsLabel={copy.details}
      locale={locale}
      onCancel={cancel}
      footer={(
        <>
          <div><ShieldCheck aria-hidden="true" /> {copy.footer}</div>
          <span>
            <button className="button ghost-button" type="button" onClick={cancel} disabled={preparing}>{copy.cancel}</button>
            <button
              className="button primary-button"
              type="submit"
              form="operating-review-form"
              disabled={preparing || !sourceOptions.length}
            >
              {preparing ? <LoaderCircle className="agent-spinner" aria-hidden="true" /> : <Check aria-hidden="true" />}
              {preparing ? copy.preparing : initialInput ? copy.update : copy.prepare}
            </button>
          </span>
        </>
      )}
    >
      <form id="operating-review-form" className="operating-review-form" noValidate onSubmit={(event) => void submit(event)}>
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
              }}
              disabled={!sourceOptions.length}
              required
              aria-invalid={attempted && !sourceOption}
            >
              {!sourceOptions.length && <option value="">{copy.noSource}</option>}
              {sourceOptions.map((option) => (
                <option key={option.artifactId} value={option.artifactId}>{option.name} · Data</option>
              ))}
            </select>
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
                <option value={effectiveCategory}>{effectiveCategory} · {copy.noField}</option>
              )}
              {sourceOption?.columns.map((column) => <option key={column} value={column}>{column}</option>)}
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
                <option value={effectiveValue}>{effectiveValue} · {copy.noNumericField}</option>
              )}
              {strictNumericColumns
                .filter((column) => column !== effectiveCategory)
                .map((column) => <option key={column} value={column}>{column}</option>)}
            </select>
            <small id="operating-review-value-help">{copy.numericHint}</small>
          </label>

          <fieldset className="operating-review-field">
            <legend>{copy.aggregation}</legend>
            <div className="operating-review-options">
              <label><input type="radio" name="operating-review-aggregation" value="sum" checked={aggregation === "sum"} onChange={() => setAggregation("sum")} /> <span>{copy.sum}</span></label>
              <label><input type="radio" name="operating-review-aggregation" value="average" checked={aggregation === "average"} onChange={() => setAggregation("average")} /> <span>{copy.average}</span></label>
            </div>
          </fieldset>

          <fieldset className="operating-review-field">
            <legend>{copy.chart}</legend>
            <div className="operating-review-options">
              <label><input type="radio" name="operating-review-chart" value="bar" checked={mark === "bar"} onChange={() => setMark("bar")} /> <span>{copy.bar}</span></label>
              <label><input type="radio" name="operating-review-chart" value="line" checked={mark === "line"} onChange={() => setMark("line")} /> <span>{copy.line}</span></label>
            </div>
          </fieldset>

          <label className="operating-review-field" htmlFor="operating-review-format">
            <span>{copy.format}</span>
            <select id="operating-review-format" value={format} onChange={(event) => setFormat(event.target.value as OperatingReviewInput["format"])}>
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
            <select id="operating-review-audience" value={audience} onChange={(event) => setAudience(event.target.value as OperatingReviewInput["audience"])}>
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
            <input type="checkbox" checked={includeReport} disabled={Boolean(initialInput)} onChange={(event) => setIncludeReport(event.target.checked)} />
            <FileText aria-hidden="true" />
            <span><strong>{copy.report}</strong><small>{copy.reportDetail}</small></span>
          </label>
          <label>
            <input type="checkbox" checked={includeSlides} disabled={Boolean(initialInput)} onChange={(event) => setIncludeSlides(event.target.checked)} />
            <Presentation aria-hidden="true" />
            <span><strong>{copy.slides}</strong><small>{copy.slidesDetail}</small></span>
          </label>
        </fieldset>

        <section className="operating-review-summary" aria-labelledby="operating-review-summary-title" aria-live="polite">
          <header>
            <BarChart3 aria-hidden="true" />
            <div><span>{copy.summary}</span><strong id="operating-review-summary-title">{title.trim() || copy.reviewTitlePlaceholder}</strong></div>
          </header>
          <p>{liveSummary}</p>
          <dl>
            <div><dt>{copy.fields}</dt><dd>{effectiveCategory && effectiveValue ? `${effectiveCategory} → ${aggregationLabel}(${effectiveValue})` : "—"}</dd></div>
            <div><dt>{copy.scope}</dt><dd>{period.trim() ? `${period.trim()} · ${audienceLabel}` : audienceLabel}</dd></div>
            <div><dt>{copy.focusSummary}</dt><dd>{focus.trim() || "—"}</dd></div>
            <div><dt>{copy.chain}</dt><dd>{deliverableNames.length ? `Data → Query → Chart → ${deliverableNames.join(" + ")}` : "—"}</dd></div>
          </dl>
        </section>

        {error && <div className="import-review-error" role="alert">{error}</div>}
        {attempted && prepared.errors.length > 0 && (
          <div className="import-review-error" role="alert">
            <strong>{copy.localErrors}</strong>
            <ul>{prepared.errors.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        )}
      </form>
    </ReviewDialog>
  );
}
