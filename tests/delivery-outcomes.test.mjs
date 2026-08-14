import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  appendOperatingReviewRun,
  createSavedOperatingReview,
  normalizeSavedOperatingReviews,
  prepareOperatingReviewWorkflow,
  recordOperatingReviewDelivery,
  summarizeOperatingReviewDeliveryOutcomes,
} from "../app/lib/operating-review.ts";
import {
  MAX_OPERATING_REVIEW_DELIVERIES,
  normalizeOperatingReviewDeliveryOutcomes,
  operatingReviewDeliveryId,
} from "../app/lib/delivery-outcomes.ts";

function dataArtifact() {
  return {
    id: "delivery-data",
    name: "delivery-data.csv",
    kind: "data",
    language: "CSV",
    source: "Region,Revenue\nNorth,120\nSouth,80\n",
  };
}

function reviewInput(overrides = {}) {
  return {
    title: "Delivery Review",
    dataArtifactId: "delivery-data",
    category: "Region",
    value: "Revenue",
    aggregation: "sum",
    mark: "bar",
    format: "currency",
    period: "August 2026",
    audience: "leadership",
    focus: "Confirm which region needs a follow-up decision.",
    deliverables: ["document", "slides"],
    locale: "en",
    ...overrides,
  };
}

function appliedWorkflow(locale = "en") {
  const input = reviewInput({ locale });
  const prepared = prepareOperatingReviewWorkflow([dataArtifact()], input);
  const saved = createSavedOperatingReview(input, prepared.plan);
  return appendOperatingReviewRun(saved, {
    version: 1,
    id: "run:delivery:applied",
    completedAt: "2026-08-13T08:00:00.000Z",
    period: input.period,
    status: "applied",
    stopReason: null,
    provider: "local",
    changedFileCount: 4,
    queryCount: 1,
    chartConsumerCount: 1,
    durationMs: 4_000,
    inputTokens: null,
    outputTokens: null,
  });
}

test("binds one device-local delivery judgment to an exact applied run, deliverable, and source revision", async () => {
  const workflow = appliedWorkflow();
  const artifactId = workflow.artifactIds.document;
  const source = "# Delivery proof\n\nCurrent canonical result.\n";
  const recorded = await recordOperatingReviewDelivery({
    workflow,
    runId: workflow.runs[0].id,
    artifactId,
    source,
    method: "download",
    target: "docx",
    rating: "ready",
    now: new Date("2026-08-13T08:01:00.000Z"),
  });

  assert.equal(recorded.deliveries.length, 1);
  assert.deepEqual(recorded.deliveries[0], {
    version: 1,
    id: operatingReviewDeliveryId(workflow.runs[0].id, artifactId),
    confirmedAt: "2026-08-13T08:01:00.000Z",
    runId: workflow.runs[0].id,
    artifactId,
    method: "download",
    target: "docx",
    rating: "ready",
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    taskDurationMs: 64_000,
  });
  assert.deepEqual(summarizeOperatingReviewDeliveryOutcomes(recorded.deliveries), {
    total: 1,
    ready: 1,
    minorEdits: 0,
    notReady: 0,
    usable: 1,
    usableRate: 100,
    averageTaskDurationMs: 64_000,
  });
  assert.doesNotMatch(JSON.stringify(recorded.deliveries), /Current canonical result|Delivery proof/u);
});

test("reconfirmation replaces the same run and deliverable instead of inflating the verified-deliverable count", async () => {
  const workflow = appliedWorkflow();
  const artifactId = workflow.artifactIds.document;
  const first = await recordOperatingReviewDelivery({
    workflow,
    runId: workflow.runs[0].id,
    artifactId,
    source: "# First\n",
    method: "download",
    target: "pdf",
    rating: "not-ready",
    now: new Date("2026-08-13T08:02:00.000Z"),
  });
  const second = await recordOperatingReviewDelivery({
    workflow: first,
    runId: workflow.runs[0].id,
    artifactId,
    source: "# Revised\n",
    method: "folder",
    target: "folder",
    rating: "minor-edits",
    now: new Date("2026-08-13T08:03:00.000Z"),
  });

  assert.equal(second.deliveries.length, 1);
  assert.equal(second.deliveries[0].rating, "minor-edits");
  assert.equal(second.deliveries[0].method, "folder");
  assert.equal(summarizeOperatingReviewDeliveryOutcomes(second.deliveries).usableRate, 100);
});

test("rejects fabricated run, artifact, format-method, fingerprint, and stopped-run delivery evidence", async () => {
  const workflow = appliedWorkflow();
  const artifactId = workflow.artifactIds.document;
  const valid = {
    version: 1,
    id: operatingReviewDeliveryId(workflow.runs[0].id, artifactId),
    confirmedAt: "2026-08-13T08:01:00.000Z",
    runId: workflow.runs[0].id,
    artifactId,
    method: "download",
    target: "pdf",
    rating: "ready",
    sourceSha256: "a".repeat(64),
    taskDurationMs: 4_500,
  };
  const context = { appliedRunIds: [workflow.runs[0].id], deliverableArtifactIds: [artifactId] };

  assert.equal(normalizeOperatingReviewDeliveryOutcomes([valid], context).length, 1);
  assert.deepEqual(
    normalizeOperatingReviewDeliveryOutcomes(
      [
        { ...valid, runId: "run:forged" },
        { ...valid, artifactId: workflow.artifactIds.chart },
        { ...valid, method: "folder", target: "pdf" },
        { ...valid, sourceSha256: "not-a-hash" },
      ],
      context,
    ),
    [],
  );
  await assert.rejects(
    () =>
      recordOperatingReviewDelivery({
        workflow: { ...workflow, runs: [{ ...workflow.runs[0], status: "stopped", stopReason: "cancelled" }] },
        runId: workflow.runs[0].id,
        artifactId,
        source: "# No delivery\n",
        method: "download",
        target: "pdf",
        rating: "ready",
      }),
    /saved operating review|applied task run/i,
  );
});

test("keeps delivery records bounded and retains saved tasks in every registered interface locale", () => {
  const workflow = appliedWorkflow("fr");
  const artifactId = workflow.artifactIds.document;
  const deliveries = Array.from({ length: MAX_OPERATING_REVIEW_DELIVERIES + 8 }, (_, index) => ({
    version: 1,
    id: operatingReviewDeliveryId(`run:${index}`, artifactId),
    confirmedAt: new Date(Date.UTC(2026, 7, 13, 9, index)).toISOString(),
    runId: `run:${index}`,
    artifactId,
    method: "download",
    target: "pdf",
    rating: "ready",
    sourceSha256: index.toString(16).padStart(64, "0"),
    taskDurationMs: index,
  }));
  const bounded = normalizeOperatingReviewDeliveryOutcomes(deliveries, {
    appliedRunIds: deliveries.map((delivery) => delivery.runId),
    deliverableArtifactIds: [artifactId],
  });
  const normalized = normalizeSavedOperatingReviews([workflow]);

  assert.equal(bounded.length, MAX_OPERATING_REVIEW_DELIVERIES);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].input.locale, "fr");
  assert.deepEqual(normalized[0].deliveries, []);
});
