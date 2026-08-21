# ADR 0066: DuckDB runtime is a same-origin build asset

- Status: Accepted
- Date: 2026-08-21
- Release: Rune v1.50

## Context

Rune pins the DuckDB-Wasm JavaScript package, but the browser runtime still fetched its worker and 33–38 MB Wasm binary from jsDelivr on first use. A Data edit must rerun every impacted Query before Rune may write. Slow or unavailable CDN delivery could therefore leave that reviewed edit indefinitely in its disabled verification state even though all canonical sources and the matching runtime package were already on the device. Extending the UI timeout would hide the dependency rather than make the operation reliable.

The existing OCR path already establishes the repository's generated-runtime pattern: exact pinned npm binaries are copied into a gitignored `public` directory before development, build, tests, or production start.

## Decision

`prepare-duckdb.mjs` copies the pinned MVP worker/Wasm pair from `node_modules/@duckdb/duckdb-wasm/dist` into `public/duckdb`. `prepare:runtime` owns both OCR and DuckDB preparation and is a prerequisite of development, production build, production start, and the direct unit suite. Generated binaries remain outside Git. Rune deliberately uses DuckDB's broadly compatible MVP baseline: repeated clean Chromium runs exposed an intermittent `function signature mismatch` in the optional exception-handling variant, while the product does not require that optional Wasm feature.

`duckdb-client.ts` constructs absolute same-origin URLs for the pair and starts the same-origin worker directly. It fetches at most 45 MB of Wasm from that exact origin and wraps the verified bytes in an `application/wasm` Blob before handing them to DuckDB. This keeps streaming compilation correct even when a local or deployment static server labels an otherwise valid `.wasm` file as `application/octet-stream`.

Initialization, including the same-origin fetch, is bounded to thirty seconds. Failure aborts the fetch, terminates the worker, revokes the typed Blob URL, clears the cached promise, and returns a visible runtime error through the existing preflight boundary; it never leaves a visual edit or reviewed transaction pending forever. The complete browser release suite runs serially so independent contexts do not concurrently instantiate copies of the large local runtime and turn resource pressure into unrelated lazy-loading or animation noise; focused stress cases still repeat the critical SQL and Presentation paths separately.

Preview-owned Query snapshots start only after a 1.2-second idle window and carry an AbortSignal through the serialized queue. Leaving a Query-backed Document or Chart before that window avoids starting the heavy runtime at all; leaving later stops obsolete queued work at safe database boundaries while preserving a completed shared initialization for the next current consumer. A Data edit therefore cannot spend one cold start on a preview the user already left and then begin a second cold start for the actual save.

## Consequences

- Query preview and Data/Query/Chart preflight no longer depend on a third-party CDN or its latency.
- The build/deployment output grows by one compatibility bundle, while the Git repository does not.
- Existing browser-local data, snapshot, lineage, and review contracts do not change.
- An installable fully offline application still needs an explicit app-shell caching and update contract.

## Verification

- Unit tests compare every prepared asset byte size with its pinned npm source, reject remote runtime URLs, and require the bounded typed-Wasm normalization.
- Chromium starts from an empty browser cache and completes a Data-cell save through both impacted Queries.
- Missing or stalled runtime initialization fails through the existing zero-write error path within a fixed bound.
- The normal typecheck, production build, render/architecture, full unit, and full browser gates remain required.
