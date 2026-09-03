import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

import { ORBIT_PRODUCT_VERSION } from "../app/lib/product-meta.ts";

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

async function readBuiltClientJavaScript() {
  const clientRoot = new URL("../dist/client/", import.meta.url);
  const files = (await readdir(clientRoot, { recursive: true })).filter((name) => /\.(?:js|mjs)$/u.test(name));
  return (await Promise.all(files.map((name) => readFile(new URL(name, clientRoot), "utf8")))).join("\n");
}

test("server-renders the Orbit artifact workbench", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="en" dir="ltr" data-theme="mist-blue" data-rune-onboarding="pending">/);
  assert.match(html, /id="rune-prehydrate-state"/);
  assert.match(html, /data-onboarding-sequence="spectrum-write-settle-setup"/);
  assert.doesNotMatch(html, /data-ambient-motion/);
  assert.match(html, /data-motion-renderer="vector-centerline"/);
  assert.doesNotMatch(html, /Preparing Orbit/);
  assert.match(html, /<title>Orbit — Work that traces back to source<\/title>/i);
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
  assert.match(html, /data-rune-hydrated="false"/);
  assert.doesNotMatch(html, /style=""/);
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
  assert.match(html, /board-briefing\.html/);
  assert.match(html, /Semantic HTML/);
  assert.match(html, /aria-label="Data graph"/);
  assert.match(html, /aria-label="Pin q2-review\.md in Workspace Agent context"/);
  assert.match(html, />Selection</);
  assert.match(html, /aria-haspopup="menu"/);
  assert.match(html, />Export</);
  assert.match(html, /Live output/);
  assert.match(html, /every write still requires review/i);
});

test("keeps compatibility parsers, low-frequency surfaces, and heavy runtimes out of the initial client bundle", async () => {
  const manifestUrl = new URL("../dist/client/.vite/manifest.json", import.meta.url);
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  const workbenchEntry = manifest["app/components/rune-workbench.tsx"];
  assert.ok(workbenchEntry);
  const initialStaticGraph = new Set();
  const staticQueue = ["app/components/rune-workbench.tsx"];
  while (staticQueue.length) {
    const entryKey = staticQueue.shift();
    if (!entryKey || initialStaticGraph.has(entryKey)) continue;
    initialStaticGraph.add(entryKey);
    for (const importedKey of manifest[entryKey]?.imports ?? []) staticQueue.push(importedKey);
  }
  const initialGraphDynamicImports = new Set(
    [...initialStaticGraph].flatMap((entryKey) => manifest[entryKey]?.dynamicImports ?? []),
  );
  for (const locale of ["fr", "es", "ru", "ar", "ja", "ko"]) {
    const localeEntry = `app/lib/interface-locales.runtime/${locale}.generated.ts`;
    assert.equal(manifest[localeEntry]?.isDynamicEntry, true);
    assert.ok(initialGraphDynamicImports.has(localeEntry));
  }
  assert.equal(manifest["app/lib/traditional-chinese.generated.ts"]?.isDynamicEntry, true);
  assert.ok(initialGraphDynamicImports.has("app/lib/traditional-chinese.generated.ts"));
  const workbenchBytes = (await stat(new URL(`../dist/client/${workbenchEntry.file}`, import.meta.url))).size;
  assert.ok(workbenchBytes <= 530_000, `Initial Workbench chunk is ${workbenchBytes} bytes; budget is 530000.`);
  for (const surface of [
    "checkpoint-restore-dialog",
    "workspace-reset-dialog",
    "directory-sync-review-dialog",
    "workbench-settings-menu",
    "document-structure-review-dialog",
    "delivery-outcome-dialog",
    "document-briefing-dialog",
    "local-image-review-dialog",
    "export-review-dialog",
    "import-review-dialog",
    "new-artifact-dialog",
    "operating-review-dialog",
    "pilot-evidence-review-dialog",
    "workbench-command-menu",
    "pdf-ocr-setup-dialog",
    "transaction-review-map",
  ]) {
    const surfaceEntry = `app/components/${surface}.tsx`;
    assert.equal(manifest[surfaceEntry]?.isDynamicEntry, true, `${surface} must remain an on-demand entry.`);
    assert.ok(workbenchEntry.dynamicImports?.includes(surfaceEntry), `${surface} must load from Workbench on demand.`);
  }
  assert.equal(manifest["app/components/welcome-model-step.tsx"]?.isDynamicEntry, true);
  assert.ok(initialGraphDynamicImports.has("app/components/welcome-model-step.tsx"));
  assert.equal(initialStaticGraph.has("app/components/model-profile-manager.tsx"), false);
  assert.equal(manifest["app/lib/office-import.ts"]?.isDynamicEntry, true);
  assert.ok(workbenchEntry.dynamicImports?.includes("app/lib/office-import.ts"));
  assert.equal(manifest["app/lib/pdf-import-client.ts"]?.isDynamicEntry, true);
  assert.ok(workbenchEntry.dynamicImports?.includes("app/lib/pdf-import-client.ts"));
  assert.equal(manifest["app/lib/odf-import.ts"]?.isDynamicEntry, true);
  assert.ok(workbenchEntry.dynamicImports?.includes("app/lib/odf-import.ts"));
  const exportRuntimeEntry = manifest["app/lib/workspace-file-export-runtime.ts"];
  assert.equal(exportRuntimeEntry?.isDynamicEntry, true);
  assert.ok(workbenchEntry.dynamicImports?.includes("app/lib/workspace-file-export-runtime.ts"));
  for (const exportModule of ["office-export", "odf-export", "html-export", "pdf-export"]) {
    const exportModuleEntry = `app/lib/${exportModule}.ts`;
    assert.equal(manifest[exportModuleEntry]?.isDynamicEntry, true);
    assert.ok(exportRuntimeEntry.dynamicImports?.includes(exportModuleEntry));
  }
  const pdfExportEntry = manifest["app/lib/pdf-export.ts"];
  const pdfExportBytes = (await stat(new URL(`../dist/client/${pdfExportEntry.file}`, import.meta.url))).size;
  assert.ok(pdfExportBytes <= 1_300_000, `Deferred PDF export chunk is ${pdfExportBytes} bytes; budget is 1300000.`);
  assert.equal(manifest["app/lib/agent-evidence.ts"]?.isDynamicEntry, true);
  assert.ok(workbenchEntry.dynamicImports?.includes("app/lib/agent-evidence.ts"));
  assert.equal(manifest["app/lib/query-preflight.ts"]?.isDynamicEntry, true);
  assert.ok(workbenchEntry.dynamicImports?.includes("app/lib/query-preflight.ts"));
  assert.equal(manifest["app/lib/checkpoint-restore.ts"]?.isDynamicEntry, true);
  assert.ok(workbenchEntry.dynamicImports?.includes("app/lib/checkpoint-restore.ts"));
  assert.equal(manifest["app/lib/workspace-reset.ts"]?.isDynamicEntry, true);
  assert.ok(workbenchEntry.dynamicImports?.includes("app/lib/workspace-reset.ts"));
  assert.equal(manifest["app/lib/directory-sync.ts"]?.isDynamicEntry, true);
  assert.ok(workbenchEntry.dynamicImports?.includes("app/lib/directory-sync.ts"));
});

test("ships one complete-source live mirror boundary for every revision-bound visual draft", async () => {
  const bundle = await readBuiltClientJavaScript();
  assert.match(bundle, /complete source draft synced live/);
  assert.match(bundle, /Unsaved synchronized source draft/);
  assert.match(bundle, /visual-source-sync-state/);
  assert.match(bundle, /source-draft-mirror/);
  const [previewSource, semanticHtmlEditor, draftMirror] = await Promise.all([
    readFile(new URL("../app/components/artifact-previews.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/semantic-html-slide-editor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/use-visual-source-draft.ts", import.meta.url), "utf8"),
  ]);
  assert.match(previewSource, /projectVisualDocumentSectionDraft/);
  assert.match(previewSource, /projectVisualDocumentBlockDraft/);
  assert.match(previewSource, /projectVisualDataCellDraft/);
  assert.match(previewSource, /projectVisualDeckSlideDraft/);
  assert.match(previewSource, /onEditSemanticHtmlSlide/);
  assert.match(previewSource, /projectVisualChartSpecDraft/);
  assert.equal(previewSource.split("useVisualSourceDraftMirror(").length - 1, 4);
  assert.match(semanticHtmlEditor, /useVisualSourceDraftMirror\(visualSourceDraft, onVisualSourceDraftChange\)/);
  assert.match(draftMirror, /draft !== undefined/);
  assert.match(draftMirror, /onDraftChange\?\.\(null\)/);
  assert.doesNotMatch(draftMirror, /setArtifacts|persistDeviceWorkspace|fetch\(|localStorage|indexedDB/);
});

test("ships bounded semantic HTML slides as continuous exact-source preview pages", async () => {
  const [previewSource, targetSource, compilerSource] = await Promise.all([
    readFile(new URL("../app/components/artifact-previews.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/preview-targets.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/legacy-html-slides.ts", import.meta.url), "utf8"),
  ]);

  assert.match(previewSource, /deckCompilation\?\.previewSlides \?\? legacyCompilation\?\.slides/);
  assert.match(previewSource, /className="deck-slide-flow"/);
  assert.match(previewSource, /data-preview-source-primary="true"/);
  assert.match(targetSource, /legacyHtmlSlideTargets/);
  assert.match(targetSource, /start: slide\.start/);
  assert.match(targetSource, /end: slide\.end/);
  assert.match(compilerSource, /MAX_LEGACY_HTML_CHARS = 120_000/);
  assert.match(compilerSource, /MAX_LEGACY_HTML_SLIDES = 40/);
  assert.match(compilerSource, /Content-Security-Policy/);
  assert.doesNotMatch(compilerSource, /DOMParser|innerHTML|textContent/);
});

test("keeps semantic HTML presentation handoff explicit and outside the startup graph", async () => {
  const [workbench, exportMenu, exportCapabilities, officeExport, odfExport, pdfExport, conversion] = await Promise.all(
    [
      readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/components/workbench-export-menu.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/lib/workspace-file-export.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/lib/office-export.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/lib/odf-export.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/lib/pdf-export.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/lib/semantic-html-presentation-export.ts", import.meta.url), "utf8"),
    ],
  );

  assert.match(exportCapabilities, /slides: "pptx" as const/u);
  assert.match(exportCapabilities, /slides: "odp" as const/u);
  assert.match(exportCapabilities, /slides: "html" as const/u);
  assert.match(exportCapabilities, /detail: "standalone-html"/u);
  assert.match(workbench, /capabilities=\{selectedExportCapabilities\}/u);
  assert.match(exportMenu, /visibleCapabilities\.map/u);
  assert.doesNotMatch(workbench, /selectedExportCapability\("html"\)/u);
  assert.match(officeExport, /convertSemanticHtmlPresentationToDeck/);
  assert.match(odfExport, /convertSemanticHtmlPresentationToDeck/);
  assert.match(pdfExport, /convertSemanticHtmlPresentationToDeck/);
  assert.match(conversion, /CSS, exact positioning, animation, forms, links, and unsupported elements/);
  assert.doesNotMatch(conversion, /fetch\(|localStorage|indexedDB|persist|download/iu);
});

test("offers semantic HTML direct source-bound editing plus an optional reviewed Deck copy", async () => {
  const [workbench, preview, editor, directEdit, conversion, imports, reviewDialog] = await Promise.all([
    readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/artifact-previews.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/semantic-html-slide-editor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/visual-semantic-html-slide-edit.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/semantic-html-editable-copy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/imports.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/import-review-dialog.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(preview, /canVisualEditSemanticHtmlSlide/);
  assert.match(preview, /<SemanticHtmlSlideEditor/);
  assert.match(preview, /onEditSemanticHtmlSlide/);
  assert.match(editor, /projectVisualSemanticHtmlSlideDraft/);
  assert.match(editor, /visualSemanticHtmlSlidePreview/);
  assert.match(editor, /onVisualSourceDraftChange/);
  assert.match(workbench, /prepareVisualSemanticHtmlSlideEdit/);
  assert.match(workbench, /commitVisualSemanticHtmlSlideEdit/);
  assert.match(directEdit, /sourceOutsideSelectionIsUnchanged/);
  assert.match(directEdit, /Keep live metric and Chart bindings unchanged/);
  assert.match(directEdit, /compileLegacyHtmlSlides\(candidate\.nextSource\)/);
  assert.doesNotMatch(directEdit, /DOMParser|innerHTML|fetch\(|localStorage|indexedDB|persist|download|provider/iu);
  assert.match(preview, /className="slides-create-editable-copy"/);
  assert.match(preview, /onCreateEditableDeckCopy\(artifact\)/);
  assert.match(workbench, /await import\("\.\.\/lib\/semantic-html-editable-copy"\)/);
  assert.doesNotMatch(workbench, /^import .*semantic-html-editable-copy/m);
  assert.match(conversion, /convertSemanticHtmlPresentationToDeck/);
  assert.match(conversion, /prepareWorkspaceImportReview/);
  assert.match(conversion, /original semantic HTML remains unchanged/);
  assert.doesNotMatch(conversion, /fetch\(|localStorage|indexedDB|persist|download|putRuneImageAsset/iu);
  assert.match(imports, /purpose:\s*"import" \| "editable-copy"/);
  assert.match(reviewDialog, /purpose === "editable-copy"/);
});

test("renders a complete read-only Agent proposal through the live source and output panes before Apply", async () => {
  const [workbench, projection, localization, contentStyles] = await Promise.all([
    readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/proposal-preview.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/localization.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/content.css", import.meta.url), "utf8"),
  ]);
  assert.match(workbench, /prepareWorkspaceProposalSurface\(\{/);
  assert.match(workbench, /requestedArtifactId: pendingReviewId \|\| undefined/);
  assert.match(workbench, /presentedArtifact,[\s\S]*presentedArtifacts,[\s\S]*= useMemo/);
  assert.match(workbench, /readOnly=\{Boolean\(activeVisualSourceDraft\) \|\| proposalReviewActive\}/);
  assert.match(workbench, /artifact=\{presentedArtifact\}/);
  assert.match(workbench, /artifacts=\{presentedArtifacts\}/);
  assert.match(workbench, /activeSelection=\{proposalReviewActive \? null : activePreviewTarget\}/);
  assert.match(workbench, /onTargetSource=\{proposalReviewActive \? undefined : focusPreviewTarget\}/);
  assert.match(localization, /Proposed output · nothing written/);
  assert.match(projection, /workspaceMatchesSourceRevision\(input\.artifacts, input\.baseRevision\)/);
  assert.match(projection, /prepareWorkspaceMutation\(input\.artifacts, input\.patches, input\.creations\)/);
  assert.match(projection, /requestedArtifactId/);
  assert.match(projection, /presentedArtifact: proposalArtifact \?\? input\.selectedArtifact \?\? null/);
  assert.match(projection, /presentedArtifacts: proposalPreviewActive/);
  assert.doesNotMatch(projection, /persist|localStorage|indexedDB|fetch\(/i);
  assert.match(contentStyles, /\.source-editor\.proposal-source-preview/);
  assert.match(contentStyles, /\.preview-pane\[data-proposal-preview="true"\]/);
  assert.match(contentStyles, /\.proposal-preview-badge/);
});

test("ships exactly one compiler-guided repair request site before the repeated runtime gate", async () => {
  const [source, client] = await Promise.all([
    readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/agent-client.ts", import.meta.url), "utf8"),
  ]);
  assert.equal(source.split("runtimeRepair: repairFeedback").length - 1, 1);
  assert.match(source, /repairPayload\.repairAttempt === 1/);
  assert.match(source, /preflightRuntimeImpact\(\s*replacementPlan\.patches,\s*replacementPlan\.creations/);
  assert.match(source, /Automatic repair stopped after one attempt/);
  assert.match(source, /Nothing proposed — one automatic repair attempt stopped; every source stayed unchanged/);
  assert.match(client, /\["document", "data", "query", "chart", "slides"\]\.includes\(creation\.artifact\.kind\)/);
  assert.match(client, /creation\.operationCount >= 0[\s\S]*creation\.operationCount <= 8/);
});

test("ships a review-before-write import surface in the client", async () => {
  const clientSource = await readBuiltClientJavaScript();
  assert.match(clientSource, /Review imported sources/);
  assert.match(clientSource, /PDF import recovers selectable text and approximate reading order/);
  assert.match(clientSource, /scanned PDFs require explicit page and English\/Simplified-Chinese OCR choices/);
  assert.match(clientSource, /Choose pages for OCR/);
  assert.match(clientSource, /Page images stay on device/);
  assert.match(clientSource, /On-device recognition/);
  for (const extension of [".doc", ".ppt", ".docx", ".xlsx", ".pptx", ".odt", ".ods", ".odp", ".pdf"]) {
    assert.ok(clientSource.includes(extension), `${extension} must remain in the shipped import picker contract.`);
  }
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
  assert.match(clientSource, /The source artifact is no longer in this workspace/);
  assert.match(clientSource, /Open exact/);
  assert.match(
    clientSource,
    /result row numbers and direct fields, when present, open canonical source; derived cells stay read-only/,
  );
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
  assert.match(clientSource, /One atomic transaction · compiled locally/);
  assert.match(clientSource, /Data → Query → Chart/);
  assert.match(clientSource, /Hello/);
  assert.match(clientSource, /你好/);
  for (const greeting of ["哈囉", "Bonjour", "Hola", "Привет", "مرحبًا", "こんにちは", "안녕하세요"]) {
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
  const [styles, source, previewScroll, response] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/use-source-preview-scroll.ts", import.meta.url), "utf8"),
    render(),
  ]);
  const html = await response.text();
  assert.match(
    styles,
    /\.workspace\.view-source > \.preview-pane,[\s\S]*\.workspace\.view-preview > \.source-pane[\s\S]*display:\s*none;/,
  );
  assert.match(styles, /\.workspace\.view-source\.with-file-rail > \.source-pane,[\s\S]*grid-column:\s*3 \/ -1;/);
  assert.match(
    styles,
    /\.workspace\.view-preview \.preview-header \.workspace-view-switch\s*\{\s*display:\s*inline-flex;/,
  );
  assert.match(source, /localStorage\.setItem\(RUNE_WORKSPACE_VIEW_STORAGE_KEY, view\)/);
  assert.match(source, /workspaceViewFromKeyboardShortcut\(event\)/);
  assert.match(html, /aria-keyshortcuts="Meta\+Alt\+1 Control\+Alt\+1"/);
  assert.match(
    source,
    /if \(plan\.revealsSource\)[\s\S]*setPreferredWorkspaceView\(window\.matchMedia\("\(max-width: 960px\)"\)\.matches \? "source" : "split"\)/,
  );
  assert.match(source, /useSourcePreviewScroll\(\{[\s\S]*target: activePreviewTarget/);
  assert.match(previewScroll, /cursorEnd,[\s\S]*cursorStart,[\s\S]*block: repeatedTarget \? "nearest" : "center"/);
  assert.doesNotMatch(previewScroll, /setArtifacts|persistDeviceWorkspace|fetch\(|localStorage|indexedDB/);
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

test("turns compiler failures into bounded actionable Preview diagnostics", async () => {
  const [workbench, diagnostics, styles] = await Promise.all([
    readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/artifact-diagnostics.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/content.css", import.meta.url), "utf8"),
  ]);
  assert.match(workbench, /prepareArtifactDiagnostics\(selectedArtifact/);
  assert.match(workbench, /className="preview-diagnostics"/);
  assert.match(workbench, /onClick=\{openValidationIssueSource\}/);
  assert.match(
    workbench,
    /if \(plan\.revealsSource\)[\s\S]*setPreferredWorkspaceView\(window\.matchMedia\("\(max-width: 960px\)"\)\.matches \? "source" : "split"\)/,
  );
  assert.match(workbench, /sourceSelectionScrollTop\(\{/);
  assert.match(workbench, /ui\.diagnostics\.technicalDetail/);
  assert.match(diagnostics, /MAX_ARTIFACT_DIAGNOSTICS = 12/);
  assert.match(diagnostics, /MAX_ARTIFACT_DIAGNOSTIC_DETAIL_CHARS = 2_000/);
  assert.doesNotMatch(diagnostics, /from ["']react|window\.|document\.|localStorage|indexedDB|fetch\(/i);
  assert.match(styles, /\.preview-evidence-popover\.has-issues\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto;/s);
  assert.match(styles, /\.preview-diagnostics-heading\s*\{[^}]*grid-template-columns:\s*28px minmax\(0, 1fr\) auto;/s);
  assert.match(styles, /@media \(max-width:\s*560px\)[\s\S]*\.preview-diagnostics-heading/);
  assert.doesNotMatch(styles, /\.preview-diagnostics[\s\S]{0,220}z-index:\s*\d+/);
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
  const [source, settingsMenu, menuFocus] = await Promise.all([
    readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/workbench-settings-menu.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/use-workbench-menu-focus.ts", import.meta.url), "utf8"),
  ]);
  assert.match(source, /<WorkbenchSettingsMenu/);
  assert.doesNotMatch(source, /tools-theme-grid|RUNE_APPEARANCE_THEMES\.map/);
  assert.match(settingsMenu, /className="tools-popover settings-popover"/);
  assert.match(settingsMenu, /role="menu"/);
  assert.match(settingsMenu, /label: directoryName \?\? copy\.openFolder/);
  assert.match(settingsMenu, /actions\.length \+ RUNE_APPEARANCE_THEMES\.length/);
  assert.match(settingsMenu, /role="menuitemradio"/);
  assert.match(settingsMenu, /className="tools-theme-name"/);
  assert.match(settingsMenu, /useWorkbenchMenuFocus\(\{/);
  assert.match(menuFocus, /itemRefs\.current\.length = itemCount/);
  assert.match(menuFocus, /!item\.disabled/);
  assert.match(menuFocus, /event\.key === "ArrowDown"/);
  assert.match(menuFocus, /event\.key === "ArrowUp"/);
  assert.match(menuFocus, /event\.key === "Home"/);
  assert.match(menuFocus, /event\.key === "End"/);
  assert.match(menuFocus, /event\.key === "Tab"/);
  assert.match(menuFocus, /event\.key === "Escape"/);
  assert.match(menuFocus, /window\.requestAnimationFrame/);
  assert.match(menuFocus, /const trigger = restoreFocusRef\.current/);
  assert.match(menuFocus, /trigger\?\.getAttribute\("aria-expanded"\) === "false"/);
  assert.match(menuFocus, /trigger\.focus\(\{ preventScroll: true \}\)/);
  assert.match(styles, /\.tools-theme-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(34px, 1fr\)\)/s);
  assert.match(styles, /html\[dir="rtl"\] \.tools-popover/);
  assert.match(styles, /\.settings-popover\s*\{[^}]*bottom:\s*14px;/s);
  const responsiveStyles = await readFile(new URL("../app/styles/responsive.css", import.meta.url), "utf8");
  assert.match(
    responsiveStyles,
    /@media \(max-width:\s*680px\)[\s\S]*\.settings-popover\s*\{[^}]*right:\s*10px;[^}]*bottom:\s*auto;[^}]*left:\s*10px;/,
  );
  assert.match(responsiveStyles, /html\[dir="rtl"\] \.settings-popover\s*\{[^}]*right:\s*10px;[^}]*left:\s*10px;/);
});

test("reviews sample reset as a recoverable atomic workspace switch", async () => {
  const [workbench, activityRail, settingsMenu, dialog, planner, overlays] = await Promise.all([
    readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/workbench-activity-rail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/workbench-settings-menu.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/workspace-reset-dialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/workspace-reset.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/overlays.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(activityRail, /RotateCcw|onReset|resetSampleLabel/);
  assert.match(settingsMenu, /id: "restore-sample-workspace"/);
  assert.match(settingsMenu, /id: "restore-previous-workspace"/);
  assert.match(workbench, /prepareWorkspaceReset\(currentWorkspaceDeviceState\(\), target, mode\)/);
  assert.match(workbench, /commitWorkspaceReset\(\{/);
  assert.match(workbench, /persistDeviceWorkspace\([\s\S]*nextRecovery/s);
  assert.match(workbench, /resetRecovery: preservedResetRecovery/);
  assert.doesNotMatch(workbench, /confirm\("Reset this device draft|localStorage\.removeItem\(STORAGE_KEY\)/);
  assert.match(dialog, /ReviewDialog/);
  assert.match(dialog, /data-dialog-initial-focus/);
  assert.match(dialog, /plan\.target\.artifactNames\.map/);
  assert.doesNotMatch(dialog, /localStorage|setArtifacts|persistDeviceWorkspace/);
  assert.match(planner, /serializeWorkspaceDeviceState\(current\) !== expectedPlan\.baseSnapshot/);
  assert.match(planner, /serializeWorkspaceDeviceState\(target\) !== expectedPlan\.targetSnapshot/);
  assert.match(planner, /persist\(prepared\.plan\.nextState, prepared\.plan\.nextRecovery\)/);
  assert.doesNotMatch(planner, /from "react"|localStorage|setArtifacts/);
  assert.match(overlays, /\.workspace-reset-route\s*\{[^}]*grid-template-columns:/s);
  assert.match(overlays, /@media \(max-width:\s*620px\)[\s\S]*\.workspace-reset-route/);
});

test("reviews folder Pull, Push, and initialization against exact device and folder revisions", async () => {
  const [workbench, dialog, planner, resetPlanner, overlays] = await Promise.all([
    readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/directory-sync-review-dialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/directory-sync.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/workspace-reset.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/overlays.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(workbench, /window\.confirm|\bconfirm\(/);
  assert.match(workbench, /prepareDirectorySync\(\{/);
  assert.match(workbench, /commitDirectorySync\(\{/);
  assert.match(workbench, /readCurrentDeviceStateSnapshot:/);
  assert.match(workbench, /readCurrentAssets: \(\) => collectWorkspaceLocalAssets/);
  assert.match(workbench, /readDirectory: \(\) => readWorkspaceDirectory\(pending\.handle\)/);
  assert.match(workbench, /persistDeviceWorkspace\([\s\S]*recovery,/s);
  assert.match(workbench, /setWorkspaceResetRecovery\(recovery\)/);
  assert.match(dialog, /ReviewDialog/);
  assert.match(dialog, /data-dialog-initial-focus/);
  assert.match(dialog, /plan\.changes/);
  assert.match(dialog, /change\.entryType === "asset"/);
  assert.doesNotMatch(dialog, /readWorkspaceDirectory|writeWorkspaceDirectory|localStorage|indexedDB/);
  assert.match(planner, /readCurrentDeviceStateSnapshot\(\) !== expectedPlan\.baseDeviceStateSnapshot/);
  assert.match(planner, /serializeDirectoryReadResult\(directory\) !== expectedPlan\.baseDirectorySnapshot/);
  assert.match(planner, /await apply\(prepared\.plan, directory, currentAssets\)/);
  assert.doesNotMatch(planner, /from "react"|localStorage|indexedDB|showDirectoryPicker/);
  assert.match(resetPlanner, /export function workspaceDeviceStateSnapshotError/);
  assert.match(overlays, /\.directory-sync-route\s*\{[^}]*grid-template-columns:/s);
  assert.match(overlays, /html\[dir="rtl"\] \.directory-sync-route/);
  assert.match(overlays, /@media \(max-width:\s*620px\)[\s\S]*\.directory-sync-route/);
});

test("records user-confirmed deliverable outcomes through the shared exact-revision ledger", async () => {
  const [workbench, dialog, outcomes, overlays] = await Promise.all([
    readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/delivery-outcome-dialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/task-evidence.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/overlays.css", import.meta.url), "utf8"),
  ]);
  assert.match(
    workbench,
    /openDeliveryConfirmationForArtifact\(\s*exportedArtifact,\s*"download",\s*sourceDeliveryTarget,/,
  );
  assert.match(workbench, /destination !== "source"\s*\? result\.targetType/);
  assert.match(workbench, /openDeliveryConfirmationForArtifact\(\s*handoffArtifact,\s*"folder",\s*"folder"/);
  assert.match(workbench, /recordRuneTaskDelivery\(\{/);
  assert.match(
    workbench,
    /persistDeviceWorkspace\(\s*artifactsRef\.current,\s*selectedId,\s*checkpointsRef\.current,\s*savedOperatingReviewsRef\.current,\s*nextEvidence,/,
  );
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
  const restoreDialog = await readFile(
    new URL("../app/components/checkpoint-restore-dialog.tsx", import.meta.url),
    "utf8",
  );
  const restorePlanner = await readFile(new URL("../app/lib/checkpoint-restore.ts", import.meta.url), "utf8");
  assert.match(source, /className="checkpoint-panel-actions"/);
  assert.match(source, /onClick=\{undoLastAgentChange\}/);
  assert.match(source, /prepareCheckpointRestore\(artifactsRef\.current, checkpoint\)/);
  assert.match(source, /commitCheckpointRestore\(\{/);
  assert.match(source, /preflight: \(currentArtifacts, patches\) => preflightRuntimeMutation/);
  assert.match(source, /persist: \(nextArtifacts, nextSelectedId, nextCheckpoints\) =>[\s\S]*persistDeviceWorkspace/s);
  assert.match(source, /<CheckpointRestoreDialog/);
  assert.doesNotMatch(source, /function restoreCheckpoint\(/);
  assert.match(source, /selectedArtifact\.language/);
  assert.match(restoreDialog, /ReviewDialog/);
  assert.match(restoreDialog, /data-dialog-initial-focus/);
  assert.match(restoreDialog, /plan\.diff\.map/);
  assert.doesNotMatch(restoreDialog, /localStorage|setArtifacts|prepareWorkspaceMutation/);
  assert.match(restorePlanner, /prepareWorkspaceMutation\(artifacts, \[patch\], \[\]\)/);
  assert.match(restorePlanner, /await preflight\(current\.artifacts, \[prepared\.plan\.patch\]\)/);
  assert.match(restorePlanner, /persist\(prepared\.plan\.nextArtifacts, currentArtifact\.id, nextCheckpoints\)/);
  assert.doesNotMatch(restorePlanner, /from "react"|localStorage|setArtifacts/);
  assert.match(styles, /\.source-version-trigger > i\s*\{/);
  assert.match(styles, /\.checkpoint-panel-actions\s*\{/);
});

test("keeps the status bar task-focused and moves product version into More Tools", async () => {
  const response = await render();
  const html = await response.text();
  const settingsMenu = await readFile(
    new URL("../app/components/workbench-settings-menu.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    settingsMenu,
    /className="tools-version"[\s\S]{0,180}<strong dir="ltr">[\s\S]{0,80}\{ORBIT_PRODUCT_NAME\} \{ORBIT_PRODUCT_VERSION\}[\s\S]{0,20}<\/strong>/,
  );
  assert.match(ORBIT_PRODUCT_VERSION, /^\d+\.\d+$/);
  assert.match(html, /class="statusbar-right"><span>160 words · 34 lines<\/span><\/div>/);
  assert.doesNotMatch(html, /<span>UTF-8<\/span>/);
  assert.doesNotMatch(html, /class="statusbar-right"[^>]*>[\s\S]{0,300}legacy metrics/);
});

test("integrates assistance into the source surface and progressively discloses suggestions", async () => {
  const response = await render();
  const html = await response.text();
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const contentStyles = await readFile(new URL("../app/styles/content.css", import.meta.url), "utf8");
  const composer = await readFile(new URL("../app/components/agent-composer.tsx", import.meta.url), "utf8");
  const workbench = await readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8");
  const dockShell = await readFile(new URL("../app/components/agent-dock-shell.tsx", import.meta.url), "utf8");
  const conversation = await readFile(new URL("../app/components/agent-conversation.tsx", import.meta.url), "utf8");
  assert.match(
    html,
    /class="agent-composer"[\s\S]*class="agent-suggestions"[\s\S]*class="agent-scope-switch"[\s\S]*class="run-button"/,
  );
  assert.match(html, /<details class="agent-suggestions"><summary>/);
  assert.match(html, /data-agent-free-text="true"/);
  assert.match(html, /aria-label="Model for this message"/);
  assert.match(html, /role="group" aria-label="Agent change scope"/);
  assert.match(html, /class="agent-hint"/);
  assert.doesNotMatch(html, /class="agent-title-row"/);
  assert.doesNotMatch(html, /class="agent-avatar"/);
  assert.doesNotMatch(html, /class="agent-context-row"/);
  assert.match(styles, /\.agent-dock\s*\{[^}]*margin:\s*0;[^}]*border:\s*0;[^}]*border-top:/s);
  assert.match(styles, /\.agent-composer:focus-within\s*\{/);
  assert.match(styles, /\.run-button\s*\{[^}]*border-radius:\s*999px;/s);
  assert.ok(composer.indexOf('className="agent-composer-body"') < composer.indexOf('className="agent-suggestions"'));
  assert.match(composer, /rows=\{2\}[\s\S]{0,80}maxLength=\{2_000\}/u);
  assert.match(contentStyles, /\.agent-model-picker select\s*\{/u);
  assert.match(contentStyles, /\.agent-dock\.open\.floating\s*\{/u);
  assert.match(contentStyles, /\.agent-context-trigger\s*\{/u);
  assert.match(workbench, /const AGENT_DRAFT_STORAGE_KEY = "rune-agent-draft-v1"/u);
  assert.match(workbench, /className="agent-context-trigger"/u);
  assert.match(workbench, /onMovePointerDown=\{beginAgentDockDrag\}/u);
  assert.match(workbench, /onMoveKeyDown=\{moveAgentDockFromKeyboard\}/u);
  assert.match(dockShell, /onPointerDown=\{onMovePointerDown\}/u);
  assert.match(dockShell, /onKeyDown=\{onMoveKeyDown\}/u);
  assert.match(conversation, /role="log"/u);
  assert.match(workbench, /event\.key !== "Enter" \|\| event\.shiftKey \|\| event\.nativeEvent\.isComposing/u);
  assert.match(workbench, /setPrompt\(\(current\) => \(current === submittedComposerDraft \? "" : current\)\)/u);
  assert.doesNotMatch(workbench, /className="deferred-surface-mark"[^]*>\s*R\s*</u);
});

test("organizes workspace files by product workflow rather than internal artifact inventory", async () => {
  const response = await render();
  const html = await response.text();
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(html, /<nav class="artifact-groups" aria-label="Artifacts">/);
  assert.match(html, /class="artifact-group artifact-group-sources"[\s\S]*>Sources<\/h2>/);
  assert.match(html, /class="artifact-group artifact-group-analysis"[\s\S]*>Analysis<\/h2>/);
  assert.match(html, /class="artifact-group artifact-group-deliverables"[\s\S]*>Deliverables<\/h2>/);
  assert.match(
    html,
    /artifact-group-sources[\s\S]*regional-revenue\.csv[\s\S]*artifact-group-analysis[\s\S]*regional-analysis\.sql[\s\S]*regional-revenue\.chart\.json[\s\S]*artifact-group-deliverables[\s\S]*q2-review\.md[\s\S]*board-briefing\.html/,
  );
  assert.doesNotMatch(html, /class="active-notch"/);
  assert.match(
    styles,
    /\.artifact-row\.active\s*\{[^}]*background:\s*rgba\(var\(--theme-rgb\),\s*\.085\);[^}]*box-shadow:\s*inset 2px 0 var\(--theme-accent\);/s,
  );
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
  const activityRailSource = await readFile(
    new URL("../app/components/workbench-activity-rail.tsx", import.meta.url),
    "utf8",
  );
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const topbarSource = source.slice(
    source.indexOf('<header className="topbar">'),
    source.indexOf("</header>", source.indexOf('<header className="topbar">')),
  );
  assert.doesNotMatch(topbarSource, /openOperatingReview|review-task-button|ClipboardList/);
  assert.match(html, /class="brand-copy"><strong dir="ltr">Orbit<\/strong><\/div><span class="project-separator"/);
  assert.match(html, /class="save-indicator saved" role="status" aria-label="Saved on device · Last saved/);
  assert.match(html, /class="visually-hidden">Saved on device<\/span>/);
  assert.match(activityRailSource, /className="activity-button"[\s\S]{0,420}onClick=\{onOperatingReview\}/);
  assert.match(html, />New<\/button>[\s\S]*>Import<\/button>[\s\S]*class="export-menu"/);
  assert.match(html, /class="activity-rail"[\s\S]*aria-label="More tools"/);
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
  assert.match(
    styles,
    /\.welcome-window\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*min-height:\s*100vh;[^}]*border-radius:\s*0;[^}]*box-shadow:\s*none;/s,
  );
  assert.match(styles, /\.welcome-chrome\s*\{[^}]*position:\s*sticky;[^}]*height:\s*72px;/s);
  assert.match(styles, /\.welcome-page\s*\{[^}]*min-height:\s*calc\(100vh - 72px\);/s);
});

test("moves live lineage into preview evidence so compiled content starts immediately", async () => {
  const response = await render();
  const html = await response.text();
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(
    html,
    /class="preview-evidence-popover"[\s\S]*class="preview-evidence-lineage"[\s\S]*class="lineage-strip query-lineage"/,
  );
  assert.match(
    html,
    /class="preview-evidence-lineage"[\s\S]*regional-summary\.sql[\s\S]*q2-review\.md[\s\S]*regional-revenue\.csv/,
  );
  assert.match(html, /<div class="preview-body"><div class="preview-scroll">/);
  assert.doesNotMatch(html, /<div class="preview-body"><div class="lineage-strip/);
  assert.match(styles, /\.preview-evidence-lineage\s*\{/);
  assert.match(
    styles,
    /\.preview-evidence-lineage \.lineage-strip\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;/s,
  );
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
  const [legacyStyles, styleFiles, source, settingsMenu, welcome, handwrittenGreeting, fluidSurface] =
    await Promise.all([
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      Promise.all(
        ["tokens", "shell", "content", "overlays", "onboarding", "motion", "responsive"].map((name) =>
          readFile(new URL(`../app/styles/${name}.css`, import.meta.url), "utf8"),
        ),
      ),
      readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/components/workbench-settings-menu.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/components/welcome-experience.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/components/handwritten-greeting.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/lib/fluid-surface.ts", import.meta.url), "utf8"),
    ]);
  const modularStyles = styleFiles.join("\n");
  const styles = [legacyStyles, ...styleFiles].join("\n");
  assert.match(styles, /--rune-content-wide:\s*1260px;/);
  assert.match(styles, /--rune-frame-width:\s*87\.5%;/);
  assert.match(styles, /--rune-radius-window:\s*32px;/);
  assert.match(styles, /--rune-radius-workspace:\s*24px;/);
  assert.match(styles, /--rune-type-display:\s*clamp\(46px,\s*5\.1vw,\s*70px\);/);
  assert.match(styles, /--rune-duration-scene:\s*760ms;/);
  assert.match(styles, /@keyframes rune-window-enter\s*\{\s*from\s*\{\s*opacity:\s*0;\s*transform:\s*scale\(\.975\);/);
  assert.match(styles, /--rune-file-width:\s*220px;/);
  assert.match(modularStyles, /\.welcome-intro-grid\s*\{[^}]*width:\s*min\(560px,\s*100%\);/s);
  assert.match(modularStyles, /\.welcome-window\s*\{[^}]*max-height:\s*calc\(100dvh - var\(--rune-space-6\)\);/s);
  assert.match(
    styles,
    /\.workspace\.with-file-rail\s*\{[^}]*var\(--workspace-source-track,\s*44fr\)[^}]*var\(--workspace-preview-track,\s*56fr\)/s,
  );
  assert.match(
    styles,
    /\.document-stage,\s*\.data-stage,\s*\.chart-stage,\s*\.slides-stage\s*\{[^}]*background:\s*var\(--rune-stage\);[^}]*background-image:\s*none;/s,
  );
  assert.match(styles, /@supports \(corner-shape:\s*squircle\)/);
  assert.match(modularStyles, /@keyframes rune-greeting-dock/);
  assert.match(modularStyles, /@keyframes rune-greeting-pencil-write/);
  assert.match(modularStyles, /@keyframes rune-setup-unfold/);
  assert.doesNotMatch(
    modularStyles,
    /@keyframes rune-(?:welcome-ambient|greeting-color-bloom|greeting-stroke-head|greeting-pressure|boot-chroma)/,
  );
  assert.match(modularStyles, /\.welcome-greeting-tegaki\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(modularStyles, /\.welcome-greeting-vector-stroke\s*\{[^}]*stroke-dasharray:\s*1/s);
  assert.match(modularStyles, /grid-template-areas:\s*"greeting"\s*"language"/s);
  assert.match(
    handwrittenGreeting,
    /#050506[^]*#30d158[^]*#ffd60a[^]*#ff9f0a[^]*#ff453a[^]*#ff375f[^]*#bf5af2[^]*#0a84ff/,
  );
  assert.match(styles, /circle at var\(--rune-pointer-x\) var\(--rune-pointer-y\)/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /html\[data-locale="ar"\][^]*\.welcome-page h1/);
  assert.match(styles, /html\[data-locale="ja"\]/);
  assert.match(styles, /html\[data-locale="ko"\]/);
  assert.match(source, /moveMaterialLight/);
  assert.match(settingsMenu, /className="tools-material-preview"/);
  assert.match(welcome, /<HandwrittenGreeting/);
  assert.match(welcome, /window\.setTimeout/);
  assert.match(welcome, /planGreetingPresentation\(\{ locale: greetingLocale, value: greeting \}\)/);
  assert.match(welcome, /greetingPresentation\.completeAfterMs \+ 180/);
  assert.match(handwrittenGreeting, /<linearGradient/);
  assert.match(handwrittenGreeting, /className="welcome-greeting-vector-stroke"/);
  assert.match(handwrittenGreeting, /<TegakiRenderer/);
  assert.doesNotMatch(handwrittenGreeting, /<tspan/);
  assert.match(handwrittenGreeting, /feTurbulence[^]*feDisplacementMap/);
  assert.doesNotMatch(handwrittenGreeting, /welcome-greeting-(?:color-bloom|ink-trail|ink-sheen|stroke-head)/);
  assert.match(
    handwrittenGreeting,
    /"data-motion-renderer": usesVectorCenterline \? "vector-centerline" : "tegaki-font-centerline"/,
  );
  assert.match(handwrittenGreeting, /"data-motion-timeline": "path-length-staggered"/);
  assert.match(handwrittenGreeting, /"data-ink-effect": "spectrum-write"/);
  assert.match(handwrittenGreeting, /"data-ink-material": "pressure-pencil-spectrum"/);
  assert.match(handwrittenGreeting, /"data-color-system": "apple-hello-spectrum"/);
  assert.match(handwrittenGreeting, /"data-boot-motion": "center-write-settle"/);
  assert.match(handwrittenGreeting, /"data-ink-trace": "progressive"/);
  assert.match(handwrittenGreeting, /"data-motion-sequence": "write-settle-reveal"/);
  assert.match(welcome, /data-onboarding-sequence="spectrum-write-settle-setup"/);
  assert.match(handwrittenGreeting, /"data-writing-style": "font-derived-centerline"/);
  assert.match(handwrittenGreeting, /"data-motion-script": script/);
  assert.match(handwrittenGreeting, /ENGLISH_HELLO_STROKES\.map/);
  assert.doesNotMatch(
    handwrittenGreeting,
    /offsetPath|motion\.writePath|welcome-greeting-flourish|welcome-greeting-stroke-head/,
  );
  assert.doesNotMatch(handwrittenGreeting, /fetch\(|localStorage|indexedDB|WorkspaceArtifact|ModelProvider/);
  assert.doesNotMatch(handwrittenGreeting, /planGreetingMotion|localeDirection/);
  assert.doesNotMatch(welcome, /WelcomeAmbientMotion|greetingCycleDuration|setGreetingIndex/);
  assert.match(welcome, /data-intro-phase=\{introPhase\}/);
  assert.match(modularStyles, /\.welcome-window\[data-intro-phase="writing"\][^}]*box-shadow:\s*none/s);
  assert.match(
    modularStyles,
    /\.welcome-window\[data-intro-phase="writing"\] \.welcome-page\s*\{[^}]*overflow:\s*hidden;[^}]*scrollbar-gutter:\s*auto;/s,
  );
  assert.match(
    modularStyles,
    /\.welcome-intro-grid\[data-intro-phase="writing"\]\s*\{[^}]*position:\s*absolute;[^}]*place-items:\s*center;/s,
  );
  assert.match(modularStyles, /@keyframes rune-greeting-dock\s*\{[^}]*clamp\(112px,\s*18vh,\s*170px\)/s);
  assert.match(fluidSurface, /trackFluidSurface/);
  assert.match(fluidSurface, /event\.pointerType === "touch"/);
  assert.match(fluidSurface, /prefers-reduced-motion:\s*reduce/);
});
