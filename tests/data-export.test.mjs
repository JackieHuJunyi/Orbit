import assert from "node:assert/strict";
import test from "node:test";
import Papa from "papaparse";
import {
  MAX_PORTABLE_DATA_EXPORT_BYTES,
  exportPortableDataArtifact,
} from "../app/lib/data-export.ts";

const artifact = {
  id: "typed-data",
  name: "typed-data.csv",
  kind: "data",
  language: "CSV / JSON",
  source: "Region,Revenue,Active,Note\nAPAC,1840000,true,Ready\nEurope,970000,false,\n",
};

test("exports deterministic rectangular JSON with typed values", () => {
  const first = exportPortableDataArtifact(artifact, "json");
  const second = exportPortableDataArtifact(artifact, "json");
  assert.deepEqual(first.bytes, second.bytes);
  assert.equal(first.fileName, "typed-data.json");
  assert.equal(first.targetType, "json");
  assert.ok(first.bytes.length < MAX_PORTABLE_DATA_EXPORT_BYTES);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(first.bytes)), [
    { Region: "APAC", Revenue: 1840000, Active: true, Note: "Ready" },
    { Region: "Europe", Revenue: 970000, Active: false, Note: null },
  ]);
  assert.match(first.warnings.join(" "), /flat object/i);
});

test("exports deterministic formula-safe CSV from flat JSON", () => {
  const source = {
    ...artifact,
    name: "typed-data.json",
    source: JSON.stringify([
      { Region: "APAC", Revenue: 1840000, Active: true, Note: "=SUM(A1:A2)" },
      { Region: "Europe", Revenue: 970000, Active: false },
    ]),
  };
  const first = exportPortableDataArtifact(source, "csv");
  const second = exportPortableDataArtifact(source, "csv");
  assert.deepEqual(first.bytes, second.bytes);
  assert.equal(first.fileName, "typed-data.csv");
  assert.equal(first.targetType, "csv");
  const parsed = Papa.parse(new TextDecoder().decode(first.bytes), { header: true, dynamicTyping: true, skipEmptyLines: true });
  assert.equal(parsed.data[0].Note, "'=SUM(A1:A2)");
  assert.equal(parsed.data[1].Note, null);
  assert.match(first.warnings.join(" "), /does not carry a schema/i);
  assert.match(first.warnings.join(" "), /prefixed with an apostrophe/i);
});

test("portable Data export fails closed for unsupported, invalid, and oversized sources", () => {
  assert.throws(() => exportPortableDataArtifact({ ...artifact, kind: "document" }, "csv"), /Data artifacts only/i);
  assert.throws(() => exportPortableDataArtifact({ ...artifact, source: "[" }, "json"), /Unexpected|JSON/i);
  assert.throws(() => exportPortableDataArtifact({ ...artifact, source: "x".repeat(2_000_001) }, "csv"), /2,000,000/i);
});
