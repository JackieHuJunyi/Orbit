import assert from "node:assert/strict";
import test from "node:test";

import { prepareRunePilotEvidenceExport } from "../app/lib/pilot-evidence.ts";

const sourceRevision = "r1-a-aaaaaaaaaaaaaaaa";
const outputRevision = "r1-b-bbbbbbbbbbbbbbbb";
const outputSha = "c".repeat(64);

function evidenceFixture() {
  return {
    version: 3,
    runs: [
      {
        version: 1,
        id: "private-run-id",
        taskId: "operating-review",
        completedAt: "2026-08-13T09:10:11.000Z",
        status: "applied",
        stopReason: null,
        provider: "Acme Model / Finance Team",
        sourceArtifactId: "board-plan-private.xlsx",
        sourceRevision,
        outputArtifactIds: ["secret-report.md"],
        outputRevisions: { "secret-report.md": outputRevision },
        changedFileCount: 3,
        queryCount: 2,
        chartConsumerCount: 1,
        durationMs: 62_000,
        inputTokens: 1200,
        outputTokens: 450,
      },
      {
        version: 1,
        id: "local-stopped-id",
        taskId: "document-briefing",
        completedAt: "2026-08-12T08:00:00.000Z",
        status: "stopped",
        stopReason: "validation",
        provider: "local",
        sourceArtifactId: "confidential-brief.docx",
        sourceRevision,
        outputArtifactIds: ["private-deck.deck.md"],
        outputRevisions: { "private-deck.deck.md": outputRevision },
        changedFileCount: 0,
        queryCount: 0,
        chartConsumerCount: 0,
        durationMs: 4_000,
        inputTokens: null,
        outputTokens: null,
      },
    ],
    deliveries: [
      {
        version: 2,
        id: "delivery:private-run-id:secret-report.md",
        confirmedAt: "2026-08-13T09:15:11.000Z",
        runId: "private-run-id",
        taskId: "operating-review",
        artifactId: "secret-report.md",
        method: "download",
        target: "pdf",
        rating: "minor-edits",
        sourceSha256: outputSha,
        taskDurationMs: 362_000,
        evaluation: {
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
          },
        },
      },
    ],
  };
}

test("builds deterministic, bounded and reviewable pilot evidence", () => {
  const first = prepareRunePilotEvidenceExport(evidenceFixture(), new Date("2026-08-14T03:04:05.000Z"));
  const second = prepareRunePilotEvidenceExport(evidenceFixture(), new Date("2026-08-14T03:04:05.000Z"));
  assert.deepEqual(first, second);
  assert.equal(first.fileName, "rune-pilot-evidence-2026-08-14.json");
  assert.equal(first.mimeType, "application/json");
  assert.equal(first.package.runs[0].id, "run-001");
  assert.equal(first.package.runs[0].planner, "configured-model");
  assert.equal(first.package.runs[1].planner, "local");
  assert.equal(first.package.deliveries[0].output, "output-01");
  assert.equal(first.package.summary.runs.successRate, 50);
  assert.equal(first.package.summary.deliveries.usableRate, 100);
  assert.equal(first.package.summary.deliveries.reviewedRealTasks, 1);
  assert.equal(first.package.summary.deliveries.pilotEligibleTasks, 1);
  assert.equal(first.package.provenance.uploadPerformed, false);
  assert.equal(first.package.provenance.syntheticRegressionEvidenceIncluded, false);
  assert.equal(first.package.exportedOn, "2026-08-14");
  assert.ok(first.bytes.byteLength < 128 * 1024);
});

test("never serializes content identifiers, exact revision proofs, timestamps, or provider labels", () => {
  const result = prepareRunePilotEvidenceExport(evidenceFixture(), new Date("2026-08-14T03:04:05.000Z"));
  const serialized = new TextDecoder().decode(result.bytes);
  for (const forbidden of [
    "private-run-id",
    "local-stopped-id",
    "board-plan-private.xlsx",
    "secret-report.md",
    "confidential-brief.docx",
    "private-deck.deck.md",
    sourceRevision,
    outputRevision,
    outputSha,
    "Acme Model / Finance Team",
    "09:10:11",
    "09:15:11",
    "03:04:05",
  ])
    assert.equal(serialized.includes(forbidden), false, forbidden);
  assert.equal(serialized.includes("2026-08-13"), true);
  const forbiddenKeys = new Set([
    "sourceArtifactId",
    "sourceRevision",
    "outputArtifactIds",
    "outputRevisions",
    "artifactId",
    "sourceSha256",
    "provider",
    "prompt",
    "modelResponse",
    "queryRows",
    "userId",
    "path",
    "fileName",
  ]);
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbiddenKeys.has(key), false, key);
      visit(child);
    }
  };
  visit(result.package);
});

test("keeps deep-frozen input unchanged", () => {
  const input = evidenceFixture();
  const snapshot = structuredClone(input);
  Object.freeze(input.runs[0].outputArtifactIds);
  Object.freeze(input.runs[0].outputRevisions);
  Object.freeze(input.runs[0]);
  Object.freeze(input.runs[1].outputArtifactIds);
  Object.freeze(input.runs[1].outputRevisions);
  Object.freeze(input.runs[1]);
  Object.freeze(input.runs);
  Object.freeze(input.deliveries[0].evaluation.rubric);
  Object.freeze(input.deliveries[0].evaluation);
  Object.freeze(input.deliveries[0]);
  Object.freeze(input.deliveries);
  Object.freeze(input);
  prepareRunePilotEvidenceExport(input, new Date("2026-08-14T03:04:05.000Z"));
  assert.deepEqual(input, snapshot);
});

test("normalizes invalid and unlinked records before export", () => {
  const input = evidenceFixture();
  input.runs.unshift({ ...input.runs[0], id: "broken", completedAt: "not-a-date" });
  input.deliveries.unshift({ ...input.deliveries[0], id: "leak", runId: "missing" });
  const result = prepareRunePilotEvidenceExport(input, new Date("2026-08-14T03:04:05.000Z"));
  assert.equal(result.package.runs.length, 2);
  assert.equal(result.package.deliveries.length, 1);
});

test("refuses an empty or invalid-only evidence ledger and invalid export time", () => {
  const empty = Object.freeze({ version: 3, runs: Object.freeze([]), deliveries: Object.freeze([]) });
  assert.throws(() => prepareRunePilotEvidenceExport(empty), /guided task/i);
  assert.deepEqual(empty, { version: 3, runs: [], deliveries: [] });
  assert.throws(() => prepareRunePilotEvidenceExport(evidenceFixture(), new Date("invalid")), /valid export time/i);
});
