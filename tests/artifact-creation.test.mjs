import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_ARTIFACT_TITLE_CHARS,
  MAX_WORKSPACE_ARTIFACTS,
  artifactCreationSourceOptions,
  commitPreparedArtifactCreation,
  prepareArtifactCreation,
} from "../app/lib/artifact-creation.ts";
import { parseChartSource } from "../app/lib/charts.ts";
import { compileLegacyHtmlSlides } from "../app/lib/legacy-html-slides.ts";
import { validateWorkspaceArtifacts } from "../app/lib/patches.ts";
import { parseQueryDataSourceDirective } from "../app/lib/query-source.ts";
import { semanticHtmlPresentationMetadata } from "../app/lib/semantic-html-presentation.ts";
import { parseDataSource } from "../app/lib/workspace.ts";

test("creates a readable blank Markdown document without mutating the workspace", () => {
  const existing = [
    { id: "existing", name: "existing.md", kind: "document", language: "Markdown", source: "# Existing\n" },
  ];
  const prepared = prepareArtifactCreation(existing, { kind: "document", title: "Project Brief" });
  assert.deepEqual(prepared.errors, []);
  assert.deepEqual(prepared.artifact, {
    id: "project-brief",
    name: "project-brief.md",
    kind: "document",
    language: "Markdown",
    source: "# Project Brief\n\n",
  });
  assert.equal(prepared.nextArtifacts.length, 2);
  assert.equal(prepared.nextArtifacts[0], existing[0]);
  assert.equal(existing.length, 1);
  assert.deepEqual(validateWorkspaceArtifacts(prepared.nextArtifacts), []);
});

test("creates an empty valid CSV table with explicit columns", () => {
  const prepared = prepareArtifactCreation([], { kind: "data", title: "Operating Metrics" });
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.artifact.name, "operating-metrics.csv");
  assert.deepEqual(parseDataSource(prepared.artifact.source), {
    columns: ["Item", "Value"],
    rows: [],
    errors: [],
    format: "CSV",
  });
});

test("creates complete semantic HTML that compiles from one readable cover slide", () => {
  const prepared = prepareArtifactCreation([], { kind: "slides", title: "Board Narrative" });
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.artifact.name, "board-narrative.html");
  assert.equal(prepared.artifact.language, "Semantic HTML");
  const parsed = compileLegacyHtmlSlides(prepared.artifact.source);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.slides.length, 1);
  assert.match(parsed.slides[0].source, /<h1>Board Narrative<\/h1>/);
  assert.deepEqual(semanticHtmlPresentationMetadata(prepared.artifact.source), {
    title: "Board Narrative",
    theme: "rune",
    lang: "en",
  });
});

test("creates an explicit Query from one exact Data source", () => {
  const data = {
    id: "regional-sales",
    name: "regional-sales.csv",
    kind: "data",
    language: "CSV / JSON",
    source: "Region,Revenue\nAPAC,1840000\nEurope,970000\n",
  };
  const prepared = prepareArtifactCreation([data], {
    kind: "query",
    title: "Revenue Analysis",
    sourceArtifactId: data.id,
  });
  assert.deepEqual(prepared.errors, []);
  assert.deepEqual(
    {
      id: prepared.artifact.id,
      name: prepared.artifact.name,
      kind: prepared.artifact.kind,
      language: prepared.artifact.language,
    },
    {
      id: "revenue-analysis",
      name: "revenue-analysis.sql",
      kind: "query",
      language: "DuckDB SQL",
    },
  );
  assert.deepEqual(parseQueryDataSourceDirective(prepared.artifact.source), {
    artifactId: data.id,
    explicit: true,
    errors: [],
  });
  assert.match(prepared.artifact.source, /SELECT \*\nFROM workspace_data;/);
  assert.deepEqual(validateWorkspaceArtifacts(prepared.nextArtifacts), []);
});

test("discovers exact source fields and creates Data- or Query-backed Chart JSON", () => {
  const data = {
    id: "regional-sales",
    name: "regional-sales.csv",
    kind: "data",
    language: "CSV / JSON",
    source: "Region,Revenue\nAPAC,1840000\nEurope,970000\n",
  };
  const query = prepareArtifactCreation([data], {
    kind: "query",
    title: "Revenue Analysis",
    sourceArtifactId: data.id,
  }).artifact;
  const workspace = [data, query];
  assert.deepEqual(artifactCreationSourceOptions(workspace, "query"), [
    {
      artifactId: data.id,
      name: data.name,
      kind: "data",
      columns: ["Region", "Revenue"],
      numericColumns: ["Revenue"],
    },
  ]);
  assert.deepEqual(
    artifactCreationSourceOptions(workspace, "chart").map((option) => ({
      artifactId: option.artifactId,
      columns: option.columns,
    })),
    [
      { artifactId: data.id, columns: ["Region", "Revenue"] },
      { artifactId: query.id, columns: ["Region", "Revenue"] },
    ],
  );

  const direct = prepareArtifactCreation(workspace, {
    kind: "chart",
    title: "Regional Revenue",
    sourceArtifactId: data.id,
    category: "Region",
    value: "Revenue",
    mark: "bar",
    format: "currency",
  });
  assert.deepEqual(direct.errors, []);
  assert.equal(direct.artifact.name, "regional-revenue.chart.json");
  assert.deepEqual(parseChartSource(direct.artifact.source).spec, {
    version: 1,
    title: "Regional Revenue",
    description: "",
    source: data.id,
    mark: "bar",
    category: "Region",
    value: "Revenue",
    sort: "descending",
    format: "currency",
    color: "#ff5c35",
    maxItems: 8,
  });

  const queryBacked = prepareArtifactCreation(workspace, {
    kind: "chart",
    title: "Revenue Trend",
    sourceArtifactId: query.id,
    category: "Region",
    value: "Revenue",
    mark: "line",
    format: "number",
  });
  assert.deepEqual(queryBacked.errors, []);
  assert.equal(parseChartSource(queryBacked.artifact.source).spec.sort, "source");

  const area = prepareArtifactCreation(workspace, {
    kind: "chart",
    title: "Revenue volume",
    sourceArtifactId: data.id,
    category: "Region",
    value: "Revenue",
    mark: "area",
    format: "currency",
  });
  assert.deepEqual(area.errors, []);
  assert.equal(parseChartSource(area.artifact.source).spec.mark, "area");
  assert.equal(parseChartSource(area.artifact.source).spec.sort, "source");
});

test("rejects invented creation sources and fields without partial artifacts", () => {
  const data = {
    id: "regional-sales",
    name: "regional-sales.csv",
    kind: "data",
    language: "CSV / JSON",
    source: "Region,Revenue\nAPAC,1840000\n",
  };
  const missingQuerySource = prepareArtifactCreation([data], {
    kind: "query",
    title: "Unsafe Query",
    sourceArtifactId: "invented-data",
  });
  assert.equal(missingQuerySource.artifact, undefined);
  assert.equal(missingQuerySource.nextArtifacts[0], data);
  assert.match(missingQuerySource.errors[0], /existing Data source/i);

  const inventedChartField = prepareArtifactCreation([data], {
    kind: "chart",
    title: "Unsafe Chart",
    sourceArtifactId: data.id,
    category: "Region",
    value: "Profit",
    mark: "bar",
    format: "number",
  });
  assert.equal(inventedChartField.artifact, undefined);
  assert.equal(inventedChartField.nextArtifacts[0], data);
  assert.match(inventedChartField.errors[0], /exact value field/i);
});

test("resolves filename and id collisions case-insensitively", () => {
  const existing = [
    {
      id: "project-brief",
      name: "PROJECT-BRIEF.MD",
      kind: "document",
      language: "Markdown",
      source: "# Existing\n",
    },
  ];
  const prepared = prepareArtifactCreation(existing, { kind: "document", title: "Project Brief" });
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.artifact.id, "project-brief-2");
  assert.equal(prepared.artifact.name, "project-brief-2.md");
});

test("keeps the id and filename suffix aligned when only one identity collides", () => {
  const idOnly = prepareArtifactCreation(
    [
      {
        id: "project-brief",
        name: "legacy-name.md",
        kind: "document",
        language: "Markdown",
        source: "# Existing\n",
      },
    ],
    { kind: "document", title: "Project Brief" },
  );
  assert.equal(idOnly.artifact.id, "project-brief-2");
  assert.equal(idOnly.artifact.name, "project-brief-2.md");

  const nameOnly = prepareArtifactCreation(
    [
      {
        id: "legacy-id",
        name: "project-brief.md",
        kind: "document",
        language: "Markdown",
        source: "# Existing\n",
      },
    ],
    { kind: "document", title: "Project Brief" },
  );
  assert.equal(nameOnly.artifact.id, "project-brief-2");
  assert.equal(nameOnly.artifact.name, "project-brief-2.md");
});

test("keeps Unicode titles readable while producing portable source identity", () => {
  const prepared = prepareArtifactCreation([], { kind: "document", title: "  Q3 增长 计划  " });
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.artifact.name, "q3-增长-计划.md");
  assert.equal(prepared.artifact.source, "# Q3 增长 计划\n\n");

  const reserved = prepareArtifactCreation([], { kind: "document", title: "CON" });
  assert.equal(reserved.artifact.name, "rune-con.md");
});

test("rejects unsafe titles and an overfull workspace without partial artifacts", () => {
  const invalidTitles = ["", "Line one\nLine two", "<script>", "x".repeat(MAX_ARTIFACT_TITLE_CHARS + 1)];
  invalidTitles.forEach((title) => {
    const prepared = prepareArtifactCreation([], { kind: "document", title });
    assert.equal(prepared.artifact, undefined);
    assert.equal(prepared.nextArtifacts.length, 0);
    assert.ok(prepared.errors.length);
  });

  const full = Array.from({ length: MAX_WORKSPACE_ARTIFACTS }, (_, index) => ({
    id: `artifact-${index}`,
    name: `artifact-${index}.md`,
    kind: "document",
    language: "Markdown",
    source: `# Artifact ${index}\n`,
  }));
  const prepared = prepareArtifactCreation(full, { kind: "document", title: "One too many" });
  assert.equal(prepared.artifact, undefined);
  assert.equal(prepared.nextArtifacts, full);
  assert.match(prepared.errors[0], /limited to 50 artifacts/i);
});

test("blocks creation when the complete current workspace is invalid", () => {
  const invalidWorkspace = [
    {
      id: "broken",
      name: "broken.md",
      kind: "document",
      language: "Markdown",
      source: '# Broken\n\n{{ metric("missing") }}',
    },
  ];
  const prepared = prepareArtifactCreation(invalidWorkspace, { kind: "document", title: "New report" });
  assert.equal(prepared.artifact, undefined);
  assert.equal(prepared.nextArtifacts, invalidWorkspace);
  assert.match(prepared.errors.join(" "), /unresolved metric missing/i);
});

test("commits one prepared workspace write and exposes storage failure without mutation", () => {
  const existing = [
    { id: "existing", name: "existing.md", kind: "document", language: "Markdown", source: "# Existing\n" },
  ];
  const prepared = prepareArtifactCreation(existing, { kind: "document", title: "New report" });
  const writes = [];
  const committed = commitPreparedArtifactCreation(prepared, (artifacts, selectedId) => {
    writes.push({ artifacts, selectedId });
  });
  assert.deepEqual(committed, { committed: true, error: "" });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].artifacts, prepared.nextArtifacts);
  assert.equal(writes[0].selectedId, prepared.artifact.id);

  const failed = commitPreparedArtifactCreation(prepared, () => {
    throw new Error("quota");
  });
  assert.equal(failed.committed, false);
  assert.match(failed.error, /workspace unchanged/i);
  assert.equal(existing.length, 1);
});
