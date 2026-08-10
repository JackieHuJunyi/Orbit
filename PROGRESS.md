# Progress

- 2026-08-11 — Defined Rune as an artifact-as-code workspace and documented the low-cost expansion architecture.
- 2026-08-11 — Built the first local-first workbench with live Markdown, CSV/JSON, and sandboxed HTML artifact previews.
- 2026-08-11 — Added reviewable local Agent patches, undo checkpoints, import, download, validation, and device persistence.
- 2026-08-11 — Added a product-specific Rune social card and host-aware sharing metadata.
- 2026-08-11 — Connected the validated Rune source to its private Sites project for repeatable deployments.
- 2026-08-11 — Linked reports and slides to named metrics derived from the same canonical CSV source.
- 2026-08-11 — Added live lineage indicators so users can see which data source compiles each artifact.
- 2026-08-11 — Added a provider-neutral Agent endpoint with schema-validated OpenAI patches and a deterministic local fallback.
- 2026-08-11 — Added a read-only DuckDB SQL artifact that runs canonical CSV/JSON data inside the browser and renders a bounded live grid.
- 2026-08-11 — Replaced transient undo state with persistent per-artifact checkpoints for Agent writes, manual saves, and safe restores.
- 2026-08-11 — Upgraded the runtime dependency floor and added typechecking so the production dependency audit is clear.
- 2026-08-11 — Added reviewable multi-artifact Agent plans with whole-workspace validation, atomic apply, and a safety checkpoint for every changed source.
- 2026-08-11 — Added a validated Chart JSON artifact whose live model compiles from canonical data into both Markdown reports and sandboxed HTML slides.
- 2026-08-11 — Added explicit browser folder Pull/Push for real source files, with a readable manifest, bounded validation, and pre-pull checkpoints.
- 2026-08-11 — Made bounded Deck Markdown the canonical presentation source and compiled it into escaped, automatically numbered, sandboxed HTML while retaining legacy deck compatibility.
- 2026-08-11 — Added atomic browser-local semantic import from DOCX to Markdown, visible XLSX sheets to CSV, and PPTX to compiled Deck Markdown with explicit fidelity warnings.
- 2026-08-11 — Added a keyboard-accessible import review transaction that exposes every generated source preview and fidelity warning before one atomic device write.
- 2026-08-11 — Added deterministic browser-local Markdown→DOCX, CSV/JSON→XLSX, and Deck Markdown→PPTX export with fidelity review before download.
