import assert from "node:assert/strict";
import test from "node:test";

import { parseChartSource } from "../app/lib/charts.ts";
import { compileArtifactSource } from "../app/lib/bindings.ts";
import { parseDeckSource } from "../app/lib/deck.ts";
import {
  appendOperatingReviewRun,
  createSavedOperatingReview,
  normalizeSavedOperatingReviews,
  prepareOperatingReviewEvidence,
  prepareOperatingReviewWorkflow,
  prepareSavedOperatingReviewRerun,
  summarizeOperatingReviewRuns,
} from "../app/lib/operating-review.ts";
import { validateWorkspaceArtifacts } from "../app/lib/patches.ts";
import { parseQueryDataSourceDirective } from "../app/lib/query-source.ts";
import { createWorkspaceQuerySnapshot } from "../app/lib/query-snapshot.ts";

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
  assert.match(created.query.source, /SUM\(CAST\("Net Revenue" AS DOUBLE\)\) AS "Net Revenue"/);
  assert.match(created.query.source, /GROUP BY "Region"/);

  assert.deepEqual(parseChartSource(created.chart.source).spec, {
    version: 1,
    title: "Net Revenue by Region",
    description: "Sum for FY26 H1 · all Data rows · source-data.csv",
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

test("derives bounded aggregate evidence in the same order as the generated Query", () => {
  const data = dataArtifact({
    source: "Region,Net Revenue\nAPAC,100\nEurope,80\nAPAC,50\nNorth America,120\n",
  });
  const sum = prepareOperatingReviewEvidence([data], reviewInput());
  assert.deepEqual(sum.errors, []);
  assert.deepEqual(sum.evidenceRows, [
    { id: "result-1", category: "APAC", value: 150, sourceRowCount: 2 },
    { id: "result-2", category: "North America", value: 120, sourceRowCount: 1 },
    { id: "result-3", category: "Europe", value: 80, sourceRowCount: 1 },
  ]);

  const averageLine = prepareOperatingReviewEvidence([data], reviewInput({ aggregation: "average", mark: "line" }));
  assert.deepEqual(averageLine.evidenceRows, [
    { id: "result-1", category: "APAC", value: 75, sourceRowCount: 2 },
    { id: "result-2", category: "Europe", value: 80, sourceRowCount: 1 },
    { id: "result-3", category: "North America", value: 120, sourceRowCount: 1 },
  ]);
});

test("applies one exact Data scope consistently to evidence, SQL, charts, and deliverables", () => {
  const data = dataArtifact({
    source: "Period,Region,Net Revenue\nJuly,APAC,100\nJune,APAC,900\nJuly,Europe,80\nJune,Europe,700\n",
  });
  const input = reviewInput({
    period: "July 2026",
    scope: { field: "Period", value: "July" },
  });

  const evidence = prepareOperatingReviewEvidence([data], input);
  assert.deepEqual(evidence.errors, []);
  assert.equal(evidence.matchedRowCount, 2);
  assert.deepEqual(evidence.scope, { field: "Period", value: "July" });
  assert.deepEqual(evidence.evidenceRows, [
    { id: "result-1", category: "APAC", value: 100, sourceRowCount: 1 },
    { id: "result-2", category: "Europe", value: 80, sourceRowCount: 1 },
  ]);

  const result = prepareOperatingReviewWorkflow([data], input);
  assert.deepEqual(result.errors, []);
  const created = creationsByKind(result);
  assert.match(created.query.source, /AND "Period" = 'July'/u);
  assert.match(parseChartSource(created.chart.source).spec.description, /Period = July/u);
  assert.match(created.document.source, /Within \*\*Period = July\*\*/u);
  assert.match(created.slides.source, /Data scope · Period = July/u);
  assert.deepEqual(validateWorkspaceArtifacts([data, ...result.plan.creations.map(({ artifact }) => artifact)]), []);
});

test("validates numeric evidence only inside the exact eligible Data scope", () => {
  const data = dataArtifact({
    source: "Period,Region,Net Revenue\nJuly,APAC,100\nJuly,Europe,80\nJune,APAC,N/A\nJune,Europe,$700\n",
  });
  const julyInput = reviewInput({ scope: { field: "Period", value: "July" } });

  const evidence = prepareOperatingReviewEvidence([data], julyInput);
  assert.deepEqual(evidence.errors, []);
  assert.equal(evidence.matchedRowCount, 2);
  assert.deepEqual(evidence.evidenceRows.map((row) => row.value), [100, 80]);

  const scoped = prepareOperatingReviewWorkflow([data], julyInput);
  assert.deepEqual(scoped.errors, []);
  assert.match(creationsByKind(scoped).query.source, /AND "Period" = 'July'/u);

  const allRows = prepareOperatingReviewWorkflow([data], reviewInput({ scope: null }));
  assert.equal(allRows.plan, undefined);
  assert.match(allRows.errors.join(" "), /finite numeric values, not formatted text/u);
});

test("escapes exact text scope values and fails closed when a saved scope no longer matches", () => {
  const data = dataArtifact({
    source: "Period,Region,Net Revenue\nQ4's,APAC,100\nQ3,Europe,80\n",
  });
  const prepared = prepareOperatingReviewWorkflow([data], reviewInput({
    scope: { field: "Period", value: "Q4's" },
  }));
  assert.deepEqual(prepared.errors, []);
  assert.match(creationsByKind(prepared).query.source, /AND "Period" = 'Q4''s'/u);

  const stale = prepareOperatingReviewWorkflow([data], reviewInput({
    scope: { field: "Period", value: "Q2" },
  }));
  assert.equal(stale.plan, undefined);
  assert.match(stale.errors.join(" "), /no longer matches any current Data row/u);

  const missingField = prepareOperatingReviewWorkflow([data], reviewInput({
    scope: { field: "period", value: "Q3" },
  }));
  assert.equal(missingField.plan, undefined);
  assert.match(missingField.errors.join(" "), /exact visible scope field/u);
});

test("compiles model-proposed review questions with every number kept in a live Query-row binding", () => {
  const data = dataArtifact();
  const input = reviewInput();
  const narrative = {
    insights: [
      {
        primaryEvidenceRowId: "result-1",
        supportingEvidenceRowId: "result-2",
        title: "Where is the result concentrated?",
        question: "What evidence explains the gap between the leading and comparison aggregates?",
        decisionPrompt: "Review whether the current allocation should change before assigning an owner.",
      },
      {
        primaryEvidenceRowId: "result-2",
        supportingEvidenceRowId: null,
        title: "What needs closer review?",
        question: "Could scope or definition choices materially affect this visible pattern?",
        decisionPrompt: "Confirm the evidence boundary before making a final operating decision.",
      },
    ],
  };
  const result = prepareOperatingReviewWorkflow([data], input, narrative);
  assert.deepEqual(result.errors, []);
  const created = creationsByKind(result);
  const firstBinding = `{{ metric("${created.query.id}", "Net Revenue", "currency", "0") }}`;
  const secondBinding = `{{ metric("${created.query.id}", "Net Revenue", "currency", "1") }}`;
  for (const artifact of [created.document, created.slides]) {
    assert.ok(artifact.source.includes(firstBinding));
    assert.ok(artifact.source.includes(secondBinding));
    assert.doesNotMatch(artifact.source, /What evidence explains[^\n]*1840000/u);
  }
  assert.match(created.document.source, /Evidence-led review prompts/u);
  assert.match(created.slides.source, /What the evidence must decide/u);
  assert.deepEqual(parseDeckSource(created.slides.source).errors, []);
  const workspace = [data, ...result.plan.creations.map(({ artifact }) => artifact)];
  assert.deepEqual(validateWorkspaceArtifacts(workspace), []);

  const snapshot = createWorkspaceQuerySnapshot(created.query, data, {
    columns: ["Region", "Net Revenue"],
    rows: [["APAC", 1_840_000], ["Europe", 970_000]],
    sourceRowIndices: [null, null],
    cellLineage: [[null, null], [null, null]],
    lineageMode: "read-only",
    elapsedMs: 2,
    truncated: false,
    engine: "DuckDB-Wasm test fixture",
  });
  const compiled = compileArtifactSource(created.document.source, workspace, [snapshot]);
  assert.deepEqual(compiled.queryMetricRuntimeErrors, []);
  assert.match(compiled.source, /\$1\.84M/u);
  assert.match(compiled.source, /\$970K/u);
});

test("rejects model review text that duplicates evidence, copies category labels, or contains static numbers", () => {
  const baseInsights = [
    {
      primaryEvidenceRowId: "result-1",
      supportingEvidenceRowId: null,
      title: "Where is the result concentrated?",
      question: "What evidence explains the visible gap?",
      decisionPrompt: "Review whether the current allocation should change.",
    },
    {
      primaryEvidenceRowId: "result-2",
      supportingEvidenceRowId: null,
      title: "What needs closer review?",
      question: "Could scope choices affect this pattern?",
      decisionPrompt: "Confirm the evidence boundary before deciding.",
    },
  ];
  const scenarios = [
    [baseInsights.map((insight) => ({ ...insight, primaryEvidenceRowId: "result-1" })), /unique exact primary evidence row/i],
    [[{ ...baseInsights[0], title: "Why does APAC lead?" }, baseInsights[1]], /generic qualitative text/i],
    [[{ ...baseInsights[0], question: "Why is the result 20 percent higher?" }, baseInsights[1]], /generic qualitative text/i],
  ];
  for (const [insights, expected] of scenarios) {
    const prepared = prepareOperatingReviewWorkflow([dataArtifact()], reviewInput(), { insights });
    assert.equal(prepared.plan, undefined);
    assert.match(prepared.errors.join(" "), expected);
  }
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
  assert.match(created.query.source, /AVG\(CAST\("净收入" AS DOUBLE\)\) AS "净收入"/);
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
  assert.match(created.query.source, /SUM\(CAST\("淨收入" AS DOUBLE\)\) AS "淨收入"/);
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

test("persists and changes an exact Data scope while retaining saved output identities", () => {
  const data = dataArtifact({
    source: "Period,Region,Net Revenue\nJuly,APAC,100\nJuly,Europe,80\nJune,APAC,90\nJune,Europe,70\n",
  });
  const initialInput = reviewInput({ scope: { field: "Period", value: "July" } });
  const initial = prepareOperatingReviewWorkflow([data], initialInput);
  const workflow = createSavedOperatingReview(initialInput, initial.plan);
  assert.deepEqual(workflow.input.scope, { field: "Period", value: "July" });
  assert.deepEqual(normalizeSavedOperatingReviews([workflow])[0].input.scope, { field: "Period", value: "July" });
  const workspace = [data, ...initial.plan.creations.map(({ artifact }) => artifact)];

  const rerun = prepareSavedOperatingReviewRerun(
    workspace,
    workflow,
    reviewInput({ period: "June 2026", scope: { field: "Period", value: "June" } }),
  );
  assert.deepEqual(rerun.errors, []);
  assert.deepEqual(rerun.plan.creations, []);
  assert.deepEqual(rerun.workflow.input.scope, { field: "Period", value: "June" });
  const queryPatch = rerun.plan.patches.find((patch) => patch.artifactId === workflow.artifactIds.query);
  assert.match(queryPatch.nextSource, /AND "Period" = 'June'/u);
});

test("rewires model narrative bindings to the saved Query identity during rerun", () => {
  const data = dataArtifact();
  const input = reviewInput();
  const initial = prepareOperatingReviewWorkflow([data], input);
  const workflow = createSavedOperatingReview(input, initial.plan);
  const workspace = [data, ...initial.plan.creations.map(({ artifact }) => artifact)];
  const narrative = {
    insights: [
      {
        primaryEvidenceRowId: "result-1",
        supportingEvidenceRowId: null,
        title: "Where is the result concentrated?",
        question: "What evidence explains the visible leading pattern?",
        decisionPrompt: "Review whether the current allocation should change.",
      },
      {
        primaryEvidenceRowId: "result-2",
        supportingEvidenceRowId: null,
        title: "What needs closer review?",
        question: "Could scope choices materially affect this pattern?",
        decisionPrompt: "Confirm the evidence boundary before deciding.",
      },
    ],
  };
  const rerun = prepareSavedOperatingReviewRerun(
    workspace,
    workflow,
    reviewInput({ period: "FY26 Q3" }),
    narrative,
  );
  assert.deepEqual(rerun.errors, []);
  for (const artifactId of [workflow.artifactIds.document, workflow.artifactIds.slides]) {
    const source = rerun.plan.patches.find((patch) => patch.artifactId === artifactId)?.nextSource ?? "";
    assert.ok(source.includes(`{{ metric("${workflow.artifactIds.query}", "Net Revenue", "currency", "0") }}`));
    assert.doesNotMatch(source, /fy26-growth-review-analysis-2/u);
  }
  const next = workspace.map((artifact) => ({
    ...artifact,
    source: rerun.plan.patches.find((patch) => patch.artifactId === artifact.id)?.nextSource ?? artifact.source,
  }));
  assert.deepEqual(validateWorkspaceArtifacts(next), []);
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
