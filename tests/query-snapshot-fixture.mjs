import assert from "node:assert/strict";

import { createWorkspaceQuerySnapshot } from "../app/lib/query-snapshot.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";

export function defaultQuerySnapshot() {
  const query = defaultArtifacts.find((artifact) => artifact.id === "regional-analysis");
  const data = defaultArtifacts.find((artifact) => artifact.id === "regional-revenue");
  assert.ok(query);
  assert.ok(data);
  const sourceColumns = ["Region", "Q2 Revenue", "Q1 Revenue", null, "Customers"];
  const rows = [
    ["APAC", 1_840_000, 1_540_000, 39.1, 148],
    ["North America", 1_560_000, 1_490_000, 35.3, 121],
    ["Europe", 970_000, 920_000, 28.9, 84],
    ["LATAM", 450_000, 340_000, 30, 39],
  ];
  return createWorkspaceQuerySnapshot(query, data, {
    columns: ["Region", "q2_revenue", "q1_revenue", "margin_pct", "Customers"],
    rows,
    sourceRowIndices: [0, 1, 2, 3],
    cellLineage: rows.map((_row, sourceRowIndex) => sourceColumns.map((sourceColumn) => (
      sourceColumn ? { sourceRowIndex, sourceColumn } : null
    ))),
    lineageMode: "direct",
    elapsedMs: 4,
    truncated: false,
    engine: "DuckDB-Wasm fixture",
  });
}
