import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { portableSourceRevision } from "../app/lib/source-revision.ts";

import {
  EMPTY_RUNE_TASK_EVIDENCE,
  MAX_RUNE_TASK_DELIVERIES,
  MAX_RUNE_TASK_RUNS,
  appendRuneTaskRun,
  normalizeRuneTaskEvidence,
  recordRuneTaskDelivery,
  runeTaskDeliveryId,
  summarizeRuneTaskDeliveries,
  summarizeRuneTaskRuns,
} from "../app/lib/task-evidence.ts";

function briefingRun(overrides = {}) {
  const outputArtifactIds = overrides.outputArtifactIds ?? ["strategy-briefing"];
  const outputSources = overrides.outputSources ?? outputArtifactIds.map((artifactId) => `# ${artifactId}\n`);
  return {
    version: 1,
    id: "task-run:document-briefing:one",
    taskId: "document-briefing",
    completedAt: "2026-08-14T08:00:00.000Z",
    status: "applied",
    stopReason: null,
    provider: "anthropic",
    sourceArtifactId: "strategy-memo",
    sourceRevision: portableSourceRevision("# Strategy memo\n"),
    outputArtifactIds,
    outputRevisions: Object.fromEntries(outputArtifactIds.map((artifactId, index) => [artifactId, portableSourceRevision(outputSources[index])])),
    changedFileCount: 1,
    queryCount: 0,
    chartConsumerCount: 0,
    durationMs: 4_000,
    inputTokens: 420,
    outputTokens: 120,
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== "outputSources")),
  };
}

test("records one normalized content-free task run and summary", () => {
  const evidence = appendRuneTaskRun(EMPTY_RUNE_TASK_EVIDENCE, briefingRun());
  assert.equal(evidence.runs.length, 1);
  assert.deepEqual(summarizeRuneTaskRuns(evidence.runs), {
    total: 1,
    applied: 1,
    stopped: 0,
    successRate: 100,
    averageDurationMs: 4_000,
    modelRunCount: 1,
    inputTokens: 420,
    outputTokens: 120,
  });
  assert.doesNotMatch(JSON.stringify(evidence), /strategy body|prompt|sourceText|documentText/u);
});

test("binds a delivery judgment to the exact applied task output and revision", async () => {
  const evidence = appendRuneTaskRun(EMPTY_RUNE_TASK_EVIDENCE, briefingRun());
  const source = "# strategy-briefing\n";
  const recorded = await recordRuneTaskDelivery({
    evidence,
    runId: evidence.runs[0].id,
    artifactId: "strategy-briefing",
    source,
    currentSourceRevision: evidence.runs[0].sourceRevision,
    method: "download",
    target: "pptx",
    rating: "minor-edits",
    now: new Date("2026-08-14T08:01:00.000Z"),
  });
  assert.deepEqual(recorded.deliveries[0], {
    version: 1,
    id: runeTaskDeliveryId(evidence.runs[0].id, "strategy-briefing"),
    confirmedAt: "2026-08-14T08:01:00.000Z",
    runId: evidence.runs[0].id,
    taskId: "document-briefing",
    artifactId: "strategy-briefing",
    method: "download",
    target: "pptx",
    rating: "minor-edits",
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    taskDurationMs: 64_000,
  });
  assert.equal(summarizeRuneTaskDeliveries(recorded.deliveries).usableRate, 100);
  assert.doesNotMatch(JSON.stringify(recorded), /Strategy briefing|Direction/u);
});

test("fails closed for fabricated, stopped, mismatched, or malformed task evidence", async () => {
  const evidence = appendRuneTaskRun(EMPTY_RUNE_TASK_EVIDENCE, briefingRun());
  await assert.rejects(() => recordRuneTaskDelivery({
    evidence,
    runId: evidence.runs[0].id,
    artifactId: "another-deck",
    source: "# Forged\n",
    currentSourceRevision: evidence.runs[0].sourceRevision,
    method: "download",
    target: "pptx",
    rating: "ready",
  }), /exact output/i);
  await assert.rejects(() => recordRuneTaskDelivery({
    evidence,
    runId: evidence.runs[0].id,
    artifactId: "strategy-briefing",
    source: "# Changed after Apply\n",
    currentSourceRevision: evidence.runs[0].sourceRevision,
    method: "download",
    target: "pptx",
    rating: "ready",
  }), /changed after the applied task/i);
  await assert.rejects(() => recordRuneTaskDelivery({
    evidence,
    runId: evidence.runs[0].id,
    artifactId: "strategy-briefing",
    source: "# strategy-briefing\n",
    currentSourceRevision: portableSourceRevision("# Revised strategy memo\n"),
    method: "download",
    target: "pptx",
    rating: "ready",
  }), /task source changed/i);
  const stopped = appendRuneTaskRun(EMPTY_RUNE_TASK_EVIDENCE, briefingRun({ status: "stopped", stopReason: "cancelled" }));
  await assert.rejects(() => recordRuneTaskDelivery({
    evidence: stopped,
    runId: stopped.runs[0].id,
    artifactId: "strategy-briefing",
    source: "# Stopped\n",
    currentSourceRevision: stopped.runs[0].sourceRevision,
    method: "folder",
    target: "folder",
    rating: "ready",
  }), /applied task run/i);
  assert.deepEqual(normalizeRuneTaskEvidence({
    version: 1,
    runs: [
      briefingRun({ taskId: "unknown" }),
      briefingRun({ outputArtifactIds: ["strategy-memo"] }),
      briefingRun({ durationMs: -1 }),
      briefingRun({ provider: "bad\nprovider" }),
    ],
    deliveries: [],
  }).runs, []);
});

test("keeps run and delivery history bounded, newest first, and reconfirmation stable", async () => {
  let evidence = EMPTY_RUNE_TASK_EVIDENCE;
  for (let index = 0; index < MAX_RUNE_TASK_RUNS + 8; index += 1) {
    evidence = appendRuneTaskRun(evidence, briefingRun({
      id: `task-run:document-briefing:${index}`,
      completedAt: new Date(Date.UTC(2026, 7, 14, 9, index)).toISOString(),
      outputArtifactIds: [`briefing-${index}`],
    }));
  }
  assert.equal(evidence.runs.length, MAX_RUNE_TASK_RUNS);
  assert.equal(evidence.runs[0].id, `task-run:document-briefing:${MAX_RUNE_TASK_RUNS + 7}`);

  let deliveryEvidence = EMPTY_RUNE_TASK_EVIDENCE;
  for (let index = 0; index < MAX_RUNE_TASK_DELIVERIES + 6; index += 1) {
    const run = briefingRun({
      id: `task-run:document-briefing:delivery-${index}`,
      completedAt: new Date(Date.UTC(2026, 7, 14, 10, index)).toISOString(),
      outputArtifactIds: [`delivery-deck-${index}`],
      outputSources: [`# Deck ${index}\n`],
    });
    deliveryEvidence = appendRuneTaskRun(deliveryEvidence, run);
    deliveryEvidence = await recordRuneTaskDelivery({
      evidence: deliveryEvidence,
      runId: run.id,
      artifactId: `delivery-deck-${index}`,
      source: `# Deck ${index}\n`,
      currentSourceRevision: run.sourceRevision,
      method: "download",
      target: "pdf",
      rating: "ready",
      now: new Date(Date.UTC(2026, 7, 14, 10, index, 30)),
    });
  }
  assert.equal(deliveryEvidence.deliveries.length, MAX_RUNE_TASK_DELIVERIES);
  const latest = deliveryEvidence.deliveries[0];
  const reconfirmed = await recordRuneTaskDelivery({
    evidence: deliveryEvidence,
    runId: latest.runId,
    artifactId: latest.artifactId,
    source: `# Deck ${MAX_RUNE_TASK_DELIVERIES + 5}\n`,
    currentSourceRevision: deliveryEvidence.runs.find((run) => run.id === latest.runId).sourceRevision,
    method: "folder",
    target: "folder",
    rating: "not-ready",
    now: new Date("2026-08-14T12:00:00.000Z"),
  });
  assert.equal(reconfirmed.deliveries.length, MAX_RUNE_TASK_DELIVERIES);
  assert.equal(reconfirmed.deliveries[0].rating, "not-ready");
});
