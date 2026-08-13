# Rune Architecture

Rune is an AI-native artifact workspace. Human-readable source is canonical; editors, previews, exports, and agents are replaceable clients of that source.

## Product boundary

The first release is a local-first vertical slice, not a pixel-fidelity Office compatibility suite. It must make documents, data, and presentations feel like one product while keeping their compilers independent.

```text
Workbench UI
  ├─ Workspace state and persistence
  ├─ Static task assembly
  │    └─ capability → reviewed source session → pure task provider → transaction
  ├─ Agent command surface
  ├─ OOXML import port
  │    └─ DOCX → Markdown · XLSX → CSV · PPTX → Deck Markdown
  ├─ Export ports
  │    ├─ canonical source → DOCX · XLSX · PPTX
  │    ├─ Deck Markdown → portable scriptless HTML
  │    └─ Markdown / Deck Markdown → fixed local PDF
  ├─ Dependency compiler
  │    └─ shared data → legacy or Query metrics / chart models → document / slides
  └─ Artifact registry
       ├─ Markdown adapter → document preview
       ├─ Data adapter     → parsed grid
       ├─ Query adapter    → DuckDB-Wasm result grid
       ├─ Chart adapter    → validated JSON + local semantic bar/line view
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
  kind: "document-section" | "document-block" | "document-fragment" | "data-row" | "data-cell" | "deck-slide" | "chart-spec";
  index: number;
  label: string;
};

type DocumentFragmentPreviewSourceTarget = PreviewSourceTarget & {
  kind: "document-fragment";
  fragmentType: "list-item" | "table-header-cell" | "table-cell" | "bold" | "italic" | "strikethrough" | "inline-code" | "link" | "image";
  rowIndex?: number;
  columnIndex?: number;
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
  position: number; // normalized finite value position for ordered line geometry
  sourceRowIndex: number; // source-table or query-result row before sort/maxItems
  categoryProvenance: ChartCellProvenance | null;
  valueProvenance: ChartCellProvenance | null;
};

type ChartCellProvenance = {
  artifactId: string; // canonical Data artifact, never the derived Query view
  sourceRowIndex: number;
  sourceColumn: string;
};

type QueryCellLineage = {
  sourceRowIndex: number;
  sourceColumn: string;
};

type QueryDataSourceDirective = {
  artifactId?: string; // exact Data id from -- rune:data "artifact-id"
  explicit: boolean;   // false preserves imported legacy first-Data behavior
  errors: string[];
};

type WorkspaceQuerySnapshot = {
  queryArtifactId: string;
  querySource: string;
  dataArtifactId: string;
  dataSource: string;
  result: WorkspaceQueryResult;
};

type AgentQueryEvidence = {
  queryArtifactId: string;
  dataArtifactId: string;
} & (
  | {
      status: "ready";
      columns: string[]; // ≤32
      rows: DataCell[][]; // ≤20 rows, ≤400 cells
      visibleResultRowCount: number;
      totalColumnCount: number;
      resultTruncated: boolean;
      evidenceTruncated: boolean;
    }
  | { status: "error"; error: string }
);

type AgentRuntimeRepair = {
  attempt: 1; // the only automatic repair request allowed for one user action
  failure: string; // normalized local compiler/runtime failure, ≤1,000 characters
  proposedArtifacts: Array<{
    artifactId: string;
    name: string;
    kind: WorkspaceArtifact["kind"];
    language: string;
    proposedSource: string; // compiled first proposal, still unapplied
    isCreation: boolean;
  }>; // 1–4 exact proposal sources; ≤100,000 each and ≤180,000 in Workspace scope
};

type RuntimeImpactPreflight = {
  dataCount: number;
  queryCount: number;
  legacyMetricConsumerCount: number;
  scalarConsumerCount: number;
  chartConsumerCount: number;
  dataNames: string[];
  queryNames: string[];
};

type QueryMetricReference = {
  queryArtifactId: string;
  column: string;
  format: "currency" | "number" | "percent";
};

type WorkspaceDependencyEdge = {
  fromArtifactId: string; // canonical source
  toArtifactId: string;   // consumer
  kind: "metric" | "query" | "query-metric" | "chart-data" | "chart-query" | "chart-embed" | "deck-origin";
  references: string[];
};

type AgentArtifactReference =
  | { kind: "artifact"; artifactId: string } // exact visible canonical id
  | { kind: "creation"; handle: string };   // exact earlier action-local handle

type AgentSourceOperation =
  | { type: "replace_text"; find: string; replace: string }
  | { type: "replace_markdown_section"; heading: string; body: string }
  | { type: "insert_markdown_section_after"; heading: string; section: string }
  | { type: "upsert_data_row"; keyColumn: string; keyValue: Exclude<DataCell, null>; cells: Array<{ column: string; value: DataCell }> }
  | { type: "upsert_data_column"; keyColumn: string; column: string; values: Array<{ keyValue: Exclude<DataCell, null>; value: DataCell }> }
  | { type: "rename_data_column"; column: string; nextColumn: string }
  | { type: "replace_deck_slide"; title: string; slide: string }
  | { type: "insert_deck_slide_after"; title: string; slide: string }
  | { type: "append_chart"; chart: AgentArtifactReference; heading: string }; // Workspace only

type AgentPatchAction = {
  type: "patch_artifact";
  artifactId: string;
  summary: string;
  detail: string;
  edits: AgentSourceOperation[]; // 1–8, applied in order
};

type AgentCreateAction = {
  type: "create_artifact";
  handle: string; // 1–40 lowercase action-local characters; never persisted
  title: string;
  summary: string;
  detail: string;
  edits: AgentSourceOperation[]; // 0–8; targets Rune's deterministic initial source
} & (
  | { kind: "document" | "data" | "slides" }
  | { kind: "query"; source: AgentArtifactReference }
  | {
      kind: "chart";
      source: AgentArtifactReference;
      category: string;
      value: string;
      mark: "bar" | "line";
      format: "number" | "currency" | "percent";
    }
);

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

type WorkspaceTransactionReview = {
  nodes: Array<{
    artifactId: string;
    status: "created" | "edited" | "validated" | "input";
  }>;
  edges: Array<WorkspaceDependencyEdge & {
    status: "added" | "removed" | "updated" | "retained";
    previousLabel?: string;
  }>;
  errors: string[];
};
```

Rune applies each operation sequentially to the exact source sent with the request. Markdown sections resolve one exact heading and include its nested subsections until the next heading at the same or a higher level. Data rows resolve one exact typed key in an existing column, accept only flat JSON cells, and preserve CSV versus JSON plus JSON array versus single-object shape. A Data-column upsert requires an existing globally unique, non-empty typed key column, never changes that key or inserts a row, and accepts at most 200 keyed scalar values. Adding a column requires one value for every existing row (or an empty value list for a header-only empty CSV); updating an existing column may target a subset but rejects repeated, missing, or unchanged keys. A column rename resolves one exact current header, requires a trimmed single-line non-colliding replacement, preserves column/property order, and is still only a proposal—the complete downstream SQL/Chart runtime gate may veto it. Deck slides resolve one exact `#`/`##` title; inserted or replacement fragments must be complete slides without a `---` separator. `append_chart` resolves one exact existing Chart or an earlier Chart creation handle, refuses duplicate bindings, and appends either a Markdown section or a strict Deck split slide. It is not exposed in File/Selection provider schemas. The `replace_text` fallback still requires one exact, non-empty, unique literal in the evolving revision.

A create action passes its discriminated typed intent through Rune's shared identity/template factory. Every creation declares a unique lowercase action-local handle. Core files need kind/title; Query and Chart use a discriminated source reference that names either an exact original visible artifact or an earlier successful creation handle, while Chart also supplies exact fields, mark, and format. The compiler walks actions in order, resolves identity collisions, compiles edits, records the handle only after that creation succeeds, and writes only the resulting canonical id into Query/Chart/Markdown/Deck source. Handles never appear in compiled review output, persistence, folder manifests, exports, or dependency graphs. Typed edits run against the exact starter source; zero edits are valid when the template already expresses the request. The final graph independently rejects any created-to-touched dependency that was not authorized by an explicit handle, so a lucky guessed slug cannot masquerade as a symbolic reference.

In Selection scope, Rune compiles the narrower operation schema against the full captured source and additionally proves that the exact prefix before `start` and suffix after `end` are unchanged; a CSV header rename can therefore fit an exact header selection, while a whole-column value update or normalized JSON rewrite normally requires a wider range. The provider cannot send a final id, filename, extension, language, source text, or `nextSource`, cannot patch a just-created file, and cannot use a forward, duplicate, missing, wrong-kind, or guessed creation identity. Missing or repeated targets, invented sources/fields, artifact/operation mismatch, malformed fragments, duplicate keys, incomplete new columns, no-ops, cancelling sequences, foreign/duplicate artifact ids, incompatible template edits, selection-range crossing, or output above 120,000 characters reject the complete model plan. Only then does the server produce concrete patches/creations and run the whole-workspace safety gate before responding.

The UI previews every affected file, its operation count, line-change counts, and a bounded concrete source diff before accept/reject. New files are explicitly marked and diffed from empty source. It independently rebuilds dependency graphs from the current and complete proposed canonical workspaces, takes only the transitive upstream inputs and downstream consumers rooted at changed files, and renders a collapsible transaction map. Nodes distinguish created/edited sources from unchanged inputs and validated downstream consumers; union edges distinguish added, removed, field-contract-updated, and retained relationships, so deleting a binding cannot disappear from review merely because it is absent from the proposed graph. Shared consumers of an unchanged upstream input are not pulled in. The map consumes no provider handles or rationale and grants no new write capability; changed nodes only select the already-bounded concrete diff. Applying repeats the transaction boundary client-side: the captured workspace source revision must still match, patch ids must still exist and be unique, creation ids/names must still be new, every existing source must actually change, each adapter must validate, and the complete next workspace must compile without unresolved metric or chart bindings. Rune creates a pre-change checkpoint for every patched target, appends new artifacts, and performs one local persistence write before swapping UI state and selecting the first created file. Any failure keeps the whole current workspace unchanged. Model providers never write workspace state directly.

## Agent provider boundary

`POST /api/agent` is the only model-facing surface in v0. Selection scope sends one artifact plus a non-empty, revision-bound UTF-16 range of at most 16,000 characters; File scope sends one complete artifact. Both require a schema-conformant `summary`, `detail`, and 1–8 discriminated operations. Workspace scope sends an upstream-closed pack of 2–7 canonical artifacts rooted at the selected file plus zero to six explicit context pins, within a 180,000-character envelope, along with the exact source-to-consumer edges and pin ids inside that pack. It requires a top-level rationale plus 1–4 discriminated `patch_artifact`/`create_artifact` actions. Patch ids must belong to that request and cannot repeat. Creation supports all five canonical kinds and requires one unique action-local handle. Query/Chart source references choose exact visible artifacts or earlier creation handles; Chart also names category/value fields, mark, and format. Rune deterministically supplies collision-safe identity, extension, language metadata, initial source, and handle resolution. Creation uses 0–8 edits against that documented template; patch actions retain 1–8. Provider instructions prefer section operations for documents; keyed row/column upserts or exact column renames for CSV/flat JSON; slide operations for Deck Markdown; and Workspace-only `append_chart` for a reusable existing or earlier-created Chart. SQL, Chart JSON, legacy semantic HTML, frontmatter, and precise inline edits use `replace_text`. String fields are bounded from 40 to 16,000 characters by role, rows/columns carry explicit JSON-compatible scalar types, a column carries at most 200 keyed values, and provider output is capped at 8,000 tokens. Line numbers, regular expressions, arbitrary JSON paths, provider-authored source/metadata, generated-id guesses, forward handles, and direct state writes are intentionally excluded. The workbench receives only the compiled concrete mutation and never applies it automatically.

The provider port has four explicit transports: OpenAI Responses (`text.format` JSON Schema), OpenAI-compatible Chat Completions (`response_format.json_schema`), Anthropic Messages (one forced `submit_rune_plan` tool with the same input schema), and Gemini generateContent (`responseJsonSchema`). Each normalizes provider output and real usage fields into one `AgentOperationPatch` or `AgentWorkspaceOperationPlan`; the existing Zod parser, operation compiler, source/dependency/runtime gates, and Review remain the authority. Profiles never infer protocol from a model name, and a failed request is never retried at a different provider. Deterministic selection/file/workspace planners remain available when no active connection exists. The local workspace planner can create all five artifact kinds through the same factory and review transaction. Query/Chart source candidates come only from its explicit context pack, while collision-safe identity and final validation still use the complete workspace. A narrow workflow intent that explicitly asks for Data analysis, a Chart, and a report and/or presentation now prepares one concrete Query → Chart → deliverable creation batch. The local planner owns those identities directly rather than pretending to be a provider, but its result passes the identical mutation and runtime-impact gates. The hosted no-key path therefore demonstrates the complete creation loop rather than silently bypassing it.

Model setup preserves that server boundary through two credential sources. Deployment owners may still set `OPENAI_API_KEY` and `OPENAI_MODEL`. A user may instead create up to three personal OpenAI, OpenRouter, Anthropic, Gemini, or custom-protocol profiles through `/api/model-profiles`; one profile is active and takes precedence over deployment configuration. The key exists in the React password draft only until Save, crosses same-origin HTTPS, and is encrypted/authenticated with AES-GCM under a separate `RUNE_CREDENTIAL_ENCRYPTION_KEY`. The resulting 30-day cookie is `HttpOnly`, `SameSite=Strict`, and scoped to `/api`; client code receives only profile id/name/provider/protocol/base URL/model/timestamps plus a credential-present boolean. The cookie is treated as empty after tampering, schema failure, or master-key rotation, and production disables personal profiles when the master key is absent. The only localStorage model value remains the non-secret `auto | local` preference. API keys remain forbidden from workspace source, browser-readable persistence, checkpoints, folder manifests, analytics, logs, Git, URLs, and prompts. Rune Desktop protects the vault master key with Electron `safeStorage` and the macOS Keychain while keeping the decrypted key out of the renderer.

Custom provider URLs must be HTTPS public-DNS origins on port 443, without userinfo, query, fragment, IP literals, localhost/private suffixes, or a final generation path. This is a conservative SSRF and misconfiguration boundary, not a claim that arbitrary gateways are safe. `models` validation performs only a bounded authenticated `GET {baseURL}/models` using the selected protocol's header: eight-second abort, declared and streamed one-megabyte ceilings, at most eighty unique 120-character ids, no redirect, and no Artifact content. Agent calls have a 60-second abort and two-megabyte response ceiling. Responses and compatible Chat set `store: false`; Anthropic uses its pinned version header; Gemini receives a schema normalized to its documented subset. Provider errors do not echo response bodies that may contain sensitive evidence. Profile selection changes only transport and grants no new source or persistence capability; protocol/provider changes require a fresh key, and cross-provider fallback is forbidden without a future explicit user authorization contract.

## Agent Query evidence and runtime impact preflight

Workspace source tells a model how a Query is written but not what its current revision returns. Rune closes that gap without making result snapshots canonical through a configured-provider handshake. The first graph-validated request contains no `queryEvidence`. If no provider key exists, the API returns `MODEL_UNCONFIGURED` immediately and the browser uses the deterministic planner without loading DuckDB for model context. If a provider is configured and the exact Workspace pack contains Query artifacts, the API returns `QUERY_EVIDENCE_REQUIRED` with their ordered ids before any provider call. The client executes those Queries locally against their resolved Data revisions and retries exactly once. This means provider availability—not a speculative client guess—authorizes the extra local compute and evidence disclosure.

Each Query contributes exactly one identity-bound record in workspace order. A successful record contains at most 20 rows, 32 columns, 400 cells, 500 characters per string, and explicit original row/column counts plus runtime/evidence truncation flags; an execution failure contributes at most 500 characters of error feedback. The complete pack is capped at 20,000 JSON characters. The server checks schema, ordering, uniqueness, Query id, and resolved Data id against the same supplied sources before a provider call. Evidence exists only in Workspace scope, where those Query and Data sources are already inside the graph capability boundary. It is computed by the requesting browser, advisory rather than attested, may be incomplete, and is not persisted in source, local storage, checkpoints, folder manifests, logs, or Git. Model instructions require live metric/Chart bindings instead of pasted samples and forbid treating error or truncated evidence as complete.

A second boundary applies after either a provider or deterministic planner returns. If the concrete plan changes or creates any Data, Query, or Chart source, the workbench first builds the complete proposed workspace in memory with the ordinary mutation safety gate. It treats directly changed Queries, every Query whose resolved proposed Data id changed, and every Query selected by a changed/new Chart as the runtime impact set, executes each against that exact proposed Data revision, and rejects stale snapshots. It then recompiles affected legacy metrics and Query scalars and resolves every direct-Data or Query-backed Chart in the impact set. A disconnected new Data source or direct-Data Chart is still parsed and whole-workspace validated but does not cause unrelated Queries to run.

If a provider-backed first proposal fails this gate, Rune constructs one `AgentRuntimeRepair` from the unapplied compiled sources and the normalized failure. Existing files must retain exact id/name/kind/language identity, created files must retain Rune-owned non-colliding identity and canonical kind, every id/name is unique, at least one Data, Query, or Chart source is present, Selection proposals still preserve the exact outside prefix/suffix, and the proposal pack stays within the same per-file and total source envelopes. The original canonical artifact/workspace graph, prompt, selection, metrics, and already-verified Query evidence remain unchanged. The feedback is labelled untrusted advisory data: it cannot become a target, an instruction, a write capability, or evidence that the first plan was applied.

The provider must return a complete replacement typed-operation plan compiled against the original canonical revision; it cannot patch the failed proposal incrementally. The API echoes `repairAttempt: 1`, the client accepts only that marker, and the replacement passes the ordinary server operation compiler/safety gate followed by the complete browser-local runtime impact graph again. Only then can it become `pendingChange`, whose review card preserves the first bounded failure and says the plan was repaired once. Feedback construction failure, transport failure, an invalid/missing marker, invalid replacement operations, or a second runtime failure stops the action with no pending review, local fallback, source write, checkpoint, local-storage write, folder write, or React workspace mutation. There is no recursive call and deterministic local planners never enter this path. This is one bounded Generate → Inspect → Fix cycle, not an autonomous loop or visual-quality assertion.

## Workspace dependency graph and Agent context boundary

The workspace graph is a compiler output, not persisted workspace metadata. On every artifact revision Rune derives seven directed edge families from readable source: the first canonical Data artifact to every legacy metric consumer; the Data artifact resolved for each Query through `workspace_data`; an exact Query id to each three-argument scalar-metric consumer; an exact Data source id to its Chart artifact; an exact Query source id to its Chart artifact; each `{{ chart(...) }}` artifact to the document or deck that embeds it; and an exact Document id declared by optional Deck `origin` frontmatter to that presentation. A Query's first non-empty `-- rune:data "artifact-id"` line wins over workspace order; SQL imported without the directive retains the first Data as an explicit legacy mode. This makes `Data → Query → scalar metric → Document/Deck`, `Data → Query → Chart → Document/Deck`, and `Document → Presentation` first-class upstream chains. Invalid directives or metric syntax, absent Data/Query/Document sources, unsupported Query outputs, invalid Chart JSON, and unresolved metric/chart/origin ids become explicit graph issues rather than invented nodes. Edge order follows workspace identity, both endpoints are native navigation buttons, and the graph contains no copied result values or persisted runtime snapshots.

Workspace Agent context starts at the selected artifact and any user-pinned artifacts, then traverses their graph components as an undirected discovery surface while inclusion remains directed and upstream-closed: a consumer is not sent unless every known source it requires is also sent. Unlinked files are never padded merely to reach a quota, but a user can deliberately bridge up to six disconnected files with native pin controls. Pins are ephemeral session capabilities: they are not written to local storage, `rune.workspace.json`, source, checkpoints, or the dependency graph, and folder Pull/reset clears them. A pin is a required root rather than a preference; its upstream closure is included atomically or the model path is disabled without silently dropping it. The pack retains original workspace order so legacy metric bindings and directive-free Queries keep their prior first-Data meaning, while explicit Query and Query-metric sources are preserved by identity; it then enforces seven files, 100,000 characters per non-selected file, and 180,000 characters in total.

The client first sends only edge kind, endpoints, bounded reference names, explicit pin ids, canonical sources, and eligible compiled legacy metrics. After the configured-provider handshake, Query metrics may additionally be explained by bounded, revision-identity-bound local result evidence; that evidence remains explicitly advisory rather than a new source or write capability. The API recompiles the graph from the supplied canonical sources, rejects unresolved upstream intent, requires an exact edge match, and reruns context selection from the selected id plus supplied pins. A disconnected artifact that cannot be reached from either root class is rejected before provider work, so pins cannot become cover for arbitrary hidden padding. The deterministic no-provider planner receives that same context pack without the evidence handshake, while collision-safe creation identity is still calculated against the full workspace. A valid model or local response remains only a proposed operation plan over the bounded pack. Apply stays bound to the full captured workspace revision and reruns every adapter, metric, Query-metric, and Chart dependency over all device artifacts; omitted downstream consumers therefore retain veto power over a patch that would break them. Context packing is a token/capability bound, never a weaker transaction boundary.

## Selection Agent boundary

Selection is an ephemeral capability over canonical source, not a second document model. The workbench records `artifactId`, the exact source revision, and native textarea `selectionStart`/`selectionEnd` offsets. UTF-16 is intentional because it is the browser control's coordinate system; Rune rejects ranges that split a surrogate pair, as well as collapsed, stale, out-of-bounds, or over-16,000-character selections. Selecting a valid range activates Selection scope and exposes format-aware deterministic quick commands, while editing, switching artifacts, Pull, reset, New, import, or a successful Apply invalidates the captured range.

The provider receives the full artifact for structural context plus the exact `selectedSource`, but it keeps the existing typed-operation vocabulary. After compiling those operations into `nextSource`, the server verifies that the complete source prefix before the selection and suffix after it remain identical; a semantically valid operation that crosses either boundary still fails the entire request. Review stores the same range and revision with the concrete patch. Apply repeats the prefix/suffix proof client-side before checkpoints or persistence, then runs the unchanged full-artifact adapter and whole-workspace dependency validation. This duplicated boundary protects against stale or tampered review data without granting the model a direct range-write primitive.

## Preview-to-source targeting boundary

The preview is a projection of canonical source, not an independent selection surface. Rune derives ephemeral `PreviewSourceTarget` records directly from the current artifact revision: visible Markdown headings start non-overlapping sections while fenced headings are ignored; top-level heading, paragraph, list, blockquote, fenced-code, GFM-table, and thematic-break nodes expose exact `document-block` ranges; individual list items, GFM header/body cells, strong/emphasis/delete spans, inline code, links, and images expose exact `document-fragment` ranges from the same CommonMark/GFM AST used by rendering; a quote-aware CSV scanner preserves multiline records, skips greedy-empty rows, and records every non-empty field token; a JSON value scanner finds exact top-level rows and property values without confusing escaped strings or nested delimiters; Deck targets exclude frontmatter and `---` separators while retaining each slide's metadata and source; and a valid Chart JSON artifact exposes its complete source as one `chart-spec` target. General targets contain a label, kind, index, and UTF-16 range; Document blocks record semantic block type, Document fragments record semantic fragment type plus table coordinates when applicable, and a data-cell target records its parsed row/column coordinate and exact column name. They are recomputed after every source change and never persisted as hidden ids.

Document sections expose a keyboard-operable preview outline, each proven rendered Document block exposes separate native locate/edit controls, and each proven fragment is directly focusable with hover/focus/active feedback. A normal link activation selects its complete Markdown syntax; Command/Control-click retains ordinary navigation. Because metric values are shorter or longer than their `{{ ... }}` source tokens, `compileArtifactSource` emits a monotonic UTF-16 boundary map beside the compiled string; a rendered AST range is accepted only after this map returns to the exact canonical AST block or fragment range. Any Document block or fragment containing a Chart binding is withheld from the Document layer so the embedded Chart's category/value controls retain more precise cross-artifact provenance. Non-empty data cells expose native buttons, row numbers retain a full-record target, and Deck Markdown exposes a slide target strip outside its scriptless iframe. A CSV cell selects its complete lexical token, including enclosing quotes for quoted or multiline fields; a JSON cell selects the complete value token, including string quotes or a nested object/array. Empty CSV fields have no non-empty source range, missing JSON properties have no source token, and an object with duplicate keys exposes no cell target because its semantic value is ambiguous. Activation focuses the native source textarea, sets its exact selection range, and enters the existing Selection Agent scope. In the reverse direction, a source caret/selection resolves to the smallest containing fragment before its block and section; nested list items win by exact span, and a shared table delimiter prefers the cell beginning at that offset. No browser DOM range, model inference, or iframe message becomes authority. The normal 16,000-character selection bound still applies, and source edits invalidate the target through the same revision check. Legacy HTML slides and derived views without a proven one-to-one range deliberately expose no target; React charts and conservative SQL results use the compiler-owned provenance contracts below.

A proven Document block may also compile one visual write. `prepareVisualDocumentBlockEdit` re-resolves the complete target identity (`id`, index, label, range, block type, and heading depth) from the current artifact, normalizes only outer blank lines and newline style, and reparses the draft with the same CommonMark/GFM grammar. The draft must remain exactly one top-level node of the same type; a heading must retain its depth, every Rune binding token must remain byte-identical and ordered, and every byte outside the exact range must be unchanged. Heading, paragraph, list, quote, fenced-code, and table blocks are editable; thematic breaks remain navigation-only. The shared visual-write transaction then validates the full proposed workspace, preflights affected runtime consumers, rechecks the complete workspace revision, checkpoints the old artifact, and persists once. It returns the newly proven block range for synchronized source selection and active preview state; stale, empty, no-op, overlong, multi-block, type-changing, binding-changing, or downstream-invalid drafts write nothing.

A direct Data-cell target may additionally compile one visual write, but it never becomes a second table state. `prepareVisualDataCellEdit` first proves that the requested row, column, source offsets, and column name still describe the current revision. CSV accepts one bounded draft through the same automatic scalar parser as ordinary Data; flat JSON requires an explicit `string | number | boolean | null` type. Nested objects/arrays, ambiguous or missing values, non-finite numbers, no-ops, cells above 10,000 characters, stale offsets, and any replacement that changes bytes outside the exact lexical token fail closed. Rune reparses the complete source, proves the value round-trips and derives the new target range, then runs ordinary whole-workspace static validation and the complete impacted Data/Query/Chart runtime preflight against a captured workspace revision. Only after those checks does it checkpoint the previous source and perform one atomic device persistence; source, selection, preview, and Selection Agent context advance together. An explicit pencil button and Enter expose this capability, while a normal click retains exact source selection. Query results and Chart marks remain navigation-only even when their provenance points to the Data cell, preventing a derived projection from silently acquiring write authority.

A Document-section target uses the same shared visual-commit transaction without making rendered DOM canonical. The editor receives at most 16,000 characters from one current `document-section` target and renders its draft locally through the ordinary safe Markdown compiler. On Save, `prepareVisualDocumentSectionEdit` resolves the exact target id/index/label/range against the current source, preserves CRLF versus LF, and replaces only that range. A heading-backed target must retain exactly one visible heading at offset zero and the same heading level; its title and body may change. A preamble or heading-free body must remain heading-free. Fence-aware parsing prevents headings inside code blocks from becoming structure. Empty/no-op/oversized content, extra or missing headings, a stale range, a changed `{{ ... }}` live binding, or any byte change outside the selected section fails closed. The complete proposed workspace then passes ordinary adapter and dependency validation, receives a pre-edit checkpoint, and persists once before the new section range becomes both the left selection and right active target. Adding/removing sections, changing heading hierarchy, or changing metric/Chart dependencies remains explicit canonical-source or reviewed Agent work.

A Deck-slide target is likewise a revision-bound write capability only for strict Deck Markdown. `prepareVisualDeckSlideEdit` re-resolves exact artifact/id/index/label/range identity, reads the existing parsed slide, and accepts only one supported layout enum, an optional single-line plain-text eyebrow of at most 100 characters, and a body of at most 16,000 characters. The draft preview synthesizes a temporary one-slide Deck from current validated frontmatter and compiles it through the same escaped no-script pipeline; it is never stored. Save normalizes the body to the artifact newline convention, serializes Rune-owned metadata, replaces only the exact target range, reparses the complete Deck, proves slide count and the new range, and preserves every `{{ ... }}` binding byte-for-byte and in order. Empty/no-op drafts, `---` separator injection, raw HTML, unsafe comment metadata, stale targets, unsupported layouts, cross-range changes, and invalid complete Decks fail closed. The shared visual transaction then validates the complete workspace, creates one checkpoint, persists once, and synchronizes the left selection and right target. Frontmatter, slide insertion/deletion/reordering, binding changes, and legacy semantic HTML stay source or reviewed Agent work.

A valid Chart JSON artifact exposes its whole source as one `chart-spec` capability rather than mapping rendered bars back to JSON properties by DOM geometry. The standalone Chart toolbar keeps Data-point activation as provenance-based navigation, while Source selects the complete spec and Configure opens typed controls for all presentation/field properties except `source`. Field choices are derived from the exact bound Data columns or the conservative static output contract of the exact bound Query. The draft compiler preserves that source identity, sets `version: 1`, validates every value through `ChartSpecSchema`, emits deterministic indented JSON, and resolves the draft through current Data or revision-bound Query runtime before Save. Title/description bounds, bar/line, category/value, source/ascending/descending sort, currency/number/percent, six-digit color, and 1–20 marks are the only writable properties. Save re-resolves the complete current target, rejects no-op/stale/oversized/invalid specs, validates the complete dependency graph, executes the normal Chart runtime impact gate, checkpoints the old JSON, and persists once before both sides advance. Changing the Data/Query identity remains explicit canonical-source or reviewed Agent work because it changes dependency authority, not visual presentation alone.

## Cross-artifact chart provenance boundary

Direct-Data chart compilation attaches the zero-based parsed data-row index and exact category/value column identity to every valid datum before any ascending/descending sort or `maxItems` truncation. Query-backed compilation instead reads the current result cell's lineage: a direct projected field becomes `canonical Data artifact + source row + source column`, while a derived field has null provenance. The visible mark therefore retains only identities already proven by its source compiler, even when labels repeat or display order diverges from canonical source. React chart previews resolve each non-null provenance record through the current Data artifact's cell-target compiler. Missing artifacts, invalid current data, ambiguous JSON keys, missing cells, row-count mismatch, an out-of-range index, or a derived Query value leave only that visual part read-only instead of falling back to label/value matching.

Activating a provable chart label switches the workbench to the canonical Data artifact and selects the exact category token; activating a provable bar or line point selects the exact value token. A Query artifact is never treated as editable data merely because it rendered the chart. The workbench binds the Data artifact's current source revision, focuses the native textarea after the file transition, and enables Selection Agent. `data-chart-source-row`, the rendered label, order, formatted value, and geometry remain observability/presentation only. Standalone Chart views and React-rendered charts embedded in Markdown use native buttons for click, Enter, and Space activation; charts frozen into sandboxed Deck HTML, standalone HTML, DOCX, PPTX, or PDF stay non-interactive snapshots and gain no script bridge. The provider contract and write path are unchanged: the chart interaction merely supplies the existing source selection, after which server/client confinement, review, checkpoint, dependency validation, and atomic persistence still apply.

## Query-result provenance boundary

SQL is allowed to derive, collapse, duplicate, or combine rows, so a displayed value is never matched back by equality. Before DuckDB runs, Rune resolves the Query's exact Data binding, parses that CSV/JSON through the same adapter used by the grid, adds a temporary collision-safe import-order field, serializes those typed rows to an in-memory JSON file, and materializes `workspace_data` in that explicit order. The helper field is projected away before the user query and is never stored in source or exposed in results. This makes DuckDB's zero-based physical `rowid` agree with the preview target compiler even when a CSV contains quote-aware multiline records or greedy-skipped empty rows.

A conservative lineage compiler recognizes only one top-level `SELECT` over exactly one `workspace_data` relation. Filtering, ordering, limits, explicit aliases, direct identifiers, `*`, arithmetic, `CASE`, casts, and a bounded whitelist of scalar functions preserve one outer source row. The compiler injects a qualified `rowid` under a reserved hidden result name, executes the same bounded query once, removes that column before rendering, and maps projection positions rather than output values. A direct identifier produces `sourceRowIndex + canonical sourceColumn`; a calculated projection carries no cell lineage but keeps the row target. Case-insensitive source-column identity and column resolution must be unique, output arity must match the compiled projection map, and the hidden id must be a safe in-range integer. An empty source schema is rejected before starting DuckDB; source columns named `rowid` or the reserved result field disable lineage while preserving normal query execution.

`WITH`, aggregate functions, `DISTINCT`, `GROUP BY`, `HAVING`, JOIN/comma relations, set operations, pivot/unpivot, sampling, window/qualify, subquery or row-expanding projections, unknown functions, and any unrecognized shape still execute under the normal read-only SQL boundary but receive no target. Result row numbers become buttons only when their hidden id resolves to a current full-record target; direct result cells become buttons only when the row/column pair resolves to a current exact lexical cell. Computed cells remain plain table cells. Query state stores and compares the complete SQL source, data artifact id, and data source revision, so an old result is replaced by loading—not briefly rebound to edited data—before any click can grant Selection scope.

## Query-backed Chart snapshot boundary

A Chart may name either Data or Query in its strict `source` field. The Query first resolves an explicit `-- rune:data` id, or the legacy first Data when no directive exists. Workspace validation cannot execute DuckDB on every keystroke, so a conservative static compiler infers only a single outer `SELECT` output against that resolved schema: direct identifiers retain their names, a direct `*` may expand `workspace_data`, and derived projections must use an explicit `AS` alias. Set queries, duplicate case-insensitive output names, implicit derived names, ambiguous stars, or more than 256 outputs cannot become a Chart contract. This validates source identity plus category/value bindings and downstream patches without persisting query results or starting the worker.

Live preview then runs only the Query sources required by the selected Query, Chart, Document, or Deck and creates an ephemeral `WorkspaceQuerySnapshot`. The snapshot includes exact Query source, canonical Data id/source, bounded result, and cell lineage. A Chart accepts it only when both source revisions still match and the result is not truncated beyond the 500-row query boundary; edits immediately return the consumer to a loading state. Missing, failed, stale, or truncated snapshots produce an explicit non-chart state rather than silently reusing old values. Multiple consumers of the same Query share this revision-keyed runtime entry instead of launching independent executions.

Export is a separate deterministic consumer of the same contract. Before generating DOCX, PPTX, standalone HTML, or PDF, Rune reruns every Query source reachable from the target, refuses truncation, and passes those exact snapshots into the chart compiler. The exported chart is frozen and non-interactive, while canonical Query/Data/Chart sources remain unchanged. Thus a runtime result is evidence tied to source revisions—not a hidden persisted artifact and not a second source of truth.

## Query-backed scalar metric boundary

A Document or Deck can read one numeric Query output through the exact readable form `{{ metric("query-id", "column", "currency|number|percent") }}`. The parser accepts exactly three quoted arguments, an existing Query id, an output column proven by the conservative static Query schema, and one bounded display format. Legacy one-argument `metric("name")` bindings remain source-compatible and retain their first-Data semantics; the two forms are never silently rewritten into one another.

Static validation proves identity and schema without starting DuckDB, so a renamed Query column or missing bound Data vetoes the complete pending workspace mutation. Runtime compilation additionally requires a current `WorkspaceQuerySnapshot` for the exact Query and Data revisions, no 500-row truncation, exactly one result row, one unambiguous selected cell, and a finite numeric value. Missing, running, stale, multi-row, ambiguous, or nonnumeric results render as pending/error state and cannot be exported. Currency, number, and percent affect presentation only; they do not coerce Query cardinality or invent a value.

The preview coordinator runs the union of Query ids required by scalar metrics and charts, sharing one revision-keyed snapshot per Query. Office, standalone HTML, and PDF export independently rerun that same union and freeze formatted scalar values beside chart snapshots, so opening a preview is never a prerequisite for a correct handoff. Query results remain ephemeral runtime evidence and are not written to canonical source, local storage, checkpoints, folder manifests, or Git.

A `query-metric` dependency edge connects the Query directly to each consumer while the existing resolved Data-to-Query edge closes the upstream chain. Workspace Agent scope can introduce or retarget this cross-file reference only when the exact Query and Data are present in its verified context; Selection and File scopes must preserve the before/after Query-metric signature. The default workspace uses an explicit `regional-summary.sql` aggregate for numeric KPIs, while keeping one legacy `top_region` binding as a visible compatibility example.

## Local artifact creation boundary

Creating a canonical artifact follows the same source-first rule as import and Agent writes. The user chooses Document, Data table, Query, Chart, or Presentation and supplies a bounded title. A deterministic factory produces either the smallest core source—one Markdown heading, an empty `Item,Value` CSV schema, or strict Deck Markdown frontmatter plus one cover slide—or a complete typed dependency source. Query requires one exact Data id and starts with a quoted `-- rune:data` directive plus `SELECT * FROM workspace_data;`. Chart requires one exact Data/Query id, exact category/value fields, a bar/line mark, and a number format, then starts as complete strict Chart JSON. Unicode titles stay readable, while filenames and ids are normalized, portable, bounded, case-insensitively collision-safe, and protected from reserved device names. Unicode letter/number ids are also valid in formatted `{{ chart(...) }}` references. The workspace is capped at 50 artifacts to match the folder port.

Creation is prepared from the current workspace, validated through every adapter and dependency compiler, and only then persisted. The dialog exposes exact source candidates and fields, resulting filename, language, and complete initial source; its title field receives initial focus, its type choices use radio semantics, focus is trapped, and Escape cancels. A new Chart may optionally target one existing Markdown Document or Deck Markdown presentation. Rune then appends a readable binding to that consumer, checkpoints its pre-change source, validates the combined patch-plus-creation graph, and commits one device write. Confirmation selects the new artifact and leaves a connected source folder untouched until the user explicitly Pushes. Invalid titles, stale/missing sources or fields, duplicate embeds, an invalid current workspace, name/id conflicts that cannot be resolved, or storage failure produce no partial artifact.

Workspace Agent creation uses the same factory rather than a parallel model-owned path. The compiler prepares each template against the evolving workspace identity set, runs zero to eight typed edits, and returns the resolved artifact only after schema validation. A source or Chart reference may use an earlier action-local handle; direct artifact references remain confined to original visible context, and patches still cannot target a just-created file. This supports a four-action Data → Query → Chart → Document/Deck chain without exposing collision-sensitive ids. Multiple same-title creations receive deterministic suffixes, handle-to-id pairs stay compiler-local, and mixed patch/create plans enter one full-workspace transaction. Human New and Agent Create differ only before review: the dialog supplies explicit controls and optional atomic embedding, while the Agent supplies bounded typed intent and ordered references. Both end at the same canonical artifact, dependency/runtime validation, atomic persistence, folder-Push boundary, and later Office export path.

## Shared metrics and lineage

Markdown and Deck Markdown can reference a legacy Data-derived value with `{{ metric("total_revenue") }}`, a Query scalar with `{{ metric("regional-summary", "total_q2_revenue", "currency") }}`, or a reusable view with `{{ chart("regional-revenue-chart") }}`. The dependency compiler derives legacy metrics and direct Chart models from canonical CSV/JSON, and Query-backed metrics and Chart models from current revision-bound SQL snapshots, then substitutes only at render time. Sources stay readable and one Data or Query edit invalidates every dependent projection. Each compiled view exposes its source artifact and reference count. SQL and Chart artifacts expose their canonical lineage, while the workspace graph exposes current dependency topology without persisting a second source of truth. Imported legacy semantic HTML keeps the one-argument binding syntax for compatibility.

## Declarative chart runtime

A `.chart.json` artifact is a strict, versioned view contract: title, description, Data-or-Query artifact id, exact category/value output columns, a `bar` or `line` mark, sort policy, number format, validated color token, and a 1–20 mark limit. It contains no code. Bar geometry compares absolute magnitude against the visible maximum. Line geometry preserves the explicit post-sort sequence, spaces its finite points uniformly, and normalizes the visible minimum/maximum into a bounded vertical position; an all-equal series stays centered rather than inventing a range. For Data, the local compiler parses canonical CSV/JSON directly. For Query, workspace validation uses the static output contract while rendering requires a current runtime snapshot. Both paths validate every row, sort and format values deterministically, retain exact point/bar provenance, and produce one shared chart model.

“Deterministic” includes display text, not only source and data order. Compact `Intl.NumberFormat` output differs across JavaScript/ICU implementations—for example one runtime can emit `$970K` while another emits `$970.00K` for the same options—so it is not part of Rune's server-render contract. A small shared formatter now owns grouping, K/M/B/T selection, two-decimal rounding with trailing-zero removal, currency/sign placement, and fixed one-decimal percentages. Metrics, React charts, static Deck HTML, and Office/PDF snapshots all consume those exact strings. SSR and hydration therefore compare compiler output, not two engines' locale opinions; locale-aware author-controlled formats can be added later as explicit source metadata rather than ambient runtime state.

Markdown renders that model as React elements: bars and line labels expose category buttons, while bars and SVG-overlaid line points expose value buttons only when current canonical provenance resolves. Deck Markdown first compiles into escaped static HTML, then the Slides adapter replaces chart references with the same escaped chart model before assigning `srcDoc`; line series use deterministic inline SVG without scripts, labels and titles cannot become markup, and the iframe remains scriptless. Whole-workspace patch validation recompiles every chart after a data or schema edit, so renaming a bound column cannot silently break downstream reports or decks.

## Deck Markdown compiler

The canonical presentation format is `.deck.md`. Its frontmatter is a strict `version: 1`, `title`, `theme`, `ratio`, and `lang` contract; slides are separated by `---`; optional `layout` and `eyebrow` comments are validated against bounded values. The body supports headings, paragraphs, lists, tables, inline emphasis/code, and metric/chart references. Decks are limited to 120,000 source characters and 40 slides.

The compiler owns the 16:9 frame, design tokens, layout classes, and page numbers. It HTML-escapes source text and rejects raw HTML before compilation, so Agent output cannot introduce a second arbitrary web runtime. Existing `.html` decks are still detected as `Semantic HTML` and rendered inside the same no-script sandbox; this is a migration bridge, not the preferred source contract.

## Browser-local Office semantic import

Modern `.docx`, `.xlsx`, and `.pptx` files are Open XML ZIP packages. Rune lazily loads a small package/XML adapter only after the user chooses one, extracts XML parts while ignoring media bytes, and never uploads the original file. DOCX paragraphs, heading styles, run emphasis, links, numbering, and tables become Markdown. Every visible XLSX worksheet becomes an independent CSV artifact with shared/inline strings, booleans, numbers, common date formats, and cached formula values. Ordered PPTX slides use placeholder titles, body paragraphs, bullets, and tables to produce validated Deck Markdown, which then follows the normal escaped HTML compiler path.

This is intentionally semantic, not round-trip or pixel fidelity. Images and comments in DOCX, hidden sheets and live formulas in XLSX, and images/charts/animation/master styling in PPTX produce explicit warnings or are omitted; legacy binary `.doc/.xls/.ppt` and macro-enabled formats are outside this adapter. A batch import resolves duplicate names/ids and validates every new artifact plus the complete dependency graph, but remains a pending transaction. The review surface lists every generated filename, all fidelity warnings, and at most 12 lines/1,600 characters from each source. The full validated sources remain in memory and are not written until the user confirms.

The pending transaction retains the exact base workspace object. Import is disabled before device hydration and conversion is single-flight; if editing, folder pull, reset, or another operation replaces the artifact array while conversion runs, confirmation rejects the stale transaction. Confirmation performs one device-persistence write before swapping UI state. Cancel, parse failure, stale context, validation failure, or quota failure keeps the previous workspace object unchanged and never exposes a partial batch.

The compressed file limit is 12 MB. Package reads allow at most 2,000 entries, 6 MB per XML part, and 24 MB expanded XML in total; DTD/entity declarations and path traversal are rejected. Output is capped at 200,000 characters per artifact and 500,000 across one workbook, with additional semantic limits of 10,000 Word blocks, 10 worksheets, 10,000 rows, 256 columns, 50,000 spreadsheet cells, and 40 slides. Large-file conversion can move behind the same port into a Web Worker later without changing its output contract.

## Browser-local PDF semantic import

PDF input follows the same review-first transaction but has a separate lazy port. Choosing a `.pdf` dynamically loads PDF.js plus its same-origin worker; neither is part of the initial workbench chunk. Rune copies the input bytes, requires a PDF header in the first 1,024 bytes, disables eval, streaming, range and auto-fetch behavior, stops on parser errors, and never uploads the file. Password-protected files fail with an instruction to import an unlocked copy. PDF JavaScript is detected only to produce an omission warning and is never executed.

The adapter records metadata title, page geometry, selectable text fragments, annotations, outline count, and JavaScript presence. It groups fragments into geometry-aligned lines, handles CJK joining and dominant right-to-left order, identifies repeated top/bottom headers and footers, estimates body font size, and converts conservative heading, bullet, numbered-list, paragraph and hyphen joins into one Markdown Document. Every page retains a `<!-- PDF page N -->` provenance marker. Raw braces are encoded before validation so a PDF cannot fabricate Rune metric or Chart bindings.

Pages with no selectable text trigger a separate consent boundary before any page pixels are read. Rune shows the exact detected scan-page ranges per PDF; the user may narrow them and explicitly chooses English, Simplified Chinese, or both. Only then does PDF.js render those pages to bounded browser canvases (2,400-pixel long edge and eight-megapixel ceiling) while one Tesseract worker recognizes them sequentially. Worker, WASM core variants, and compressed language data are bundled on the same origin rather than fetched from a third-party CDN; the runtime may cache language data in IndexedDB, but page images and recognized text never leave the browser. The operation exposes page/stage progress and can be stopped; cancellation performs no workspace write.

OCR output is untrusted transcription, not canonical fact. Every recognized block keeps `<!-- PDF page N · OCR confidence N% -->`, a visible verify-against-original disclosure, and a separate page-level rounded average-confidence warning in the final import review. Empty recognition remains explicit. The same brace encoding prevents OCR output from fabricating Rune metric or Chart bindings. A user cannot select a page that already has selectable text or lies outside the analyzed document, and conversion reopens and revalidates the PDF so stale/mismatched requests fail closed.

This is semantic extraction, not visual reconstruction. Reading order is approximate; images, exact fonts/layout, tables, columns, links, comments, form controls and bookmarks are omitted or flattened with review warnings, and OCR may omit, reorder, or misread content. The input limit is 12 MB, with at most 200 pages, 100,000 text fragments, eight million rendered pixels per OCR page, and 200,000 generated Markdown characters. The resulting artifact then passes the normal collision resolution, workspace validation, stale-context check and single confirmed device write used by compatibility import.

## Browser-local OpenDocument semantic import

ODT, ODS, and ODP use a separate lazy browser port rather than pretending that every ZIP-based office format has the same object model. Rune requires the extension-specific MIME value, requires the first ZIP entry to be an uncompressed `mimetype`, and verifies the root and `content.xml` entries in `META-INF/manifest.xml`. Only `content.xml`, optional `styles.xml` and `meta.xml`, and the manifest are decoded; package media is never interpreted as executable content. DTD/entity declarations, encryption metadata, duplicate or traversing paths, oversized parts, scripts, and macros fail or become explicit non-executed warnings.

ODT headings, paragraphs, inherited emphasis, HTTP/mailto links, lists, and tables become source-safe Markdown. ODS visible tables become separate CSV artifacts while preserving finite numeric, boolean, date, time, string, currency, and percentage values; formula cells contribute cached values only, formula-leading text is apostrophe-prefixed, and standard large repeated empty rows or columns are skipped without allocating them. ODP page order, title/body text, bullets, and tables become validated Deck Markdown. Images, comments, tracked-change history, hidden sheets, live formulas, objects, charts, notes, animation, and exact layout are omitted or flattened with review notes. Braces are encoded before canonical validation so imported content cannot manufacture Rune bindings.

The compressed input limit is 12 MB, with at most 2,000 ZIP entries, 6 MB per XML part, 24 MB decoded XML, 200,000 characters per artifact, and 500,000 characters per ODS batch. Semantic limits match the surrounding adapters: 10,000 text blocks or rows, 256 columns, 50,000 cells, 10 visible sheets, and 40 slides. The converted batch enters the same collision resolution, full-workspace validation, stale-context check, keyboard-accessible review, and single confirmed device write as OOXML and PDF import.

## Browser-local Office semantic export

The reverse adapter is also lazy and browser-only. Markdown block/inline structure becomes a deterministic DOCX package with main document, styles, numbering, tables, and restricted external hyperlink relationships. CSV/JSON is parsed through the canonical data adapter and becomes one values-only XLSX worksheet with typed number/boolean cells, inline strings, a frozen header, styles, and autofilter. Validated Deck Markdown becomes an ordered 16:9 PPTX with one slide part per source slide plus the required presentation, slide master, slide layout, theme, and relationship graph. Document and deck metrics compile from the current workspace, with referenced Query scalars rerun against their exact Data revisions before packaging; canonical source itself is never rewritten.

Export is semantic rather than pixel-exact. DOCX does not synthesize comments, embedded media, or advanced page design. XLSX deliberately emits no formula nodes and does not infer workbook formulas/charts from CSV or JSON. A standalone Chart directive resolves through the same strict Chart model used by live preview; Query-backed charts first rerun the exact Query/Data revisions and provide that snapshot to the resolver. DOCX renders a frozen bar as a selectable three-column semantic bar table and a line as a semantic trend-direction table. PPTX emits editable text plus native track/bar rectangles or line segments, circles, labels, and values inside the slide shape tree. The Office copy is intentionally static and its fidelity report names the source because it no longer has Rune's live binding. Inline chart directives retain an omission marker, PPTX includes at most one chart per slide, and a chart takes layout priority over a table on the same slide.

PPTX otherwise preserves title/body text, bullets, tables, order, theme colors, and basic layout, while animation, speaker notes, and exact master styling remain explicit fidelity notes. Markdown images and unsafe non-HTTP links cannot become hidden active package relationships. XML text is sanitized, formula-looking spreadsheet values remain inline strings, and ZIP timestamps are fixed so identical source and workspace context produce identical bytes. Shape bounds are tested against the declared 16:9 canvas, and release QA renders a chart-first PPTX through an independent installed Office handler instead of trusting Rune's own parser.

The export review retains the exact base workspace reference, generated bytes, target filename/MIME, and all fidelity notes. A changed workspace rejects confirmation; cancel produces no download, and confirmation creates one object URL without changing drafts or checkpoints. DOCX is capped at 200,000 source characters and 10,000 blocks; XLSX at 2,000,000 source characters, 10,000 rows, 256 columns, and 50,000 cells; PPTX inherits the 120,000-character/40-slide Deck contract. Every final package is capped at 12 MB. Import and export share the pinned ZIP library but remain separate dynamic entries, so no new service or initial-load dependency is introduced.

## Browser-local OpenDocument semantic export

The ODF adapter mirrors the same canonical-source handoff without sharing OOXML-specific relationships. Markdown Documents compile to ODT headings, paragraphs, inline emphasis, restricted links, lists, semantic tables, code/quote styles, and current Chart data tables. CSV/flat JSON compiles to one typed, values-only ODS sheet; formula-looking text remains a string and no OpenFormula expression is generated. Deck Markdown compiles to ordered 16:9 ODP pages with native text, bullets, tables, and selectable current Chart data tables. Query-backed metrics and Charts use the same exact revision-bound local snapshots prepared before packaging, so exported values are frozen evidence rather than a hidden runtime.

Each output is an ODF 1.3 ZIP with an uncompressed first `mimetype` entry, `content.xml`, `styles.xml`, `meta.xml`, and `META-INF/manifest.xml`. ZIP timestamps and XML order are fixed for byte determinism; XML characters are sanitized; hyperlinks are restricted to HTTP, HTTPS, and mailto; and no script, macro, formula, external media dependency, or live binding is emitted. The package is capped at 12 MB and uses the shared export review's captured workspace reference and explicit confirmation. Exact pagination, comments, tracked changes, images, formulas, filters, animation, notes, and advanced master styling stay explicit fidelity notes. Release QA validates every XML part against the official OASIS ODF 1.3 Relax NG schemas, imports each result back through Rune, and checks the installed system handlers; ODT and ODS are additionally opened through Word and Excel, while ODP relies on schema/round-trip validation when PowerPoint automation is unavailable.

## Browser-local standalone HTML export

Deck Markdown can also cross the compatibility boundary without an Office package or hosted share link. The lazy adapter follows one deterministic pipeline: `canonical Deck → collect metric/Chart Queries → run exact snapshots → compile legacy and Query metrics → resolve Chart models → validate/render escaped static HTML`. It reuses the exact compiler, theme, automatic numbering, and chart renderer used by preview, then wraps the result in a complete UTF-8 document with inline styles and print rules that make every 16:9 slide one page. The canonical `.deck.md`, `.sql`, Data, and Chart JSON sources remain unchanged.

The result is deliberately a frozen handoff rather than a second Rune runtime. It contains no scripts, editor controls, Agent surface, checkpoints, live bindings, or external resources. User-controlled metadata and content are escaped by the Deck compiler; the export boundary additionally rejects script, iframe, object, embed, link, and any `src`/`href` attribute after final rendering. All bindings must be resolved, the final encoded file is capped at 2 MB, and identical workspace context produces identical bytes. This allows the receiver to open, archive, present, or print to PDF using an ordinary browser without a server, account, asset host, or package dependency.

HTML, Office, and PDF outputs share one review transaction contract: generated bytes, target kind, filename, MIME type, fidelity notes, and the exact base workspace reference. Preparing an output is single-flight, does not write device state, and loads only its destination adapter. If editing, Pull, reset, or another transaction replaces the workspace before confirmation, download is rejected and must be regenerated. Explicit confirmation creates one object URL; cancel leaves drafts and checkpoints untouched. Release QA renders HTML and PDF through independent system handlers so those exporters are not validated only by Rune's own preview.

## Browser-local fixed PDF export

Markdown Documents and Deck Markdown can cross the final handoff boundary directly, without a browser print dialog, server renderer, account, or upload. The lazy adapter follows the same reviewed snapshot pipeline as Office and HTML export, then uses a browser-compatible PDF writer. Documents compile into fixed A4 pages with semantic headings, paragraphs, lists, quotes, code, bounded tables, headers, footers, and page numbers. Decks compile into one 960×540 16:9 page per validated slide while retaining Rune theme, layout, scalar metrics, tables, and vector bar or line charts. Data artifacts continue to use XLSX rather than inventing a paginated spreadsheet contract.

The PDF is a frozen visual handoff rather than a second editor format. Query metrics require the exact current one-row finite snapshot, Query-backed Charts require the exact current non-truncated snapshot, and every chart becomes local vector geometry. Links remain readable but are not active; Markdown images become visible alt-text markers; fixed frames visibly shorten or omit overflowing content and record a fidelity warning. Animation, speaker notes, editable slide objects, live bindings, comments, forms, and JavaScript are not generated. Canonical Markdown, Deck, SQL, Data, and Chart JSON stay byte-for-byte unchanged.

Rune bundles the OFL-licensed Unifont WOFF2 asset and embeds the glyphs used by text that cannot use the standard PDF font, so Chinese and other supported Unicode do not depend on network or receiver fonts. Unsupported characters become visible question marks with a review warning rather than black boxes. Source is capped at 200,000 characters, the font asset at 4 MB, and the final file at 12 MB. Metadata dates are fixed, identical inputs produce identical bytes, and release QA loads the file with an independent PDF parser, verifies page geometry and the absence of JavaScript/forms/encryption, renders every page through Poppler, and visually inspects the resulting images before handoff.

## Browser-local SQL runtime

The Query adapter treats `.sql` as canonical source and lazily starts DuckDB-Wasm only for a Query preview, a Query-dependent export, a configured Workspace Agent evidence handshake, or an Agent Data/Query runtime-impact preflight that actually has an impacted Query to execute. The optional first non-empty line must be exactly `-- rune:data "artifact-id"`; its JSON-quoted id supports Unicode while duplicate, displaced, malformed, missing, or non-Data targets fail closed. Directive-free imported SQL retains the first Data as a visibly labelled compatibility mode. Before each run, the resolved CSV/JSON is parsed into typed canonical rows, serialized to a temporary in-memory JSON file with explicit import order, and materialized as `workspace_data`. Rune accepts one `SELECT` or `WITH` statement, wraps it as a subquery, and requests at most 501 rows so the UI can display 500 and report truncation. Queries are serialized to avoid worker races, while exact query/resolved-data revision gating keeps stale results non-interactive as source changes.

The same lazy coordinator serves Query-backed scalar metrics and Charts in standalone, Document, and Deck previews. It keys each execution by required Query id plus exact Query/Data sources, shares one result across current consumers, and keeps all snapshots in component runtime state only. This preserves the browser-local zero-infrastructure boundary while letting SQL become a reusable view source.

The npm wrapper is pinned to a stable version, and matching worker/Wasm binaries are loaded from a version-pinned CDN URL. The row-preserving lineage subset is a local compiler, not a DuckDB extension or hosted service; unsupported query shapes simply keep their normal read-only result. This keeps the deployed application small and infrastructure-free while rows remain inside the browser. A future offline distribution can serve the same pinned binaries from an asset origin without changing the query contract.

## Task-first operating-review compiler

The operating-review entry is an orchestration layer over existing canonical compilers, not a privileged Agent path. Its input contains one exact Data artifact id, exact case-sensitive category and finite-number fields, aggregation, Chart mark/format, plain-text title/period/focus, audience, locale, and a unique non-empty set of Document/Slides deliverables. It creates a readable identity-bound Query, a Query-backed Chart, and one or two source-native deliverables. Generated titles pass the normal collision-safe artifact factory; generated bindings pass the normal whole-workspace validator. The compiler never writes conclusions that were not present in the input or evidence.

The workbench captures the complete source revision before preparation, compiles the full creation list, repeats the whole-workspace mutation check, and runs the existing browser-local runtime-impact preflight. A stale revision or any SQL/Chart/downstream failure returns no pending change. Success produces the same transaction map, per-file source diffs, runtime evidence card, explicit Apply, and atomic device persistence as every Workspace Agent change; the task layer receives no direct persistence capability. Cancel and every error path leave the caller's artifacts and input immutable. Seven deterministic fixtures cover bilingual chains, exact ids/bindings, invalid sources/field case, nonnumeric values, duplicate deliverables, case-insensitive collisions, and frozen-input success/failure paths.

### User-confirmed delivery evidence

An applied mutation proves that Rune wrote a valid proposed workspace; it does not prove that a person could use the result. After a saved operating-review Document or Slides artifact is actually downloaded or written to its connected folder, the workbench may request one optional rating: `ready`, `minor-edits`, or `not-ready`. The confirmation must resolve an exact saved workflow, an exact applied run, and the workflow's exact Document or Slides id. Stopped runs, foreign artifacts, unsupported download targets, and incoherent folder/download method pairs fail closed.

The device record contains only version, deterministic `runId + artifactId` identity, confirmation time, run id, artifact id, method, target format, rating, task duration, and a Web Crypto SHA-256 fingerprint of the handed-off canonical source revision. It never stores source text, prompt, Query rows, filename content, or credentials, and it never emits remote telemetry. Reconfirming the same run and artifact replaces its earlier judgment; each workflow retains at most twelve newest records. Older saved tasks normalize a missing delivery list to an empty list.

Delivery summaries treat `ready` and `minor-edits` as usable but preserve their separate counts. UI metrics and per-run history derive from normalized records instead of copied counters. This evidence can measure the product's stated task threshold on one device, but it does not replace consented user research, retention, payment, or externally validated outcome evidence. Saved workflow locale normalization and Deck `lang` metadata both use the complete nine-locale registry so a French, Spanish, Russian, Arabic, Japanese, or Korean task cannot disappear or fail after creation.

## Explicit interface localization

Locale is an explicit UI dependency, not an ambient browser input. The server renders one stable English LTR workbench and never reads `navigator`, local storage, time, or runtime locale data during SSR. After hydration the setup flow recommends a device language, restores the confirmed preference, updates root `lang` and `dir`, and passes `RuneLocale` into the workbench, review dialogs, dependency/transaction maps, and the complete Document/Data/Query/Chart/Deck preview tree. The registry contains Simplified Chinese, Traditional Chinese, English, French, Spanish, Russian, Arabic, Japanese, and Korean; every greeting is derived from that same registry. Arabic reverses UI flow while canonical source, code, URL, model-id, API-key, and data-grid surfaces keep explicit LTR boundaries. This prevents a confirmed language from falling back when the user enters a professional editor or review step without reintroducing server/client text divergence.

`runeUICopy(locale)` is the typed contract for normal product copy. Dynamic counts, filenames, targets, bindings, and review summaries are functions rather than DOM replacement; locale tests compare the complete recursive catalog shape and exercise interpolation. Traditional Chinese is generated locally from the typed Chinese contract; French, Spanish, Russian, Arabic, Japanese, and Korean are development-time generated static catalogs supplemented by human-reviewed critical-flow copy. Runtime makes no translation request. Deterministic Agent suggestions are selected from the same locale boundary, and high-frequency status text is translated at presentation time without rewriting stored state. Raw parser, provider, SQL-runtime, and adapter fidelity evidence may remain in its originating language: those strings are technical facts and need stable error codes before localized rendering.

Appearance is likewise explicit presentation state. SSR fixes `data-theme="mist-blue"`; hydration may restore one validated id from `mist-blue | sage | lavender | deep-blue | cosmic-orange` and writes only that enum to local storage. Theme tokens may affect focus, action, selection, and material atmosphere, while the independent vermilion Rune mark remains stable. Neither locale direction nor appearance state may change Artifact source, checkpoints, dependency identity, exports, or Agent context.

The desktop source/preview ratio follows the same presentation-only boundary. Its persisted value is accepted only from 35–65%, defaults to 47%, and becomes complementary CSS grid tracks without entering workspace persistence. A semantic vertical separator supports pointer drag, Arrow keys, Shift acceleration, Home/double-click reset, localized value text, and RTL-aware physical direction; below the desktop breakpoint it disappears and the existing stacked layout remains authoritative. Resizing never changes source-linked target identity, preview scroll authority, or canonical state.

## Checkpoint log

Device history is an append-only, per-artifact list of source snapshots. Applying a file or workspace Agent mutation records every patched pre-change source before the atomic write; a newly created artifact has no prior source to checkpoint. ⌘S records an explicit manual snapshot; restoring an older snapshot first records a safety checkpoint of the current source. Consecutive identical snapshots are deduplicated, malformed storage is ignored, and each artifact retains at most 24 checkpoints within a 500,000-character budget. Sources over 200,000 characters require export instead of a localStorage snapshot, and quota failures remain visible in the save indicator. Both drafts and checkpoints share the local workspace storage envelope, so refresh no longer destroys the normal undo boundary.

## User-owned folder storage port

The optional File System Access adapter maps each artifact to its existing readable filename and writes one `rune.workspace.json` manifest containing only version, order, ids, kinds, names, languages, and—when present—bounded asset metadata. Source and binary bytes never move into the manifest. Source-only version 1 remains readable. Version 2 maps each exact referenced image id to name, MIME, and size; the corresponding bytes live at `.rune-assets/<sha256>.<ext>`. A folder without a manifest can be scanned by supported extension and receives stable filename-derived ids only when it contains no `rune-asset:` references; hidden files, subdirectories, and unsupported formats are otherwise ignored.

Folder reads are bounded to 50 artifacts, 2 MB per source file, 8 MB source total, 40 images, 8 MB per image, and 64 MB image total. Rune parses every source, validates unique identity, recompiles metrics/charts, requires exact asset-reference closure, and repeats image magic-byte/hash checks before offering replacement. An accepted Pull stores/deduplicates assets, checkpoints every current artifact, then uses one local source-persistence write; failure removes only assets created by that Pull. Push is deliberately manual and confirmed: it first rereads and verifies every referenced IndexedDB asset, writes `.rune-assets` before source, overwrites only matching names, never deletes unrelated files, and writes the manifest last. Browser filesystem writes do not provide a cross-file transaction, so an interrupted Push reports the exact file or asset where it stopped and never claims atomicity.

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
18. v0.20 derives a navigable dependency graph from canonical bindings and uses an upstream-closed six-file subgraph as explicit Workspace Agent context.
19. v0.21 adds session-only user pins as explicit roots for cross-component Agent context without persisting hidden relationships.
20. v0.22 makes Query output a revision-bound Chart source, completes the Data-to-SQL-to-Chart-to-report/deck graph, and freezes exact local snapshots into export.
21. v0.23 binds `workspace_data` to an exact Data artifact in readable SQL while retaining a visible legacy fallback for imported Queries.
22. v0.24 compiles exact one-row Query outputs into revision-bound numeric metrics across preview, dependency context, Agent safety, and frozen export.
23. v0.25 exports reviewed Markdown Documents as A4 PDF and Deck Markdown as one fixed 16:9 page per slide, with embedded Unicode text and exact current Query/Chart snapshots.
24. v0.26 lets configured Workspace models inspect bounded current Query evidence and requires every proposed SQL change to pass exact local runtime plus downstream scalar/Chart preflight before review.
25. v0.27 expands that gate into a proposed Data/Query runtime impact graph, executing every bound Query and verifying legacy metrics plus direct and Query-backed Charts before review.
26. v0.27.1 replaces runtime-dependent compact locale formatting with one shared deterministic display compiler so server render, hydration, preview, and export stay byte-consistent.
27. v0.28 lets a configured model replace one failed, unapplied Data/SQL proposal from bounded local compiler feedback, then requires the replacement to pass the unchanged full runtime-impact and review boundaries.
28. v0.29 adds keyed Data-column upsert and exact rename operations for CSV/flat JSON, compiling spreadsheet-scale intent without granting row insertion or bypassing downstream runtime validation.
29. v0.30 adds ordered line Charts to the same strict source, provenance, runtime-impact, React, HTML, Office, and PDF compiler boundary as bar Charts.
30. v0.31 lets people and Agents create exact source-bound Query/Chart artifacts, runtime-verifies them, and optionally embeds a new Chart into a checkpointed Markdown/Deck consumer in one atomic device transaction.
31. v0.32 resolves ordered action-local creation handles into one runtime-verified Data → Query → Chart → Document/Deck transaction, while rejecting forward or guessed identities and giving the no-key planner the same complete workflow outcome.
32. v0.33 compiles current-versus-proposed source graphs into a focused transaction review that exposes changed bindings, exact input lineage, and transitively validated consumers without replacing source diffs.
33. v0.34–v0.38 add Apple-inspired onboarding and model setup plus exact visual writes for Data cells, Document sections, Deck slides, and Chart properties through one revision-bound transaction.
34. v0.39 imports selectable PDF text into reviewed page-provenance Markdown through a bounded local PDF.js port.
35. v0.40 imports and exports ODT/ODS/ODP as reviewed semantic canonical-source handoffs with strict ODF packaging, security limits, and official schema validation.
36. v0.41 adds reversible Document draft formatting commands and keyboard shortcuts that operate on exact textarea ranges while the safe preview recompiles live.
37. v0.42 makes rendered CommonMark/GFM Document blocks keyboard-targetable and maps compiled metric text back to exact canonical source ranges.
38. v0.43 makes AST-proven Document blocks visually editable through a same-type compiler and the shared checkpointed atomic source-write transaction.
39. v0.44 adds reviewed insert-before/after, adjacent move, and delete operations over those revision-bound block identities, with exact source diffs and atomic checkpoints.
40. v0.45 resolves each current source caret or selection to the smallest containing compiler-proven preview target and scrolls that exact target into view without granting the caret any write capability.
41. v0.46 adds encrypted per-browser OpenAI/OpenRouter/custom Responses profiles, bounded model discovery, and explicit switching without changing Agent write permissions.
42. v0.46 also updates the production dependency chain, pins the build-only image parser away from unsupported vulnerable formats, and makes the production audit a release gate.
43. v0.47 adds a deterministic task-first Data → Query → Chart → Document/Slides operating-review compiler behind the unchanged runtime and atomic review gates, and merges animated device-language welcome into Rune's quieter content-first visual system.
44. v0.48 extends the exact bidirectional source map from Document blocks into individual list items, GFM table cells, and inline Markdown semantic nodes without trusting rendered text.
45. v0.49 makes locale an explicit dependency across the primary workbench, review surfaces, suggestions, dependency maps, and every visual artifact editor while keeping SSR deterministic.
46. v0.50 adds explicit-page, English/Simplified-Chinese browser-local OCR for scanned PDF pages with same-origin assets, stoppable progress, page provenance, visible confidence, and the unchanged atomic import review.
47. v0.51 mirrors every controlled visual draft into a complete highlighted canonical-source candidate without granting that temporary projection persistence or write authority.
48. v0.52 normalizes Data into deterministic rectangular CSV/JSON snapshots and fixed landscape PDF tables behind the same stale-context export review; canonical source, XLSX, and ODS remain adjacent explicit choices.
48. A desktop shell can implement the same storage and secret ports with directory watching, atomic rename, and system-keychain semantics later.
49. Collaboration adds an operation log and CRDT only after multi-user demand is proven.
50. D1/R2 remain undeclared until durable hosted projects or assets are required.

This avoids paying for identity, databases, and sync before they improve the core loop.

## Composable task runtime

Rune tasks are declarative product capabilities, not extra modal booleans inside the workbench. A task definition declares a stable id, the source capability it can accept, and the Artifact kinds it may consume. A short-lived task session records only explicit lifecycle facts (`awaiting-source → reviewing-source → configuring`) plus the captured workspace revision and exact imported Artifact identities. The runtime is a pure TypeScript module: it cannot import React, persistence, browser APIs, providers, or filesystem adapters.

The workbench is the assembly boundary. It may open the task-specific picker, run the existing import converter, present the existing atomic import review, and then pass the reviewed result back through the task runtime. The runtime proves the captured workspace revision, import-review identity, ordered imported ids, accepted Artifact kinds, and preferred source before the UI may continue. Only the existing import transaction writes the accepted source. Cancelling, choosing an incompatible file, changing the workspace, changing the reviewed import, or losing the preferred source closes the continuation without a task side effect.

This design takes four durable ideas from [Cordis](https://github.com/cordiverse/cordis) and [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): explicit lifecycle rather than implicit mounted state; declared capabilities rather than cross-module reach; pure components/geometry fed through narrow shares; and automated dependency-boundary checks. Rune deliberately does **not** add either repository as a runtime dependency, adopt Harness's chat/session shell, or introduce a dynamic plugin loader while the product is still proving its core Office tasks. Their plugin APIs are broader than Rune needs and currently carry avoidable migration cost. We use static typed composition first and keep the seam small enough to replace later.

Adding a task now has a bounded path:

1. Add its static definition and accepted Artifact kinds to the task registry.
2. Add pure phase transitions that capture exact revisions and identities.
3. Reuse an existing reviewed import/compiler/mutation capability; do not write from the task runtime.
4. Add one assembly entry in the workbench and one focused task surface.
5. Extend the architecture gate so the new runtime still has no React, persistence, network, or browser dependency.

The first migrated path is operating review: Welcome or Empty workspace → choose CSV/JSON/XLSX/ODS → inspect the generated Data source → confirm one atomic import → map fields and deliverables with that exact imported Data source preselected. Independent multi-format Import and the existing manual operating-review entry remain available; they do not share hidden task state.

## Security boundaries

- Markdown is rendered as React elements and does not execute embedded HTML.
- Deck Markdown rejects raw HTML, validates layout metadata, and escapes user text before entering a restrictive no-script iframe; legacy HTML receives only the sandboxed compatibility path.
- CSV and JSON parsing is local and must expose validation errors rather than guessing silently.
- SQL runs in a dedicated browser worker; an optional first-line quoted Data directive is identity-resolved before execution, the preview accepts one read-only query, bounds visible results to 500 rows, and grants result targets only to a compiler-proven one-table row-preserving subset with safe hidden ids and unique direct columns. Query-backed charts require a current non-truncated snapshot of that same resolved Data revision; Query-backed scalar metrics additionally require exactly one row, one unambiguous output cell, and a finite numeric value. Static output inference never grants runtime value or provenance.
- Chart JSON is strict and code-free; only bar/line marks and bounded finite points are accepted, and text is React-escaped or HTML/XML/PDF-sanitized before preview and export rendering.
- Agent provider output contains only bounded discriminated patch/create actions and source operations. It cannot author creation identity, filenames, extensions, language metadata, complete source, or state writes. Keyed Data-column updates cannot modify their key or insert rows; new columns require complete current-row coverage; renames reject missing, multiline, whitespace-padded, unchanged, or colliding headers. Artifact/template mismatch, missing or ambiguous heading/key/title, duplicate key/cell, nested JSON, Deck separator injection, repeated-file, identity collision, cancelling, oversized, stale-revision, or downstream-invalid plans produce no workspace write.
- Workspace model context contains only upstream-closed components rooted at the selected artifact or at most six session-only user pins within seven-file/180,000-character limits; the server recompiles every dependency, rejects unpinned disconnected padding, and the full client workspace remains the final validation and revision boundary.
- Query evidence is accepted only in verified Workspace scope after the server confirms a configured provider, is bounded by rows/columns/cells/string and total JSON size, must match every Query and resolved Data identity in exact order, is labelled for truncation/error, and is never persisted or granted write authority. Evidence cell, column, and error strings are explicitly untrusted data rather than model instructions. Because the pack is client-computed rather than attested, canonical source and deterministic compilers remain the authority.
- Every Agent-authored Data, Query, or Chart source enters a local proposed-workspace impact gate before review. Rune executes only directly changed Queries, Queries bound to changed Data, and exact Query sources selected by changed/new Charts, then validates affected legacy metrics, Query scalars, direct-Data Charts, and Query-backed Charts from the same proposed revisions. Any Data parse/value, SQL, cardinality, type, truncation, schema, or Chart-value failure creates no pending mutation and writes no history or state; disconnected new Data and direct-Data Charts never broaden SQL execution.
- A configured provider receives at most one automatic repair request after its first unapplied proposal fails that impact gate. Feedback contains only 1–4 identity-checked proposed sources plus a normalized 1,000-character failure within the existing source budgets, is labelled untrusted, and retains no write authority. A replacement is accepted only with the exact attempt marker and after server compilation plus a second complete local impact proof; any failure stops without recursive retry or deterministic fallback.
- Selection Agent requests bind non-empty UTF-16 offsets to one exact source revision, reject surrogate-splitting or oversized ranges, and require the server compiler and client Apply path to independently prove that source outside the selection is unchanged.
- Preview targets are locally derived from the current canonical revision and only populate that existing selection contract; Markdown fragment syntax and delimiters, CSV quotes, and JSON value delimiters stay inside exact ranges, while Chart-bearing fragments and empty/ambiguous data tokens receive no competing capability. The reverse link also starts from current UTF-16 source offsets, chooses the smallest containing proven range (Document fragment before block before section, Data cell before row), and uses DOM only to scroll the already-proven id into view. Rendered DOM, sandbox contents, labels, and indices never become write authority, and derived views without exact source provenance remain non-targetable.
- Controlled preview editors may project an unsaved input into a complete source mirror only through their existing revision-bound compiler. The mirror carries exact replacement offsets and validation errors, is read-only in the canonical pane, never enters artifact state, persistence, history, exports, folder sync, dependencies, or Agent context, and is discarded on Cancel. Save recompiles from the unchanged base artifact, then uses the normal whole-workspace/runtime/checkpoint gate; the mirror itself has no write authority.
- Document structure operations re-resolve the full block identity against the current CommonMark/GFM AST. Insert accepts exactly one supported block and cannot mint live bindings; move swaps only adjacent supported siblings while preserving their bytes and intervening whitespace; delete refuses the final block and removes a proven adjacent separator. Every proposed source is shown in a modal diff, then recompiled byte-for-byte at confirmation before workspace validation, checkpoint, and one persistence write. Unsupported top-level nodes, ambiguous gaps, stale targets, heading/body ambiguity, cancellation, and storage failure grant no write.
- Bar and line marks retain compiler-owned provenance through sorting, truncation, and line normalization, then resolve direct Data or direct Query-projected fields against current canonical cell targets; derived Query fields remain read-only, and cross-artifact targeting never matches by a duplicate label, visible order, formatted value, or DOM/SVG geometry.
- Creation accepts bounded single-line titles plus exact typed Query/Chart bindings; generated identity is portable and collision-safe, optional Chart embedding checkpoints its consumer, the complete next workspace and runtime impact validate before persistence, and a failed device write leaves React state unchanged.
- OOXML import rejects oversized/unsafe ZIP parts, path traversal, DTD/entity declarations, invalid output adapters, and partial device writes; binary input never leaves the browser.
- OpenDocument import additionally requires an extension-matched root MIME declaration and an uncompressed first `mimetype` ZIP entry, rejects encryption and duplicate paths, ignores scripts/macros and signatures, bounds repeated spreadsheet extents without expanding empty rows or columns, and encodes binding braces before canonical validation.
- PDF import requires bounded local bytes and a valid header, disables eval and remote PDF fetching, refuses passwords, encodes binding braces, caps pages/fragments/rendered pixels/output, ignores document JavaScript, and exposes every extraction loss before the shared import confirmation. Scan OCR additionally requires an exact detected-page selection and language choice, uses bundled same-origin worker/core/language assets, labels page provenance plus confidence, supports stop-without-write, and cannot run over selectable or missing pages.
- Import confirmation rejects stale workspace context and keeps quota failures inside the open review instead of partially updating React or device state.
- Office export sanitizes XML characters, restricts hyperlink schemes, writes spreadsheet text as values rather than formulas, resolves Query metric and chart snapshots only through validated workspace artifacts, rejects stale review context, and caps generated package bytes.
- OpenDocument export emits deterministic ODF 1.3 packages with restricted HTTP/HTTPS/mailto links and no scripts, formulas, external media dependencies, or live bindings; exact MIME/manifest structure, official Relax NG validation, revision-bound snapshots, stale review rejection, and package caps are required before handoff.
- Standalone HTML export requires every legacy metric, Query metric, and chart binding to resolve from current revisions, escapes user content, rejects executable or external-resource elements and attributes after rendering, checks stale review context, and caps final UTF-8 bytes.
- PDF export accepts only validated Markdown Documents or Deck Markdown, resolves every metric and chart against current revisions, validates its same-origin WOFF2 asset, replaces unsupported glyphs visibly, fixes metadata, emits no JavaScript/forms/external resources, checks stale review context, and caps source, font, and final bytes.
- Folder manifests reject hidden/path-like names, duplicate identity, missing sources, oversized payloads, and invalid dependency graphs before Pull.
- Provider keys belong in server-side secrets; they are never committed or stored in browser drafts.
- XLSX import reads cached formula values and prefixes formula-leading text with an apostrophe before it becomes CSV; future generated CSV/XLSX export must reuse this injection boundary.

## Evolution path

### Interface design-system boundary

Rune treats interface architecture as a stable product contract rather than a growing cascade of component exceptions. `app/globals.css` is now a frozen compatibility layer for the existing inventory; all new design-system authority loads once from `app/styles/index.css` in this dependency order: tokens, shell, content, overlays, onboarding, motion, responsive. Tokens own the spacing/type/curve/content-width/motion scales and the only numeric layer map. Shell may place the top bar, rails and panes; content may style canonical source and compiled output; overlays may place menus and modal surfaces but cannot change page layout; onboarding owns only setup; motion cannot define geometry; responsive may adapt existing semantics but cannot invent a parallel component design.

The root layer order is canvas → workspace → status → pane disclosure → top bar → global float → blocking modal → onboarding. Every module other than tokens consumes semantic `--rune-layer-*` values; numeric `z-index` values are forbidden there. The app shell deliberately avoids `isolation` and overflow clipping, the top bar and pane headers expose their overlay anchors, and every viewport-bound popover has a maximum block size plus its own scrolling. Structural entry animations use `animation-fill-mode: backwards`, so their finished transforms do not remain as accidental stacking contexts. A future portal root may replace top-bar containment without changing the layer contract.

The geometry follows a content-first baseline informed by ColaMD without copying its product shape: compiled prose stays at 780px with 16–16.5px text and approximately 1.72–1.75 line height, while the workflow rail settles at 220px. Rune retains the simultaneous source/preview workspace that ColaMD does not need. Appearance shows one named current material and a compact swatch strip; locale names remain in accessible labels rather than forcing nine long localized names into a small popover. The welcome primary action sits inside the language decision surface, preventing a detached control from colliding with short-height content.

`tests/design-system-architecture.test.mjs` enforces module order, single-source layer authority, unclipped overlay anchors, tier relationships, the content geometry, and welcome-action placement. New UI work must extend these semantic modules and tests instead of appending a versioned “cascade seal.”

### Workspace presentation state

The source/preview ratio and the `split | source | preview` focus mode are bounded device-local presentation preferences. Focus modes hide a mounted pane with CSS rather than creating, copying, or replacing artifact state. Canonical source, revision-bound visual drafts, preview targets, checkpoints, dependency state, folder manifests, Agent context, and exports never read these preferences. Opening a proven preview target while Source is hidden restores Split before applying the exact canonical selection; returning from Source to a preview-capable mode replays scrolling from the retained parser-derived target identity.

The shared shortcut resolver accepts only `Meta/Control + Alt + physical Digit1/2/3`, rejects Shift and other keys, and is reused by both onboarding practice and the workbench. The workbench suppresses this presentation action while any modal review, import/export, model setup, pending Agent proposal, or revision-bound visual draft owns interaction. Controls expose the same contract through localized labels and `aria-keyshortcuts`.

Preview provenance uses progressive disclosure only at the presentation boundary. The always-visible summary is derived from the current validation error count; its native details body renders the same current source target, exact Data/Query source, metric/Chart binding counts, and validation result that previously occupied the header. It owns no copied evidence state, has no influence on compilation or permissions, and retains native keyboard semantics plus RTL/mobile placement.

Top-bar disclosure is likewise presentation-only. Review creation, artifact creation, import, and contextual export remain direct task actions. Help/onboarding, model setup, directory connect/Pull/Push, and appearance reuse their existing handlers from one localized menu; appearance choices remain nine explicit `menuitemradio` controls. Each named theme maps a device-finish swatch to a separate contrast-safe interface accent, while the persisted id and Rune vermilion brand mark stay independent. The More Tools and Export surfaces are mutually exclusive and share outside-click/Escape dismissal, but neither menu owns command, credential, directory, or artifact state.

Desktop workspace material is a CSS-only continuous surface: activity/file rails, source, separator, and preview keep their component, scroll, aria, and revision boundaries, while adjacent borders/gaps/shadows collapse and only physical outer panes own corner radii. Focus modes transfer the trailing radius to the last visible pane, and RTL mirrors physical edges. At 960px and below, panes recover independent borders, radii, shadows, and spacing for the existing stacked document flow.

Source header disclosure reuses the existing `historyOpen` boolean and checkpoint panel rather than introducing another version model. Its summary combines the selected artifact's language and current checkpoint count; the panel adds the unchanged nearest-different undo handler beside manual checkpoint save and exact checkpoint restore. All enablement still derives from current source equality and visual-draft locks, and only the presentation/placement changes.

Status-bar simplification is presentation-only. The left side continues to render the existing bounded `visibleNotice`; the right side derives artifact statistics directly from the selected canonical source. Encoding, binding counts, validation evidence, and product version are not copied into new state: provenance remains in the Preview disclosure, while the static version moves to the More Tools footer. This keeps the bottom edge task-focused without weakening any validation or source contract.

Assistance chrome is likewise presentation-only. The source-integrated composer, existing three-way scope setter, planner-status badge, and native suggestions disclosure all read the same prompt, selection, dependency context, provider mode, and Query-evidence count. Suggested commands still call the same `runAgent` boundary, while a pending mutation continues to expand the complete patch/runtime/transaction review above the composer. Removing the persistent avatar/title card and collapsing idle suggestions does not alter context authority, runtime gates, checkpoints, or Apply/Discard behavior.

### Agent proposal projection

A valid pending Agent mutation owns an ephemeral, complete candidate workspace derived by the same `prepareWorkspaceMutation` gate used before Apply. `prepareWorkspaceProposalPreview` is a pure projection: it first requires the exact captured source revision, then prepares all patches and creations atomically, and returns either the complete proposed artifact array or no candidate at all. It never persists, checkpoints, fetches, exports, or mutates its caller's artifacts. New identities are visible only inside the projection until Apply.

The workbench may present any artifact from that candidate workspace, not only a changed node. The source pane shows that artifact's complete proposed source read-only; the preview receives the complete proposed workspace so Query results, scalar metrics, Chart models, Documents, and Decks compile against the same transaction. This is especially important for an unchanged downstream deliverable: its source can remain byte-identical while its rendered values change because an upstream Data, Query, or Chart proposal changed. Transaction-map and file-rail selection only choose which candidate artifact to inspect; they grant no new edit capability.

Proposal projection is presentation state, not an optimistic write. Preview-to-source targeting and every visual edit callback are disabled while it is active, and the canonical source revision continues to own Agent context, checkpoints, local persistence, directory Push, and export. Apply and Discard are the only state transitions out of review. Apply repeats revision and whole-workspace validation before the existing single persistence transaction; Discard destroys the projection. A stale revision, duplicate/unknown patch, invalid creation, broken binding, or other mutation error fails closed and cannot expose a partially prepared workspace.

File-rail workflow grouping is a render-time projection over the canonical `WorkspaceArtifact[]`: Data maps to Sources, Query/Chart to Analysis, and Document/Slides to Deliverables, preserving the original array order inside each group. Group ids are presentation constants rather than persisted folders or graph nodes. Selection, temporary pins, context closure, revisions, directory manifests, and exports continue to resolve exact artifact ids; semantic sections and localized headings only improve navigation hierarchy.

Top-bar simplification reuses existing handlers and state. New, Import, Export, and More Tools remain global controls; operating-review creation retains the same handler in the persistent activity rail rather than rendering a duplicate top-bar button. The compact `role="status"` save indicator derives its accessible label and title from existing save state, timestamp, and localized copy. Workspace identity still reads the directory handle or local-workspace label; no navigation, persistence, task, or save model changes.

The full-screen Setup Assistant is a presentation change over the existing `WelcomeExperience` state machine. `welcome | model | shortcuts | ready`, locale detection/selection, provider status, local fallback, real shortcut capture, dismissibility, and completion actions are unchanged. The viewport-sized shell supplies one sticky chrome row plus a scrolling page; the step strip exposes `progressbar` min/max/current values. No onboarding state enters Artifact, workspace persistence, model credentials, or export state beyond the already explicit completion choices.

Preview lineage relocation moves the existing render branches into the existing native evidence disclosure. Chart source, Query/Data resolution, Query scalar references, legacy metric references, and embedded Chart ids continue to derive synchronously from the selected artifact and current workspace; the same localized status text is rendered. The default preview body now owns only the compiled-output scroll container. No lineage snapshot, validation cache, alternate identity, or permission path is introduced.

Device-local Document images use one strict `rune-asset:sha256:<64 lowercase hex>` source contract. PNG/JPEG/WebP/GIF bytes are magic-byte validated, capped at 8 MB each, hashed before review, and stored in an IndexedDB object store capped at 40 records/64 MB. The canonical Markdown contains only the content-hash reference and required alt text; it never contains base64. Preview resolution rereads the blob, repeats size/format/hash validation, creates an ephemeral object URL, and revokes replaced URLs. Missing or corrupt bytes fail closed.

Image insertion is revision-bound and review-before-write. Rune stores/deduplicates the asset first, persists the validated next workspace and pre-write checkpoint second, and removes a newly created asset when source persistence fails. Existing deduplicated bytes are never deleted by compensation. This is the device foundation only: raw source download, directory sync, compatibility import, and Office/ODF/PDF export do not yet claim binary fidelity and must reuse this exact identity when portable asset packaging is introduced. Hosted R2 remains undeclared.

| Stage | Capability | Infrastructure added only then |
| --- | --- | --- |
| Foundation | Source-bound creation plus five live artifact editors with preview-to-source targeting and optional Chart embedding | Deterministic source templates, target compilers, client adapters, and local persistence |
| Trust | Selection-confined and multi-file patch review, atomic apply, persistent checkpoints | Local revision log and duplicate selection-boundary verification |
| Intelligence | Provider-backed artifact-aware patch/create actions over graph-bounded or explicitly pinned context, with configured-only Query evidence, runtime-verified Data/SQL proposals, and one compiler-guided replacement attempt compiled into reviewed concrete workspace mutations | Agent API, derived context graph, ephemeral user pins/evidence/repair feedback, shared creation factory, runtime impact compiler, and deterministic semantic/selection-operation fixtures |
| Data loop | Keyed row/column operations over readable CSV/flat JSON, explicit multi-Data SQL binding, shared legacy or Query-backed scalar metrics, Data- or Query-backed reusable charts, navigable dependencies, frozen exports, exact table/chart/query-to-cell provenance, and proposed Data-to-consumer runtime verification | Deterministic Data operation compiler, DuckDB-Wasm, source identity resolver, ephemeral revision-bound snapshots, and source-derived graph compiler |
| Presentation source | Deck Markdown compiler and legacy HTML bridge | No hosted infrastructure |
| Collaboration | Shared projects | Auth, D1 metadata, R2 assets, Yjs transport |
| Compatibility import | Semantic DOCX/XLSX/PPTX, ODT/ODS/ODP, selectable-text PDF ingestion, and explicit browser-local scan OCR | Lazy local ZIP/XML, PDF, and same-origin OCR adapters |
| Compatibility export | Deterministic CSV/JSON, semantic DOCX/XLSX/PPTX and ODT/ODS/ODP, standalone Deck HTML, and fixed Document/Data/Deck PDF | Lazy deterministic adapters; isolated workers only when needed |

## Quality gates

The production-dependency audit (`npm run audit:production`) is a release gate alongside the build, typecheck, lint, and test suite.

Every milestone needs a production build, typecheck, unit coverage for parsers and mutation application, one end-to-end golden workspace, accessible keyboard operation, and a one-sentence entry in `PROGRESS.md`. Creation fixtures must prove all five canonical starter sources validate, Query/Chart source and field identities are explicit, optional Document/Deck embedding is one checkpointed atomic mutation, Unicode Chart ids remain bindable, filename/id collisions resolve case-insensitively, unsafe titles/bindings and workspace limits fail without mutation, and the shipped client exposes the accessible flow. Agent creation fixtures additionally prove Structured Outputs expose only Rune-bounded core/query/chart intent; zero-edit typed creation and all five source families compile; action-local handles are unique, ordered, stripped from concrete output, resolve collision-safe ids, and authorize only their exact source/Chart edges; forward, wrong-kind, missing, duplicate, and lucky guessed-id references fail; typed Chart append works for Markdown and Deck without duplicate bindings; mixed patch/create mutations are atomic; unsafe created bindings/Deck markup reach the unchanged downstream safety gate; and the no-key local path creates a complete runtime-verified Query → Chart → report/deck workflow from visible context. Transaction-review fixtures must prove a new analysis chain includes only its exact upstream input and created descendants; changed Data expands to every transitive downstream consumer; removed bindings remain visible; same-identity field contracts become updated edges; invalid mutations render no graph; changed nodes retain exact diff selection; and the native details/summary surface is keyboard operable. Proposal-projection fixtures must prove complete proposed sources and creations remain in memory only; an unchanged downstream deliverable recompiles against proposed upstream Data/Query/Chart; any transaction node is inspectable; stale or invalid proposals expose no partial candidate; and the shipped UI disables source writes, preview targeting, and visual edit callbacks until Apply or Discard. Selection fixtures must prove textarea-compatible UTF-16 offsets, emoji-surrogate safety, exact selected-source provider context, stale/collapsed/oversized rejection before provider work, server-side prefix/suffix confinement after typed-operation compilation, deterministic local fallbacks, and the repeated client Apply boundary. Preview-target fixtures must prove non-overlapping Markdown sections that ignore fenced headings; quote-aware multiline, escaped, empty, and greedy-skipped CSV fields; exact JSON property/primitive/nested-value ranges with missing and duplicate-key refusal; Deck ranges without frontmatter or separators; accessible cell/row/section/slide controls; current-revision focus; and the explicit absence of false targets for derived or legacy views. Reverse-link fixtures additionally prove a caret or contained selection chooses the smallest current target, shared boundaries choose the target beginning there, cross-block/row/section ranges fall back only to a proven container, invalid or Unicode-splitting offsets fail closed, Query/legacy views remain unlinked, parser-derived ids reach rendered destinations, and motion respects the user's reduced-motion preference. Chart-provenance fixtures must additionally prove source-row indices survive sorting, truncation, and duplicate labels; line geometry handles negative, zero, flat, single-point, and positive finite series without losing order or identity; category/value fields from direct Data or direct Query projections resolve to exact current CSV/JSON cell ranges; derived fields and invalid mappings remain read-only; stale/truncated/missing Query snapshots fail closed; native click/Enter/Space controls ship for bar labels/values and line labels/points without changing static exports; deterministic inline SVG stays scriptless; and formatted values remain identical across SSR, hydration, static HTML, DOCX trend tables, PPTX native vectors, and PDF vectors without runtime-locale compact notation. Query-provenance fixtures must prove canonical import-order identity survives greedy-empty rows, filtering, sorting, aliases, stars, limits, and direct/derived mixed projections; aggregates, grouping, DISTINCT, JOIN, CTE, set, pivot, window, unknown-function, reserved-name, arity, and stale-revision cases expose no false target; and native result row/cell controls reuse current source targets. Query-source fixtures must prove quoted Unicode ids, legacy fallback, malformed/displaced/duplicate rejection, explicit missing/non-Data refusal, order-independent graph closure, wrong-source execution refusal, and exact source preservation by local and provider instructions. Query-output fixtures must prove conservative static names, explicit derived aliases, duplicate/ambiguous rejection, exact revision-bound snapshots, one shared preview execution per Query, and deterministic Office/HTML/PDF freezing. Query-metric fixtures must prove strict three-argument syntax, exact Query/column/format identity, one-row finite-number cardinality, pending/stale/truncated/multi-row/nonnumeric refusal, format output, order-independent Data binding, Agent scope confinement, downstream schema veto, shared preview execution, and deterministic Office/HTML/PDF freezing. Agent-evidence fixtures must prove configured-only 428 negotiation, no-key early fallback, exact Query/Data identity and order, ready/error variants, row/column/cell/string/aggregate truncation, seven-file eligibility, retry-only model input, and rejection before provider work for missing, extra, stale, or fabricated evidence. Runtime-impact fixtures must prove document-only plans never start DuckDB; changed Query executes against exact proposed Data; changed Data executes every and only identity-bound Query; changed/new direct Data Charts run no SQL; changed/new Query Charts execute their exact source; a symbolic new Data → Query → Chart chain runs as one graph; disconnected new Data runs no unrelated SQL; direct Data Chart, Query Chart, legacy metric, and Query scalar consumers are counted and validated; stale/runtime-invalid results create no review; and runtime-valid outputs still fail on scalar cardinality/type/truncation or Chart schema/value errors. Runtime-repair fixtures must prove only literal attempt 1 is accepted; failure/source/action budgets, existing and creation identity, Data/Query/Chart relevance, Workspace totals, and Selection confinement fail closed; canonical request and Query evidence survive unchanged; the provider sees feedback only as untrusted replacement context; a response carries the exact repair marker; the shipped client exposes one-repair/no-write review and stop states; and the evidence/preflight modules remain lazy. Dependency-context fixtures must prove all six edge families, unresolved intent, deterministic multi-root traversal, explicit pin inclusion, required upstream closure, original-order legacy semantics, identity-bound Query semantics, per-file/total caps, server rejection of fabricated edges and unpinned disconnected padding, context-confined local fallback, accessible native pin controls, session-only clearing, and the absence of hidden persisted graph state. OOXML import uses generated ZIP fixtures for all three package families and hostile-input boundaries; Office export must be byte-deterministic, well-formed, pass Rune import round-trips, keep generated slide shapes within the declared canvas, and open through an independent installed Office/Quick Look handler during release QA. OpenDocument import must cover independent ODT/ODS/ODP fixtures, exact MIME/manifest checks, scripts/encryption/entities/path safety, repeated empty spreadsheet extents, cached formulas, and safe canonical output; OpenDocument export must be byte-deterministic, pass Rune round-trips, validate every XML part against the official OASIS Relax NG schemas, and pass installed-handler checks where automation is available. Standalone HTML must resolve all workspace bindings, reject executable/external content, stay byte-deterministic, and render through an independent system HTML handler. PDF export must resolve all bindings, reject unsupported/stale/truncated inputs, stay byte-deterministic, preserve A4 or 16:9 geometry, load through an independent parser, expose no JavaScript/forms/encryption, and pass Poppler rendering plus visual inspection of every page. Agent operation fixtures must cover ordered exact fallbacks; unique/missing/ambiguous Markdown headings, typed CSV/JSON row keys, keyed column additions/updates, exact column renames, and Deck titles; flat-JSON and slide-fragment boundaries; incomplete coverage, repeated/missing keys, key immutability, header collision/whitespace, empty CSV headers, scalar type/shape/newline preservation, Selection confinement, artifact mismatches, no-ops, cancellation, size limits, foreign/duplicate targets, stale workspace revisions; one document-data-Deck atomic plan; and the unchanged full Data-to-SQL-to-Chart runtime gate. Review tests also cover stale context, warning deduplication, and bounded previews. Provider-backed behavior needs deterministic eval fixtures before it becomes a default path.
