import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_QUERY_ROWS,
  QUERY_PROVENANCE_COLUMN,
  buildBoundedQuery,
  buildQueryLineagePlan,
  expandQueryLineageColumns,
  normalizeQuerySourceRowIndex,
  normalizeReadQuery,
  queryLineageColumnsForOutput,
  queryLineageRevisionMatches,
  queryLineageSourceIsSupported,
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

test("compiles a row-preserving SELECT into hidden source-row lineage", () => {
  const plan = buildQueryLineagePlan(`SELECT
  Region,
  "Q2 Revenue" AS q2_revenue,
  ROUND(("Q2 Revenue" - Cost) / "Q2 Revenue" * 100, 1) AS margin_pct
FROM workspace_data
WHERE Customers > 0
ORDER BY "Q2 Revenue" DESC`);
  assert.ok(plan);
  assert.match(plan.sql, new RegExp(`workspace_data\\.rowid AS "${QUERY_PROVENANCE_COLUMN}"`));
  assert.deepEqual(plan.projections, [
    { kind: "column", sourceColumn: "Region" },
    { kind: "column", sourceColumn: "Q2 Revenue" },
    { kind: "derived" },
  ]);
  assert.deepEqual(
    expandQueryLineageColumns(plan.projections, ["Region", "Q2 Revenue", "Cost", "Customers"]),
    ["Region", "Q2 Revenue", null],
  );
});

test("expands a qualified star and resolves direct aliases by projection order", () => {
  const plan = buildQueryLineagePlan(`SELECT wd.*, wd.Region AS copied_region
FROM workspace_data AS wd
WHERE wd.Revenue >= 20
LIMIT 10`);
  assert.ok(plan);
  assert.match(plan.sql, new RegExp(`wd\\.rowid AS "${QUERY_PROVENANCE_COLUMN}"`));
  assert.deepEqual(plan.projections, [
    { kind: "star" },
    { kind: "column", sourceColumn: "Region" },
  ]);
  assert.deepEqual(
    expandQueryLineageColumns(plan.projections, ["Region", "Revenue"]),
    ["Region", "Revenue", "Region"],
  );
});

test("withholds lineage from row-collapsing, row-expanding, or multi-source queries", () => {
  const readOnly = [
    "WITH rows AS (SELECT * FROM workspace_data) SELECT * FROM rows",
    "SELECT SUM(Revenue) AS total FROM workspace_data",
    "SELECT DISTINCT Region FROM workspace_data",
    "SELECT Region, SUM(Revenue) FROM workspace_data GROUP BY Region",
    "SELECT Region FROM workspace_data HAVING COUNT(*) > 1",
    "SELECT a.Region FROM workspace_data a JOIN workspace_data b USING (Region)",
    "SELECT a.Region FROM workspace_data a, workspace_data b",
    "SELECT UNNEST([1, 2]) FROM workspace_data",
    "SELECT mystery_scalar(Revenue) FROM workspace_data",
    "SELECT (SELECT MAX(Revenue) FROM workspace_data) FROM workspace_data",
    "SELECT Region FROM workspace_data WHERE EXISTS (SELECT 1 FROM workspace_data AS other)",
    "SELECT Region FROM workspace_data UNION ALL SELECT Region FROM workspace_data",
    "SELECT Region FROM workspace_data INTERSECT SELECT Region FROM workspace_data",
    "SELECT Region FROM workspace_data EXCEPT SELECT Region FROM workspace_data",
    "SELECT Region FROM workspace_data PIVOT (SUM(Revenue) FOR Region IN ('APAC'))",
    "SELECT Region FROM workspace_data USING SAMPLE 10%",
    "SELECT Region, ROW_NUMBER() OVER () FROM workspace_data",
    "SELECT Region FROM workspace_data QUALIFY ROW_NUMBER() OVER () = 1",
    "SELECT Region FROM another_table",
    `SELECT Region AS ${QUERY_PROVENANCE_COLUMN} FROM workspace_data`,
  ];
  readOnly.forEach((query) => assert.equal(buildQueryLineagePlan(query), null, query));

  assert.ok(buildQueryLineagePlan(`SELECT Region,
    CASE WHEN Revenue > 20 THEN 'high' ELSE 'low' END AS band,
    CAST(Revenue AS DOUBLE) AS numeric_revenue
  FROM workspace_data
  ORDER BY Revenue DESC`));

  const arityMismatch = buildQueryLineagePlan(
    "SELECT * REPLACE (Revenue * 2 AS Revenue) FROM workspace_data",
  );
  assert.ok(arityMismatch);
  assert.equal(queryLineageColumnsForOutput(arityMismatch.projections, ["Region", "Revenue"], 2), null);

  const nonColumnExpressions = buildQueryLineagePlan(
    "SELECT current_date, wd FROM workspace_data AS wd",
  );
  assert.ok(nonColumnExpressions);
  assert.deepEqual(nonColumnExpressions.projections, [{ kind: "derived" }, { kind: "derived" }]);
});

test("rejects reserved sources, unsafe row ids, and stale query/data revisions", () => {
  assert.equal(queryLineageSourceIsSupported(["Region", "Revenue"]), true);
  assert.equal(queryLineageSourceIsSupported([]), false);
  assert.equal(queryLineageSourceIsSupported(["Region", "region"]), false);
  assert.equal(queryLineageSourceIsSupported(["ROWID", "Revenue"]), false);
  assert.equal(queryLineageSourceIsSupported([QUERY_PROVENANCE_COLUMN.toUpperCase()]), false);

  assert.equal(normalizeQuerySourceRowIndex(2n, 3), 2);
  assert.equal(normalizeQuerySourceRowIndex("1", 3), 1);
  assert.equal(normalizeQuerySourceRowIndex(-1, 3), null);
  assert.equal(normalizeQuerySourceRowIndex(3, 3), null);
  assert.equal(normalizeQuerySourceRowIndex(1.5, 3), null);
  assert.equal(normalizeQuerySourceRowIndex("not-a-row", 3), null);

  const revision = { querySource: "SELECT Region FROM workspace_data", dataArtifactId: "data", dataSource: "Region\nAPAC" };
  assert.equal(queryLineageRevisionMatches(revision, revision.querySource, revision.dataArtifactId, revision.dataSource), true);
  assert.equal(queryLineageRevisionMatches(revision, `${revision.querySource} LIMIT 1`, revision.dataArtifactId, revision.dataSource), false);
  assert.equal(queryLineageRevisionMatches(revision, revision.querySource, "other", revision.dataSource), false);
  assert.equal(queryLineageRevisionMatches(revision, revision.querySource, revision.dataArtifactId, `${revision.dataSource}\nEMEA`), false);
});
