import assert from "node:assert/strict";
import test from "node:test";

import { compilePilotProblemGate, renderPilotProblemGateMarkdown } from "../app/lib/pilot-problem-gate.ts";

function interview(index, overrides = {}) {
  return {
    participantId: `participant-${String(index + 1).padStart(3, "0")}`,
    interviewedOn: "2026-08-19",
    evidenceReference: `approved-system/interview-${index + 1}`,
    roleSegment: "operations",
    eligibleRecentTask: true,
    repeatsAtLeastMonthly: false,
    activeMinutes: 60,
    activeMinutesBasis: "estimated",
    materialErrorCost: "not_observed",
    trialMaterialStatus: "unavailable",
    agreesToSupervisedTask: "no",
    priceChoice: "none",
    ...overrides,
  };
}

test("passes P1 only when the fixed first cohort meets every evidence threshold", () => {
  const interviews = Array.from({ length: 15 }, (_, index) =>
    interview(index, {
      repeatsAtLeastMonthly: index < 8,
      activeMinutes: index < 5 ? 121 : 60,
      activeMinutesBasis: index === 0 ? "measured" : "estimated",
      trialMaterialStatus: index < 3 ? "authorized" : index < 5 ? "redacted" : "unavailable",
      agreesToSupervisedTask: index < 7 ? "yes" : "no",
      priceChoice: index < 4 ? 499 : index < 9 ? 999 : index < 12 ? 1999 : "none",
    }),
  );

  const report = compilePilotProblemGate({ version: 1, interviews });

  assert.deepEqual(report, {
    version: 1,
    eligibleInterviews: 15,
    monthlyRepeaters: 8,
    highCostOrError: 5,
    supervisedTaskAgreements: 7,
    availableSourceSets: 5,
    unknownActiveMinutes: 0,
    unknownErrorCosts: 0,
    unknownSourceSets: 0,
    priceChoices: { 499: 4, 999: 5, 1999: 3, none: 3 },
    gates: {
      sample: true,
      recurrence: true,
      pain: true,
      trialAgreement: true,
      sourceAvailability: true,
      passed: true,
    },
  });
});

test("keeps unknowns and every missed P1 threshold visible", () => {
  const interviews = Array.from({ length: 15 }, (_, index) =>
    interview(index, {
      repeatsAtLeastMonthly: index < 7,
      activeMinutes: index < 3 ? 121 : index === 3 ? null : 60,
      activeMinutesBasis: index === 3 ? "unknown" : "estimated",
      materialErrorCost: index === 4 ? "unknown" : "not_observed",
      trialMaterialStatus: index < 4 ? "redacted" : index === 4 ? "unknown" : "unavailable",
      agreesToSupervisedTask: index < 6 ? "yes" : "follow_up",
    }),
  );

  const report = compilePilotProblemGate({ version: 1, interviews });

  assert.equal(report.gates.passed, false);
  assert.deepEqual(report.gates, {
    sample: true,
    recurrence: false,
    pain: false,
    trialAgreement: false,
    sourceAvailability: false,
    passed: false,
  });
  assert.equal(report.unknownActiveMinutes, 1);
  assert.equal(report.unknownErrorCosts, 1);
  assert.equal(report.unknownSourceSets, 1);
});

test("rejects a movable sample, ineligible task, duplicate participant, and ambiguous timing", () => {
  assert.throws(
    () =>
      compilePilotProblemGate({ version: 1, interviews: Array.from({ length: 14 }, (_, index) => interview(index)) }),
    /exactly 15 interviews/i,
  );
  assert.throws(
    () =>
      compilePilotProblemGate({
        version: 1,
        interviews: Array.from({ length: 15 }, (_, index) =>
          interview(index, index === 0 ? { eligibleRecentTask: false } : {}),
        ),
      }),
    /eligible recent task/i,
  );
  assert.throws(
    () =>
      compilePilotProblemGate({
        version: 1,
        interviews: Array.from({ length: 15 }, (_, index) =>
          interview(index, index === 1 ? { participantId: "participant-001" } : {}),
        ),
      }),
    /unique anonymous participant/i,
  );
  assert.throws(
    () =>
      compilePilotProblemGate({
        version: 1,
        interviews: Array.from({ length: 15 }, (_, index) =>
          interview(index, index === 0 ? { activeMinutes: null, activeMinutesBasis: "estimated" } : {}),
        ),
      }),
    /active minutes must be bounded/i,
  );
});

test("renders only aggregate P1 results and labels price choice as E1", () => {
  const report = compilePilotProblemGate({
    version: 1,
    interviews: Array.from({ length: 15 }, (_, index) => interview(index)),
  });
  const markdown = renderPilotProblemGateMarkdown(report);

  assert.match(markdown, /Price preference \(E1 only, never payment\)/i);
  assert.doesNotMatch(markdown, /participant-001/);
  assert.doesNotMatch(markdown, /interview-1/);
});
