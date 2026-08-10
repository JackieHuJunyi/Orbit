import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_QUERY_ROWS,
  buildBoundedQuery,
  normalizeReadQuery,
  validateReadQuery,
} from "../app/lib/sql.ts";

test("accepts one read-only SELECT or WITH query", () => {
  assert.deepEqual(validateReadQuery("SELECT * FROM workspace_data;"), []);
  assert.deepEqual(validateReadQuery("-- note\nWITH rows AS (SELECT 1 AS id) SELECT * FROM rows;"), []);
  assert.deepEqual(validateReadQuery("SELECT ';' AS punctuation, '-- text' AS note;"), []);
  assert.equal(normalizeReadQuery("/* note */ SELECT 1;;"), "SELECT 1");
});

test("rejects mutation and multiple SQL statements", () => {
  assert.match(validateReadQuery("UPDATE workspace_data SET value = 1")[0], /read-only/);
  assert.match(validateReadQuery("SELECT 1; SELECT 2;")[0], /one SQL statement/);
});

test("wraps live queries in a bounded result contract", () => {
  const query = buildBoundedQuery("SELECT * FROM workspace_data;");
  assert.match(query, /^SELECT \* FROM \(SELECT/);
  assert.match(query, new RegExp(`LIMIT ${MAX_QUERY_ROWS + 1}$`));
  assert.match(buildBoundedQuery("SELECT 1", 50_000), new RegExp(`LIMIT ${MAX_QUERY_ROWS + 1}$`));
});
