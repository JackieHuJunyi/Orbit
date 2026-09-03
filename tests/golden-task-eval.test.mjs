import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ORBIT_GOLDEN_TASKS } from "../evals/golden-task-set.ts";

test("keeps the synthetic regression set distinct from licensed user proof", async () => {
  assert.equal(ORBIT_GOLDEN_TASKS.length, 20);
  assert.equal(
    ORBIT_GOLDEN_TASKS.every((task) => task.provenance === "synthetic"),
    true,
  );
  assert.equal(ORBIT_GOLDEN_TASKS.filter((task) => task.expected.outcome === "success").length, 14);
  assert.equal(ORBIT_GOLDEN_TASKS.filter((task) => task.expected.outcome === "rejected").length, 6);

  const baseline = await readFile(new URL("../evals/BASELINE.md", import.meta.url), "utf8");
  assert.match(baseline, /Evidence grade E1/);
  assert.match(baseline, /0 licensed or redacted real tasks/);
  assert.match(baseline, /This is not user-demand, delivery, retention, or paid validation/);
  assert.match(baseline, /A number-correctness score below 4 cannot be hidden by averaging/);
});

test("runs the eval outside the production client and only through public capability seams", async () => {
  const [runner, client, packageSource] = await Promise.all([
    readFile(new URL("../evals/run-golden-task-set.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/components/orbit-workbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(runner, /prepareOrbitTaskProvider/);
  assert.match(runner, /prepareWorkspaceMutation/);
  assert.match(runner, /buildBoundedQuery/);
  assert.doesNotMatch(client, /golden-task|runOrbitGoldenTaskSet|BASELINE\.md/i);
  assert.match(packageSource, /"eval:golden"/);
  assert.match(packageSource, /npm run eval:golden/);
});
