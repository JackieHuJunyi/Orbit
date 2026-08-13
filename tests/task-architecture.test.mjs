import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("keeps task definitions pure and outside the React or persistence boundary", async () => {
  const runtime = await source("../app/lib/task-runtime.ts");
  const imports = [...runtime.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);

  assert.deepEqual(imports.sort(), ["./imports.ts", "./patches.ts", "./workspace.ts"]);
  assert.match(runtime, /"awaiting-source" \| "reviewing-source" \| "configuring"/);
  assert.match(runtime, /RUNE_TASK_DEFINITIONS/);
  assert.match(runtime, /workspaceMatchesSourceRevision/);
  assert.match(runtime, /validateWorkspaceImportReview/);
  assert.doesNotMatch(runtime, /react|localStorage|indexedDB|document\.|window\.|fetch\(|persist/i);
});

test("composes multiple tasks through declared capabilities, exact import identity, and typed continuations", async () => {
  const [workbench, empty, reviewDialog, operatingDialog, operatingCompiler, operatingContract, operatingScope, operatingRoute, briefingDialog, briefingCompiler, briefingContract, briefingRoute, providers, styles] = await Promise.all([
    source("../app/components/rune-workbench.tsx"),
    source("../app/components/empty-workspace.tsx"),
    source("../app/components/import-review-dialog.tsx"),
    source("../app/components/operating-review-dialog.tsx"),
    source("../app/lib/operating-review.ts"),
    source("../app/lib/operating-review-contract.ts"),
    source("../app/lib/operating-review-scope.ts"),
    source("../app/api/tasks/operating-review/route.ts"),
    source("../app/components/document-briefing-dialog.tsx"),
    source("../app/lib/document-briefing.ts"),
    source("../app/lib/document-briefing-contract.ts"),
    source("../app/api/tasks/document-briefing/route.ts"),
    source("../app/lib/task-providers.ts"),
    source("../app/styles/content.css"),
  ]);

  assert.match(workbench, /accept=\{RUNE_TASK_DEFINITIONS\[taskSession\?\.taskId \?\? "operating-review"\]\.sourceAccept\}/);
  assert.match(workbench, /startRuneTaskFromSource\("document-briefing"\)/);
  assert.match(workbench, /bindRuneTaskImportReview\(activeTaskSession, baseArtifacts, prepared\.review\)/);
  assert.match(workbench, /prepareRuneTaskAfterImport\(taskSession, artifacts, pendingImport\)/);
  assert.match(workbench, /preferredDataArtifactId=\{taskSession\?\.phase === "configuring"/);
  assert.match(empty, /onStartReview/);
  assert.match(empty, /onStartBriefing/);
  assert.match(empty, /className="empty-task-primary"/);
  assert.match(reviewDialog, /continuationTask\?: RuneTaskId/);
  assert.match(reviewDialog, /className="import-task-continuation"/);
  assert.match(operatingDialog, /initialInput\?\.dataArtifactId \?\? preferredDataArtifactId \?\? ""/);
  assert.match(operatingDialog, /modelMode: RuneModelMode/);
  assert.match(operatingCompiler, /prepareOperatingReviewEvidence/);
  assert.match(operatingCompiler, /formatQueryMetricReference/);
  assert.match(operatingCompiler, /prepareOperatingReviewScope/);
  assert.match(operatingCompiler, /formatOperatingReviewScopePredicate/);
  assert.match(operatingScope, /MAX_OPERATING_REVIEW_SCOPE_OPTIONS = 100/);
  assert.doesNotMatch(operatingScope, /react|localStorage|indexedDB|document\.|window\.|fetch\(|persist/i);
  assert.match(operatingDialog, /collectOperatingReviewScopeValues/);
  assert.match(operatingContract, /generic qualitative text without copied labels or numbers/);
  assert.match(operatingRoute, /resolveActiveModelConnection/);
  assert.match(operatingRoute, /validateOperatingReviewNarrative/);
  assert.doesNotMatch(operatingRoute, /prepareWorkspaceMutation|setArtifacts|persistDeviceWorkspace/);
  assert.match(briefingDialog, /preferredDocumentArtifactId/);
  assert.match(briefingDialog, /preferredPresentationArtifactId/);
  assert.match(briefingDialog, /initialTarget\?\.audience \?\? "leadership"/);
  assert.match(briefingDialog, /initialTarget\?\.purpose \?\? ""/);
  assert.match(briefingDialog, /locale: target\?\.locale \?\? locale/);
  assert.match(briefingCompiler, /origin: \$\{source\.id\}/);
  assert.match(briefingCompiler, /origin_revision: \$\{portableSourceRevision\(source\.source\)\}/);
  assert.match(briefingCompiler, /audience: \$\{input\.audience\}/);
  assert.match(briefingCompiler, /purpose: \$\{normalizePlainText\(input\.focus\)\}/);
  assert.match(briefingCompiler, /Refresh/);
  assert.doesNotMatch(briefingCompiler, /react|localStorage|indexedDB|document\.|window\.|fetch\(|persist/i);
  assert.match(briefingContract, /Every bounded source unit must support exactly one content slide/);
  assert.match(briefingContract, /Rune owns the cover, conclusion, file identity, source metadata, and every write/);
  assert.match(briefingRoute, /resolveActiveModelConnection/);
  assert.match(briefingRoute, /validateDocumentBriefingModelOutline/);
  assert.doesNotMatch(briefingRoute, /prepareWorkspaceMutation|setArtifacts|persistDeviceWorkspace/);
  assert.match(providers, /case "operating-review"/);
  assert.match(providers, /case "document-briefing"/);
  assert.match(providers, /satisfies Record<RuneTaskId, true>/);
  assert.doesNotMatch(providers, /react|localStorage|indexedDB|window\.|fetch\(|persist/i);
  assert.match(workbench, /prepareRuneTaskProvider\(baseArtifacts, \{\s*taskId: "operating-review",\s*input,\s*\.\.\.\(narrative/);
  assert.match(workbench, /prepareRuneTaskProvider\(baseArtifacts, \{\s*taskId: "document-briefing",\s*input,/);
  assert.match(workbench, /fetch\("\/api\/tasks\/document-briefing"/);
  assert.match(workbench, /fetch\("\/api\/tasks\/operating-review"/);
  assert.match(workbench, /planningKind: "task-outline"/);
  assert.match(workbench, /planningKind: "task-narrative"/);
  assert.match(workbench, /documentBriefingTargetsById/);
  assert.match(workbench, /briefingFreshness === "changed"/);
  assert.match(workbench, /function reviewLinkedPresentationRefresh\(artifactId: string\)/);
  assert.match(workbench, /onClick=\{\(\) => reviewLinkedPresentationRefresh\(artifact\.id\)\}/);
  assert.match(workbench, /openDocumentBriefingForArtifact\(target\)/);
  const directRefresh = workbench.slice(
    workbench.indexOf("function reviewLinkedPresentationRefresh"),
    workbench.indexOf("function openSavedOperatingReview"),
  );
  assert.match(directRefresh, /documentBriefingSourceIdForPresentation\(target\)/);
  assert.match(directRefresh, /targetFreshness !== "changed"/);
  assert.doesNotMatch(directRefresh, /setArtifacts|persistDeviceWorkspace|prepareRuneTaskProvider/);
  assert.match(styles, /\.empty-task-primary/);
  assert.match(styles, /\.import-task-continuation/);
});
