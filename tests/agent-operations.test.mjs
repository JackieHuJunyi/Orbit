import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentOperationPatchSchema,
  AgentWorkspaceOperationPlanSchema,
} from "../app/lib/agent-contract.ts";
import {
  MAX_COMPILED_AGENT_SOURCE_CHARS,
  applyAgentSourceOperations,
  compileAgentOperationPatch,
  compileAgentWorkspaceOperations,
} from "../app/lib/agent-operations.ts";
import { parseDeckSource } from "../app/lib/deck.ts";
import { prepareWorkspacePatch } from "../app/lib/patches.ts";
import { defaultArtifacts, parseDataSource } from "../app/lib/workspace.ts";

function documentArtifact(source, id = "report") {
  return { id, name: `${id}.md`, kind: "document", language: "Markdown", source };
}

function dataArtifact(source, id = "data") {
  return { id, name: `${id}.csv`, kind: "data", language: "CSV / JSON", source };
}

function deckArtifact(source, id = "deck") {
  return { id, name: `${id}.deck.md`, kind: "slides", language: "Deck Markdown", source };
}

function operationPlan(edit, overrides = {}) {
  return AgentOperationPatchSchema.parse({
    summary: "Apply one reviewed change",
    detail: "The operation targets one exact artifact structure.",
    edits: [edit],
    ...overrides,
  });
}

const deckSource = `---
version: 1
title: Board update
theme: rune
ratio: 16:9
lang: en
---

<!-- layout: cover -->

# Opening

Original opening.

---

## Results

Original results.
`;

test("compiles one exact-text fallback into a concrete review source", () => {
  const artifact = documentArtifact("# Report\n\nThe old conclusion is unnecessarily verbose.\n\nEnd.");
  const plan = operationPlan({
    type: "replace_text",
    find: "The old conclusion is unnecessarily verbose.",
    replace: "The conclusion is concise.",
  });
  const compiled = compileAgentOperationPatch(artifact, plan);
  assert.deepEqual(compiled.errors, []);
  assert.equal(compiled.plan?.operationCount, 1);
  assert.equal(compiled.plan?.nextSource, "# Report\n\nThe conclusion is concise.\n\nEnd.");
  assert.match(artifact.source, /unnecessarily verbose/);
  assert.equal("edits" in (compiled.plan ?? {}), false);
});

test("applies ordered exact-text fallbacks against the evolving revision", () => {
  const compiled = applyAgentSourceOperations("alpha gamma", [
    { type: "replace_text", find: "alpha", replace: "beta" },
    { type: "replace_text", find: "beta gamma", replace: "delta" },
  ]);
  assert.deepEqual(compiled, { nextSource: "delta", errors: [] });

  const initiallyAmbiguous = applyAgentSourceOperations("one token one", [
    { type: "replace_text", find: "one token", replace: "two token" },
    { type: "replace_text", find: "one", replace: "three" },
  ]);
  assert.equal(initiallyAmbiguous.nextSource, "two token three");
  assert.deepEqual(initiallyAmbiguous.errors, []);
});

test("rejects missing, ambiguous, no-op, cancelling, and oversized exact fallbacks", () => {
  assert.match(applyAgentSourceOperations("same same", [
    { type: "replace_text", find: "same", replace: "new" },
  ]).errors[0], /ambiguous/i);
  assert.match(applyAgentSourceOperations("current", [
    { type: "replace_text", find: "missing", replace: "new" },
  ]).errors[0], /current source revision/i);
  assert.match(applyAgentSourceOperations("current", [
    { type: "replace_text", find: "current", replace: "current" },
  ]).errors[0], /does not change/i);
  assert.match(applyAgentSourceOperations("a", [
    { type: "replace_text", find: "a", replace: "b" },
    { type: "replace_text", find: "b", replace: "a" },
  ]).errors[0], /cancel out/i);
  assert.match(applyAgentSourceOperations("anchor", [{
    type: "replace_text",
    find: "anchor",
    replace: "x".repeat(MAX_COMPILED_AGENT_SOURCE_CHARS + 1),
  }]).errors[0], /120,000-character/i);
});

test("replaces one unique Markdown section without disturbing the next section", () => {
  const artifact = documentArtifact(`# Report

Intro.

## Summary

Old summary.

### Supporting detail

Old detail.

## Next

Keep this.
`);
  const compiled = compileAgentOperationPatch(artifact, operationPlan({
    type: "replace_markdown_section",
    heading: "Summary",
    body: "A concise summary with **evidence**.",
  }));
  assert.deepEqual(compiled.errors, []);
  assert.match(compiled.plan.nextSource, /## Summary\n\nA concise summary with \*\*evidence\*\*\./);
  assert.doesNotMatch(compiled.plan.nextSource, /Old detail/);
  assert.match(compiled.plan.nextSource, /## Next\n\nKeep this\./);
});

test("inserts a complete Markdown section after the targeted section", () => {
  const artifact = documentArtifact("# Report\n\n## Summary\n\nStable.\n\n## Next\n\nKeep this.\n");
  const compiled = compileAgentOperationPatch(artifact, operationPlan({
    type: "insert_markdown_section_after",
    heading: "Summary",
    section: "## Risks\n\n- One visible risk.",
  }));
  assert.deepEqual(compiled.errors, []);
  assert.ok(compiled.plan.nextSource.indexOf("## Summary") < compiled.plan.nextSource.indexOf("## Risks"));
  assert.ok(compiled.plan.nextSource.indexOf("## Risks") < compiled.plan.nextSource.indexOf("## Next"));

  const invalid = compileAgentOperationPatch(artifact, operationPlan({
    type: "insert_markdown_section_after",
    heading: "Summary",
    section: "This has no heading.",
  }));
  assert.match(invalid.errors.join(" "), /must start with its own heading/i);
});

test("rejects missing and duplicate Markdown headings", () => {
  const artifact = documentArtifact("# Report\n\n## Result\n\nOne.\n\n## Result\n\nTwo.");
  const ambiguous = compileAgentOperationPatch(artifact, operationPlan({
    type: "replace_markdown_section",
    heading: "Result",
    body: "Updated.",
  }));
  assert.match(ambiguous.errors.join(" "), /ambiguous/i);
  const missing = compileAgentOperationPatch(artifact, operationPlan({
    type: "replace_markdown_section",
    heading: "Missing",
    body: "Updated.",
  }));
  assert.match(missing.errors.join(" "), /not found/i);
});

test("ignores heading-like text inside fenced Markdown code", () => {
  const artifact = documentArtifact("# Report\n\n## Summary\n\nOld.\n\n```md\n## Summary\n```\n\n## Next\n\nKeep.");
  const compiled = compileAgentOperationPatch(artifact, operationPlan({
    type: "replace_markdown_section",
    heading: "Summary",
    body: "Updated.\n\n```md\n## Summary\n```",
  }));
  assert.deepEqual(compiled.errors, []);
  assert.match(compiled.plan.nextSource, /Updated\.\n\n```md\n## Summary\n```/);
  assert.match(compiled.plan.nextSource, /## Next\n\nKeep\./);
});

test("updates and inserts CSV rows by an exact typed key", () => {
  const artifact = dataArtifact("Region,Revenue,Approved\nAPAC,42,true\nEMEA,31,false\n");
  const updated = compileAgentOperationPatch(artifact, operationPlan({
    type: "upsert_data_row",
    keyColumn: "Region",
    keyValue: "APAC",
    cells: [
      { column: "Revenue", value: 48.5 },
      { column: "Approved", value: false },
    ],
  }));
  assert.deepEqual(updated.errors, []);
  const updatedData = parseDataSource(updated.plan.nextSource);
  assert.deepEqual(updatedData.rows, [
    { Region: "APAC", Revenue: 48.5, Approved: false },
    { Region: "EMEA", Revenue: 31, Approved: false },
  ]);

  const inserted = compileAgentOperationPatch(
    { ...artifact, source: updated.plan.nextSource },
    operationPlan({
      type: "upsert_data_row",
      keyColumn: "Region",
      keyValue: "LATAM",
      cells: [{ column: "Revenue", value: 19 }],
    }),
  );
  assert.deepEqual(inserted.errors, []);
  const insertedData = parseDataSource(inserted.plan.nextSource);
  assert.equal(insertedData.rows.length, 3);
  assert.deepEqual(insertedData.rows[2], { Region: "LATAM", Revenue: 19, Approved: null });
});

test("preserves typed flat JSON values and its array or object shape", () => {
  const arrayArtifact = dataArtifact('[{"id":1,"name":"Alpha","active":true,"note":null}]\n');
  const arrayUpdate = compileAgentOperationPatch(arrayArtifact, operationPlan({
    type: "upsert_data_row",
    keyColumn: "id",
    keyValue: 1,
    cells: [
      { column: "name", value: "Beta" },
      { column: "active", value: false },
      { column: "note", value: 7.5 },
    ],
  }));
  assert.deepEqual(arrayUpdate.errors, []);
  assert.deepEqual(JSON.parse(arrayUpdate.plan.nextSource), [{ id: 1, name: "Beta", active: false, note: 7.5 }]);
  assert.equal(arrayUpdate.plan.nextSource.endsWith("\n"), true);

  const objectArtifact = dataArtifact('{"id":"only","count":1,"active":true}');
  const objectUpdate = compileAgentOperationPatch(objectArtifact, operationPlan({
    type: "upsert_data_row",
    keyColumn: "id",
    keyValue: "only",
    cells: [{ column: "count", value: 2 }],
  }));
  assert.deepEqual(JSON.parse(objectUpdate.plan.nextSource), { id: "only", count: 2, active: true });
  const objectInsert = compileAgentOperationPatch(objectArtifact, operationPlan({
    type: "upsert_data_row",
    keyColumn: "id",
    keyValue: "second",
    cells: [{ column: "count", value: 2 }],
  }));
  assert.match(objectInsert.errors.join(" "), /single-object JSON/i);
});

test("rejects ambiguous keys, unknown or repeated cells, and nested JSON", () => {
  const duplicateKeys = dataArtifact("id,value\n1,a\n1,b");
  const ambiguous = compileAgentOperationPatch(duplicateKeys, operationPlan({
    type: "upsert_data_row",
    keyColumn: "id",
    keyValue: 1,
    cells: [{ column: "value", value: "c" }],
  }));
  assert.match(ambiguous.errors.join(" "), /ambiguous/i);

  const artifact = dataArtifact("id,value\n1,a");
  const unknown = compileAgentOperationPatch(artifact, operationPlan({
    type: "upsert_data_row",
    keyColumn: "id",
    keyValue: 1,
    cells: [{ column: "missing", value: "c" }],
  }));
  assert.match(unknown.errors.join(" "), /column not found/i);
  const repeated = compileAgentOperationPatch(artifact, operationPlan({
    type: "upsert_data_row",
    keyColumn: "id",
    keyValue: 1,
    cells: [{ column: "value", value: "b" }, { column: "value", value: "c" }],
  }));
  assert.match(repeated.errors.join(" "), /repeats column/i);
  const nested = compileAgentOperationPatch(dataArtifact('[{"id":1,"meta":{"region":"APAC"}}]'), operationPlan({
    type: "upsert_data_row",
    keyColumn: "id",
    keyValue: 1,
    cells: [{ column: "meta", value: "flat" }],
  }));
  assert.match(nested.errors.join(" "), /flat JSON/i);
});

test("requires a globally unique non-empty data key and keeps row identity fixed", () => {
  const duplicateElsewhere = dataArtifact("id,value\n1,a\n2,b\n2,c");
  const duplicate = compileAgentOperationPatch(duplicateElsewhere, operationPlan({
    type: "upsert_data_row",
    keyColumn: "id",
    keyValue: 1,
    cells: [{ column: "value", value: "updated" }],
  }));
  assert.match(duplicate.errors.join(" "), /not unique/i);

  const missingKey = compileAgentOperationPatch(dataArtifact("id,value\n1,a\n,b"), operationPlan({
    type: "upsert_data_row",
    keyColumn: "id",
    keyValue: 1,
    cells: [{ column: "value", value: "updated" }],
  }));
  assert.match(missingKey.errors.join(" "), /empty value/i);

  const artifact = dataArtifact("id,value\n1,a\n2,b");
  const renamed = compileAgentOperationPatch(artifact, operationPlan({
    type: "upsert_data_row",
    keyColumn: "id",
    keyValue: 1,
    cells: [{ column: "id", value: 3 }],
  }));
  assert.match(renamed.errors.join(" "), /cannot change the key/i);
  const noOp = compileAgentOperationPatch(artifact, operationPlan({
    type: "upsert_data_row",
    keyColumn: "id",
    keyValue: 1,
    cells: [{ column: "value", value: "a" }],
  }));
  assert.match(noOp.errors.join(" "), /does not change/i);
});

test("replaces and inserts Deck slides by an exact unique title", () => {
  const artifact = deckArtifact(deckSource);
  const replaced = compileAgentOperationPatch(artifact, operationPlan({
    type: "replace_deck_slide",
    title: "Results",
    slide: "<!-- layout: conclusion -->\n\n## Results\n\nReviewed result.",
  }));
  assert.deepEqual(replaced.errors, []);
  assert.match(replaced.plan.nextSource, /title: Board update/);
  assert.match(replaced.plan.nextSource, /# Opening\n\nOriginal opening\./);
  assert.match(replaced.plan.nextSource, /## Results\n\nReviewed result\./);
  assert.deepEqual(parseDeckSource(replaced.plan.nextSource).errors, []);

  const inserted = compileAgentOperationPatch(
    { ...artifact, source: replaced.plan.nextSource },
    operationPlan({
      type: "insert_deck_slide_after",
      title: "Opening",
      slide: "## Context\n\nVisible context.",
    }),
  );
  assert.deepEqual(inserted.errors, []);
  const deck = parseDeckSource(inserted.plan.nextSource).deck;
  assert.equal(deck.slides.length, 3);
  assert.match(deck.slides[1].source, /^## Context/);
  assert.match(deck.slides[2].source, /^## Results/);
});

test("rejects ambiguous Deck titles and separator injection", () => {
  const duplicate = deckArtifact(`${deckSource}\n---\n\n# Opening\n\nDuplicate.\n`);
  const ambiguous = compileAgentOperationPatch(duplicate, operationPlan({
    type: "replace_deck_slide",
    title: "Opening",
    slide: "# Opening\n\nUpdated.",
  }));
  assert.match(ambiguous.errors.join(" "), /ambiguous/i);
  const separator = compileAgentOperationPatch(deckArtifact(deckSource), operationPlan({
    type: "insert_deck_slide_after",
    title: "Opening",
    slide: "# Context\n\nOne.\n\n---\n\n# Injected",
  }));
  assert.match(separator.errors.join(" "), /cannot contain a slide separator/i);
});

test("rejects semantic operations on incompatible artifact kinds", () => {
  const cases = [
    [documentArtifact("# Report"), {
      type: "upsert_data_row", keyColumn: "id", keyValue: 1, cells: [{ column: "id", value: 1 }],
    }],
    [dataArtifact("id,value\n1,a"), {
      type: "replace_markdown_section", heading: "Summary", body: "Text.",
    }],
    [{ id: "legacy", name: "legacy.html", kind: "slides", language: "Semantic HTML", source: "<main></main>" }, {
      type: "replace_deck_slide", title: "Opening", slide: "# Opening\n\nText.",
    }],
  ];
  cases.forEach(([artifact, edit]) => {
    const compiled = compileAgentOperationPatch(artifact, operationPlan(edit));
    assert.match(compiled.errors.join(" "), /only supports/i);
  });
});

test("compiles one document-data-Deck plan atomically behind the workspace safety gate", () => {
  const document = documentArtifact("# Review\n\n## Summary\n\nOld.\n\n## Next\n\nKeep.", "review");
  const data = dataArtifact("Region,Revenue\nAPAC,42\nEMEA,31", "revenue");
  const deck = deckArtifact(deckSource, "briefing");
  const artifacts = [document, data, deck];
  const operationPlan = AgentWorkspaceOperationPlanSchema.parse({
    summary: "Coordinate the workspace",
    detail: "The review, operating row, and board slide receive one reviewable update.",
    patches: [
      {
        artifactId: document.id,
        summary: "Update the summary",
        detail: "One Markdown section changes.",
        edits: [{ type: "replace_markdown_section", heading: "Summary", body: "Shared result." }],
      },
      {
        artifactId: data.id,
        summary: "Update APAC",
        detail: "One typed data row changes.",
        edits: [{
          type: "upsert_data_row",
          keyColumn: "Region",
          keyValue: "APAC",
          cells: [{ column: "Revenue", value: 48 }],
        }],
      },
      {
        artifactId: deck.id,
        summary: "Update results",
        detail: "One Deck slide changes.",
        edits: [{ type: "replace_deck_slide", title: "Results", slide: "## Results\n\nShared result." }],
      },
    ],
  });
  const compiled = compileAgentWorkspaceOperations(artifacts, operationPlan);
  assert.deepEqual(compiled.errors, []);
  assert.deepEqual(compiled.plan.patches.map((patch) => patch.operationCount), [1, 1, 1]);
  const prepared = prepareWorkspacePatch(artifacts, compiled.plan.patches);
  assert.deepEqual(prepared.errors, []);
  assert.notEqual(prepared.nextArtifacts, artifacts);
  assert.match(prepared.nextArtifacts.find((artifact) => artifact.id === "review").source, /Shared result/);
  assert.equal(parseDataSource(prepared.nextArtifacts.find((artifact) => artifact.id === "revenue").source).rows[0].Revenue, 48);
  assert.match(prepared.nextArtifacts.find((artifact) => artifact.id === "briefing").source, /Shared result/);
});

test("rejects foreign and duplicate workspace files", () => {
  const artifacts = [documentArtifact("# Report\n\nOld.")];
  const patch = {
    artifactId: "report",
    summary: "Update report",
    detail: "One exact sentence changes.",
    edits: [{ type: "replace_text", find: "Old.", replace: "New." }],
  };
  const plan = AgentWorkspaceOperationPlanSchema.parse({
    summary: "Coordinate the workspace",
    detail: "One canonical source changes.",
    patches: [patch],
  });
  const invalid = compileAgentWorkspaceOperations(artifacts, {
    ...plan,
    patches: [plan.patches[0], plan.patches[0], { ...plan.patches[0], artifactId: "foreign" }],
  });
  assert.equal(invalid.plan, undefined);
  assert.match(invalid.errors.join(" "), /duplicate file patches/i);
  assert.match(invalid.errors.join(" "), /unknown artifact/i);
});

test("keeps compiled exact fallbacks behind the existing whole-workspace safety gate", () => {
  const query = defaultArtifacts.find((artifact) => artifact.kind === "query");
  const slides = defaultArtifacts.find((artifact) => artifact.kind === "slides");
  assert.ok(query);
  assert.ok(slides);
  const operationPlan = AgentWorkspaceOperationPlanSchema.parse({
    summary: "Attempt an unsafe coordinated change",
    detail: "The downstream transaction must reject both compiled files.",
    patches: [
      {
        artifactId: query.id,
        summary: "Mutate data",
        detail: "This operation must not pass the read-only query gate.",
        edits: [{ type: "replace_text", find: "SELECT", replace: "DELETE" }],
      },
      {
        artifactId: slides.id,
        summary: "Inject markup",
        detail: "This operation must not pass the Deck compiler gate.",
        edits: [{
          type: "replace_text",
          find: "# Growth became more durable.",
          replace: "# Growth became more durable.\n\n<script>alert(1)</script>",
        }],
      },
    ],
  });
  const compiled = compileAgentWorkspaceOperations(defaultArtifacts, operationPlan);
  assert.deepEqual(compiled.errors, []);
  assert.ok(compiled.plan);
  const prepared = prepareWorkspacePatch(defaultArtifacts, compiled.plan.patches);
  assert.match(prepared.errors.join(" "), /read-only|SELECT|WITH/i);
  assert.match(prepared.errors.join(" "), /raw HTML/i);
  assert.equal(prepared.nextArtifacts, defaultArtifacts);
});
