import assert from "node:assert/strict";
import test from "node:test";

import {
  PORTABLE_SOURCE_REVISION_PATTERN,
  portableSourceRevision,
} from "../app/lib/source-revision.ts";

test("creates a stable bounded UTF-8 source change token", () => {
  assert.equal(portableSourceRevision("Rune"), portableSourceRevision("Rune"));
  assert.equal(portableSourceRevision("hello"), "r1-5-a430d84680aabd0b");
  assert.match(portableSourceRevision("Rune"), PORTABLE_SOURCE_REVISION_PATTERN);
  assert.match(portableSourceRevision("你好，Rune"), PORTABLE_SOURCE_REVISION_PATTERN);
  assert.notEqual(portableSourceRevision("Rune"), portableSourceRevision("rune"));
  assert.notEqual(portableSourceRevision("é"), portableSourceRevision("e\u0301"));
});

test("includes UTF-8 byte length and never mutates the source", () => {
  const source = "你好";
  const before = source;
  assert.match(portableSourceRevision(source), /^r1-6-/u);
  assert.equal(source, before);
});
