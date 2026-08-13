import assert from "node:assert/strict";
import test from "node:test";

import {
  clampWorkspaceSourcePercent,
  DEFAULT_WORKSPACE_SOURCE_PERCENT,
  MAX_WORKSPACE_SOURCE_PERCENT,
  MIN_WORKSPACE_SOURCE_PERCENT,
  normalizeWorkspaceSourcePercent,
  RUNE_WORKSPACE_SPLIT_STORAGE_KEY,
  workspaceSplitTracks,
} from "../app/lib/workspace-layout.ts";

test("keeps a bounded source/preview split as presentation-only local state", () => {
  assert.equal(RUNE_WORKSPACE_SPLIT_STORAGE_KEY, "rune-workspace-split-v1");
  assert.equal(DEFAULT_WORKSPACE_SOURCE_PERCENT, 47);
  assert.equal(clampWorkspaceSourcePercent(-10), MIN_WORKSPACE_SOURCE_PERCENT);
  assert.equal(clampWorkspaceSourcePercent(90), MAX_WORKSPACE_SOURCE_PERCENT);
  assert.equal(clampWorkspaceSourcePercent(Number.NaN), DEFAULT_WORKSPACE_SOURCE_PERCENT);
  assert.equal(clampWorkspaceSourcePercent(48.26), 48.3);
});

test("rejects corrupt persisted split values and emits complementary grid tracks", () => {
  assert.equal(normalizeWorkspaceSourcePercent("52.4"), 52.4);
  assert.equal(normalizeWorkspaceSourcePercent("100"), null);
  assert.equal(normalizeWorkspaceSourcePercent("not-a-number"), null);
  assert.equal(normalizeWorkspaceSourcePercent({}), null);
  assert.deepEqual(workspaceSplitTracks(44.5), { source: "44.5fr", preview: "55.5fr" });
});
