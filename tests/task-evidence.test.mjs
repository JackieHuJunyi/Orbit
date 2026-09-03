import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { portableSourceRevision } from "../app/lib/source-revision.ts";

import {
  EMPTY_ORBIT_TASK_EVIDENCE,
  MAX_ORBIT_TASK_DELIVERIES,
  MAX_ORBIT_TASK_RUNS,
  appendOrbitTaskRun,
  normalizeOrbitTaskHumanEvaluation,
  normalizeOrbitTaskEvidence,
  recordOrbitTaskDelivery,
  orbitTaskDeliveryId,
  orbitTaskRunMatchesIdentity,
  orbitTaskRunsForIdentity,
  summarizeOrbitTaskDeliveries,
  summarizeOrbitTaskRuns,
} from "../app/lib/task-evidence.ts";

function humanEvaluation(rubric = {}) {
  return {
    version: 1,
    provenance: "authorized-or-redacted",
    rubric: {
      numberCorrectness: 5,
      evidenceCompleteness: 4,
      conclusionUsefulness: 4,
      structureClarity: 5,
      visualDeliverability: 4,
      changeComprehensibility: 4,
      timeSaved: 5,
      ...rubric,
    },
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach((entry) => deepFreeze(entry));
  return Object.freeze(value);
}

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
    outputRevisions: Object.fromEntries(
      outputArtifactIds.map((artifactId, index) => [artifactId, portableSourceRevision(outputSources[index])]),
    ),
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
  const evidence = appendOrbitTaskRun(EMPTY_ORBIT_TASK_EVIDENCE, briefingRun());
  assert.equal(evidence.version, 3);
  assert.equal(evidence.runs.length, 1);
  assert.deepEqual(summarizeOrbitTaskRuns(evidence.runs), {
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

test("migrates the v1 ledger forward without losing exact runs or deliveries", () => {
  const operatingReview = briefingRun({
    id: "task-run:operating-review:one",
    taskId: "operating-review",
    sourceArtifactId: "review-data",
    sourceRevision: portableSourceRevision("Region,Revenue\nNorth,120\n"),
    outputArtifactIds: ["review-query", "review-chart", "review-document", "review-slides"],
    outputSources: ["SELECT 1;", "{}", "# Review\n", "---\ntitle: Review\n---\n"],
  });
  const migrated = normalizeOrbitTaskEvidence({
    version: 1,
    runs: [operatingReview],
    deliveries: [
      {
        version: 1,
        id: orbitTaskDeliveryId(operatingReview.id, "review-document"),
        confirmedAt: "2026-08-14T08:01:00.000Z",
        runId: operatingReview.id,
        taskId: "operating-review",
        artifactId: "review-document",
        method: "download",
        target: "pdf",
        rating: "ready",
        sourceSha256: "a".repeat(64),
        taskDurationMs: 64_000,
      },
    ],
  });
  const identity = {
    taskId: "operating-review",
    sourceArtifactId: "review-data",
    outputArtifactIds: ["review-slides", "review-document", "review-chart", "review-query"],
  };

  assert.equal(migrated.version, 3);
  assert.equal(migrated.deliveries.length, 1);
  assert.equal(migrated.deliveries[0].version, 2);
  assert.equal(migrated.deliveries[0].evaluation, null);
  assert.equal(orbitTaskRunMatchesIdentity(migrated.runs[0], identity), true);
  assert.deepEqual(
    orbitTaskRunsForIdentity(migrated, identity).map((run) => run.id),
    [operatingReview.id],
  );
  assert.equal(
    orbitTaskRunMatchesIdentity(migrated.runs[0], { ...identity, outputArtifactIds: ["review-document"] }),
    false,
  );
  assert.equal(orbitTaskRunMatchesIdentity(migrated.runs[0], { ...identity, sourceArtifactId: "another-data" }), false);
});

test("binds a delivery judgment to the exact applied task output and revision", async () => {
  const evidence = appendOrbitTaskRun(EMPTY_ORBIT_TASK_EVIDENCE, briefingRun());
  const source = "# strategy-briefing\n";
  const recorded = await recordOrbitTaskDelivery({
    evidence,
    runId: evidence.runs[0].id,
    artifactId: "strategy-briefing",
    source,
    currentSourceRevision: evidence.runs[0].sourceRevision,
    currentOutputRevisions: evidence.runs[0].outputRevisions,
    method: "download",
    target: "pptx",
    rating: "minor-edits",
    now: new Date("2026-08-14T08:01:00.000Z"),
  });
  assert.deepEqual(recorded.deliveries[0], {
    version: 2,
    id: orbitTaskDeliveryId(evidence.runs[0].id, "strategy-briefing"),
    confirmedAt: "2026-08-14T08:01:00.000Z",
    runId: evidence.runs[0].id,
    taskId: "document-briefing",
    artifactId: "strategy-briefing",
    method: "download",
    target: "pptx",
    rating: "minor-edits",
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    taskDurationMs: 64_000,
    evaluation: null,
  });
  assert.equal(summarizeOrbitTaskDeliveries(recorded.deliveries).usableRate, 100);
  assert.doesNotMatch(JSON.stringify(recorded), /Strategy briefing|Direction/u);
});

test("records only complete authorized seven-dimensional evaluations and exposes the number gate", async () => {
  const run = briefingRun();
  const evidence = appendOrbitTaskRun(EMPTY_ORBIT_TASK_EVIDENCE, run);
  const evaluation = humanEvaluation({ numberCorrectness: 3 });
  const frozenInput = deepFreeze({ evidence, evaluation });
  const before = JSON.stringify(frozenInput);
  const recorded = await recordOrbitTaskDelivery({
    evidence: frozenInput.evidence,
    runId: run.id,
    artifactId: "strategy-briefing",
    source: "# strategy-briefing\n",
    currentSourceRevision: run.sourceRevision,
    currentOutputRevisions: run.outputRevisions,
    method: "download",
    target: "pptx",
    rating: "minor-edits",
    evaluation: frozenInput.evaluation,
    now: new Date("2026-08-14T08:01:00.000Z"),
  });

  assert.equal(JSON.stringify(frozenInput), before);
  assert.deepEqual(recorded.deliveries[0].evaluation, evaluation);
  assert.deepEqual(summarizeOrbitTaskDeliveries(recorded.deliveries), {
    total: 1,
    ready: 0,
    minorEdits: 1,
    notReady: 0,
    usable: 1,
    usableRate: 100,
    averageTaskDurationMs: 64_000,
    humanEvaluated: 1,
    reviewedRealTasks: 1,
    numberCorrectnessBelow4: 1,
    pilotEligibleTasks: 0,
    meetsPilotMinimum: false,
    dimensionAverages: {
      numberCorrectness: 3,
      evidenceCompleteness: 4,
      conclusionUsefulness: 4,
      structureClarity: 5,
      visualDeliverability: 4,
      changeComprehensibility: 4,
      timeSaved: 5,
    },
  });

  const incomplete = humanEvaluation();
  delete incomplete.rubric.timeSaved;
  const frozenIncomplete = Object.freeze({ ...incomplete, rubric: Object.freeze(incomplete.rubric) });
  assert.equal(normalizeOrbitTaskHumanEvaluation(frozenIncomplete), null);
  await assert.rejects(
    () =>
      recordOrbitTaskDelivery({
        evidence,
        runId: run.id,
        artifactId: "strategy-briefing",
        source: "# strategy-briefing\n",
        currentSourceRevision: run.sourceRevision,
        currentOutputRevisions: run.outputRevisions,
        method: "download",
        target: "pptx",
        rating: "ready",
        evaluation: frozenIncomplete,
      }),
    /evaluation is incomplete or invalid/i,
  );
  assert.equal(Object.hasOwn(frozenIncomplete.rubric, "timeSaved"), false);
});

test("counts unique real tasks, preserves a detailed evaluation on quick reconfirmation, and never averages away a low number score", async () => {
  const run = briefingRun({
    outputArtifactIds: ["strategy-document", "strategy-deck"],
    outputSources: ["# strategy-document\n", "# strategy-deck\n"],
  });
  let evidence = appendOrbitTaskRun(EMPTY_ORBIT_TASK_EVIDENCE, run);
  for (const [artifactId, source, score] of [
    ["strategy-document", "# strategy-document\n", 5],
    ["strategy-deck", "# strategy-deck\n", 3],
  ]) {
    evidence = await recordOrbitTaskDelivery({
      evidence,
      runId: run.id,
      artifactId,
      source,
      currentSourceRevision: run.sourceRevision,
      currentOutputRevisions: run.outputRevisions,
      method: "download",
      target: "pdf",
      rating: "ready",
      evaluation: humanEvaluation({ numberCorrectness: score }),
      now: new Date(`2026-08-14T08:0${score}:00.000Z`),
    });
  }
  const summary = summarizeOrbitTaskDeliveries(evidence.deliveries);
  assert.equal(summary.humanEvaluated, 2);
  assert.equal(summary.reviewedRealTasks, 1);
  assert.equal(summary.numberCorrectnessBelow4, 1);
  assert.equal(summary.pilotEligibleTasks, 0);
  assert.equal(summary.dimensionAverages.numberCorrectness, 4);

  const priorEvaluation = evidence.deliveries.find(
    (delivery) => delivery.artifactId === "strategy-document",
  ).evaluation;
  evidence = await recordOrbitTaskDelivery({
    evidence,
    runId: run.id,
    artifactId: "strategy-document",
    source: "# strategy-document\n",
    currentSourceRevision: run.sourceRevision,
    currentOutputRevisions: run.outputRevisions,
    method: "folder",
    target: "folder",
    rating: "minor-edits",
    now: new Date("2026-08-14T09:00:00.000Z"),
  });
  assert.deepEqual(
    evidence.deliveries.find((delivery) => delivery.artifactId === "strategy-document").evaluation,
    priorEvaluation,
  );
});

test("refuses an operating-review handoff when any linked task output changed", async () => {
  const run = briefingRun({
    id: "task-run:operating-review:delivery",
    taskId: "operating-review",
    sourceArtifactId: "review-data",
    outputArtifactIds: ["review-query", "review-chart", "review-document"],
    outputSources: ["SELECT 1;", "{}", "# Review\n"],
  });
  const evidence = appendOrbitTaskRun(EMPTY_ORBIT_TASK_EVIDENCE, run);
  await assert.rejects(
    () =>
      recordOrbitTaskDelivery({
        evidence,
        runId: run.id,
        artifactId: "review-document",
        source: "# Review\n",
        currentSourceRevision: run.sourceRevision,
        currentOutputRevisions: {
          ...run.outputRevisions,
          "review-chart": portableSourceRevision('{"changed":true}'),
        },
        method: "download",
        target: "pdf",
        rating: "ready",
      }),
    /task outputs changed/i,
  );
});

test("fails closed for fabricated, stopped, mismatched, or malformed task evidence", async () => {
  const evidence = appendOrbitTaskRun(EMPTY_ORBIT_TASK_EVIDENCE, briefingRun());
  await assert.rejects(
    () =>
      recordOrbitTaskDelivery({
        evidence,
        runId: evidence.runs[0].id,
        artifactId: "another-deck",
        source: "# Forged\n",
        currentSourceRevision: evidence.runs[0].sourceRevision,
        currentOutputRevisions: evidence.runs[0].outputRevisions,
        method: "download",
        target: "pptx",
        rating: "ready",
      }),
    /exact output/i,
  );
  await assert.rejects(
    () =>
      recordOrbitTaskDelivery({
        evidence,
        runId: evidence.runs[0].id,
        artifactId: "strategy-briefing",
        source: "# Changed after Apply\n",
        currentSourceRevision: evidence.runs[0].sourceRevision,
        currentOutputRevisions: evidence.runs[0].outputRevisions,
        method: "download",
        target: "pptx",
        rating: "ready",
      }),
    /changed after the applied task/i,
  );
  await assert.rejects(
    () =>
      recordOrbitTaskDelivery({
        evidence,
        runId: evidence.runs[0].id,
        artifactId: "strategy-briefing",
        source: "# strategy-briefing\n",
        currentSourceRevision: portableSourceRevision("# Revised strategy memo\n"),
        currentOutputRevisions: evidence.runs[0].outputRevisions,
        method: "download",
        target: "pptx",
        rating: "ready",
      }),
    /task source changed/i,
  );
  const stopped = appendOrbitTaskRun(
    EMPTY_ORBIT_TASK_EVIDENCE,
    briefingRun({ status: "stopped", stopReason: "cancelled" }),
  );
  await assert.rejects(
    () =>
      recordOrbitTaskDelivery({
        evidence: stopped,
        runId: stopped.runs[0].id,
        artifactId: "strategy-briefing",
        source: "# Stopped\n",
        currentSourceRevision: stopped.runs[0].sourceRevision,
        currentOutputRevisions: stopped.runs[0].outputRevisions,
        method: "folder",
        target: "folder",
        rating: "ready",
      }),
    /applied task run/i,
  );
  assert.deepEqual(
    normalizeOrbitTaskEvidence({
      version: 1,
      runs: [
        briefingRun({ taskId: "unknown" }),
        briefingRun({ outputArtifactIds: ["strategy-memo"] }),
        briefingRun({ durationMs: -1 }),
        briefingRun({ provider: "bad\nprovider" }),
      ],
      deliveries: [],
    }).runs,
    [],
  );
});

test("keeps run and delivery history bounded, newest first, and reconfirmation stable", async () => {
  let evidence = EMPTY_ORBIT_TASK_EVIDENCE;
  for (let index = 0; index < MAX_ORBIT_TASK_RUNS + 8; index += 1) {
    evidence = appendOrbitTaskRun(
      evidence,
      briefingRun({
        id: `task-run:document-briefing:${index}`,
        completedAt: new Date(Date.UTC(2026, 7, 14, 9, index)).toISOString(),
        outputArtifactIds: [`briefing-${index}`],
      }),
    );
  }
  assert.equal(evidence.runs.length, MAX_ORBIT_TASK_RUNS);
  assert.equal(evidence.runs[0].id, `task-run:document-briefing:${MAX_ORBIT_TASK_RUNS + 7}`);

  let deliveryEvidence = EMPTY_ORBIT_TASK_EVIDENCE;
  for (let index = 0; index < MAX_ORBIT_TASK_DELIVERIES + 6; index += 1) {
    const run = briefingRun({
      id: `task-run:document-briefing:delivery-${index}`,
      completedAt: new Date(Date.UTC(2026, 7, 14, 10, index)).toISOString(),
      outputArtifactIds: [`delivery-deck-${index}`],
      outputSources: [`# Deck ${index}\n`],
    });
    deliveryEvidence = appendOrbitTaskRun(deliveryEvidence, run);
    deliveryEvidence = await recordOrbitTaskDelivery({
      evidence: deliveryEvidence,
      runId: run.id,
      artifactId: `delivery-deck-${index}`,
      source: `# Deck ${index}\n`,
      currentSourceRevision: run.sourceRevision,
      currentOutputRevisions: run.outputRevisions,
      method: "download",
      target: "pdf",
      rating: "ready",
      now: new Date(Date.UTC(2026, 7, 14, 10, index, 30)),
    });
  }
  assert.equal(deliveryEvidence.deliveries.length, MAX_ORBIT_TASK_DELIVERIES);
  const latest = deliveryEvidence.deliveries[0];
  const reconfirmed = await recordOrbitTaskDelivery({
    evidence: deliveryEvidence,
    runId: latest.runId,
    artifactId: latest.artifactId,
    source: `# Deck ${MAX_ORBIT_TASK_DELIVERIES + 5}\n`,
    currentSourceRevision: deliveryEvidence.runs.find((run) => run.id === latest.runId).sourceRevision,
    currentOutputRevisions: deliveryEvidence.runs.find((run) => run.id === latest.runId).outputRevisions,
    method: "folder",
    target: "folder",
    rating: "not-ready",
    now: new Date("2026-08-14T12:00:00.000Z"),
  });
  assert.equal(reconfirmed.deliveries.length, MAX_ORBIT_TASK_DELIVERIES);
  assert.equal(reconfirmed.deliveries[0].rating, "not-ready");
});
