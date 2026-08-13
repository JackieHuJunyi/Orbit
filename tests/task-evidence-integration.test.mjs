import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("wires Document-to-Presentation through one bounded device task evidence ledger", async () => {
  const [workbench, evidence, deliveryDialog] = await Promise.all([
    read("../app/components/rune-workbench.tsx"),
    read("../app/lib/task-evidence.ts"),
    read("../app/components/delivery-outcome-dialog.tsx"),
  ]);

  assert.match(workbench, /taskEvidence: RuneTaskEvidence/);
  assert.match(workbench, /setTaskEvidence\(normalizeRuneTaskEvidence\(parsed\.taskEvidence\)\)/);
  assert.match(workbench, /taskRun:\s*\{\s*taskId: "document-briefing",\s*sourceArtifactId: input\.sourceArtifactId,\s*outputArtifactIds: \[outputArtifactId\]/s);
  assert.match(workbench, /runeTaskRunFromPendingChange\(pendingChange, "applied", null\)/);
  assert.match(workbench, /recordStoppedRuneTask\(pendingChange, "(?:stale|validation|persistence|cancelled)"\)/);
  assert.match(workbench, /recordRuneTaskDelivery\(\{/);
  assert.match(workbench, /currentOutput\.source !== pending\.sourceRevision/);
  assert.match(workbench, /candidate\.outputRevisions\[artifact\.id\] === portableSourceRevision\(artifact\.source\)/);
  assert.match(workbench, /ui\.recentTaskRuns/);

  assert.match(evidence, /MAX_RUNE_TASK_RUNS = 24/);
  assert.match(evidence, /MAX_RUNE_TASK_DELIVERIES = 24/);
  assert.match(evidence, /sourceRevision: string/);
  assert.match(evidence, /outputRevisions: Record<string, string>/);
  assert.match(evidence, /This output changed after the applied task/);
  assert.doesNotMatch(evidence, /prompt|sourceText|documentText|workspaceSource/u);
  assert.match(deliveryDialog, /RuneTaskDeliveryRating/);
  assert.doesNotMatch(deliveryDialog, /OperatingReviewDeliveryRating/);
});

test("ships the new task evidence labels in every non-Chinese registered interface locale", async () => {
  const [localization, translations] = await Promise.all([
    read("../app/lib/localization.ts"),
    read("../app/lib/interface-locales.manual.ts"),
  ]);
  assert.match(localization, /recentTaskRuns: zh \? "最近任务记录" : "Recent task runs"/);
  assert.match(localization, /documentBriefingTask: zh \? "文档转演示" : "Document to presentation"/);
  for (const locale of ["fr", "es", "ru", "ar", "ja", "ko"]) {
    const block = translations.slice(translations.indexOf(`Object.assign(MANUAL_INTERFACE_TRANSLATIONS.${locale}, {`));
    assert.match(block, /"Recent task runs":/);
    assert.match(block, /"Document to presentation":/);
    assert.match(block, /"Task time":/);
  }
});
