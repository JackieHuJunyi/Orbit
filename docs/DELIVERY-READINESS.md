# Rune delivery readiness

> Updated 2026-08-19. This is the current-state companion to the longer product plan. It separates shipped capability, automated evidence, and evidence that only real participants can provide.

## Status language

- **Shipped:** present in the current product and covered by a repository check.
- **Ready for pilot:** the collection path exists, but no real-participant result is claimed.
- **Needs real evidence:** code or synthetic fixtures cannot complete the item honestly.
- **Later by decision:** intentionally outside the pre-PMF product boundary.

## First-release capability audit

| Product-plan item                                            | Status                       | Current evidence                                                                                                             | Remaining proof                                                                  |
| ------------------------------------------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Outcome-first operating-review entry                         | Shipped                      | Full-screen Setup Assistant and empty-workspace task actions; Playwright fresh-user flow                                     | Observe whether target users choose it without coaching                          |
| Real file import and field mapping                           | Shipped                      | CSV/JSON/XLSX/ODS reviewed import and exact operating-review scope/field compiler tests                                      | Score failures on authorized real files                                          |
| Data → Query → Chart → Report/Deck                           | Shipped                      | Golden Tasks and runtime-preflight tests cover the complete chain                                                            | Complete and score real operating reviews                                        |
| Preview, lineage, concrete diff, transaction impact          | Shipped                      | Render, dependency, proposal-preview, transaction-review, and provenance tests                                               | Test whether non-technical users understand the summary                          |
| Review → Apply → checkpoint → restore                        | Shipped                      | Atomic patch, stale-revision, checkpoint, and persistence tests                                                              | Measure Apply, error detection, and recovery behavior                            |
| Office/PDF/HTML delivery                                     | Shipped                      | Deterministic export, round-trip, fixed-PDF, and QA generators                                                               | Human-score visual deliverability on real outputs                                |
| Task duration, success, provider usage, and delivery outcome | Shipped                      | Versioned device evidence ledger and bounded delivery confirmation tests                                                     | Collect authorized real outcomes; device evidence alone does not prove demand    |
| Reusable task workflow                                       | Shipped                      | Identity-stable operating-review reruns and source-linked presentation refresh tests                                         | Observe a second real cycle on another date                                      |
| Clear failure repair                                         | Shipped for compiler preview | Bounded localized preview diagnostics and exact Source navigation tests                                                      | Find the highest-frequency real-task blockers                                    |
| Weekly/monthly use                                           | Ready for pilot              | Cadence presets plus exact typed period/scope and comparison contracts support recurring reviews without guessing the period | Determine whether weekly or monthly is the stronger job                          |
| Real-task evaluation                                         | Ready for pilot              | Reviewed seven-dimension outcome capture, anonymous export, strict cohort aggregation                                        | Current verified-human baseline remains 0/20                                     |
| Budgeted multi-provider routing                              | Shipped                      | Capability manifests, per-task input/output ceilings, explicit failover authorization, health cooldown, and route tests      | Calibrate provider-specific budgets from authorized real-task usage              |
| Connected-folder change detection                            | Shipped                      | Native observer plus bounded metadata polling fallback; external changes still require validated, confirmed Pull             | Observe whether real recurring workflows benefit from the notification           |
| Scanned-PDF OCR region selection                             | Shipped                      | Explicit local preview, paper-aligned pointer/keyboard crop, conversion-side validation, crop provenance, and zero-write E2E | Determine which additional OCR languages or multi-region layouts real files need |

## Evidence gates that remain open

These items must not be closed with synthetic fixtures, seeded localStorage, staff-authored ratings, or fabricated payments.

| Gate                  | Required evidence                                                                                                                                                          | Current verified state                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| P1 problem validation | 15 interviews; at least 8 repeat monthly, 5 spend over two hours or bear material error cost, and 7 agree to a real task                                                   | Exact locked-cohort evaluator exists; no verified interviews                            |
| P2 outcome validation | 10 comparable real tasks; median time at least 50% lower, at least 70% usable/minor-edit, 100% generated key-number traceability, at least 60% Apply, zero safety redlines | Exact paired-task protocol and local gate evaluator exist; 0 verified-human pilot tasks |
| Pilot entry           | 20 authorized or redacted, fully reviewed tasks with number correctness at least 4                                                                                         | 0/20                                                                                    |
| P3 reuse              | At least 40% of evaluated participants complete a second reviewed task on another date within 28 days                                                                      | No real recurrence packages                                                             |
| P4 payment            | At least 10 explicit quotes, 5 paying teams and 30% conversion among qualified pilots, continuation, viable contribution, and a repeatable acquisition path                | Fixed protocol and commercial evaluator exist; no authorized commercial record          |
| P5 PMF search         | At least 10 paying teams, 60% four-week active retention, 85% deliverability, 20% referral/case acquisition, viable unit economics                                         | Not started; entry conditions unmet                                                     |

## Repository verification

Run the current deterministic gate from a clean dependency install:

```bash
npm ci
npm test
npm run lint
npm run typecheck
npm run format:check
npm run test:e2e
npm audit --omit=dev --audit-level=high
```

This proves engineering contracts only. Follow [`docs/pilot/README.md`](pilot/README.md) for authorized real-task collection and local cohort aggregation. Participant identity, consent records, source material, interview notes, and payment records belong in separately approved systems and must not be committed here.
