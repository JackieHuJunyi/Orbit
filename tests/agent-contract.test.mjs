import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentPatchSchema,
  AgentRequestSchema,
  buildAgentInput,
  buildAgentInstructions,
} from "../app/lib/agent-contract.ts";

const request = {
  artifact: {
    id: "report",
    name: "report.md",
    kind: "document",
    language: "Markdown",
    source: "# Report\n\nRevenue: {{ metric(\"total_revenue\") }}",
  },
  prompt: "Make the conclusion more concise.",
  metrics: { total_revenue: "$4.82M" },
};

test("accepts a bounded artifact request and preserves metric context", () => {
  const parsed = AgentRequestSchema.parse(request);
  assert.match(buildAgentInstructions(parsed), /Preserve useful headings/);
  assert.match(buildAgentInput(parsed), /total_revenue/);
});

test("requires a complete reviewable patch", () => {
  assert.equal(AgentPatchSchema.safeParse({ summary: "Shorten it" }).success, false);
  assert.equal(AgentPatchSchema.safeParse({
    summary: "Shorten the conclusion",
    detail: "Only the conclusion changes.",
    nextSource: "# Report\n\nA concise conclusion.",
  }).success, true);
});

test("rejects oversized or empty agent inputs before provider calls", () => {
  assert.equal(AgentRequestSchema.safeParse({ ...request, prompt: "" }).success, false);
  assert.equal(AgentRequestSchema.safeParse({ ...request, prompt: "x".repeat(2_001) }).success, false);
});
