# Orbit

**A source-first workspace for documents, data, and presentations.**

Orbit keeps readable files at the center of the workflow. Edit the source or its linked preview, ask an AI model to propose changes, review the result, and export when it is ready. Your files and decisions stay under your control.

Current source version: **Orbit v1.65**.

## What works today

- Create and edit Markdown documents, CSV/JSON data, DuckDB SQL queries, charts, and semantic HTML presentations.
- Navigate between source and preview; edit supported text, cells, and slides directly in the preview.
- Import and export Office, OpenDocument, PDF, HTML, and source formats through reviewed local workflows.
- Connect model accounts, API providers, Ollama, or LM Studio. AI suggestions require review before they change source.
- Keep local workspaces, checkpoints, and reviewed folder synchronization. The interface supports nine languages.

See the [architecture](docs/ARCHITECTURE.md) for the source and review model, and the [changelog](CHANGELOG.md) for the full feature history.

## Run from source

You need Node.js 22.13+ and npm. macOS is the primary desktop development platform; [Windows support](WINDOWS-CHECKPOINT.md) is still being validated. There is no published installer yet.

```bash
git clone https://github.com/JackieHuJunyi/Orbit.git
cd Orbit
npm ci
npm run desktop:dev
```

For browser development, run `npm run dev` and open the local URL it prints. A model connection is optional for local editing; copy `.env.example` to `.env.local` only when you need deployment model settings. Never commit credentials.

## Contribute

Issues and focused pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for development checks and review expectations. Report vulnerabilities through [SECURITY.md](SECURITY.md).

## License

Orbit's original source code is available under the [MIT License](LICENSE). Bundled fonts, OCR data, and PDF runtimes have their own licenses; see [third-party notices](THIRD_PARTY_NOTICES.md).
