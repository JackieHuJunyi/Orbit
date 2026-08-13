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

test("composes the task through declared capability, exact import identity, and one continuation", async () => {
  const [workbench, empty, reviewDialog, setupDialog, styles] = await Promise.all([
    source("../app/components/rune-workbench.tsx"),
    source("../app/components/empty-workspace.tsx"),
    source("../app/components/import-review-dialog.tsx"),
    source("../app/components/operating-review-dialog.tsx"),
    source("../app/styles/content.css"),
  ]);

  assert.match(workbench, /accept=\{RUNE_TASK_DEFINITIONS\["operating-review"\]\.sourceAccept\}/);
  assert.match(workbench, /bindRuneTaskImportReview\(activeTaskSession, baseArtifacts, prepared\.review\)/);
  assert.match(workbench, /prepareRuneTaskAfterImport\(taskSession, artifacts, pendingImport\)/);
  assert.match(workbench, /preferredDataArtifactId=\{taskSession\?\.phase === "configuring"/);
  assert.match(empty, /onStartReview/);
  assert.match(empty, /className="empty-task-primary"/);
  assert.match(reviewDialog, /continueToOperatingReview/);
  assert.match(reviewDialog, /className="import-task-continuation"/);
  assert.match(setupDialog, /initialInput\?\.dataArtifactId \?\? preferredDataArtifactId \?\? ""/);
  assert.match(styles, /\.empty-task-primary/);
  assert.match(styles, /\.import-task-continuation/);
});
