import assert from "node:assert/strict";
import test from "node:test";

import { deriveDataPreviewSourceTargets } from "../app/lib/preview-targets.ts";
import {
  canVisualEditDataCell,
  prepareVisualDataCellEdit,
  visualDataCellValueType,
} from "../app/lib/visual-data-edit.ts";
import { parseDataSource } from "../app/lib/workspace.ts";

function artifact(name, source) {
  return { id: "data", name, kind: "data", language: "CSV / JSON", source };
}

function targetFor(sourceArtifact, rowIndex, column) {
  const target = deriveDataPreviewSourceTargets(sourceArtifact).cells.find((candidate) => (
    candidate.rowIndex === rowIndex && candidate.column === column
  ));
  assert.ok(target);
  return target;
}

test("replaces one exact CSV literal and preserves every byte outside the target", () => {
  const sourceArtifact = artifact("regions.csv", "Region,Revenue\nAPAC,1840000\nEurope,970000\n");
  const target = targetFor(sourceArtifact, 0, "Revenue");
  const prepared = prepareVisualDataCellEdit(sourceArtifact, target, { draft: "2000000", valueType: "auto" });
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.nextSource, "Region,Revenue\nAPAC,2000000\nEurope,970000\n");
  assert.equal(parseDataSource(prepared.nextSource).rows[0].Revenue, 2000000);
  assert.equal(prepared.nextTarget?.column, "Revenue");
});

test("quotes CSV strings with delimiters and keeps automatic scalar typing explicit", () => {
  const sourceArtifact = artifact("regions.csv", "Region,Ready\nAPAC,true\n");
  const region = targetFor(sourceArtifact, 0, "Region");
  const prepared = prepareVisualDataCellEdit(sourceArtifact, region, { draft: "North, East", valueType: "auto" });
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.nextSource, 'Region,Ready\n"North, East",true\n');
  assert.equal(parseDataSource(prepared.nextSource).rows[0].Region, "North, East");
  assert.equal(visualDataCellValueType(true, "CSV"), "auto");
});

test("edits flat JSON with explicit scalar types without reformatting the document", () => {
  const sourceArtifact = artifact("regions.json", '[\n  { "Region": "APAC", "Revenue": 42, "Ready": true, "Note": null }\n]\n');
  const revenue = targetFor(sourceArtifact, 0, "Revenue");
  const asText = prepareVisualDataCellEdit(sourceArtifact, revenue, { draft: "42", valueType: "string" });
  assert.deepEqual(asText.errors, []);
  assert.equal(asText.nextSource, '[\n  { "Region": "APAC", "Revenue": "42", "Ready": true, "Note": null }\n]\n');
  assert.equal(parseDataSource(asText.nextSource).rows[0].Revenue, "42");

  const noteArtifact = { ...sourceArtifact, source: asText.nextSource };
  const note = targetFor(noteArtifact, 0, "Note");
  const filled = prepareVisualDataCellEdit(noteArtifact, note, { draft: "Reviewed", valueType: "string" });
  assert.deepEqual(filled.errors, []);
  assert.equal(parseDataSource(filled.nextSource).rows[0].Note, "Reviewed");
});

test("rejects stale, unchanged, invalid numeric, and nested JSON cell edits", () => {
  const sourceArtifact = artifact("data.json", '[{"Value": 2, "Meta": {"owner":"Rune"}}]');
  const value = targetFor(sourceArtifact, 0, "Value");
  assert.match(prepareVisualDataCellEdit(sourceArtifact, value, { draft: "2", valueType: "number" }).errors[0], /unchanged/i);
  assert.match(prepareVisualDataCellEdit(sourceArtifact, value, { draft: "2x", valueType: "number" }).errors[0], /finite decimal/i);
  assert.match(prepareVisualDataCellEdit({ ...sourceArtifact, source: " " + sourceArtifact.source }, value, { draft: "3", valueType: "number" }).errors[0], /revision/i);

  const meta = targetFor(sourceArtifact, 0, "Meta");
  assert.equal(canVisualEditDataCell(sourceArtifact, meta), false);
  assert.match(prepareVisualDataCellEdit(sourceArtifact, meta, { draft: "flat", valueType: "string" }).errors[0], /flat JSON/i);
});
