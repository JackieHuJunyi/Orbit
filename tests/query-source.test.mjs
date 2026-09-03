import assert from "node:assert/strict";
import test from "node:test";

import {
  formatQueryDataSourceDirective,
  parseQueryDataSourceDirective,
  resolveQueryDataArtifact,
} from "../app/lib/query-source.ts";

const primary = {
  id: "primary-data",
  name: "primary.csv",
  kind: "data",
  source: "Region,Revenue\nAPAC,42",
};
const decoy = {
  id: "数据-二",
  name: "数据-二.csv",
  kind: "data",
  source: "Region,Revenue\nWrong,1",
};

test("parses and formats one explicit quoted Query Data binding", () => {
  const line = formatQueryDataSourceDirective(decoy.id);
  assert.equal(line, '-- orbit:data "数据-二"');
  assert.deepEqual(parseQueryDataSourceDirective(`${line}\nSELECT * FROM workspace_data;`), {
    artifactId: decoy.id,
    explicit: true,
    errors: [],
  });
  assert.deepEqual(parseQueryDataSourceDirective("SELECT * FROM workspace_data;"), {
    explicit: false,
    errors: [],
  });
});

test("rejects malformed, displaced, duplicate, or unsafe Query Data bindings", () => {
  const cases = [
    "-- orbit:data primary-data\nSELECT 1",
    '-- context\n-- orbit:data "primary-data"\nSELECT 1',
    '-- orbit:data "primary-data"\n-- orbit:data "数据-二"\nSELECT 1',
    '-- orbit:data "line\\nbreak"\nSELECT 1',
  ];
  cases.forEach((source) => assert.ok(parseQueryDataSourceDirective(source).errors.length));
  assert.throws(() => formatQueryDataSourceDirective("line\nbreak"), /visible characters/i);
});

test("resolves explicit bindings independent of workspace order and keeps legacy fallback", () => {
  const explicit = {
    id: "analysis",
    name: "analysis.sql",
    kind: "query",
    source: '-- orbit:data "primary-data"\nSELECT * FROM workspace_data;',
  };
  const legacy = { ...explicit, source: "SELECT * FROM workspace_data;" };
  assert.equal(resolveQueryDataArtifact(explicit, [decoy, primary]).artifact?.id, primary.id);
  const legacyResolution = resolveQueryDataArtifact(legacy, [decoy, primary]);
  assert.equal(legacyResolution.explicit, false);
  assert.equal(legacyResolution.artifact?.id, decoy.id);
});

test("fails closed when an explicit Query source is missing or is not Data", () => {
  const query = {
    id: "analysis",
    name: "analysis.sql",
    kind: "query",
    source: '-- orbit:data "target"\nSELECT * FROM workspace_data;',
  };
  assert.match(resolveQueryDataArtifact(query, [primary]).errors[0], /not found/i);
  assert.match(
    resolveQueryDataArtifact(query, [{ ...primary, id: "target", kind: "document" }]).errors[0],
    /Data artifact/i,
  );
});
