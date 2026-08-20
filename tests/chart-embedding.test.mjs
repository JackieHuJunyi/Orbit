import assert from "node:assert/strict";
import test from "node:test";

import { prepareArtifactCreation } from "../app/lib/artifact-creation.ts";
import { chartEmbeddingTargets, prepareChartEmbedding } from "../app/lib/chart-embedding.ts";
import { findChartReferences } from "../app/lib/charts.ts";
import { compileLegacyHtmlSlides } from "../app/lib/legacy-html-slides.ts";
import { prepareWorkspaceMutation } from "../app/lib/patches.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";

test("appends one reusable Chart binding to a Markdown document or semantic HTML slide", () => {
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
      const compiled = compileLegacyHtmlSlides(embedding.nextSource);
      assert.deepEqual(compiled.errors, []);
      assert.match(compiled.slides.at(-1).source, /<h2>Customers by region<\/h2>/);
      assert.match(compiled.slides.at(-1).source, /\{\{ chart\("customer-chart"\) \}\}/);
    } else {
      assert.match(embedding.nextSource, /## Customers by region/);
    }
  }
});

test("keeps existing Deck Markdown presentations eligible for Chart embedding", () => {
  const chart = defaultArtifacts.find((artifact) => artifact.kind === "chart");
  assert.ok(chart);
  const legacy = {
    id: "legacy-deck",
    name: "legacy.deck.md",
    kind: "slides",
    language: "Deck Markdown",
    source: `---
version: 1
title: Legacy
theme: rune
ratio: 16:9
lang: en
---

# Legacy
`,
  };
  const workspace = [...defaultArtifacts, legacy];
  const embedding = prepareChartEmbedding(workspace, chart.id, legacy.id);
  assert.deepEqual(embedding.errors, []);
  assert.match(embedding.nextSource, /<!-- layout: split -->\n\n# Q2 revenue by region/);
  assert.deepEqual(findChartReferences(embedding.nextSource), [chart.id]);
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
  assert.match(invalid.errors[0], /only in Markdown documents or semantic presentations/i);
});
