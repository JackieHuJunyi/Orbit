import assert from "node:assert/strict";
import test from "node:test";

import { parseChartSource } from "../app/lib/charts.ts";
import { parseDeckSource } from "../app/lib/deck.ts";
import { planLocalWorkspaceAgentChange } from "../app/lib/local-workspace-agent.ts";
import { prepareWorkspaceMutation } from "../app/lib/patches.ts";
import { parseQueryDataSourceDirective } from "../app/lib/query-source.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";

test("prepares a new context-aware presentation without mutating the current workspace", () => {
  const sources = defaultArtifacts.map((artifact) => artifact.source);
  const plan = planLocalWorkspaceAgentChange(defaultArtifacts, "根据当前报告新建一份演示");
  assert.equal(plan.patches.length, 0);
  assert.equal(plan.creations.length, 1);
  assert.equal(plan.creations[0].artifact.name, "workspace-briefing.deck.md");
  assert.match(plan.creations[0].artifact.source, /Canonical source map/);
  assert.match(plan.creations[0].artifact.source, /q2-review\.md/);
  assert.deepEqual(parseDeckSource(plan.creations[0].artifact.source).errors, []);
  assert.deepEqual(defaultArtifacts.map((artifact) => artifact.source), sources);

  const prepared = prepareWorkspaceMutation(defaultArtifacts, plan.patches, plan.creations);
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.nextArtifacts.length, defaultArtifacts.length + 1);
});

test("uses the same collision-safe identity factory for repeated local creation plans", () => {
  const first = planLocalWorkspaceAgentChange(defaultArtifacts, "create a new presentation");
  const next = prepareWorkspaceMutation(defaultArtifacts, first.patches, first.creations).nextArtifacts;
  const second = planLocalWorkspaceAgentChange(next, "create another new deck");
  assert.equal(second.creations[0].artifact.id, "workspace-briefing-2");
  assert.equal(second.creations[0].artifact.name, "workspace-briefing-2.deck.md");
});

test("creates source-bound Query and Chart starters in the offline Workspace Agent", () => {
  const queryPlan = planLocalWorkspaceAgentChange(defaultArtifacts, "根据数据新建一个 SQL 查询分析");
  assert.equal(queryPlan.creations[0].artifact.name, "workspace-analysis.sql");
  assert.deepEqual(parseQueryDataSourceDirective(queryPlan.creations[0].artifact.source), {
    artifactId: "regional-revenue",
    explicit: true,
    errors: [],
  });
  assert.deepEqual(prepareWorkspaceMutation(defaultArtifacts, [], queryPlan.creations).errors, []);

  const chartPlan = planLocalWorkspaceAgentChange(defaultArtifacts, "根据收入数据新建一个图表");
  assert.equal(chartPlan.creations[0].artifact.name, "workspace-chart.chart.json");
  const spec = parseChartSource(chartPlan.creations[0].artifact.source).spec;
  assert.equal(spec.source, "regional-revenue");
  assert.equal(spec.category, "Region");
  assert.equal(spec.value, "Q2 Revenue");
  assert.equal(spec.format, "currency");
  assert.deepEqual(prepareWorkspaceMutation(defaultArtifacts, [], chartPlan.creations).errors, []);
});

test("keeps existing deterministic workspace coordination available", () => {
  const plan = planLocalWorkspaceAgentChange(defaultArtifacts, "让分析、报告和演示保持一致");
  assert.deepEqual(plan.patches.map((patch) => patch.artifactId), ["q2-review", "board-briefing"]);
  assert.deepEqual(plan.creations, []);
});

test("uses the explicit context pack while retaining full-workspace creation identity", () => {
  const context = defaultArtifacts.filter((artifact) => ["q2-review", "board-briefing"].includes(artifact.id));
  const coordinated = planLocalWorkspaceAgentChange(
    defaultArtifacts,
    "让报告和演示保持一致",
    context,
  );
  assert.deepEqual(coordinated.patches.map((patch) => patch.artifactId), ["q2-review", "board-briefing"]);

  const created = planLocalWorkspaceAgentChange(
    defaultArtifacts,
    "根据 pin 的上下文创建一份新文档",
    context,
  );
  assert.equal(created.creations.length, 1);
  assert.match(created.creations[0].artifact.source, /q2-review\.md/);
  assert.match(created.creations[0].artifact.source, /board-briefing\.deck\.md/);
  assert.doesNotMatch(created.creations[0].artifact.source, /regional-revenue\.csv/);
});
