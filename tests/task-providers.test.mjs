import assert from "node:assert/strict";
import test from "node:test";

import { RUNE_TASK_DEFINITIONS } from "../app/lib/task-runtime.ts";
import { RUNE_TASK_PROVIDER_IDS, prepareRuneTaskProvider } from "../app/lib/task-providers.ts";

const document = {
  id: "source",
  name: "source.md",
  kind: "document",
  language: "Markdown",
  source: "# Source\n\n## Context\n\nA sufficiently detailed context statement for a presentation.\n\n## Decision\n\nA sufficiently detailed decision statement for the final slide.",
};

test("keeps every registered task paired with one static provider", () => {
  assert.deepEqual(Object.keys(RUNE_TASK_PROVIDER_IDS).sort(), Object.keys(RUNE_TASK_DEFINITIONS).sort());
});

test("routes a typed document task through the shared pure provider boundary", () => {
  const prepared = prepareRuneTaskProvider([document], {
    taskId: "document-briefing",
    input: {
      sourceArtifactId: document.id,
      title: "Source briefing",
      audience: "team",
      focus: "Agree the next decision.",
      slideCount: 4,
      locale: "en",
    },
  });
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.plan?.patches.length, 0);
  assert.equal(prepared.plan?.creations[0].artifact.kind, "slides");
});

test("passes an evidence-bound model outline through the same pure compiler boundary", () => {
  const prepared = prepareRuneTaskProvider([document], {
    taskId: "document-briefing",
    input: {
      sourceArtifactId: document.id,
      title: "Source briefing",
      audience: "team",
      focus: "Agree the next decision.",
      slideCount: 4,
      locale: "en",
    },
    outline: {
      slides: [
        { sourceUnitId: "source-1", title: "Context", bullets: ["A detailed context supports the presentation."] },
        { sourceUnitId: "source-2", title: "Decision", bullets: ["Agree the next decision after review."] },
      ],
    },
  });
  assert.deepEqual(prepared.errors, []);
  assert.match(prepared.plan?.creations[0].artifact.source ?? "", /## Context\n\n- A detailed context/u);
});

test("routes a typed operating-review task through the same provider boundary", () => {
  const data = {
    id: "source-data",
    name: "source-data.csv",
    kind: "data",
    language: "CSV / JSON",
    source: "Region,Revenue\nAPAC,120\nEMEA,90\n",
  };
  const prepared = prepareRuneTaskProvider([data], {
    taskId: "operating-review",
    input: {
      title: "Weekly review",
      dataArtifactId: data.id,
      category: "Region",
      value: "Revenue",
      aggregation: "sum",
      mark: "bar",
      format: "currency",
      period: "This week",
      audience: "leadership",
      focus: "Choose the next regional priority.",
      deliverables: ["document"],
      locale: "en",
    },
  });
  assert.deepEqual(prepared.errors, []);
  assert.deepEqual(prepared.plan?.creations.map((creation) => creation.artifact.kind), [
    "query", "chart", "document",
  ]);
});

test("passes evidence-bound operating questions through the same pure compiler boundary", () => {
  const data = {
    id: "source-data",
    name: "source-data.csv",
    kind: "data",
    language: "CSV / JSON",
    source: "Region,Revenue\nAPAC,120\nEMEA,90\n",
  };
  const prepared = prepareRuneTaskProvider([data], {
    taskId: "operating-review",
    input: {
      title: "Weekly review",
      dataArtifactId: data.id,
      category: "Region",
      value: "Revenue",
      aggregation: "sum",
      mark: "bar",
      format: "currency",
      period: "This week",
      audience: "leadership",
      focus: "Choose the next regional priority.",
      deliverables: ["document"],
      locale: "en",
    },
    narrative: {
      insights: [
        {
          primaryEvidenceRowId: "result-1",
          supportingEvidenceRowId: null,
          title: "Where is the result concentrated?",
          question: "What evidence explains the visible leading pattern?",
          decisionPrompt: "Review whether the current allocation should change.",
        },
        {
          primaryEvidenceRowId: "result-2",
          supportingEvidenceRowId: null,
          title: "What needs closer review?",
          question: "Could scope choices materially affect this pattern?",
          decisionPrompt: "Confirm the evidence boundary before deciding.",
        },
      ],
    },
  });
  assert.deepEqual(prepared.errors, []);
  const report = prepared.plan?.creations.find((creation) => creation.artifact.kind === "document")?.artifact;
  const query = prepared.plan?.creations.find((creation) => creation.artifact.kind === "query")?.artifact;
  assert.ok(report?.source.includes(`{{ metric("${query?.id}", "Revenue", "currency", "0") }}`));
});
