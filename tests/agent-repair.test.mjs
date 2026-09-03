import assert from "node:assert/strict";
import test from "node:test";

import { buildAgentRuntimeRepair } from "../app/lib/agent-repair.ts";

const artifacts = [
  { id: "data", name: "data.csv", kind: "data", language: "CSV / JSON", source: "Item,Value\nRevenue,42" },
  {
    id: "analysis",
    name: "analysis.sql",
    kind: "query",
    language: "DuckDB SQL",
    source: '-- orbit:data "data"\nSELECT SUM(Value) AS total FROM workspace_data;',
  },
];

test("builds exact bounded feedback from an unapplied runtime proposal", () => {
  const repair = buildAgentRuntimeRepair(
    artifacts,
    [
      {
        artifactId: "analysis",
        summary: "Use a new field",
        detail: "The first proposal references a missing field.",
        nextSource: '-- orbit:data "data"\nSELECT SUM(missing_value) AS total FROM workspace_data;',
      },
    ],
    [],
    new Error("Runtime impact preflight failed · Binder\nError:\u0000 missing_value"),
  );
  assert.equal(repair.attempt, 1);
  assert.equal(repair.failure, "Runtime impact preflight failed · Binder Error: missing_value");
  assert.deepEqual(repair.proposedArtifacts, [
    {
      artifactId: "analysis",
      name: "analysis.sql",
      kind: "query",
      language: "DuckDB SQL",
      proposedSource: '-- orbit:data "data"\nSELECT SUM(missing_value) AS total FROM workspace_data;',
      isCreation: false,
    },
  ]);
});

test("includes Orbit-owned creation identity and refuses non-runtime or unknown feedback", () => {
  const creation = {
    artifact: {
      id: "forecast-data",
      name: "forecast-data.csv",
      kind: "data",
      language: "CSV / JSON",
      source: "Item,Value\nForecast,not-a-number",
    },
    summary: "Create forecast data",
    detail: "One Data source is proposed.",
  };
  assert.equal(
    buildAgentRuntimeRepair(artifacts, [], [creation], "invalid chart value").proposedArtifacts[0].isCreation,
    true,
  );
  assert.throws(
    () =>
      buildAgentRuntimeRepair(
        artifacts,
        [{ artifactId: "foreign", summary: "Bad", detail: "Unknown", nextSource: "SELECT 1" }],
        [],
        "failed",
      ),
    /unknown artifact/i,
  );
  assert.throws(
    () =>
      buildAgentRuntimeRepair(
        [{ id: "report", name: "report.md", kind: "document", language: "Markdown", source: "# Report" }],
        [{ artifactId: "report", summary: "Bad", detail: "Not runtime", nextSource: "# Changed" }],
        [],
        "failed",
      ),
    /Data, Query, or Chart/i,
  );
});

test("keeps a failed Query-backed Chart creation available for one bounded repair", () => {
  const creation = {
    artifact: {
      id: "revenue-chart",
      name: "revenue-chart.chart.json",
      kind: "chart",
      language: "Chart JSON",
      source:
        '{"version":1,"title":"Revenue","description":"","source":"analysis","mark":"bar","category":"Item","value":"total","sort":"descending","format":"number","color":"#ff5c35","maxItems":8}',
    },
    summary: "Create revenue Chart",
    detail: "The selected Query field failed runtime numeric validation.",
  };
  const repair = buildAgentRuntimeRepair(artifacts, [], [creation], "total is not numeric");
  assert.equal(repair.proposedArtifacts[0].kind, "chart");
  assert.equal(repair.proposedArtifacts[0].isCreation, true);
});
