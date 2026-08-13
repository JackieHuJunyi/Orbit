import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createRuneSurfaceRegistry } from "../app/lib/surface-registry.ts";

test("orders list contributions without mutating their input values", () => {
  const first = Object.freeze({ label: "first" });
  const second = Object.freeze({ label: "second" });
  const tied = Object.freeze({ label: "tied" });
  const registry = createRuneSurfaceRegistry([{ id: "toolbar", kind: "list" }]);
  registry.register({ id: "second", surface: "toolbar", order: 20, value: second });
  registry.register({ id: "first", surface: "toolbar", order: 10, value: first });
  registry.register({ id: "tied", surface: "toolbar", order: 20, value: tied });

  const entries = registry.entries("toolbar");
  assert.deepEqual(entries.map((entry) => entry.id), ["first", "second", "tied"]);
  assert.equal(entries[0].value, first);
  assert.equal(entries[1].value, second);
  assert.equal(Object.isFrozen(entries), true);
  assert.equal(Object.isFrozen(entries[0]), true);
});

test("disposes exactly the contribution that was registered", () => {
  const registry = createRuneSurfaceRegistry([{ id: "toolbar", kind: "list" }]);
  const disposeFirst = registry.register({ id: "first", surface: "toolbar", value: 1 });
  registry.register({ id: "second", surface: "toolbar", value: 2 });
  disposeFirst();
  disposeFirst();
  assert.deepEqual(registry.entries("toolbar").map((entry) => entry.value), [2]);
});

test("fails loud on undeclared, duplicate, malformed, and overfilled surfaces", () => {
  const registry = createRuneSurfaceRegistry([
    { id: "toolbar", kind: "list" },
    { id: "root", kind: "single" },
  ]);
  registry.register({ id: "files", surface: "toolbar", value: "files" });
  assert.throws(
    () => registry.register({ id: "files", surface: "toolbar", value: "duplicate" }),
    /already registered/,
  );
  assert.throws(
    () => registry.register({ id: "Bad id", surface: "toolbar", value: "bad" }),
    /lowercase kebab-case/,
  );
  assert.throws(
    () => registry.register({ id: "unknown", surface: "missing", value: "bad" }),
    /not declared/,
  );
  registry.register({ id: "shell", surface: "root", value: "shell" });
  assert.throws(
    () => registry.register({ id: "second-shell", surface: "root", value: "bad" }),
    /already has an occupant/,
  );
});

test("rejects duplicate surface definitions and non-finite order", () => {
  assert.throws(
    () => createRuneSurfaceRegistry([
      { id: "toolbar", kind: "list" },
      { id: "toolbar", kind: "single" },
    ]),
    /declared more than once/,
  );
  const registry = createRuneSurfaceRegistry([{ id: "toolbar", kind: "list" }]);
  assert.throws(
    () => registry.register({ id: "files", surface: "toolbar", order: Number.NaN, value: "bad" }),
    /invalid order/,
  );
});

test("keeps the registry outside React, browser, persistence, and network boundaries", async () => {
  const source = await readFile(new URL("../app/lib/surface-registry.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from ["']react|window\.|document\.|localStorage|indexedDB|fetch\(|setArtifacts|persist/i);
});
