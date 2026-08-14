import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createRuneArtifactAdapterRegistry } from "../app/lib/artifact-adapter-registry.ts";
import {
  artifactAdapterRegistry,
  artifactStats,
  defaultArtifacts,
  detectArtifact,
  quickCommands,
  validateArtifact,
} from "../app/lib/workspace.ts";

function adapter(kind, order, extension = `.${kind}`) {
  return {
    kind,
    order,
    creation: { label: kind, format: kind, extension, description: kind },
    quickCommands: [`create ${kind}`],
    detectLanguage: (name) => name.endsWith(extension) ? kind : null,
    starterSource: ({ title }) => `${kind}:${title}`,
    validate: () => [],
    stats: () => `${kind} stats`,
  };
}

test("requires one immutable adapter for every declared artifact kind", () => {
  const registry = createRuneArtifactAdapterRegistry(
    ["document", "data"],
    [adapter("data", 20), adapter("document", 10)],
  );
  assert.deepEqual(registry.all().map((entry) => entry.kind), ["document", "data"]);
  assert.equal(Object.isFrozen(registry.all()), true);
  assert.equal(Object.isFrozen(registry.forKind("document")), true);
  assert.equal(Object.isFrozen(registry.forKind("document").creation), true);
  assert.equal(Object.isFrozen(registry.forKind("document").quickCommands), true);
  assert.deepEqual(registry.detect("notes.document", ""), {
    kind: "document",
    language: "document",
  });
});

test("fails loud on missing, duplicate, unknown, malformed, and non-finite adapters", () => {
  assert.throws(
    () => createRuneArtifactAdapterRegistry(["document", "data"], [adapter("document", 10)]),
    /adapter "data" is missing/,
  );
  assert.throws(
    () => createRuneArtifactAdapterRegistry(
      ["document"],
      [adapter("document", 10), adapter("document", 20)],
    ),
    /registered more than once/,
  );
  assert.throws(
    () => createRuneArtifactAdapterRegistry(["document"], [adapter("data", 10)]),
    /not a declared kind/,
  );
  assert.throws(
    () => createRuneArtifactAdapterRegistry(["document"], [adapter("document", Number.NaN)]),
    /invalid order/,
  );
  assert.throws(
    () => createRuneArtifactAdapterRegistry(["document"], [adapter("document", 10, "md")]),
    /dotted extension/,
  );
});

test("production adapters own the complete kind order and preserve specialized detection precedence", () => {
  assert.deepEqual(
    artifactAdapterRegistry.all().map((entry) => entry.kind),
    ["document", "data", "query", "chart", "slides"],
  );
  assert.deepEqual(detectArtifact("briefing.deck.md", "") && {
    kind: detectArtifact("briefing.deck.md", "").kind,
    language: detectArtifact("briefing.deck.md", "").language,
  }, { kind: "slides", language: "Deck Markdown" });
  assert.deepEqual(detectArtifact("growth.chart.json", "{}") && {
    kind: detectArtifact("growth.chart.json", "{}").kind,
    language: detectArtifact("growth.chart.json", "{}").language,
  }, { kind: "chart", language: "Chart JSON" });
  assert.equal(detectArtifact("notes.md", "# Notes").kind, "document");
  assert.equal(detectArtifact("rows.json", "[]").kind, "data");
  assert.equal(detectArtifact("page.txt", "text"), null);
});

test("production validation, stats, and quick actions route through every adapter", () => {
  assert.equal(Object.isFrozen(quickCommands), true);
  for (const adapter of artifactAdapterRegistry.all()) {
    const artifact = defaultArtifacts.find((candidate) => candidate.kind === adapter.kind);
    assert.ok(artifact, `missing fixture for ${adapter.kind}`);
    assert.deepEqual(validateArtifact(artifact), []);
    assert.equal(artifactStats(artifact), adapter.stats(artifact));
    assert.deepEqual(quickCommands[adapter.kind], [...adapter.quickCommands]);
    assert.equal(Object.isFrozen(quickCommands[adapter.kind]), true);
  }
});

test("keeps the generic registry outside React, browser, persistence, and network boundaries", async () => {
  const source = await readFile(new URL("../app/lib/artifact-adapter-registry.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from ["']react|window\.|document\.|localStorage|indexedDB|fetch\(|setArtifacts|persist/i);
});

test("keeps preview dispatch exhaustive without putting React into the domain registry", async () => {
  const source = await readFile(new URL("../app/components/artifact-previews.tsx", import.meta.url), "utf8");
  assert.match(source, /Record<WorkspaceArtifact\["kind"\], \(\) => ReactNode>/);
  for (const kind of ["document", "data", "query", "chart", "slides"]) {
    assert.match(source, new RegExp(`\\n\\s{6}${kind}: \\(\\) =>`));
  }
  assert.match(source, /content = previewRenderers\[artifact\.kind\]\(\);/);
});
