# ADR 0009: Period labels do not prove Data scope

**Status:** Accepted
**Date:** 2026-08-14

## Context

Rune asks for a reporting-period label, but a label such as “July” does not prove that the generated Query excludes June rows. An operating review can look polished while silently aggregating the wrong period. The defect would propagate into the Chart, Document, Slides, model evidence, and every saved rerun.

Inferring date columns or parsing arbitrary date text would merely move the guess. CSV/JSON also commonly encode periods as month names, fiscal quarters, booleans, or numeric years. The source remains canonical, so Rune needs an explicit source-native scope rather than a hidden interpretation.

## Decision

An operating review may carry one optional exact Data scope:

```ts
{ field: string; value: string | number | boolean }
```

1. Rune lists at most one hundred distinct, typed values from one exact visible field in source order. “All Data rows” remains explicit and backwards compatible.
2. The selected value must still exist with the same JavaScript type in the current canonical Data. Missing fields, stale values, non-finite numbers, control characters, and unsupported values fail before provider contact or workspace mutation.
3. A pure scope module owns typed equality, bounded option derivation, DuckDB identifier/literal escaping, and display labels. React only selects a capability; it does not build SQL.
4. Numeric field discovery and the deterministic evidence compiler inspect the same eligible rows. Excluded rows cannot invalidate a selected period, while “all Data rows” retains strict finite-number validation.
5. The deterministic evidence compiler filters rows before grouping. The generated Query receives the equivalent exact predicate and casts the already-validated eligible measure to `DOUBLE`, so excluded malformed text cannot force DuckDB to type the whole imported column as nonnumeric. Chart metadata, Document, and Slides state the same scope.
6. The optional model receives only the already-filtered aggregate evidence plus the explicit scope description. It never receives excluded rows or raw source.
7. Saved workflows persist the typed scope. Reruns can change it while retaining exact Query, Chart, Document, and Slides identities; stale scopes stop with zero writes.
8. Reporting period remains a human-facing label. Rune does not claim that the label and scope are semantically equivalent; the review displays both.

## Consequences

- A user can prove which source rows are eligible for a recurring review instead of trusting a title.
- Local evidence, real DuckDB execution, model context, and deliverables share one scope contract.
- The initial capability deliberately supports one equality predicate. Date ranges, multiple values, compound filters, and inferred date semantics require a future typed filter expression and review UI; they are not encoded as strings today.
- Existing saved workflows normalize missing scope to `null` and continue to mean all Data rows.
