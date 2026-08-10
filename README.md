# Rune

Rune is an AI-native workspace for documents, data, and presentations. It keeps Markdown, CSV/JSON, DuckDB SQL, declarative Chart JSON, and Deck Markdown as readable source, then renders each artifact live in one focused workbench. Legacy semantic HTML decks remain import-compatible.

## Status

The project has a working local-first vertical slice: five live artifact modes, shared metric and chart bindings, browser-local SQL, semantic Office Open XML import/export, portable standalone Deck HTML, persistent device checkpoints, artifact-aware Agent operations, reviewable atomic patches, and explicit sync with user-owned source folders. Product reasoning lives in [`idea.md`](idea.md), architectural contracts in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and one-line milestones in [`PROGRESS.md`](PROGRESS.md).

## Development

```bash
npm install
npm run dev
```

Then open the local URL printed by the development server.

Rune always includes deterministic local planners for file and workspace actions. To enable model-generated reviewable patches, copy `.env.example` to `.env.local`, set `OPENAI_API_KEY` in that local file, and optionally choose `OPENAI_MODEL`. Keys stay server-side and must never be committed. Instead of resending whole files, the model returns at most eight typed operations per file: replace or insert a Markdown section by heading, upsert a typed CSV/flat-JSON row by unique key, replace or insert a Deck slide by title, or use an exact `find → replace` fallback for precise inline and structural edits. Rune rejects missing, ambiguous, or artifact-incompatible targets and compiles valid operations into the concrete diff shown in review. Workspace plans can update up to four canonical sources, but nothing is written unless the source revision is still current, the complete next workspace validates, and every changed file has a safety checkpoint.

Opening a `.sql` artifact lazily downloads a version-pinned DuckDB-Wasm runtime. CSV/JSON rows and query execution stay in the browser; the hosted app does not need a database for this workflow.

Chart artifacts use a bounded `.chart.json` schema that names an existing data artifact and exact category/value columns. The same `{{ chart("artifact-id") }}` reference compiles into a React chart inside Markdown and escaped static HTML inside the sandboxed slide runtime; schema drift blocks the whole pending workspace transaction.

Presentation source uses a bounded `.deck.md` grammar: strict versioned frontmatter, `---` slide separators, controlled layout and eyebrow metadata, and a small set of Markdown blocks. Rune rejects raw HTML, escapes user text, owns layout and numbering, then compiles the source into a scriptless sandboxed HTML runtime. The same compiler can freeze the current metrics and charts into a downloadable single-file presentation. Metric and chart references stay readable in the deck source; legacy `.html` presentations still open through the same sandboxed compatibility path.

**Import** accepts modern `.docx`, `.xlsx`, and `.pptx` files without uploading them. A lazily loaded browser converter maps DOCX structure to Markdown, each visible XLSX worksheet to a separate CSV artifact, and ordered PPTX text/tables to Deck Markdown that immediately compiles to HTML. The contract targets semantic fidelity: images, comments, slide charts, complex styling, macros, and legacy binary `.doc/.xls/.ppt` are not silently guessed. Rune validates the complete batch and resolves collisions, then opens a keyboard-accessible review with every generated filename, a bounded source preview, and all omission warnings. Only explicit confirmation performs the single device write; cancel, stale workspace context, validation failure, or storage failure leaves the current workspace unchanged.

**Office export** performs the reverse compatibility handoff without changing canonical source. Markdown becomes semantic DOCX, CSV/JSON becomes a values-only XLSX worksheet, and Deck Markdown becomes a 16:9 PPTX with ordered text, bullets, tables, a slide master, layout, and Rune theme. Workspace metrics are compiled before packaging. A referenced Chart artifact becomes a current-data semantic bar table in DOCX and editable native text/vector shapes in PPTX; image and runtime features that still cannot be represented are called out rather than guessed. Every package is deterministic, generated locally with standard OOXML parts, and held behind the same keyboard-accessible fidelity review before one browser download. The original `.md`, `.csv/.json`, and `.deck.md` download remains available beside it.

**Standalone HTML export** turns a Deck Markdown artifact into one portable, scriptless `.html` file. It resolves current workspace metrics and Chart artifacts before export, embeds all styling, contains no external resources, and adds print rules that place each 16:9 slide on its own page for browser PDF handoff. The deterministic file is capped at 2 MB and uses the same stale-context check and explicit review-before-download transaction as Office export.

On browsers that implement the File System Access API, **Open folder** connects Rune to real source files plus a readable `rune.workspace.json` manifest. Pull validates the complete folder and checkpoints every current artifact before replacing device state. Push is always explicit, overwrites only matching artifact names after confirmation, and leaves unrelated files untouched. The handle is intentionally session-scoped; regular import and per-file download remain available as fallbacks.

## Checks

```bash
npm run build
npm test
npm run lint
npm run typecheck
```
