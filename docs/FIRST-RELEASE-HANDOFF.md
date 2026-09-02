# Rune first-release handoff

> Originally audited 2026-08-21 and refreshed 2026-09-02 against Rune v1.53. This document separates repository completion from product-market evidence so the next iteration starts from a real gap rather than rebuilding shipped capability.

## Completion decision

The repository now implements the complete first-release thesis defined in [`idea.md`](../idea.md): one source-first workspace where a human and an Agent can create, inspect, validate, review, apply, recover, and deliver connected Document, Data, Query, Chart, and Presentation artifacts.

This is an **engineering-complete first release**, not a claim of product-market fit. The product can perform and verify the intended workflow; whether target users value, understand, reuse, and pay for it still requires authorized real-world evidence.

## Requirement-to-evidence audit

| Requirement                                                        | Status   | Authoritative repository evidence                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feasibility analysis and implementation plan                       | Complete | `idea.md` defines the source-of-truth thesis, scoped MVP, architecture, trust model, and staged decisions; `docs/ARCHITECTURE.md` records the implemented boundaries.                                                                                                                           |
| Extensible, low-cost foundation                                    | Complete | Web-first Vinext/React shell, local-first device state, typed Artifact adapters, deferred import/export runtimes, provider-independent Agent contracts, and Cloudflare-compatible build are enforced by architecture and render tests. D1 and R2 remain intentionally undeclared.               |
| Document, Data, Query, Chart, and Presentation in one workspace    | Complete | Adapter-registry, workspace, dependency-graph, bindings, Query runtime, Chart, semantic HTML, and render tests cover all five canonical families and their shared graph.                                                                                                                        |
| Overleaf-like Source and Preview                                   | Complete | Split, Source, and Preview views stay mounted on one revision. `e2e/source-preview-sync.spec.ts` proves Preview → exact Source selection and Source → Preview highlighting/scroll recovery for long Markdown, CSV, JSON, and semantic HTML.                                                     |
| Live editing in both directions                                    | Complete | `e2e/visual-live-sync.spec.ts` proves Source edits immediately recompile Document, CSV/JSON Data, and semantic HTML; right-side Document, Data, Chart, and Presentation edits mirror a complete candidate source, then Cancel exactly or Save canonically.                                      |
| AI-native, review-before-write Agent                               | Complete | Selection, File, and Workspace scopes produce bounded typed operations, exact diffs, complete candidate Source/Preview, runtime preflight, one bounded compiler repair, atomic Apply, zero-write Discard, and checkpoints. Agent proposal Chromium tests prove the real interaction.            |
| Data → Query → Chart → report/presentation                         | Complete | Deterministic task providers, DuckDB-Wasm runtime gates, Golden Tasks, operating-review tests, and cross-artifact binding tests prove one input can generate and refresh the complete connected chain.                                                                                          |
| Import readable, Office, OpenDocument, and PDF files               | Complete | The ordered adapter accepts Markdown, CSV, JSON, SQL, Chart JSON, semantic HTML, Deck Markdown, DOCX/XLSX/PPTX, ODT/ODS/ODP, and PDF; Rune Desktop adds DOC/PPT. Conversion is local, bounded, reviewed, and atomic, including supported images and explicit scan OCR.                          |
| Export canonical, Office, OpenDocument, HTML, and PDF deliverables | Complete | One capability registry and lazy runtime provide exact source, CSV/JSON, DOCX/XLSX/PPTX, ODT/ODS/ODP, standalone HTML, and fixed PDF; Rune Desktop adds DOC/PPT. Review, stale-context checks, deterministic package tests, round trips, and independent QA protect the boundary.               |
| Welcome, language, personal model setup, tutorial, and local guide | Complete | Server-first handwriting, all six UN official languages plus Traditional Chinese, Japanese, and Korean, device locale recommendation, secure multi-provider profiles, four real shortcut lessons, and the editable local guide are covered by localization, welcome, route, and Chromium tests. |
| Empty workspace file drop/open/create                              | Complete | `EmptyWorkspace` exposes outcome-first tasks, drag/drop, file picker, blank creation, sample recovery, and local-guide continuity; localized desktop/compact Chromium geometry covers all nine locales.                                                                                         |
| Safe concurrent operation ownership                                | Complete | Rune v1.49 compiles all reviewed owners and asynchronous phases through one immutable fail-closed gate; confirmation-time ownership and cross-browser shortcut collision tests prevent competing reviews.                                                                                       |
| Progress and decision history                                      | Complete | `PROGRESS.md` gives one sentence per shipped milestone; `CHANGELOG.md` and numbered ADRs retain detailed rationale and verification.                                                                                                                                                            |
| Main branch handoff                                                | Complete | The Release quality workflow runs test, E2E, and quality jobs for every `main` push and pull request; the current commit and run remain Git/GitHub facts rather than copied moving identifiers in this document.                                                                                |

## What remains open

The remaining gates are external product evidence, not missing repository features:

1. P1: conduct the fixed fifteen-interview problem cohort.
2. P2: run ten comparable authorized real tasks and measure time, usability, Apply rate, traceability, and safety.
3. Pilot entry: collect twenty fully evaluated authorized or redacted tasks with number correctness at least four.
4. P3: observe second-task recurrence on another date within twenty-eight days.
5. P4/P5: establish paid continuation, acquisition, retention, deliverability, and viable unit economics.

Use [`docs/pilot/README.md`](pilot/README.md) and the existing local evaluators. Do not seed, fabricate, or commit participant identity, source files, consent records, interview notes, or payment evidence.

## Rule for the next code milestone

Do not add collaboration, cloud sync, a connector, richer charts, more OCR packages, enterprise permissions, Git mutation, or another format because it is merely plausible. Start a code milestone only when a named real task supplies the contract listed in [`DELIVERY-READINESS.md`](DELIVERY-READINESS.md). Reuse the existing adapter, operation-owner, validation, review, recovery, and zero-partial-write boundaries rather than adding a second path.

## Reproduction gate

From a clean checkout, the handoff is reproducible with the repository verification sequence in [`DELIVERY-READINESS.md`](DELIVERY-READINESS.md). Rune v1.53 passes 702 unit tests, 29 render/architecture tests, 68 scenarios in each of Chromium, Firefox, and WebKit (204 browser executions), the 20/20 synthetic Golden Task Eval, formatting, lint, typecheck, production build, and the high-severity production dependency audit.
