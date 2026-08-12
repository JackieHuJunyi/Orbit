import assert from "node:assert/strict";
import test from "node:test";

import {
  createRuneGuideArtifact,
  detectPreferredLocale,
  localeDisplayName,
  normalizeRuneLocale,
  RUNE_GUIDE_ID,
} from "../app/lib/localization.ts";
import { validateArtifact } from "../app/lib/workspace.ts";

test("detects Chinese from any preferred device language and otherwise uses English", () => {
  assert.equal(detectPreferredLocale(["en-US", "zh-Hans-CN"]), "zh-CN");
  assert.equal(detectPreferredLocale(["zh-Hant"]), "zh-CN");
  assert.equal(detectPreferredLocale(["fr-FR", "en-GB"]), "en");
  assert.equal(detectPreferredLocale([]), "en");
});

test("normalizes only supported Rune interface locales", () => {
  assert.equal(normalizeRuneLocale("zh-CN"), "zh-CN");
  assert.equal(normalizeRuneLocale("en"), "en");
  assert.equal(normalizeRuneLocale("en-US"), null);
  assert.equal(normalizeRuneLocale(null), null);
  assert.equal(localeDisplayName("zh-CN"), "简体中文");
});

test("creates a valid editable local guide in the selected language", () => {
  const chinese = createRuneGuideArtifact("zh-CN");
  const english = createRuneGuideArtifact("en");
  assert.equal(chinese.id, RUNE_GUIDE_ID);
  assert.equal(english.id, RUNE_GUIDE_ID);
  assert.match(chinese.source, /欢迎使用 Rune/);
  assert.match(english.source, /Welcome to Rune/);
  assert.match(chinese.source, /⌘ Enter/);
  assert.deepEqual(validateArtifact(chinese), []);
  assert.deepEqual(validateArtifact(english), []);
});

