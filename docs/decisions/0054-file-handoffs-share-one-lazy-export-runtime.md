# ADR 0054: File handoffs share one lazy export runtime

## Status

Accepted for Rune v1.38.

## Context

Rune can hand off canonical Documents, Data, and Presentations as CSV/JSON, modern or legacy Office, OpenDocument, standalone HTML, and fixed PDF. The Workbench previously inferred format availability through three local kind helpers and several booleans, then implemented Query preparation, image loading, binding compilation, and destination dispatch inside one long UI function. Supporting another destination required coordinating menu conditions, target labels, evidence preparation, conversion branches, and tests. The existing review and stale-context transaction was correct, but format knowledge had no single owner.

Moving every writer into an eager generic registry would reduce duplication by regressing startup size. Giving converters download or persistence authority would also collapse the required distinction between preparing bytes and approving their delivery.

## Decision

`workspace-file-export.ts` is a lightweight closed capability table. It maps each canonical Artifact kind to exact destination and target kinds, derives display labels, and deliberately gives Query and Chart no direct file handoff. It imports no writer, DuckDB, or asset implementation.

`workspace-file-export-runtime.ts` is one lazy preparation boundary. It computes the exact referenced Query union, obtains revision-bound snapshots through an injected or lazily loaded runner, rejects truncation, verifies referenced local image closure through a byte port, and compiles bindings for package-style Office or OpenDocument outputs. One exhaustive `Record<WorkspaceFileExportDestination, converter>` then loads and invokes the selected writer. Portable CSV/JSON starts no unrelated Query or image capability.

The runtime returns an `ArtifactExportResult` and cannot create a download, approve warnings, persist, checkpoint, mutate source, or read credentials. `RuneWorkbench` retains the pending export review, exact base-workspace reference, stale rejection, explicit confirmation, and sole object-URL capability. Individual writer limits and fidelity contracts remain unchanged.

## Consequences

Menu visibility and preparation consume one format vocabulary, while all heavy writers remain one lazy level below the Workbench. The minified eager entry is 525,336 bytes under the 530 KB gate, and `RuneWorkbench` falls from 6,255 to 6,125 lines. Adding a destination now requires one capability definition, one exhaustive converter, format-specific limits and fixtures, and the existing review proof rather than another UI dispatch branch.

This is not a runtime plugin system. New writers remain reviewed product code, and their output is still an untrusted compatibility handoff until the user inspects and confirms it.
