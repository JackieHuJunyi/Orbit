# ADR 0083: Signed-in model catalogs are account-authoritative

- Status: Accepted
- Date: 2026-09-14
- Release: Orbit v1.64

## Context

Orbit v1.63 gave ChatGPT/Codex profiles a concrete model and reasoning picker, but its signed-in path expanded a static Luna/Terra/Sol allowlist. That list could not represent older models still available to one account, new models released later, workspace restrictions, or different effort sets such as Ultra on one family but not another. Public model documentation is not an entitlement API: the models available to a person depend on the client and login scope.

The installed Codex App Server exposes a stable `model/list` JSON-RPC method for rendering selectors. Each visible row carries its model ID, display name, default effort, supported efforts, input modalities, default status, and optional upgrade metadata. OpenAI's product guidance also places model and reasoning controls beneath the composer rather than in a remote setup-only screen.

## Decision

For a ready ChatGPT/Codex account, Orbit starts the already-installed `codex app-server` over stdio with the user's account-owned environment and Orbit's existing credential exclusions. It sends `initialize`, the `initialized` notification, then bounded `model/list` pages with `includeHidden: false`. The bridge accepts only syntactically bounded model IDs and known reasoning-effort values, preserves returned order, flattens each family into exact model-plus-effort selections, and chooses the server-reported default during discovery.

The resulting catalog remains inside the desktop process and a short session cache. React receives only non-secret selection IDs through Orbit's authenticated loopback `/models` surface. A profile persists one selected ID, never the account catalog or OAuth token. Saving, switching, and running all recheck that exact ID against the current desktop catalog. If an older Codex client cannot answer `model/list`, Orbit exposes the frozen v1.63 set as a visible compatibility fallback rather than inventing newer access.

The composer presents connection, model family, and reasoning as separate decisions. Provider tabs remain horizontally swipeable, model families use a vertical scan list, and supported efforts remain a discrete horizontal control. Choosing a family commits its closest supported effort immediately. Scope and suggestions stay secondary to free text; working state, messages, popovers, and send availability use short reduced-motion-safe transitions. Fixed popovers cannot have a transformed Composer ancestor.

The translated “Welcome to Orbit” line continues to use the same spectrum-pencil renderer as the locale greeting. It restarts when language changes, uses duration proportional to written glyph count, and keeps the surrounding setup softly visible instead of blanking the page while the line is drawn.

## Consequences

- Orbit displays what the signed-in Codex client and identity can actually use, not what a public page or static release assumed.
- A new model or effort can appear without an Orbit release when the installed client exposes it.
- Account policy, client support, and API-key entitlements remain distinct and cannot be expanded by editing local UI state.
- Catalog failure stays recoverable for older clients, but fallback results are intentionally limited.
- Dynamic discovery adds one bounded local App Server startup during a fresh device scan; the short cache prevents repeated startup during adjacent picker, validation, and generation actions.
