import assert from "node:assert/strict";
import test from "node:test";

import {
  createWorkspaceQuerySnapshot,
  workspaceQuerySnapshotIsCurrent,
} from "../app/lib/query-snapshot.ts";
import { runWorkspaceQuerySnapshot } from "../app/lib/duckdb-client.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";
import { defaultQuerySnapshot } from "./query-snapshot-fixture.mjs";

test("binds an ephemeral Query result to exact Query and Data source revisions", () => {
  const query = defaultArtifacts.find((artifact) => artifact.id === "regional-analysis");
  const data = defaultArtifacts.find((artifact) => artifact.id === "regional-revenue");
  assert.ok(query && data);
  const snapshot = defaultQuerySnapshot();
  assert.equal(workspaceQuerySnapshotIsCurrent(snapshot, query, data), true);
  assert.equal(workspaceQuerySnapshotIsCurrent(snapshot, { ...query, source: `${query.source}\n` }, data), false);
  assert.equal(workspaceQuerySnapshotIsCurrent(snapshot, query, { ...data, source: `${data.source}\n` }), false);
  assert.equal(snapshot.result.rows[0][3], 39.1);
});

test("refuses to label non-Query or non-Data artifacts as a Query snapshot", () => {
  const query = defaultArtifacts.find((artifact) => artifact.id === "regional-analysis");
  const data = defaultArtifacts.find((artifact) => artifact.id === "regional-revenue");
  const document = defaultArtifacts.find((artifact) => artifact.id === "q2-review");
  assert.ok(query && data && document);
  const result = defaultQuerySnapshot().result;
  assert.throws(() => createWorkspaceQuerySnapshot(document, data, result), /Query artifact/i);
  assert.throws(() => createWorkspaceQuerySnapshot(query, document, result), /Data artifact/i);
});

test("refuses to execute an explicitly bound Query against a different Data artifact", async () => {
  const query = defaultArtifacts.find((artifact) => artifact.kind === "query");
  assert.ok(query);
  const wrongData = {
    id: "wrong-data",
    name: "wrong.csv",
    kind: "data",
    language: "CSV / JSON",
    source: "Region,Q2 Revenue,Q1 Revenue,Cost,Customers\nWrong,1,1,1,1",
  };
  await assert.rejects(
    () => runWorkspaceQuerySnapshot(query, wrongData),
    /bound to Data artifact regional-revenue, not wrong-data/i,
  );
});
