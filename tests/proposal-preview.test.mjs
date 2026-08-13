import assert from "node:assert/strict";
import test from "node:test";

import { compileArtifactSource } from "../app/lib/bindings.ts";
import { captureWorkspaceSourceRevision } from "../app/lib/patches.ts";
import { prepareWorkspaceProposalPreview } from "../app/lib/proposal-preview.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";

function artifact(id) {
  const match = defaultArtifacts.find((candidate) => candidate.id === id);
  assert.ok(match);
  return match;
}

test("projects a complete Agent proposal into readable source without mutating canonical artifacts", () => {
  const data = artifact("regional-revenue");
  const beforeSources = defaultArtifacts.map((candidate) => candidate.source);
  const preview = prepareWorkspaceProposalPreview({
    artifacts: defaultArtifacts,
    baseRevision: captureWorkspaceSourceRevision(defaultArtifacts),
    patches: [{
      artifactId: data.id,
      summary: "Update APAC revenue",
      detail: "The proposal remains unapplied.",
      nextSource: data.source.replace("APAC,1840000", "APAC,1900000"),
    }],
    creations: [],
  });

  assert.deepEqual(preview.errors, []);
  assert.equal(preview.artifact?.id, data.id);
  assert.match(preview.artifact?.source ?? "", /APAC,1900000/);
  assert.deepEqual(defaultArtifacts.map((candidate) => candidate.source), beforeSources);
  assert.equal(artifact("regional-revenue").source.includes("APAC,1900000"), false);
});

test("previews an unchanged downstream deliverable against the complete proposed workspace", () => {
  const data = artifact("regional-revenue");
  const report = artifact("q2-review");
  const preview = prepareWorkspaceProposalPreview({
    artifacts: defaultArtifacts,
    baseRevision: captureWorkspaceSourceRevision(defaultArtifacts),
    patches: [{
      artifactId: data.id,
      summary: "Change the leading region",
      detail: "Every dependent preview reads the proposal projection.",
      nextSource: data.source.replace("APAC,1840000", "APAC,1000000"),
    }],
    creations: [],
    requestedArtifactId: report.id,
  });

  assert.deepEqual(preview.errors, []);
  assert.equal(preview.artifact?.id, report.id);
  assert.equal(preview.artifact?.source, report.source);
  const compiled = compileArtifactSource(preview.artifact.source, preview.artifacts);
  assert.equal(compiled.metrics.top_region?.value, "North America");
  assert.match(compiled.source, /North America.*led growth/);
});

test("selects a new artifact inside a mixed proposal without adding it to the canonical workspace", () => {
  const report = artifact("q2-review");
  const creation = {
    artifact: {
      id: "proposal-brief",
      name: "proposal-brief.md",
      kind: "document",
      language: "Markdown",
      source: "# Proposal brief\n\nThis source exists only in review.\n",
    },
    summary: "Create a proposal brief",
    detail: "The new identity remains ephemeral until Apply.",
  };
  const preview = prepareWorkspaceProposalPreview({
    artifacts: defaultArtifacts,
    baseRevision: captureWorkspaceSourceRevision(defaultArtifacts),
    patches: [{
      artifactId: report.id,
      summary: "Align the report",
      detail: "The report and brief are reviewed together.",
      nextSource: `${report.source}\n\n> Proposal preview remains read-only.`,
    }],
    creations: [creation],
    requestedArtifactId: creation.artifact.id,
  });

  assert.deepEqual(preview.errors, []);
  assert.equal(preview.artifact?.id, creation.artifact.id);
  assert.equal(preview.isCreation, true);
  assert.equal(preview.artifacts.at(-1)?.id, creation.artifact.id);
  assert.equal(defaultArtifacts.some((candidate) => candidate.id === creation.artifact.id), false);
});

test("fails closed for stale or invalid proposals and exposes no partial candidate workspace", () => {
  const report = artifact("q2-review");
  const revision = captureWorkspaceSourceRevision(defaultArtifacts);
  const staleArtifacts = defaultArtifacts.map((candidate) => candidate.id === report.id
    ? { ...candidate, source: `${candidate.source}\n\nChanged after planning.` }
    : candidate);
  const stale = prepareWorkspaceProposalPreview({
    artifacts: staleArtifacts,
    baseRevision: revision,
    patches: [{
      artifactId: report.id,
      summary: "Stale change",
      detail: "This must not render as current.",
      nextSource: `${report.source}\n\nProposed.`,
    }],
    creations: [],
  });
  assert.equal(stale.artifact, null);
  assert.match(stale.errors.join(" "), /no longer matches/);
  assert.equal(stale.artifacts, staleArtifacts);

  const invalid = prepareWorkspaceProposalPreview({
    artifacts: defaultArtifacts,
    baseRevision: revision,
    patches: [{
      artifactId: report.id,
      summary: "Invalid change",
      detail: "An unresolved binding must not preview.",
      nextSource: `${report.source}\n\n{{ metric("missing") }}`,
    }],
    creations: [],
  });
  assert.equal(invalid.artifact, null);
  assert.match(invalid.errors.join(" "), /unresolved metric missing/);
  assert.equal(invalid.artifacts, defaultArtifacts);
});
