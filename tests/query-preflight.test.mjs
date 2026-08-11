import assert from "node:assert/strict";
import test from "node:test";

import { preflightAgentQueryMutation } from "../app/lib/query-preflight.ts";
import { createWorkspaceQuerySnapshot } from "../app/lib/query-snapshot.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";
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

test("skips DuckDB entirely when an Agent plan does not change a Query", async () => {
  let called = false;
  const report = defaultArtifacts.find((artifact) => artifact.id === "q2-review");
  assert.ok(report);
  const result = await preflightAgentQueryMutation(defaultArtifacts, [{
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
  const result = await preflightAgentQueryMutation(defaultArtifacts, [patch], [], async (query, data) => {
    calls.push([query.id, data.id, query.source]);
    return currentSnapshot(query, data, defaultQuerySnapshot());
  });
  assert.deepEqual(calls.map(([queryId, dataId]) => [queryId, dataId]), [["regional-analysis", "regional-revenue"]]);
  assert.match(calls[0][2], /LIMIT 4/);
  assert.deepEqual(result, {
    queryCount: 1,
    scalarConsumerCount: 0,
    chartConsumerCount: 1,
    queryNames: ["regional-analysis.sql"],
  });
});

test("rejects a proposed Query when DuckDB reports a runtime error", async () => {
  const patch = patchFor("regional-analysis", (source) => source.replace("Customers", "missing_runtime_column"));
  await assert.rejects(
    preflightAgentQueryMutation(defaultArtifacts, [patch], [], async () => {
      throw new Error("Binder Error: missing_runtime_column not found");
    }),
    /regional-analysis\.sql.*Binder Error/i,
  );
});

test("rejects a stale snapshot even when its Query and Data ids still match", async () => {
  const patch = patchFor("regional-analysis", (source) => source.replace("ORDER BY \"Q2 Revenue\" DESC;", "ORDER BY \"Q2 Revenue\" ASC;"));
  await assert.rejects(
    preflightAgentQueryMutation(defaultArtifacts, [patch], [], async () => defaultQuerySnapshot()),
    /stale during runtime preflight/i,
  );
});

test("rejects a runtime-valid Query that breaks downstream scalar semantics", async () => {
  const patch = patchFor("regional-summary", (source) => source.replace("FROM workspace_data;", "FROM workspace_data\nGROUP BY Region;"));
  const fixture = defaultSummaryQuerySnapshot();
  await assert.rejects(
    preflightAgentQueryMutation(defaultArtifacts, [patch], [], async (query, data) => currentSnapshot(query, data, {
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
    preflightAgentQueryMutation(defaultArtifacts, [patch], [], async (query, data) => currentSnapshot(query, data, {
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
  const result = await preflightAgentQueryMutation(defaultArtifacts, [patch], [], async (query, data) => (
    currentSnapshot(query, data, defaultSummaryQuerySnapshot())
  ));
  assert.deepEqual(result, {
    queryCount: 1,
    scalarConsumerCount: 7,
    chartConsumerCount: 0,
    queryNames: ["regional-summary.sql"],
  });
});
