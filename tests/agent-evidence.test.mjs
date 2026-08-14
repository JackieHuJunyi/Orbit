import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentQueryEvidenceListSchema,
  MAX_AGENT_QUERY_EVIDENCE_CELL_CHARS,
  MAX_AGENT_QUERY_EVIDENCE_CELLS,
  MAX_AGENT_QUERY_EVIDENCE_COLUMNS,
  MAX_AGENT_QUERY_EVIDENCE_JSON_CHARS,
  MAX_AGENT_QUERY_EVIDENCE_ROWS,
  collectWorkspaceAgentQueryEvidence,
  createAgentQueryErrorEvidence,
  createAgentQueryReadyEvidence,
  validateAgentQueryEvidenceContext,
} from "../app/lib/agent-evidence.ts";
import { workspaceAgentContextFitsSourceLimits } from "../app/lib/dependency-graph.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";
import { defaultQuerySnapshot, defaultSummaryQuerySnapshot } from "./query-snapshot-fixture.mjs";

test("creates deterministic bounded evidence from a current Query snapshot", () => {
  const evidence = createAgentQueryReadyEvidence(defaultQuerySnapshot());
  assert.equal(evidence.status, "ready");
  assert.equal(evidence.queryArtifactId, "regional-analysis");
  assert.equal(evidence.dataArtifactId, "regional-revenue");
  assert.deepEqual(evidence.columns, defaultQuerySnapshot().result.columns);
  assert.deepEqual(evidence.rows, defaultQuerySnapshot().result.rows);
  assert.equal(evidence.evidenceTruncated, false);
  assert.ok(JSON.stringify(evidence).length <= MAX_AGENT_QUERY_EVIDENCE_JSON_CHARS);
});

test("truncates evidence rows, columns, cells, strings, and aggregate JSON deterministically", async () => {
  const snapshot = defaultQuerySnapshot();
  const columns = Array.from({ length: 35 }, (_, index) => `column-${index}-${"x".repeat(210)}`);
  const rows = Array.from({ length: 25 }, () => columns.map(() => "v".repeat(600)));
  const oversized = {
    ...snapshot,
    result: {
      ...snapshot.result,
      columns,
      rows,
      sourceRowIndices: Array(25).fill(null),
      cellLineage: Array.from({ length: 25 }, () => Array(35).fill(null)),
      truncated: true,
    },
  };
  const evidence = createAgentQueryReadyEvidence(oversized);
  assert.equal(evidence.status, "ready");
  assert.ok(evidence.columns.length <= MAX_AGENT_QUERY_EVIDENCE_COLUMNS);
  assert.ok(evidence.rows.length <= MAX_AGENT_QUERY_EVIDENCE_ROWS);
  assert.ok(evidence.rows.flat().length <= MAX_AGENT_QUERY_EVIDENCE_CELLS);
  assert.ok(
    evidence.rows
      .flat()
      .every((cell) => typeof cell !== "string" || cell.length <= MAX_AGENT_QUERY_EVIDENCE_CELL_CHARS),
  );
  assert.equal(evidence.resultTruncated, true);
  assert.equal(evidence.evidenceTruncated, true);

  const queryArtifacts = defaultArtifacts.filter((artifact) => artifact.kind === "query");
  const data = defaultArtifacts.find((artifact) => artifact.kind === "data");
  assert.ok(data);
  const list = await collectWorkspaceAgentQueryEvidence([data, ...queryArtifacts], async (query) => ({
    ...oversized,
    queryArtifactId: query.id,
    queryArtifactName: query.name,
    querySource: query.source,
  }));
  assert.ok(JSON.stringify(list).length <= MAX_AGENT_QUERY_EVIDENCE_JSON_CHARS);
  assert.equal(AgentQueryEvidenceListSchema.safeParse(list).success, true);
});

test("represents a bounded Query runtime error without pretending it is a result", () => {
  const evidence = createAgentQueryErrorEvidence("query", "data", new Error("x".repeat(800)));
  assert.deepEqual(
    { queryArtifactId: evidence.queryArtifactId, dataArtifactId: evidence.dataArtifactId, status: evidence.status },
    {
      queryArtifactId: "query",
      dataArtifactId: "data",
      status: "error",
    },
  );
  assert.equal(evidence.status === "error" && evidence.error.length, 500);
});

test("collects Query evidence in workspace order and retains runtime failures as feedback", async () => {
  const calls = [];
  const evidence = await collectWorkspaceAgentQueryEvidence(defaultArtifacts, async (query) => {
    calls.push(query.id);
    if (query.id === "regional-summary") throw new Error("Binder error: missing column");
    return defaultQuerySnapshot();
  });
  assert.deepEqual(calls, ["regional-analysis", "regional-summary"]);
  assert.deepEqual(
    evidence.map((item) => item.queryArtifactId),
    ["regional-analysis", "regional-summary"],
  );
  assert.equal(evidence[0].status, "ready");
  assert.equal(evidence[1].status, "error");
  assert.match(evidence[1].status === "error" ? evidence[1].error : "", /Binder error/);
});

test("accepts only exact Query/Data identities in exact workspace order", () => {
  const exact = [
    createAgentQueryReadyEvidence(defaultQuerySnapshot()),
    createAgentQueryReadyEvidence(defaultSummaryQuerySnapshot()),
  ];
  assert.deepEqual(validateAgentQueryEvidenceContext(defaultArtifacts, exact), []);
  assert.match(validateAgentQueryEvidenceContext(defaultArtifacts, exact.slice(0, 1)).join(" "), /exactly one/i);
  assert.match(validateAgentQueryEvidenceContext(defaultArtifacts, [...exact].reverse()).join(" "), /out of order/i);
  assert.match(
    validateAgentQueryEvidenceContext(defaultArtifacts, [{ ...exact[0], dataArtifactId: "wrong-data" }, exact[1]]).join(
      " ",
    ),
    /wrong Data/i,
  );
  assert.match(
    validateAgentQueryEvidenceContext(defaultArtifacts, [exact[0], exact[0]]).join(" "),
    /unique|out of order/i,
  );
});

test("uses the shared seven-file Workspace Agent source limit", () => {
  assert.equal(defaultArtifacts.length, 7);
  assert.equal(workspaceAgentContextFitsSourceLimits(defaultArtifacts), true);
  assert.equal(
    workspaceAgentContextFitsSourceLimits([...defaultArtifacts, { ...defaultArtifacts[0], id: "eighth" }]),
    false,
  );
  assert.equal(
    workspaceAgentContextFitsSourceLimits([
      { ...defaultArtifacts[0], source: "x".repeat(100_001) },
      defaultArtifacts[1],
    ]),
    false,
  );
});
