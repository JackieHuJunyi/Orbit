import assert from "node:assert/strict";
import test from "node:test";

import { compilePilotOutcomeGate, renderPilotOutcomeGateMarkdown } from "../app/lib/pilot-outcome-gate.ts";

function comparison(index, overrides = {}) {
  return {
    participantId: `participant-${String((index % 5) + 1).padStart(3, "0")}`,
    taskId: `task-${String(index + 1).padStart(3, "0")}`,
    recordedOn: "2026-08-19",
    evidenceReference: `approved-system/p2-${index + 1}`,
    manualMinutes: 100,
    orbitMinutes: 40,
    manualTiming: "measured",
    authorizedOrRedacted: true,
    sameScope: true,
    sameDecision: true,
    deliveryOutcome: "ready",
    keyNumbersGenerated: 5,
    keyNumbersTraceable: 5,
    applied: true,
    safetyRedlines: 0,
    ...overrides,
  };
}

test("passes P2 only when every exact outcome threshold is met", () => {
  const comparisons = Array.from({ length: 10 }, (_, index) =>
    comparison(index, {
      orbitMinutes: index < 5 ? 60 : 40,
      deliveryOutcome: index < 3 ? "not_usable" : index < 6 ? "minor_edits" : "ready",
      applied: index >= 4,
      manualTiming: index === 0 ? "estimated" : "measured",
    }),
  );

  const report = compilePilotOutcomeGate({ version: 1, comparisons });

  assert.deepEqual(report, {
    version: 1,
    comparableTasks: 10,
    participants: 5,
    estimatedManualTimings: 1,
    medianTimeReductionPercent: 50,
    deliveryUsabilityPercent: 70,
    keyNumberTraceabilityPercent: 100,
    applyPercent: 60,
    safetyRedlines: 0,
    gates: {
      sample: true,
      time: true,
      delivery: true,
      traceability: true,
      apply: true,
      safety: true,
      passed: true,
    },
  });
});

test("keeps every missed P2 threshold visible instead of averaging it away", () => {
  const comparisons = Array.from({ length: 9 }, (_, index) =>
    comparison(index, {
      orbitMinutes: 80,
      deliveryOutcome: index < 3 ? "ready" : "not_usable",
      keyNumbersTraceable: index === 0 ? 4 : 5,
      applied: index < 2,
      safetyRedlines: index === 1 ? 1 : 0,
    }),
  );

  const report = compilePilotOutcomeGate({ version: 1, comparisons });

  assert.equal(report.gates.passed, false);
  assert.deepEqual(report.gates, {
    sample: false,
    time: false,
    delivery: false,
    traceability: false,
    apply: false,
    safety: false,
    passed: false,
  });
});

test("rejects incomparable, unauthorized, ambiguous, or duplicated P2 records", () => {
  assert.throws(
    () => compilePilotOutcomeGate({ version: 1, comparisons: [comparison(0, { sameScope: false })] }),
    /same scope/i,
  );
  assert.throws(
    () => compilePilotOutcomeGate({ version: 1, comparisons: [comparison(0, { authorizedOrRedacted: false })] }),
    /authorization/i,
  );
  assert.throws(
    () =>
      compilePilotOutcomeGate({
        version: 1,
        comparisons: [comparison(0), comparison(1, { taskId: "task-001" })],
      }),
    /unique anonymous task/i,
  );
  assert.throws(
    () => compilePilotOutcomeGate({ version: 1, comparisons: [comparison(0, { extra: true })] }),
    /only the documented fields/i,
  );
});

test("renders an aggregate P2 decision without participant or evidence identifiers", () => {
  const report = compilePilotOutcomeGate({ version: 1, comparisons: [comparison(0)] });
  const markdown = renderPilotOutcomeGateMarkdown(report);

  assert.match(markdown, /OPEN/);
  assert.match(markdown, /Comparable paired tasks/);
  assert.doesNotMatch(markdown, /participant-001/);
  assert.doesNotMatch(markdown, /p2-1/);
});
