import assert from "node:assert/strict";
import test from "node:test";

import { planLocalSelectionChange } from "../app/lib/local-selection-agent.ts";
import {
  MAX_AGENT_SELECTION_CHARS,
  replaceSourceSelection,
  sourceOutsideSelectionIsUnchanged,
  sourceSelectionError,
} from "../app/lib/source-selection.ts";

function artifact(source) {
  return { id: "report", name: "report.md", kind: "document", language: "Markdown", source };
}

test("uses textarea-compatible UTF-16 offsets and preserves source outside the selection", () => {
  const source =
    "Prefix 😀\nActually this is really a long conclusion. A second sentence stays outside the summary.\nSuffix";
  const selected = "Actually this is really a long conclusion. A second sentence stays outside the summary.";
  const start = source.indexOf(selected);
  const selection = { start, end: start + selected.length };
  const plan = planLocalSelectionChange(artifact(source), selection, "把选中内容压缩成一句话");
  assert.equal(plan.nextSource, "Prefix 😀\nThis is a long conclusion.\nSuffix");
  assert.equal(sourceOutsideSelectionIsUnchanged(source, plan.nextSource, selection), true);
  assert.match(plan.summary, /Condense the selected source/);
});

test("turns only the selected passage into bounded Markdown points", () => {
  const source = "# Brief\n\nRevenue grew. Margin improved. Risk remains. Extra sentence.\n\n## Keep\n\nUnchanged.";
  const start = source.indexOf("Revenue grew.");
  const end = source.indexOf("\n\n## Keep");
  const selection = { start, end };
  const plan = planLocalSelectionChange(artifact(source), selection, "把选中内容改成三条要点");
  assert.match(plan.nextSource, /- Revenue grew\.\n- Margin improved\.\n- Risk remains\./);
  assert.doesNotMatch(plan.nextSource, /Extra sentence/);
  assert.match(plan.nextSource, /## Keep\n\nUnchanged\./);
  assert.equal(sourceOutsideSelectionIsUnchanged(source, plan.nextSource, selection), true);
});

test("offers format-preserving exact-text fallbacks for selected data and code", () => {
  const source = "Region,Status\nAPAC,active\nEMEA,review\n";
  const start = source.indexOf("active");
  const selection = { start, end: start + "active".length };
  const plan = planLocalSelectionChange(
    {
      id: "data",
      name: "data.csv",
      kind: "data",
      language: "CSV / JSON",
      source,
    },
    selection,
    "把选中内容转成大写",
  );
  assert.equal(plan.nextSource, "Region,Status\nAPAC,ACTIVE\nEMEA,review\n");
  assert.equal(sourceOutsideSelectionIsUnchanged(source, plan.nextSource, selection), true);
});

test("scales one exact unquoted CSV or JSON numeric cell without widening selection", () => {
  const csv = "Region,Revenue\nAPAC,1840000\nEMEA,970000\n";
  const start = csv.indexOf("1840000");
  const selection = { start, end: start + "1840000".length };
  const plan = planLocalSelectionChange(
    {
      id: "data",
      name: "data.csv",
      kind: "data",
      language: "CSV / JSON",
      source: csv,
    },
    selection,
    "把选中数值乘以 1.1",
  );
  assert.equal(plan.nextSource, "Region,Revenue\nAPAC,2024000\nEMEA,970000\n");
  assert.equal(sourceOutsideSelectionIsUnchanged(csv, plan.nextSource, selection), true);

  assert.throws(
    () =>
      planLocalSelectionChange(
        {
          id: "data",
          name: "data.json",
          kind: "data",
          language: "CSV / JSON",
          source: `[{"Revenue":"1,840,000"}]`,
        },
        { start: 12, end: 23 },
        "把选中数值乘以 1.1",
      ),
    /one unquoted CSV or JSON number/i,
  );
});

test("rejects collapsed, stale, oversized, unsupported, and no-op selection plans", () => {
  const source = "One concise sentence.";
  assert.match(sourceSelectionError(source, { start: 2, end: 2 }), /does not match/);
  assert.match(sourceSelectionError(source, { start: 0, end: source.length + 1 }), /does not match/);
  assert.match(sourceSelectionError("😀", { start: 0, end: 1 }), /splits a Unicode character/);
  assert.match(
    sourceSelectionError("x".repeat(MAX_AGENT_SELECTION_CHARS + 1), {
      start: 0,
      end: MAX_AGENT_SELECTION_CHARS + 1,
    }),
    /limited to 16000 characters/,
  );
  assert.throws(
    () => planLocalSelectionChange(artifact(source), { start: 0, end: source.length }, "translate it"),
    /condensing|three points/i,
  );
  assert.throws(
    () => planLocalSelectionChange(artifact(source), { start: 0, end: source.length }, "压缩成一句话"),
    /would not change/i,
  );
  assert.throws(() => replaceSourceSelection(source, { start: 5, end: 4 }, "bad"), /does not match/);
});
