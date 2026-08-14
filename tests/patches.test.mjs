import assert from "node:assert/strict";
import test from "node:test";

import {
  captureWorkspaceSourceRevision,
  createLineDiffPreview,
  prepareWorkspaceMutation,
  prepareWorkspacePatch,
  validateWorkspaceArtifacts,
  workspaceMatchesSourceRevision,
} from "../app/lib/patches.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";

function artifact(kind) {
  const match = defaultArtifacts.find((item) => item.kind === kind);
  assert.ok(match);
  return match;
}

test("shows the concrete source lines in a bounded diff preview", () => {
  const preview = createLineDiffPreview("# Report\nOld conclusion\nEnd", "# Report\nNew conclusion\nNext action\nEnd");
  assert.deepEqual(
    preview.map((line) => line.kind),
    ["context", "removal", "addition", "addition", "context"],
  );
  assert.match(preview.find((line) => line.kind === "removal")?.text ?? "", /Old conclusion/);
  assert.match(preview.find((line) => line.kind === "addition")?.text ?? "", /New conclusion/);

  const truncated = createLineDiffPreview(
    "before",
    Array.from({ length: 30 }, (_, index) => `line ${index}`).join("\n"),
    6,
  );
  assert.ok(truncated.some((line) => /omitted/.test(line.text)));
  assert.ok(truncated.length <= 8);
});

test("binds a pending Agent review to the exact workspace source revision", () => {
  const revision = captureWorkspaceSourceRevision(defaultArtifacts);
  assert.equal(workspaceMatchesSourceRevision(defaultArtifacts, revision), true);
  assert.equal(
    workspaceMatchesSourceRevision(
      defaultArtifacts.map((item) => ({ ...item })),
      revision,
    ),
    true,
  );
  assert.equal(
    workspaceMatchesSourceRevision(
      defaultArtifacts.map((item, index) =>
        index === 0 ? { ...item, source: `${item.source}\nEdited while the model was planning.` } : item,
      ),
      revision,
    ),
    false,
  );
  assert.equal(workspaceMatchesSourceRevision([...defaultArtifacts].reverse(), revision), false);
});

test("prepares multiple valid sources without mutating the current workspace", () => {
  const document = artifact("document");
  const slides = artifact("slides");
  const originalSources = defaultArtifacts.map((item) => item.source);
  const result = prepareWorkspacePatch(defaultArtifacts, [
    {
      artifactId: document.id,
      summary: "Add a review note",
      detail: "The note is appended to the report.",
      nextSource: `${document.source}\n\n> Coordinated review note.`,
    },
    {
      artifactId: slides.id,
      summary: "Align the cover",
      detail: "The cover uses the same quarterly framing.",
      nextSource: slides.source.replace("Growth became more durable.", "Durable growth, one shared story."),
    },
  ]);
  assert.deepEqual(result.errors, []);
  assert.notEqual(result.nextArtifacts, defaultArtifacts);
  assert.deepEqual(
    defaultArtifacts.map((item) => item.source),
    originalSources,
  );
  assert.match(result.nextArtifacts.find((item) => item.id === document.id)?.source ?? "", /Coordinated review note/);
});

test("prepares existing patches and new artifacts as one atomic workspace mutation", () => {
  const document = artifact("document");
  const creation = {
    artifact: {
      id: "new-brief",
      name: "new-brief.md",
      kind: "document",
      language: "Markdown",
      source: "# New brief\n\nVisible workspace context.\n",
    },
    summary: "Create a brief",
    detail: "Add one Rune-owned source.",
  };
  const result = prepareWorkspaceMutation(
    defaultArtifacts,
    [
      {
        artifactId: document.id,
        summary: "Update the report",
        detail: "Append a coordinated note.",
        nextSource: `${document.source}\n\n> Coordinated with the new brief.`,
      },
    ],
    [creation],
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.nextArtifacts.length, defaultArtifacts.length + 1);
  assert.match(result.nextArtifacts.find((item) => item.id === document.id).source, /Coordinated with/);
  assert.equal(result.nextArtifacts.at(-1).name, "new-brief.md");
  assert.equal(
    defaultArtifacts.some((item) => item.id === "new-brief"),
    false,
  );
});

test("rejects duplicate creation identity and invalid created bindings without partial changes", () => {
  const document = artifact("document");
  const result = prepareWorkspaceMutation(
    defaultArtifacts,
    [
      {
        artifactId: document.id,
        summary: "Update the report",
        detail: "This valid patch must still remain unapplied.",
        nextSource: `${document.source}\n\n> Must remain atomic.`,
      },
    ],
    [
      {
        artifact: { ...document, source: "# Duplicate id\n" },
        summary: "Duplicate identity",
        detail: "This must be rejected.",
      },
      {
        artifact: {
          id: "broken-binding",
          name: "broken-binding.md",
          kind: "document",
          language: "Markdown",
          source: '# Broken\n\n{{ metric("missing_created_metric") }}',
        },
        summary: "Invalid binding",
        detail: "This must also be rejected.",
      },
    ],
  );
  assert.match(result.errors.join(" "), /Duplicate artifact id/);
  assert.match(result.errors.join(" "), /unresolved metric missing_created_metric/);
  assert.equal(result.nextArtifacts, defaultArtifacts);
});

test("rejects duplicate, unknown, and unchanged file entries atomically", () => {
  const document = artifact("document");
  const duplicate = {
    artifactId: document.id,
    summary: "Change report",
    detail: "A report change.",
    nextSource: `${document.source}\nChanged`,
  };
  const result = prepareWorkspacePatch(defaultArtifacts, [
    duplicate,
    { ...duplicate, nextSource: `${document.source}\nChanged twice` },
    { ...duplicate, artifactId: "missing-file" },
    { ...duplicate, artifactId: artifact("data").id, nextSource: artifact("data").source },
  ]);
  assert.match(result.errors.join(" "), /duplicate patches/);
  assert.match(result.errors.join(" "), /Unknown artifact/);
  assert.match(result.errors.join(" "), /unchanged/);
  assert.equal(result.nextArtifacts, defaultArtifacts);
});

test("rejects unsafe SQL or raw Deck HTML without exposing a partial next workspace", () => {
  const query = artifact("query");
  const slides = artifact("slides");
  const result = prepareWorkspacePatch(defaultArtifacts, [
    {
      artifactId: query.id,
      summary: "Unsafe query",
      detail: "This must be rejected.",
      nextSource: "DELETE FROM workspace_data;",
    },
    {
      artifactId: slides.id,
      summary: "Unsafe slide",
      detail: "This must also be rejected.",
      nextSource: slides.source.replace(
        "# Growth became more durable.",
        "# Growth became more durable.\n\n<script>alert(1)</script>",
      ),
    },
  ]);
  assert.match(result.errors.join(" "), /read-only|SELECT|WITH/i);
  assert.match(result.errors.join(" "), /raw HTML/);
  assert.equal(result.nextArtifacts, defaultArtifacts);
});

test("rejects a Query whose explicit Data binding is missing", () => {
  const query = artifact("query");
  const result = prepareWorkspacePatch(defaultArtifacts, [
    {
      artifactId: query.id,
      summary: "Change the Query source",
      detail: "The missing Data reference must block the transaction.",
      nextSource: query.source.replace('"regional-revenue"', '"missing-data"'),
    },
  ]);
  assert.match(result.errors.join(" "), /Query Data source not found: missing-data/i);
  assert.equal(result.nextArtifacts, defaultArtifacts);
});

test("rejects a Query edit that breaks a downstream scalar metric", () => {
  const query = defaultArtifacts.find((item) => item.id === "regional-summary");
  assert.ok(query);
  const result = prepareWorkspacePatch(defaultArtifacts, [
    {
      artifactId: query.id,
      summary: "Rename a scalar output",
      detail: "The report and Deck bindings must veto an incompatible Query schema.",
      nextSource: query.source.replace("total_q2_revenue", "renamed_total"),
    },
  ]);
  assert.match(result.errors.join(" "), /Query metric column not found in Query output: total_q2_revenue/);
  assert.equal(result.nextArtifacts, defaultArtifacts);
});

test("rejects malformed scalar metric syntax atomically", () => {
  const document = artifact("document");
  const result = prepareWorkspacePatch(defaultArtifacts, [
    {
      artifactId: document.id,
      summary: "Add an incomplete scalar binding",
      detail: "Malformed source bindings must not reach persistence.",
      nextSource: `${document.source}\n\nBroken: {{ metric("regional-summary", "total_q2_revenue") }}`,
    },
  ]);
  assert.match(result.errors.join(" "), /needs three arguments, plus an optional quoted result row index/);
  assert.equal(result.nextArtifacts, defaultArtifacts);
});

test("rejects unresolved cross-file metric bindings atomically", () => {
  const document = artifact("document");
  const result = prepareWorkspacePatch(defaultArtifacts, [
    {
      artifactId: document.id,
      summary: "Reference a missing metric",
      detail: "The invalid binding must block the transaction.",
      nextSource: `${document.source}\n\nMissing: {{ metric("not_defined") }}`,
    },
  ]);
  assert.match(result.errors.join(" "), /unresolved metric not_defined/);
  assert.equal(result.nextArtifacts, defaultArtifacts);
});

test("rejects data changes that would break a chart binding", () => {
  const data = artifact("data");
  const result = prepareWorkspacePatch(defaultArtifacts, [
    {
      artifactId: data.id,
      summary: "Rename the chart value column",
      detail: "The chart must block this incompatible schema change.",
      nextSource: data.source.replace("Q2 Revenue", "Q2 Sales"),
    },
  ]);
  assert.match(result.errors.join(" "), /Value column not found: Q2 Revenue/);
  assert.equal(result.nextArtifacts, defaultArtifacts);
});

test("validates duplicate workspace identity before filesystem or Agent replacement", () => {
  const duplicate = [...defaultArtifacts, { ...defaultArtifacts[0], name: "copy.md" }];
  assert.match(validateWorkspaceArtifacts(duplicate).join(" "), /Duplicate artifact id/);
  assert.deepEqual(validateWorkspaceArtifacts(defaultArtifacts), []);
});
