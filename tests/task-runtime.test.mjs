import assert from "node:assert/strict";
import test from "node:test";

import { prepareWorkspaceImportReview } from "../app/lib/imports.ts";
import {
  bindOrbitTaskImportReview,
  prepareOrbitTaskAfterImport,
  ORBIT_TASK_DEFINITIONS,
  startOrbitTaskFromArtifact,
  startOrbitTaskSession,
} from "../app/lib/task-runtime.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";

const importedData = {
  id: "august-revenue",
  name: "august-revenue.csv",
  kind: "data",
  language: "CSV",
  source: "Region,Revenue\nAPAC,1900000\nEMEA,1430000\n",
};

const importedDocument = {
  id: "launch-brief",
  name: "launch-brief.md",
  kind: "document",
  language: "Markdown",
  source: "# Launch brief\n\nA reviewed source document.\n",
};

function reviewFor(imported = [importedData]) {
  const prepared = prepareWorkspaceImportReview(defaultArtifacts, imported, "August revenue.csv");
  assert.ok(prepared.review);
  return prepared.review;
}

test("declares composable task entries with narrow source capabilities", () => {
  assert.deepEqual(ORBIT_TASK_DEFINITIONS["operating-review"], {
    id: "operating-review",
    sourceAccept: ".csv,.json,.xlsx,.ods",
    acceptedArtifactKinds: ["data"],
    requiredArtifactLabel: "readable Data source",
  });
  assert.deepEqual(ORBIT_TASK_DEFINITIONS["document-briefing"], {
    id: "document-briefing",
    sourceAccept: ".doc,.docx,.odt,.pdf,.md,.markdown",
    acceptedArtifactKinds: ["document"],
    requiredArtifactLabel: "readable Document source",
  });
});

test("moves an operating-review task through explicit source lifecycle phases", () => {
  const review = reviewFor();
  const started = startOrbitTaskSession("operating-review", defaultArtifacts);
  assert.equal(started.phase, "awaiting-source");

  const bound = bindOrbitTaskImportReview(started, defaultArtifacts, review);
  assert.deepEqual(bound.errors, []);
  assert.equal(bound.session?.phase, "reviewing-source");
  assert.equal(bound.preferredArtifactId, importedData.id);

  const continued = prepareOrbitTaskAfterImport(bound.session, defaultArtifacts, review);
  assert.deepEqual(continued.errors, []);
  assert.equal(continued.session?.phase, "configuring");
  assert.equal(continued.preferredArtifactId, importedData.id);
  assert.equal(
    defaultArtifacts.some((artifact) => artifact.id === importedData.id),
    false,
  );
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
  const result = bindOrbitTaskImportReview(
    startOrbitTaskSession("operating-review", defaultArtifacts),
    defaultArtifacts,
    review,
  );
  assert.equal(result.session, null);
  assert.match(result.errors.join(" "), /not a supported source/);
});

test("moves a document-briefing task through the same exact import lifecycle", () => {
  const review = reviewFor([importedDocument]);
  const started = startOrbitTaskSession("document-briefing", defaultArtifacts);
  const bound = bindOrbitTaskImportReview(started, defaultArtifacts, review);
  assert.deepEqual(bound.errors, []);
  assert.equal(bound.session?.phase, "reviewing-source");
  assert.equal(bound.preferredArtifactId, importedDocument.id);

  const continued = prepareOrbitTaskAfterImport(bound.session, defaultArtifacts, review);
  assert.deepEqual(continued.errors, []);
  assert.equal(continued.session?.phase, "configuring");
  assert.equal(continued.preferredArtifactId, importedDocument.id);
});

test("opens a registered task from an existing compatible artifact without an import lifecycle", () => {
  const result = startOrbitTaskFromArtifact("document-briefing", defaultArtifacts, "q2-review");
  assert.deepEqual(result.errors, []);
  assert.equal(result.session?.phase, "configuring");
  assert.equal(result.session?.preferredArtifactId, "q2-review");
  const rejected = startOrbitTaskFromArtifact("document-briefing", defaultArtifacts, "regional-revenue");
  assert.equal(rejected.session, null);
  assert.match(rejected.errors.join(" "), /not a supported source/);
});

test("fails closed when workspace or reviewed import identity changes between phases", () => {
  const review = reviewFor();
  const started = startOrbitTaskSession("operating-review", defaultArtifacts);
  const changed = defaultArtifacts.map((artifact, index) =>
    index === 0 ? { ...artifact, source: `${artifact.source}\nChanged.` } : artifact,
  );
  const stale = bindOrbitTaskImportReview(started, changed, review);
  assert.equal(stale.session, null);
  assert.match(stale.errors.join(" "), /workspace changed/);

  const bound = bindOrbitTaskImportReview(started, defaultArtifacts, review);
  assert.ok(bound.session);
  const replacementReview = reviewFor([{ ...importedData, id: "other-data", name: "other-data.csv" }]);
  const mismatched = prepareOrbitTaskAfterImport(bound.session, defaultArtifacts, replacementReview);
  assert.equal(mismatched.session, null);
  assert.match(mismatched.errors.join(" "), /no longer match/);
});
