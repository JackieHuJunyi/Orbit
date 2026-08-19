import type { DataCell } from "./workspace.ts";

export const MAX_OPERATING_REVIEW_SCOPE_VALUE_CHARS = 160;
export const MAX_OPERATING_REVIEW_SCOPE_OPTIONS = 100;
export const MAX_OPERATING_REVIEW_SCOPE_CONDITIONS = 5;
export const MAX_OPERATING_REVIEW_SCOPE_VALUES = 20;

export type OperatingReviewScopeValue = Exclude<DataCell, null>;

export type OperatingReviewExactScope = {
  field: string;
  value: OperatingReviewScopeValue;
};

export type OperatingReviewScopeCondition =
  | {
      field: string;
      operator: "equals";
      value: OperatingReviewScopeValue;
    }
  | {
      field: string;
      operator: "oneOf";
      values: OperatingReviewScopeValue[];
    }
  | {
      field: string;
      operator: "numberRange";
      minimum: number;
      maximum: number;
    }
  | {
      field: string;
      operator: "dateRange";
      start: string;
      end: string;
    };

export type OperatingReviewFilterScope = {
  match: "all";
  conditions: OperatingReviewScopeCondition[];
};

// The exact shape remains valid so existing saved workflows migrate without a rewrite.
export type OperatingReviewScope = OperatingReviewExactScope | OperatingReviewFilterScope;

function isScopeField(value: unknown): value is string {
  return typeof value === "string" && Boolean(value) && value.length <= 120 && !/[\u0000-\u001f\u007f]/u.test(value);
}

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

function semanticDateKey(value: unknown) {
  if (typeof value !== "string") return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/u.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function normalizeScopeCondition(candidate: unknown): OperatingReviewScopeCondition | undefined {
  if (!candidate || typeof candidate !== "object") return undefined;
  const value = candidate as Partial<OperatingReviewScopeCondition> & Record<string, unknown>;
  if (!isScopeField(value.field)) return undefined;
  if (value.operator === "equals" && isScopeValue(value.value)) {
    return { field: value.field, operator: "equals", value: value.value };
  }
  if (value.operator === "oneOf" && Array.isArray(value.values)) {
    const values: OperatingReviewScopeValue[] = [];
    const seen = new Set<string>();
    for (const item of value.values) {
      if (!isScopeValue(item)) return undefined;
      const key = operatingReviewScopeValueKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      values.push(item);
    }
    if (!values.length || values.length > MAX_OPERATING_REVIEW_SCOPE_VALUES) return undefined;
    return { field: value.field, operator: "oneOf", values };
  }
  if (
    value.operator === "numberRange" &&
    typeof value.minimum === "number" &&
    Number.isFinite(value.minimum) &&
    typeof value.maximum === "number" &&
    Number.isFinite(value.maximum) &&
    value.minimum <= value.maximum
  ) {
    return { field: value.field, operator: "numberRange", minimum: value.minimum, maximum: value.maximum };
  }
  if (
    value.operator === "dateRange" &&
    typeof value.start === "string" &&
    typeof value.end === "string" &&
    semanticDateKey(value.start) === value.start &&
    semanticDateKey(value.end) === value.end &&
    value.start <= value.end
  ) {
    return { field: value.field, operator: "dateRange", start: value.start, end: value.end };
  }
  return undefined;
}

export function isOperatingReviewExactScope(scope: OperatingReviewScope): scope is OperatingReviewExactScope {
  return "field" in scope;
}

export function operatingReviewScopeConditions(scope: OperatingReviewScope): OperatingReviewScopeCondition[] {
  return isOperatingReviewExactScope(scope)
    ? [{ field: scope.field, operator: "equals", value: scope.value }]
    : scope.conditions;
}

export function operatingReviewScopeValueKey(value: OperatingReviewScopeValue) {
  return JSON.stringify([typeof value, value]);
}

export function normalizeOperatingReviewScope(candidate: unknown): OperatingReviewScope | null | undefined {
  if (candidate == null) return null;
  if (!candidate || typeof candidate !== "object") return undefined;
  const value = candidate as Record<string, unknown>;
  if (isScopeField(value.field) && isScopeValue(value.value)) return { field: value.field, value: value.value };
  if (value.match !== "all" || !Array.isArray(value.conditions)) return undefined;
  if (!value.conditions.length || value.conditions.length > MAX_OPERATING_REVIEW_SCOPE_CONDITIONS) return undefined;
  const conditions = value.conditions.map(normalizeScopeCondition);
  if (conditions.some((condition) => !condition)) return undefined;
  const normalized = conditions as OperatingReviewScopeCondition[];
  if (new Set(normalized.map((condition) => condition.field)).size !== normalized.length) return undefined;
  return { match: "all", conditions: normalized };
}

export function operatingReviewScopeKey(scope: OperatingReviewScope) {
  return JSON.stringify(operatingReviewScopeConditions(scope));
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
  const exact = normalized && isOperatingReviewExactScope(normalized) ? normalized : null;
  const conditions = normalized ? operatingReviewScopeConditions(normalized) : [];
  if (
    !normalized ||
    conditions.some((condition) => columns.filter((column) => column === condition.field).length !== 1)
  ) {
    return {
      scope: null,
      rows: [],
      errors: [
        exact
          ? "Choose one exact visible scope field from the selected Data source."
          : "Choose only visible scope fields from the selected Data source.",
      ],
    };
  }
  const matches = rows.filter((row) =>
    conditions.every((condition) => {
      const rowValue = row[condition.field];
      if (condition.operator === "equals") return sameScopeValue(rowValue, condition.value);
      if (condition.operator === "oneOf") {
        return condition.values.some((value) => sameScopeValue(rowValue, value));
      }
      if (condition.operator === "numberRange") {
        return typeof rowValue === "number" && rowValue >= condition.minimum && rowValue <= condition.maximum;
      }
      const key = semanticDateKey(rowValue);
      return key != null && key >= condition.start && key <= condition.end;
    }),
  );
  if (!matches.length) {
    return {
      scope: null,
      rows: [],
      errors: [
        exact
          ? "The selected scope value no longer matches any current Data row."
          : "The selected scope conditions no longer match any current Data row.",
      ],
    };
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
      errors: [
        normalizedComparison && isOperatingReviewExactScope(normalizedComparison)
          ? "Choose a primary exact scope before adding a comparison."
          : "Choose a primary scope before adding a comparison.",
      ],
    };
  }
  if (!normalizedComparison) {
    return {
      scope: primary.scope,
      comparisonScope: null,
      rows: primary.rows,
      comparisonRows: [],
      errors: ["Comparison must use valid visible scope conditions."],
    };
  }
  if (
    isOperatingReviewExactScope(primary.scope) &&
    isOperatingReviewExactScope(normalizedComparison) &&
    normalizedComparison.field !== primary.scope.field
  ) {
    return {
      scope: primary.scope,
      comparisonScope: null,
      rows: primary.rows,
      comparisonRows: [],
      errors: ["Comparison must use the same exact visible scope field."],
    };
  }
  if (operatingReviewScopeKey(normalizedComparison) === operatingReviewScopeKey(primary.scope)) {
    return {
      scope: primary.scope,
      comparisonScope: null,
      rows: primary.rows,
      comparisonRows: [],
      errors: [
        isOperatingReviewExactScope(primary.scope) && isOperatingReviewExactScope(normalizedComparison)
          ? "Comparison must use a different exact scope value."
          : "Comparison must use different scope conditions.",
      ],
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
  const formatted = operatingReviewScopeConditions(scope).map((condition) => {
    const field = quoteSqlIdentifier(condition.field);
    if (condition.operator === "equals") return `${field} = ${sqlLiteral(condition.value)}`;
    if (condition.operator === "oneOf") {
      return `(${condition.values.map((value) => `${field} = ${sqlLiteral(value)}`).join(" OR ")})`;
    }
    if (condition.operator === "numberRange") {
      return `${field} BETWEEN ${sqlLiteral(condition.minimum)} AND ${sqlLiteral(condition.maximum)}`;
    }
    return `TRY_CAST(SUBSTR(CAST(${field} AS VARCHAR), 1, 10) AS DATE) BETWEEN DATE '${condition.start}' AND DATE '${condition.end}'`;
  });
  if (isOperatingReviewExactScope(scope)) return formatted[0];
  return formatted.map((condition) => `(${condition})`).join(" AND ");
}

export function formatOperatingReviewScopePredicate(scope: OperatingReviewScope | null) {
  return scope ? `  AND ${formatOperatingReviewScopeCondition(scope)}\n` : "";
}

export function formatOperatingReviewScopeLabel(scope: OperatingReviewScope | null) {
  if (!scope) return "";
  return operatingReviewScopeConditions(scope)
    .map((condition) => {
      if (condition.operator === "equals") return `${condition.field} = ${String(condition.value)}`;
      if (condition.operator === "oneOf") return `${condition.field} ∈ ${condition.values.map(String).join(", ")}`;
      if (condition.operator === "numberRange") {
        return `${condition.field} = ${condition.minimum}…${condition.maximum}`;
      }
      return `${condition.field} = ${condition.start}…${condition.end}`;
    })
    .join(" · ");
}
