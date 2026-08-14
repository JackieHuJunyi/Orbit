import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Rune artifact workbench", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="en" dir="ltr" data-theme="mist-blue">/);
  assert.match(html, /<title>Rune — Work that traces back to source<\/title>/i);
  assert.match(html, /Local workspace/);
  assert.match(html, /q2-review\.md/);
  assert.match(html, /Create operating review/);
  assert.match(html, /More tools/);
  assert.match(html, /\.docx,\.xlsx,\.pptx/);
  assert.match(html, /Live preview/);
  assert.match(html, /metrics compiled live/);
  assert.match(html, /Q2 revenue by region/);
  assert.match(html, />\$970K</);
  assert.doesNotMatch(html, /\$970\.00K/);
  assert.match(html, /chart-card embedded/);
  assert.match(html, /data-chart-source-row="0"/);
  assert.match(html, /data-chart-source-cell="category"/);
  assert.match(html, /data-chart-source-cell="value"/);
  assert.match(html, /Open Row 1 · Region in regional-revenue\.csv as Agent context/);
  assert.match(html, /Open Row 1 · Q2 Revenue in regional-revenue\.csv as Agent context/);
  assert.match(html, /Click a label or bar to open its exact source cell/);
  assert.match(html, /Running query source locally: regional-analysis\.sql/);
  assert.match(html, /Select or edit one exact block/);
  assert.match(html, /data-preview-source-target="document-section"/);
  assert.match(html, /data-preview-source-target="document-block"/);
  assert.match(html, /data-preview-source-target="document-fragment"/);
  assert.match(html, /data-document-block-type="heading"/);
  assert.match(html, /data-document-block-type="paragraph"/);
  assert.match(html, /data-document-heading-level="1"/);
  assert.match(html, /data-document-fragment-type="bold"/);
  assert.match(html, /data-document-fragment-type="list-item"/);
  assert.match(html, /data-document-fragment-type="table-header-cell"/);
  assert.match(html, /data-document-fragment-type="table-cell"/);
  assert.match(html, /Select exact Bold · live value source/);
  assert.match(html, /class="contains-task-list"/);
  assert.match(html, /class="document-block-edit"/);
  assert.match(html, /class="document-block-locate"/);
  assert.match(html, /Edit Q2 Business Review heading/);
  assert.match(html, /Select Q2 Business Review in canonical source for Agent context/);
  assert.match(html, /role="group" aria-label="Q2 Business Review source actions"/);
  assert.match(html, /data-preview-source-id="document-block:/);
  assert.match(html, /data-preview-section-id="document-section:/);
  assert.match(html, /aria-keyshortcuts="F2"/);
  assert.match(html, /role="separator"/);
  assert.match(html, /aria-orientation="vertical"/);
  assert.match(html, /aria-valuemin="35"/);
  assert.match(html, /aria-valuemax="65"/);
  assert.match(html, /Resize source and preview/);
  assert.match(html, /class="workspace with-file-rail view-split"/);
  assert.match(html, /role="group" aria-label="Workspace view"/);
  assert.match(html, /aria-label="Show source and preview"/);
  assert.match(html, /aria-label="Show source only"/);
  assert.match(html, /aria-label="Show preview only"/);
  assert.match(html, /Select Executive summary in canonical source for Agent context/);
  assert.match(html, /SQL metrics/);
  assert.match(html, /Saved on device/);
  assert.match(html, /New<\/button>/);
  assert.match(html, /aria-label="Create a new artifact"/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("renders all five canonical artifact modes", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /q2-review\.md/);
  assert.match(html, /CSV \/ JSON/);
  assert.match(html, /regional-analysis\.sql/);
  assert.match(html, /regional-summary\.sql/);
  assert.match(html, /DuckDB SQL/);
  assert.match(html, /regional-revenue\.chart\.json/);
  assert.match(html, /regional-margin\.chart\.json/);
  assert.match(html, /Chart JSON/);
  assert.match(html, /board-briefing\.deck\.md/);
  assert.match(html, /Deck Markdown/);
  assert.match(html, /aria-label="Data graph"/);
  assert.match(html, /aria-label="Pin q2-review\.md in Workspace Agent context"/);
  assert.match(html, />Selection</);
  assert.match(html, /aria-haspopup="menu"/);
  assert.match(html, />Export</);
  assert.match(html, /Live output/);
  assert.match(html, /every write remains reviewable and undoable/i);
});

test("keeps compatibility parsers and heavy runtimes out of the initial client bundle", async () => {
  const manifestUrl = new URL("../dist/client/.vite/manifest.json", import.meta.url);
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  assert.equal(manifest["app/lib/office-import.ts"]?.isDynamicEntry, true);
  assert.ok(manifest["app/components/rune-workbench.tsx"]?.dynamicImports?.includes("app/lib/office-import.ts"));
  assert.equal(manifest["app/lib/pdf-import-client.ts"]?.isDynamicEntry, true);
  assert.ok(manifest["app/components/rune-workbench.tsx"]?.dynamicImports?.includes("app/lib/pdf-import-client.ts"));
  assert.equal(manifest["app/lib/odf-import.ts"]?.isDynamicEntry, true);
  assert.ok(manifest["app/components/rune-workbench.tsx"]?.dynamicImports?.includes("app/lib/odf-import.ts"));
  assert.equal(manifest["app/lib/office-export.ts"]?.isDynamicEntry, true);
  assert.ok(manifest["app/components/rune-workbench.tsx"]?.dynamicImports?.includes("app/lib/office-export.ts"));
  assert.equal(manifest["app/lib/odf-export.ts"]?.isDynamicEntry, true);
  assert.ok(manifest["app/components/rune-workbench.tsx"]?.dynamicImports?.includes("app/lib/odf-export.ts"));
  assert.equal(manifest["app/lib/html-export.ts"]?.isDynamicEntry, true);
  assert.ok(manifest["app/components/rune-workbench.tsx"]?.dynamicImports?.includes("app/lib/html-export.ts"));
  assert.equal(manifest["app/lib/pdf-export.ts"]?.isDynamicEntry, true);
  assert.ok(manifest["app/components/rune-workbench.tsx"]?.dynamicImports?.includes("app/lib/pdf-export.ts"));
  assert.equal(manifest["app/lib/agent-evidence.ts"]?.isDynamicEntry, true);
  assert.ok(manifest["app/components/rune-workbench.tsx"]?.dynamicImports?.includes("app/lib/agent-evidence.ts"));
  assert.equal(manifest["app/lib/query-preflight.ts"]?.isDynamicEntry, true);
  assert.ok(manifest["app/components/rune-workbench.tsx"]?.dynamicImports?.includes("app/lib/query-preflight.ts"));
});

test("ships a complete-source live mirror for revision-bound visual Document drafts", async () => {
  const clientDir = new URL("../dist/client/assets/", import.meta.url);
  const bundle = (await Promise.all(
    (await readdir(clientDir)).filter((name) => name.endsWith(".js")).map((name) => readFile(new URL(name, clientDir), "utf8")),
  )).join("\n");
  assert.match(bundle, /complete source draft synced live/);
  assert.match(bundle, /Unsaved synchronized source draft/);
  assert.match(bundle, /visual-source-sync-state/);
  assert.match(bundle, /source-draft-mirror/);
  const previewSource = await readFile(new URL("../app/components/artifact-previews.tsx", import.meta.url), "utf8");
  assert.match(previewSource, /projectVisualDocumentSectionDraft/);
  assert.match(previewSource, /projectVisualDocumentBlockDraft/);
  assert.match(previewSource, /projectVisualDataCellDraft/);
  assert.match(previewSource, /projectVisualDeckSlideDraft/);
  assert.match(previewSource, /projectVisualChartSpecDraft/);
});

test("renders a complete read-only Agent proposal through the live source and output panes before Apply", async () => {
  const [workbench, projection, localization, contentStyles] = await Promise.all([
    readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/proposal-preview.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/localization.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/content.css", import.meta.url), "utf8"),
  ]);
  assert.match(workbench, /prepareWorkspaceProposalPreview\(\{/);
  assert.match(workbench, /requestedArtifactId: pendingReviewId \|\| undefined/);
  assert.match(workbench, /const presentedArtifacts = proposalPreviewActive/);
  assert.match(workbench, /readOnly=\{Boolean\(activeVisualSourceDraft\) \|\| proposalReviewActive\}/);
  assert.match(workbench, /artifact=\{presentedArtifact\}/);
  assert.match(workbench, /artifacts=\{presentedArtifacts\}/);
  assert.match(workbench, /activeSelection=\{proposalReviewActive \? null : activePreviewTarget\}/);
  assert.match(workbench, /onTargetSource=\{proposalReviewActive \? undefined : focusPreviewTarget\}/);
  assert.match(localization, /Proposed output · nothing written/);
  assert.match(projection, /workspaceMatchesSourceRevision\(input\.artifacts, input\.baseRevision\)/);
  assert.match(projection, /prepareWorkspaceMutation\(input\.artifacts, input\.patches, input\.creations\)/);
  assert.match(projection, /requestedArtifactId/);
  assert.doesNotMatch(projection, /persist|localStorage|indexedDB|fetch\(/i);
  assert.match(contentStyles, /\.source-editor\.proposal-source-preview/);
  assert.match(contentStyles, /\.preview-pane\[data-proposal-preview="true"\]/);
  assert.match(contentStyles, /\.proposal-preview-badge/);
});

test("ships exactly one compiler-guided repair request site before the repeated runtime gate", async () => {
  const source = await readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8");
  assert.equal(source.split("runtimeRepair: repairFeedback").length - 1, 1);
  assert.match(source, /repairPayload\.repairAttempt === 1/);
  assert.match(source, /preflightRuntimeImpact\(\s*replacementPlan\.patches,\s*replacementPlan\.creations/);
  assert.match(source, /Automatic repair stopped after one attempt/);
  assert.match(source, /Nothing proposed — one automatic repair attempt stopped; every source stayed unchanged/);
  assert.match(source, /\["document", "data", "query", "chart", "slides"\]\.includes\(artifact\.kind\)/);
  assert.match(source, /creation\.operationCount >= 0[\s\S]*creation\.operationCount <= 8/);
});

test("ships a review-before-write import surface in the client", async () => {
  const assetsUrl = new URL("../dist/client/assets/", import.meta.url);
  const files = (await readdir(assetsUrl)).filter((name) => name.endsWith(".js"));
  const clientSource = (await Promise.all(files.map((name) => readFile(new URL(name, assetsUrl), "utf8")))).join("\n");
  assert.match(clientSource, /Review imported sources/);
  assert.match(clientSource, /PDF import recovers selectable text and approximate reading order/);
  assert.match(clientSource, /scanned PDFs require explicit page and English\/Simplified-Chinese OCR choices/);
  assert.match(clientSource, /Choose pages for OCR/);
  assert.match(clientSource, /Page images stay on device/);
  assert.match(clientSource, /On-device recognition/);
  assert.match(clientSource, /\.doc,\.ppt,\.docx,\.xlsx,\.pptx,\.odt,\.ods,\.odp,\.pdf/);
  assert.match(clientSource, /OpenDocument import is limited to 12 MB per file/);
  assert.match(clientSource, /Review OpenDocument export/);
  assert.match(clientSource, /Format Document section/);
  assert.match(clientSource, /⌘\/Ctrl B/);
  assert.match(clientSource, /Source draft/);
  assert.match(clientSource, /Synced live/);
  assert.match(clientSource, /document-source-block/);
  assert.match(clientSource, /document-block-edit/);
  assert.match(clientSource, /Save block/);
  assert.match(clientSource, /One proven/);
  assert.match(clientSource, /type and live bindings stay fixed/);
  assert.match(clientSource, /data-document-block-type/);
  assert.match(clientSource, /document-block-structure-actions/);
  assert.match(clientSource, /Open structure actions for/);
  assert.match(clientSource, /Insert a block before/);
  assert.match(clientSource, /Move block up/);
  assert.match(clientSource, /Delete block/);
  assert.match(clientSource, /Review insertion/);
  assert.match(clientSource, /Document structure.*revision-bound/);
  assert.match(clientSource, /Canonical source diff/);
  assert.match(clientSource, /One atomic device write.*checkpoint is created first/);
  assert.match(clientSource, /Nothing is written until you confirm/);
  assert.match(clientSource, /One atomic device write after confirmation/);
  assert.match(clientSource, /aria-modal/);
  assert.match(clientSource, /Review Office export/);
  assert.match(clientSource, /Review HTML export/);
  assert.match(clientSource, /Review PDF export/);
  assert.match(clientSource, /No workspace or device draft changes/);
  assert.match(clientSource, /self-contained scriptless file/);
  assert.match(clientSource, /Export as standalone HTML/);
  assert.match(clientSource, /Export as fixed PDF/);
  assert.match(clientSource, /fixed-layout PDF/);
  assert.match(clientSource, /semantic bar table/);
  assert.match(clientSource, /chart-line-point/);
  assert.match(clientSource, /Click a label or/);
  assert.match(clientSource, /point.*open its exact source cell/);
  assert.match(clientSource, /editable native PowerPoint text and vector shapes/);
  assert.match(clientSource, /typed source/);
  assert.match(clientSource, /workspace source revision changed/);
  assert.match(clientSource, /Create a new artifact/);
  assert.match(clientSource, /Start from readable source/);
  assert.match(clientSource, /One atomic device write · no upload/);
  assert.match(clientSource, /Nothing created — atomic device persistence failed/);
  assert.match(clientSource, /Document/);
  assert.match(clientSource, /Data table/);
  assert.match(clientSource, /SQL analysis/);
  assert.match(clientSource, /Live chart/);
  assert.match(clientSource, /Presentation/);
  assert.match(clientSource, /Source binding/);
  assert.match(clientSource, /Data or Query source/);
  assert.match(clientSource, /Category field/);
  assert.match(clientSource, /Value field/);
  assert.match(clientSource, /Embed in · optional/);
  assert.match(clientSource, /Create reusable Chart only/);
  assert.match(clientSource, /and embedded it in/);
  assert.match(clientSource, /Verifying live source/);
  assert.match(clientSource, /\[["'`]data["'`],\s*["'`]query["'`],\s*["'`]chart["'`]\]/);
  assert.match(clientSource, /New file/);
  assert.match(clientSource, /New source diff/);
  assert.match(clientSource, /Transaction map/);
  assert.match(clientSource, /Sources in proposed transaction/);
  assert.match(clientSource, /Proposed source dependency changes/);
  assert.match(clientSource, /Input and validated nodes remain unchanged/);
  assert.match(clientSource, /Workspace Briefing/);
  assert.match(clientSource, /根据当前报告新建一份演示/);
  assert.match(clientSource, /根据收入数据创建分析、图表和报告/);
  assert.match(clientSource, /source-bound analysis workflow/);
  assert.match(clientSource, /把选中内容压缩成一句话/);
  assert.match(clientSource, /把选中数值乘以 1\.1/);
  assert.match(clientSource, /change confined to this selection/);
  assert.match(clientSource, /selection-confined patch/);
  assert.match(clientSource, /Selection Agent is limited to/);
  assert.match(clientSource, /selection boundary verification failed/);
  assert.match(clientSource, /selected from preview · Selection Agent ready/);
  assert.match(clientSource, /linked from canonical source/);
  assert.match(clientSource, /linked in preview/);
  assert.match(clientSource, /data-preview-source-id/);
  assert.match(clientSource, /source-link-badge/);
  assert.match(clientSource, /prefers-reduced-motion: reduce/);
  assert.match(clientSource, /click a cell for exact Agent context/);
  assert.match(clientSource, /press Enter or use the pencil to edit a proven scalar cell/);
  assert.match(clientSource, /Select or edit one exact section/);
  assert.match(clientSource, /One revision-bound section.*live bindings stay fixed.*save writes canonical source/);
  assert.match(clientSource, /Verifying .* against the complete workspace/);
  assert.match(clientSource, /Verifying .* against every live Data consumer/);
  assert.match(clientSource, /row number for the full record/);
  assert.match(clientSource, /Select the exact/);
  assert.match(clientSource, /Select the complete canonical row/);
  assert.match(clientSource, /data-cell/);
  assert.match(clientSource, /Select or edit a Deck slide/);
  assert.match(clientSource, /Sandboxed one-slide preview/);
  assert.match(clientSource, /One revision-bound slide.*bindings stay fixed.*save writes canonical source/);
  assert.match(clientSource, /Bound chart source/);
  assert.match(clientSource, /Strict Chart JSON.*source identity locked/);
  assert.match(clientSource, /Runtime-validated draft/);
  assert.match(clientSource, /One strict spec.*runtime impact verified.*save rewrites canonical Chart JSON/);
  assert.match(clientSource, /Preview target is too large or no longer matches the current source/);
  assert.match(clientSource, /The preview target artifact is no longer in this workspace/);
  assert.match(clientSource, /Open exact/);
  assert.match(clientSource, /result row numbers and direct fields, when present, open canonical source; derived cells stay read-only/);
  assert.match(clientSource, /this query shape stays read-only because no one-to-one lineage was proven/);
  assert.match(clientSource, /Query result/);
  assert.match(clientSource, /-- rune:data/);
  assert.match(clientSource, /Explicit Data binding/);
  assert.match(clientSource, /Legacy first-Data binding/);
  assert.match(clientSource, /compiled from SQL/);
  assert.match(clientSource, /total_q2_revenue/);
  assert.match(clientSource, /Dependency graph/);
  assert.match(clientSource, /Current bindings and temporary pins choose a bounded, revision-live context pack/);
  assert.match(clientSource, /No hidden graph state/);
  assert.match(clientSource, /pins last only for this session/);
  assert.match(clientSource, /Temporary Workspace Agent context pins cleared/);
  assert.match(clientSource, /workspaceDependencies/);
  assert.match(clientSource, /workspacePinnedArtifactIds/);
  assert.match(clientSource, /A configured model can inspect/);
  assert.match(clientSource, /Add model provider/);
  assert.match(clientSource, /Save & enable/);
  assert.match(clientSource, /Fetch models/);
  assert.match(clientSource, /encrypted into an HttpOnly credential/);
  assert.match(clientSource, /never written to localStorage, the workspace, an Artifact, or Git/);
  assert.match(clientSource, /bounded local Query/);
  assert.match(clientSource, /Create operating review/);
  assert.match(clientSource, /Prepare a verifiable operating-review chain/);
  assert.match(clientSource, /Saved tasks/);
  assert.match(clientSource, /Rerun/);
  assert.match(clientSource, /Update this operating-review task/);
  assert.match(clientSource, /Recorded after first Apply/);
  assert.match(clientSource, /No model call/);
  assert.match(clientSource, /One atomic transaction · no local file upload/);
  assert.match(clientSource, /Data → Query → Chart/);
  assert.match(clientSource, /Hello/);
  assert.match(clientSource, /你好/);
  for (const greeting of ["哈囉", "Bonjour", "Hola", "Здравствуйте", "مرحبًا", "こんにちは", "안녕하세요"]) {
    assert.match(clientSource, new RegExp(greeting));
  }
  assert.doesNotMatch(clientSource, /Halo/);
  assert.match(clientSource, /prefers-reduced-motion: reduce/);
  assert.match(clientSource, /evidence is not persisted/);
  assert.match(clientSource, /QUERY_EVIDENCE_REQUIRED/);
  assert.match(clientSource, /Runtime impact preflight passed/);
  assert.match(clientSource, /Runtime impact preflight failed/);
  assert.match(clientSource, /one automatic repair attempt stopped/);
  assert.match(clientSource, /Recovered after one compiler-guided repair/);
  assert.match(clientSource, /First proposal stayed unapplied/);
  assert.match(clientSource, /repaired once from local compiler feedback/);
  assert.match(clientSource, /impacted.*Queries.*executed locally/);
  assert.match(clientSource, /legacy metric/);
});

test("keeps an expanded transaction review scrollable inside the source pane", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /\.agent-dock\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s);
  assert.match(styles, /\.transaction-edge-list\s*\{[^}]*max-height:\s*170px;[^}]*overflow:\s*auto;/s);
});

test("ships persistent presentation-only workspace focus modes without unmounting either synchronized pane", async () => {
  const [styles, source, response] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
    render(),
  ]);
  const html = await response.text();
  assert.match(styles, /\.workspace\.view-source > \.preview-pane,[\s\S]*\.workspace\.view-preview > \.source-pane[\s\S]*display:\s*none;/);
  assert.match(styles, /\.workspace\.view-source\.with-file-rail > \.source-pane,[\s\S]*grid-column:\s*3 \/ -1;/);
  assert.match(styles, /\.workspace\.view-preview \.preview-header \.workspace-view-switch\s*\{\s*display:\s*inline-flex;/);
  assert.match(source, /localStorage\.setItem\(RUNE_WORKSPACE_VIEW_STORAGE_KEY, view\)/);
  assert.match(source, /workspaceViewFromKeyboardShortcut\(event\)/);
  assert.match(html, /aria-keyshortcuts="Meta\+Alt\+1 Control\+Alt\+1"/);
  assert.match(source, /if \(revealsSource\) setPreferredWorkspaceView\("split"\)/);
  assert.match(source, /activePreviewTargetId, activePreviewTargetKind, selectedArtifact\?\.id, workspaceView/);
});

test("keeps preview validation visible while progressively disclosing detailed evidence", async () => {
  const response = await render();
  const html = await response.text();
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(html, /<details class="preview-evidence">/);
  assert.match(html, /aria-label="Preview evidence"/);
  assert.match(html, /Source, bindings, and validation/);
  assert.match(styles, /\.preview-evidence-popover\s*\{[^}]*position:\s*absolute;[^}]*z-index:\s*80;/s);
  assert.match(styles, /\.workspace\.view-split \.workspace-view-switch button span\s*\{\s*display:\s*none;/);
  assert.match(styles, /html\[dir="rtl"\] \.preview-evidence-popover/);
});

test("keeps primary file and handoff actions visible while disclosing workspace tools in one menu", async () => {
  const response = await render();
  const html = await response.text();
  const styles = await readFile(new URL("../app/styles/overlays.css", import.meta.url), "utf8");
  assert.match(html, /aria-label="More tools"/);
  assert.match(html, /aria-haspopup="menu"/);
  assert.match(html, /aria-label="Create operating review"/);
  assert.match(html, />New</);
  assert.match(html, />Import</);
  assert.match(html, />Export</);
  const source = await readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8");
  assert.match(source, /className="tools-popover" role="menu"/);
  assert.match(source, /ui\.openFolder/);
  assert.match(source, /role="menuitem"[^>]*onClick=\{\(\) => \{ setToolsMenuOpen\(false\); openWelcomeGuide\(\); \}\}/);
  assert.match(source, /role="menuitemradio"/);
  assert.match(source, /className="tools-theme-name"/);
  assert.match(styles, /\.tools-theme-grid\s*\{[^}]*grid-template-columns:\s*repeat\(9, minmax\(0, 1fr\)\)/s);
  assert.match(styles, /html\[dir="rtl"\] \.tools-popover/);
});

test("records user-confirmed deliverable outcomes through the shared exact-revision ledger", async () => {
  const [workbench, dialog, outcomes, overlays] = await Promise.all([
    readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/delivery-outcome-dialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/task-evidence.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/overlays.css", import.meta.url), "utf8"),
  ]);
  assert.match(workbench, /openDeliveryConfirmationForArtifact\(exportedArtifact, "download", result\.targetType/);
  assert.match(workbench, /openDeliveryConfirmationForArtifact\(handoffArtifact, "folder", "folder"/);
  assert.match(workbench, /recordRuneTaskDelivery\(\{/);
  assert.match(workbench, /persistDeviceWorkspace\(artifactsRef\.current, selectedId, checkpointsRef\.current, savedOperatingReviewsRef\.current, nextEvidence\)/);
  assert.match(workbench, /summarizeRuneTaskDeliveries\(workflowDeliveries\)/);
  assert.doesNotMatch(workbench, /recordOperatingReviewDelivery\(/);
  assert.match(dialog, /Did this result become usable in real work\?/);
  assert.match(dialog, /type="radio"/);
  assert.match(dialog, /never document text or prompts/);
  assert.match(outcomes, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(outcomes, /runeTaskDeliveryId\(runId, artifactId\)/);
  assert.match(outcomes, /MAX_RUNE_TASK_DELIVERIES = 24/);
  assert.doesNotMatch(outcomes, /prompt|documentText|sourceText/);
  assert.match(overlays, /\.delivery-outcome-options label\.selected/);
  assert.match(overlays, /\.delivery-outcome-context\s*\{[^}]*grid-template-columns:\s*repeat\(3,/s);
});

test("uses one continuous desktop workspace surface while retaining separated responsive panes", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /\.workspace\s*\{\s*gap:\s*0;/);
  assert.match(styles, /\.activity-rail\s*\{\s*border-radius:\s*18px 0 0 18px;/);
  assert.match(styles, /\.preview-pane\s*\{\s*border-radius:\s*0 18px 18px 0;/);
  assert.match(styles, /\.workspace\.with-file-rail > \.file-rail,[\s\S]*border-left:\s*0;/);
  assert.match(styles, /html\[dir="rtl"\] \.activity-rail\s*\{\s*border-radius:\s*0 18px 18px 0;/);
  assert.match(styles, /@media \(max-width: 960px\)[\s\S]*\.activity-rail,[\s\S]*border-radius:\s*16px;/);
});

test("consolidates source language, checkpoints, and undo into one version surface", async () => {
  const response = await render();
  const html = await response.text();
  const source = await readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(html, /class="history-trigger source-version-trigger/);
  assert.match(html, /aria-label="Source and versions"/);
  assert.match(source, /className="checkpoint-panel-actions"/);
  assert.match(source, /onClick=\{undoLastAgentChange\}/);
  assert.match(source, /selectedArtifact\.language/);
  assert.match(styles, /\.source-version-trigger > i\s*\{/);
  assert.match(styles, /\.checkpoint-panel-actions\s*\{/);
});

test("keeps the status bar task-focused and moves product version into More Tools", async () => {
  const response = await render();
  const html = await response.text();
  const source = await readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8");
  assert.match(source, /className="tools-version"><span>\{ui\.version\}<\/span><strong>Rune 1\.05<\/strong>/);
  assert.match(html, /class="statusbar-right"><span>160 words · 34 lines<\/span><\/div>/);
  assert.doesNotMatch(html, /<span>UTF-8<\/span>/);
  assert.doesNotMatch(html, /class="statusbar-right"[^>]*>[\s\S]{0,300}legacy metrics/);
});

test("integrates assistance into the source surface and progressively discloses suggestions", async () => {
  const response = await render();
  const html = await response.text();
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(html, /class="agent-composer"[\s\S]*class="agent-context-row"/);
  assert.match(html, /<details class="agent-suggestions"><summary>/);
  assert.match(html, /role="group" aria-label="Agent change scope"/);
  assert.doesNotMatch(html, /class="agent-title-row"/);
  assert.doesNotMatch(html, /class="agent-avatar"/);
  assert.match(styles, /\.agent-dock\s*\{[^}]*margin:\s*0;[^}]*border:\s*0;[^}]*border-top:/s);
  assert.match(styles, /\.agent-composer:focus-within\s*\{/);
});

test("organizes workspace files by product workflow rather than internal artifact inventory", async () => {
  const response = await render();
  const html = await response.text();
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(html, /<nav class="artifact-groups" aria-label="Artifacts">/);
  assert.match(html, /class="artifact-group artifact-group-sources"[\s\S]*>Sources<\/h2>/);
  assert.match(html, /class="artifact-group artifact-group-analysis"[\s\S]*>Analysis<\/h2>/);
  assert.match(html, /class="artifact-group artifact-group-deliverables"[\s\S]*>Deliverables<\/h2>/);
  assert.match(html, /artifact-group-sources[\s\S]*regional-revenue\.csv[\s\S]*artifact-group-analysis[\s\S]*regional-analysis\.sql[\s\S]*regional-revenue\.chart\.json[\s\S]*artifact-group-deliverables[\s\S]*q2-review\.md[\s\S]*board-briefing\.deck\.md/);
  assert.doesNotMatch(html, /class="active-notch"/);
  assert.match(styles, /\.artifact-row\.active\s*\{[^}]*background:\s*rgba\(var\(--theme-rgb\),\s*\.085\);[^}]*box-shadow:\s*inset 2px 0 var\(--theme-accent\);/s);
  assert.match(styles, /\.artifact-context-pin\s*\{[^}]*opacity:\s*0;/s);
});

test("makes a changed linked presentation directly refreshable without adding a writer", async () => {
  const source = await readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /className="artifact-refresh-action"/);
  assert.match(source, /aria-label=\{`\$\{ui\.reviewRefresh\} · \$\{artifact\.name\}`\}/);
  assert.match(source, /disabled=\{artifactCreationDisabled\}/);
  assert.match(styles, /\.artifact-refresh-action\s*\{[^}]*inset-inline-end:\s*9px;/s);
  assert.match(styles, /\.artifact-row-shell\.has-refresh \.artifact-context-pin\s*\{[^}]*top:\s*4px;/s);
  assert.match(styles, /\.artifact-row\s*\{[^}]*padding-inline-end:\s*38px;/s);
});

test("keeps the top bar global and moves duplicate task creation into the activity rail", async () => {
  const response = await render();
  const html = await response.text();
  const source = await readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const topbarSource = source.slice(source.indexOf('<header className="topbar">'), source.indexOf("</header>", source.indexOf('<header className="topbar">')));
  assert.doesNotMatch(topbarSource, /openOperatingReview|review-task-button|ClipboardList/);
  assert.match(html, /class="brand-copy"><strong>Rune<\/strong><\/div><span class="project-separator"/);
  assert.match(html, /class="save-indicator saved" role="status" aria-label="Saved on device · Last saved/);
  assert.match(html, /class="visually-hidden">Saved on device<\/span>/);
  assert.match(source, /className="activity-button"[\s\S]{0,420}onClick=\{openOperatingReview\}/);
  assert.match(html, />New<\/button>[\s\S]*>Import<\/button>[\s\S]*class="export-menu"[\s\S]*class="tools-menu"/);
  assert.doesNotMatch(styles, /\.review-task-button\s*\{/);
});

test("presents onboarding as a full-screen setup assistant with an accessible step contract", async () => {
  const component = await readFile(new URL("../app/components/welcome-experience.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(component, /className="welcome-progress"\s+role="progressbar"/);
  assert.match(component, /aria-valuemin=\{1\}/);
  assert.match(component, /aria-valuemax=\{steps\.length\}/);
  assert.match(component, /aria-valuenow=\{steps\.indexOf\(step\) \+ 1\}/);
  assert.match(styles, /\.welcome-backdrop\s*\{[^}]*display:\s*block;[^}]*padding:\s*0;[^}]*overflow:\s*hidden;/s);
  assert.match(styles, /\.welcome-window\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*min-height:\s*100vh;[^}]*border-radius:\s*0;[^}]*box-shadow:\s*none;/s);
  assert.match(styles, /\.welcome-chrome\s*\{[^}]*position:\s*sticky;[^}]*height:\s*72px;/s);
  assert.match(styles, /\.welcome-page\s*\{[^}]*min-height:\s*calc\(100vh - 72px\);/s);
});

test("moves live lineage into preview evidence so compiled content starts immediately", async () => {
  const response = await render();
  const html = await response.text();
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(html, /class="preview-evidence-popover"[\s\S]*class="preview-evidence-lineage"[\s\S]*class="lineage-strip query-lineage"/);
  assert.match(html, /class="preview-evidence-lineage"[\s\S]*regional-summary\.sql[\s\S]*q2-review\.md[\s\S]*regional-revenue\.csv/);
  assert.match(html, /<div class="preview-body"><div class="preview-scroll">/);
  assert.doesNotMatch(html, /<div class="preview-body"><div class="lineage-strip/);
  assert.match(styles, /\.preview-evidence-lineage\s*\{/);
  assert.match(styles, /\.preview-evidence-lineage \.lineage-strip\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;/s);
});

test("ships reviewed device-local images as content-hash Markdown references without base64 source", async () => {
  const response = await render();
  const html = await response.text();
  const workbench = await readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8");
  const preview = await readFile(new URL("../app/components/artifact-previews.tsx", import.meta.url), "utf8");
  const assets = await readFile(new URL("../app/lib/local-assets.ts", import.meta.url), "utf8");
  assert.match(html, /aria-label="Insert local image"/);
  assert.match(workbench, /<LocalImageReviewDialog/);
  assert.match(workbench, /accept=\{RUNE_IMAGE_ACCEPT\}/);
  assert.match(workbench, /putRuneImageAsset\(pending\.asset\)/);
  assert.match(workbench, /deleteRuneImageAsset\(pending\.asset\.id\)/);
  assert.match(workbench, /selectedArtifact\.kind === "slides" && isDeckMarkdownArtifact\(selectedArtifact\)/);
  assert.match(preview, /compileDeckSource\(source, \{ resolveLocalAssetUrl \}\)/);
  assert.match(preview, /data-rune-asset-state/);
  assert.match(preview, /defaultUrlTransform/);
  assert.match(preview, /node\.tagName === "img" && key === "src"/);
  assert.match(assets, /rune-asset:sha256:/);
  assert.match(assets, /indexedDB\.open/);
  assert.doesNotMatch(workbench, /readAsDataURL|data:image\/[^;]+;base64/);
  assert.doesNotMatch(assets, /readAsDataURL|data:image\/[^;]+;base64/);
});

test("ships one Apple-informed optical and motion system across onboarding and the editing workspace", async () => {
  const [legacyStyles, styleFiles, source, welcome] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    Promise.all(["tokens", "shell", "content", "overlays", "onboarding", "motion", "responsive"].map((name) => (
      readFile(new URL(`../app/styles/${name}.css`, import.meta.url), "utf8")
    ))),
    readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/welcome-experience.tsx", import.meta.url), "utf8"),
  ]);
  const styles = [legacyStyles, ...styleFiles].join("\n");
  assert.match(styles, /--rune-content-wide:\s*1260px;/);
  assert.match(styles, /--rune-frame-width:\s*87\.5%;/);
  assert.match(styles, /--rune-radius-window:\s*32px;/);
  assert.match(styles, /--rune-radius-workspace:\s*24px;/);
  assert.match(styles, /--rune-type-display:\s*clamp\(46px,\s*5\.1vw,\s*70px\);/);
  assert.match(styles, /--rune-duration-scene:\s*760ms;/);
  assert.match(styles, /--rune-file-width:\s*220px;/);
  assert.match(styles, /\.welcome-intro-grid\s*\{[^}]*width:\s*min\(var\(--rune-frame-width\),\s*var\(--rune-content-wide\)\);/s);
  assert.match(styles, /\.workspace\.with-file-rail\s*\{[^}]*var\(--workspace-source-track,\s*44fr\)[^}]*var\(--workspace-preview-track,\s*56fr\)/s);
  assert.match(styles, /\.document-stage,\s*\.data-stage,\s*\.chart-stage,\s*\.slides-stage\s*\{[^}]*background:\s*var\(--rune-stage\);[^}]*background-image:\s*none;/s);
  assert.match(styles, /@supports \(corner-shape:\s*squircle\)/);
  assert.match(styles, /@keyframes rune-greeting-write/);
  assert.match(styles, /@keyframes rune-ambient-drift/);
  assert.match(styles, /html\[data-locale="ar"\][^]*\.welcome-page h1/);
  assert.match(styles, /html\[data-locale="ja"\]/);
  assert.match(styles, /html\[data-locale="ko"\]/);
  assert.match(source, /moveMaterialLight/);
  assert.match(source, /className="tools-material-preview"/);
  assert.match(welcome, /className="welcome-greeting-character"/);
  assert.match(welcome, /localeDirection\(greetingLocale\) === "rtl"/);
});
