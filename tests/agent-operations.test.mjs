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
  validateCompiledSelectionPatch,
} from "../app/lib/agent-operations.ts";
import { parseChartSource } from "../app/lib/charts.ts";
import { parseDeckSource } from "../app/lib/deck.ts";
import { prepareWorkspaceMutation, prepareWorkspacePatch } from "../app/lib/patches.ts";
import { parseQueryDataSourceDirective } from "../app/lib/query-source.ts";
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

test("accepts compiled edits inside an exact selection and rejects every outside change", () => {
  const artifact = documentArtifact("# Report\n\nSelected conclusion.\n\nUntouched ending.");
  const start = artifact.source.indexOf("Selected conclusion.");
  const end = start + "Selected conclusion.".length;
  const selection = { start, end };
  const inside = compileAgentOperationPatch(artifact, operationPlan({
    type: "replace_text",
    find: "Selected conclusion.",
    replace: "Concise conclusion.",
  }));
  assert.deepEqual(inside.errors, []);
  assert.deepEqual(validateCompiledSelectionPatch(artifact, selection, inside.plan.nextSource), []);

  const outside = compileAgentOperationPatch(artifact, operationPlan({
    type: "replace_text",
    find: "Untouched ending.",
    replace: "Changed outside selection.",
  }));
  assert.deepEqual(outside.errors, []);
  assert.match(validateCompiledSelectionPatch(artifact, selection, outside.plan.nextSource).join(" "), /cross the selected source range/i);
  assert.match(validateCompiledSelectionPatch(artifact, { start: end, end: end }, inside.plan.nextSource).join(" "), /does not match the current artifact revision/i);
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

test("adds and updates a typed CSV column by exact unique row keys", () => {
  const artifact = dataArtifact("Region,Revenue\nAPAC,42\nEMEA,31\n");
  const added = compileAgentOperationPatch(artifact, operationPlan({
    type: "upsert_data_column",
    keyColumn: "Region",
    column: "Margin",
    values: [
      { keyValue: "APAC", value: 0.34 },
      { keyValue: "EMEA", value: 0.29 },
    ],
  }));
  assert.deepEqual(added.errors, []);
  assert.deepEqual(parseDataSource(added.plan.nextSource), {
    columns: ["Region", "Revenue", "Margin"],
    rows: [
      { Region: "APAC", Revenue: 42, Margin: 0.34 },
      { Region: "EMEA", Revenue: 31, Margin: 0.29 },
    ],
    errors: [],
    format: "CSV",
  });
  assert.equal(added.plan.nextSource.endsWith("\n"), true);

  const updated = compileAgentOperationPatch(
    { ...artifact, source: added.plan.nextSource },
    operationPlan({
      type: "upsert_data_column",
      keyColumn: "Region",
      column: "Revenue",
      values: [{ keyValue: "APAC", value: 48.5 }],
    }),
  );
  assert.deepEqual(updated.errors, []);
  assert.deepEqual(parseDataSource(updated.plan.nextSource).rows, [
    { Region: "APAC", Revenue: 48.5, Margin: 0.34 },
    { Region: "EMEA", Revenue: 31, Margin: 0.29 },
  ]);

  const empty = compileAgentOperationPatch(dataArtifact("Item,Value\n"), operationPlan({
    type: "upsert_data_column",
    keyColumn: "Item",
    column: "Status",
    values: [],
  }));
  assert.deepEqual(empty.errors, []);
  assert.deepEqual(parseDataSource(empty.plan.nextSource).columns, ["Item", "Value", "Status"]);
  assert.deepEqual(parseDataSource(empty.plan.nextSource).rows, []);
});

test("preserves flat JSON shape and scalar types for column upserts and renames", () => {
  const arrayArtifact = dataArtifact('[{"id":1,"name":"Alpha"},{"id":2,"name":"Beta"}]\n');
  const added = compileAgentOperationPatch(arrayArtifact, operationPlan({
    type: "upsert_data_column",
    keyColumn: "id",
    column: "active",
    values: [{ keyValue: 1, value: true }, { keyValue: 2, value: false }],
  }));
  assert.deepEqual(added.errors, []);
  assert.deepEqual(JSON.parse(added.plan.nextSource), [
    { id: 1, name: "Alpha", active: true },
    { id: 2, name: "Beta", active: false },
  ]);
  const renamed = compileAgentOperationPatch(
    { ...arrayArtifact, source: added.plan.nextSource },
    operationPlan({ type: "rename_data_column", column: "name", nextColumn: "label" }),
  );
  assert.deepEqual(renamed.errors, []);
  assert.deepEqual(JSON.parse(renamed.plan.nextSource), [
    { id: 1, label: "Alpha", active: true },
    { id: 2, label: "Beta", active: false },
  ]);
  assert.equal(renamed.plan.nextSource.endsWith("\n"), true);

  const objectArtifact = dataArtifact('{"id":"only","count":1}');
  const objectAdded = compileAgentOperationPatch(objectArtifact, operationPlan({
    type: "upsert_data_column",
    keyColumn: "id",
    column: "approved",
    values: [{ keyValue: "only", value: true }],
  }));
  assert.deepEqual(JSON.parse(objectAdded.plan.nextSource), { id: "only", count: 1, approved: true });
});

test("renames one exact CSV column while preserving order and exact header selection", () => {
  const artifact = dataArtifact("Region,Revenue,Approved\r\nAPAC,42,true\r\n");
  const renamed = compileAgentOperationPatch(artifact, operationPlan({
    type: "rename_data_column",
    column: "Revenue",
    nextColumn: "Net revenue",
  }));
  assert.deepEqual(renamed.errors, []);
  assert.deepEqual(parseDataSource(renamed.plan.nextSource).columns, ["Region", "Net revenue", "Approved"]);
  assert.equal(renamed.plan.nextSource.includes("\r\n"), true);
  assert.deepEqual(validateCompiledSelectionPatch(
    artifact,
    { start: 0, end: artifact.source.length },
    renamed.plan.nextSource,
  ), []);
  assert.deepEqual(validateCompiledSelectionPatch(
    artifact,
    { start: artifact.source.indexOf("Revenue"), end: artifact.source.indexOf("Revenue") + "Revenue".length },
    renamed.plan.nextSource,
  ), []);
});

test("rejects incomplete, ambiguous, fabricated, or no-op data-column operations", () => {
  const artifact = dataArtifact("id,value\n1,a\n2,b");
  const cases = [
    [
      { type: "upsert_data_column", keyColumn: "missing", column: "score", values: [{ keyValue: 1, value: 10 }, { keyValue: 2, value: 20 }] },
      /key column not found/i,
    ],
    [
      { type: "upsert_data_column", keyColumn: "id", column: "score", values: [{ keyValue: 1, value: 10 }] },
      /every current row/i,
    ],
    [
      { type: "upsert_data_column", keyColumn: "id", column: "score", values: [{ keyValue: 1, value: 10 }, { keyValue: 1, value: 11 }] },
      /repeats key/i,
    ],
    [
      { type: "upsert_data_column", keyColumn: "id", column: "score", values: [{ keyValue: 1, value: 10 }, { keyValue: 3, value: 30 }] },
      /row not found/i,
    ],
    [
      { type: "upsert_data_column", keyColumn: "id", column: "id", values: [{ keyValue: 1, value: 2 }] },
      /cannot change the key/i,
    ],
    [
      { type: "upsert_data_column", keyColumn: "id", column: "value", values: [] },
      /at least one keyed value/i,
    ],
    [
      { type: "upsert_data_column", keyColumn: "id", column: "value", values: [{ keyValue: 1, value: "a" }] },
      /does not change/i,
    ],
    [{ type: "rename_data_column", column: "missing", nextColumn: "next" }, /column not found/i],
    [{ type: "rename_data_column", column: "value", nextColumn: "id" }, /already exists/i],
    [{ type: "rename_data_column", column: "value", nextColumn: "value" }, /unchanged/i],
    [{ type: "rename_data_column", column: "value", nextColumn: " bad " }, /outer whitespace/i],
  ];
  cases.forEach(([edit, expected]) => {
    const compiled = compileAgentOperationPatch(artifact, operationPlan(edit));
    assert.match(compiled.errors.join(" "), expected);
  });

  const ambiguous = compileAgentOperationPatch(dataArtifact("id,value\n1,a\n1,b"), operationPlan({
    type: "upsert_data_column",
    keyColumn: "id",
    column: "score",
    values: [{ keyValue: 1, value: 10 }],
  }));
  assert.match(ambiguous.errors.join(" "), /not unique/i);
  const nested = compileAgentOperationPatch(dataArtifact('[{"id":1,"meta":{"score":2}}]'), operationPlan({
    type: "rename_data_column",
    column: "meta",
    nextColumn: "details",
  }));
  assert.match(nested.errors.join(" "), /flat JSON/i);
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
    [documentArtifact("# Report"), {
      type: "upsert_data_column", keyColumn: "id", column: "score", values: [{ keyValue: 1, value: 2 }],
    }],
    [documentArtifact("# Report"), {
      type: "rename_data_column", column: "old", nextColumn: "new",
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
    actions: [
      {
        type: "patch_artifact",
        artifactId: document.id,
        summary: "Update the summary",
        detail: "One Markdown section changes.",
        edits: [{ type: "replace_markdown_section", heading: "Summary", body: "Shared result." }],
      },
      {
        type: "patch_artifact",
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
        type: "patch_artifact",
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

test("compiles document, data, and Deck creations from Rune-owned templates", () => {
  const operationPlan = AgentWorkspaceOperationPlanSchema.parse({
    summary: "Create three Office-core artifacts",
    detail: "Every new file starts from a deterministic Rune template and bounded typed edits.",
    actions: [
      {
        type: "create_artifact",
        kind: "document",
        title: "Launch Brief",
        summary: "Create the brief",
        detail: "Fill the initial Markdown section.",
        edits: [{
          type: "replace_markdown_section",
          heading: "Launch Brief",
          body: "## Context\n\nVisible workspace facts only.",
        }],
      },
      {
        type: "create_artifact",
        kind: "data",
        title: "Launch Metrics",
        summary: "Create the data table",
        detail: "Replace the starter columns with a visible typed table.",
        edits: [{
          type: "replace_text",
          find: "Item,Value\n",
          replace: "Region,Revenue\nAPAC,48\nEMEA,31\n",
        }],
      },
      {
        type: "create_artifact",
        kind: "slides",
        title: "Launch Review",
        summary: "Create the presentation",
        detail: "Refine the cover and insert one complete slide.",
        edits: [
          { type: "replace_deck_slide", title: "Launch Review", slide: "# Launch Review\n\nA visible-source narrative." },
          { type: "insert_deck_slide_after", title: "Launch Review", slide: "## Decision\n\nProceed with review." },
        ],
      },
    ],
  });
  const compiled = compileAgentWorkspaceOperations(defaultArtifacts, operationPlan);
  assert.deepEqual(compiled.errors, []);
  assert.equal(compiled.plan.patches.length, 0);
  assert.deepEqual(compiled.plan.creations.map((creation) => creation.operationCount), [1, 1, 2]);
  assert.deepEqual(compiled.plan.creations.map((creation) => creation.artifact.name), [
    "launch-brief.md",
    "launch-metrics.csv",
    "launch-review.deck.md",
  ]);
  const prepared = prepareWorkspaceMutation(defaultArtifacts, compiled.plan.patches, compiled.plan.creations);
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.nextArtifacts.length, defaultArtifacts.length + 3);
  assert.match(prepared.nextArtifacts.at(-1).source, /## Decision/);
});

test("compiles zero-edit Query and Chart creations from exact visible bindings", () => {
  const operationPlan = AgentWorkspaceOperationPlanSchema.parse({
    summary: "Create source-first analysis artifacts",
    detail: "Rune owns both file identities and complete typed starter sources.",
    actions: [
      {
        type: "create_artifact",
        kind: "query",
        title: "Regional Detail",
        sourceArtifactId: "regional-revenue",
        summary: "Create a bound Query",
        detail: "Read the complete exact Data source through workspace_data.",
        edits: [],
      },
      {
        type: "create_artifact",
        kind: "chart",
        title: "Regional Margin",
        sourceArtifactId: "regional-analysis",
        category: "Region",
        value: "margin_pct",
        mark: "bar",
        format: "percent",
        summary: "Create a bound Chart",
        detail: "Use exact current Query output fields.",
        edits: [],
      },
    ],
  });
  const compiled = compileAgentWorkspaceOperations(defaultArtifacts, operationPlan);
  assert.deepEqual(compiled.errors, []);
  assert.deepEqual(compiled.plan.creations.map((creation) => creation.operationCount), [0, 0]);
  assert.deepEqual(compiled.plan.creations.map((creation) => creation.artifact.name), [
    "regional-detail.sql",
    "regional-margin-2.chart.json",
  ]);
  assert.deepEqual(parseQueryDataSourceDirective(compiled.plan.creations[0].artifact.source), {
    artifactId: "regional-revenue",
    explicit: true,
    errors: [],
  });
  assert.deepEqual(parseChartSource(compiled.plan.creations[1].artifact.source).spec, {
    version: 1,
    title: "Regional Margin",
    description: "",
    source: "regional-analysis",
    mark: "bar",
    category: "Region",
    value: "margin_pct",
    sort: "descending",
    format: "percent",
    color: "#ff5c35",
    maxItems: 8,
  });
  const prepared = prepareWorkspaceMutation(defaultArtifacts, [], compiled.plan.creations);
  assert.deepEqual(prepared.errors, []);
});

test("rejects invented or same-plan creation sources before identity guessing", () => {
  const invented = compileAgentWorkspaceOperations(defaultArtifacts, {
    summary: "Invent a binding",
    detail: "The model must not invent source identities.",
    actions: [{
      type: "create_artifact",
      kind: "query",
      title: "Unsafe Query",
      sourceArtifactId: "invented-data",
      summary: "Create unsafe Query",
      detail: "This source is not visible.",
      edits: [],
    }],
  });
  assert.equal(invented.plan, undefined);
  assert.match(invented.errors.join(" "), /exact existing artifacts from visible context/i);

  const samePlan = compileAgentWorkspaceOperations(defaultArtifacts, {
    summary: "Guess a generated identity",
    detail: "A dependent creation must wait until Rune exposes the generated id.",
    actions: [
      {
        type: "create_artifact",
        kind: "data",
        title: "Forecast Data",
        summary: "Create Data",
        detail: "Use the typed starter source.",
        edits: [],
      },
      {
        type: "create_artifact",
        kind: "query",
        title: "Forecast Query",
        sourceArtifactId: "forecast-data",
        summary: "Create Query",
        detail: "This guesses a same-plan id.",
        edits: [],
      },
    ],
  });
  assert.equal(samePlan.plan, undefined);
  assert.match(samePlan.errors.join(" "), /exact existing artifacts from visible context/i);

  const samePlanEmbed = compileAgentWorkspaceOperations(defaultArtifacts, {
    summary: "Guess a generated Chart identity",
    detail: "A patch must not bind to a Chart before Rune has exposed its actual id.",
    actions: [
      {
        type: "patch_artifact",
        artifactId: "q2-review",
        summary: "Embed a guessed Chart",
        detail: "This patch guesses the id produced by a later creation.",
        edits: [{
          type: "replace_text",
          find: "## Next actions",
          replace: "## Forecast\n\n{{ chart(\"forecast-chart\") }}\n\n## Next actions",
        }],
      },
      {
        type: "create_artifact",
        kind: "chart",
        title: "Forecast Chart",
        sourceArtifactId: "regional-revenue",
        category: "Region",
        value: "Q2 Revenue",
        mark: "line",
        format: "currency",
        summary: "Create the Chart",
        detail: "Use one exact visible Data source.",
        edits: [],
      },
    ],
  });
  assert.equal(samePlanEmbed.plan, undefined);
  assert.match(samePlanEmbed.errors.join(" "), /patch cannot reference.*same-plan creation/i);
});

test("resolves repeated creation titles and rejects incompatible creation operations", () => {
  const creation = {
    type: "create_artifact",
    kind: "document",
    title: "Shared Brief",
    summary: "Create a brief",
    detail: "Fill the deterministic document template.",
    edits: [{ type: "replace_markdown_section", heading: "Shared Brief", body: "Visible context." }],
  };
  const repeated = compileAgentWorkspaceOperations(defaultArtifacts, {
    summary: "Create two briefs",
    detail: "Rune must resolve both identities without model-authored ids.",
    actions: [creation, creation],
  });
  assert.deepEqual(repeated.errors, []);
  assert.deepEqual(repeated.plan.creations.map((item) => item.artifact.id), ["shared-brief", "shared-brief-2"]);
  assert.deepEqual(repeated.plan.creations.map((item) => item.artifact.name), ["shared-brief.md", "shared-brief-2.md"]);

  const incompatible = compileAgentWorkspaceOperations(defaultArtifacts, {
    summary: "Use the wrong operation",
    detail: "A data template cannot accept a Markdown section edit.",
    actions: [{
      ...creation,
      kind: "data",
      title: "Wrong Table",
    }],
  });
  assert.equal(incompatible.plan, undefined);
  assert.match(incompatible.errors.join(" "), /only supports Markdown documents/i);
});

test("keeps mixed patch-and-create plans atomic at the full-workspace safety gate", () => {
  const report = defaultArtifacts.find((artifact) => artifact.kind === "document");
  assert.ok(report);
  const compiled = compileAgentWorkspaceOperations(defaultArtifacts, AgentWorkspaceOperationPlanSchema.parse({
    summary: "Update the report and create a deck",
    detail: "One existing source and one Rune-owned new source form a single transaction.",
    actions: [
      {
        type: "patch_artifact",
        artifactId: report.id,
        summary: "Add a launch note",
        detail: "Append one exact visible note.",
        edits: [{ type: "replace_text", find: "## Next actions", replace: "## Launch note\n\nShared context.\n\n## Next actions" }],
      },
      {
        type: "create_artifact",
        kind: "slides",
        title: "Unsafe Briefing",
        summary: "Create an unsafe deck",
        detail: "The final safety gate must reject raw HTML.",
        edits: [{
          type: "replace_deck_slide",
          title: "Unsafe Briefing",
          slide: "# Unsafe Briefing\n\n<script>alert(1)</script>",
        }],
      },
    ],
  }));
  assert.deepEqual(compiled.errors, []);
  const prepared = prepareWorkspaceMutation(defaultArtifacts, compiled.plan.patches, compiled.plan.creations);
  assert.match(prepared.errors.join(" "), /raw HTML/i);
  assert.equal(prepared.nextArtifacts, defaultArtifacts);
});

test("rejects foreign and duplicate workspace files", () => {
  const artifacts = [documentArtifact("# Report\n\nOld.")];
  const patch = {
    type: "patch_artifact",
    artifactId: "report",
    summary: "Update report",
    detail: "One exact sentence changes.",
    edits: [{ type: "replace_text", find: "Old.", replace: "New." }],
  };
  const plan = AgentWorkspaceOperationPlanSchema.parse({
    summary: "Coordinate the workspace",
    detail: "One canonical source changes.",
    actions: [patch],
  });
  const invalid = compileAgentWorkspaceOperations(artifacts, {
    ...plan,
    actions: [plan.actions[0], plan.actions[0], { ...plan.actions[0], artifactId: "foreign" }],
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
    actions: [
      {
        type: "patch_artifact",
        artifactId: query.id,
        summary: "Mutate data",
        detail: "This operation must not pass the read-only query gate.",
        edits: [{ type: "replace_text", find: "SELECT", replace: "DELETE" }],
      },
      {
        type: "patch_artifact",
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
