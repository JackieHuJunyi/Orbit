import assert from "node:assert/strict";
import test from "node:test";

import { workspaceRowsToArrowTable } from "../app/lib/duckdb-import.ts";

test("builds a typed Arrow table without JSON-extension loading", () => {
  const table = workspaceRowsToArrowTable(
    ["amount", "active", "empty", "mixed"],
    [
      { amount: 3.5, active: true, empty: null, mixed: 1 },
      { amount: null, active: false, empty: null, mixed: "two" },
    ],
    "__order__",
  );

  assert.deepEqual(
    table.schema.fields.map((field) => [field.name, field.type.toString()]),
    [
      ["amount", "Float64"],
      ["active", "Bool"],
      ["empty", "Utf8"],
      ["mixed", "Utf8"],
      ["__order__", "Float64"],
    ],
  );
  assert.deepEqual(
    table.toArray().map((row) => row.toJSON()),
    [
      { amount: 3.5, active: true, empty: null, mixed: "1", __order__: 0 },
      { amount: null, active: false, empty: null, mixed: "two", __order__: 1 },
    ],
  );
});
