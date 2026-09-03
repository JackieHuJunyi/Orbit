import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  WORKBENCH_BUSY_OPERATIONS,
  WORKBENCH_OPERATION_OWNERS,
  prepareWorkbenchOperationGate,
  workbenchOperationCanReplace,
} from "../app/lib/workbench-operation-gate.ts";

function gate({ hydrated = true, owners = [], busy = [] } = {}) {
  return prepareWorkbenchOperationGate({
    hydrated,
    owners: Object.fromEntries(WORKBENCH_OPERATION_OWNERS.map((owner) => [owner, owners.includes(owner)])),
    busy: Object.fromEntries(WORKBENCH_BUSY_OPERATIONS.map((operation) => [operation, busy.includes(operation)])),
  });
}

test("allows a new operation only after hydration with no existing owner or busy operation", () => {
  const ready = gate();
  assert.equal(ready.canStartOperation, true);
  assert.equal(ready.blocksGlobalShortcuts, false);
  assert.equal(ready.owner, null);
  assert.deepEqual(ready.activeOwners, []);
  assert.deepEqual(ready.activeBusyOperations, []);

  assert.equal(gate({ hydrated: false }).canStartOperation, false);
});

test("every registered owner blocks a competing operation and global shortcuts", () => {
  for (const owner of WORKBENCH_OPERATION_OWNERS) {
    const state = gate({ owners: [owner] });
    assert.equal(state.owner, owner);
    assert.deepEqual(state.activeOwners, [owner]);
    assert.equal(state.canStartOperation, false);
    assert.equal(state.blocksGlobalShortcuts, true);
    assert.equal(workbenchOperationCanReplace(state, owner), true);
  }
});

test("every registered asynchronous operation blocks a new owner", () => {
  for (const operation of WORKBENCH_BUSY_OPERATIONS) {
    const state = gate({ busy: [operation] });
    assert.deepEqual(state.activeBusyOperations, [operation]);
    assert.equal(state.owner, null);
    assert.equal(state.canStartOperation, false);
    assert.equal(state.blocksGlobalShortcuts, true);
  }
});

test("reports simultaneous owners as a fail-closed conflict", () => {
  const state = gate({ owners: ["import-review", "export-review", "agent-proposal"] });

  assert.equal(state.owner, null);
  assert.equal(state.hasOwnerConflict, true);
  assert.deepEqual(state.activeOwners, ["agent-proposal", "import-review", "export-review"]);
  assert.equal(state.canStartOperation, false);
  assert.equal(workbenchOperationCanReplace(state, "import-review"), false);
});

test("only the exact current owner may hand off to its next reviewed surface", () => {
  const exportReview = gate({ owners: ["export-review"] });
  assert.equal(workbenchOperationCanReplace(exportReview, "export-review"), true);
  assert.equal(workbenchOperationCanReplace(exportReview, "directory-sync"), false);
  assert.equal(workbenchOperationCanReplace(gate(), "export-review"), false);
  assert.equal(workbenchOperationCanReplace(gate({ hydrated: false, owners: ["welcome"] }), "welcome"), false);
  assert.equal(
    workbenchOperationCanReplace(gate({ owners: ["export-review"], busy: ["export-preparing"] }), "export-review"),
    false,
  );
});

test("compilation is immutable and never mutates the caller's complete registry", () => {
  const input = {
    hydrated: true,
    owners: Object.fromEntries(WORKBENCH_OPERATION_OWNERS.map((owner) => [owner, owner === "local-image"])),
    busy: Object.fromEntries(WORKBENCH_BUSY_OPERATIONS.map((operation) => [operation, false])),
  };
  const before = structuredClone(input);
  const state = prepareWorkbenchOperationGate(input);

  assert.deepEqual(input, before);
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.activeOwners), true);
  assert.equal(Object.isFrozen(state.activeBusyOperations), true);
});

test("the workbench binds every owner to one gate and uses it for shared entry surfaces", async () => {
  const [gateSource, workbench] = await Promise.all([
    readFile(new URL("../app/lib/workbench-operation-gate.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/orbit-workbench.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(gateSource, /from ["']react|\b(?:window|document|localStorage|indexedDB|fetch)\s*[.(]/);
  for (const owner of WORKBENCH_OPERATION_OWNERS) {
    assert.match(workbench, new RegExp(`["']?${owner}["']?\\s*:`));
  }
  assert.match(workbench, /const artifactCreationDisabled = operationStartBlocked/);
  assert.match(workbench, /workbenchOperationGate\.blocksGlobalShortcuts/);
  assert.match(workbench, /disabled=\{operationStartBlocked\}/);
  assert.match(workbench, /locked=\{operationStartBlocked\}/);
});
