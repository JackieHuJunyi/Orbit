# Rune

Rune is an AI-native workspace for documents, data, and presentations. It keeps Markdown, CSV/JSON, DuckDB SQL, declarative Chart JSON, and semantic HTML as readable source, then renders each artifact live in one focused workbench.

## Status

The project has a working local-first vertical slice: five live artifact modes, shared metric and chart bindings, browser-local SQL, persistent device checkpoints, reviewable atomic Agent patches, and explicit sync with user-owned source folders. Product reasoning lives in [`idea.md`](idea.md), architectural contracts in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and one-line milestones in [`PROGRESS.md`](PROGRESS.md).

## Development

```bash
npm install
npm run dev
```

Then open the local URL printed by the development server.

Rune always includes deterministic local planners for file and workspace actions. To enable model-generated reviewable patches, copy `.env.example` to `.env.local`, set `OPENAI_API_KEY` in that local file, and optionally choose `OPENAI_MODEL`. Keys stay server-side and must never be committed. Workspace plans can update up to four canonical sources, but nothing is written until the complete next workspace validates and every changed file has a safety checkpoint.

Opening a `.sql` artifact lazily downloads a version-pinned DuckDB-Wasm runtime. CSV/JSON rows and query execution stay in the browser; the hosted app does not need a database for this workflow.

Chart artifacts use a bounded `.chart.json` schema that names an existing data artifact and exact category/value columns. The same `{{ chart("artifact-id") }}` reference compiles into a React chart inside Markdown and escaped static HTML inside the sandboxed slide runtime; schema drift blocks the whole pending workspace transaction.

On browsers that implement the File System Access API, **Open folder** connects Rune to real source files plus a readable `rune.workspace.json` manifest. Pull validates the complete folder and checkpoints every current artifact before replacing device state. Push is always explicit, overwrites only matching artifact names after confirmation, and leaves unrelated files untouched. The handle is intentionally session-scoped; regular import and per-file download remain available as fallbacks.

## Checks

```bash
npm run build
npm test
npm run lint
npm run typecheck
```
