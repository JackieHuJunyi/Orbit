import assert from "node:assert/strict";
import test from "node:test";

import { prepareWorkspaceImportReview } from "../app/lib/imports.ts";
import {
  bindRuneTaskImportReview,
  prepareRuneTaskAfterImport,
  RUNE_TASK_DEFINITIONS,
  startRuneTaskSession,
} from "../app/lib/task-runtime.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";

const importedData = {
  id: "august-revenue",
  name: "august-revenue.csv",
  kind: "data",
  language: "CSV",
  source: "Region,Revenue\nAPAC,1900000\nEMEA,1430000\n",
};

function reviewFor(imported = [importedData]) {
  const prepared = prepareWorkspaceImportReview(defaultArtifacts, imported, "August revenue.csv");
  assert.ok(prepared.review);
  return prepared.review;
}

test("declares one task entry with a narrow readable-data import capability", () => {
  assert.deepEqual(RUNE_TASK_DEFINITIONS["operating-review"], {
    id: "operating-review",
    sourceAccept: ".csv,.json,.xlsx,.ods",
    acceptedArtifactKinds: ["data"],
  });
});

test("moves an operating-review task through explicit source lifecycle phases", () => {
  const review = reviewFor();
  const started = startRuneTaskSession("operating-review", defaultArtifacts);
  assert.equal(started.phase, "awaiting-source");

  const bound = bindRuneTaskImportReview(started, defaultArtifacts, review);
  assert.deepEqual(bound.errors, []);
  assert.equal(bound.session?.phase, "reviewing-source");
  assert.equal(bound.preferredArtifactId, importedData.id);

  const continued = prepareRuneTaskAfterImport(bound.session, defaultArtifacts, review);
  assert.deepEqual(continued.errors, []);
  assert.equal(continued.session?.phase, "configuring");
  assert.equal(continued.preferredArtifactId, importedData.id);
  assert.equal(defaultArtifacts.some((artifact) => artifact.id === importedData.id), false);
});

test("rejects non-Data task imports before the import can be applied", () => {
  const document = {
    id: "notes",
    name: "notes.md",
    kind: "document",
    language: "Markdown",
    source: "# Notes\n",
  };
  const review = reviewFor([document]);
  const result = bindRuneTaskImportReview(
    startRuneTaskSession("operating-review", defaultArtifacts),
    defaultArtifacts,
    review,
  );
  assert.equal(result.session, null);
  assert.match(result.errors.join(" "), /not a supported source/);
});

test("fails closed when workspace or reviewed import identity changes between phases", () => {
  const review = reviewFor();
  const started = startRuneTaskSession("operating-review", defaultArtifacts);
  const changed = defaultArtifacts.map((artifact, index) => index === 0
    ? { ...artifact, source: `${artifact.source}\nChanged.` }
    : artifact);
  const stale = bindRuneTaskImportReview(started, changed, review);
  assert.equal(stale.session, null);
  assert.match(stale.errors.join(" "), /workspace changed/);

  const bound = bindRuneTaskImportReview(started, defaultArtifacts, review);
  assert.ok(bound.session);
  const replacementReview = reviewFor([{ ...importedData, id: "other-data", name: "other-data.csv" }]);
  const mismatched = prepareRuneTaskAfterImport(bound.session, defaultArtifacts, replacementReview);
  assert.equal(mismatched.session, null);
  assert.match(mismatched.errors.join(" "), /no longer match/);
});
