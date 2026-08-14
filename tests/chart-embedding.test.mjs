import assert from "node:assert/strict";
import test from "node:test";

import { prepareArtifactCreation } from "../app/lib/artifact-creation.ts";
import { chartEmbeddingTargets, prepareChartEmbedding } from "../app/lib/chart-embedding.ts";
import { findChartReferences } from "../app/lib/charts.ts";
import { prepareWorkspaceMutation } from "../app/lib/patches.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";

test("appends one reusable Chart binding to a Markdown document or Deck slide", () => {
  const chart = {
    id: "customer-chart",
    name: "customer.chart.json",
    kind: "chart",
    language: "Chart JSON",
    source:
      '{"version":1,"title":"Customers by region","description":"","source":"regional-revenue","mark":"bar","category":"Region","value":"Customers","sort":"descending","format":"number","color":"#ff5c35","maxItems":8}',
  };
  const workspace = [...defaultArtifacts, chart];
  const targets = chartEmbeddingTargets(workspace);
  assert.deepEqual(
    targets.map((target) => target.id),
    ["q2-review", "board-briefing"],
  );

  for (const targetId of targets.map((target) => target.id)) {
    const embedding = prepareChartEmbedding(workspace, chart.id, targetId);
    assert.deepEqual(embedding.errors, []);
    assert.deepEqual(findChartReferences(embedding.nextSource), [
      ...findChartReferences(workspace.find((artifact) => artifact.id === targetId).source),
      chart.id,
    ]);
    const mutation = prepareWorkspaceMutation(
      workspace,
      [
        {
          artifactId: embedding.artifactId,
          summary: "Embed Chart",
          detail: "Append one live binding.",
          nextSource: embedding.nextSource,
        },
      ],
      [],
    );
    assert.deepEqual(mutation.errors, []);
    if (targetId === "board-briefing") {
      assert.match(embedding.nextSource, /<!-- layout: split -->\n\n# Customers by region/);
    } else {
      assert.match(embedding.nextSource, /## Customers by region/);
    }
  }
});

test("creates and embeds a Unicode Chart identity in one atomic workspace mutation", () => {
  const data = {
    id: "区域数据",
    name: "区域数据.csv",
    kind: "data",
    language: "CSV / JSON",
    source: "区域,收入\n华东,42\n华南,31\n",
  };
  const document = {
    id: "report",
    name: "report.md",
    kind: "document",
    language: "Markdown",
    source: "# 报告\n",
  };
  const created = prepareArtifactCreation([data, document], {
    kind: "chart",
    title: "区域收入",
    sourceArtifactId: data.id,
    category: "区域",
    value: "收入",
    mark: "bar",
    format: "number",
  });
  assert.deepEqual(created.errors, []);
  assert.equal(created.artifact.id, "区域收入");
  const embedding = prepareChartEmbedding(created.nextArtifacts, created.artifact.id, document.id);
  assert.deepEqual(embedding.errors, []);
  assert.deepEqual(findChartReferences(embedding.nextSource), ["区域收入"]);
  const mutation = prepareWorkspaceMutation(
    [data, document],
    [
      {
        artifactId: document.id,
        summary: "嵌入图表",
        detail: "添加一个实时图表引用。",
        nextSource: embedding.nextSource,
      },
    ],
    [
      {
        artifact: created.artifact,
        summary: "创建图表",
        detail: "使用精确数据字段。",
      },
    ],
  );
  assert.deepEqual(mutation.errors, []);
  assert.equal(mutation.nextArtifacts.length, 3);
});

test("rejects duplicate bindings and non-document destinations", () => {
  const duplicate = prepareChartEmbedding(defaultArtifacts, "regional-revenue-chart", "q2-review");
  assert.match(duplicate.errors[0], /already embeds/i);
  const invalid = prepareChartEmbedding(defaultArtifacts, "regional-revenue-chart", "regional-revenue");
  assert.match(invalid.errors[0], /only in Markdown documents or Deck Markdown/i);
});
