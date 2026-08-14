import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import * as duckdb from "@duckdb/duckdb-wasm/blocking";
import { findChartReferences, resolveChartModel } from "../app/lib/charts.ts";
import { planLocalWorkspaceAgentChange } from "../app/lib/local-workspace-agent.ts";
import { prepareOperatingReviewWorkflow } from "../app/lib/operating-review.ts";
import { prepareWorkspaceMutation } from "../app/lib/patches.ts";
import { createWorkspaceQuerySnapshot } from "../app/lib/query-snapshot.ts";
import {
  QUERY_PROVENANCE_COLUMN,
  buildBoundedQuery,
  buildQueryLineagePlan,
  expandQueryLineageColumns,
} from "../app/lib/sql.ts";
import { defaultArtifacts, parseDataSource } from "../app/lib/workspace.ts";

test("executes the golden workspace query in DuckDB-Wasm", async () => {
  const data = defaultArtifacts.find((artifact) => artifact.kind === "data");
  const query = defaultArtifacts.find((artifact) => artifact.id === "regional-analysis");
  const summaryQuery = defaultArtifacts.find((artifact) => artifact.id === "regional-summary");
  assert.ok(data);
  assert.ok(query);
  assert.ok(summaryQuery);

  const dist = path.resolve("node_modules/@duckdb/duckdb-wasm/dist");
  const database = await duckdb.createDuckDB(
    {
      mvp: { mainModule: path.join(dist, "duckdb-mvp.wasm"), mainWorker: "" },
      eh: { mainModule: path.join(dist, "duckdb-eh.wasm"), mainWorker: "" },
    },
    new duckdb.VoidLogger(),
    duckdb.NODE_RUNTIME,
  );
  await database.instantiate(() => {});
  database.open({});
  database.registerFileText("workspace.csv", data.source);
  const connection = database.connect();

  try {
    connection.query(
      "CREATE TABLE workspace_data AS SELECT * FROM read_csv_auto('workspace.csv', header = true, sample_size = -1)",
    );
    const result = connection.query(buildBoundedQuery(query.source));
    const first = result.toArray()[0].toJSON();
    assert.equal(result.numRows, 4);
    assert.equal(first.Region, "APAC");
    assert.equal(first.margin_pct, 39.1);
    const summary = connection.query(buildBoundedQuery(summaryQuery.source));
    const scalar = summary.toArray()[0].toJSON();
    assert.equal(summary.numRows, 1);
    assert.equal(Number(scalar.total_q2_revenue), 4_820_000);
    assert.equal(Number(scalar.qoq_growth_pct), 12.4);
    assert.equal(Number(scalar.gross_margin_pct), 35);
  } finally {
    connection.close();
  }
});

test("preserves canonical parser row identity through filter, sort, aliases, and derived cells", async () => {
  const source = "Region,Revenue\nShared,10\n,,\nShared,30\nOther,20";
  const parsed = parseDataSource(source);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.rows.length, 3);
  const plan = buildQueryLineagePlan(`SELECT Region, Revenue AS amount,
    ROUND(CAST(Revenue AS DOUBLE) * 1.1, 1) AS projected
  FROM workspace_data
  WHERE Revenue >= 20
  ORDER BY Revenue DESC`);
  assert.ok(plan);

  const dist = path.resolve("node_modules/@duckdb/duckdb-wasm/dist");
  const database = await duckdb.createDuckDB(
    {
      mvp: { mainModule: path.join(dist, "duckdb-mvp.wasm"), mainWorker: "" },
      eh: { mainModule: path.join(dist, "duckdb-eh.wasm"), mainWorker: "" },
    },
    new duckdb.VoidLogger(),
    duckdb.NODE_RUNTIME,
  );
  await database.instantiate(() => {});
  database.open({});
  const canonicalRows = parsed.rows.map((row, index) => ({ ...row, __rune_import_order__: index }));
  database.registerFileText("canonical.json", JSON.stringify(canonicalRows));
  const connection = database.connect();

  try {
    connection.query(`CREATE TABLE workspace_data AS
      SELECT Region, Revenue FROM read_json_auto('canonical.json', format = 'array')
      ORDER BY __rune_import_order__`);
    const result = connection.query(buildBoundedQuery(plan.sql));
    const rows = result.toArray().map((row) => row.toJSON());
    assert.deepEqual(
      rows.map((row) => Number(row[QUERY_PROVENANCE_COLUMN])),
      [1, 2],
    );
    assert.deepEqual(
      rows.map((row) => [row.Region, Number(row.amount), Number(String(row.projected))]),
      [
        ["Shared", 30, 33],
        ["Other", 20, 22],
      ],
    );
    assert.deepEqual(expandQueryLineageColumns(plan.projections, parsed.columns), ["Region", "Revenue", null]);
  } finally {
    connection.close();
  }
});

test("executes the shipped no-key analysis workflow and resolves its linked Chart from the real DuckDB result", async () => {
  const plan = planLocalWorkspaceAgentChange(defaultArtifacts, "根据收入数据创建 SQL 分析、图表和报告");
  const prepared = prepareWorkspaceMutation(defaultArtifacts, [], plan.creations);
  assert.deepEqual(prepared.errors, []);
  const query = plan.creations.find((creation) => creation.artifact.kind === "query")?.artifact;
  const chart = plan.creations.find((creation) => creation.artifact.kind === "chart")?.artifact;
  const report = plan.creations.find((creation) => creation.artifact.kind === "document")?.artifact;
  const data = defaultArtifacts.find((artifact) => artifact.id === "regional-revenue");
  assert.ok(query && chart && report && data);

  const dist = path.resolve("node_modules/@duckdb/duckdb-wasm/dist");
  const database = await duckdb.createDuckDB(
    {
      mvp: { mainModule: path.join(dist, "duckdb-mvp.wasm"), mainWorker: "" },
      eh: { mainModule: path.join(dist, "duckdb-eh.wasm"), mainWorker: "" },
    },
    new duckdb.VoidLogger(),
    duckdb.NODE_RUNTIME,
  );
  await database.instantiate(() => {});
  database.open({});
  database.registerFileText("workflow.csv", data.source);
  const connection = database.connect();

  try {
    connection.query(
      "CREATE TABLE workspace_data AS SELECT * FROM read_csv_auto('workflow.csv', header = true, sample_size = -1)",
    );
    const result = connection.query(buildBoundedQuery(query.source));
    const columns = result.schema.fields.map((field) => field.name);
    const rows = result.toArray().map((row) => {
      const object = row.toJSON();
      return columns.map((column) => (typeof object[column] === "bigint" ? Number(object[column]) : object[column]));
    });
    const snapshot = createWorkspaceQuerySnapshot(query, data, {
      columns,
      rows,
      truncated: false,
      sourceRowIndices: rows.map(() => null),
      cellLineage: rows.map(() => columns.map(() => null)),
    });
    const resolution = resolveChartModel(chart, prepared.nextArtifacts, parseDataSource, [snapshot]);
    assert.deepEqual(resolution.errors, []);
    assert.equal(resolution.model.data.length, 4);
    assert.equal(resolution.model.data[0].label, "APAC");
    assert.equal(resolution.model.data[0].formatted, "$1.84M");
    assert.deepEqual(findChartReferences(report.source), [chart.id]);
  } finally {
    connection.close();
  }
});

test("executes an exact-scope operating review Query in real DuckDB without leaking other periods", async () => {
  const data = {
    id: "period-data",
    name: "period-data.csv",
    kind: "data",
    language: "CSV / JSON",
    source: "Period,Region,Revenue\nJuly,APAC,100\nJune,APAC,N/A\nJuly,Europe,80\nJune,Europe,$700\n",
  };
  const prepared = prepareOperatingReviewWorkflow([data], {
    title: "July review",
    dataArtifactId: data.id,
    category: "Region",
    value: "Revenue",
    aggregation: "sum",
    mark: "bar",
    format: "number",
    scope: { field: "Period", value: "July" },
    period: "July 2026",
    audience: "leadership",
    focus: "Review the current period evidence.",
    deliverables: ["document"],
    locale: "en",
  });
  assert.deepEqual(prepared.errors, []);
  const query = prepared.plan.creations.find((creation) => creation.artifact.kind === "query")?.artifact;
  assert.ok(query);

  const dist = path.resolve("node_modules/@duckdb/duckdb-wasm/dist");
  const database = await duckdb.createDuckDB(
    {
      mvp: { mainModule: path.join(dist, "duckdb-mvp.wasm"), mainWorker: "" },
      eh: { mainModule: path.join(dist, "duckdb-eh.wasm"), mainWorker: "" },
    },
    new duckdb.VoidLogger(),
    duckdb.NODE_RUNTIME,
  );
  await database.instantiate(() => {});
  database.open({});
  database.registerFileText("period-data.csv", data.source);
  const connection = database.connect();
  try {
    connection.query(
      "CREATE TABLE workspace_data AS SELECT * FROM read_csv_auto('period-data.csv', header = true, sample_size = -1)",
    );
    const result = connection.query(buildBoundedQuery(query.source));
    const rows = result.toArray().map((row) => row.toJSON());
    assert.deepEqual(
      rows.map((row) => [row.Region, Number(row.Revenue)]),
      [
        ["APAC", 100],
        ["Europe", 80],
      ],
    );
  } finally {
    connection.close();
  }
});

test("executes a paired exact-scope operating review delta in real DuckDB", async () => {
  const data = {
    id: "comparison-data",
    name: "comparison-data.csv",
    kind: "data",
    language: "CSV / JSON",
    source:
      "Period,Region,Revenue\nJuly,APAC,100\nJune,APAC,90\nJuly,Europe,80\nJune,Europe,100\nJuly,LATAM,40\nJune,North America,30\nMay,APAC,N/A\n",
  };
  const prepared = prepareOperatingReviewWorkflow([data], {
    title: "July comparison",
    dataArtifactId: data.id,
    category: "Region",
    value: "Revenue",
    aggregation: "sum",
    mark: "bar",
    format: "number",
    scope: { field: "Period", value: "July" },
    comparisonScope: { field: "Period", value: "June" },
    period: "July vs June 2026",
    audience: "leadership",
    focus: "Review exact period changes.",
    deliverables: ["document"],
    locale: "en",
  });
  assert.deepEqual(prepared.errors, []);
  const query = prepared.plan.creations.find((creation) => creation.artifact.kind === "query")?.artifact;
  assert.ok(query);

  const dist = path.resolve("node_modules/@duckdb/duckdb-wasm/dist");
  const database = await duckdb.createDuckDB(
    {
      mvp: { mainModule: path.join(dist, "duckdb-mvp.wasm"), mainWorker: "" },
      eh: { mainModule: path.join(dist, "duckdb-eh.wasm"), mainWorker: "" },
    },
    new duckdb.VoidLogger(),
    duckdb.NODE_RUNTIME,
  );
  await database.instantiate(() => {});
  database.open({});
  database.registerFileText("comparison-data.csv", data.source);
  const connection = database.connect();
  try {
    connection.query(
      "CREATE TABLE workspace_data AS SELECT * FROM read_csv_auto('comparison-data.csv', header = true, sample_size = -1)",
    );
    const result = connection.query(buildBoundedQuery(query.source));
    const rows = result.toArray().map((row) => row.toJSON());
    assert.deepEqual(
      rows.map((row) => [
        row.Region,
        Number(row.Revenue),
        Number(row["Revenue comparison"]),
        Number(row["Revenue change"]),
      ]),
      [
        ["APAC", 100, 90, 10],
        ["Europe", 80, 100, -20],
      ],
    );
  } finally {
    connection.close();
  }
});
