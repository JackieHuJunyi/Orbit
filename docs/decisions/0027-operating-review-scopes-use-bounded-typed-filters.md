# ADR 0027: Operating-review scopes use bounded typed filters

- Status: accepted
- Date: 2026-08-19
- Scope: Operating Review row eligibility and comparisons

## Context

The exact field/value scope introduced in ADR 0009 and paired in ADR 0012 proved a single period, but it could not represent a date interval, a small set of values, or an explicit conjunction such as “July, Enterprise, APAC or Europe.” Encoding those requirements as free-form SQL or model prose would split row eligibility across the form, local evidence, Query, model context, deliverables, and saved reruns.

## Decision

Rune adds one bounded typed filter expression while continuing to accept the original `{ field, value }` shape:

```ts
{
  match: "all";
  conditions: Array<
    | { field: string; operator: "equals"; value: string | number | boolean }
    | { field: string; operator: "oneOf"; values: Array<string | number | boolean> }
    | { field: string; operator: "numberRange"; minimum: number; maximum: number }
    | { field: string; operator: "dateRange"; start: "YYYY-MM-DD"; end: "YYYY-MM-DD" }
  >;
}
```

An expression contains one to five conditions, uses each visible field at most once, and combines conditions with AND. A multi-value condition contains at most twenty distinct typed values. Numeric ranges accept only finite source numbers. Date ranges accept only source strings with a valid leading ISO calendar date and compare that date inclusively; Rune does not infer dates from locale-dependent text.

The pure scope compiler owns normalization, row matching, stable identity, labels, and escaped DuckDB predicates. The task form only constructs this typed capability. Local aggregate evidence, numeric-field eligibility, conditional comparison SQL, bounded model input, Chart metadata, report/Deck copy, and saved reruns consume the compiler result. Primary and comparison expressions must be explicit and different; legacy exact comparisons retain the stricter same-field rule.

Existing saved exact scopes continue to normalize and rerun unchanged. New saved workflows persist the expression without storing SQL or duplicating filter state.

## Consequences

- Users can prove multi-period and segmented review populations before any provider request or workspace write.
- Invalid dates, reversed ranges, duplicate fields, oversized value sets, stale conditions, missing fields, and identical comparisons fail closed.
- ISO date handling is explicit rather than guessed; arbitrary fiscal/date semantics still require source-native values or a prepared Data column.
- OR across different fields and nested boolean groups remain outside this bounded task surface. They require a separate expression version rather than string expansion.
