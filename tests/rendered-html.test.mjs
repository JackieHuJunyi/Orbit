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
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>Rune — Work that traces back to source<\/title>/i);
  assert.match(html, /Content workspace/);
  assert.match(html, /q2-review\.md/);
  assert.match(html, /Create review/);
  assert.match(html, /Open folder/);
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
  assert.match(html, /Rune v0\.51/);
  assert.match(html, /aria-label="Data graph"/);
  assert.match(html, /aria-label="Pin q2-review\.md in Workspace Agent context"/);
  assert.match(html, />Selection</);
  assert.match(html, /Export q2-review\.md as DOCX/);
  assert.match(html, /Export q2-review\.md as ODT/);
  assert.match(html, /Export q2-review\.md as PDF/);
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
  assert.match(clientSource, /\.docx,\.xlsx,\.pptx,\.odt,\.ods,\.odp,\.pdf/);
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
  assert.match(clientSource, /One atomic transaction · no local file upload/);
  assert.match(clientSource, /Data → Query → Chart/);
  assert.match(clientSource, /Hello/);
  assert.match(clientSource, /Bonjour/);
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
