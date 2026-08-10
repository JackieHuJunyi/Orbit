import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import * as duckdb from "@duckdb/duckdb-wasm/blocking";
import { buildBoundedQuery } from "../app/lib/sql.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";

test("executes the golden workspace query in DuckDB-Wasm", async () => {
  const data = defaultArtifacts.find((artifact) => artifact.kind === "data");
  const query = defaultArtifacts.find((artifact) => artifact.kind === "query");
  assert.ok(data);
  assert.ok(query);

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
  } finally {
    connection.close();
  }
});
