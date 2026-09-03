import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRemoteAgentPlan, requestRemoteAgentTurn } from "../app/lib/agent-client.ts";

const artifact = {
  id: "report",
  name: "report.md",
  kind: "document",
  language: "Markdown",
  source: "# Report",
};

test("normalizes single-file and workspace Agent plans at one client boundary", () => {
  const single = normalizeRemoteAgentPlan("artifact", artifact.id, {
    summary: "Update report",
    detail: "One exact edit.",
    nextSource: "# Updated report",
    operationCount: 1,
  });
  assert.equal(single.patches[0].artifactId, artifact.id);
  assert.equal(normalizeRemoteAgentPlan("workspace", artifact.id, single), single);
  assert.equal(normalizeRemoteAgentPlan("selection", artifact.id, { nope: true }), null);
});

test("performs the explicit Query-evidence handshake once and preserves conversation", async () => {
  const query = { ...artifact, id: "query", name: "query.sql", kind: "query", language: "DuckDB SQL" };
  const requests = [];
  const fetcher = async (_url, init) => {
    requests.push(JSON.parse(init.body));
    if (requests.length === 1) {
      return Response.json({ code: "QUERY_EVIDENCE_REQUIRED", queryArtifactIds: ["query"] }, { status: 428 });
    }
    return Response.json({ answer: "The query returns one row." });
  };
  let requestedCount = 0;
  const result = await requestRemoteAgentTurn({
    body: {
      scope: "workspace",
      artifact: query,
      workspaceArtifacts: [artifact, query],
      workspaceDependencies: [],
      workspacePinnedArtifactIds: [],
      conversation: [{ role: "user", content: "Explain the query." }],
      prompt: "And its row count?",
      metrics: {},
    },
    workspaceArtifacts: [artifact, query],
    collectQueryEvidence: async () => [{ queryArtifactId: "query" }],
    onQueryEvidenceRequested: (count) => {
      requestedCount = count;
    },
    fetcher,
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.answer, "The query returns one row.");
  assert.equal(result.queryEvidenceCount, 1);
  assert.equal(requestedCount, 1);
  assert.deepEqual(requests[1].conversation, requests[0].conversation);
  assert.deepEqual(requests[1].queryEvidence, [{ queryArtifactId: "query" }]);
});

test("rejects a stale Query-evidence request before collecting browser data", async () => {
  const query = { ...artifact, id: "query", name: "query.sql", kind: "query", language: "DuckDB SQL" };
  let collected = false;
  await assert.rejects(
    () =>
      requestRemoteAgentTurn({
        body: {
          scope: "workspace",
          artifact: query,
          workspaceArtifacts: [artifact, query],
          workspaceDependencies: [],
          workspacePinnedArtifactIds: [],
          conversation: [],
          prompt: "Explain",
          metrics: {},
        },
        workspaceArtifacts: [artifact, query],
        collectQueryEvidence: async () => {
          collected = true;
          return [];
        },
        fetcher: async () =>
          Response.json({ code: "QUERY_EVIDENCE_REQUIRED", queryArtifactIds: ["foreign"] }, { status: 428 }),
      }),
    /stale Query evidence/i,
  );
  assert.equal(collected, false);
});
