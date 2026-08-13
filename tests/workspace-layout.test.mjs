import assert from "node:assert/strict";
import test from "node:test";

import {
  clampWorkspaceSourcePercent,
  DEFAULT_WORKSPACE_SOURCE_PERCENT,
  MAX_WORKSPACE_SOURCE_PERCENT,
  MIN_WORKSPACE_SOURCE_PERCENT,
  normalizeWorkspaceSourcePercent,
  normalizeRuneWorkspaceView,
  RUNE_WORKSPACE_SPLIT_STORAGE_KEY,
  RUNE_WORKSPACE_VIEW_STORAGE_KEY,
  RUNE_WORKSPACE_VIEWS,
  workspaceViewFromKeyboardShortcut,
  workspaceSplitTracks,
} from "../app/lib/workspace-layout.ts";

test("keeps a bounded source/preview split as presentation-only local state", () => {
  assert.equal(RUNE_WORKSPACE_SPLIT_STORAGE_KEY, "rune-workspace-split-v2");
  assert.equal(RUNE_WORKSPACE_VIEW_STORAGE_KEY, "rune-workspace-view-v1");
  assert.equal(DEFAULT_WORKSPACE_SOURCE_PERCENT, 44);
  assert.equal(clampWorkspaceSourcePercent(-10), MIN_WORKSPACE_SOURCE_PERCENT);
  assert.equal(clampWorkspaceSourcePercent(90), MAX_WORKSPACE_SOURCE_PERCENT);
  assert.equal(clampWorkspaceSourcePercent(Number.NaN), DEFAULT_WORKSPACE_SOURCE_PERCENT);
  assert.equal(clampWorkspaceSourcePercent(48.26), 48.3);
});

test("accepts only the three explicit presentation views", () => {
  assert.deepEqual(RUNE_WORKSPACE_VIEWS, ["split", "source", "preview"]);
  for (const view of RUNE_WORKSPACE_VIEWS) assert.equal(normalizeRuneWorkspaceView(view), view);
  assert.equal(normalizeRuneWorkspaceView("focus"), null);
  assert.equal(normalizeRuneWorkspaceView(null), null);
});

test("maps one explicit cross-platform shortcut family to presentation views", () => {
  const shortcut = (code, overrides = {}) => workspaceViewFromKeyboardShortcut({
    altKey: true,
    code,
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    ...overrides,
  });
  assert.equal(shortcut("Digit1"), "split");
  assert.equal(shortcut("Digit2", { ctrlKey: false, metaKey: true }), "source");
  assert.equal(shortcut("Digit3"), "preview");
  assert.equal(shortcut("Digit4"), null);
  assert.equal(shortcut("Digit1", { altKey: false }), null);
  assert.equal(shortcut("Digit1", { shiftKey: true }), null);
  assert.equal(shortcut("Digit1", { ctrlKey: false }), null);
});

test("rejects corrupt persisted split values and emits complementary grid tracks", () => {
  assert.equal(normalizeWorkspaceSourcePercent("52.4"), 52.4);
  assert.equal(normalizeWorkspaceSourcePercent("100"), null);
  assert.equal(normalizeWorkspaceSourcePercent("not-a-number"), null);
  assert.equal(normalizeWorkspaceSourcePercent({}), null);
  assert.deepEqual(workspaceSplitTracks(44.5), { source: "44.5fr", preview: "55.5fr" });
});
