import assert from "node:assert/strict";
import test from "node:test";

import { prepareArtifactCreation } from "../app/lib/artifact-creation.ts";
import { AgentOperationPatchSchema } from "../app/lib/agent-contract.ts";
import { compileAgentOperationPatch } from "../app/lib/agent-operations.ts";
import { preflightAgentRuntimeImpact } from "../app/lib/query-preflight.ts";
import { createWorkspaceQuerySnapshot } from "../app/lib/query-snapshot.ts";
import { defaultArtifacts, planLocalChange } from "../app/lib/workspace.ts";
import { defaultQuerySnapshot, defaultSummaryQuerySnapshot } from "./query-snapshot-fixture.mjs";

function patchFor(artifactId, transform) {
  const artifact = defaultArtifacts.find((candidate) => candidate.id === artifactId);
  assert.ok(artifact);
  return {
    artifactId,
    summary: "Refine the Query",
    detail: "The proposed SQL must pass runtime verification before review.",
    nextSource: transform(artifact.source),
  };
}

function currentSnapshot(query, data, fixture) {
  return createWorkspaceQuerySnapshot(query, data, {
    ...fixture.result,
    columns: [...fixture.result.columns],
    rows: fixture.result.rows.map((row) => [...row]),
    sourceRowIndices: [...fixture.result.sourceRowIndices],
    cellLineage: fixture.result.cellLineage.map((row) => [...row]),
  });
}

test("skips runtime impact work when an Agent plan changes neither Data, Query, nor Chart", async () => {
  let called = false;
  const report = defaultArtifacts.find((artifact) => artifact.id === "q2-review");
  assert.ok(report);
  const result = await preflightAgentRuntimeImpact(defaultArtifacts, [{
    artifactId: report.id,
    summary: "Clarify a heading",
    detail: "Only one Markdown heading changes.",
    nextSource: report.source.replace("## Decisions", "## Decisions and owners"),
  }], [], async () => {
    called = true;
    throw new Error("must not run");
  });
  assert.equal(result, null);
  assert.equal(called, false);
});

test("executes a changed Query against its exact Data revision before review", async () => {
  const patch = patchFor("regional-analysis", (source) => source.replace("ORDER BY \"Q2 Revenue\" DESC;", "ORDER BY \"Q2 Revenue\" DESC LIMIT 4;"));
  const calls = [];
  const result = await preflightAgentRuntimeImpact(defaultArtifacts, [patch], [], async (query, data) => {
    calls.push([query.id, data.id, query.source]);
    return currentSnapshot(query, data, defaultQuerySnapshot());
  });
  assert.deepEqual(calls.map(([queryId, dataId]) => [queryId, dataId]), [["regional-analysis", "regional-revenue"]]);
  assert.match(calls[0][2], /LIMIT 4/);
  assert.deepEqual(result, {
    dataCount: 0,
    queryCount: 1,
    legacyMetricConsumerCount: 0,
    scalarConsumerCount: 0,
    chartConsumerCount: 1,
    dataNames: [],
    queryNames: ["regional-analysis.sql"],
  });
});

test("rejects a proposed Query when DuckDB reports a runtime error", async () => {
  const patch = patchFor("regional-analysis", (source) => source.replace("Customers", "missing_runtime_column"));
  await assert.rejects(
    preflightAgentRuntimeImpact(defaultArtifacts, [patch], [], async () => {
      throw new Error("Binder Error: missing_runtime_column not found");
    }),
    /regional-analysis\.sql.*Binder Error/i,
  );
});

test("rejects a stale snapshot even when its Query and Data ids still match", async () => {
  const patch = patchFor("regional-analysis", (source) => source.replace("ORDER BY \"Q2 Revenue\" DESC;", "ORDER BY \"Q2 Revenue\" ASC;"));
  await assert.rejects(
    preflightAgentRuntimeImpact(defaultArtifacts, [patch], [], async () => defaultQuerySnapshot()),
    /stale during runtime preflight/i,
  );
});

test("rejects a runtime-valid Query that breaks downstream scalar semantics", async () => {
  const patch = patchFor("regional-summary", (source) => source.replace("FROM workspace_data;", "FROM workspace_data\nGROUP BY Region;"));
  const fixture = defaultSummaryQuerySnapshot();
  await assert.rejects(
    preflightAgentRuntimeImpact(defaultArtifacts, [patch], [], async (query, data) => currentSnapshot(query, data, {
      ...fixture,
      result: {
        ...fixture.result,
        rows: [fixture.result.rows[0], fixture.result.rows[0]],
        sourceRowIndices: [null, null],
        cellLineage: [fixture.result.cellLineage[0], fixture.result.cellLineage[0]],
      },
    })),
    /exactly one row/i,
  );
});

test("rejects a runtime-valid Query that breaks a Query-backed Chart", async () => {
  const patch = patchFor("regional-analysis", (source) => source.replace("ORDER BY \"Q2 Revenue\" DESC;", "ORDER BY \"Q2 Revenue\" ASC;"));
  const fixture = defaultQuerySnapshot();
  await assert.rejects(
    preflightAgentRuntimeImpact(defaultArtifacts, [patch], [], async (query, data) => currentSnapshot(query, data, {
      ...fixture,
      result: {
        ...fixture.result,
        rows: fixture.result.rows.map((row) => [row[0], row[1], row[2], "not numeric", row[4]]),
      },
    })),
    /regional-margin\.chart\.json.*non-numeric/i,
  );
});

test("verifies every existing scalar consumer of a valid summary Query", async () => {
  const patch = patchFor("regional-summary", (source) => source.replace("SUM(Customers)", "COALESCE(SUM(Customers), 0)"));
  const result = await preflightAgentRuntimeImpact(defaultArtifacts, [patch], [], async (query, data) => (
    currentSnapshot(query, data, defaultSummaryQuerySnapshot())
  ));
  assert.deepEqual(result, {
    dataCount: 0,
    queryCount: 1,
    legacyMetricConsumerCount: 0,
    scalarConsumerCount: 7,
    chartConsumerCount: 0,
    dataNames: [],
    queryNames: ["regional-summary.sql"],
  });
});

test("executes every Query bound to proposed Data and verifies all downstream consumers", async () => {
  const patch = patchFor("regional-revenue", (source) => source.replace("APAC,1840000", "APAC,1900000"));
  const calls = [];
  const result = await preflightAgentRuntimeImpact(defaultArtifacts, [patch], [], async (query, data) => {
    calls.push([query.id, data.id, data.source]);
    return currentSnapshot(
      query,
      data,
      query.id === "regional-summary" ? defaultSummaryQuerySnapshot() : defaultQuerySnapshot(),
    );
  });
  assert.deepEqual(calls.map(([queryId, dataId]) => [queryId, dataId]), [
    ["regional-analysis", "regional-revenue"],
    ["regional-summary", "regional-revenue"],
  ]);
  assert.ok(calls.every((call) => call[2].includes("APAC,1900000")));
  assert.deepEqual(result, {
    dataCount: 1,
    queryCount: 2,
    legacyMetricConsumerCount: 2,
    scalarConsumerCount: 7,
    chartConsumerCount: 2,
    dataNames: ["regional-revenue.csv"],
    queryNames: ["regional-analysis.sql", "regional-summary.sql"],
  });
});

test("runs a compiled keyed column addition through the complete Data impact graph", async () => {
  const data = defaultArtifacts.find((artifact) => artifact.id === "regional-revenue");
  assert.ok(data);
  const compiled = compileAgentOperationPatch(data, AgentOperationPatchSchema.parse({
    summary: "Add review status",
    detail: "Every current region receives one typed status keyed by Region.",
    edits: [{
      type: "upsert_data_column",
      keyColumn: "Region",
      column: "Review status",
      values: [
        { keyValue: "APAC", value: "approved" },
        { keyValue: "North America", value: "review" },
        { keyValue: "Europe", value: "approved" },
        { keyValue: "LATAM", value: "review" },
      ],
    }],
  }));
  assert.deepEqual(compiled.errors, []);
  assert.match(compiled.plan.nextSource, /Review status/);
  const result = await preflightAgentRuntimeImpact(defaultArtifacts, [{
    artifactId: data.id,
    ...compiled.plan,
  }], [], async (query, proposedData) => currentSnapshot(
    query,
    proposedData,
    query.id === "regional-summary" ? defaultSummaryQuerySnapshot() : defaultQuerySnapshot(),
  ));
  assert.deepEqual(result, {
    dataCount: 1,
    queryCount: 2,
    legacyMetricConsumerCount: 2,
    scalarConsumerCount: 7,
    chartConsumerCount: 2,
    dataNames: ["regional-revenue.csv"],
    queryNames: ["regional-analysis.sql", "regional-summary.sql"],
  });
});

test("rejects a compiled column rename that breaks an existing Chart before Query execution", async () => {
  const data = defaultArtifacts.find((artifact) => artifact.id === "regional-revenue");
  assert.ok(data);
  const compiled = compileAgentOperationPatch(data, AgentOperationPatchSchema.parse({
    summary: "Rename revenue",
    detail: "The downstream Chart must veto an uncoordinated header rename.",
    edits: [{ type: "rename_data_column", column: "Q2 Revenue", nextColumn: "Q2 Net Revenue" }],
  }));
  assert.deepEqual(compiled.errors, []);
  let called = false;
  await assert.rejects(preflightAgentRuntimeImpact(defaultArtifacts, [{
    artifactId: data.id,
    ...compiled.plan,
  }], [], async () => {
    called = true;
    throw new Error("DuckDB must not start after static Chart validation fails");
  }), /regional-revenue\.chart\.json.*Q2 Revenue/i);
  assert.equal(called, false);
});

test("rejects proposed Data when any impacted Query fails at runtime", async () => {
  const patch = patchFor("regional-revenue", (source) => source.replace(",148\n", ",runtime_error\n"));
  await assert.rejects(
    preflightAgentRuntimeImpact(defaultArtifacts, [patch], [], async (query, data) => {
      if (query.id === "regional-summary") throw new Error("Conversion Error: runtime_error is not numeric");
      return currentSnapshot(query, data, defaultQuerySnapshot());
    }),
    /regional-summary\.sql.*Conversion Error/i,
  );
});

test("rejects proposed Data that breaks a direct Chart before starting DuckDB", async () => {
  const patch = patchFor("regional-revenue", (source) => source.replace("APAC,1840000", "APAC,not_numeric"));
  let called = false;
  await assert.rejects(
    preflightAgentRuntimeImpact(defaultArtifacts, [patch], [], async () => {
      called = true;
      throw new Error("DuckDB must not run after the complete workspace gate fails");
    }),
    /regional-revenue\.chart\.json.*non-numeric/i,
  );
  assert.equal(called, false);
});

test("rejects runtime-valid proposed Data when an impacted scalar changes cardinality", async () => {
  const patch = patchFor("regional-revenue", (source) => source.replace("LATAM,450000", "LATAM,500000"));
  const summary = defaultSummaryQuerySnapshot();
  await assert.rejects(
    preflightAgentRuntimeImpact(defaultArtifacts, [patch], [], async (query, data) => {
      if (query.id !== "regional-summary") return currentSnapshot(query, data, defaultQuerySnapshot());
      return currentSnapshot(query, data, {
        ...summary,
        result: {
          ...summary.result,
          rows: [summary.result.rows[0], summary.result.rows[0]],
          sourceRowIndices: [null, null],
          cellLineage: [summary.result.cellLineage[0], summary.result.cellLineage[0]],
        },
      });
    }),
    /exactly one row/i,
  );
});

test("validates a new disconnected Data source without running unrelated Queries", async () => {
  let called = false;
  const result = await preflightAgentRuntimeImpact(defaultArtifacts, [], [{
    artifact: {
      id: "supplement",
      name: "supplement.csv",
      kind: "data",
      language: "CSV / JSON",
      source: "Item,Value\n",
    },
    summary: "Create supplemental data",
    detail: "The new table has no consumers yet.",
  }], async () => {
    called = true;
    throw new Error("unrelated Query must not run");
  });
  assert.equal(called, false);
  assert.deepEqual(result, {
    dataCount: 1,
    queryCount: 0,
    legacyMetricConsumerCount: 0,
    scalarConsumerCount: 0,
    chartConsumerCount: 0,
    dataNames: ["supplement.csv"],
    queryNames: [],
  });
});

test("executes a newly created Query against its exact bound Data source", async () => {
  const prepared = prepareArtifactCreation(defaultArtifacts, {
    kind: "query",
    title: "Regional Detail",
    sourceArtifactId: "regional-revenue",
  });
  assert.deepEqual(prepared.errors, []);
  const creation = {
    artifact: prepared.artifact,
    summary: "Create bound Query",
    detail: "The starter Query reads one exact Data artifact.",
  };
  const calls = [];
  const result = await preflightAgentRuntimeImpact(defaultArtifacts, [], [creation], async (query, data) => {
    calls.push([query.id, data.id]);
    return createWorkspaceQuerySnapshot(query, data, {
      columns: ["Region", "Q2 Revenue", "Q1 Revenue", "Cost", "Customers"],
      rows: [["APAC", 1840000, 1540000, 1120000, 148]],
      truncated: false,
      sourceRowIndices: [0],
      cellLineage: [[
        { sourceRowIndex: 0, sourceColumn: "Region" },
        { sourceRowIndex: 0, sourceColumn: "Q2 Revenue" },
        { sourceRowIndex: 0, sourceColumn: "Q1 Revenue" },
        { sourceRowIndex: 0, sourceColumn: "Cost" },
        { sourceRowIndex: 0, sourceColumn: "Customers" },
      ]],
    });
  });
  assert.deepEqual(calls, [["regional-detail", "regional-revenue"]]);
  assert.deepEqual(result, {
    dataCount: 0,
    queryCount: 1,
    legacyMetricConsumerCount: 0,
    scalarConsumerCount: 0,
    chartConsumerCount: 0,
    dataNames: [],
    queryNames: ["regional-detail.sql"],
  });
});

test("runtime-validates a newly created direct or Query-backed Chart before review", async () => {
  const direct = prepareArtifactCreation(defaultArtifacts, {
    kind: "chart",
    title: "Customer Comparison",
    sourceArtifactId: "regional-revenue",
    category: "Region",
    value: "Customers",
    mark: "bar",
    format: "number",
  });
  assert.deepEqual(direct.errors, []);
  let directRunnerCalled = false;
  const directImpact = await preflightAgentRuntimeImpact(defaultArtifacts, [], [{
    artifact: direct.artifact,
    summary: "Create direct Chart",
    detail: "Bind exact Data fields.",
  }], async () => {
    directRunnerCalled = true;
    throw new Error("A direct Data Chart must not start DuckDB.");
  });
  assert.equal(directRunnerCalled, false);
  assert.equal(directImpact.chartConsumerCount, 1);
  assert.equal(directImpact.queryCount, 0);

  const queryBacked = prepareArtifactCreation(defaultArtifacts, {
    kind: "chart",
    title: "Query Customers",
    sourceArtifactId: "regional-analysis",
    category: "Region",
    value: "Customers",
    mark: "line",
    format: "number",
  });
  assert.deepEqual(queryBacked.errors, []);
  const calls = [];
  const queryImpact = await preflightAgentRuntimeImpact(defaultArtifacts, [], [{
    artifact: queryBacked.artifact,
    summary: "Create Query Chart",
    detail: "Bind exact Query output fields.",
  }], async (query, data) => {
    calls.push([query.id, data.id]);
    return currentSnapshot(query, data, defaultQuerySnapshot());
  });
  assert.deepEqual(calls, [["regional-analysis", "regional-revenue"]]);
  assert.equal(queryImpact.queryCount, 1);
  assert.equal(queryImpact.chartConsumerCount, 2);
});

test("rejects a new Query-backed Chart whose selected value fails at runtime", async () => {
  const prepared = prepareArtifactCreation(defaultArtifacts, {
    kind: "chart",
    title: "Query Customers",
    sourceArtifactId: "regional-analysis",
    category: "Region",
    value: "Customers",
    mark: "bar",
    format: "number",
  });
  assert.deepEqual(prepared.errors, []);
  const fixture = defaultQuerySnapshot();
  await assert.rejects(preflightAgentRuntimeImpact(defaultArtifacts, [], [{
    artifact: prepared.artifact,
    summary: "Create Query Chart",
    detail: "Runtime values must remain numeric.",
  }], async (query, data) => currentSnapshot(query, data, {
    ...fixture,
    result: {
      ...fixture.result,
      rows: fixture.result.rows.map((row) => [...row.slice(0, 4), "not numeric"]),
    },
  })), /query-customers\.chart\.json.*non-numeric/i);
});

test("runs the shipped local Data quick action through the complete impact graph", async () => {
  const data = defaultArtifacts.find((artifact) => artifact.id === "regional-revenue");
  assert.ok(data);
  const localPlan = planLocalChange(data, "增加利润率列");
  assert.match(localPlan.nextSource, /Margin/);
  const result = await preflightAgentRuntimeImpact(defaultArtifacts, [{
    artifactId: data.id,
    ...localPlan,
  }], [], async (query, proposedData) => currentSnapshot(
    query,
    proposedData,
    query.id === "regional-summary" ? defaultSummaryQuerySnapshot() : defaultQuerySnapshot(),
  ));
  assert.equal(result?.dataCount, 1);
  assert.equal(result?.queryCount, 2);
  assert.equal(result?.scalarConsumerCount, 7);
  assert.equal(result?.chartConsumerCount, 2);
});
