# ADR 0021: Pilot evidence export is an anonymous reviewed boundary

## Status

Accepted — Rune v1.02.

## Context

Rune already records bounded task runs and post-handoff outcomes on the user's device. That supports honest in-product summaries, but the records cannot yet be handed to a consented pilot study without inspecting browser storage. Exporting the ledger verbatim would expose internal Artifact ids, filenames embedded in ids, exact source revisions, delivery SHA-256 fingerprints, provider labels, and precise timestamps. Adding analytics or automatic upload would also contradict Rune's local-first product boundary and make product research another content system.

Synthetic Golden Tasks and technical Apply events create a second risk: a convenient aggregate could be mistaken for human proof even when no authorized or redacted result has been scored. Pilot collection needs portability, but portability must not inflate the evidence grade.

## Decision

`prepareRunePilotEvidenceExport` is a pure, deterministic consumer of `normalizeRuneTaskEvidence`. It requires at least one valid guided-task run and an explicit valid clock for deterministic tests. The maximum output is 128 KB JSON. The export contains bounded task type, applied/stopped status, stop reason, dates without exact timestamps, local/configured-model class, output/impact counts, elapsed time, optional token counts, delivery method/format/rating, and only complete normalized seven-dimension evaluations whose provenance is `authorized-or-redacted`.

The compiler assigns package-local ordered aliases such as `run-001` and `output-01`. It never serializes internal run or Artifact ids, source/output revision tokens, delivery SHA-256 values, filenames, paths, provider names, canonical content, prompts, model responses, Query rows, credentials, user identity, or exact timestamps; even the export clock is reduced to a date. Its provenance declares device-local scope, no content, no identity, no Rune synthetic regression evidence, and no upload. Summary math comes from the same ledger functions used in the product; it reports evaluated deliverables and unique reviewed runs separately, keeps number-correctness failures visible, and labels the package candidate human-outcome evidence rather than PMF or pilot completion.

The Workbench owns the browser download capability. A localized review dialog lists the included and excluded fields, shows record counts and byte size, states that the package is not PMF proof, and requires explicit acknowledgement. If the ledger object changes during review, the download stops and must be regenerated. There is no route, fetch, analytics, clipboard, background sync, or automatic filesystem write.

## Consequences

Consented pilot records can now be inspected and aggregated without copying workspace content or browser-internal identifiers. The export remains reproducible for a fixed ledger and time, small enough for manual review, and easy to validate as ordinary JSON. Exact timestamps and cross-package stable identifiers are intentionally unavailable, so cohort joining or user-level retention analysis must be conducted outside Rune under a separately authorized research protocol. Shipping this capability does not change the real-task baseline: only actual, authorized or redacted, fully rated human outcomes can do that.
