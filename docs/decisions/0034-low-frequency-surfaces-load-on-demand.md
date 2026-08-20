# ADR 0034: Low-frequency surfaces load on demand

- Status: accepted
- Date: 2026-08-21
- Scope: Client composition, startup performance, and localized interaction surfaces

## Context

The v1.17 Workbench minified to 701,634 bytes even after locale and compatibility runtimes were deferred. Thirteen presentation surfaces remained statically imported: the first-run welcome, command menu, transaction map, OCR setup, and create/import/export/task review dialogs. Most are absent from an ordinary editing session, yet every user downloaded their component logic and complete copy before the handwritten welcome or workspace could hydrate.

Moving components alone is insufficient. Workbench-owned notices reuse several dialog strings, so importing a dialog's copy object from the eager graph would pull the component back into the same chunk. A loading boundary must also remain visible, localized, accessible, and unable to mutate workspace state.

## Decision

Each low-frequency surface is a same-origin static `React.lazy` entry with its existing typed props. `RuneWorkbench` continues to own open state, canonical artifacts, prepared reviews, persistence, and every mutation handler. Deferred components consume values and return explicit events; they do not become plugins or state owners.

Three localized `Suspense` fallback geometries cover the full-screen welcome, blocking overlays, and inline transaction lineage. Every fallback is a non-mutating `role=status` with polite live announcement, a bounded visual progress treatment, reduced-motion and forced-color behavior, and no network, provider, storage, or Artifact dependency.

Shared eager notice and local-image action strings live in `workbench-surface-copy.ts`, a React-free localization port composed back into the deferred dialogs. The interface-locale generator explicitly scans its English base constants, preserving the existing load-before-synchronous-use contract for French, Spanish, Russian, Arabic, Japanese, and Korean.

The production manifest must expose all thirteen modules as dynamic entries from Workbench. The minified Workbench budget is 530,000 bytes, with a separate source test rejecting eager runtime imports and proving a non-blank localized fallback remains present.

## Consequences

- The minified initial Workbench falls from 701,634 to 489,283 bytes; gzip falls from 210,332 to 143,333 bytes.
- A first visit can render a small localized preparation surface while the welcome module loads, then run the existing spectrum-ink handwriting without changing onboarding state.
- Opening a low-frequency action incurs one local chunk fetch; subsequent opens use the browser module cache.
- Component boundaries remain static and first-party. Runtime plugin discovery, remote code, alternate persistence, and additional mutation authority are not introduced.
