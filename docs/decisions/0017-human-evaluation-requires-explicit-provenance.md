# ADR 0017: Human task evaluation requires explicit provenance

## Status

Accepted — Rune v0.98.

## Context

Rune v0.97 established a synthetic Golden Task regression baseline and kept the licensed or redacted real-task count at zero. The product plan requires seven human-scored dimensions before a pilot, but forcing a long questionnaire after every handoff would damage the delivery flow. Silently treating a quick “ready” judgment as a full real-task evaluation would fabricate evidence, while storing source content, prompts, filenames, or identity would exceed the local evidence boundary.

## Decision

Rune keeps two distinct post-handoff paths in one shared dialog:

1. The default quick confirmation records only `ready`, `minor-edits`, or `not-ready`, bound to the exact applied run, all current output revisions, handoff target, SHA-256 output fingerprint, and elapsed time.
2. An optional disclosure collects all seven 1–5 scores: number correctness, evidence completeness, conclusion usefulness, structure clarity, visual deliverability, change comprehensibility, and overall time saved. No score is prefilled. The detailed confirmation is enabled only after all seven values exist and the reviewer explicitly confirms that the task is authorized for evaluation or uses redacted content.

The device ledger advances to version 3 and each delivery record to version 2. Valid v1/v2 evidence migrates forward with `evaluation: null`; malformed detailed data also normalizes to `null` and cannot become a real-task sample. Reconfirming through the quick path preserves an existing detailed evaluation unless a caller explicitly clears it. The summary counts unique run ids as reviewed real tasks, counts evaluated deliverables separately, and exposes every number-correctness score below 4. A task is pilot-eligible only when all of its evaluated deliverables score at least 4 for number correctness; averages never override that gate.

The record remains content-free and device-local. It stores neither canonical source, filename as measurement, prompt, model response, Query rows, credentials, user identity, nor telemetry. The interface is shared across all nine Rune locales and keeps Arabic layout on the existing RTL contract.

## Consequences

Rune can begin collecting honest product-outcome evidence without turning every export into a survey or mixing it with synthetic regression results. Old records remain valid quick outcomes but do not acquire invented human scores. The current licensed/redacted real-task count remains zero until a reviewer actually submits complete authorized evidence; shipping the evaluator does not satisfy the twenty-task pilot threshold.
