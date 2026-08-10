# Rune

Rune is an AI-native workspace for documents, data, and presentations. It keeps Markdown, CSV/JSON, DuckDB SQL, and semantic HTML as readable source, then renders each artifact live in one focused workbench.

## Status

The project has a working local-first vertical slice: four live artifact modes, shared metric bindings, browser-local SQL, persistent device checkpoints, and reviewable atomic Agent patches across one file or a coordinated workspace. Product reasoning lives in [`idea.md`](idea.md), architectural contracts in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and one-line milestones in [`PROGRESS.md`](PROGRESS.md).

## Development

```bash
npm install
npm run dev
```

Then open the local URL printed by the development server.

Rune always includes deterministic local planners for file and workspace actions. To enable model-generated reviewable patches, copy `.env.example` to `.env.local`, set `OPENAI_API_KEY` in that local file, and optionally choose `OPENAI_MODEL`. Keys stay server-side and must never be committed. Workspace plans can update up to four canonical sources, but nothing is written until the complete next workspace validates and every changed file has a safety checkpoint.

Opening a `.sql` artifact lazily downloads a version-pinned DuckDB-Wasm runtime. CSV/JSON rows and query execution stay in the browser; the hosted app does not need a database for this workflow.

## Checks

```bash
npm run build
npm test
npm run lint
npm run typecheck
```
