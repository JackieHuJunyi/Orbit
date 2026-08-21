import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_WORKSPACE_RESET_SNAPSHOT_BYTES,
  commitWorkspaceReset,
  normalizeWorkspaceDeviceState,
  prepareWorkspaceReset,
  serializeWorkspaceDeviceState,
} from "../app/lib/workspace-reset.ts";
import { EMPTY_RUNE_TASK_EVIDENCE } from "../app/lib/task-evidence.ts";
import { cloneDefaultArtifacts } from "../app/lib/workspace.ts";

function state(overrides = {}) {
  const artifacts = cloneDefaultArtifacts();
  return {
    artifacts,
    selectedId: artifacts[0].id,
    checkpoints: {},
    savedOperatingReviews: [],
    taskEvidence: EMPTY_RUNE_TASK_EVIDENCE,
    ...overrides,
  };
}

test("normalizes one complete device workspace without rewriting readable source", () => {
  const input = state();
  input.artifacts[0].source += "\n\nUnfinished local thought.";

  const normalized = normalizeWorkspaceDeviceState(input);

  assert.ok(normalized);
  assert.equal(normalized.artifacts[0].source, input.artifacts[0].source);
  assert.notEqual(normalized.artifacts, input.artifacts);
  assert.equal(normalizeWorkspaceDeviceState({ ...input, selectedId: "missing" }), null);
  assert.equal(normalizeWorkspaceDeviceState({ ...input, artifacts: [...input.artifacts, input.artifacts[0]] }), null);
});

test("prepares an exact reviewed sample switch with the current workspace as recovery", () => {
  const current = state();
  current.artifacts[0].source += "\n\nCurrent private draft.";
  current.checkpoints = {
    [current.artifacts[0].id]: [
      {
        id: "saved",
        artifactId: current.artifacts[0].id,
        source: current.artifacts[0].source,
        label: "Saved",
        createdAt: "2026-08-21T00:00:00.000Z",
        reason: "manual",
      },
    ],
  };
  const sample = state();
  const before = serializeWorkspaceDeviceState(current);

  const prepared = prepareWorkspaceReset(current, sample, "sample");

  assert.deepEqual(prepared.errors, []);
  assert.ok(prepared.plan);
  assert.equal(prepared.plan.mode, "sample");
  assert.equal(prepared.plan.current.checkpointCount, 1);
  assert.equal(serializeWorkspaceDeviceState(prepared.plan.nextState), serializeWorkspaceDeviceState(sample));
  assert.equal(serializeWorkspaceDeviceState(prepared.plan.nextRecovery), before);
  assert.equal(serializeWorkspaceDeviceState(current), before);
  assert.equal(Object.isFrozen(prepared.plan), true);
  assert.equal(Object.isFrozen(prepared.plan.current.artifactNames), true);
});

test("rejects unchanged, malformed, and oversized workspace transitions", () => {
  const current = state();
  assert.match(prepareWorkspaceReset(current, state(), "sample").errors[0], /already current/u);

  const invalid = state({ selectedId: "missing" });
  assert.match(prepareWorkspaceReset(current, invalid, "recovery").errors[0], /not a valid/u);

  const oversized = state();
  oversized.artifacts[0].source = "x".repeat(MAX_WORKSPACE_RESET_SNAPSHOT_BYTES + 1);
  assert.match(prepareWorkspaceReset(oversized, current, "sample").errors[0], /too large/u);
});

test("commits one exact workspace swap through the injected persistence boundary", async () => {
  const current = state();
  current.artifacts[0].source += "\n\nCurrent draft.";
  const sample = state();
  const prepared = prepareWorkspaceReset(current, sample, "sample");
  let persisted = null;

  const committed = await commitWorkspaceReset({
    expectedPlan: prepared.plan,
    readCurrent: () => current,
    readTarget: () => sample,
    persist: (nextState, nextRecovery) => {
      persisted = { nextState, nextRecovery };
    },
  });

  assert.equal(committed.mode, "sample");
  assert.equal(serializeWorkspaceDeviceState(committed.nextState), serializeWorkspaceDeviceState(sample));
  assert.equal(serializeWorkspaceDeviceState(committed.nextRecovery), serializeWorkspaceDeviceState(current));
  assert.equal(persisted.nextState, committed.nextState);
  assert.equal(persisted.nextRecovery, committed.nextRecovery);
});

test("keeps persistence unopened for stale snapshots and contains persistence failure", async () => {
  const current = state();
  current.artifacts[0].source += "\n\nCurrent draft.";
  const sample = state();
  const prepared = prepareWorkspaceReset(current, sample, "sample");
  let persistCalls = 0;

  const drifted = state();
  drifted.artifacts[0].source += "\n\nDifferent draft.";
  await assert.rejects(
    commitWorkspaceReset({
      expectedPlan: prepared.plan,
      readCurrent: () => drifted,
      readTarget: () => sample,
      persist: () => {
        persistCalls += 1;
      },
    }),
    /changed after this review/u,
  );
  assert.equal(persistCalls, 0);

  const changedTarget = state();
  changedTarget.artifacts[1].source += "\nChanged target";
  await assert.rejects(
    commitWorkspaceReset({
      expectedPlan: prepared.plan,
      readCurrent: () => current,
      readTarget: () => changedTarget,
      persist: () => {
        persistCalls += 1;
      },
    }),
    /built-in sample changed/u,
  );
  assert.equal(persistCalls, 0);

  await assert.rejects(
    commitWorkspaceReset({
      expectedPlan: prepared.plan,
      readCurrent: () => current,
      readTarget: () => sample,
      persist: () => {
        persistCalls += 1;
        throw new Error("Quota exceeded");
      },
    }),
    /Device persistence failed/u,
  );
  assert.equal(persistCalls, 1);
  assert.match(current.artifacts[0].source, /Current draft/u);
});
