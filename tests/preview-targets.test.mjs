import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveDataPreviewSourceTargets,
  deriveDocumentBlockPreviewSourceTargets,
  derivePreviewSourceTargets,
  deriveSourceLinkedPreviewTargets,
  previewTargetIsActive,
  resolveDataCellPreviewTarget,
  resolveDataRowPreviewTarget,
  resolveSourceLinkedPreviewTarget,
} from "../app/lib/preview-targets.ts";
import { resolveChartModel } from "../app/lib/charts.ts";
import { parseDataSource } from "../app/lib/workspace.ts";

function artifact(kind, language, name, source) {
  return { id: "target", kind, language, name, source };
}

test("maps visible Markdown sections to exact non-overlapping canonical source ranges", () => {
  const source = `Intro before headings.

# Report

Opening note.

## Findings

One result.

\`\`\`md
## Not a visible section
\`\`\`

## Decision

Proceed.
`;
  const targets = derivePreviewSourceTargets(artifact("document", "Markdown", "report.md", source));

  assert.deepEqual(targets.map((target) => target.label), ["Document preamble", "Report", "Findings", "Decision"]);
  assert.equal(source.slice(targets[0].start, targets[0].end), "Intro before headings.");
  assert.match(source.slice(targets[2].start, targets[2].end), /^## Findings/);
  assert.match(source.slice(targets[2].start, targets[2].end), /Not a visible section/);
  assert.equal(targets.every((target, index) => index === 0 || target.start >= targets[index - 1].end), true);
  assert.equal(previewTargetIsActive(targets[2], { start: targets[2].start, end: targets[2].end }), true);
  assert.equal(previewTargetIsActive(targets[2], targets[2]), true);
  assert.equal(previewTargetIsActive(targets[1], targets[2]), false);
});

test("maps rendered Markdown blocks through the same CommonMark and GFM grammar", () => {
  const source = `# Report

Opening **note** with {{ metric("total_revenue") }}.

- First item
  - Nested item
- Second item

> A quoted decision.
>
> With a second paragraph.

~~~md
## Not a heading
~~~

| Region | Revenue |
| --- | ---: |
| APAC | 42 |

---
`;
  const targets = deriveDocumentBlockPreviewSourceTargets(artifact("document", "Markdown", "report.md", source));

  assert.deepEqual(targets.map((target) => target.blockType), [
    "heading", "paragraph", "list", "quote", "code", "table", "rule",
  ]);
  assert.equal(targets[0].headingLevel, 1);
  assert.equal(targets[1].headingLevel, undefined);
  assert.deepEqual(targets.map((target) => source.slice(target.start, target.end)), [
    "# Report",
    'Opening **note** with {{ metric("total_revenue") }}.',
    "- First item\n  - Nested item\n- Second item",
    "> A quoted decision.\n>\n> With a second paragraph.",
    "~~~md\n## Not a heading\n~~~",
    "| Region | Revenue |\n| --- | ---: |\n| APAC | 42 |",
    "---",
  ]);
  assert.match(targets[1].label, /Opening note with live value/u);
  assert.equal(targets.every((target, index) => index === 0 || target.start > targets[index - 1].end), true);
});

test("withholds Document block targets for non-Document or empty source", () => {
  assert.deepEqual(deriveDocumentBlockPreviewSourceTargets(artifact("data", "CSV", "data.csv", "A\n1")), []);
  assert.deepEqual(deriveDocumentBlockPreviewSourceTargets(artifact("document", "Markdown", "empty.md", " \n")), []);
});

test("leaves standalone or inline Chart bindings to their own provenance-aware preview", () => {
  const source = `# Report

Before.

{{ chart("regional-revenue-chart") }}

After {{ chart("regional-margin-chart") }}.`;
  const targets = deriveDocumentBlockPreviewSourceTargets(artifact("document", "Markdown", "report.md", source));
  assert.deepEqual(targets.map((target) => target.label), ["Report", "Before."]);
  assert.equal(targets.some((target) => source.slice(target.start, target.end).includes("chart(")), false);
});

test("links a source caret or contained selection to the smallest proven Document target", () => {
  const source = `# Report

Opening note.

Second paragraph.

## Decision

Proceed.`;
  const document = artifact("document", "Markdown", "report.md", source);
  const openingStart = source.indexOf("Opening");
  const opening = resolveSourceLinkedPreviewTarget(document, {
    start: openingStart + 3,
    end: openingStart + 3,
  });
  assert.equal(opening?.kind, "document-block");
  assert.equal(opening?.label, "Opening note.");

  const partial = resolveSourceLinkedPreviewTarget(document, {
    start: openingStart,
    end: openingStart + "Opening".length,
  });
  assert.equal(partial?.id, opening?.id);

  const secondStart = source.indexOf("Second paragraph");
  const boundary = resolveSourceLinkedPreviewTarget(document, {
    start: secondStart,
    end: secondStart,
  });
  assert.equal(boundary?.kind, "document-block");
  assert.equal(boundary?.label, "Second paragraph.");

  const openingEnd = openingStart + "Opening note.".length;
  const endBoundary = resolveSourceLinkedPreviewTarget(document, {
    start: openingEnd,
    end: openingEnd,
  });
  assert.equal(endBoundary?.id, opening?.id);

  const reportSection = derivePreviewSourceTargets(document)[0];
  const exactSection = resolveSourceLinkedPreviewTarget(document, reportSection);
  assert.equal(exactSection?.kind, "document-section");
  assert.equal(exactSection?.label, "Report");

  const blankLine = source.indexOf("\n\nSecond") + 1;
  const sectionOnly = resolveSourceLinkedPreviewTarget(document, { start: blankLine, end: blankLine });
  assert.equal(sectionOnly?.kind, "document-section");
  assert.equal(sectionOnly?.label, "Report");

  const crossSection = resolveSourceLinkedPreviewTarget(document, {
    start: openingStart,
    end: source.indexOf("Proceed") + "Proceed".length,
  });
  assert.equal(crossSection, null);
});

test("links Data source positions to cells before rows without guessing invalid ranges", () => {
  const source = "Region,Revenue\nAPAC,42\nEMEA,31";
  const data = artifact("data", "CSV / JSON", "regions.csv", source);
  const valueStart = source.indexOf("42");
  const cell = resolveSourceLinkedPreviewTarget(data, { start: valueStart, end: valueStart });
  assert.equal(cell?.kind, "data-cell");
  assert.equal(cell?.label, "Row 1 · Revenue");

  const targets = deriveDataPreviewSourceTargets(data);
  const row = resolveSourceLinkedPreviewTarget(data, targets.rows[0]);
  assert.equal(row?.kind, "data-row");
  assert.equal(row?.label, "Row 1 · APAC");
  assert.equal(deriveSourceLinkedPreviewTargets(data).length, targets.cells.length + targets.rows.length);

  const crossCells = resolveSourceLinkedPreviewTarget(data, {
    start: source.indexOf("APAC"),
    end: valueStart + 2,
  }, [...targets.cells, ...targets.rows]);
  assert.equal(crossCells?.kind, "data-row");

  assert.equal(resolveSourceLinkedPreviewTarget(data, { start: -1, end: 0 }), null);
  assert.equal(resolveSourceLinkedPreviewTarget(data, { start: 8, end: 7 }), null);
  assert.equal(resolveSourceLinkedPreviewTarget(
    artifact("data", "CSV / JSON", "unicode.csv", "Name\n😀"),
    { start: 6, end: 6 },
  ), null);
});

test("links Deck and Chart source while leaving Query source without a false visual target", () => {
  const deckSource = `---
version: 1
title: Briefing
theme: rune
ratio: 16:9
lang: en
---

# Opening

Start here.`;
  const deck = artifact("slides", "Deck Markdown", "briefing.deck.md", deckSource);
  const slide = resolveSourceLinkedPreviewTarget(deck, {
    start: deckSource.indexOf("Start here") + 2,
    end: deckSource.indexOf("Start here") + 2,
  });
  assert.equal(slide?.kind, "deck-slide");

  const chartSource = JSON.stringify({
    version: 1,
    title: "Revenue",
    description: "",
    source: "regions",
    mark: "bar",
    category: "Region",
    value: "Revenue",
    sort: "source",
    format: "number",
    color: "#ff5c35",
    maxItems: 8,
  });
  const chart = resolveSourceLinkedPreviewTarget(
    artifact("chart", "Chart JSON", "revenue.chart.json", chartSource),
    { start: chartSource.indexOf("Revenue"), end: chartSource.indexOf("Revenue") },
  );
  assert.equal(chart?.kind, "chart-spec");

  assert.equal(resolveSourceLinkedPreviewTarget(
    artifact("query", "DuckDB SQL", "report.sql", "SELECT * FROM workspace_data"),
    { start: 4, end: 4 },
  ), null);
});

test("maps quoted multiline CSV records to the exact row source", () => {
  const source = `Region,Status,Note\r\nAPAC,Ready,"Line one\r\nLine two"\r\n,,\r\nEMEA,Review,Owner pending\r\n`;
  const targets = derivePreviewSourceTargets(artifact("data", "CSV / JSON", "regions.csv", source));

  assert.equal(targets.length, 2);
  assert.equal(targets[0].label, "Row 1 · APAC");
  assert.equal(source.slice(targets[0].start, targets[0].end), `APAC,Ready,"Line one\r\nLine two"`);
  assert.equal(source.slice(targets[1].start, targets[1].end), "EMEA,Review,Owner pending");
});

test("maps non-empty CSV cells without losing quotes, commas, or multiline source", () => {
  const source = `Region,Status,Note\r\nAPAC,Ready,"Line one, ""exact""\r\nLine two"\r\n,,\r\nEMEA,Review,Owner pending\r\n`;
  const targets = deriveDataPreviewSourceTargets(artifact("data", "CSV / JSON", "regions.csv", source));

  assert.equal(targets.rows.length, 2);
  assert.equal(targets.cells.length, 6);
  const note = targets.cells.find((target) => target.rowIndex === 0 && target.column === "Note");
  assert.ok(note);
  assert.equal(source.slice(note.start, note.end), `"Line one, ""exact""\r\nLine two"`);
  const status = targets.cells.find((target) => target.rowIndex === 1 && target.column === "Status");
  assert.ok(status);
  assert.equal(source.slice(status.start, status.end), "Review");
  assert.equal(status.label, "Row 2 · Status");
});

test("maps each top-level JSON row without being confused by nested delimiters in strings", () => {
  const source = `[
  {"Region":"APAC","Note":"Use } and ], literally","Meta":{"owner":"A"}},
  {"Region":"EMEA","Ready":true}
]`;
  const targets = derivePreviewSourceTargets(artifact("data", "CSV / JSON", "regions.json", source));

  assert.equal(targets.length, 2);
  assert.equal(targets[1].label, "Row 2 · EMEA");
  assert.deepEqual(JSON.parse(source.slice(targets[0].start, targets[0].end)), {
    Region: "APAC",
    Note: "Use } and ], literally",
    Meta: { owner: "A" },
  });
});

test("maps exact JSON property values and withholds ambiguous duplicate-key cells", () => {
  const source = `[
  {"Region":"APAC","Note":"Use } and ], \\"literally\\"","Meta":{"owner":"A"}},
  {"Region":"EMEA","Ready":true}
]`;
  const targets = deriveDataPreviewSourceTargets(artifact("data", "CSV / JSON", "regions.json", source));
  assert.equal(targets.cells.length, 5);
  const region = targets.cells.find((target) => target.rowIndex === 0 && target.column === "Region");
  const note = targets.cells.find((target) => target.rowIndex === 0 && target.column === "Note");
  const meta = targets.cells.find((target) => target.rowIndex === 0 && target.column === "Meta");
  const ready = targets.cells.find((target) => target.rowIndex === 1 && target.column === "Ready");
  assert.ok(region);
  assert.ok(note);
  assert.ok(meta);
  assert.ok(ready);
  assert.equal(source.slice(region.start, region.end), `"APAC"`);
  assert.equal(source.slice(note.start, note.end), `"Use } and ], \\"literally\\""`);
  assert.equal(source.slice(meta.start, meta.end), `{"owner":"A"}`);
  assert.equal(source.slice(ready.start, ready.end), "true");
  assert.equal(targets.cells.some((target) => target.rowIndex === 1 && target.column === "Note"), false);

  const duplicate = deriveDataPreviewSourceTargets(artifact(
    "data",
    "CSV / JSON",
    "ambiguous.json",
    `[{"Region":"old","Region":"new","Value":1}]`,
  ));
  assert.equal(duplicate.rows.length, 1);
  assert.deepEqual(duplicate.cells, []);
});

test("maps primitive JSON values without inventing source for synthetic row numbers", () => {
  const source = `["APAC", 42, false]`;
  const targets = deriveDataPreviewSourceTargets(artifact("data", "CSV / JSON", "values.json", source));
  assert.deepEqual(targets.cells.map((target) => target.column), ["value", "value", "value"]);
  assert.deepEqual(targets.cells.map((target) => source.slice(target.start, target.end)), [`"APAC"`, "42", "false"]);
  assert.equal(targets.cells.some((target) => target.column === "row"), false);
});

test("maps Deck preview controls to complete slides without frontmatter or separators", () => {
  const source = `---
version: 1
title: Briefing
theme: rune
ratio: 16:9
lang: en
---

<!-- layout: cover -->
# Opening

Start here.

---

<!-- layout: conclusion -->
<!-- eyebrow: Decision -->
## Commit now

One action.
`;
  const targets = derivePreviewSourceTargets(artifact("slides", "Deck Markdown", "briefing.deck.md", source));

  assert.deepEqual(targets.map((target) => target.label), ["Opening", "Commit now"]);
  assert.match(source.slice(targets[0].start, targets[0].end), /^<!-- layout: cover -->/);
  assert.doesNotMatch(source.slice(targets[0].start, targets[0].end), /^---|---$/m);
  assert.match(source.slice(targets[1].start, targets[1].end), /One action\.$/);
});

test("returns no visual targets for invalid data, invalid Deck source, or legacy HTML", () => {
  assert.deepEqual(derivePreviewSourceTargets(artifact("data", "CSV / JSON", "broken.json", "[{")), []);
  assert.deepEqual(derivePreviewSourceTargets(artifact("slides", "Deck Markdown", "broken.deck.md", "# No frontmatter")), []);
  assert.deepEqual(derivePreviewSourceTargets(artifact("slides", "Semantic HTML", "legacy.html", "<main><section>Legacy</section></main>")), []);
});

test("resolves a sorted duplicate chart mark to its exact canonical row and cells", () => {
  const data = artifact("data", "CSV / JSON", "regions.csv", "Region,Revenue\nShared,10\nShared,30\nOther,20");
  data.id = "regions";
  const chart = artifact("chart", "Chart JSON", "revenue.chart.json", JSON.stringify({
    version: 1,
    title: "Revenue",
    description: "",
    source: "regions",
    mark: "bar",
    category: "Region",
    value: "Revenue",
    sort: "descending",
    format: "number",
    color: "#ff5c35",
    maxItems: 8,
  }));
  chart.id = "revenue-chart";
  const model = resolveChartModel(chart, [data, chart], parseDataSource).model;
  assert.ok(model);
  assert.equal(model.data[0].label, "Shared");
  assert.equal(model.data[0].sourceRowIndex, 1);

  const resolved = resolveDataRowPreviewTarget(model.sourceArtifactId, model.data[0].sourceRowIndex, [data, chart]);
  assert.ok(resolved);
  assert.equal(resolved.artifact.id, "regions");
  assert.equal(data.source.slice(resolved.target.start, resolved.target.end), "Shared,30");
  const category = resolveDataCellPreviewTarget(model.sourceArtifactId, model.data[0].sourceRowIndex, model.spec.category, [data, chart]);
  const value = resolveDataCellPreviewTarget(model.sourceArtifactId, model.data[0].sourceRowIndex, model.spec.value, [data, chart]);
  assert.ok(category);
  assert.ok(value);
  assert.equal(data.source.slice(category.target.start, category.target.end), "Shared");
  assert.equal(data.source.slice(value.target.start, value.target.end), "30");
  assert.equal(resolveDataRowPreviewTarget("missing", 0, [data, chart]), null);
  assert.equal(resolveDataRowPreviewTarget("regions", -1, [data, chart]), null);
  assert.equal(resolveDataCellPreviewTarget("regions", 1, "Missing", [data, chart]), null);
});
