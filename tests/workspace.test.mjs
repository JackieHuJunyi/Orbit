import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultArtifacts,
  parseDataSource,
  planLocalChange,
  validateArtifact,
} from "../app/lib/workspace.ts";

test("parses the sample CSV without sending data anywhere", () => {
  const artifact = defaultArtifacts.find((item) => item.kind === "data");
  assert.ok(artifact);
  const parsed = parseDataSource(artifact.source);
  assert.equal(parsed.format, "CSV");
  assert.equal(parsed.rows.length, 4);
  assert.deepEqual(parsed.errors, []);
  assert.ok(parsed.columns.includes("Q2 Revenue"));
});

test("supports structured JSON data", () => {
  const parsed = parseDataSource('[{"region":"APAC","revenue":1840000}]');
  assert.equal(parsed.format, "JSON");
  assert.deepEqual(parsed.columns, ["region", "revenue"]);
  assert.equal(parsed.rows[0].revenue, 1840000);
});

test("plans data changes as a reviewable next source", () => {
  const artifact = defaultArtifacts.find((item) => item.kind === "data");
  assert.ok(artifact);
  const plan = planLocalChange(artifact, "增加利润率列");
  assert.notEqual(plan.nextSource, artifact.source);
  assert.match(plan.nextSource, /Margin/);
  assert.match(plan.nextSource, /39\.1%/);
});

test("keeps slide scripts out of the trusted preview contract", () => {
  const artifact = {
    id: "unsafe",
    name: "unsafe.html",
    kind: "slides",
    language: "Semantic HTML",
    source: "<main><section>Safe</section><script>alert(1)</script></main>",
  };
  assert.match(validateArtifact(artifact)[0], /Scripts are blocked/);
});
