# ADR 0067: release claims have executable cross-browser gates

- Status: Accepted
- Date: 2026-08-23
- Release: Rune v1.51

## Context

Rune v1.50 shipped fixed-canvas Presentations and deterministic same-origin DuckDB assets, but the visible product version and first README entry remained on v1.49. The handoff also described a moving `main` branch with a historical commit, while its test totals no longer represented the current release. Browser evidence covered Chromium only, and Vite's generic 500 KB warning obscured the distinction between Rune's eager Workbench and deliberately deferred PDF/document code.

Repository automation can prevent those engineering claims from drifting. It cannot conduct interviews, authorize real source files, observe recurring use, collect payments, or invent the identity, storage, conflict, retention, and recovery contracts required by collaboration or cloud sync.

## Decision

1. `RUNE_PRODUCT_VERSION` and the root package use v1.51. README, Changelog, Progress, and the current handoff must name that release, enforced by a React-free unit test.
2. The handoff no longer embeds a claim that a moving branch resolves to a fixed commit or workflow run. Git and GitHub remain the authority for the current head and its checks.
3. Every Playwright scenario runs unchanged on Desktop Chrome, Desktop Firefox, and Desktop Safari. Browser-specific exclusions require a future decision with an explicit capability reason. WebKit replays the same proven `srcdoc` bytes once with a small deterministic content-derived stagger because simultaneous live replacements can otherwise leave one frame on an empty document.
4. Runtime-aware accessibility fixtures wait for the same-origin DuckDB result they start before closing. Other short interaction tests intentionally retain product cancellation; their server wrapper filters only the exact expected `duckdb-mvp.wasm: Premature close` line and forwards every other stdout/stderr line unchanged.
5. Rune retains the exact 530,000-byte minified eager Workbench gate. Intentionally deferred PDF/document code receives a separate 1,300,000-byte ceiling, turning a generic bundler warning into an explicit, tested capability budget.
6. Human and commercial evidence stays at its verified baseline. Deferred collaboration, cloud, connector, enterprise, Git, richer-layout, OCR, and offline-distribution ideas remain gated by the contracts in `DELIVERY-READINESS.md`.

## Consequences

Release identity and browser support now fail before a contradictory release can pass CI. The browser job is longer because it executes three engines, but it measures the same product behavior rather than maintaining a weaker smoke path. Lazy export code may be large within its explicit ceiling without hiding startup regressions. A green release still means engineering evidence only; it does not claim demand, usability, recurrence, payment, or product-market fit.
