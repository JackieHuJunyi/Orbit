# ADR 0012: Comparisons are paired exact scopes

- Status: accepted
- Date: 2026-08-14
- Scope: Operating Review primary-versus-comparison evidence

## Context

One exact Data scope made a period provable, but it could not answer the Golden Task Set's week-over-week, month-over-month, or target-variance questions. Treating the human `period` label as a filter would remain unprovable. Letting the model infer a baseline, generating free-form SQL in React, or treating a missing comparison category as zero would create different evidence contracts across preview, Query, Chart, report, and saved rerun.

## Decision

Operating Review may carry an optional `comparisonScope` only when it also carries a primary `scope`. Both scopes must use the same exact visible Data field, preserve string/number/boolean identity, match current rows, and use different typed values.

[`operating-review-scope.ts`](../../app/lib/operating-review-scope.ts) prepares both row sets. Numeric field eligibility covers their union but ignores rows outside both. The evidence compiler aggregates each side independently, retains only exact categories present on both sides, and defines the task metric as:

```text
primary aggregate − comparison aggregate
```

The generated Query uses conditional aggregates for both exact values, exposes the primary value, comparison value, and change field, and uses `HAVING` to prove both sides exist. Chart, bounded model evidence, live metric bindings, report, Deck, preview, and saved rerun all consume that same change field. The model receives bounded aggregates and the two typed scopes, but cannot choose the baseline, author SQL, paste static numbers, or write files.

## Consequences

- A malformed value outside both scopes cannot invalidate the selected comparison.
- A malformed value inside either scope fails before provider contact or write.
- A category present on only one side is excluded rather than silently compared with zero.
- Existing single-scope and all-row workflows remain unchanged.
- Saved reruns may change either exact value while preserving Query, Chart, report, and presentation identities.
- Range, multi-value, compound-filter, and semantic-date comparisons still require a future typed filter expression.

## UI consequence

The task form progressively enables **Compare with** only after a primary exact value exists. The compiler-derived preview shows primary rows, comparison rows, excluded rows, both aggregates, their change, and combined source-row count before any model request.

Desktop Source/Preview focus views retain mounted subtrees and use a short grid-track transition with `inert` hidden surfaces. This follows the useful interaction principle observed in DeepSeek Harness—preserve working context across panel changes—without adopting its dynamic plugin/session runtime. See the [upstream review](../references/deepseek-harness-ui-architecture-review.md).

## Enforcement

- scope tests cover typed same-field/different-value rules, stale values, and numeric eligibility across both scopes;
- compiler tests cover evidence, SQL, Chart, live bindings, deliverables, malformed inputs, immutable inputs, and saved reruns;
- route tests prove bounded paired evidence and no raw-row/model-write authority;
- real DuckDB-Wasm tests execute the conditional aggregate and exclude unpaired categories;
- architecture tests keep scope logic pure and verify mounted focus-view interaction semantics.
