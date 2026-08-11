import assert from "node:assert/strict";
import test from "node:test";

import { buildAgentRuntimeRepair } from "../app/lib/agent-repair.ts";

const artifacts = [
  { id: "data", name: "data.csv", kind: "data", language: "CSV / JSON", source: "Item,Value\nRevenue,42" },
  { id: "analysis", name: "analysis.sql", kind: "query", language: "DuckDB SQL", source: '-- rune:data "data"\nSELECT SUM(Value) AS total FROM workspace_data;' },
];

test("builds exact bounded feedback from an unapplied runtime proposal", () => {
  const repair = buildAgentRuntimeRepair(
    artifacts,
    [{
      artifactId: "analysis",
      summary: "Use a new field",
      detail: "The first proposal references a missing field.",
      nextSource: '-- rune:data "data"\nSELECT SUM(missing_value) AS total FROM workspace_data;',
    }],
    [],
    new Error("Runtime impact preflight failed · Binder\nError:\u0000 missing_value"),
  );
  assert.equal(repair.attempt, 1);
  assert.equal(repair.failure, "Runtime impact preflight failed · Binder Error: missing_value");
  assert.deepEqual(repair.proposedArtifacts, [{
    artifactId: "analysis",
    name: "analysis.sql",
    kind: "query",
    language: "DuckDB SQL",
    proposedSource: '-- rune:data "data"\nSELECT SUM(missing_value) AS total FROM workspace_data;',
    isCreation: false,
  }]);
});

test("includes Rune-owned creation identity and refuses non-runtime or unknown feedback", () => {
  const creation = {
    artifact: { id: "forecast-data", name: "forecast-data.csv", kind: "data", language: "CSV / JSON", source: "Item,Value\nForecast,not-a-number" },
    summary: "Create forecast data",
    detail: "One Data source is proposed.",
  };
  assert.equal(buildAgentRuntimeRepair(artifacts, [], [creation], "invalid chart value")
    .proposedArtifacts[0].isCreation, true);
  assert.throws(() => buildAgentRuntimeRepair(
    artifacts,
    [{ artifactId: "foreign", summary: "Bad", detail: "Unknown", nextSource: "SELECT 1" }],
    [],
    "failed",
  ), /unknown artifact/i);
  assert.throws(() => buildAgentRuntimeRepair(
    [{ id: "report", name: "report.md", kind: "document", language: "Markdown", source: "# Report" }],
    [{ artifactId: "report", summary: "Bad", detail: "Not runtime", nextSource: "# Changed" }],
    [],
    "failed",
  ), /Data or Query/i);
});
