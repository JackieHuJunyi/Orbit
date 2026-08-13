import assert from "node:assert/strict";
import path from "node:path";

import * as duckdb from "@duckdb/duckdb-wasm/blocking";
import { findChartReferences, parseChartSource } from "../app/lib/charts.ts";
import { parseDeckSource } from "../app/lib/deck.ts";
import { prepareWorkspaceMutation } from "../app/lib/patches.ts";
import { buildBoundedQuery } from "../app/lib/sql.ts";
import { portableSourceRevision } from "../app/lib/source-revision.ts";
import { prepareRuneTaskProvider } from "../app/lib/task-providers.ts";
import {
  operatingReviewMetricField,
  prepareOperatingReviewEvidence,
} from "../app/lib/operating-review.ts";
import { parseDataSource } from "../app/lib/workspace.ts";
import { RUNE_GOLDEN_TASK_SET_VERSION, RUNE_GOLDEN_TASKS } from "./golden-task-set.ts";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function cloneFrozen(value) {
  return deepFreeze(structuredClone(value));
}

function outputArtifacts(plan, nextArtifacts) {
  const ids = [
    ...plan.creations.map((creation) => creation.artifact.id),
    ...plan.patches.map((patch) => patch.artifactId),
  ];
  return ids.map((id) => nextArtifacts.find((artifact) => artifact.id === id)).filter(Boolean);
}

function comparableEvidence(rows) {
  return rows.map((row) => ({
    category: row.category,
    value: row.value,
    ...(row.primaryValue == null ? {} : { primaryValue: row.primaryValue }),
    ...(row.comparisonValue == null ? {} : { comparisonValue: row.comparisonValue }),
  }));
}

function jsonValue(value) {
  if (typeof value === "bigint") return Number(value);
  if (value && typeof value === "object" && typeof value.toString === "function") {
    const number = Number(value.toString());
    if (Number.isFinite(number)) return number;
  }
  return value;
}

async function createRuntime() {
  const dist = path.resolve("node_modules/@duckdb/duckdb-wasm/dist");
  const database = await duckdb.createDuckDB({
    mvp: { mainModule: path.join(dist, "duckdb-mvp.wasm"), mainWorker: "" },
    eh: { mainModule: path.join(dist, "duckdb-eh.wasm"), mainWorker: "" },
  }, new duckdb.VoidLogger(), duckdb.NODE_RUNTIME);
  await database.instantiate(() => {});
  database.open({});
  return { database, connection: database.connect() };
}

function assertDocumentBriefing(task, artifacts) {
  const input = task.request.input;
  const output = artifacts.find((artifact) => artifact.kind === "slides");
  assert.ok(output, "presentation output is missing");
  const parsed = parseDeckSource(output.source);
  assert.deepEqual(parsed.errors, []);
  assert.ok(parsed.deck);
  assert.equal(parsed.deck.slides.length, task.expected.slideCount);
  assert.equal(parsed.deck.frontmatter.origin, input.sourceArtifactId);
  const source = task.artifacts.find((artifact) => artifact.id === input.sourceArtifactId);
  assert.ok(source);
  assert.equal(parsed.deck.frontmatter.origin_revision, portableSourceRevision(source.source));
  assert.equal(parsed.deck.frontmatter.lang, input.locale);
  assert.equal(parsed.deck.frontmatter.audience, input.audience);
  assert.equal(parsed.deck.frontmatter.purpose, input.focus);
  const sourceUnits = [...output.source.matchAll(/<!-- source-unit: (source-\d+) -->/gu)].map((match) => match[1]);
  assert.deepEqual(sourceUnits, Array.from({ length: input.slideCount - 2 }, (_, index) => `source-${index + 1}`));
  if (task.expected.refreshTargetId) {
    assert.equal(output.id, task.expected.refreshTargetId);
    assert.equal(output.name, task.expected.refreshTargetName);
    assert.equal(parsed.deck.frontmatter.theme, task.expected.refreshTheme);
  }
}

function assertOperatingReviewContract(task, output, runtimeRows) {
  const input = task.request.input;
  const evidence = prepareOperatingReviewEvidence(task.artifacts, input);
  assert.deepEqual(evidence.errors, []);
  assert.ok(evidence.evidenceRows);
  assert.deepEqual(comparableEvidence(evidence.evidenceRows), task.expected.evidenceRows);

  const query = output.find((artifact) => artifact.kind === "query");
  const chart = output.find((artifact) => artifact.kind === "chart");
  assert.ok(query && chart);
  const metricField = operatingReviewMetricField(input);
  assert.deepEqual(runtimeRows.map((row) => ({
    category: String(row[input.category]),
    value: Number(jsonValue(row[metricField])),
    ...(input.comparisonScope ? {
      primaryValue: Number(jsonValue(row[input.value])),
      comparisonValue: Number(jsonValue(row[`${input.value} comparison`])),
    } : {}),
  })), task.expected.evidenceRows);

  const chartSpec = parseChartSource(chart.source);
  assert.deepEqual(chartSpec.errors, []);
  assert.ok(chartSpec.spec);
  assert.equal(chartSpec.spec.source, query.id);
  assert.equal(chartSpec.spec.category, input.category);
  assert.equal(chartSpec.spec.value, metricField);
  assert.equal(chartSpec.spec.mark, input.mark);
  assert.equal(chartSpec.spec.format, input.format);
  for (const artifact of output.filter((candidate) => candidate.kind === "document" || candidate.kind === "slides")) {
    assert.deepEqual(findChartReferences(artifact.source), [chart.id]);
  }
}

async function runOperatingReviewQuery(runtime, task, output, runtimeIndex) {
  const input = task.request.input;
  const data = task.artifacts.find((artifact) => artifact.id === input.dataArtifactId);
  const query = output.find((artifact) => artifact.kind === "query");
  assert.ok(data && query);
  const parsed = parseDataSource(data.source);
  assert.deepEqual(parsed.errors, []);
  const fileName = `rune-golden-${runtimeIndex}.json`;
  runtime.database.registerFileText(fileName, JSON.stringify(parsed.rows.map((row, index) => ({
    ...row,
    __rune_import_order__: index,
  }))));
  runtime.connection.query(`CREATE OR REPLACE TABLE workspace_data AS
    SELECT * EXCLUDE (__rune_import_order__)
    FROM read_json_auto('${fileName}', format = 'array')
    ORDER BY __rune_import_order__`);
  const result = runtime.connection.query(buildBoundedQuery(query.source));
  return result.toArray().map((row) => row.toJSON());
}

function failedCase(task, error) {
  return {
    id: task.id,
    title: task.title,
    expected: task.expected.outcome,
    result: "failed",
    coverage: [...task.coverage],
    error: error instanceof Error ? error.message : String(error),
  };
}

export async function runRuneGoldenTaskSet() {
  const cases = [];
  const runtime = await createRuntime();
  let runtimeVerified = 0;
  try {
    for (const task of RUNE_GOLDEN_TASKS) {
      const artifacts = cloneFrozen(task.artifacts);
      const request = cloneFrozen(task.request);
      const beforeArtifacts = structuredClone(artifacts);
      const beforeRequest = structuredClone(request);
      try {
        const prepared = prepareRuneTaskProvider(artifacts, request);
        if (task.expected.outcome === "rejected") {
          assert.equal(prepared.plan, undefined, "a rejected task produced a plan");
          assert.ok(prepared.errors.length > 0, "a rejected task did not explain why it stopped");
          assert.match(prepared.errors.join("\n"), task.expected.error);
        } else {
          assert.deepEqual(prepared.errors, []);
          assert.ok(prepared.plan);
          const transaction = prepareWorkspaceMutation(artifacts, prepared.plan.patches, prepared.plan.creations);
          assert.deepEqual(transaction.errors, []);
          const output = outputArtifacts(prepared.plan, transaction.nextArtifacts);
          assert.deepEqual(output.map((artifact) => artifact.kind), task.expected.outputKinds);
          if (task.request.taskId === "operating-review") {
            const runtimeRows = await runOperatingReviewQuery(runtime, task, output, runtimeVerified);
            runtimeVerified += 1;
            assertOperatingReviewContract(task, output, runtimeRows);
          } else {
            assertDocumentBriefing(task, output);
          }
        }
        assert.deepEqual(artifacts, beforeArtifacts, "the provider mutated its artifact input");
        assert.deepEqual(request, beforeRequest, "the provider mutated its request input");
        cases.push({
          id: task.id,
          title: task.title,
          expected: task.expected.outcome,
          result: "passed",
          coverage: [...task.coverage],
        });
      } catch (error) {
        cases.push(failedCase(task, error));
      }
    }
  } finally {
    runtime.connection.close();
  }

  const passed = cases.filter((entry) => entry.result === "passed").length;
  const expectedSuccess = RUNE_GOLDEN_TASKS.filter((task) => task.expected.outcome === "success").length;
  const expectedRejected = RUNE_GOLDEN_TASKS.length - expectedSuccess;
  return {
    version: RUNE_GOLDEN_TASK_SET_VERSION,
    fixtureProvenance: "synthetic",
    taskCount: RUNE_GOLDEN_TASKS.length,
    passed,
    failed: cases.length - passed,
    expectedSuccess,
    expectedRejected,
    runtimeVerified,
    humanRated: 0,
    licensedRealTasks: 0,
    cases,
  };
}
