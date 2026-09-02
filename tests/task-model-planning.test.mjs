import assert from "node:assert/strict";
import test from "node:test";

import { MAX_RUNE_TASK_MODEL_RESPONSE_BYTES, prepareRuneTaskModelAssistance } from "../app/lib/task-model-planning.ts";

function dataArtifact(overrides = {}) {
  return {
    id: "source-data",
    name: "source-data.csv",
    kind: "data",
    language: "CSV / JSON",
    source: "Region,Revenue\nAPAC,120\nEMEA,90\n",
    ...overrides,
  };
}

function operatingInput(overrides = {}) {
  return {
    title: "Weekly review",
    dataArtifactId: "source-data",
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
    ...overrides,
  };
}

function documentArtifact(overrides = {}) {
  return {
    id: "source-document",
    name: "source-document.md",
    kind: "document",
    language: "Markdown",
    source: "# Source\n\n## Context\n\nA detailed context statement.\n\n## Decision\n\nA detailed decision statement.",
    ...overrides,
  };
}

function documentInput(overrides = {}) {
  return {
    sourceArtifactId: "source-document",
    title: "Source briefing",
    audience: "team",
    focus: "Agree the next decision.",
    slideCount: 4,
    locale: "en",
    ...overrides,
  };
}

function response(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function validNarrative() {
  return {
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
  };
}

test("keeps local-only tasks away from the injected network capability", async () => {
  const artifacts = Object.freeze([Object.freeze(dataArtifact())]);
  const request = Object.freeze({ taskId: "operating-review", input: Object.freeze(operatingInput()) });
  let fetchCount = 0;

  const result = await prepareRuneTaskModelAssistance(artifacts, request, {
    mode: "device-tools-only",
    fetcher: async () => {
      fetchCount += 1;
      throw new Error("Local mode must not contact a model endpoint.");
    },
  });

  assert.deepEqual(result, { taskId: "operating-review", outcome: "local", provider: "local", modelLabel: "" });
  assert.equal(fetchCount, 0);
  assert.equal(artifacts[0].source, dataArtifact().source);
  assert.equal(request.input.focus, operatingInput().focus);
});

test("fails over locally before fetch when the exact source is missing or oversized", async () => {
  let fetchCount = 0;
  const fetcher = async () => {
    fetchCount += 1;
    return response({});
  };
  const missing = await prepareRuneTaskModelAssistance(
    [],
    {
      taskId: "operating-review",
      input: operatingInput(),
    },
    { mode: "model-assisted", fetcher },
  );
  const oversized = await prepareRuneTaskModelAssistance(
    [documentArtifact({ source: "x".repeat(100_001) })],
    {
      taskId: "document-briefing",
      input: documentInput(),
    },
    { mode: "model-assisted", fetcher },
  );

  assert.equal(missing.outcome, "unavailable");
  assert.equal(oversized.outcome, "source-too-large");
  assert.equal(fetchCount, 0);
});

test("validates an operating-review response against locally recompiled evidence", async () => {
  const data = dataArtifact();
  const input = operatingInput();
  let requestCount = 0;
  let requested = 0;
  const result = await prepareRuneTaskModelAssistance(
    [data],
    {
      taskId: "operating-review",
      input,
    },
    {
      mode: "model-assisted",
      onModelRequest: () => {
        requested += 1;
      },
      fetcher: async (url, init) => {
        requestCount += 1;
        assert.equal(url, "/api/tasks/operating-review");
        assert.equal(init?.method, "POST");
        assert.deepEqual(JSON.parse(String(init?.body)), { artifact: data, input });
        return response({
          provider: "anthropic\nignored-control",
          profileName: `${"Board model".repeat(20)}\u0000`,
          model: "ignored-model-label",
          usage: { inputTokens: 420, outputTokens: "invalid" },
          narrative: validNarrative(),
        });
      },
    },
  );

  assert.equal(requestCount, 1);
  assert.equal(requested, 1);
  assert.equal(result.outcome, "model");
  assert.equal(result.provider, "anthropic ignored-control");
  assert.equal([...result.modelLabel].length, 120);
  assert.doesNotMatch(result.modelLabel, /[\u0000-\u001f\u007f]/u);
  assert.deepEqual(result.usage, { inputTokens: 420, outputTokens: null });
  assert.deepEqual(result.narrative, validNarrative());
});

test("rejects malformed or oversized task-model output into deterministic fallback", async () => {
  const invalid = await prepareRuneTaskModelAssistance(
    [dataArtifact()],
    {
      taskId: "operating-review",
      input: operatingInput(),
    },
    {
      mode: "model-assisted",
      fetcher: async () => response({ narrative: { insights: [] } }),
    },
  );
  const oversized = await prepareRuneTaskModelAssistance(
    [dataArtifact()],
    {
      taskId: "operating-review",
      input: operatingInput(),
    },
    {
      mode: "model-assisted",
      fetcher: async () =>
        response({ padding: "x".repeat(MAX_RUNE_TASK_MODEL_RESPONSE_BYTES), narrative: validNarrative() }),
    },
  );

  assert.equal(invalid.outcome, "unavailable");
  assert.equal(invalid.narrative, undefined);
  assert.equal(oversized.outcome, "unavailable");
});

test("routes Document briefing through the same injected and evidence-bound client port", async () => {
  const document = documentArtifact();
  const input = documentInput();
  const outline = {
    slides: [
      { sourceUnitId: "source-1", title: "Context", bullets: ["A detailed context supports the presentation."] },
      { sourceUnitId: "source-2", title: "Decision", bullets: ["Agree the next decision after review."] },
    ],
  };
  const result = await prepareRuneTaskModelAssistance(
    [document],
    {
      taskId: "document-briefing",
      input,
    },
    {
      mode: "model-assisted",
      fetcher: async (url, init) => {
        assert.equal(url, "/api/tasks/document-briefing");
        assert.deepEqual(JSON.parse(String(init?.body)), { artifact: document, input });
        return response({ provider: "gemini", model: "gemini-task", usage: {}, outline });
      },
    },
  );

  assert.equal(result.outcome, "model");
  assert.equal(result.provider, "gemini");
  assert.equal(result.modelLabel, "gemini-task");
  assert.deepEqual(result.usage, { inputTokens: null, outputTokens: null });
  assert.deepEqual(result.outline, outline);
});
