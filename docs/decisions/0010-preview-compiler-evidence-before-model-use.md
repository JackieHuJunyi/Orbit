# ADR 0010: Preview compiler evidence before model use

## Status

Accepted — Rune v0.92.

## Context

An operating-review form previously described the chosen Data scope and fields but did not show their computed result until the complete transaction review. A wrong category, measure, aggregation, or exact scope could therefore look plausible while the user was still configuring the task. Building a separate React aggregation would make the preview fast, but it would create a second interpretation of eligible rows, ordering, numeric validation, and formatting.

## Decision

The dialog calls the existing pure `prepareOperatingReviewEvidence` compiler before any model request. Successful preparation returns the exact eligible-row count, complete aggregate-group count, and the same bounded ordered evidence rows used by the task contract. The interface displays eligible and excluded row counts and at most five groups; the provider boundary remains capped at twenty evidence rows. Display values use the same deterministic formatter as live Charts.

Invalid or incomplete mappings return no evidence preview. The preview is read-only and grants React no SQL generation, provider invocation, workspace mutation, persistence, or scope-widening capability.

## Consequences

- Users can verify scope and aggregation while mapping the task, before spending model tokens or reviewing writes.
- UI, SQL, Chart, model context, report, presentation, and saved rerun share one evidence compiler and ordering contract.
- `groupCount` preserves complete accounting without widening the bounded model input.
- Future filters or aggregations must extend the pure compiler first; a task surface may only project its result.
