# Rune Architecture

Rune is an AI-native artifact workspace. Human-readable source is canonical; editors, previews, exports, and agents are replaceable clients of that source.

## Product boundary

The first release is a local-first vertical slice, not an Office compatibility suite. It must make three artifact types feel like one product while keeping their compilers independent.

```text
Workbench UI
  ├─ Workspace state and persistence
  ├─ Agent command surface
  ├─ Dependency compiler
  │    └─ shared data → named metrics / chart models → document / slides
  └─ Artifact registry
       ├─ Markdown adapter → document preview
       ├─ Data adapter     → parsed grid
       ├─ Query adapter    → DuckDB-Wasm result grid
       ├─ Chart adapter    → validated JSON + local semantic bar view
       └─ Slides adapter   → sandboxed HTML runtime
```

## Stable contracts

An artifact adapter owns its default source, source language, validation, display metadata, and preview. The workbench owns selection, persistence, history, and agent actions. This boundary lets us add SQL, charts, Deck DSL, DOCX import, or a desktop filesystem without rewriting the shell.

Agent operations currently use this provider-neutral contract:

```ts
type ArtifactSourcePatch = {
  artifactId: string;
  summary: string;
  detail: string;
  nextSource: string;
};

type WorkspacePatch = {
  summary: string;
  detail: string;
  patches: ArtifactSourcePatch[];
};
```

The UI previews every affected file, its line-change counts, and a bounded concrete source diff before accept/reject. Applying is a transaction: ids must exist and be unique, every source must actually change, each changed adapter must validate, and the complete next workspace must compile without unresolved metric or chart bindings. Rune then creates a pre-change checkpoint for every target and performs one local persistence write before swapping UI state. Any failure keeps the whole current workspace unchanged. Model providers never write workspace state directly.

## Agent provider boundary

`POST /api/agent` is the only model-facing surface in v0. File scope sends one source and requires a schema-conformant `summary`, `detail`, and `nextSource`. Workspace scope sends 2–6 canonical sources within a 180,000-character envelope and requires a top-level rationale plus 1–4 complete file patches whose ids belong to that request. Duplicate or foreign ids are rejected again at the route boundary. The workbench still turns either response into a pending patch; it never applies model output automatically.

The current adapter uses the OpenAI Responses API with Structured Outputs when `OPENAI_API_KEY` is configured and falls back to deterministic file/workspace planners when it is not. `OPENAI_MODEL` is an environment choice rather than an editor dependency, so another provider can implement the same contract later.

## Shared metrics and lineage

Markdown and semantic HTML can reference a named value with `{{ metric("total_revenue") }}` or a reusable view with `{{ chart("regional-revenue-chart") }}`. The dependency compiler derives metrics and chart models from canonical CSV/JSON and substitutes only at render time, so sources stay readable and one data change recompiles every dependent artifact. Each compiled view exposes its source artifact and reference count. SQL and Chart artifacts expose their canonical lineage; the next evolution is a persisted dependency graph for user-defined query outputs and metrics.

## Declarative chart runtime

A `.chart.json` artifact is a strict, versioned view contract: title, description, data artifact id, exact category/value columns, one bounded mark, sort policy, number format, validated color token, and a 1–20 mark limit. It contains no code. The local compiler parses the referenced CSV/JSON, validates every row, sorts and formats values deterministically, and produces one shared chart model.

Markdown renders that model as React elements. Slides compile the same model into escaped static HTML before assigning `srcDoc`; labels and titles cannot become markup, and the iframe remains scriptless. Whole-workspace patch validation recompiles every chart after a data or schema edit, so renaming a bound column cannot silently break downstream reports or decks.

## Browser-local SQL runtime

The Query adapter treats `.sql` as canonical source and lazily starts DuckDB-Wasm only when a query preview is opened. Before each run, the first canonical CSV/JSON artifact is registered inside the browser worker and materialized as `workspace_data`. Rune accepts one `SELECT` or `WITH` statement, wraps it as a subquery, and requests at most 501 rows so the UI can display 500 and report truncation. Queries are serialized to avoid races while source is changing.

The npm wrapper is pinned to a stable version, and matching worker/Wasm binaries are loaded from a version-pinned CDN URL. This keeps the deployed application small and infrastructure-free while rows remain inside the browser. A future offline distribution can serve the same pinned binaries from an asset origin without changing the query contract.

## Checkpoint log

Device history is an append-only, per-artifact list of source snapshots. Applying a file or workspace Agent patch records every affected pre-change source before the atomic write; ⌘S records an explicit manual snapshot; restoring an older snapshot first records a safety checkpoint of the current source. Consecutive identical snapshots are deduplicated, malformed storage is ignored, and each artifact retains at most 24 checkpoints within a 500,000-character budget. Sources over 200,000 characters require export instead of a localStorage snapshot, and quota failures remain visible in the save indicator. Both drafts and checkpoints share the local workspace storage envelope, so refresh no longer destroys the normal undo boundary.

## User-owned folder storage port

The optional File System Access adapter maps each artifact to its existing readable filename and writes one `rune.workspace.json` manifest containing only version, order, ids, kinds, names, and languages. Source never moves into the manifest. A folder without a manifest can be scanned by supported extension and receives stable filename-derived ids; hidden files, subdirectories, and unsupported formats are ignored.

Folder reads are bounded to 50 artifacts, 2 MB per file, and 8 MB total. Rune parses every source, validates unique identity, recompiles metrics and charts, and only then offers to replace device state. An accepted Pull first checkpoints every current artifact and uses one local persistence write, so a bad or oversized folder cannot partially replace the editor. Push is deliberately manual and confirmed: matching filenames may be overwritten, unrelated files are never deleted, and the manifest is written last. Browser filesystem writes do not provide a cross-file transaction, so an interrupted Push reports the exact file where it stopped and never claims atomicity.

## Persistence ladder

1. v0 stores non-sensitive drafts and bounded checkpoint history in browser storage and offers reset/export affordances.
2. v0.4 adds a session-scoped File System Access port with explicit validated Pull and confirmed Push.
3. A desktop shell can implement the same port with directory watching and atomic rename semantics later.
4. Collaboration adds an operation log and CRDT only after multi-user demand is proven.
5. D1/R2 remain undeclared until durable hosted projects or assets are required.

This avoids paying for identity, databases, and sync before they improve the core loop.

## Security boundaries

- Markdown is rendered as React elements and does not execute embedded HTML.
- Slide source runs in an iframe with a restrictive sandbox and no same-origin access.
- CSV and JSON parsing is local and must expose validation errors rather than guessing silently.
- SQL runs in a dedicated browser worker; the preview accepts one read-only query and bounds visible results to 500 rows.
- Chart JSON is strict and code-free; text is React-escaped or HTML-escaped before document and slide rendering.
- Folder manifests reject hidden/path-like names, duplicate identity, missing sources, oversized payloads, and invalid dependency graphs before Pull.
- Provider keys belong in server-side secrets; they are never committed or stored in browser drafts.
- Imported files will receive size, MIME, and formula-injection checks before export features ship.

## Evolution path

| Stage | Capability | Infrastructure added only then |
| --- | --- | --- |
| Foundation | Five live artifact editors | Client adapters and local persistence |
| Trust | Multi-file patch review, atomic apply, persistent checkpoints | Local revision log |
| Intelligence | Provider-backed structured actions | Agent API and eval fixtures |
| Data loop | SQL, shared metrics, and reusable charts | DuckDB-Wasm and dependency graph |
| Collaboration | Shared projects | Auth, D1 metadata, R2 assets, Yjs transport |
| Compatibility | Office import/export | Isolated conversion workers |

## Quality gates

Every milestone needs a production build, typecheck, unit coverage for parsers and patch application, one end-to-end golden workspace, accessible keyboard operation, and a one-sentence entry in `PROGRESS.md`. Provider-backed behavior also needs deterministic eval fixtures before it becomes a default path.
