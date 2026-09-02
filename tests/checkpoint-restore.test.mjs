import assert from "node:assert/strict";
import test from "node:test";

import { commitCheckpointRestore, prepareCheckpointRestore } from "../app/lib/checkpoint-restore.ts";
import { MAX_CHECKPOINT_SOURCE_CHARS } from "../app/lib/checkpoints.ts";
import { cloneDefaultArtifacts } from "../app/lib/workspace.ts";

function checkpoint(artifactId, source, overrides = {}) {
  return {
    id: `${artifactId}-saved`,
    artifactId,
    source,
    label: "Reviewed baseline",
    createdAt: "2026-08-21T08:00:00.000Z",
    reason: "manual",
    ...overrides,
  };
}

test("prepares one revision-bound restore with an exact source diff", () => {
  const artifacts = cloneDefaultArtifacts();
  const document = artifacts.find((artifact) => artifact.id === "q2-review");
  const restoredSource = document.source;
  document.source = `${document.source}\n\nTemporary current note.`;

  const prepared = prepareCheckpointRestore(artifacts, checkpoint(document.id, restoredSource));

  assert.deepEqual(prepared.errors, []);
  assert.ok(prepared.plan);
  assert.equal(prepared.plan.artifactId, document.id);
  assert.equal(prepared.plan.checkpointLabel, "Reviewed baseline");
  assert.equal(prepared.plan.patch.nextSource, restoredSource);
  assert.equal(prepared.plan.nextArtifacts.find((artifact) => artifact.id === document.id)?.source, restoredSource);
  assert.ok(prepared.plan.diff.some((line) => line.kind === "removal" && /Temporary current note/u.test(line.text)));
  assert.equal(Object.isFrozen(prepared), true);
  assert.equal(Object.isFrozen(prepared.plan), true);
  assert.equal(Object.isFrozen(prepared.plan.diff), true);
});

test("rejects checkpoints that are missing, already current, or too large", () => {
  const artifacts = cloneDefaultArtifacts();
  const document = artifacts.find((artifact) => artifact.id === "q2-review");

  assert.match(prepareCheckpointRestore(artifacts, checkpoint("missing", "# Old")).errors[0], /does not belong/u);
  assert.match(
    prepareCheckpointRestore(artifacts, checkpoint(document.id, document.source)).errors[0],
    /already current/u,
  );

  const oversizedCurrent = [{ ...document, source: "x".repeat(MAX_CHECKPOINT_SOURCE_CHARS + 1) }];
  assert.match(
    prepareCheckpointRestore(oversizedCurrent, checkpoint(document.id, "# Old")).errors[0],
    /current source is too large/u,
  );
  assert.match(
    prepareCheckpointRestore([document], checkpoint(document.id, "x".repeat(MAX_CHECKPOINT_SOURCE_CHARS + 1)))
      .errors[0],
    /checkpoint source is too large/u,
  );
});

test("rejects a restore that would break current Query, Chart, or metric consumers", () => {
  const artifacts = cloneDefaultArtifacts();
  const data = artifacts.find((artifact) => artifact.id === "regional-revenue");
  const prepared = prepareCheckpointRestore(artifacts, checkpoint(data.id, "Region,Customers\nAPAC,148\nEurope,84"));

  assert.equal(prepared.plan, null);
  assert.ok(prepared.errors.length > 0);
  assert.match(prepared.errors.join(" "), /Q2 Revenue|Q1 Revenue|Cost/u);
});

test("does not mutate frozen workspace or checkpoint inputs on success or failure", () => {
  const base = cloneDefaultArtifacts();
  const document = base.find((artifact) => artifact.id === "q2-review");
  const currentSource = `${document.source}\n\nCurrent revision.`;
  const artifacts = Object.freeze(
    base.map((artifact) =>
      Object.freeze({ ...artifact, source: artifact.id === document.id ? currentSource : artifact.source }),
    ),
  );
  const saved = Object.freeze(checkpoint(document.id, document.source));
  const beforeWorkspace = JSON.stringify(artifacts);
  const beforeCheckpoint = JSON.stringify(saved);

  assert.ok(prepareCheckpointRestore(artifacts, saved).plan);
  assert.equal(JSON.stringify(artifacts), beforeWorkspace);
  assert.equal(JSON.stringify(saved), beforeCheckpoint);

  const invalid = Object.freeze(checkpoint("missing", "# Missing"));
  assert.equal(prepareCheckpointRestore(artifacts, invalid).plan, null);
  assert.equal(JSON.stringify(artifacts), beforeWorkspace);
  assert.equal(JSON.stringify(invalid), JSON.stringify(checkpoint("missing", "# Missing")));
});

test("commits the revalidated restore and safety history through injected runtime and persistence ports", async () => {
  const artifacts = cloneDefaultArtifacts();
  const document = artifacts.find((artifact) => artifact.id === "q2-review");
  const restoredSource = document.source;
  document.source = `${document.source}\n\nCurrent revision.`;
  const saved = checkpoint(document.id, restoredSource);
  const checkpoints = { [document.id]: [saved] };
  const prepared = prepareCheckpointRestore(artifacts, saved);
  let preflightCalls = 0;
  let persisted = null;

  const committed = await commitCheckpointRestore({
    expectedPlan: prepared.plan,
    readWorkspace: () => ({ artifacts, checkpoints }),
    preflight: async (runtimeArtifacts, patches) => {
      preflightCalls += 1;
      assert.equal(runtimeArtifacts, artifacts);
      assert.equal(patches[0].nextSource, restoredSource);
    },
    persist: (nextArtifacts, selectedId, nextCheckpoints) => {
      persisted = { nextArtifacts, selectedId, nextCheckpoints };
    },
    now: new Date("2026-08-21T09:00:00.000Z"),
  });

  assert.equal(preflightCalls, 1);
  assert.equal(committed.nextArtifacts.find((artifact) => artifact.id === document.id)?.source, restoredSource);
  assert.equal(committed.nextCheckpoints[document.id].at(-1).source, document.source);
  assert.equal(committed.nextCheckpoints[document.id].at(-1).reason, "restore");
  assert.equal(persisted.selectedId, document.id);
  assert.equal(persisted.nextArtifacts, committed.nextArtifacts);
  assert.equal(persisted.nextCheckpoints, committed.nextCheckpoints);
});

test("keeps runtime, drift, and persistence failures outside caller-owned workspace state", async () => {
  const artifacts = cloneDefaultArtifacts();
  const document = artifacts.find((artifact) => artifact.id === "q2-review");
  const restoredSource = document.source;
  document.source = `${document.source}\n\nCurrent revision.`;
  const saved = checkpoint(document.id, restoredSource);
  const checkpoints = { [document.id]: [saved] };
  const prepared = prepareCheckpointRestore(artifacts, saved);
  let currentArtifacts = artifacts;
  let persistCalls = 0;

  await assert.rejects(
    commitCheckpointRestore({
      expectedPlan: prepared.plan,
      readWorkspace: () => ({ artifacts: currentArtifacts, checkpoints }),
      preflight: async () => {
        currentArtifacts = artifacts.map((artifact) =>
          artifact.id === document.id ? { ...artifact, source: `${artifact.source}\nDrift.` } : artifact,
        );
      },
      persist: () => {
        persistCalls += 1;
      },
    }),
    /changed while Orbit was verifying/u,
  );
  assert.equal(persistCalls, 0);
  assert.equal(document.source.endsWith("Current revision."), true);

  currentArtifacts = artifacts;
  await assert.rejects(
    commitCheckpointRestore({
      expectedPlan: prepared.plan,
      readWorkspace: () => ({ artifacts: currentArtifacts, checkpoints }),
      preflight: async () => {
        throw new Error("Query runtime refused the restored schema");
      },
      persist: () => {
        persistCalls += 1;
      },
    }),
    /Runtime verification failed · Query runtime refused/u,
  );
  assert.equal(persistCalls, 0);

  await assert.rejects(
    commitCheckpointRestore({
      expectedPlan: prepared.plan,
      readWorkspace: () => ({ artifacts: currentArtifacts, checkpoints }),
      preflight: async () => undefined,
      persist: () => {
        persistCalls += 1;
        throw new Error("Quota exceeded");
      },
    }),
    /Device persistence failed/u,
  );
  assert.equal(persistCalls, 1);
  assert.equal(document.source.endsWith("Current revision."), true);
  assert.equal(currentArtifacts, artifacts);
});
