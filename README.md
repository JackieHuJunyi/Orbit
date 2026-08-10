# Rune

Rune is an AI-native workspace for documents, data, and presentations. It keeps Markdown, CSV/JSON, and semantic HTML as readable source, then renders each artifact live in one focused workbench.

## Status

The project has a working local-first vertical slice. Product reasoning lives in [`idea.md`](idea.md), architectural contracts in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and one-line milestones in [`PROGRESS.md`](PROGRESS.md).

## Development

```bash
npm install
npm run dev
```

Then open the local URL printed by the development server.

Rune always includes a deterministic local planner. To enable model-generated reviewable patches, copy `.env.example` to `.env.local`, set `OPENAI_API_KEY` in that local file, and optionally choose `OPENAI_MODEL`. Keys stay server-side and must never be committed.

## Checks

```bash
npm run build
npm test
npm run lint
```
