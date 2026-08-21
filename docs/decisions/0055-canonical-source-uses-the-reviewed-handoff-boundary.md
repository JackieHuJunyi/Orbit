# ADR 0055: Canonical source uses the reviewed handoff boundary

## Status

Accepted for Rune v1.39.

## Context

Rune's core claim is that Markdown, CSV/JSON, SQL, Chart JSON, and semantic HTML are first-class AI-readable files. Converted Office, OpenDocument, standalone HTML, and PDF already crossed one local review-before-download transaction, but the most important “Canonical source” menu item still called a Workbench helper that immediately created an object URL. It had no shared capability, byte ceiling, fidelity review, stale-workspace confirmation, or explicit distinction between exact source references and frozen portable output.

Keeping that exception would make the source-first promise less trustworthy than compatibility export. It would also force future source kinds to update UI MIME branching outside the export registry.

## Decision

Every Artifact receives a `source` capability in `workspace-file-export.ts`. The exact target derives only from canonical metadata: Document → MD, CSV/JSON Data → its existing format, Query → SQL, Chart → CHART.JSON, semantic HTML Presentation → HTML, and compatible Deck → DECK.MD.

The existing lazy export runtime owns a bounded canonical-source converter. It UTF-8 encodes the exact source string, preserves the exact filename, rejects output above 12 MB, and marks the handoff as `canonical-source`. It deliberately does not run Query evidence, resolve bindings, or read local image bytes. Instead it reports that live bindings remain expressions, `rune-asset` ids need the connected asset closure, SQL expects `workspace_data`, Chart JSON retains source identity, exact Data is not formula-sanitized, and canonical HTML is not necessarily a standalone frozen handoff.

Workbench no longer owns a direct source downloader. Selecting Canonical source prepares the normal pending export with an exact base-workspace reference. The shared localized review distinguishes readable source from converted output; Cancel creates no file, a changed workspace rejects confirmation, and Confirm is the only path that creates the object URL. Existing task-evidence behavior remains narrow: MD and compatible DECK.MD can confirm a guided deliverable, while source Data, Query, Chart, and non-standalone HTML do not claim a completed output merely because bytes were downloaded.

## Consequences

All readable formats promised by the product now have a visible, reviewed, byte-exact handoff path. Query and Chart can leave Rune as source without being misrepresented as frozen deliverables. The eager Workbench shrinks to 6,102 lines and 525,221 minified bytes; the lazy runtime grows to 7,434 bytes and remains outside startup.

Canonical source is intentionally not self-contained when its readable expressions reference workspace data or local assets. Rune communicates that boundary instead of silently compiling, embedding, or rewriting the file.
