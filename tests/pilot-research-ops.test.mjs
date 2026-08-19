import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const guideUrl = new URL("../docs/pilot/INTERVIEW-GUIDE.md", import.meta.url);
const runbookUrl = new URL("../docs/pilot/README.md", import.meta.url);

test("keeps P1 interview operations linked to exact recent-task evidence gates", async () => {
  const [guide, runbook] = await Promise.all([readFile(guideUrl, "utf8"), readFile(runbookUrl, "utf8")]);

  assert.match(runbook, /\[P1 interview guide\]\(INTERVIEW-GUIDE\.md\)/);
  assert.match(guide, /most recent completed task/i);
  assert.match(guide, /at least 8 of 15 performed the task at least monthly/i);
  assert.match(guide, /at least 5 spent more than two active hours per cycle or described material error cost/i);
  assert.match(guide, /at least 7 agreed to a supervised real task/i);
  assert.match(guide, /at least 5 authorized or redacted source sets/i);
});

test("keeps completed research records and commercial proof outside the repository", async () => {
  const guide = await readFile(guideUrl, "utf8");

  assert.match(guide, /Do not commit completed interview records/i);
  assert.match(guide, /Count payment as E4 only after an authorized payment or signed commercial commitment/i);
  assert.match(guide, /Do not average unknown answers into success/i);
  assert.match(guide, /replace missing interviews with synthetic personas/i);
});
