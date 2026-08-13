# ADR 0022: Pilot cohorts require one final anonymous package per participant

## Status

Accepted — Rune v1.03.

## Context

v1.02 lets one device export a content-free, pseudonymized evidence package. A real pilot needs to combine multiple packages, but simply summing JSON files creates three failure modes: untrusted packages can alter their own summaries, repeated exports can double count the same runs, and filenames or researcher labels can leak participant identity into the aggregate.

Stable cross-export run or person identifiers would make deduplication easier while creating a linkable identity Rune deliberately excluded. Automatic upload or a hosted research database would broaden the product's authority before a real pilot has justified it.

## Decision

`pilot-evidence-cohort.ts` is a pure, offline consumer of v1 Pilot Evidence packages. It validates exact metadata and provenance, sequential package-local aliases, date-only time, status/stop contracts, bounded counts and tokens, applied-run delivery links, method/format pairs, unique output outcomes, complete authorized/redacted rubrics, compiler order, and the 128 KB package limit. It recomputes run and delivery summaries and rejects any claimed summary that differs.

The cohort input accepts 1–50 entries with unique `participant-NNN` aliases. Each participant contributes exactly one final package. Exact duplicate package content is rejected even if its export date changes. Rune intentionally does not create a stable cross-export identifier: when a participant produces a newer final package, the researcher must replace that manifest file rather than append another participant row.

The aggregate contains only cohort counts, weighted averages, task breakdown, the independent number-correctness gate, and a recurrence signal. Recurrence counts an evaluated participant only when two distinct fully evaluated runs occur on different dates no more than 28 days apart. Participant aliases, package records, run/output aliases, filenames, paths, and exact dates do not enter JSON or Markdown output. The report labels itself candidate human-outcome cohort evidence and cannot claim PMF, payment, or causality.

`pilot:aggregate` is an explicit local CLI around this pure compiler. Its versioned manifest may reference only unique relative regular JSON files inside the manifest directory; symlinks, path escape, oversized files, and malformed input fail closed. With no output directory it prints Markdown. With an explicit output directory it creates user-only JSON/Markdown files through non-overwriting temporary files and compensates any partial write. `.gitignore` excludes the private study directory, raw packages, and reports.

## Consequences

Rune can now produce a reproducible multi-participant baseline without adding telemetry, identity, cloud storage, or a second content database. A final package can contain multiple task cycles, so date-only 28-day reuse remains measurable inside one participant window. Incremental exports cannot be merged automatically; this is an intentional privacy tradeoff. Researchers must preserve one-final-package discipline and keep consent, identity mapping, source material, and commercial records in separately authorized systems.
