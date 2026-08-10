import assert from "node:assert/strict";
import test from "node:test";

import { createLineDiffPreview, prepareWorkspacePatch } from "../app/lib/patches.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";

function artifact(kind) {
  const match = defaultArtifacts.find((item) => item.kind === kind);
  assert.ok(match);
  return match;
}

test("shows the concrete source lines in a bounded diff preview", () => {
  const preview = createLineDiffPreview(
    "# Report\nOld conclusion\nEnd",
    "# Report\nNew conclusion\nNext action\nEnd",
  );
  assert.deepEqual(preview.map((line) => line.kind), ["context", "removal", "addition", "addition", "context"]);
  assert.match(preview.find((line) => line.kind === "removal")?.text ?? "", /Old conclusion/);
  assert.match(preview.find((line) => line.kind === "addition")?.text ?? "", /New conclusion/);

  const truncated = createLineDiffPreview("before", Array.from({ length: 30 }, (_, index) => `line ${index}`).join("\n"), 6);
  assert.ok(truncated.some((line) => /omitted/.test(line.text)));
  assert.ok(truncated.length <= 8);
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
  assert.deepEqual(defaultArtifacts.map((item) => item.source), originalSources);
  assert.match(result.nextArtifacts.find((item) => item.id === document.id)?.source ?? "", /Coordinated review note/);
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

test("rejects unsafe SQL or slide HTML without exposing a partial next workspace", () => {
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
      nextSource: "<main><section>Slide</section><script>alert(1)</script></main>",
    },
  ]);
  assert.match(result.errors.join(" "), /read-only|SELECT|WITH/i);
  assert.match(result.errors.join(" "), /Scripts are blocked/);
  assert.equal(result.nextArtifacts, defaultArtifacts);
});

test("rejects unresolved cross-file metric bindings atomically", () => {
  const document = artifact("document");
  const result = prepareWorkspacePatch(defaultArtifacts, [{
    artifactId: document.id,
    summary: "Reference a missing metric",
    detail: "The invalid binding must block the transaction.",
    nextSource: `${document.source}\n\nMissing: {{ metric("not_defined") }}`,
  }]);
  assert.match(result.errors.join(" "), /unresolved metric not_defined/);
  assert.equal(result.nextArtifacts, defaultArtifacts);
});
