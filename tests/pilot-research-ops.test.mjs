import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const guideUrl = new URL("../docs/pilot/INTERVIEW-GUIDE.md", import.meta.url);
const runbookUrl = new URL("../docs/pilot/README.md", import.meta.url);
const comparisonGuideUrl = new URL("../docs/pilot/TASK-COMPARISON-GUIDE.md", import.meta.url);
const paidPilotGuideUrl = new URL("../docs/pilot/PAID-PILOT-GUIDE.md", import.meta.url);

test("keeps P1 interview operations linked to exact recent-task evidence gates", async () => {
  const [guide, runbook, packageJson] = await Promise.all([
    readFile(guideUrl, "utf8"),
    readFile(runbookUrl, "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(runbook, /\[P1 interview guide\]\(INTERVIEW-GUIDE\.md\)/);
  assert.match(guide, /most recent completed task/i);
  assert.match(guide, /at least 8 of 15 performed the task at least monthly/i);
  assert.match(guide, /at least 5 spent more than two active hours per cycle or described material error cost/i);
  assert.match(guide, /at least 7 agreed to a supervised real task/i);
  assert.match(guide, /at least 5 authorized or redacted source sets/i);
  assert.match(guide, /exactly the first 15 unique eligible participants/i);
  assert.match(guide, /Price-choice counts remain explicitly labeled E1/i);
  assert.match(packageJson, /"pilot:interviews"/);
});

test("keeps completed research records and commercial proof outside the repository", async () => {
  const guide = await readFile(guideUrl, "utf8");

  assert.match(guide, /Do not commit completed interview records/i);
  assert.match(guide, /Count payment as E4 only after an authorized payment or signed commercial commitment/i);
  assert.match(guide, /Do not average unknown answers into success/i);
  assert.match(guide, /replace missing interviews with synthetic personas/i);
});

test("binds P2 comparisons to exact paired scopes and the executable outcome gate", async () => {
  const [guide, runbook, packageJson] = await Promise.all([
    readFile(comparisonGuideUrl, "utf8"),
    readFile(runbookUrl, "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(runbook, /\[P2 paired-task comparison guide\]\(TASK-COMPARISON-GUIDE\.md\)/);
  assert.match(guide, /same source scope/i);
  assert.match(guide, /same decision goal/i);
  assert.match(guide, /median of the per-task active-time reductions is at least 50%/i);
  assert.match(guide, /100% of generated key numbers/i);
  assert.match(guide, /zero safety redlines/i);
  assert.match(packageJson, /"pilot:outcomes"/);
  assert.match(guide, /example is schema documentation, not participant evidence/i);
});

test("keeps P4 tied to authorized commercial evidence and the fixed denominator", async () => {
  const [guide, runbook, packageJson] = await Promise.all([
    readFile(paidPilotGuideUrl, "utf8"),
    readFile(runbookUrl, "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(runbook, /\[P4 paid-pilot guide\]\(PAID-PILOT-GUIDE\.md\)/);
  assert.match(guide, /¥499\/team\/month/);
  assert.match(guide, /¥999\/team\/month/);
  assert.match(guide, /¥1,999\/team\/month/);
  assert.match(guide, /paying teams \/ qualified pilots offered/i);
  assert.match(guide, /checkout click.*is not E4/i);
  assert.match(guide, /Do not implement or simulate payments inside Orbit/i);
  assert.match(guide, /at least 5 paying teams/i);
  assert.match(guide, /Omitting refusals changes the denominator/i);
  assert.match(guide, /refunded.*never counts as a paying team/i);
  assert.match(guide, /example is schema documentation, not payment evidence/i);
  assert.match(packageJson, /"pilot:commercial"/);
});
