import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentOperationPatchSchema,
  AgentWorkspaceOperationPlanSchema,
} from "../app/lib/agent-contract.ts";
import {
  MAX_COMPILED_AGENT_SOURCE_CHARS,
  applyAgentSourceOperations,
  compileAgentOperationPatch,
  compileAgentWorkspaceOperations,
} from "../app/lib/agent-operations.ts";
import { prepareWorkspacePatch } from "../app/lib/patches.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";

test("compiles one exact model operation into a concrete review source", () => {
  const source = "# Report\n\nThe old conclusion is unnecessarily verbose.\n\nEnd.";
  const plan = AgentOperationPatchSchema.parse({
    summary: "Shorten the conclusion",
    detail: "Only the exact conclusion sentence changes.",
    edits: [{
      find: "The old conclusion is unnecessarily verbose.",
      replace: "The conclusion is concise.",
    }],
  });
  const compiled = compileAgentOperationPatch(source, plan);
  assert.deepEqual(compiled.errors, []);
  assert.equal(compiled.plan?.operationCount, 1);
  assert.equal(compiled.plan?.nextSource, "# Report\n\nThe conclusion is concise.\n\nEnd.");
  assert.match(source, /unnecessarily verbose/);
  assert.equal("edits" in (compiled.plan ?? {}), false);
});

test("applies ordered operations against the evolving exact revision", () => {
  const compiled = applyAgentSourceOperations("alpha gamma", [
    { find: "alpha", replace: "beta" },
    { find: "beta gamma", replace: "delta" },
  ]);
  assert.deepEqual(compiled, { nextSource: "delta", errors: [] });

  const initiallyAmbiguous = applyAgentSourceOperations("one token one", [
    { find: "one token", replace: "two token" },
    { find: "one", replace: "three" },
  ]);
  assert.equal(initiallyAmbiguous.nextSource, "two token three");
  assert.deepEqual(initiallyAmbiguous.errors, []);
});

test("rejects missing, ambiguous, no-op, cancelling, and oversized operations", () => {
  assert.match(applyAgentSourceOperations("same same", [{ find: "same", replace: "new" }]).errors[0], /ambiguous/i);
  assert.match(applyAgentSourceOperations("current", [{ find: "missing", replace: "new" }]).errors[0], /current source revision/i);
  assert.match(applyAgentSourceOperations("current", [{ find: "current", replace: "current" }]).errors[0], /does not change/i);
  assert.match(applyAgentSourceOperations("a", [
    { find: "a", replace: "b" },
    { find: "b", replace: "a" },
  ]).errors[0], /cancel out/i);
  assert.match(applyAgentSourceOperations("anchor", [{
    find: "anchor",
    replace: "x".repeat(MAX_COMPILED_AGENT_SOURCE_CHARS + 1),
  }]).errors[0], /120,000-character/i);
});

test("compiles workspace operations atomically and rejects foreign or duplicate files", () => {
  const artifacts = [
    { id: "report", source: "# Report\n\nOld conclusion." },
    { id: "deck", source: "# Deck\n\nOld conclusion." },
  ];
  const plan = AgentWorkspaceOperationPlanSchema.parse({
    summary: "Align the conclusion",
    detail: "Both canonical sources use the same reviewed statement.",
    patches: artifacts.map((artifact) => ({
      artifactId: artifact.id,
      summary: `Align ${artifact.id}`,
      detail: "One exact sentence changes.",
      edits: [{ find: "Old conclusion.", replace: "One shared conclusion." }],
    })),
  });
  const compiled = compileAgentWorkspaceOperations(artifacts, plan);
  assert.deepEqual(compiled.errors, []);
  assert.deepEqual(compiled.plan?.patches.map((patch) => patch.operationCount), [1, 1]);
  assert.ok(compiled.plan?.patches.every((patch) => /One shared conclusion/.test(patch.nextSource)));
  assert.ok(artifacts.every((artifact) => /Old conclusion/.test(artifact.source)));

  const invalid = compileAgentWorkspaceOperations(artifacts, {
    ...plan,
    patches: [plan.patches[0], plan.patches[0], { ...plan.patches[0], artifactId: "foreign" }],
  });
  assert.equal(invalid.plan, undefined);
  assert.match(invalid.errors.join(" "), /duplicate file patches/i);
  assert.match(invalid.errors.join(" "), /unknown artifact/i);
});

test("keeps compiled operations behind the existing whole-workspace safety gate", () => {
  const query = defaultArtifacts.find((artifact) => artifact.kind === "query");
  const slides = defaultArtifacts.find((artifact) => artifact.kind === "slides");
  assert.ok(query);
  assert.ok(slides);
  const operationPlan = AgentWorkspaceOperationPlanSchema.parse({
    summary: "Attempt an unsafe coordinated change",
    detail: "The downstream transaction must reject both compiled files.",
    patches: [
      {
        artifactId: query.id,
        summary: "Mutate data",
        detail: "This operation must not pass the read-only query gate.",
        edits: [{ find: "SELECT", replace: "DELETE" }],
      },
      {
        artifactId: slides.id,
        summary: "Inject markup",
        detail: "This operation must not pass the Deck compiler gate.",
        edits: [{
          find: "# Growth became more durable.",
          replace: "# Growth became more durable.\n\n<script>alert(1)</script>",
        }],
      },
    ],
  });
  const compiled = compileAgentWorkspaceOperations(defaultArtifacts, operationPlan);
  assert.deepEqual(compiled.errors, []);
  assert.ok(compiled.plan);
  const prepared = prepareWorkspacePatch(defaultArtifacts, compiled.plan.patches);
  assert.match(prepared.errors.join(" "), /read-only|SELECT|WITH/i);
  assert.match(prepared.errors.join(" "), /raw HTML/i);
  assert.equal(prepared.nextArtifacts, defaultArtifacts);
});
