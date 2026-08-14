import type { DataCell } from "./workspace.ts";

export const MAX_OPERATING_REVIEW_SCOPE_VALUE_CHARS = 160;
export const MAX_OPERATING_REVIEW_SCOPE_OPTIONS = 100;

export type OperatingReviewScopeValue = Exclude<DataCell, null>;

export type OperatingReviewScope = {
  field: string;
  value: OperatingReviewScopeValue;
};

function isScopeValue(value: unknown): value is OperatingReviewScopeValue {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  return (
    typeof value === "string" &&
    [...value].length <= MAX_OPERATING_REVIEW_SCOPE_VALUE_CHARS &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function sameScopeValue(left: DataCell, right: OperatingReviewScopeValue) {
  return typeof left === typeof right && Object.is(left, right);
}

export function operatingReviewScopeValueKey(value: OperatingReviewScopeValue) {
  return JSON.stringify([typeof value, value]);
}

export function normalizeOperatingReviewScope(candidate: unknown): OperatingReviewScope | null | undefined {
  if (candidate == null) return null;
  if (!candidate || typeof candidate !== "object") return undefined;
  const value = candidate as Partial<OperatingReviewScope>;
  if (
    typeof value.field !== "string" ||
    !value.field ||
    value.field.length > 120 ||
    /[\u0000-\u001f\u007f]/u.test(value.field) ||
    !isScopeValue(value.value)
  )
    return undefined;
  return { field: value.field, value: value.value };
}

export function collectOperatingReviewScopeValues(rows: Array<Record<string, DataCell>>, field: string) {
  const values: OperatingReviewScopeValue[] = [];
  const seen = new Set<string>();
  let truncated = false;
  for (const row of rows) {
    const value = row[field];
    if (!isScopeValue(value)) continue;
    const key = operatingReviewScopeValueKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    if (values.length >= MAX_OPERATING_REVIEW_SCOPE_OPTIONS) {
      truncated = true;
      continue;
    }
    values.push(value);
  }
  return { values, truncated };
}

export function prepareOperatingReviewScope(
  rows: Array<Record<string, DataCell>>,
  columns: string[],
  candidate: OperatingReviewScope | null | undefined,
) {
  const normalized = normalizeOperatingReviewScope(candidate);
  if (normalized === null) return { scope: null, rows, errors: [] };
  if (!normalized || columns.filter((column) => column === normalized.field).length !== 1) {
    return { scope: null, rows: [], errors: ["Choose one exact visible scope field from the selected Data source."] };
  }
  const matches = rows.filter((row) => sameScopeValue(row[normalized.field], normalized.value));
  if (!matches.length) {
    return { scope: null, rows: [], errors: ["The selected scope value no longer matches any current Data row."] };
  }
  return {
    scope: normalized,
    rows: matches,
    errors: [],
  };
}

export function prepareOperatingReviewScopes(
  rows: Array<Record<string, DataCell>>,
  columns: string[],
  primaryCandidate: OperatingReviewScope | null | undefined,
  comparisonCandidate: OperatingReviewScope | null | undefined,
) {
  const primary = prepareOperatingReviewScope(rows, columns, primaryCandidate);
  if (primary.errors.length) {
    return { scope: null, comparisonScope: null, rows: [], comparisonRows: [], errors: primary.errors };
  }
  const normalizedComparison = normalizeOperatingReviewScope(comparisonCandidate);
  if (normalizedComparison === null) {
    return {
      scope: primary.scope,
      comparisonScope: null,
      rows: primary.rows,
      comparisonRows: [],
      errors: [],
    };
  }
  if (!primary.scope) {
    return {
      scope: primary.scope,
      comparisonScope: null,
      rows: primary.rows,
      comparisonRows: [],
      errors: ["Choose a primary exact scope before adding a comparison."],
    };
  }
  if (!normalizedComparison || normalizedComparison.field !== primary.scope.field) {
    return {
      scope: primary.scope,
      comparisonScope: null,
      rows: primary.rows,
      comparisonRows: [],
      errors: ["Comparison must use the same exact visible scope field."],
    };
  }
  if (operatingReviewScopeValueKey(normalizedComparison.value) === operatingReviewScopeValueKey(primary.scope.value)) {
    return {
      scope: primary.scope,
      comparisonScope: null,
      rows: primary.rows,
      comparisonRows: [],
      errors: ["Comparison must use a different exact scope value."],
    };
  }
  const comparison = prepareOperatingReviewScope(rows, columns, normalizedComparison);
  if (comparison.errors.length) {
    return {
      scope: primary.scope,
      comparisonScope: null,
      rows: primary.rows,
      comparisonRows: [],
      errors: comparison.errors,
    };
  }
  return {
    scope: primary.scope,
    comparisonScope: comparison.scope,
    rows: primary.rows,
    comparisonRows: comparison.rows,
    errors: [],
  };
}

export function prepareOperatingReviewNumericColumns(
  rows: Array<Record<string, DataCell>>,
  columns: string[],
  candidate: OperatingReviewScope | null | undefined,
  comparisonCandidate: OperatingReviewScope | null | undefined = null,
) {
  const prepared = prepareOperatingReviewScopes(rows, columns, candidate, comparisonCandidate);
  if (prepared.errors.length) return { columns: [], matchedRowCount: 0, errors: prepared.errors };
  const eligibleRows = prepared.comparisonScope ? [...prepared.rows, ...prepared.comparisonRows] : prepared.rows;
  return {
    columns: columns.filter((column) =>
      eligibleRows.every((row) => typeof row[column] === "number" && Number.isFinite(row[column])),
    ),
    matchedRowCount: prepared.rows.length,
    ...(prepared.comparisonScope ? { comparisonMatchedRowCount: prepared.comparisonRows.length } : {}),
    errors: [],
  };
}

function quoteSqlIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function sqlLiteral(value: OperatingReviewScopeValue) {
  if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return Object.is(value, -0) ? "0" : String(value);
}

export function formatOperatingReviewScopeCondition(scope: OperatingReviewScope) {
  return `${quoteSqlIdentifier(scope.field)} = ${sqlLiteral(scope.value)}`;
}

export function formatOperatingReviewScopePredicate(scope: OperatingReviewScope | null) {
  return scope ? `  AND ${formatOperatingReviewScopeCondition(scope)}\n` : "";
}

export function formatOperatingReviewScopeLabel(scope: OperatingReviewScope | null) {
  return scope ? `${scope.field} = ${String(scope.value)}` : "";
}
