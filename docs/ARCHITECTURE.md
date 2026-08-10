# Rune Architecture

Rune is an AI-native artifact workspace. Human-readable source is canonical; editors, previews, exports, and agents are replaceable clients of that source.

## Product boundary

The first release is a local-first vertical slice, not an Office compatibility suite. It must make three artifact types feel like one product while keeping their compilers independent.

```text
Workbench UI
  ├─ Workspace state and persistence
  ├─ Agent command surface
  └─ Artifact registry
       ├─ Markdown adapter → document preview
       ├─ Data adapter     → parsed grid
       └─ Slides adapter   → sandboxed HTML runtime
```

## Stable contracts

An artifact adapter owns its default source, source language, validation, display metadata, and preview. The workbench owns selection, persistence, history, and agent actions. This boundary lets us add SQL, charts, Deck DSL, DOCX import, or a desktop filesystem without rewriting the shell.

Agent operations should converge on this contract:

```ts
type ArtifactPatch = {
  artifactId: string;
  baseRevision: string;
  operations: Array<
    | { type: "replace-range"; from: number; to: number; text: string }
    | { type: "replace-source"; source: string }
  >;
  rationale: string;
};
```

The UI may preview a patch, accept or reject it, validate the next source, create a checkpoint, and only then persist it. Model providers never write workspace state directly.

## Persistence ladder

1. v0 stores non-sensitive drafts in browser storage and offers reset/export affordances.
2. v1 adds File System Access API with a storage port; a desktop shell can implement the same port later.
3. Collaboration adds an operation log and CRDT only after multi-user demand is proven.
4. D1/R2 remain undeclared until durable hosted projects or assets are required.

This avoids paying for identity, databases, and sync before they improve the core loop.

## Security boundaries

- Markdown is rendered as React elements and does not execute embedded HTML.
- Slide source runs in an iframe with a restrictive sandbox and no same-origin access.
- CSV and JSON parsing is local and must expose validation errors rather than guessing silently.
- Provider keys belong in server-side secrets; they are never committed or stored in browser drafts.
- Imported files will receive size, MIME, and formula-injection checks before export features ship.

## Evolution path

| Stage | Capability | Infrastructure added only then |
| --- | --- | --- |
| Foundation | Three live artifact editors | Client adapters and local persistence |
| Trust | Patch preview, undo, checkpoints | Revision log |
| Intelligence | Provider-backed structured actions | Agent API and eval fixtures |
| Data loop | SQL, charts, shared metrics | DuckDB-Wasm and dependency graph |
| Collaboration | Shared projects | Auth, D1 metadata, R2 assets, Yjs transport |
| Compatibility | Office import/export | Isolated conversion workers |

## Quality gates

Every milestone needs a production build, unit coverage for parsers and patch application, one end-to-end golden workspace, accessible keyboard operation, and a one-sentence entry in `PROGRESS.md`. Provider-backed behavior also needs deterministic eval fixtures before it becomes a default path.
