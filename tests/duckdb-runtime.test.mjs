import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import * as duckdb from "@duckdb/duckdb-wasm/blocking";
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
  const database = await duckdb.createDuckDB({
    mvp: { mainModule: path.join(dist, "duckdb-mvp.wasm"), mainWorker: "" },
    eh: { mainModule: path.join(dist, "duckdb-eh.wasm"), mainWorker: "" },
  }, new duckdb.VoidLogger(), duckdb.NODE_RUNTIME);
  await database.instantiate(() => {});
  database.open({});
  database.registerFileText("workspace.csv", data.source);
  const connection = database.connect();

  try {
    connection.query("CREATE TABLE workspace_data AS SELECT * FROM read_csv_auto('workspace.csv', header = true, sample_size = -1)");
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
  const database = await duckdb.createDuckDB({
    mvp: { mainModule: path.join(dist, "duckdb-mvp.wasm"), mainWorker: "" },
    eh: { mainModule: path.join(dist, "duckdb-eh.wasm"), mainWorker: "" },
  }, new duckdb.VoidLogger(), duckdb.NODE_RUNTIME);
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
    assert.deepEqual(rows.map((row) => Number(row[QUERY_PROVENANCE_COLUMN])), [1, 2]);
    assert.deepEqual(rows.map((row) => [row.Region, Number(row.amount), Number(String(row.projected))]), [
      ["Shared", 30, 33],
      ["Other", 20, 22],
    ]);
    assert.deepEqual(
      expandQueryLineageColumns(plan.projections, parsed.columns),
      ["Region", "Revenue", null],
    );
  } finally {
    connection.close();
  }
});
