import assert from "node:assert/strict";
import test from "node:test";

import { parseChartSource } from "../app/lib/charts.ts";
import { parseDeckSource } from "../app/lib/deck.ts";
import {
  appendOperatingReviewRun,
  createSavedOperatingReview,
  normalizeSavedOperatingReviews,
  prepareOperatingReviewWorkflow,
  prepareSavedOperatingReviewRerun,
  summarizeOperatingReviewRuns,
} from "../app/lib/operating-review.ts";
import { validateWorkspaceArtifacts } from "../app/lib/patches.ts";
import { parseQueryDataSourceDirective } from "../app/lib/query-source.ts";

function dataArtifact(overrides = {}) {
  return {
    id: "source-data",
    name: "source-data.csv",
    kind: "data",
    language: "CSV / JSON",
    source: "Region,Net Revenue\nAPAC,1840000\nEurope,970000\n",
    ...overrides,
  };
}

function reviewInput(overrides = {}) {
  return {
    title: "FY26 Growth Review",
    dataArtifactId: "source-data",
    category: "Region",
    value: "Net Revenue",
    aggregation: "sum",
    mark: "bar",
    format: "currency",
    period: "FY26 H1",
    audience: "board",
    focus: "Decide where to invest for durable growth.",
    deliverables: ["document", "slides"],
    locale: "en",
    ...overrides,
  };
}

function creationsByKind(result) {
  assert.ok(result.plan);
  return Object.fromEntries(result.plan.creations.map((creation) => [creation.artifact.kind, creation.artifact]));
}

function freezeDeep(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freezeDeep);
  }
  return value;
}

test("creates an English Document + Slides review chain with exact evidence bindings", () => {
  const artifacts = [dataArtifact()];
  const input = reviewInput();
  const artifactsBefore = structuredClone(artifacts);
  const inputBefore = structuredClone(input);

  const result = prepareOperatingReviewWorkflow(artifacts, input);

  assert.deepEqual(result.errors, []);
  assert.equal(result.plan.summary, "Create a verifiable operating-review chain for “FY26 Growth Review”");
  assert.deepEqual(result.plan.patches, []);
  assert.deepEqual(result.plan.creations.map(({ artifact }) => artifact.kind), [
    "query",
    "chart",
    "document",
    "slides",
  ]);

  const created = creationsByKind(result);
  assert.deepEqual(result.plan.creations.map(({ artifact }) => [artifact.id, artifact.name]), [
    ["fy26-growth-review-analysis", "fy26-growth-review-analysis.sql"],
    ["fy26-growth-review-view", "fy26-growth-review-view.chart.json"],
    ["fy26-growth-review-report", "fy26-growth-review-report.md"],
    ["fy26-growth-review-briefing", "fy26-growth-review-briefing.deck.md"],
  ]);
  assert.deepEqual(parseQueryDataSourceDirective(created.query.source), {
    artifactId: "source-data",
    explicit: true,
    errors: [],
  });
  assert.match(created.query.source, /SUM\("Net Revenue"\) AS "Net Revenue"/);
  assert.match(created.query.source, /GROUP BY "Region"/);

  assert.deepEqual(parseChartSource(created.chart.source).spec, {
    version: 1,
    title: "Net Revenue by Region",
    description: "Sum for FY26 H1 · source-data.csv",
    source: created.query.id,
    mark: "bar",
    category: "Region",
    value: "Net Revenue",
    sort: "descending",
    format: "currency",
    color: "#ff5c35",
    maxItems: 8,
  });
  const exactChartBinding = `{{ chart("${created.chart.id}") }}`;
  assert.equal(created.document.source.split(exactChartBinding).length - 1, 1);
  assert.equal(created.slides.source.split(exactChartBinding).length - 1, 1);
  assert.match(created.document.source, /## Verifiable view/);
  assert.match(created.document.source, /Rune has not invented a business conclusion without evidence/);
  assert.match(created.slides.source, /^---\nversion: 1[\s\S]*\nlang: en\n---/);
  assert.deepEqual(parseDeckSource(created.slides.source).errors, []);
  assert.deepEqual(validateWorkspaceArtifacts([...artifacts, ...result.plan.creations.map(({ artifact }) => artifact)]), []);
  assert.deepEqual(artifacts, artifactsBefore);
  assert.deepEqual(input, inputBefore);
});

test("creates a Chinese Document + Slides review chain without translating canonical field identities", () => {
  const data = dataArtifact({
    id: "经营数据",
    name: "经营数据.csv",
    source: "地区,净收入\n亚太,1840000\n欧洲,970000\n",
  });
  const input = reviewInput({
    title: "半年度经营回顾",
    dataArtifactId: data.id,
    category: "地区",
    value: "净收入",
    aggregation: "average",
    mark: "line",
    format: "number",
    period: "2026年上半年",
    audience: "leadership",
    focus: "确认增长质量与下一步投入。",
    locale: "zh-CN",
  });

  const result = prepareOperatingReviewWorkflow([data], input);

  assert.deepEqual(result.errors, []);
  assert.match(result.plan.summary, /^为「半年度经营回顾」创建一条可核验经营汇报链$/);
  const created = creationsByKind(result);
  assert.deepEqual(parseQueryDataSourceDirective(created.query.source), {
    artifactId: data.id,
    explicit: true,
    errors: [],
  });
  assert.match(created.query.source, /AVG\("净收入"\) AS "净收入"/);
  assert.match(created.query.source, /GROUP BY "地区"/);
  assert.equal(parseChartSource(created.chart.source).spec.source, created.query.id);
  assert.deepEqual({
    mark: parseChartSource(created.chart.source).spec.mark,
    category: parseChartSource(created.chart.source).spec.category,
    value: parseChartSource(created.chart.source).spec.value,
    sort: parseChartSource(created.chart.source).spec.sort,
  }, {
    mark: "line",
    category: "地区",
    value: "净收入",
    sort: "source",
  });
  const exactChartBinding = `{{ chart("${created.chart.id}") }}`;
  assert.match(created.document.source, /## 本次目标/);
  assert.match(created.document.source, /管理层/);
  assert.ok(created.document.source.includes(exactChartBinding));
  assert.match(created.slides.source, /\nlang: zh-CN\n/);
  assert.match(created.slides.source, /<!-- eyebrow: 可核验证据 -->/);
  assert.ok(created.slides.source.includes(exactChartBinding));
  assert.deepEqual(parseDeckSource(created.slides.source).errors, []);
  assert.deepEqual(validateWorkspaceArtifacts([[data], result.plan.creations.map(({ artifact }) => artifact)].flat()), []);
});

test("creates a complete Traditional Chinese review chain while preserving exact field identities", () => {
  const data = dataArtifact({
    id: "營運資料",
    name: "營運資料.csv",
    source: "地區,淨收入\n亞太,1840000\n歐洲,970000\n",
  });
  const input = reviewInput({
    title: "半年度營運回顧",
    dataArtifactId: data.id,
    category: "地區",
    value: "淨收入",
    period: "2026 年上半年",
    audience: "board",
    focus: "確認成長品質與下一步投入。",
    locale: "zh-TW",
  });

  const result = prepareOperatingReviewWorkflow([data], input);
  assert.deepEqual(result.errors, []);
  assert.match(result.plan.summary, /建立一條可核驗經營彙報鏈/);
  const created = creationsByKind(result);
  assert.match(created.query.source, /SUM\("淨收入"\) AS "淨收入"/);
  assert.match(created.document.source, /## 本次目標/);
  assert.match(created.document.source, /董事會/);
  assert.match(created.slides.source, /\nlang: zh-TW\n/);
  assert.match(created.slides.source, /<!-- eyebrow: 可核驗證據 -->/);
  assert.deepEqual(parseDeckSource(created.slides.source).errors, []);
  assert.deepEqual(validateWorkspaceArtifacts([[data], result.plan.creations.map(({ artifact }) => artifact)].flat()), []);
});

test("rejects missing sources and inexact category or value fields before creating anything", () => {
  const artifacts = [dataArtifact()];
  const scenarios = [
    [reviewInput({ dataArtifactId: "invented-source" }), /exact valid Data source/i],
    [reviewInput({ category: "region" }), /exact visible category field/i],
    [reviewInput({ value: "Gross Margin" }), /exact visible value field/i],
  ];

  for (const [input, expectedError] of scenarios) {
    const result = prepareOperatingReviewWorkflow(artifacts, input);
    assert.equal(result.plan, undefined);
    assert.match(result.errors.join(" "), expectedError);
  }
});

test("rejects a value field containing nonnumeric or formatted text", () => {
  const data = dataArtifact({
    source: "Region,Net Revenue\nAPAC,1840000\nEurope,N/A\nLATAM,$450000\n",
  });
  const result = prepareOperatingReviewWorkflow([data], reviewInput());

  assert.equal(result.plan, undefined);
  assert.match(result.errors.join(" "), /only finite numeric values, not formatted text/i);
});

test("rejects duplicate deliverables instead of silently collapsing the workflow", () => {
  const result = prepareOperatingReviewWorkflow(
    [dataArtifact()],
    reviewInput({ deliverables: ["document", "document"] }),
  );

  assert.equal(result.plan, undefined);
  assert.match(result.errors.join(" "), /Deliverable choices must be unique and supported/i);
});

test("resolves every generated id and filename collision while preserving the new chain", () => {
  const data = dataArtifact();
  const existing = [
    data,
    {
      id: "collision-review-analysis",
      name: "COLLISION-REVIEW-ANALYSIS.SQL",
      kind: "query",
      language: "DuckDB SQL",
      source: '-- rune:data "source-data"\nSELECT Region, "Net Revenue" FROM workspace_data;\n',
    },
    {
      id: "collision-review-view",
      name: "COLLISION-REVIEW-VIEW.CHART.JSON",
      kind: "chart",
      language: "Chart JSON",
      source: `${JSON.stringify({
        version: 1,
        title: "Existing view",
        description: "",
        source: data.id,
        mark: "bar",
        category: "Region",
        value: "Net Revenue",
        sort: "descending",
        format: "currency",
        color: "#ff5c35",
        maxItems: 8,
      }, null, 2)}\n`,
    },
    {
      id: "collision-review-report",
      name: "COLLISION-REVIEW-REPORT.MD",
      kind: "document",
      language: "Markdown",
      source: "# Existing report\n",
    },
    {
      id: "collision-review-briefing",
      name: "COLLISION-REVIEW-BRIEFING.DECK.MD",
      kind: "slides",
      language: "Deck Markdown",
      source: "---\nversion: 1\ntitle: Existing briefing\ntheme: rune\nratio: 16:9\nlang: en\n---\n\n# Existing briefing\n",
    },
  ];
  const before = structuredClone(existing);

  const result = prepareOperatingReviewWorkflow(existing, reviewInput({ title: "Collision Review" }));

  assert.deepEqual(result.errors, []);
  const created = creationsByKind(result);
  assert.deepEqual(result.plan.creations.map(({ artifact }) => [artifact.id, artifact.name]), [
    ["collision-review-analysis-2", "collision-review-analysis-2.sql"],
    ["collision-review-view-2", "collision-review-view-2.chart.json"],
    ["collision-review-report-2", "collision-review-report-2.md"],
    ["collision-review-briefing-2", "collision-review-briefing-2.deck.md"],
  ]);
  assert.equal(parseQueryDataSourceDirective(created.query.source).artifactId, data.id);
  assert.equal(parseChartSource(created.chart.source).spec.source, created.query.id);
  assert.ok(created.document.source.includes(`{{ chart("${created.chart.id}") }}`));
  assert.ok(created.slides.source.includes(`{{ chart("${created.chart.id}") }}`));
  assert.deepEqual(validateWorkspaceArtifacts([...existing, ...result.plan.creations.map(({ artifact }) => artifact)]), []);
  assert.deepEqual(existing, before);
});

test("does not mutate frozen workspace artifacts or workflow input on success or rejection", () => {
  const artifacts = freezeDeep([dataArtifact()]);
  const input = freezeDeep(reviewInput());
  const artifactsBefore = structuredClone(artifacts);
  const inputBefore = structuredClone(input);

  const valid = prepareOperatingReviewWorkflow(artifacts, input);
  const rejected = prepareOperatingReviewWorkflow(artifacts, {
    ...input,
    value: "Missing value",
  });

  assert.deepEqual(valid.errors, []);
  assert.equal(rejected.plan, undefined);
  assert.deepEqual(artifacts, artifactsBefore);
  assert.deepEqual(input, inputBefore);
});

test("saves one exact workflow identity and reruns it as patches instead of duplicate files", () => {
  const data = dataArtifact();
  const initialInput = reviewInput();
  const initial = prepareOperatingReviewWorkflow([data], initialInput);
  assert.ok(initial.plan);
  const workflow = createSavedOperatingReview(initialInput, initial.plan);
  assert.ok(workflow);
  const workspace = [data, ...initial.plan.creations.map(({ artifact }) => artifact)];
  const rerunInput = reviewInput({
    period: "FY26 Q3",
    focus: "Decide which region owns the next expansion experiment.",
    mark: "line",
  });

  const rerun = prepareSavedOperatingReviewRerun(workspace, workflow, rerunInput);

  assert.deepEqual(rerun.errors, []);
  assert.ok(rerun.plan);
  assert.deepEqual(rerun.plan.creations, []);
  assert.deepEqual(rerun.plan.patches.map((patch) => patch.artifactId), [
    workflow.artifactIds.query,
    workflow.artifactIds.chart,
    workflow.artifactIds.document,
    workflow.artifactIds.slides,
  ]);
  const next = workspace.map((artifact) => ({
    ...artifact,
    source: rerun.plan.patches.find((patch) => patch.artifactId === artifact.id)?.nextSource ?? artifact.source,
  }));
  assert.equal(next.length, workspace.length);
  assert.deepEqual(validateWorkspaceArtifacts(next), []);
  const chart = next.find((artifact) => artifact.id === workflow.artifactIds.chart);
  assert.equal(parseChartSource(chart.source).spec.source, workflow.artifactIds.query);
  assert.match(chart.source, /FY26 Q3/);
  for (const outputId of [workflow.artifactIds.document, workflow.artifactIds.slides]) {
    assert.ok(next.find((artifact) => artifact.id === outputId).source.includes(`{{ chart("${workflow.artifactIds.chart}") }}`));
  }
  assert.equal(rerun.workflow.id, workflow.id);
  assert.equal(rerun.workflow.input.period, "FY26 Q3");
});

test("rerun fails closed when a saved output disappears or the Data schema drifts", () => {
  const data = dataArtifact();
  const initial = prepareOperatingReviewWorkflow([data], reviewInput());
  const workflow = createSavedOperatingReview(reviewInput(), initial.plan);
  const workspace = [data, ...initial.plan.creations.map(({ artifact }) => artifact)];

  const missing = prepareSavedOperatingReviewRerun(
    workspace.filter((artifact) => artifact.id !== workflow.artifactIds.chart),
    workflow,
    reviewInput({ period: "FY26 Q3" }),
  );
  const drifted = prepareSavedOperatingReviewRerun(
    workspace.map((artifact) => artifact.id === data.id ? { ...artifact, source: "Market,Bookings\nAPAC,2\n" } : artifact),
    workflow,
    reviewInput({ period: "FY26 Q3" }),
  );

  assert.equal(missing.plan, undefined);
  assert.match(missing.errors.join(" "), /exact chart artifact/i);
  assert.equal(drifted.plan, undefined);
  assert.match(drifted.errors.join(" "), /category field|value field/i);
});

test("normalizes bounded saved workflows and rejects malformed or mismatched deliverables", () => {
  const initial = prepareOperatingReviewWorkflow([dataArtifact()], reviewInput());
  const workflow = createSavedOperatingReview(reviewInput(), initial.plan);
  const malformed = structuredClone(workflow);
  delete malformed.artifactIds.document;

  assert.deepEqual(normalizeSavedOperatingReviews([malformed]), []);
  assert.deepEqual(normalizeSavedOperatingReviews([workflow, workflow]).map((item) => item.id), [workflow.id]);
  assert.deepEqual(normalizeSavedOperatingReviews([{ ...workflow, id: "forged-task-id" }]), []);
  const many = Array.from({ length: 20 }, (_, index) => {
    const query = `${workflow.artifactIds.query}-${index}`;
    return {
      ...workflow,
      id: `operating-review:${query}`,
      artifactIds: { ...workflow.artifactIds, query },
    };
  });
  assert.equal(normalizeSavedOperatingReviews(many).length, 8);
});

test("records bounded newest-first task outcomes without storing workspace content", () => {
  const initial = prepareOperatingReviewWorkflow([dataArtifact()], reviewInput());
  const workflow = createSavedOperatingReview(reviewInput(), initial.plan);
  const first = appendOperatingReviewRun(workflow, {
    version: 1,
    id: "run:first",
    completedAt: "2026-08-13T08:00:00.000Z",
    period: "FY26 H1",
    status: "applied",
    stopReason: null,
    provider: "local",
    changedFileCount: 4,
    queryCount: 1,
    chartConsumerCount: 1,
    durationMs: 3400,
    inputTokens: null,
    outputTokens: null,
  });
  const second = appendOperatingReviewRun(first, {
    version: 1,
    id: "run:second",
    completedAt: "2026-08-13T09:00:00.000Z",
    period: "FY26 Q3",
    status: "applied",
    stopReason: null,
    provider: "openai",
    changedFileCount: 3,
    queryCount: 1,
    chartConsumerCount: 1,
    durationMs: 5100,
    inputTokens: 240,
    outputTokens: 91,
  });

  assert.deepEqual(second.runs.map((run) => run.id), ["run:second", "run:first"]);
  assert.equal(second.runs[0].inputTokens, 240);
  assert.deepEqual(summarizeOperatingReviewRuns(second.runs), {
    total: 2,
    applied: 2,
    stopped: 0,
    successRate: 100,
    averageDurationMs: 4250,
    modelRunCount: 1,
    inputTokens: 240,
    outputTokens: 91,
  });
  assert.doesNotMatch(JSON.stringify(second.runs), /source-data\.csv|1840000|durable growth/i);
  assert.deepEqual(normalizeSavedOperatingReviews([{ ...second, runs: [{ ...second.runs[0], status: "stopped", stopReason: null }] }])[0].runs, []);
});

test("caps task run history and discards malformed usage, duration, and timestamps", () => {
  const initial = prepareOperatingReviewWorkflow([dataArtifact()], reviewInput());
  let workflow = createSavedOperatingReview(reviewInput(), initial.plan);
  for (let index = 0; index < 20; index += 1) {
    workflow = appendOperatingReviewRun(workflow, {
      version: 1,
      id: `run:${index}`,
      completedAt: new Date(Date.UTC(2026, 7, 13, 10, index)).toISOString(),
      period: `Run ${index}`,
      status: "applied",
      stopReason: null,
      provider: "local",
      changedFileCount: 4,
      queryCount: 1,
      chartConsumerCount: 1,
      durationMs: index,
      inputTokens: null,
      outputTokens: null,
    });
  }
  assert.equal(workflow.runs.length, 12);
  assert.equal(workflow.runs[0].id, "run:19");
  assert.equal(workflow.runs.at(-1).id, "run:8");
  const malformed = { ...workflow, runs: [{ ...workflow.runs[0], completedAt: "not-a-date", durationMs: -1 }] };
  assert.deepEqual(normalizeSavedOperatingReviews([malformed])[0].runs, []);
  assert.deepEqual(summarizeOperatingReviewRuns([]), {
    total: 0,
    applied: 0,
    stopped: 0,
    successRate: null,
    averageDurationMs: null,
    modelRunCount: 0,
    inputTokens: null,
    outputTokens: null,
  });
});
