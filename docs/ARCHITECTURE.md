# Rune Architecture

Rune is an AI-native artifact workspace. Human-readable source is canonical; editors, previews, exports, and agents are replaceable clients of that source.

## Product boundary

The first release is a local-first vertical slice, not a pixel-fidelity Office compatibility suite. It must make documents, data, and presentations feel like one product while keeping their compilers independent.

```text
Workbench UI
  ├─ Workspace state and persistence
  ├─ Agent command surface
  ├─ OOXML import port
  │    └─ DOCX → Markdown · XLSX → CSV · PPTX → Deck Markdown
  ├─ Export ports
  │    ├─ canonical source → DOCX · XLSX · PPTX
  │    └─ Deck Markdown → portable scriptless HTML
  ├─ Dependency compiler
  │    └─ shared data → named metrics / chart models → document / slides
  └─ Artifact registry
       ├─ Markdown adapter → document preview
       ├─ Data adapter     → parsed grid
       ├─ Query adapter    → DuckDB-Wasm result grid
       ├─ Chart adapter    → validated JSON + local semantic bar view
       └─ Slides adapter   → Deck Markdown compiler → sandboxed HTML runtime
```

## Stable contracts

An artifact adapter owns its default source, source language, validation, display metadata, and preview. The workbench owns selection, persistence, history, and agent actions. This boundary lets us extend SQL, charts, Deck Markdown, Office import, or a desktop filesystem without rewriting the shell.

The provider-facing contract is a bounded, source-native operation plan:

```ts
type AgentSourceOperation = {
  find: string;    // exact, non-empty, unique in the source at this step
  replace: string; // exact replacement; empty means deletion
};

type AgentOperationPatch = {
  artifactId: string;
  summary: string;
  detail: string;
  edits: AgentSourceOperation[]; // 1–8, applied in order
};

type ArtifactSourcePatch = {
  artifactId: string;
  summary: string;
  detail: string;
  nextSource: string; // compiled by Rune, never authored by the provider
  operationCount?: number;
};

type WorkspacePatch = {
  summary: string;
  detail: string;
  patches: ArtifactSourcePatch[];
};
```

Rune applies each operation sequentially to the exact source sent with the request. `find` must occur exactly once in the evolving revision; a missing anchor, repeated anchor, no-op, cancelling sequence, foreign/duplicate artifact id, or output above 120,000 characters rejects the complete model plan. Only then does the server produce `nextSource` and run the artifact or whole-workspace safety gate before responding. The UI previews every affected file, its operation count, line-change counts, and a bounded concrete source diff before accept/reject. Applying repeats the transaction boundary client-side: the captured workspace source revision must still match, ids must exist and be unique, every source must actually change, each changed adapter must validate, and the complete next workspace must compile without unresolved metric or chart bindings. Rune then creates a pre-change checkpoint for every target and performs one local persistence write before swapping UI state. Any failure keeps the whole current workspace unchanged. Model providers never write workspace state directly.

## Agent provider boundary

`POST /api/agent` is the only model-facing surface in v0. File scope sends one source and requires a schema-conformant `summary`, `detail`, and 1–8 exact operations. Workspace scope sends 2–6 canonical sources within a 180,000-character envelope and requires a top-level rationale plus 1–4 operation patches whose ids belong to that request. Each `find` and `replace` field is bounded to 8,000 and 16,000 characters respectively, while provider output is capped at 8,000 tokens. Line numbers and regular expressions are intentionally excluded because they are unstable across edits and harder to verify than literal source anchors. Duplicate or foreign ids are rejected before compilation. The workbench receives only the compiled concrete patch and never applies it automatically.

The current adapter uses the OpenAI Responses API with Structured Outputs when `OPENAI_API_KEY` is configured and falls back to deterministic file/workspace planners when it is not. `OPENAI_MODEL` is an environment choice rather than an editor dependency, so another provider can implement the same contract later.

## Shared metrics and lineage

Markdown and Deck Markdown can reference a named value with `{{ metric("total_revenue") }}` or a reusable view with `{{ chart("regional-revenue-chart") }}`. The dependency compiler derives metrics and chart models from canonical CSV/JSON and substitutes only at render time, so sources stay readable and one data change recompiles every dependent artifact. Each compiled view exposes its source artifact and reference count. SQL and Chart artifacts expose their canonical lineage; the next evolution is a persisted dependency graph for user-defined query outputs and metrics. Imported legacy semantic HTML keeps the same binding syntax for compatibility.

## Declarative chart runtime

A `.chart.json` artifact is a strict, versioned view contract: title, description, data artifact id, exact category/value columns, one bounded mark, sort policy, number format, validated color token, and a 1–20 mark limit. It contains no code. The local compiler parses the referenced CSV/JSON, validates every row, sorts and formats values deterministically, and produces one shared chart model.

Markdown renders that model as React elements. Deck Markdown first compiles into escaped static HTML, then the Slides adapter replaces chart references with the same escaped chart model before assigning `srcDoc`; labels and titles cannot become markup, and the iframe remains scriptless. Whole-workspace patch validation recompiles every chart after a data or schema edit, so renaming a bound column cannot silently break downstream reports or decks.

## Deck Markdown compiler

The canonical presentation format is `.deck.md`. Its frontmatter is a strict `version: 1`, `title`, `theme`, `ratio`, and `lang` contract; slides are separated by `---`; optional `layout` and `eyebrow` comments are validated against bounded values. The body supports headings, paragraphs, lists, tables, inline emphasis/code, and metric/chart references. Decks are limited to 120,000 source characters and 40 slides.

The compiler owns the 16:9 frame, design tokens, layout classes, and page numbers. It HTML-escapes source text and rejects raw HTML before compilation, so Agent output cannot introduce a second arbitrary web runtime. Existing `.html` decks are still detected as `Semantic HTML` and rendered inside the same no-script sandbox; this is a migration bridge, not the preferred source contract.

## Browser-local Office semantic import

Modern `.docx`, `.xlsx`, and `.pptx` files are Open XML ZIP packages. Rune lazily loads a small package/XML adapter only after the user chooses one, extracts XML parts while ignoring media bytes, and never uploads the original file. DOCX paragraphs, heading styles, run emphasis, links, numbering, and tables become Markdown. Every visible XLSX worksheet becomes an independent CSV artifact with shared/inline strings, booleans, numbers, common date formats, and cached formula values. Ordered PPTX slides use placeholder titles, body paragraphs, bullets, and tables to produce validated Deck Markdown, which then follows the normal escaped HTML compiler path.

This is intentionally semantic, not round-trip or pixel fidelity. Images and comments in DOCX, hidden sheets and live formulas in XLSX, and images/charts/animation/master styling in PPTX produce explicit warnings or are omitted; legacy binary `.doc/.xls/.ppt` and macro-enabled formats are outside this adapter. A batch import resolves duplicate names/ids and validates every new artifact plus the complete dependency graph, but remains a pending transaction. The review surface lists every generated filename, all fidelity warnings, and at most 12 lines/1,600 characters from each source. The full validated sources remain in memory and are not written until the user confirms.

The pending transaction retains the exact base workspace object. Import is disabled before device hydration and conversion is single-flight; if editing, folder pull, reset, or another operation replaces the artifact array while conversion runs, confirmation rejects the stale transaction. Confirmation performs one device-persistence write before swapping UI state. Cancel, parse failure, stale context, validation failure, or quota failure keeps the previous workspace object unchanged and never exposes a partial batch.

The compressed file limit is 12 MB. Package reads allow at most 2,000 entries, 6 MB per XML part, and 24 MB expanded XML in total; DTD/entity declarations and path traversal are rejected. Output is capped at 200,000 characters per artifact and 500,000 across one workbook, with additional semantic limits of 10,000 Word blocks, 10 worksheets, 10,000 rows, 256 columns, 50,000 spreadsheet cells, and 40 slides. Large-file conversion can move behind the same port into a Web Worker later without changing its output contract.

## Browser-local Office semantic export

The reverse adapter is also lazy and browser-only. Markdown block/inline structure becomes a deterministic DOCX package with main document, styles, numbering, tables, and restricted external hyperlink relationships. CSV/JSON is parsed through the canonical data adapter and becomes one values-only XLSX worksheet with typed number/boolean cells, inline strings, a frozen header, styles, and autofilter. Validated Deck Markdown becomes an ordered 16:9 PPTX with one slide part per source slide plus the required presentation, slide master, slide layout, theme, and relationship graph. Document and deck metrics compile from the current workspace before packaging; canonical source itself is never rewritten.

Export is semantic rather than pixel-exact. DOCX does not synthesize comments, embedded media, or advanced page design. XLSX deliberately emits no formula nodes and does not infer workbook formulas/charts from CSV or JSON. A standalone Chart directive resolves through the same strict Chart model and current canonical data used by live preview. DOCX renders that snapshot as a selectable three-column semantic bar table; PPTX emits editable text boxes plus track/bar rectangles inside the slide shape tree. The Office copy is intentionally static and its fidelity report names the source data because it no longer has Rune's live binding. Inline chart directives retain an omission marker, PPTX includes at most one chart per slide, and a chart takes layout priority over a table on the same slide.

PPTX otherwise preserves title/body text, bullets, tables, order, theme colors, and basic layout, while animation, speaker notes, and exact master styling remain explicit fidelity notes. Markdown images and unsafe non-HTTP links cannot become hidden active package relationships. XML text is sanitized, formula-looking spreadsheet values remain inline strings, and ZIP timestamps are fixed so identical source and workspace context produce identical bytes. Shape bounds are tested against the declared 16:9 canvas, and release QA renders a chart-first PPTX through an independent installed Office handler instead of trusting Rune's own parser.

The export review retains the exact base workspace reference, generated bytes, target filename/MIME, and all fidelity notes. A changed workspace rejects confirmation; cancel produces no download, and confirmation creates one object URL without changing drafts or checkpoints. DOCX is capped at 200,000 source characters and 10,000 blocks; XLSX at 2,000,000 source characters, 10,000 rows, 256 columns, and 50,000 cells; PPTX inherits the 120,000-character/40-slide Deck contract. Every final package is capped at 12 MB. Import and export share the pinned ZIP library but remain separate dynamic entries, so no new service or initial-load dependency is introduced.

## Browser-local standalone HTML export

Deck Markdown can also cross the compatibility boundary without an Office package or hosted share link. The lazy adapter follows one deterministic pipeline: `canonical Deck → compile workspace metrics → validate Deck → resolve Chart models from canonical data → render escaped static HTML`. It reuses the exact compiler, theme, automatic numbering, and chart renderer used by preview, then wraps the result in a complete UTF-8 document with inline styles and print rules that make every 16:9 slide one page. The canonical `.deck.md`, metric templates, and Chart JSON remain unchanged.

The result is deliberately a frozen handoff rather than a second Rune runtime. It contains no scripts, editor controls, Agent surface, checkpoints, live bindings, or external resources. User-controlled metadata and content are escaped by the Deck compiler; the export boundary additionally rejects script, iframe, object, embed, link, and any `src`/`href` attribute after final rendering. All bindings must be resolved, the final encoded file is capped at 2 MB, and identical workspace context produces identical bytes. This allows the receiver to open, archive, present, or print to PDF using an ordinary browser without a server, account, asset host, or package dependency.

HTML and Office outputs share one review transaction contract: generated bytes, target kind, filename, MIME type, fidelity notes, and the exact base workspace reference. Preparing either output is single-flight, does not write device state, and loads only its destination adapter. If editing, Pull, reset, or another transaction replaces the workspace before confirmation, download is rejected and must be regenerated. Explicit confirmation creates one object URL; cancel leaves drafts and checkpoints untouched. Release QA renders the resulting file through an independent system HTML handler so the exporter is not validated only by Rune's own preview.

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
3. v0.5 makes bounded Deck Markdown the canonical presentation source while preserving a sandboxed legacy HTML bridge.
4. v0.6 adds lazy, browser-local semantic import from modern Word, Excel, and PowerPoint Open XML packages.
5. v0.7 makes every import a review-before-write transaction with complete fidelity notes and bounded source previews.
6. v0.8 adds deterministic semantic DOCX/XLSX/PPTX export behind a review-before-download handoff.
7. v0.9 carries a shared Chart artifact into DOCX as a semantic bar table and PPTX as an editable native-vector snapshot.
8. v0.10 compiles Deck Markdown, current metrics, and charts into a reviewed standalone scriptless HTML handoff with print pagination.
9. v0.11 replaces model-authored complete files with bounded exact source operations compiled against a captured workspace revision.
10. A desktop shell can implement the same port with directory watching and atomic rename semantics later.
11. Collaboration adds an operation log and CRDT only after multi-user demand is proven.
12. D1/R2 remain undeclared until durable hosted projects or assets are required.

This avoids paying for identity, databases, and sync before they improve the core loop.

## Security boundaries

- Markdown is rendered as React elements and does not execute embedded HTML.
- Deck Markdown rejects raw HTML, validates layout metadata, and escapes user text before entering a restrictive no-script iframe; legacy HTML receives only the sandboxed compatibility path.
- CSV and JSON parsing is local and must expose validation errors rather than guessing silently.
- SQL runs in a dedicated browser worker; the preview accepts one read-only query and bounds visible results to 500 rows.
- Chart JSON is strict and code-free; text is React-escaped or HTML-escaped before document and slide rendering.
- Agent provider output contains only bounded literal source operations; missing, ambiguous, repeated-file, cancelling, oversized, stale-revision, or downstream-invalid plans produce no workspace write.
- OOXML import rejects oversized/unsafe ZIP parts, path traversal, DTD/entity declarations, invalid output adapters, and partial device writes; binary input never leaves the browser.
- Import confirmation rejects stale workspace context and keeps quota failures inside the open review instead of partially updating React or device state.
- Office export sanitizes XML characters, restricts hyperlink schemes, writes spreadsheet text as values rather than formulas, resolves chart snapshots only through validated workspace artifacts, rejects stale review context, and caps generated package bytes.
- Standalone HTML export requires every metric and chart binding to resolve, escapes user content, rejects executable or external-resource elements and attributes after rendering, checks stale review context, and caps final UTF-8 bytes.
- Folder manifests reject hidden/path-like names, duplicate identity, missing sources, oversized payloads, and invalid dependency graphs before Pull.
- Provider keys belong in server-side secrets; they are never committed or stored in browser drafts.
- XLSX import reads cached formula values and prefixes formula-leading text with an apostrophe before it becomes CSV; future generated CSV/XLSX export must reuse this injection boundary.

## Evolution path

| Stage | Capability | Infrastructure added only then |
| --- | --- | --- |
| Foundation | Five live artifact editors | Client adapters and local persistence |
| Trust | Multi-file patch review, atomic apply, persistent checkpoints | Local revision log |
| Intelligence | Provider-backed exact source operations compiled into reviewed patches | Agent API and deterministic operation fixtures |
| Data loop | SQL, shared metrics, and reusable charts | DuckDB-Wasm and dependency graph |
| Presentation source | Deck Markdown compiler and legacy HTML bridge | No hosted infrastructure |
| Collaboration | Shared projects | Auth, D1 metadata, R2 assets, Yjs transport |
| Compatibility import | Semantic DOCX/XLSX/PPTX ingestion | Lazy local ZIP/XML adapter |
| Compatibility export | Semantic DOCX/XLSX/PPTX plus standalone Deck HTML; PDF next | Lazy deterministic adapters; isolated workers only when needed |

## Quality gates

Every milestone needs a production build, typecheck, unit coverage for parsers and patch application, one end-to-end golden workspace, accessible keyboard operation, and a one-sentence entry in `PROGRESS.md`. OOXML import uses generated ZIP fixtures for all three package families and hostile-input boundaries; Office export must be byte-deterministic, well-formed, pass Rune import round-trips, keep generated slide shapes within the declared canvas, and open through an independent installed Office/Quick Look handler during release QA. Standalone HTML must resolve all workspace bindings, reject executable/external content, stay byte-deterministic, and render through an independent system HTML handler. Agent operation fixtures must cover ordered edits, ambiguity, missing anchors, no-ops, cancellation, size limits, foreign/duplicate targets, stale workspace revisions, and the unchanged downstream validation gate. Review tests also cover stale context, warning deduplication, and bounded previews. Provider-backed behavior needs deterministic eval fixtures before it becomes a default path.
