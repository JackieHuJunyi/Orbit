import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { workspaceFileExportCapabilities, workspaceFileExportCapability } from "../app/lib/workspace-file-export.ts";
import { prepareWorkspaceFileExport } from "../app/lib/workspace-file-export-runtime.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";
import { defaultQuerySnapshot, defaultSummaryQuerySnapshot } from "./query-snapshot-fixture.mjs";

function artifact(kind) {
  const result = defaultArtifacts.find((candidate) => candidate.kind === kind);
  assert.ok(result);
  return result;
}

test("derives every reviewed handoff from one artifact-kind capability table", () => {
  assert.deepEqual(
    workspaceFileExportCapabilities(artifact("document")).map(({ destination, targetType, label }) => ({
      destination,
      targetType,
      label,
    })),
    [
      { destination: "source", targetType: "md", label: "MD" },
      { destination: "office", targetType: "docx", label: "DOCX" },
      { destination: "legacy-office", targetType: "doc", label: "DOC" },
      { destination: "odf", targetType: "odt", label: "ODT" },
      { destination: "pdf", targetType: "pdf", label: "PDF" },
    ],
  );
  assert.deepEqual(
    workspaceFileExportCapabilities(artifact("data")).map(({ destination, targetType }) => ({
      destination,
      targetType,
    })),
    [
      { destination: "source", targetType: "csv" },
      { destination: "csv", targetType: "csv" },
      { destination: "json", targetType: "json" },
      { destination: "office", targetType: "xlsx" },
      { destination: "odf", targetType: "ods" },
      { destination: "pdf", targetType: "pdf" },
    ],
  );
  assert.deepEqual(
    workspaceFileExportCapabilities(artifact("slides")).map(({ destination, targetType }) => ({
      destination,
      targetType,
    })),
    [
      { destination: "source", targetType: "html" },
      { destination: "office", targetType: "pptx" },
      { destination: "legacy-office", targetType: "ppt" },
      { destination: "odf", targetType: "odp" },
      { destination: "html", targetType: "html" },
      { destination: "pdf", targetType: "pdf" },
    ],
  );
  assert.deepEqual(
    workspaceFileExportCapabilities(artifact("query")).map(({ destination, targetType, label }) => ({
      destination,
      targetType,
      label,
    })),
    [{ destination: "source", targetType: "sql", label: "SQL" }],
  );
  assert.deepEqual(
    workspaceFileExportCapabilities(artifact("chart")).map(({ destination, targetType, label }) => ({
      destination,
      targetType,
      label,
    })),
    [{ destination: "source", targetType: "chart-json", label: "CHART.JSON" }],
  );
  assert.equal(workspaceFileExportCapability(artifact("document"), "json"), null);
  assert.deepEqual(
    workspaceFileExportCapability({ ...artifact("data"), name: "typed.json" }, "source"),
    Object.freeze({ destination: "source", targetType: "json", label: "JSON" }),
  );
  assert.deepEqual(
    workspaceFileExportCapability(
      { ...artifact("slides"), name: "legacy.deck.md", language: "Deck Markdown" },
      "source",
    ),
    Object.freeze({ destination: "source", targetType: "deck-md", label: "DECK.MD" }),
  );
  assert.equal(Object.isFrozen(workspaceFileExportCapabilities(artifact("data"))), true);
});

test("reviews byte-exact canonical source for every artifact family without starting runtime evidence ports", async () => {
  const expectedTargets = new Map([
    ["document", "md"],
    ["data", "csv"],
    ["query", "sql"],
    ["chart", "chart-json"],
    ["slides", "html"],
  ]);
  const forbiddenPorts = {
    async runQuerySnapshot() {
      throw new Error("Canonical source must not start DuckDB.");
    },
    async loadImageAsset() {
      throw new Error("Canonical source must not read image storage.");
    },
  };

  for (const kind of expectedTargets.keys()) {
    const source = Object.freeze({ ...artifact(kind) });
    const workspace = Object.freeze([source]);
    const result = await prepareWorkspaceFileExport("source", source, workspace, forbiddenPorts);
    assert.equal(result.targetType, expectedTargets.get(kind));
    assert.equal(result.fileName, source.name);
    assert.equal(result.handoffKind, "canonical-source");
    assert.equal(new TextDecoder().decode(result.bytes), source.source);
    assert.match(result.warnings[0], /exact readable canonical source/i);
    assert.equal(workspace[0], source);
  }

  const imageId = "a".repeat(64);
  const imageDocument = Object.freeze({
    id: "source-image-document",
    name: "source-image-document.md",
    kind: "document",
    language: "Markdown",
    source: `# Image\n\n![Proof](rune-asset:sha256:${imageId})\n`,
  });
  const imageResult = await prepareWorkspaceFileExport("source", imageDocument, [imageDocument], forbiddenPorts);
  assert.match(imageResult.warnings.join("\n"), /1 local image reference remains/i);

  const oversized = { ...imageDocument, source: "a".repeat(12 * 1024 * 1024 + 1) };
  await assert.rejects(() => prepareWorkspaceFileExport("source", oversized, [oversized]), /limited to 12 MB/i);
});

test("uses the shared runtime for portable CSV and JSON without starting Query or asset ports", async () => {
  const source = Object.freeze({ ...artifact("data") });
  const workspace = Object.freeze([source]);
  const forbiddenPorts = {
    async runQuerySnapshot() {
      throw new Error("Data export must not start DuckDB.");
    },
    async loadImageAsset() {
      throw new Error("Data export must not read image storage.");
    },
  };
  const csv = await prepareWorkspaceFileExport("csv", source, workspace, forbiddenPorts);
  const json = await prepareWorkspaceFileExport("json", source, workspace, forbiddenPorts);

  assert.equal(csv.targetType, "csv");
  assert.equal(json.targetType, "json");
  assert.match(new TextDecoder().decode(csv.bytes), /Region,Q2 Revenue/u);
  assert.match(new TextDecoder().decode(json.bytes), /"Region": "North America"/u);
  assert.equal(source.source, artifact("data").source);
  assert.equal(workspace[0], source);
});

test("prepares exact Query snapshots before one compiled Office handoff without mutating the workspace", async () => {
  const document = artifact("document");
  const before = structuredClone(defaultArtifacts);
  const snapshots = new Map([
    ["regional-analysis", defaultQuerySnapshot()],
    ["regional-summary", defaultSummaryQuerySnapshot()],
  ]);
  const calls = [];
  const result = await prepareWorkspaceFileExport("office", document, defaultArtifacts, {
    async runQuerySnapshot(queryArtifact, dataArtifact) {
      calls.push([queryArtifact.id, dataArtifact.id]);
      const snapshot = snapshots.get(queryArtifact.id);
      assert.ok(snapshot);
      return snapshot;
    },
    async loadImageAsset() {
      throw new Error("The sample document has no local image.");
    },
  });

  assert.equal(result.targetType, "docx");
  assert.ok(result.bytes.length > 1_000);
  assert.deepEqual(calls, [
    ["regional-analysis", "regional-revenue"],
    ["regional-summary", "regional-revenue"],
  ]);
  assert.deepEqual(defaultArtifacts, before);
});

test("fails before handoff on unsupported targets, truncated evidence, or missing local assets", async () => {
  await assert.rejects(
    () => prepareWorkspaceFileExport("csv", artifact("document"), defaultArtifacts),
    /document cannot export to csv/i,
  );
  const summary = defaultSummaryQuerySnapshot();
  await assert.rejects(
    () =>
      prepareWorkspaceFileExport("office", artifact("document"), defaultArtifacts, {
        async runQuerySnapshot(queryArtifact) {
          const snapshot = queryArtifact.id === "regional-summary" ? summary : defaultQuerySnapshot();
          return { ...snapshot, result: { ...snapshot.result, truncated: true } };
        },
        async loadImageAsset() {
          return null;
        },
      }),
    /500 rows or fewer/i,
  );
  const imageId = "a".repeat(64);
  const imageDocument = {
    id: "image-document",
    name: "image-document.md",
    kind: "document",
    language: "Markdown",
    source: `# Image\n\n![Proof](rune-asset:sha256:${imageId})\n`,
  };
  const requested = [];
  await assert.rejects(
    () =>
      prepareWorkspaceFileExport("office", imageDocument, [imageDocument], {
        async loadImageAsset(id) {
          requested.push(id);
          return null;
        },
      }),
    /missing or corrupt/i,
  );
  assert.deepEqual(requested, [imageId]);
});

test("keeps capability metadata eager and the complete export runtime behind one typed lazy boundary", async () => {
  const [capabilities, runtime, workbench] = await Promise.all([
    readFile(new URL("../app/lib/workspace-file-export.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/workspace-file-export-runtime.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(capabilities, /duckdb-client|office-export|odf-export|html-export|pdf-export|local-assets/);
  assert.match(workbench, /import\("\.\.\/lib\/workspace-file-export-runtime"\)/);
  assert.doesNotMatch(workbench, /from "\.\.\/lib\/workspace-file-export-runtime"/);
  assert.match(runtime, /Record<WorkspaceFileExportDestination, WorkspaceFileExportConverter>/);
  for (const moduleName of [
    "data-export",
    "office-export",
    "odf-export",
    "html-export",
    "pdf-export",
    "duckdb-client",
  ]) {
    assert.match(runtime, new RegExp(`import\\(\"\\./${moduleName}\\.ts\"\\)`));
  }
  assert.doesNotMatch(workbench, /officeExportType|legacyOfficeExportType|odfExportType/);
  assert.doesNotMatch(workbench, /exportOfficeArtifact|exportOdfArtifact|exportDeckHtml|exportPdfArtifact/);
});
