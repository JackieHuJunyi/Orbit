# ADR 0069: DuckDB Wasm ships as verified same-origin parts

## Status

Accepted for Rune v1.52.

## Context

Rune runs Query artifacts in the browser with the exact pinned DuckDB-Wasm MVP runtime. Its Wasm binary is about 38 MB. Keeping that file on Rune's own origin avoids a third-party runtime fetch and keeps workspace rows inside the browser, but common hosted static-asset manifests reject individual files above 25 MB.

Switching to a CDN would make a core Data capability depend on an additional origin. Moving SQL to a hosted database would change Rune's local-first boundary. Selecting DuckDB's optional exception-handling build would still exceed the hosted limit and previously exposed an intermittent browser trap.

## Decision

`prepare-duckdb.mjs` remains the sole generator for DuckDB browser assets. It reads the exact MVP Wasm from the pinned npm package, removes obsolete generated variants, writes ordered parts of at most 20 MB, and writes a small versioned manifest containing each part name, exact size, and complete byte count. The matching worker is copied unchanged.

The client fetches the manifest and all parts from Rune's origin. It accepts only schema version 1, the fixed bounded filename grammar, one to eight parts, safe positive sizes, and a complete payload below the existing 45 MB ceiling. Every resolved URL must remain same-origin. Each response size and the final byte total must match before Rune constructs one `application/wasm` Blob and starts DuckDB. Any missing, redirected, malformed, partial, oversized, cross-origin, or timed-out runtime fails closed and leaves the cached initializer retryable.

## Consequences

- Local, desktop, test, and hosted builds use the same generated runtime shape.
- No static deployment file exceeds 20 MB, while the executed bytes remain those of the pinned package.
- Rune keeps browser-local SQL and adds no CDN, database, credential, or workspace-data transfer.
- Initialization performs a small manifest request and two Wasm-part requests before compilation; both are bounded by the existing 30-second startup limit.
- Unit coverage proves generated part sizes sum to the pinned source. Real Chromium, Firefox, and WebKit Data-save flows prove the reassembled runtime starts and revalidates downstream work.
