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
type DataCell = string | number | boolean | null;

type SourceSelection = {
  start: number; // UTF-16 offset, matching textarea selectionStart
  end: number;   // exclusive UTF-16 offset
};

type PreviewSourceTarget = SourceSelection & {
  kind: "document-section" | "data-row" | "data-cell" | "deck-slide";
  index: number;
  label: string;
};

type DataCellPreviewSourceTarget = PreviewSourceTarget & {
  kind: "data-cell";
  rowIndex: number;
  columnIndex: number;
  column: string;
};

type ChartDatum = {
  label: string;
  value: number;
  formatted: string;
  ratio: number;
  sourceRowIndex: number; // captured before sort and maxItems
};

type QueryCellLineage = {
  sourceRowIndex: number;
  sourceColumn: string;
};

type AgentSourceOperation =
  | { type: "replace_text"; find: string; replace: string }
  | { type: "replace_markdown_section"; heading: string; body: string }
  | { type: "insert_markdown_section_after"; heading: string; section: string }
  | { type: "upsert_data_row"; keyColumn: string; keyValue: Exclude<DataCell, null>; cells: Array<{ column: string; value: DataCell }> }
  | { type: "replace_deck_slide"; title: string; slide: string }
  | { type: "insert_deck_slide_after"; title: string; slide: string };

type AgentPatchAction = {
  type: "patch_artifact";
  artifactId: string;
  summary: string;
  detail: string;
  edits: AgentSourceOperation[]; // 1–8, applied in order
};

type AgentCreateAction = {
  type: "create_artifact";
  kind: "document" | "data" | "slides";
  title: string;
  summary: string;
  detail: string;
  edits: AgentSourceOperation[]; // targets Rune's deterministic initial template
};

type AgentWorkspacePlan = {
  summary: string;
  detail: string;
  actions: Array<AgentPatchAction | AgentCreateAction>; // 1–4 total
};

type ArtifactSourcePatch = {
  artifactId: string;
  summary: string;
  detail: string;
  nextSource: string; // compiled by Rune, never authored by the provider
  operationCount?: number;
};

type ArtifactCreationChange = {
  artifact: WorkspaceArtifact; // identity, metadata, and source compiled by Rune
  summary: string;
  detail: string;
  operationCount?: number;
};

type WorkspaceMutation = {
  summary: string;
  detail: string;
  patches: ArtifactSourcePatch[];
  creations: ArtifactCreationChange[];
};
```

Rune applies each operation sequentially to the exact source sent with the request. Markdown sections resolve one exact heading and include its nested subsections until the next heading at the same or a higher level. Data rows resolve one exact typed key in an existing column, accept only flat JSON cells, and preserve CSV versus JSON plus JSON array versus single-object shape. Deck slides resolve one exact `#`/`##` title; inserted or replacement fragments must be complete slides without a `---` separator. The `replace_text` fallback still requires one exact, non-empty, unique literal in the evolving revision. A create action first passes only `kind` and `title` through Rune's shared identity/template factory, then runs its typed edits against that exact starter source. In Selection scope, Rune compiles the same typed operations against the full captured source and additionally proves that the exact prefix before `start` and suffix after `end` are unchanged. The provider cannot send id, filename, extension, language, `source`, or `nextSource`, and cannot patch a just-created file in the same plan. Missing or repeated targets, artifact/operation mismatch, malformed fragments, duplicate keys, no-ops, cancelling sequences, foreign/duplicate artifact ids, incompatible template edits, selection-range crossing, or output above 120,000 characters reject the complete model plan. Only then does the server produce concrete patches/creations and run the whole-workspace safety gate before responding.

The UI previews every affected file, its operation count, line-change counts, and a bounded concrete source diff before accept/reject. New files are explicitly marked and diffed from empty source. Applying repeats the transaction boundary client-side: the captured workspace source revision must still match, patch ids must still exist and be unique, creation ids/names must still be new, every existing source must actually change, each adapter must validate, and the complete next workspace must compile without unresolved metric or chart bindings. Rune creates a pre-change checkpoint for every patched target, appends new artifacts, and performs one local persistence write before swapping UI state and selecting the first created file. Any failure keeps the whole current workspace unchanged. Model providers never write workspace state directly.

## Agent provider boundary

`POST /api/agent` is the only model-facing surface in v0. Selection scope sends one artifact plus a non-empty, revision-bound UTF-16 range of at most 16,000 characters; File scope sends one complete artifact. Both require a schema-conformant `summary`, `detail`, and 1–8 discriminated operations. Workspace scope sends 2–6 canonical artifacts within a 180,000-character envelope and requires a top-level rationale plus 1–4 discriminated `patch_artifact`/`create_artifact` actions. Patch ids must belong to that request and cannot repeat. Creation is limited to Markdown documents, CSV data tables, and Deck Markdown presentations; the provider supplies a bounded title and 1–8 edits against an explicitly documented template, while Rune deterministically supplies collision-safe identity, extension, language metadata, and initial source. Provider instructions prefer section operations for documents, row operations for CSV/flat JSON, and slide operations for Deck Markdown; SQL, Chart JSON, legacy semantic HTML, frontmatter, and precise inline edits use `replace_text`. String fields are bounded from 80 to 16,000 characters by role, rows carry explicit JSON-compatible scalar types, and provider output is capped at 8,000 tokens. Line numbers, regular expressions, arbitrary JSON paths, provider-authored source/metadata, and direct state writes are intentionally excluded. The workbench receives only the compiled concrete mutation and never applies it automatically.

The current adapter uses the OpenAI Responses API with Structured Outputs when `OPENAI_API_KEY` is configured and falls back to deterministic selection/file/workspace planners when it is not. The local workspace planner can also create a context-aware document, data index, or presentation through the same factory and review transaction, so the hosted no-key path demonstrates the creation boundary rather than silently bypassing it. `OPENAI_MODEL` is an environment choice rather than an editor dependency, so another provider can implement the same contract later.

## Selection Agent boundary

Selection is an ephemeral capability over canonical source, not a second document model. The workbench records `artifactId`, the exact source revision, and native textarea `selectionStart`/`selectionEnd` offsets. UTF-16 is intentional because it is the browser control's coordinate system; Rune rejects ranges that split a surrogate pair, as well as collapsed, stale, out-of-bounds, or over-16,000-character selections. Selecting a valid range activates Selection scope and exposes format-aware deterministic quick commands, while editing, switching artifacts, Pull, reset, New, import, or a successful Apply invalidates the captured range.

The provider receives the full artifact for structural context plus the exact `selectedSource`, but it keeps the existing typed-operation vocabulary. After compiling those operations into `nextSource`, the server verifies that the complete source prefix before the selection and suffix after it remain identical; a semantically valid operation that crosses either boundary still fails the entire request. Review stores the same range and revision with the concrete patch. Apply repeats the prefix/suffix proof client-side before checkpoints or persistence, then runs the unchanged full-artifact adapter and whole-workspace dependency validation. This duplicated boundary protects against stale or tampered review data without granting the model a direct range-write primitive.

## Preview-to-source targeting boundary

The preview is a projection of canonical source, not an independent selection surface. Rune derives ephemeral `PreviewSourceTarget` records directly from the current artifact revision: visible Markdown headings start non-overlapping sections while fenced headings are ignored; a quote-aware CSV scanner preserves multiline records, skips greedy-empty rows, and records every non-empty field token; a JSON value scanner finds exact top-level rows and property values without confusing escaped strings or nested delimiters; and Deck targets exclude frontmatter and `---` separators while retaining each slide's metadata and source. General targets contain a label, kind, index, and UTF-16 range; a data-cell target additionally records its parsed row/column coordinate and exact column name. They are recomputed after every source change and never persisted as hidden ids.

Document sections expose a keyboard-operable preview outline, non-empty data cells expose native buttons, row numbers retain a full-record target, and Deck Markdown exposes a slide target strip outside its scriptless iframe. A CSV cell selects its complete lexical token, including enclosing quotes for quoted or multiline fields; a JSON cell selects the complete value token, including string quotes or a nested object/array. Empty CSV fields have no non-empty source range, missing JSON properties have no source token, and an object with duplicate keys exposes no cell target because its semantic value is ambiguous. Activation focuses the native source textarea, sets its exact selection range, and enters the existing Selection Agent scope. No rendered HTML offset, browser DOM range, model inference, or iframe message becomes authority. The normal 16,000-character selection bound still applies, and source edits invalidate the target through the same revision check. Legacy HTML slides and derived views without a proven one-to-one range deliberately expose no target; React charts and conservative SQL results use the compiler-owned provenance contracts below.

## Cross-artifact chart provenance boundary

Chart compilation attaches the zero-based parsed data-row index to every valid datum before any ascending/descending sort or `maxItems` truncation. The visible mark therefore retains exact provenance even when labels repeat or display order diverges from source order. React chart previews resolve `sourceArtifactId + sourceRowIndex + spec.category/spec.value` through the current data artifact's cell-target compiler. Only exact existing targets for those column tokens become interactive; missing artifacts, invalid current data, ambiguous JSON keys, missing cells, row-count mismatch, or an out-of-range index leave that visual part read-only instead of falling back to label matching.

Activating a chart label switches the workbench to the data artifact and selects the exact category token; activating the bar/value selects the exact value token. The workbench binds that artifact's current source revision, focuses the native textarea after the file transition, and enables Selection Agent. `data-chart-source-row`, the rendered label, order, formatted value, and geometry remain observability/presentation only. Standalone Chart views and React-rendered charts embedded in Markdown use native buttons for click, Enter, and Space activation; charts frozen into sandboxed Deck HTML, standalone HTML, DOCX, or PPTX stay non-interactive snapshots and gain no script bridge. The provider contract and write path are unchanged: the chart interaction merely supplies the existing source selection, after which server/client confinement, review, checkpoint, dependency validation, and atomic persistence still apply.

## Query-result provenance boundary

SQL is allowed to derive, collapse, duplicate, or combine rows, so a displayed value is never matched back by equality. Before DuckDB runs, Rune parses the canonical CSV/JSON through the same data adapter used by the grid, adds a temporary collision-safe import-order field, serializes those typed rows to an in-memory JSON file, and materializes `workspace_data` in that explicit order. The helper field is projected away before the user query and is never stored in source or exposed in results. This makes DuckDB's zero-based physical `rowid` agree with the preview target compiler even when a CSV contains quote-aware multiline records or greedy-skipped empty rows.

A conservative lineage compiler recognizes only one top-level `SELECT` over exactly one `workspace_data` relation. Filtering, ordering, limits, explicit aliases, direct identifiers, `*`, arithmetic, `CASE`, casts, and a bounded whitelist of scalar functions preserve one outer source row. The compiler injects a qualified `rowid` under a reserved hidden result name, executes the same bounded query once, removes that column before rendering, and maps projection positions rather than output values. A direct identifier produces `sourceRowIndex + canonical sourceColumn`; a calculated projection carries no cell lineage but keeps the row target. Case-insensitive source-column identity and column resolution must be unique, output arity must match the compiled projection map, and the hidden id must be a safe in-range integer. An empty source schema is rejected before starting DuckDB; source columns named `rowid` or the reserved result field disable lineage while preserving normal query execution.

`WITH`, aggregate functions, `DISTINCT`, `GROUP BY`, `HAVING`, JOIN/comma relations, set operations, pivot/unpivot, sampling, window/qualify, subquery or row-expanding projections, unknown functions, and any unrecognized shape still execute under the normal read-only SQL boundary but receive no target. Result row numbers become buttons only when their hidden id resolves to a current full-record target; direct result cells become buttons only when the row/column pair resolves to a current exact lexical cell. Computed cells remain plain table cells. Query state stores and compares the complete SQL source, data artifact id, and data source revision, so an old result is replaced by loading—not briefly rebound to edited data—before any click can grant Selection scope.

## Local artifact creation boundary

Creating a blank Office-core artifact follows the same source-first rule as import and Agent writes. The user chooses Document, Data table, or Presentation and supplies a bounded title. A deterministic factory produces the smallest valid canonical source: one Markdown heading, an empty `Item,Value` CSV schema, or strict Deck Markdown frontmatter plus one cover slide. Unicode titles stay readable, while filenames and ids are normalized, portable, bounded, case-insensitively collision-safe, and protected from reserved device names. The workspace is capped at 50 artifacts to match the folder port.

Creation is prepared from the current workspace, validated through every adapter and dependency compiler, and only then persisted. The dialog exposes the exact resulting filename, language, and complete initial source; its title field receives initial focus, its type choices use radio semantics, focus is trapped, and Escape cancels. Confirmation writes the complete next workspace to device storage before React state changes, selects the new artifact, and leaves a connected source folder untouched until the user explicitly Pushes. Invalid titles, an invalid current workspace, name/id conflicts that cannot be resolved, or storage failure produce no partial artifact.

Workspace Agent creation uses the same factory rather than a parallel model-owned path. The compiler prepares the template against the evolving workspace identity set, runs the action's typed edits against that source, and returns the resolved artifact only after schema validation. Multiple same-title create actions therefore receive deterministic suffixes, and mixed patch/create plans still enter one full-workspace transaction. Human New and Agent Create differ only before review: the dialog starts from the minimal template, while the Agent proposes bounded edits to it. Both end at the same canonical artifact, dependency validation, atomic persistence, folder-Push boundary, and later Office export path.

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

The Query adapter treats `.sql` as canonical source and lazily starts DuckDB-Wasm only when a query preview is opened. Before each run, the first canonical CSV/JSON artifact is parsed into typed canonical rows, serialized to a temporary in-memory JSON file with explicit import order, and materialized as `workspace_data`. Rune accepts one `SELECT` or `WITH` statement, wraps it as a subquery, and requests at most 501 rows so the UI can display 500 and report truncation. Queries are serialized to avoid worker races, while exact query/data revision gating keeps stale results non-interactive as source changes.

The npm wrapper is pinned to a stable version, and matching worker/Wasm binaries are loaded from a version-pinned CDN URL. The row-preserving lineage subset is a local compiler, not a DuckDB extension or hosted service; unsupported query shapes simply keep their normal read-only result. This keeps the deployed application small and infrastructure-free while rows remain inside the browser. A future offline distribution can serve the same pinned binaries from an asset origin without changing the query contract.

## Checkpoint log

Device history is an append-only, per-artifact list of source snapshots. Applying a file or workspace Agent mutation records every patched pre-change source before the atomic write; a newly created artifact has no prior source to checkpoint. ⌘S records an explicit manual snapshot; restoring an older snapshot first records a safety checkpoint of the current source. Consecutive identical snapshots are deduplicated, malformed storage is ignored, and each artifact retains at most 24 checkpoints within a 500,000-character budget. Sources over 200,000 characters require export instead of a localStorage snapshot, and quota failures remain visible in the save indicator. Both drafts and checkpoints share the local workspace storage envelope, so refresh no longer destroys the normal undo boundary.

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
10. v0.12 adds artifact-aware Markdown section, typed data-row, and Deck slide operations while retaining exact-text fallback.
11. v0.13 adds deterministic blank Markdown/CSV/Deck creation behind an accessible atomic device transaction.
12. v0.14 lets the Workspace Agent create those same Office-core artifacts through Rune-owned identity/templates, concrete diff review, and mixed atomic workspace mutations.
13. v0.15 binds Agent edits to an exact source selection and proves unchanged prefix/suffix on both the server compilation and client Apply boundaries.
14. v0.16 maps rendered document sections, data rows, and Deck slides back to exact canonical source ranges that reuse Selection Agent.
15. v0.17 preserves source-row provenance through chart sorting/truncation and lets React chart marks open the exact referenced data row as Agent context.
16. v0.18 maps visible CSV/JSON cells to exact lexical value tokens and refines React chart lineage from rows to category/value cells.
17. v0.19 carries hidden source-row identity through conservative row-preserving SQL and makes only direct result fields targetable.
18. A desktop shell can implement the same port with directory watching and atomic rename semantics later.
19. Collaboration adds an operation log and CRDT only after multi-user demand is proven.
20. D1/R2 remain undeclared until durable hosted projects or assets are required.

This avoids paying for identity, databases, and sync before they improve the core loop.

## Security boundaries

- Markdown is rendered as React elements and does not execute embedded HTML.
- Deck Markdown rejects raw HTML, validates layout metadata, and escapes user text before entering a restrictive no-script iframe; legacy HTML receives only the sandboxed compatibility path.
- CSV and JSON parsing is local and must expose validation errors rather than guessing silently.
- SQL runs in a dedicated browser worker; the preview accepts one read-only query, bounds visible results to 500 rows, and grants result targets only to a compiler-proven one-table row-preserving subset with safe hidden ids and unique direct columns.
- Chart JSON is strict and code-free; text is React-escaped or HTML-escaped before document and slide rendering.
- Agent provider output contains only bounded discriminated patch/create actions and source operations. It cannot author creation identity, filenames, extensions, language metadata, complete source, or state writes; artifact/template mismatch, missing or ambiguous heading/key/title, duplicate key/cell, nested JSON, Deck separator injection, repeated-file, identity collision, cancelling, oversized, stale-revision, or downstream-invalid plans produce no workspace write.
- Selection Agent requests bind non-empty UTF-16 offsets to one exact source revision, reject surrogate-splitting or oversized ranges, and require the server compiler and client Apply path to independently prove that source outside the selection is unchanged.
- Preview targets are locally derived from the current canonical revision and only populate that existing selection contract; CSV quotes and JSON value delimiters stay inside exact cell ranges, while empty/ambiguous tokens receive no cell capability. Rendered DOM, sandbox contents, labels, and indices never become write authority, and derived views without exact source provenance remain non-targetable.
- Chart marks retain compiler-owned source-row indices through sorting and truncation, then resolve category/value columns against current cell targets; cross-artifact targeting never matches by a duplicate label, visible order, formatted value, or DOM geometry.
- Blank creation accepts only bounded single-line titles and deterministic Office-core templates; generated identity is portable and collision-safe, the complete next workspace validates before persistence, and a failed device write leaves React state unchanged.
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
| Foundation | Blank creation plus five live artifact editors with preview-to-source targeting | Deterministic source templates, target compilers, client adapters, and local persistence |
| Trust | Selection-confined and multi-file patch review, atomic apply, persistent checkpoints | Local revision log and duplicate selection-boundary verification |
| Intelligence | Provider-backed artifact-aware patch/create actions compiled into reviewed concrete workspace mutations | Agent API, shared creation factory, and deterministic semantic/selection-operation fixtures |
| Data loop | SQL, shared metrics, reusable charts, and exact table/chart/query-to-cell provenance | DuckDB-Wasm and dependency graph |
| Presentation source | Deck Markdown compiler and legacy HTML bridge | No hosted infrastructure |
| Collaboration | Shared projects | Auth, D1 metadata, R2 assets, Yjs transport |
| Compatibility import | Semantic DOCX/XLSX/PPTX ingestion | Lazy local ZIP/XML adapter |
| Compatibility export | Semantic DOCX/XLSX/PPTX plus standalone Deck HTML; PDF next | Lazy deterministic adapters; isolated workers only when needed |

## Quality gates

Every milestone needs a production build, typecheck, unit coverage for parsers and mutation application, one end-to-end golden workspace, accessible keyboard operation, and a one-sentence entry in `PROGRESS.md`. Blank creation fixtures must prove all three canonical templates validate, Unicode identity remains readable, filename/id collisions resolve case-insensitively, unsafe titles and workspace limits fail without mutation, and the shipped client exposes the atomic accessible flow. Agent creation fixtures additionally prove Structured Outputs expose only kind/title/typed edits, all three template families compile, same-title identities resolve deterministically, incompatible edits and model-authored metadata fail, mixed patch/create mutations are atomic, unsafe created bindings/Deck markup reach the unchanged downstream safety gate, and the no-key local path creates a reviewable presentation from visible workspace context. Selection fixtures must prove textarea-compatible UTF-16 offsets, emoji-surrogate safety, exact selected-source provider context, stale/collapsed/oversized rejection before provider work, server-side prefix/suffix confinement after typed-operation compilation, deterministic local fallbacks, and the repeated client Apply boundary. Preview-target fixtures must prove non-overlapping Markdown sections that ignore fenced headings; quote-aware multiline, escaped, empty, and greedy-skipped CSV fields; exact JSON property/primitive/nested-value ranges with missing and duplicate-key refusal; Deck ranges without frontmatter or separators; accessible cell/row/section/slide controls; current-revision focus; and the explicit absence of false targets for derived or legacy views. Chart-provenance fixtures must additionally prove source-row indices survive sorting, truncation, and duplicate labels; category/value fields resolve to exact current CSV/JSON cell ranges; invalid mappings remain read-only; and native click/Enter/Space controls ship in both standalone and embedded React charts without changing static exports. Query-provenance fixtures must prove canonical import-order identity survives greedy-empty rows, filtering, sorting, aliases, stars, limits, and direct/derived mixed projections; aggregates, grouping, DISTINCT, JOIN, CTE, set, pivot, window, unknown-function, reserved-name, arity, and stale-revision cases expose no false target; and native result row/cell controls reuse current source targets. OOXML import uses generated ZIP fixtures for all three package families and hostile-input boundaries; Office export must be byte-deterministic, well-formed, pass Rune import round-trips, keep generated slide shapes within the declared canvas, and open through an independent installed Office/Quick Look handler during release QA. Standalone HTML must resolve all workspace bindings, reject executable/external content, stay byte-deterministic, and render through an independent system HTML handler. Agent operation fixtures must cover ordered exact fallbacks; unique/missing/ambiguous Markdown headings, typed CSV/JSON keys, and Deck titles; flat-JSON and slide-fragment boundaries; artifact mismatches; no-ops, cancellation, size limits, foreign/duplicate targets, stale workspace revisions; one document-data-Deck atomic plan; and the unchanged downstream validation gate. Review tests also cover stale context, warning deduplication, and bounded previews. Provider-backed behavior needs deterministic eval fixtures before it becomes a default path.
