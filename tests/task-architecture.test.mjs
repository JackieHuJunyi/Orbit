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
  const [workbench, empty, reviewDialog, operatingDialog, briefingDialog, briefingCompiler, styles] = await Promise.all([
    source("../app/components/rune-workbench.tsx"),
    source("../app/components/empty-workspace.tsx"),
    source("../app/components/import-review-dialog.tsx"),
    source("../app/components/operating-review-dialog.tsx"),
    source("../app/components/document-briefing-dialog.tsx"),
    source("../app/lib/document-briefing.ts"),
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
  assert.match(briefingDialog, /preferredDocumentArtifactId/);
  assert.match(briefingCompiler, /origin: \$\{source\.id\}/);
  assert.doesNotMatch(briefingCompiler, /react|localStorage|indexedDB|document\.|window\.|fetch\(|persist/i);
  assert.match(styles, /\.empty-task-primary/);
  assert.match(styles, /\.import-task-continuation/);
});
