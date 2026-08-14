import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_CHECKPOINTS_PER_ARTIFACT,
  MAX_CHECKPOINT_SOURCE_CHARS,
  appendCheckpoint,
  canCheckpointSource,
  createCheckpoint,
  normalizeCheckpointMap,
} from "../app/lib/checkpoints.ts";

const artifact = { id: "report", source: "# Draft" };

test("creates an explicit checkpoint and deduplicates consecutive source", () => {
  const first = createCheckpoint(artifact, "Before Agent patch", "agent", new Date("2026-08-11T00:00:00Z"));
  const once = appendCheckpoint({}, first);
  const twice = appendCheckpoint(once, createCheckpoint(artifact, "Manual", "manual"));
  assert.equal(once.report.length, 1);
  assert.equal(twice, once);
  assert.equal(first.createdAt, "2026-08-11T00:00:00.000Z");
});

test("caps device history per artifact", () => {
  let history = {};
  for (let index = 0; index < MAX_CHECKPOINTS_PER_ARTIFACT + 3; index += 1) {
    history = appendCheckpoint(
      history,
      createCheckpoint(
        { id: "report", source: `revision-${index}` },
        `Revision ${index}`,
        "manual",
        new Date(1_700_000_000_000 + index),
      ),
    );
  }
  assert.equal(history.report.length, MAX_CHECKPOINTS_PER_ARTIFACT);
  assert.equal(history.report[0].source, "revision-3");
});

test("ignores malformed checkpoint storage", () => {
  const valid = createCheckpoint(artifact, "Manual", "manual", new Date("2026-08-11T00:00:00Z"));
  const normalized = normalizeCheckpointMap({ report: [null, { source: "bad" }, valid], wrong: "value" });
  assert.deepEqual(normalized.report, [valid]);
  assert.equal(normalized.wrong, undefined);
});

test("keeps oversized sources out of localStorage history", () => {
  const oversized = "x".repeat(MAX_CHECKPOINT_SOURCE_CHARS + 1);
  assert.equal(canCheckpointSource(oversized), false);
  const checkpoint = createCheckpoint({ id: "large", source: oversized }, "Large import", "manual");
  assert.deepEqual(appendCheckpoint({}, checkpoint), {});
});
