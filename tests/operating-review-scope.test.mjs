import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_OPERATING_REVIEW_SCOPE_OPTIONS,
  collectOperatingReviewScopeValues,
  formatOperatingReviewScopePredicate,
  normalizeOperatingReviewScope,
  operatingReviewScopeValueKey,
  prepareOperatingReviewNumericColumns,
  prepareOperatingReviewScope,
  prepareOperatingReviewScopes,
} from "../app/lib/operating-review-scope.ts";

test("keeps scope values typed, ordered, distinct, and explicitly bounded", () => {
  const rows = [
    { Period: true },
    { Period: "true" },
    { Period: true },
    ...Array.from({ length: MAX_OPERATING_REVIEW_SCOPE_OPTIONS + 1 }, (_, index) => ({ Period: index })),
  ];
  const result = collectOperatingReviewScopeValues(rows, "Period");
  assert.equal(result.values.length, MAX_OPERATING_REVIEW_SCOPE_OPTIONS);
  assert.equal(result.truncated, true);
  assert.notEqual(operatingReviewScopeValueKey(true), operatingReviewScopeValueKey("true"));
  assert.deepEqual(result.values.slice(0, 4), [true, "true", 0, 1]);
});

test("matches one exact typed scope and rejects stale or malformed scope values", () => {
  const rows = [
    { Period: true, Region: "APAC" },
    { Period: "true", Region: "Europe" },
  ];
  const prepared = prepareOperatingReviewScope(rows, ["Period", "Region"], { field: "Period", value: true });
  assert.deepEqual(prepared.errors, []);
  assert.deepEqual(prepared.rows, [rows[0]]);
  assert.deepEqual(
    prepareOperatingReviewScope(rows, ["Period", "Region"], {
      field: "Period",
      value: false,
    }).errors,
    ["The selected scope value no longer matches any current Data row."],
  );
  assert.equal(normalizeOperatingReviewScope({ field: "Period", value: Number.NaN }), undefined);
});

test("emits a safe DuckDB predicate for strings, numbers, and booleans", () => {
  assert.equal(formatOperatingReviewScopePredicate({ field: "Period", value: "Q4's" }), "  AND \"Period\" = 'Q4''s'\n");
  assert.equal(formatOperatingReviewScopePredicate({ field: "Year", value: 2026 }), '  AND "Year" = 2026\n');
  assert.equal(formatOperatingReviewScopePredicate({ field: "Active", value: false }), '  AND "Active" = FALSE\n');
  assert.equal(formatOperatingReviewScopePredicate(null), "");
});

test("derives numeric fields only from rows eligible for the exact scope", () => {
  const rows = [
    { Period: "July", Value: 100, Mixed: "N/A" },
    { Period: "July", Value: 80, Mixed: 20 },
    { Period: "June", Value: "N/A", Mixed: 10 },
  ];
  assert.deepEqual(
    prepareOperatingReviewNumericColumns(rows, ["Period", "Value", "Mixed"], { field: "Period", value: "July" }),
    { columns: ["Value"], matchedRowCount: 2, errors: [] },
  );
  assert.deepEqual(prepareOperatingReviewNumericColumns(rows, ["Period", "Value", "Mixed"], null), {
    columns: [],
    matchedRowCount: 3,
    errors: [],
  });
});

test("prepares one distinct same-field comparison and validates numeric fields across both exact scopes", () => {
  const rows = [
    { Period: "July", Region: "APAC", Value: 100, Mixed: 20 },
    { Period: "June", Region: "APAC", Value: 90, Mixed: "N/A" },
    { Period: "May", Region: "APAC", Value: "outside", Mixed: 10 },
  ];
  const prepared = prepareOperatingReviewScopes(
    rows,
    ["Period", "Region", "Value", "Mixed"],
    { field: "Period", value: "July" },
    { field: "Period", value: "June" },
  );
  assert.deepEqual(prepared.errors, []);
  assert.deepEqual(prepared.rows, [rows[0]]);
  assert.deepEqual(prepared.comparisonRows, [rows[1]]);
  assert.deepEqual(
    prepareOperatingReviewNumericColumns(
      rows,
      ["Period", "Region", "Value", "Mixed"],
      { field: "Period", value: "July" },
      { field: "Period", value: "June" },
    ),
    {
      columns: ["Value"],
      matchedRowCount: 1,
      comparisonMatchedRowCount: 1,
      errors: [],
    },
  );

  assert.match(
    prepareOperatingReviewScopes(rows, ["Period", "Region", "Value"], null, {
      field: "Period",
      value: "June",
    }).errors.join(" "),
    /primary exact scope/i,
  );
  assert.match(
    prepareOperatingReviewScopes(
      rows,
      ["Period", "Region", "Value"],
      { field: "Period", value: "July" },
      { field: "Region", value: "APAC" },
    ).errors.join(" "),
    /same exact visible scope field/i,
  );
  assert.match(
    prepareOperatingReviewScopes(
      rows,
      ["Period", "Region", "Value"],
      { field: "Period", value: "July" },
      { field: "Period", value: "July" },
    ).errors.join(" "),
    /different exact scope value/i,
  );
  assert.match(
    prepareOperatingReviewScopes(
      rows,
      ["Period", "Region", "Value"],
      { field: "Period", value: "July" },
      { field: "Period", value: "April" },
    ).errors.join(" "),
    /no longer matches any current Data row/i,
  );
});
